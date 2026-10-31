# WorkForce AI

WorkForce AI is a React/Vite workspace with a FastAPI API, Supabase PostgreSQL
application storage, cookie-backed accounts, and LangGraph workflow
orchestration. Employee onboarding and invoice-review requests run through the
Planner, HR, IT, Finance, Approval, and Communication agents. External account
provisioning, payment execution, and email delivery are deliberately simulated.

## Configure Supabase

1. Copy the example environment file and edit it locally:

   ```powershell
   Copy-Item .env.example .env
   notepad .env
   ```

2. In the Supabase project dashboard, open **Connect** (or **Project Settings >
   Database**) and copy the PostgreSQL connection URI. Set it in `.env` as
   `DATABASE_URL=...`. Use the direct PostgreSQL connection on port 5432 when
   the host can reach it; otherwise use Supabase's **session** pooler URI. Avoid
   the transaction-mode pooler for the persistent LangGraph checkpointer.
   Keep the password in `.env`, URL-encode reserved characters, and never commit
   or paste the URI into source control or chat. The application adds
   `sslmode=require` if the URI does not specify an SSL mode.
3. Keep `.env` out of source control. `.env.example` contains blank secret
   settings and is safe to copy.

### Private invoice attachments

Invoice uploads use a private Supabase Storage bucket. Create a private bucket
named `invoice-documents` (or set `SUPABASE_INVOICE_BUCKET` to another private
bucket), then set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`.
The service-role key must remain server-side and must never be exposed to the
frontend. Uploads accept PDF, JPG, and PNG files up to 10 MB. The database
stores only the private object path and invoice metadata, not file contents.
The API refuses uploads if the configured bucket is missing or public.

The app validates `DATABASE_URL` during startup, applies the versioned Alembic
schema, initializes LangGraph's PostgreSQL checkpoint tables, and fails startup
with a configuration message if the URL is missing or the database is
unavailable. The URI is not logged or returned by the API.

## Run locally (Windows PowerShell)

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn api.main:app --reload --host 127.0.0.1 --port 8000
```

In another terminal:

```powershell
npm install
npm run dev
```

The Vite server proxies `/api` to `http://localhost:8000`. Configure
`VITE_API_PROXY_TARGET` if the API runs elsewhere. The API docs are available at
<http://localhost:8000/docs>. Set `WORKFORCE_COOKIE_SECURE=true` when serving
the API over HTTPS.

## Migrate `workforce.db`

Back up the source file and take a Supabase backup/snapshot before applying a
migration. The utility opens `workforce.db` read-only, preserves all 12
application tables and primary keys, verifies duplicate IDs rather than
overwriting PostgreSQL rows, and uses one transaction for application records.

Initialize only the schema (this does not seed app defaults), then run a dry run:

```powershell
python -m alembic upgrade head
python scripts\migrate_sqlite_to_postgres.py
```

Apply the data transfer only after reviewing the dry-run results:

```powershell
python scripts\migrate_sqlite_to_postgres.py --apply
```

Do not start the API before transferring the legacy data: startup inserts a
default workspace-settings row that can conflict with existing customized
settings in `workforce.db`.

It reports per-table source, inserted, and identical-row totals. A conflict or
failed record rolls the full data-copy transaction back. It never deletes
`workforce.db`.

LangGraph checkpoints use PostgreSQL in the migrated application. SQLite
checkpoint tables are deliberately not copied as ordinary application rows.
If the legacy SQLite file contains checkpoint tables, the utility stops unless
`--skip-checkpoints` is provided, and it refuses that option while active
workflows remain. Resolve pending approvals/workflows before switching; the
current project database was inspected and contains no checkpoint tables or
workflow records.

## Test and build

Run unit tests without a database:

```powershell
python -m pytest
```

PostgreSQL API/checkpoint integration tests run only when
`WORKFORCE_TEST_DATABASE_URL` points to a dedicated local test PostgreSQL
database. Tests create and drop a uniquely named test schema; they refuse
non-local database hosts to prevent accidental production writes.

```powershell
$env:WORKFORCE_TEST_DATABASE_URL = "postgresql+psycopg://user:password@localhost:5432/workforce_test?sslmode=disable"
python -m pytest
Remove-Item Env:\WORKFORCE_TEST_DATABASE_URL
npm run build
```

Never use a production Supabase URL for tests.

## Supported operations and limits

- Persistent workflows, tasks, approvals, employees, finance reviews, payments,
  IT requests, notifications, workspace settings, users, sessions, and audit
  events are stored in PostgreSQL.
- LangGraph approval interrupts and workflow state are persisted by
  `langgraph-checkpoint-postgres` under the same workflow thread ID, so resumed
  workflows survive process restarts.
- Accounts share one workspace; tenant isolation, invitations, recovery, email
  verification, and account-management UI are not implemented.
- SMTP settings are status-only. Notifications are saved as `draft_simulated`;
  no email is sent. Payment requests are approval-gated and simulated only.
- Redis is status-only; workflows run synchronously in the API request.
- Gemini is optional and only summarizes a validated plan; it cannot change
  task routing or approval gates. Keep its API key server-side.

Never place API keys in the frontend or commit a populated `.env` file.
