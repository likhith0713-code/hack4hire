from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from sqlalchemy import DateTime, Table, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.engine import Connection
from sqlalchemy.exc import SQLAlchemyError

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")

from api.database import (  # noqa: E402
    JSON_COLUMNS,
    ROOT as PROJECT_ROOT,
    database_url,
    get_engine,
    initialize_database,
    metadata,
)

APPLICATION_TABLES = (
    "workflows",
    "users",
    "employees",
    "finance_reviews",
    "tasks",
    "approvals",
    "notifications",
    "it_requests",
    "payment_requests",
    "workspace_settings",
    "sessions",
    "audit_events",
)
CHECKPOINT_TABLE_MARKERS = ("checkpoint", "checkpoints", "writes")


class MigrationError(RuntimeError):
    pass


def _arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Copy workforce.db application records into DATABASE_URL PostgreSQL."
    )
    parser.add_argument(
        "--sqlite-path",
        type=Path,
        default=PROJECT_ROOT / "workforce.db",
        help="Path to the source SQLite database (read-only).",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Commit the migration. Without this flag, validate and roll back (dry run).",
    )
    parser.add_argument(
        "--skip-checkpoints",
        action="store_true",
        help=(
            "Explicitly accept that SQLite LangGraph checkpoints are not copied. "
            "Resolve active workflows first."
        ),
    )
    return parser.parse_args()


def _sqlite_connection(path: Path) -> sqlite3.Connection:
    if not path.is_file():
        raise MigrationError(f"SQLite source does not exist: {path}")
    uri = f"{path.resolve().as_uri()}?mode=ro"
    connection = sqlite3.connect(uri, uri=True)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def _source_tables(connection: sqlite3.Connection) -> set[str]:
    return {
        row["name"]
        for row in connection.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
        )
    }


def _checkpoint_tables(connection: sqlite3.Connection) -> list[str]:
    return sorted(
        name
        for name in _source_tables(connection)
        if any(marker in name.lower() for marker in CHECKPOINT_TABLE_MARKERS)
    )


def _timestamp(value: Any, table_name: str, column_name: str) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        parsed = value
    else:
        try:
            parsed = datetime.fromisoformat(str(value))
        except ValueError as exc:
            raise MigrationError(
                f"Invalid timestamp in {table_name}.{column_name}: {value!r}"
            ) from exc
    return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed


def _convert_value(table: Table, column_name: str, value: Any) -> Any:
    if value is None:
        return None
    if isinstance(table.c[column_name].type, DateTime):
        return _timestamp(value, table.name, column_name)
    if column_name in JSON_COLUMNS.get(table.name, set()):
        if isinstance(value, (dict, list)):
            return value
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError) as exc:
            raise MigrationError(
                f"Invalid JSON in {table.name}.{column_name}."
            ) from exc
    return value


def _read_rows(
    source: sqlite3.Connection, table: Table
) -> list[dict[str, Any]]:
    source_columns = {
        row["name"]
        for row in source.execute(f'PRAGMA table_info("{table.name}")')
    }
    if not source_columns:
        raise MigrationError(f"Source table {table.name} has no columns.")
    unknown_columns = source_columns - set(table.columns.keys())
    if unknown_columns:
        raise MigrationError(
            f"Source {table.name} has unmapped columns: "
            f"{', '.join(sorted(unknown_columns))}"
        )
    missing_required = [
        column.name
        for column in table.columns
        if column.name not in source_columns
        and not column.nullable
        and column.server_default is None
    ]
    if missing_required:
        raise MigrationError(
            f"Source {table.name} lacks required columns: {', '.join(missing_required)}"
        )
    return [
        {
            column.name: _convert_value(table, column.name, source_row[column.name])
            for column in table.columns
            if column.name in source_columns
        }
        for source_row in source.execute(f'SELECT * FROM "{table.name}"')
    ]


def _normalized_row(row: Any, keys: list[str]) -> dict[str, Any]:
    values = dict(row)
    return {key: values.get(key) for key in keys}


def _existing_row(
    connection: Connection, table: Table, key_name: str, key_value: Any
) -> dict[str, Any] | None:
    row = connection.execute(
        select(table).where(table.c[key_name] == key_value)
    ).mappings().first()
    return dict(row) if row is not None else None


