import sqlite3
from datetime import datetime, timezone

import pytest

from api import database
from api import main
from scripts import migrate_sqlite_to_postgres as sqlite_migration


def test_missing_database_url_has_clear_configuration_error():
    with pytest.raises(database.DatabaseConfigurationError, match="DATABASE_URL is required"):
        database.database_url({})


def test_database_url_normalizes_driver_and_requires_ssl_by_default():
    url = database.database_url(
        {"DATABASE_URL": "postgresql://workforce:secret@db.example.test:5432/workforce"}
    )

    assert url.drivername == "postgresql+psycopg"
    assert url.host == "db.example.test"
    assert url.database == "workforce"
    assert url.query["sslmode"] == "require"


def test_database_url_rejects_sqlite():
    with pytest.raises(database.DatabaseConfigurationError, match="PostgreSQL"):
        database.database_url({"DATABASE_URL": "sqlite:///workforce.db"})


def test_application_initialization_fails_clearly_without_database_url(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)

    with pytest.raises(
        database.DatabaseConfigurationError,
        match="DATABASE_URL is required",
    ):
        main.init_db()


def test_frontend_loopback_hosts_share_the_configured_origin_allowlist(monkeypatch):
    monkeypatch.setenv(
        "FRONTEND_URLS",
        "http://localhost:5173,https://portal.example.com",
    )

    origins = set(main._frontend_origins())

    assert "http://localhost:5173" in origins
    assert "http://127.0.0.1:5173" in origins
    assert "https://portal.example.com" in origins
    assert "https://127.0.0.1:5173" not in origins


def test_schema_metadata_contains_all_workforce_tables_and_jsonb_columns():
    expected_tables = {
        "workflows",
        "tasks",
        "approvals",
        "employees",
        "audit_events",
        "finance_reviews",
        "workspace_settings",
        "notifications",
        "it_requests",
        "payment_requests",
        "users",
        "sessions",
    }

    assert set(database.metadata.tables) == expected_tables
    for table_name, columns in database.JSON_COLUMNS.items():
        for column_name in columns:
            assert database.metadata.tables[table_name].c[column_name].type.__class__.__name__ == "JSONB"


def test_schema_metadata_preserves_unique_indexes_and_foreign_keys():
    index_names = {
        index.name
        for table in database.metadata.tables.values()
        for index in table.indexes
    }

    assert {
        "employees_email_unique",
        "finance_invoice_unique",
        "it_requests_workflow_unique",
        "sessions_expiry_idx",
        "users_email_unique",
    }.issubset(index_names)
    assert {
        (foreign_key.parent.table.name, foreign_key.parent.name, foreign_key.target_fullname)
        for table in database.metadata.tables.values()
        for foreign_key in table.foreign_keys
    } == {
        ("tasks", "workflow_id", "workflows.id"),
        ("approvals", "workflow_id", "workflows.id"),
        ("notifications", "workflow_id", "workflows.id"),
        ("payment_requests", "workflow_id", "workflows.id"),
        ("payment_requests", "invoice_id", "finance_reviews.id"),
        ("sessions", "user_id", "users.id"),
    }


def test_database_json_bind_indexes_cover_insert_and_update_parameters():
    insert_query = (
        "INSERT INTO tasks (id, input_data, dependencies, execution_result) "
        "VALUES (%s, %s, %s, %s)"
    )
    update_query = (
        "UPDATE workflows SET status = %s, shared_context = %s WHERE id = %s"
    )

    assert database._json_parameter_indexes(insert_query, r"%s") == {1, 2, 3}
    assert database._json_parameter_indexes(update_query, r"%s") == {1}


def test_timestamp_bind_indexes_handle_insert_update_and_expiry_filter():
    insert_query = "INSERT INTO workflows VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"
    update_query = (
        "UPDATE tasks SET status = %s, created_at = COALESCE(created_at, %s) WHERE id = %s"
    )
    expiry_query = "SELECT id FROM sessions WHERE sessions.expires_at > %s"

    assert 8 in database._timestamp_parameter_indexes(insert_query, r"%s")
    assert database._timestamp_parameter_indexes(update_query, r"%s") == {1}
    assert database._timestamp_parameter_indexes(expiry_query, r"%s") == {0}


def test_row_mapping_preserves_mapping_access_and_serializes_json_and_timestamps():
    row = database.DatabaseRow(
        {
            "id": "wf_1",
            "shared_context": {"workflow_type": "employee_onboarding"},
            "created_at": datetime(2026, 10, 31, tzinfo=timezone.utc),
        }
    )

    assert dict(row) == {
        "id": "wf_1",
        "shared_context": '{"workflow_type":"employee_onboarding"}',
        "created_at": "2026-10-31T00:00:00+00:00",
    }
    assert row[0] == "wf_1"


def test_sqlite_source_reader_is_read_only_and_checkpoint_detection_is_explicit(tmp_path):
    source_path = tmp_path / "legacy.db"
    source = sqlite3.connect(source_path)
    source.execute("CREATE TABLE workflows (id TEXT PRIMARY KEY, status TEXT)")
    source.execute("CREATE TABLE checkpoints (thread_id TEXT)")
    source.commit()
    source.close()

    readonly = sqlite_migration._sqlite_connection(source_path)
    try:
        assert sqlite_migration._checkpoint_tables(readonly) == ["checkpoints"]
        with pytest.raises(sqlite3.OperationalError, match="readonly"):
            readonly.execute("DELETE FROM workflows")
    finally:
        readonly.close()


def test_sqlite_migration_rejects_unmapped_columns_and_missing_required_columns():
    source = sqlite3.connect(":memory:")
    source.row_factory = sqlite3.Row
    source.execute("CREATE TABLE workflows (id TEXT, unexpected TEXT)")
    with pytest.raises(sqlite_migration.MigrationError, match="unmapped columns"):
        sqlite_migration._read_rows(source, database.metadata.tables["workflows"])

    source.execute("DROP TABLE workflows")
    source.execute("CREATE TABLE workflows (status TEXT)")
    with pytest.raises(sqlite_migration.MigrationError, match="lacks required columns"):
        sqlite_migration._read_rows(source, database.metadata.tables["workflows"])
    source.close()
