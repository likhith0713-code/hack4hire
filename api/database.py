from __future__ import annotations

import json
import os
import re
from collections.abc import Iterator, Mapping
from datetime import date, datetime
from pathlib import Path
from typing import Any

from alembic import command
from alembic.config import Config
from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    and_,
    create_engine,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.engine import Connection as SQLAlchemyConnection
from sqlalchemy.engine import Engine, URL, make_url
from sqlalchemy.sql import bindparam


ROOT = Path(__file__).resolve().parent.parent
JSON_COLUMNS: dict[str, set[str]] = {
    "workflows": {"shared_context"},
    "tasks": {"input_data", "dependencies", "execution_result"},
    "approvals": {"information"},
    "finance_reviews": {"analysis"},
    "workspace_settings": {"payload"},
}
TABLE_COLUMNS: dict[str, tuple[str, ...]] = {}
metadata = MetaData()


def _json_column(name: str, *, nullable: bool = True, default: str | None = None) -> Column:
    return Column(
        name,
        JSONB,
        nullable=nullable,
        server_default=text(default) if default else None,
    )


workflows = Table(
    "workflows",
    metadata,
    Column("id", String, primary_key=True),
    Column("title", Text, nullable=False),
    Column("request", Text, nullable=False),
    Column("status", String, nullable=False),
    Column("created_by", Text, nullable=False),
    Column("department", Text),
    Column("employee_name", Text),
    Column("joining_date", Text),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("updated_at", DateTime(timezone=True), nullable=False),
    Column("final_result", Text),
    _json_column("shared_context", nullable=False, default="'{}'::jsonb"),
)
tasks = Table(
    "tasks",
    metadata,
    Column("id", String, primary_key=True),
    Column("workflow_id", String, ForeignKey("workflows.id"), nullable=False),
    Column("agent_id", String, nullable=False),
    Column("title", Text, nullable=False),
    Column("description", Text, nullable=False),
    Column("status", String, nullable=False),
    Column("sort_order", Integer, nullable=False),
    Column("requires_approval", Integer, nullable=False, server_default=text("0")),
    Column("result", Text),
    Column("dependency", Text),
    Column("started_at", DateTime(timezone=True)),
    Column("completed_at", DateTime(timezone=True)),
    Column("created_at", DateTime(timezone=True)),
    Column("action", Text, nullable=False, server_default=text("''")),
    Column("task_name", Text),
    Column("assigned_agent", Text),
    _json_column("input_data", nullable=False, default="'{}'::jsonb"),
    _json_column("dependencies", nullable=False, default="'[]'::jsonb"),
    Column("priority", Integer, nullable=False, server_default=text("5")),
    _json_column("execution_result"),
    Column("error_message", Text),
)
approvals = Table(
    "approvals",
    metadata,
    Column("id", String, primary_key=True),
    Column("workflow_id", String, ForeignKey("workflows.id"), nullable=False),
    Column("title", Text, nullable=False),
    Column("action", Text, nullable=False),
    Column("agent_id", String, nullable=False),
    Column("requester", Text, nullable=False),
    Column("reason", Text, nullable=False),
    _json_column("information", nullable=False),
    Column("risk", String, nullable=False),
    Column("status", String, nullable=False),
    Column("requested_at", DateTime(timezone=True), nullable=False),
    Column("decided_at", DateTime(timezone=True)),
    Column("decided_by", Text),
    Column("decision_reason", Text),
)
employees = Table(
    "employees",
    metadata,
    Column("id", String, primary_key=True),
    Column("name", Text, nullable=False),
    Column("department", Text, nullable=False),
    Column("title", Text, nullable=False),
    Column("joining_date", Text, nullable=False),
    Column("status", String, nullable=False),
    Column("workflow_id", String),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("email", Text),
)
audit_events = Table(
    "audit_events",
    metadata,
    Column("id", String, primary_key=True),
    Column("workflow_id", String),
    Column("actor_type", String, nullable=False),
    Column("actor_id", Text, nullable=False),
    Column("action", Text, nullable=False),
    Column("detail", Text, nullable=False),
    Column("status", String, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
)
finance_reviews = Table(
    "finance_reviews",
    metadata,
    Column("id", String, primary_key=True),
    Column("vendor", Text, nullable=False),
    Column("invoice_number", Text, nullable=False),
    Column("amount", Text, nullable=False),
    Column("status", String, nullable=False),
    Column("created_by", Text, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("vendor_email", Text),
    Column("invoice_date", Text),
    Column("due_date", Text),
    Column("gst_percentage", Text),
    Column("tax_amount", Text),
    Column("total_amount", Text),
    Column("currency", String),
    Column("expense_category", Text),
    Column("description", Text),
    Column("attachment_path", Text),
    _json_column("analysis"),
)
workspace_settings = Table(
    "workspace_settings",
    metadata,
    Column("id", Integer, primary_key=True),
    CheckConstraint("id = 1", name="workspace_settings_singleton_check"),
    _json_column("payload", nullable=False),
    Column("updated_at", DateTime(timezone=True), nullable=False),
)
notifications = Table(
    "notifications",
    metadata,
    Column("id", String, primary_key=True),
    Column("workflow_id", String, ForeignKey("workflows.id")),
    Column("recipient", Text),
    Column("subject", Text, nullable=False),
    Column("body", Text, nullable=False),
    Column("status", String, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
)
it_requests = Table(
    "it_requests",
    metadata,
    Column("id", String, primary_key=True),
    Column("employee_name", Text, nullable=False),
    Column("request_type", Text, nullable=False),
    Column("description", Text, nullable=False),
    Column("status", String, nullable=False),
    Column("created_by", Text, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("employee_id", String),
    Column("workflow_id", String),
)
payment_requests = Table(
    "payment_requests",
    metadata,
    Column("id", String, primary_key=True),
    Column("invoice_id", String, ForeignKey("finance_reviews.id"), nullable=False, unique=True),
    Column("workflow_id", String, ForeignKey("workflows.id"), nullable=False),
    Column("amount", Text, nullable=False),
    Column("currency", String, nullable=False),
    Column("status", String, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
)
users = Table(
    "users",
    metadata,
    Column("id", String, primary_key=True),
    Column("name", Text, nullable=False),
    Column("email", Text, nullable=False),
    Column("password_hash", Text, nullable=False),
    Column("role", String, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
)
sessions = Table(
    "sessions",
    metadata,
    Column("token_hash", String, primary_key=True),
    Column("user_id", String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
    Column("expires_at", DateTime(timezone=True), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
)

Index(
    "employees_email_unique",
    func.lower(employees.c.email),
    unique=True,
    postgresql_where=and_(employees.c.email.is_not(None), employees.c.email != ""),
)
Index(
    "finance_invoice_unique",
    func.lower(finance_reviews.c.vendor),
    func.lower(finance_reviews.c.invoice_number),
    unique=True,
)
Index(
    "it_requests_workflow_unique",
    it_requests.c.workflow_id,
    it_requests.c.employee_id,
    it_requests.c.request_type,
    unique=True,
    postgresql_where=and_(
        it_requests.c.workflow_id.is_not(None),
        it_requests.c.employee_id.is_not(None),
    ),
)
Index("sessions_expiry_idx", sessions.c.expires_at)
Index("users_email_unique", func.lower(users.c.email), unique=True)

for table in metadata.sorted_tables:
    TABLE_COLUMNS[table.name] = tuple(column.name for column in table.columns)


class DatabaseConfigurationError(RuntimeError):
    """Raised when database configuration is missing or invalid."""


def database_url(environ: Mapping[str, str] | None = None) -> URL:
    values = os.environ if environ is None else environ
    raw_url = values.get("DATABASE_URL", "").strip()
    if not raw_url:
        raise DatabaseConfigurationError(
            "DATABASE_URL is required. Set it to the Supabase PostgreSQL connection URL."
        )
    try:
        url = make_url(raw_url)
    except (TypeError, ValueError) as exc:
        raise DatabaseConfigurationError(
            "DATABASE_URL must be a valid PostgreSQL connection URL."
        ) from exc
    if (
        url.drivername not in {"postgres", "postgresql", "postgresql+psycopg"}
        or not url.host
        or not url.database
    ):
        raise DatabaseConfigurationError(
            "DATABASE_URL must identify a PostgreSQL database and host."
        )
    query = dict(url.query)
    query.setdefault("sslmode", "require")
    return url.set(drivername="postgresql+psycopg", query=query)


_engine: Engine | None = None
_engine_url: URL | None = None


def get_engine() -> Engine:
    global _engine, _engine_url
    url = database_url()
    if _engine is None or _engine_url != url:
        if _engine is not None:
            _engine.dispose()
        _engine = create_engine(
            url,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10,
            pool_timeout=30,
            pool_recycle=1800,
            connect_args={"prepare_threshold": None},
        )
        _engine_url = url
    return _engine


def dispose_engine() -> None:
    global _engine, _engine_url
    if _engine is not None:
        _engine.dispose()
    _engine = None
    _engine_url = None


def check_database_health() -> bool:
    with get_connection() as connection:
        connection.execute("SELECT 1").fetchone()
    return True


def initialize_database() -> None:
    config = Config(str(ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(ROOT / "alembic"))
    with get_engine().begin() as connection:
        connection.execute(text("SELECT pg_advisory_xact_lock(684512310)"))
        config.attributes["connection"] = connection
        command.upgrade(config, "head")


def _json_parameter_indexes(statement: str, placeholder: str) -> set[int]:
    indexes: set[int] = set()
    placeholder_count = len(re.findall(placeholder, statement))
    insert = re.search(
        r"\binsert\s+into\s+([a-z_][a-z0-9_]*)\s*(?:\((.*?)\))?\s*values\s*\((.*?)\)",
        statement,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if insert:
        table_name, column_text, values_text = insert.groups()
        columns = (
            [column.strip().strip('"') for column in column_text.split(",")]
            if column_text
            else list(TABLE_COLUMNS.get(table_name.lower(), ()))
        )
        values = values_text.split(",")
        for index, (column, value) in enumerate(zip(columns, values)):
            if column.lower() in JSON_COLUMNS.get(table_name.lower(), set()):
                preceding = sum(len(re.findall(placeholder, item)) for item in values[:index])
                if re.search(placeholder, value):
                    indexes.add(preceding)

    update = re.search(
        r"\bupdate\s+([a-z_][a-z0-9_]*)\s+set\s+(.*?)(?:\s+where\s+|$)",
        statement,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if update:
        table_name, assignments = update.groups()
        preceding = 0
        for assignment in assignments.split(","):
            match = re.match(r"\s*([a-z_][a-z0-9_]*)\s*=\s*(.*)", assignment, re.DOTALL)
            if match and match.group(1).lower() in JSON_COLUMNS.get(table_name.lower(), set()):
                if re.search(placeholder, match.group(2)):
                    indexes.add(preceding)
            preceding += len(re.findall(placeholder, assignment))

    return {index for index in indexes if index < placeholder_count}


def _timestamp_parameter_indexes(statement: str, placeholder: str) -> set[int]:
    indexes: set[int] = set()
    insert = re.search(
        r"\binsert\s+into\s+([a-z_][a-z0-9_]*)\s*(?:\((.*?)\))?\s*values\s*\((.*?)\)",
        statement,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if insert:
        table_name, column_text, values_text = insert.groups()
        columns = (
            [column.strip().strip('"') for column in column_text.split(",")]
            if column_text
            else list(TABLE_COLUMNS.get(table_name.lower(), ()))
        )
        values = values_text.split(",")
        for index, (column, value) in enumerate(zip(columns, values)):
            if (
                column.lower() in TIMESTAMP_COLUMNS.get(table_name.lower(), set())
                and re.search(placeholder, value)
            ):
                indexes.add(
                    sum(len(re.findall(placeholder, item)) for item in values[:index])
                )

    update = re.search(
        r"\bupdate\s+([a-z_][a-z0-9_]*)\s+set\s+(.*?)(?:\s+where\s+|$)",
        statement,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if update:
        table_name, assignments = update.groups()
        preceding = 0
        for assignment in assignments.split(","):
            match = re.match(r"\s*([a-z_][a-z0-9_]*)\s*=\s*(.*)", assignment, re.DOTALL)
            if (
                match
                and match.group(1).lower()
                in TIMESTAMP_COLUMNS.get(table_name.lower(), set())
                and re.search(placeholder, match.group(2))
            ):
                indexes.add(preceding)
            preceding += len(re.findall(placeholder, assignment))

        for column_name in TIMESTAMP_COLUMNS.get(table_name.lower(), set()):
            pattern = re.compile(
                rf"\b{column_name}\s*=\s*"
                rf"(?:COALESCE\([^,]*,\s*)?{placeholder}",
                flags=re.IGNORECASE,
            )
            for match in pattern.finditer(assignments):
                indexes.add(
                    len(
                        re.findall(
                            placeholder,
                            statement[: update.start(2) + match.end()],
                        )
                    )
                    - 1
                )

    for table_name, columns in TIMESTAMP_COLUMNS.items():
        for column_name in columns:
            pattern = re.compile(
                rf"\b(?:{table_name}\.)?{column_name}\s*(?:<=|>=|<>|!=|=|<|>)\s*{placeholder}",
                flags=re.IGNORECASE,
            )
            for match in pattern.finditer(statement):
                indexes.add(len(re.findall(placeholder, statement[: match.end()])) - 1)
    return indexes


TIMESTAMP_COLUMNS = {
    table.name: {
        column.name
        for column in table.columns
        if isinstance(column.type, DateTime)
    }
    for table in metadata.tables.values()
}


def _row_value(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, (dict, list)):
        return json.dumps(value, separators=(",", ":"), sort_keys=True)
    return value


class DatabaseRow(Mapping[str, Any]):
    def __init__(self, values: Mapping[str, Any]) -> None:
        self._values = values

    def __getitem__(self, key: str | int) -> Any:
        if isinstance(key, int):
            key = tuple(self._values.keys())[key]
        return _row_value(self._values[key])

    def __iter__(self) -> Iterator[str]:
        return iter(self._values)

    def __len__(self) -> int:
        return len(self._values)


class DatabaseResult:
    def __init__(self, result: Any) -> None:
        self._result = result
        self.rowcount = result.rowcount

    @staticmethod
    def _adapt(row: Any) -> DatabaseRow | None:
        return DatabaseRow(row) if row is not None else None

    def fetchone(self) -> DatabaseRow | None:
        return self._adapt(self._result.mappings().fetchone())

    def fetchall(self) -> list[DatabaseRow]:
        return [DatabaseRow(row) for row in self._result.mappings().fetchall()]


class DatabaseConnection:
    def __init__(self, connection: SQLAlchemyConnection) -> None:
        self._connection = connection
        self._transaction = connection.begin()

    def execute(
        self, statement: str, parameters: tuple[Any, ...] | list[Any] | None = None
    ) -> DatabaseResult:
        params = tuple(parameters or ())
        matches = list(re.finditer(r"%s", statement))
        if len(matches) != len(params):
            if matches or params:
                raise ValueError("SQL parameter count does not match the statement.")

        statement_parts: list[str] = []
        bindings: dict[str, Any] = {}
        previous = 0
        for index, match in enumerate(matches):
            name = f"p{index}"
            statement_parts.extend((statement[previous : match.start()], f":{name}"))
            bindings[name] = params[index]
            previous = match.end()
        statement_parts.append(statement[previous:])
        sql = "".join(statement_parts)
        json_indexes = _json_parameter_indexes(statement, r"%s")
        timestamp_indexes = _timestamp_parameter_indexes(statement, r"%s")
        typed_bindings = [
            bindparam(f"p{index}", type_=JSONB) for index in sorted(json_indexes)
        ]
        typed_bindings.extend(
            bindparam(
                f"p{index}",
                type_=DateTime(timezone=True),
            )
            for index in sorted(timestamp_indexes)
            if index not in json_indexes
        )
        if typed_bindings:
            sql_statement = text(sql).bindparams(*typed_bindings)
            for index in json_indexes:
                value = bindings[f"p{index}"]
                if isinstance(value, str):
                    try:
                        bindings[f"p{index}"] = json.loads(value)
                    except json.JSONDecodeError:
                        raise ValueError("Invalid JSON value supplied for a JSONB column.") from None
        else:
            sql_statement = text(sql)
        return DatabaseResult(self._connection.execute(sql_statement, bindings))

    def __enter__(self) -> DatabaseConnection:
        return self

    def __exit__(self, exc_type: Any, exc_value: Any, traceback: Any) -> None:
        try:
            if exc_type is None:
                self._transaction.commit()
            else:
                self._transaction.rollback()
        finally:
            self._connection.close()


def get_connection() -> DatabaseConnection:
    return DatabaseConnection(get_engine().connect())