def migrate(source_path: Path, *, apply: bool, skip_checkpoints: bool) -> int:
    source: sqlite3.Connection | None = None
    transaction = None
    active_row: tuple[str, int] | None = None
    counts = {name: {"source": 0, "inserted": 0, "identical": 0} for name in APPLICATION_TABLES}
    try:
        source = _sqlite_connection(source_path)
        found_tables = _source_tables(source)
        missing = sorted(set(APPLICATION_TABLES) - found_tables)
        if missing:
            raise MigrationError(
                f"SQLite source is missing application tables: {', '.join(missing)}"
            )

        checkpoints = _checkpoint_tables(source)
        if checkpoints and not skip_checkpoints:
            raise MigrationError(
                "LangGraph checkpoint tables were found and are intentionally not copied. "
                "Resolve active workflows and rerun with --skip-checkpoints only after "
                "accepting that checkpoint history will not be transferred. "
                f"Detected: {', '.join(checkpoints)}"
            )
        if checkpoints:
            active = source.execute(
                """SELECT COUNT(*) FROM workflows
                   WHERE status NOT IN ('completed', 'failed', 'cancelled', 'rejected')"""
            ).fetchone()[0]
            if active:
                raise MigrationError(
                    f"{active} active workflow(s) remain. Resolve them before skipping checkpoints."
                )
            print(
                "Checkpoint warning: LangGraph checkpoint tables will not be migrated: "
                + ", ".join(checkpoints)
            )

        if apply:
            print(
                "Backup recommendation: take a Supabase backup/snapshot and preserve "
                "the original workforce.db before running this write operation."
            )
            initialize_database()
        engine = get_engine()
        with engine.connect() as target:
            transaction = target.begin()
            if not apply:
                from sqlalchemy import inspect

                target_tables = set(inspect(target).get_table_names())
                missing_target_tables = sorted(
                    set(APPLICATION_TABLES) - target_tables
                )
                if missing_target_tables:
                    raise MigrationError(
                        "PostgreSQL schema is not initialized. Run "
                        "'python -m alembic upgrade head' or rerun with --apply; "
                        f"missing: {', '.join(missing_target_tables)}"
                    )
            for table_name in APPLICATION_TABLES:
                table = metadata.tables[table_name]
                rows = _read_rows(source, table)
                counts[table_name]["source"] = len(rows)
                key_column = next(column for column in table.columns if column.primary_key)
                for row_number, values in enumerate(rows, start=1):
                    active_row = (table_name, row_number)
                    if key_column.name not in values:
                        raise MigrationError(
                            f"Source {table_name} row lacks primary key {key_column.name}."
                        )
                    insert_statement = insert(table).values(**values).on_conflict_do_nothing(
                        index_elements=[key_column.name]
                    )
                    result = target.execute(insert_statement)
                    existing = _existing_row(
                        target, table, key_column.name, values[key_column.name]
                    )
                    expected = dict(values)
                    if existing is None:
                        raise MigrationError(
                            f"Could not verify migrated row in {table_name} "
                            f"for {key_column.name}={values[key_column.name]!r}."
                        )
                    existing_normalized = _normalized_row(existing, list(expected))
                    if existing_normalized != expected:
                        raise MigrationError(
                            f"Conflicting PostgreSQL row in {table_name} for "
                            f"{key_column.name}={values[key_column.name]!r}; no row was overwritten."
                        )
                    if result.rowcount:
                        counts[table_name]["inserted"] += 1
                    else:
                        counts[table_name]["identical"] += 1
                active_row = None

            for table_name, count in counts.items():
                if count["inserted"] + count["identical"] != count["source"]:
                    raise MigrationError(
                        f"Row-count verification failed for {table_name}."
                    )

            if apply:
                transaction.commit()
            else:
                transaction.rollback()

        print("Rows by application table:")
        for table_name, count in counts.items():
            print(
                f"  {table_name}: source={count['source']}, "
                f"inserted={count['inserted']}, already_identical={count['identical']}"
            )
        if apply:
            print("Migration committed; PostgreSQL rows were verified before commit.")
        else:
            print("Dry run complete; PostgreSQL transaction was rolled back. Use --apply to commit.")
        return 0
    except (MigrationError, SQLAlchemyError, sqlite3.Error, ValueError, TypeError) as exc:
        if transaction is not None and transaction.is_active:
            transaction.rollback()
        if isinstance(exc, MigrationError):
            print(f"Migration aborted and rolled back: {exc}", file=sys.stderr)
        else:
            print(
                f"Migration aborted and rolled back ({type(exc).__name__}); "
                "inspect the source schema and PostgreSQL constraints.",
                file=sys.stderr,
            )
        if active_row is not None:
            print(
                f"Failed source row: {active_row[0]} row {active_row[1]}.",
                file=sys.stderr,
            )
        print(
            "Committed application rows: 0; the migration transaction was rolled back.",
            file=sys.stderr,
        )
        return 1
    finally:
        if source is not None:
            source.close()


def main() -> int:
    args = _arguments()
    try:
        database_url()
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        return 2
    return migrate(
        args.sqlite_path,
        apply=args.apply,
        skip_checkpoints=args.skip_checkpoints,
    )


if __name__ == "__main__":
    raise SystemExit(main())
