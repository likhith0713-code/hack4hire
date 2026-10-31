from __future__ import annotations

import json
import os
import re
import socket
import uuid
import contextvars
import hashlib
import hmac
import secrets
import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Literal
from urllib.parse import urlparse

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, Query, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from api.agents import ACTION_REGISTRY, AgentConflictError
from api.finance import analyze_invoice
from api.storage import MAX_INVOICE_FILE_SIZE, upload_invoice_file, validate_invoice_file
from api.database import (
    DatabaseConnection,
    DatabaseConfigurationError,
    DatabaseRow,
    check_database_health,
    dispose_engine,
    get_connection,
    initialize_database,
)
from api.orchestration import (
    CheckpointPersistenceError,
    create_workflow_plan,
    initialize_checkpointer,
    resume_workflow_execution,
    run_workflow_execution,
)

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")
DIST = ROOT / "dist"


def _frontend_origins() -> list[str]:
    configured = [
        origin.strip()
        for origin in os.getenv(
            "FRONTEND_URLS", "http://localhost:5173,http://localhost:3000"
        ).split(",")
        if origin.strip()
    ]
    origins = set(configured)
    for origin in configured:
        parsed = urlparse(origin)
        if (
            parsed.scheme in {"http", "https"}
            and parsed.hostname in {"localhost", "127.0.0.1"}
            and parsed.username is None
            and parsed.password is None
            and parsed.path in {"", "/"}
            and not parsed.params
            and not parsed.query
            and not parsed.fragment
        ):
            port = f":{parsed.port}" if parsed.port else ""
            alias = "127.0.0.1" if parsed.hostname == "localhost" else "localhost"
            origins.add(f"{parsed.scheme}://{alias}{port}")
    return sorted(origins)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        init_db()
        yield
    finally:
        dispose_engine()


app = FastAPI(title="WorkForce AI API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_frontend_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CURRENT_USER: contextvars.ContextVar[dict[str, Any] | None] = contextvars.ContextVar(
    "current_user", default=None
)
SESSION_COOKIE = "workforce_session"
SESSION_TTL_DAYS = 30
DEFAULT_SETTINGS = {
    "workspace_name": "Northstar Inc.",
    "appearance": "light",
    "accent": "aurora",
    "reduced_motion": False,
    "default_approval_role": "Workspace manager",
    "team_access": "Members can view workspace activity",
    "approval_guard": True,
    "simulated_tools": True,
    "parallel_plans": True,
    "retention_days": 365,
    "audit_logging": True,
    "approval_alerts": True,
    "workflow_alerts": True,
    "weekly_digest": False,
}

AGENTS = [
    {"id": "planner", "name": "Planner Agent", "role": "Orchestration", "description": "Builds validated execution plans from registered business actions.", "color": "indigo", "icon": "sparkles"},
    {"id": "hr", "name": "HR Agent", "role": "People operations", "description": "Validates employee data and persists onboarding records.", "color": "pink", "icon": "users"},
    {"id": "it", "name": "IT Agent", "role": "Access & equipment", "description": "Creates persisted access and equipment requests; external provisioning remains simulated.", "color": "blue", "icon": "monitor"},
    {"id": "finance", "name": "Finance Agent", "role": "Financial operations", "description": "Validates invoices and records approval-gated payment requests.", "color": "green", "icon": "wallet"},
    {"id": "communication", "name": "Communication Agent", "role": "Business messaging", "description": "Persists communication drafts; email delivery remains simulated.", "color": "purple", "icon": "message"},
    {"id": "approval", "name": "Approval Agent", "role": "Human-in-the-loop", "description": "Routes sensitive actions to an authorized human and resumes workflows.", "color": "orange", "icon": "shield"},
]


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


def connect() -> DatabaseConnection:
    return get_connection()


def init_db() -> None:
    initialize_database()
    initialize_checkpointer()
    with connect() as conn:
        conn.execute("UPDATE tasks SET task_name = title WHERE task_name IS NULL")
        conn.execute(
            "UPDATE tasks SET assigned_agent = agent_id WHERE assigned_agent IS NULL"
        )
        conn.execute(
            "INSERT INTO workspace_settings (id, payload, updated_at) VALUES (1, %s, %s) "
            "ON CONFLICT (id) DO NOTHING",
            (json.dumps(DEFAULT_SETTINGS), now()),
        )
        upgrade_seeded_onboarding_workflow(conn)

def audit(conn: DatabaseConnection, workflow_id: str | None, actor_type: str, actor_id: str, action: str, detail: str, status: str = "success") -> None:
    conn.execute(
        "INSERT INTO audit_events VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
        (new_id("evt"), workflow_id, actor_type, actor_id, action, detail, status, now()),
    )


def seed(conn: DatabaseConnection) -> None:
    ts = now()
    workflow_id = "wf_rahul_onboarding"
    conn.execute(
        "INSERT INTO workflows VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
        (workflow_id, "Onboard Rahul Kumar", "Onboard a new employee named Rahul Kumar in the Engineering department, with a joining date of November 10, 2026.", "waiting_approval", "Maya Chen", "Engineering", "Rahul Kumar", "November 10, 2026", "2026-10-28T09:41:00+00:00", ts, None, json.dumps({"employee": {"name": "Rahul Kumar", "department": "Engineering", "joining_date": "November 10, 2026"}, "mode": "simulated_enterprise_tools"})),
    )
    add_tasks(conn, workflow_id, [
        ("planner", "Create execution plan", "Request understood and decomposed into specialist tasks.", "completed", 1, 0, "5-step onboarding plan generated", None),
        ("hr", "Create employee record", "Validate Rahul's employee data and create the onboarding record.", "completed", 2, 0, "Employee record prepared", "planner"),
        ("it", "Provision access & equipment", "Prepare a simulated account, laptop, and Engineering software bundle.", "waiting_approval", 3, 1, None, "hr"),
        ("approval", "Manager approval checkpoint", "Human review required before external account and equipment provisioning.", "waiting_approval", 4, 1, "Awaiting manager decision", "it"),
        ("communication", "Prepare welcome email", "Generate a polished welcome message for the new employee.", "queued", 5, 0, None, "approval"),
    ])
    conn.execute("INSERT INTO approvals VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)", ("apr_rahul_access", workflow_id, "Approve IT access & equipment", "Create simulated enterprise account + laptop request", "it", "Maya Chen", "External access and equipment requests are high-impact actions and require a human checkpoint.", json.dumps({"employee": "Rahul Kumar", "department": "Engineering", "access": ["Google Workspace", "GitHub Enterprise", "Linear"], "equipment": "MacBook Pro 14-inch", "mode": "simulated only"}), "medium", "pending", "2026-10-28T09:42:00+00:00", None, None, None))
    audit(conn, workflow_id, "planner", "planner", "plan.created", "Planner decomposed the onboarding request into five dependent tasks.")
    audit(conn, workflow_id, "agent", "hr", "employee.validated", "HR Agent validated Rahul Kumar in Engineering with a November 10, 2026 joining date.")
    audit(conn, workflow_id, "agent", "it", "approval.requested", "IT Agent prepared simulated access and equipment provisioning; human approval required.", "pending")

    completed_id = "wf_invoice_april"
    conn.execute("INSERT INTO workflows VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)", (completed_id, "Validate Acme invoice #INV-2048", "Validate the April invoice from Acme Cloud Services and prepare a payment request.", "completed", "Maya Chen", "Finance", None, None, "2026-10-27T14:18:00+00:00", "2026-10-27T14:24:00+00:00", "Invoice validated; payment simulator request prepared.", json.dumps({"invoice": "INV-2048", "amount": "$18,420", "vendor": "Acme Cloud Services"})))
    add_tasks(conn, completed_id, [("planner", "Create finance plan", "Identify validation and policy checks.", "completed", 1, 0, "Finance plan generated", None), ("finance", "Validate invoice", "Check amount, policy, and duplicate status.", "completed", 2, 0, "No duplicate found; policy compliant", "planner"), ("communication", "Notify requester", "Prepare finance status update.", "completed", 3, 0, "Requester notified in simulated mode", "finance")])
    audit(conn, completed_id, "agent", "finance", "invoice.validated", "Invoice INV-2048 passed duplicate and policy checks.")

    failed_id = "wf_access_review"
    conn.execute("INSERT INTO workflows VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)", (failed_id, "Review contractor access", "Review temporary access for the design contractor cohort.", "failed", "Maya Chen", "IT", None, None, "2026-10-26T11:04:00+00:00", "2026-10-26T11:16:00+00:00", None, json.dumps({"recovery_attempts": 2, "error": "Directory simulator timed out"})))
    add_tasks(conn, failed_id, [("planner", "Create access review plan", "Break down access review.", "completed", 1, 0, "Plan generated", None), ("it", "Check directory access", "Read-only access check against simulator.", "failed", 2, 0, "Directory simulator timed out after two retries", "planner")])
    audit(conn, failed_id, "agent", "it", "tool.failed", "Directory simulator timed out after two retries.", "failed")

    employees = [
        ("emp_rahul", "Rahul Kumar", "Engineering", "Software Engineer", "November 10, 2026", "Onboarding", workflow_id),
        ("emp_ava", "Ava Patel", "People Operations", "People Partner", "October 12, 2024", "Active", None),
        ("emp_noah", "Noah Williams", "Finance", "Financial Analyst", "September 3, 2025", "Active", None),
        ("emp_zoe", "Zoe Martin", "Design", "Product Designer", "January 22, 2026", "Active", None),
    ]
    for eid, name, dept, title, joining, status, wid in employees:
        conn.execute(
            """INSERT INTO employees
               (id, name, department, title, joining_date, status, workflow_id, created_at, email)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NULL)""",
            (eid, name, dept, title, joining, status, wid, ts),
        )


def add_tasks(conn: DatabaseConnection, workflow_id: str, tasks: list[tuple[Any, ...]]) -> None:
    task_ids = {spec[0]: new_id("task") for spec in tasks}
    for spec in tasks:
        (
            agent_id,
            title,
            description,
            status,
            sort_order,
            requires_approval,
            result,
            dependency,
            *details,
        ) = spec
        action = details[0] if details else ""
        input_data = details[1] if len(details) > 1 else {}
        started = now() if status not in ("queued",) else None
        completed = now() if status == "completed" else None
        conn.execute(
            """INSERT INTO tasks
               (id, workflow_id, agent_id, title, description, status, sort_order,
                requires_approval, result, dependency, started_at, completed_at, created_at, action,
                task_name, assigned_agent, input_data, dependencies, priority,
                execution_result, error_message)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (
                task_ids[agent_id],
                workflow_id,
                agent_id,
                title,
                description,
                status,
                sort_order,
                requires_approval,
                result,
                dependency,
                started,
                completed,
                now(),
                action,
                title,
                agent_id,
                json.dumps(input_data),
                json.dumps([task_ids[dependency]] if dependency in task_ids else []),
                5,
                json.dumps({"summary": result}) if result and action else None,
                None,
            ),
        )


def upgrade_seeded_onboarding_workflow(conn: DatabaseConnection) -> None:
    workflow_id = "wf_rahul_onboarding"
    workflow = conn.execute(
        "SELECT * FROM workflows WHERE id = %s", (workflow_id,)
    ).fetchone()
    if workflow is None:
        return
    context = json.loads(workflow["shared_context"] or "{}")
    if context.get("agent_results"):
        return
    employee = conn.execute(
        "SELECT * FROM employees WHERE workflow_id = %s ORDER BY created_at LIMIT 1",
        (workflow_id,),
    ).fetchone()
    approval = conn.execute(
        "SELECT * FROM approvals WHERE workflow_id = %s ORDER BY requested_at DESC LIMIT 1",
        (workflow_id,),
    ).fetchone()
    if employee is None or approval is None:
        return

    joining_date = employee["joining_date"]
    try:
        joining_date = datetime.strptime(joining_date, "%B %d, %Y").date().isoformat()
    except ValueError:
        joining_date = str(joining_date)
    request_data = {
        "workflow_type": "employee_onboarding",
        "name": employee["name"],
        "department": employee["department"],
        "joining_date": joining_date,
    }
    task_rows = conn.execute(
        "SELECT id, agent_id FROM tasks WHERE workflow_id = %s ORDER BY sort_order",
        (workflow_id,),
    ).fetchall()
    task_ids = {row["agent_id"]: row["id"] for row in task_rows}
    hr_result = {
        "employee_id": employee["id"],
        "employee_name": employee["name"],
        "department": employee["department"],
        "email": employee["email"],
    }
    request_ids: list[str] = []
    for request_type, description in (
        ("Enterprise account", f"Create an account request for {employee['name']}."),
        ("Laptop", f"Prepare a laptop request for {employee['name']}."),
    ):
        existing_request = conn.execute(
            """SELECT id FROM it_requests WHERE workflow_id = %s
               AND employee_id = %s AND request_type = %s""",
            (workflow_id, employee["id"], request_type),
        ).fetchone()
        if existing_request:
            request_ids.append(existing_request["id"])
            continue
        request_id = new_id("it")
        conn.execute(
            """INSERT INTO it_requests
               (id, employee_name, request_type, description, status, created_by,
                created_at, employee_id, workflow_id)
               VALUES (%s, %s, %s, %s, 'pending_approval', %s, %s, %s, %s)""",
            (
                request_id,
                employee["name"],
                request_type,
                description,
                workflow["created_by"],
                now(),
                employee["id"],
                workflow_id,
            ),
        )
        request_ids.append(request_id)
    it_result = {
        "employee_id": employee["id"],
        "request_ids": request_ids,
        "external_provisioning": "not_performed",
    }
    context.update(
        {
            "workflow_type": "employee_onboarding",
            "orchestration": "langgraph",
            "request_data": request_data,
            "agent_results": {"hr": hr_result, "it": it_result},
        }
    )
    conn.execute(
        "UPDATE workflows SET shared_context = %s WHERE id = %s",
        (json.dumps(context), workflow_id),
    )
    task_actions = {
        "planner": ("planner.validate_plan", request_data, None),
        "hr": ("hr.create_employee", request_data, "planner"),
        "it": ("it.create_requests", {"employee_id": employee["id"]}, "hr"),
        "approval": (
            "approval.create_request",
            {
                "approval_title": approval["title"],
                "approval_action": approval["action"],
                "approval_reason": approval["reason"],
                "approval_info": json.loads(approval["information"]),
                "protected_agent": "it",
            },
            "it",
        ),
        "communication": ("communication.create_notification", {}, "approval"),
    }
    for agent_id, (action, input_data, dependency) in task_actions.items():
        task_id = task_ids.get(agent_id)
        if not task_id:
            continue
        if agent_id == "planner":
            result = {"validated": True, "workflow_type": "employee_onboarding"}
            status = "completed"
        elif agent_id == "hr":
            result = hr_result
            status = "completed"
        elif agent_id == "it":
            result = it_result
            status = "waiting_approval"
        elif agent_id == "approval":
            result = {"approval_id": approval["id"], "status": approval["status"]}
            status = "waiting_approval" if approval["status"] == "pending" else approval["status"]
        else:
            result = None
            status = "queued"
        conn.execute(
            """UPDATE tasks SET action = %s, input_data = %s, dependencies = %s, priority = 5,
               execution_result = %s, error_message = NULL, created_at = COALESCE(created_at, %s),
               status = %s, result = COALESCE(result, %s)
               WHERE id = %s""",
            (
                action,
                json.dumps(input_data),
                json.dumps([task_ids[dependency]] if dependency in task_ids else []),
                json.dumps(result) if result is not None else None,
                now(),
                status,
                json.dumps(result) if result is not None else None,
                task_id,
            ),
        )
    audit(
        conn,
        workflow_id,
        "agent",
        "it",
        "it.requests_created",
        "Persisted internal account and equipment requests for the existing demo employee; external provisioning was not performed.",
        "pending",
    )


class WorkflowCreate(BaseModel):
    request: str = Field(min_length=12)
    email: str | None = None
    created_by: str = "Maya Chen"


class PlannerPreviewCreate(BaseModel):
    request: str = Field(min_length=12)
    email: str | None = None


class EmployeeCreate(BaseModel):
    name: str = Field(min_length=2)
    department: str = Field(min_length=2)
    title: str = Field(min_length=2)
    joining_date: str = Field(min_length=2)
    email: str | None = None
    created_by: str = "Maya Chen"


class FinanceReviewCreate(BaseModel):
    vendor: str = Field(min_length=2)
    invoice_number: str = Field(min_length=2)
    amount: str = Field(min_length=1)
    created_by: str = "Maya Chen"


class InvoiceAnalysisRequest(BaseModel):
    vendor: str | None = None
    invoice_number: str | None = None
    vendor_email: str | None = None
    invoice_date: str | None = None
    due_date: str | None = None
    amount: str | None = None
    gst_percentage: str | None = None
    tax_amount: str | None = None
    total_amount: str | None = None
    currency: str = "INR"
    expense_category: str | None = None
    description: str | None = None


class ITAccessWorkflowCreate(BaseModel):
    employee_id: str = Field(min_length=1)
    access: list[str] = Field(default_factory=list, max_length=10)
    equipment: str = Field(default="", max_length=120)


class ApprovalDecision(BaseModel):
    role: str = "manager"
    actor: str = "Maya Chen"
    reason: str = "Reviewed in the WorkForce AI Approval Center."
    decision: Literal["approved", "rejected"] | None = None


class ITRequestCreate(BaseModel):
    employee_name: str = Field(min_length=2)
    request_type: str = Field(min_length=2)
    description: str = Field(min_length=2)
    created_by: str = "Maya Chen"


class CommunicationCreate(BaseModel):
    recipient: str = Field(min_length=2)
    subject: str = Field(min_length=2)
    body: str = Field(min_length=2)
    workflow_id: str | None = None


class CommunicationUpdate(BaseModel):
    recipient: str = Field(min_length=2)
    subject: str = Field(min_length=2)
    body: str = Field(min_length=2)


class SettingsUpdate(BaseModel):
    preferences: dict[str, Any]


class AccountCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=12, max_length=128)


class AccountLogin(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=1, max_length=128)


def _password_hash(password: str) -> str:
    salt = secrets.token_bytes(16)
    iterations = 310_000
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations)
    return f"pbkdf2_sha256${iterations}${salt.hex()}${digest.hex()}"


def _verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, rounds, salt, expected = stored_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        actual = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), bytes.fromhex(salt), int(rounds)
        ).hex()
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(actual, expected)


def _token_digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _issue_session(conn: DatabaseConnection, user_id: str) -> str:
    token = secrets.token_urlsafe(32)
    created_at = now()
    expires_at = (datetime.now(timezone.utc) + timedelta(days=SESSION_TTL_DAYS)).isoformat()
    conn.execute(
        "INSERT INTO sessions VALUES (%s, %s, %s, %s)",
        (_token_digest(token), user_id, expires_at, created_at),
    )
    return token


def _public_user(row: DatabaseRow | dict[str, Any]) -> dict[str, str]:
    return {
        "id": row["id"],
        "name": row["name"],
        "email": row["email"],
        "role": row["role"],
    }


def current_user() -> dict[str, Any]:
    user = CURRENT_USER.get()
    if user is None:
        raise HTTPException(401, "Sign in to access this workspace.")
    return user


def _session_user(token: str | None) -> dict[str, Any] | None:
    if not token:
        return None
    with connect() as conn:
        row = conn.execute(
            """SELECT users.id, users.name, users.email, users.role
               FROM sessions JOIN users ON users.id = sessions.user_id
               WHERE sessions.token_hash = %s AND sessions.expires_at > %s""",
            (_token_digest(token), now()),
        ).fetchone()
    return _public_user(row) if row else None


@app.middleware("http")
async def require_authenticated_workspace(request: Request, call_next):
    path = request.url.path
    if not path.startswith("/api/") or request.method == "OPTIONS":
        return await call_next(request)

    public_paths = {
        "/api/health",
        "/api/integrations/status",
        "/api/auth/register",
        "/api/auth/login",
        "/api/auth/logout",
        "/api/auth/me",
    }
    if request.method not in {"GET", "HEAD"} and request.headers.get("origin"):
        allowed_origins = set(_frontend_origins())
        if request.headers["origin"] not in allowed_origins:
            return JSONResponse({"detail": "Request origin is not allowed."}, status_code=403)

    user = _session_user(request.cookies.get(SESSION_COOKIE))
    request.state.user = user
    if path not in public_paths and user is None:
        return JSONResponse({"detail": "Sign in to access this workspace."}, status_code=401)

    context_token = CURRENT_USER.set(user)
    try:
        return await call_next(request)
    finally:
        CURRENT_USER.reset(context_token)


def _set_session_cookie(response: Response, token: str) -> None:
    secure_cookie = os.getenv(
        "WORKFORCE_COOKIE_SECURE",
        "true" if os.getenv("ENVIRONMENT", "").lower() == "production" else "false",
    ).lower() in {"1", "true", "yes"}
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=SESSION_TTL_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=secure_cookie,
        samesite="lax",
        path="/",
    )


@app.post("/api/auth/register")
def register_account(payload: AccountCreate, response: Response) -> dict[str, Any]:
    email = payload.email.strip().lower()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise HTTPException(422, "Enter a valid email address.")
    name = re.sub(r"\s+", " ", payload.name.strip())
    if not name:
        raise HTTPException(422, "Name cannot be blank.")
    account_id = new_id("usr")
    try:
        with connect() as conn:
            conn.execute("SELECT pg_advisory_xact_lock(684512309)")
            role = (
                "manager"
                if conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0
                else "member"
            )
            conn.execute(
                "INSERT INTO users VALUES (%s, %s, %s, %s, %s, %s)",
                (account_id, name, email, _password_hash(payload.password), role, now()),
            )
            token = _issue_session(conn, account_id)
            user = _public_user(
                {"id": account_id, "name": name, "email": email, "role": role}
            )
    except IntegrityError as exc:
        raise HTTPException(409, "An account with this email already exists.") from exc
    _set_session_cookie(response, token)
    return {"user": user}


@app.post("/api/auth/login")
def login_account(payload: AccountLogin, response: Response) -> dict[str, Any]:
    email = payload.email.strip().lower()
    with connect() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE lower(email) = lower(%s)", (email,)
        ).fetchone()
        if not row or not _verify_password(payload.password, row["password_hash"]):
            raise HTTPException(401, "Email or password is incorrect.")
        token = _issue_session(conn, row["id"])
        user = _public_user(row)
    _set_session_cookie(response, token)
    return {"user": user}


@app.post("/api/auth/logout")
def logout_account(request: Request, response: Response) -> dict[str, str]:
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        with connect() as conn:
            conn.execute("DELETE FROM sessions WHERE token_hash = %s", (_token_digest(token),))
    response.delete_cookie(SESSION_COOKIE, path="/", httponly=True, samesite="lax")
    return {"status": "signed_out"}


@app.get("/api/auth/me")
def account_details(request: Request) -> dict[str, Any]:
    user = getattr(request.state, "user", None)
    if user is None:
        raise HTTPException(401, "Sign in to access this workspace.")
    return {"user": user}


def row_dict(row: DatabaseRow | None) -> dict[str, Any] | None:
    return dict(row) if row else None


def serialize_task(row: DatabaseRow) -> dict[str, Any]:
    task = dict(row)
    task["task_id"] = task["id"]
    task["task_name"] = task["task_name"] or task["title"]
    task["assigned_agent"] = task["assigned_agent"] or task["agent_id"]
    task["input_data"] = json.loads(task["input_data"] or "{}")
    task["dependencies"] = json.loads(task["dependencies"] or "[]")
    task["execution_result"] = (
        json.loads(task["execution_result"])
        if task["execution_result"]
        else None
    )
    task["requires_approval"] = bool(task["requires_approval"])
    return task


def serialize_workflow(conn: DatabaseConnection, workflow_id: str) -> dict[str, Any] | None:
    workflow = row_dict(conn.execute("SELECT * FROM workflows WHERE id = %s", (workflow_id,)).fetchone())
    if not workflow:
        return None
    workflow["shared_context"] = json.loads(workflow["shared_context"] or "{}")
    workflow["tasks"] = [
        serialize_task(row)
        for row in conn.execute(
            "SELECT * FROM tasks WHERE workflow_id = %s ORDER BY sort_order",
            (workflow_id,),
        ).fetchall()
    ]
    workflow["approval"] = row_dict(conn.execute("SELECT * FROM approvals WHERE workflow_id = %s ORDER BY requested_at DESC LIMIT 1", (workflow_id,)).fetchone())
    if workflow["approval"]:
        workflow["approval"]["information"] = json.loads(workflow["approval"]["information"])
    workflow["audit"] = [row_dict(r) for r in conn.execute("SELECT * FROM audit_events WHERE workflow_id = %s ORDER BY created_at DESC", (workflow_id,)).fetchall()]
    return workflow


def parse_request(request: str) -> dict[str, str]:
    text = request.strip()
    onboarding = re.search(
        r"(?:onboard(?:\s+a\s+new\s+employee)?\s+(?:named\s+)?|employee\s+(?:named|name[d]?\s*:\s*)|named\s+)"
        r"(?P<name>[A-Za-z][A-Za-z .'-]{1,79}?)\s+"
        r"(?:in\s+(?:the\s+)?(?P<department>.+?)\s+department|"
        r"department\s*:\s*(?P<department_alt>[^,.;]+))"
        r".*?(?:joining\s+date(?:\s+of)?\s*[:=]?\s*)"
        r"(?P<joining_date>[^.;]+)",
        text,
        re.IGNORECASE,
    )
    if onboarding:
        department = (onboarding.group("department") or onboarding.group("department_alt") or "").strip()
        joining_date = onboarding.group("joining_date").strip()
        try:
            parsed_date = datetime.strptime(joining_date, "%B %d, %Y")
        except ValueError:
            try:
                parsed_date = datetime.strptime(joining_date, "%Y-%m-%d")
            except ValueError as exc:
                raise HTTPException(422, "Joining date must be a valid date such as November 10, 2026.") from exc
        return {
            "workflow_type": "employee_onboarding",
            "name": re.sub(r"\s+", " ", onboarding.group("name").strip()),
            "department": department,
            "joining_date": parsed_date.date().isoformat(),
        }

    invoice = re.search(
        r"(?:process|review)\s+invoice\s+(?P<number>[A-Z0-9][A-Z0-9_-]*)"
        r"\s+from\s+(?P<vendor>.+?)\s+for\s+"
        r"(?P<currency>Rs\.?|INR|USD|\$)?\s*(?P<amount>[\d,]+(?:\.\d{1,2})?)",
        text,
        re.IGNORECASE,
    )
    if invoice:
        try:
            amount = Decimal(invoice.group("amount").replace(",", ""))
        except InvalidOperation as exc:
            raise HTTPException(422, "Invoice amount must be a valid positive number.") from exc
        if amount <= 0:
            raise HTTPException(422, "Invoice amount must be greater than zero.")
        currency = (invoice.group("currency") or "INR").strip().upper()
        if currency in {"RS", "RS.", "INR"}:
            currency = "INR"
        elif currency == "$":
            currency = "USD"
        return {
            "workflow_type": "invoice_processing",
            "invoice_number": invoice.group("number").strip(),
            "vendor": invoice.group("vendor").strip(),
            "amount": str(amount),
            "currency": currency,
        }
    raise HTTPException(
        422,
        "This demo supports employee onboarding and invoice requests. Include the employee's name, department, and joining date, or invoice number, vendor, and amount.",
    )


@app.get("/api/health")
def health() -> dict[str, str]:
    try:
        check_database_health()
    except (DatabaseConfigurationError, SQLAlchemyError) as exc:
        raise HTTPException(503, "Database is unavailable") from exc
    return {"status": "ok", "service": "workforce-api", "mode": "langgraph"}


@app.get("/api/events")
async def event_stream(request: Request) -> StreamingResponse:
    last_event_id = request.headers.get("last-event-id")
    if last_event_id and "|" in last_event_id:
        cursor_created_at, cursor_id = last_event_id.rsplit("|", 1)
    else:
        with connect() as conn:
            latest = conn.execute(
                "SELECT created_at, id FROM audit_events ORDER BY created_at DESC, id DESC LIMIT 1"
            ).fetchone()
        cursor_created_at = latest["created_at"] if latest else ""
        cursor_id = latest["id"] if latest else ""

    async def stream():
        nonlocal cursor_created_at, cursor_id
        yield ": connected\n\n"
        while not await request.is_disconnected():
            with connect() as conn:
                events = conn.execute(
                    """SELECT * FROM audit_events
                       WHERE created_at > %s OR (created_at = %s AND id > %s)
                       ORDER BY created_at, id LIMIT 100""",
                    (cursor_created_at, cursor_created_at, cursor_id),
                ).fetchall()
            for event in events:
                item = row_dict(event)
                cursor_created_at = item["created_at"]
                cursor_id = item["id"]
                yield (
                    f"id: {cursor_created_at}|{cursor_id}\n"
                    f"data: {json.dumps(item, separators=(',', ':'))}\n\n"
                )
            await asyncio.sleep(1)

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


def get_agent_stats(conn: DatabaseConnection) -> list[dict[str, Any]]:
    result = []
    for agent in AGENTS:
        row = conn.execute(
            """SELECT COUNT(*) AS total,
                      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
                      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
                      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
                      SUM(CASE WHEN status IN ('running', 'waiting_approval') THEN 1 ELSE 0 END) AS active
               FROM tasks WHERE agent_id = %s""",
            (agent["id"],),
        ).fetchone()
        latest = conn.execute(
            """SELECT status FROM tasks WHERE agent_id = %s
               ORDER BY COALESCE(
                            completed_at, started_at, created_at,
                            TIMESTAMPTZ 'epoch'
                        ) DESC,
                        sort_order DESC LIMIT 1""",
            (agent["id"],),
        ).fetchone()
        total = row["total"] or 0
        resolved = (
            (row["completed"] or 0)
            + (row["failed"] or 0)
            + (row["rejected"] or 0)
        )
        task_status = latest["status"] if latest else "idle"
        status = {
            "queued": "assigned",
            "running": "running",
            "waiting_approval": "waiting_for_approval",
            "completed": "completed",
            "failed": "failed",
            "rejected": "rejected",
        }.get(task_status, "idle")
        item = {
            **agent,
            "status": status,
            "tasks": total,
            "success": round((row["completed"] or 0) * 100 / resolved) if resolved else 0,
            "execution_mode": (
                "langgraph_gemini"
                if os.getenv("GOOGLE_API_KEY", "").strip()
                or os.getenv("GEMINI_API_KEY", "").strip()
                else "langgraph_local"
            ),
        }
        result.append(item)
    return result


@app.get("/api/overview")
def overview() -> dict[str, Any]:
    with connect() as conn:
        workflows = conn.execute("SELECT * FROM workflows ORDER BY updated_at DESC").fetchall()
        pending = conn.execute("SELECT COUNT(*) FROM approvals WHERE status = 'pending'").fetchone()[0]
        active = conn.execute("SELECT COUNT(*) FROM workflows WHERE status IN ('running', 'waiting_approval')").fetchone()[0]
        completed = conn.execute("SELECT COUNT(*) FROM workflows WHERE status = 'completed'").fetchone()[0]
        failed = conn.execute("SELECT COUNT(*) FROM workflows WHERE status = 'failed'").fetchone()[0]
        total_resolved = conn.execute("SELECT COUNT(*) FROM workflows WHERE status IN ('completed', 'failed', 'rejected')").fetchone()[0]
        automated_actions = conn.execute("SELECT COUNT(*) FROM tasks WHERE status = 'completed'").fetchone()[0]
        recent = [serialize_workflow(conn, row["id"]) for row in workflows[:4]]
        succeeded = conn.execute("SELECT COUNT(*) FROM workflows WHERE status = 'completed'").fetchone()[0]
        success_rate = round(succeeded * 100 / total_resolved, 1) if total_resolved else 0
        return {
            "metrics": {
                "active_workflows": active,
                "pending_approvals": pending,
                "completed_workflows": completed,
                "failed_workflows": failed,
                "automated_actions": automated_actions,
                "success_rate": success_rate,
            },
            "workflows": recent,
            "agents": get_agent_stats(conn),
        }


@app.get("/api/workflows")
def workflows(limit: int = Query(default=100, ge=1, le=500), offset: int = Query(default=0, ge=0)) -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT id FROM workflows ORDER BY updated_at DESC LIMIT %s OFFSET %s",
            (limit, offset),
        ).fetchall()
        return [serialize_workflow(conn, row["id"]) for row in rows]


@app.get("/api/workflows/{workflow_id}")
def workflow_detail(workflow_id: str) -> dict[str, Any]:
    with connect() as conn:
        workflow = serialize_workflow(conn, workflow_id)
    if not workflow:
        raise HTTPException(404, "Workflow not found")
    return workflow


@app.get("/api/workflows/{workflow_id}/events")
def workflow_events(workflow_id: str) -> list[dict[str, Any]]:
    with connect() as conn:
        if not conn.execute("SELECT 1 FROM workflows WHERE id = %s", (workflow_id,)).fetchone():
            raise HTTPException(404, "Workflow not found")
        return [
            row_dict(row)
            for row in conn.execute(
                "SELECT * FROM audit_events WHERE workflow_id = %s ORDER BY created_at",
                (workflow_id,),
            ).fetchall()
        ]


@app.post("/api/workflows/{workflow_id}/cancel")
def cancel_workflow(workflow_id: str) -> dict[str, Any]:
    principal = current_user()
    with connect() as conn:
        workflow = conn.execute("SELECT * FROM workflows WHERE id = %s", (workflow_id,)).fetchone()
        if not workflow:
            raise HTTPException(404, "Workflow not found")
        if workflow["status"] not in {"running", "waiting_approval"}:
            raise HTTPException(409, "Only active workflows can be cancelled")
        cancelled_at = now()
        conn.execute(
            "UPDATE workflows SET status = 'cancelled', updated_at = %s, final_result = %s WHERE id = %s",
            (cancelled_at, "Workflow cancelled before protected actions were executed.", workflow_id),
        )
        conn.execute(
            "UPDATE tasks SET status = 'rejected', result = 'Workflow cancelled; task was not executed.', completed_at = %s WHERE workflow_id = %s AND status IN ('queued', 'running', 'waiting_approval')",
            (cancelled_at, workflow_id),
        )
        conn.execute(
            "UPDATE approvals SET status = 'cancelled', decided_at = %s, decision_reason = %s WHERE workflow_id = %s AND status = 'pending'",
            (cancelled_at, "Workflow cancelled.", workflow_id),
        )
        audit(conn, workflow_id, "human", principal["name"], "workflow.cancelled", "Active workflow cancelled; pending protected actions were blocked.", "cancelled")
        return serialize_workflow(conn, workflow_id)


@app.get("/api/agents")
def agents() -> list[dict[str, Any]]:
    with connect() as conn:
        return get_agent_stats(conn)


@app.get("/api/agents/{agent_id}")
def agent_detail(agent_id: str) -> dict[str, Any]:
    agent = next((item for item in AGENTS if item["id"] == agent_id), None)
    if not agent:
        raise HTTPException(404, "Agent not found")
    with connect() as conn:
        return next(item for item in get_agent_stats(conn) if item["id"] == agent_id)


@app.get("/api/agents/{agent_id}/executions")
def agent_executions(agent_id: str, limit: int = Query(default=100, ge=1, le=500)) -> list[dict[str, Any]]:
    if not any(item["id"] == agent_id for item in AGENTS):
        raise HTTPException(404, "Agent not found")
    with connect() as conn:
        return [
            serialize_task(row)
            for row in conn.execute(
                "SELECT * FROM tasks WHERE agent_id = %s ORDER BY started_at DESC LIMIT %s",
                (agent_id, limit),
            ).fetchall()
        ]


@app.post("/api/employees")
def create_employee(payload: EmployeeCreate) -> dict[str, Any]:
    principal = current_user()
    created_at = now()
    employee = {
        "id": new_id("emp"),
        "name": payload.name.strip(),
        "department": payload.department.strip(),
        "title": payload.title.strip(),
        "joining_date": payload.joining_date.strip(),
        "status": "Onboarding",
        "workflow_id": None,
        "created_at": created_at,
        "email": payload.email.strip().lower() if payload.email else None,
    }
    if employee["email"] and not re.fullmatch(
        r"[^@\s]+@[^@\s]+\.[^@\s]+", employee["email"]
    ):
        raise HTTPException(422, "Employee email address is invalid.")
    with connect() as conn:
        if employee["email"] and conn.execute(
            "SELECT 1 FROM employees WHERE lower(email) = lower(%s)",
            (employee["email"],),
        ).fetchone():
            raise HTTPException(409, "An employee with this email address already exists.")
        conn.execute(
            """INSERT INTO employees
               (id, name, department, title, joining_date, status, workflow_id, created_at, email)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            tuple(employee.values()),
        )
        audit(conn, None, "human", principal["name"], "employee.created", f"{employee['name']} was added to {employee['department']}.")
    return employee


@app.get("/api/employees/{employee_id}")
def employee_detail(employee_id: str) -> dict[str, Any]:
    with connect() as conn:
        employee = row_dict(conn.execute("SELECT * FROM employees WHERE id = %s", (employee_id,)).fetchone())
    if not employee:
        raise HTTPException(404, "Employee not found")
    return employee


@app.put("/api/employees/{employee_id}")
def update_employee(employee_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    principal = current_user()
    allowed = {"name", "department", "title", "joining_date", "status", "email"}
    updates = {key: str(value).strip() for key, value in payload.items() if key in allowed and str(value).strip()}
    if not updates:
        raise HTTPException(422, "Provide at least one valid employee field.")
    with connect() as conn:
        if not conn.execute("SELECT 1 FROM employees WHERE id = %s", (employee_id,)).fetchone():
            raise HTTPException(404, "Employee not found")
        if "email" in updates:
            updates["email"] = updates["email"].lower()
        columns = ", ".join(f'"{key}" = %s' for key in updates)
        conn.execute(
            f"UPDATE employees SET {columns} WHERE id = %s",
            (*updates.values(), employee_id),
        )
        audit(conn, None, "human", principal["name"], "employee.updated", f"Employee {employee_id} was updated.")
        return row_dict(conn.execute("SELECT * FROM employees WHERE id = %s", (employee_id,)).fetchone())


@app.delete("/api/employees/{employee_id}")
def delete_employee(employee_id: str) -> dict[str, str]:
    principal = current_user()
    with connect() as conn:
        if not conn.execute("SELECT 1 FROM employees WHERE id = %s", (employee_id,)).fetchone():
            raise HTTPException(404, "Employee not found")
        conn.execute("DELETE FROM employees WHERE id = %s", (employee_id,))
        audit(conn, None, "human", principal["name"], "employee.deleted", f"Employee {employee_id} was removed.")
    return {"status": "deleted", "employee_id": employee_id}


@app.post("/api/planner/preview")
def preview_workflow_plan(payload: PlannerPreviewCreate) -> dict[str, Any]:
    parsed = parse_request(payload.request)
    if parsed["workflow_type"] == "employee_onboarding" and payload.email:
        parsed["email"] = payload.email.strip().lower()
    plan = create_workflow_plan(parsed)
    return {
        "workflow_type": parsed["workflow_type"],
        "summary": plan["planner_summary"],
        "mode": plan["mode"],
        "warning": plan.get("warning"),
        "steps": [
            {
                "agent_id": task[0],
                "title": task[1],
                "description": task[2],
                "requires_approval": bool(task[5]),
            }
            for task in plan["tasks"]
        ],
    }


@app.post("/api/workflows")
def create_workflow(payload: WorkflowCreate) -> dict[str, Any]:
    return _create_workflow(payload)


def _create_workflow(
    payload: WorkflowCreate, invoice_details: dict[str, Any] | None = None
) -> dict[str, Any]:
    principal = current_user()
    parsed = parse_request(payload.request)
    if parsed["workflow_type"] == "employee_onboarding" and payload.email:
        parsed["email"] = payload.email.strip().lower()
    if invoice_details:
        parsed.update(invoice_details)
    plan = create_workflow_plan(parsed)
    workflow_id = new_id("wf")
    ts = now()
    is_onboarding = parsed["workflow_type"] == "employee_onboarding"
    created_by = principal["name"]
    title = (
        f"Onboard {parsed['name']}"
        if is_onboarding
        else f"Process invoice {parsed['invoice_number']}"
    )
    context = {
        "workflow_type": parsed["workflow_type"],
        "mode": plan["mode"],
        "orchestration": "langgraph",
        "planner_notes": plan["planner_summary"],
        "request_data": parsed,
    }
    if plan.get("warning"):
        context["planner_warning"] = plan["warning"]
    with connect() as conn:
        if not is_onboarding:
            duplicate = conn.execute(
                "SELECT id FROM finance_reviews WHERE lower(vendor) = lower(%s) AND lower(invoice_number) = lower(%s)",
                (parsed["vendor"], parsed["invoice_number"]),
            ).fetchone()
            if duplicate:
                raise HTTPException(409, "An invoice with this vendor and invoice number is already recorded.")
        if is_onboarding:
            department = parsed["department"]
            employee_name = parsed["name"]
            joining_date = parsed["joining_date"]
        else:
            department = "Finance"
            employee_name = None
            joining_date = None
        conn.execute(
            "INSERT INTO workflows VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
            (
                workflow_id,
                title,
                payload.request,
                "running",
                created_by,
                department,
                employee_name,
                joining_date,
                ts,
                ts,
                None,
                json.dumps(context),
            ),
        )
        add_tasks(conn, workflow_id, plan["tasks"])
        audit(conn, workflow_id, "agent", "planner", "plan.created", f"Planner created a validated {parsed['workflow_type']} plan using LangGraph.")
        if plan.get("warning"):
            audit(conn, workflow_id, "system", "planner", "planner.provider_warning", plan["warning"], "warning")
    try:
        run_workflow_execution(
            workflow_id,
            created_by,
            parsed["workflow_type"],
            principal["id"],
        )
    except AgentConflictError as exc:
        with connect() as conn:
            conn.execute(
                "UPDATE workflows SET status = 'failed', updated_at = %s, final_result = %s WHERE id = %s",
                (now(), f"Agent execution failed: {exc}", workflow_id),
            )
        raise HTTPException(409, str(exc)) from exc
    except ValueError as exc:
        with connect() as conn:
            conn.execute(
                "UPDATE workflows SET status = 'failed', updated_at = %s, final_result = %s WHERE id = %s",
                (now(), f"Agent execution failed: {exc}", workflow_id),
            )
        raise HTTPException(422, str(exc)) from exc
    except (CheckpointPersistenceError, SQLAlchemyError) as exc:
        with connect() as conn:
            conn.execute(
                "UPDATE workflows SET status = 'failed', updated_at = %s, final_result = %s WHERE id = %s",
                (now(), "Agent execution failed because of a database error.", workflow_id),
            )
        raise HTTPException(500, "Workflow agent execution failed.") from exc
    with connect() as conn:
        result = serialize_workflow(conn, workflow_id)
    if result is None:
        raise HTTPException(500, "Workflow was created but could not be loaded.")
    return result


@app.get("/api/approvals")
def approvals(limit: int = Query(default=100, ge=1, le=500), offset: int = Query(default=0, ge=0)) -> list[dict[str, Any]]:
    with connect() as conn:
        items = [row_dict(row) for row in conn.execute(
            "SELECT * FROM approvals ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, requested_at DESC LIMIT %s OFFSET %s",
            (limit, offset),
        ).fetchall()]
        for item in items:
            item["information"] = json.loads(item["information"])
        return items


@app.get("/api/approvals/pending")
def pending_approvals() -> list[dict[str, Any]]:
    with connect() as conn:
        items = [row_dict(row) for row in conn.execute(
            "SELECT * FROM approvals WHERE status = 'pending' ORDER BY requested_at"
        ).fetchall()]
        for item in items:
            item["information"] = json.loads(item["information"])
        return items


@app.post("/api/approvals/{approval_id}/decision")
def decide_approval(approval_id: str, payload: ApprovalDecision) -> dict[str, Any]:
    principal = current_user()
    if principal["role"] not in {"manager", "admin", "finance_admin"}:
        raise HTTPException(403, "Only an authorized manager can decide approvals")
    decision = payload.decision
    if decision is None:
        raise HTTPException(422, "An explicit approved or rejected decision is required.")
    with connect() as conn:
        approval = conn.execute(
            "SELECT * FROM approvals WHERE id = %s FOR UPDATE",
            (approval_id,),
        ).fetchone()
        if not approval:
            raise HTTPException(404, "Approval not found")
        if approval["status"] != "pending":
            raise HTTPException(409, "This approval has already been decided")
        workflow_id = approval["workflow_id"]
        decided_at = now()
        conn.execute(
            """UPDATE approvals SET status = %s, decided_at = %s, decided_by = %s,
               decision_reason = %s WHERE id = %s""",
            (decision, decided_at, principal["name"], payload.reason, approval_id),
        )
    try:
        resume_workflow_execution(
            workflow_id,
            principal["name"],
            decision,
            payload.reason,
            principal["id"],
        )
    except (CheckpointPersistenceError, SQLAlchemyError, ValueError) as exc:
        with connect() as conn:
            conn.execute(
                "UPDATE workflows SET status = 'failed', updated_at = %s, final_result = %s WHERE id = %s",
                (
                    now(),
                    "Workflow could not resume because a database operation failed."
                    if isinstance(exc, (CheckpointPersistenceError, SQLAlchemyError))
                    else f"Workflow could not resume after approval: {exc}",
                    workflow_id,
                ),
            )
        raise HTTPException(500, "Workflow could not resume after the approval decision.") from exc
    with connect() as conn:
        result = serialize_workflow(conn, workflow_id)
    if result is None:
        raise HTTPException(500, "Workflow approval was recorded but workflow could not be loaded.")
    return result


@app.post("/api/approvals/{approval_id}/approve")
def approve_request(approval_id: str, payload: ApprovalDecision | None = None) -> dict[str, Any]:
    decision = payload or ApprovalDecision()
    return decide_approval(
        approval_id, decision.model_copy(update={"decision": "approved"})
    )


@app.post("/api/approvals/{approval_id}/reject")
def reject_request(approval_id: str, payload: ApprovalDecision | None = None) -> dict[str, Any]:
    decision = payload or ApprovalDecision()
    return decide_approval(
        approval_id,
        decision.model_copy(update={"decision": "rejected"}),
    )


@app.post("/api/workflows/{workflow_id}/retry")
def retry_workflow(workflow_id: str) -> dict[str, Any]:
    principal = current_user()
    with connect() as conn:
        workflow = conn.execute("SELECT * FROM workflows WHERE id = %s", (workflow_id,)).fetchone()
        if not workflow:
            raise HTTPException(404, "Workflow not found")
        if workflow["status"] != "failed":
            raise HTTPException(409, "Only failed workflows can be retried")
        failed_tasks = conn.execute(
            "SELECT id, agent_id, action FROM tasks WHERE workflow_id = %s AND status = 'failed'",
            (workflow_id,),
        ).fetchall()
        if not failed_tasks:
            raise HTTPException(409, "No failed tasks are eligible for retry")
        if any(
            task["action"] not in ACTION_REGISTRY
            or ACTION_REGISTRY[task["action"]][0] != task["agent_id"]
            for task in failed_tasks
        ):
            raise HTTPException(
                409, "This failed task has no registered agent handler and cannot be retried."
            )
        for task in failed_tasks:
            conn.execute(
                """UPDATE tasks SET status = 'queued', result = NULL, execution_result = NULL,
                   error_message = NULL, started_at = NULL, completed_at = NULL WHERE id = %s""",
                (task["id"],),
            )
        conn.execute(
            "UPDATE workflows SET status = 'running', updated_at = %s, final_result = NULL WHERE id = %s",
            (now(), workflow_id),
        )
        retry_context = json.loads(workflow["shared_context"] or "{}")
        workflow_type = retry_context.get("workflow_type")
        if workflow_type not in {
            "employee_onboarding",
            "invoice_processing",
            "it_access_request",
        }:
            raise HTTPException(409, "Workflow has no resumable execution plan.")
        audit(
            conn,
            workflow_id,
            "human",
            principal["name"],
            "workflow.retry",
            "Authorized user requested a retry of registered failed agent tasks.",
        )
    try:
        run_workflow_execution(
            workflow_id,
            principal["name"],
            workflow_type,
            principal["id"],
        )
    except (
        AgentConflictError,
        CheckpointPersistenceError,
        SQLAlchemyError,
        ValueError,
    ) as exc:
        with connect() as conn:
            conn.execute(
                "UPDATE workflows SET status = 'failed', updated_at = %s, final_result = %s WHERE id = %s",
                (
                    now(),
                    "Agent retry failed because a database operation failed."
                    if isinstance(exc, (CheckpointPersistenceError, SQLAlchemyError))
                    else f"Agent retry failed: {exc}",
                    workflow_id,
                ),
            )
        raise HTTPException(500, "Registered agent task retry failed.") from exc
    with connect() as conn:
        result = serialize_workflow(conn, workflow_id)
    if result is None:
        raise HTTPException(500, "Workflow retry completed but could not be loaded.")
    return result


@app.get("/api/employees")
def employees(limit: int = Query(default=100, ge=1, le=500), offset: int = Query(default=0, ge=0)) -> list[dict[str, Any]]:
    with connect() as conn:
        return [
            row_dict(row)
            for row in conn.execute(
                "SELECT * FROM employees ORDER BY created_at DESC LIMIT %s OFFSET %s",
                (limit, offset),
            ).fetchall()
        ]


@app.get("/api/departments")
def departments() -> list[dict[str, Any]]:
    with connect() as conn:
        return [
            row_dict(row)
            for row in conn.execute(
                """SELECT department, COUNT(*) AS employee_count
                   FROM employees GROUP BY department ORDER BY department"""
            ).fetchall()
        ]


@app.get("/api/employees/{employee_id}/onboarding-status")
def employee_onboarding_status(employee_id: str) -> dict[str, Any]:
    with connect() as conn:
        employee = row_dict(
            conn.execute("SELECT * FROM employees WHERE id = %s", (employee_id,)).fetchone()
        )
        if employee is None:
            raise HTTPException(404, "Employee not found")
        workflow_id = employee["workflow_id"]
        if not workflow_id:
            return {
                "employee_id": employee_id,
                "employee_status": employee["status"],
                "workflow_status": None,
                "tasks": [],
                "approval": None,
            }
        workflow = conn.execute(
            "SELECT status FROM workflows WHERE id = %s", (workflow_id,)
        ).fetchone()
        approval = conn.execute(
            "SELECT status, decided_at, decided_by FROM approvals WHERE workflow_id = %s ORDER BY requested_at DESC LIMIT 1",
            (workflow_id,),
        ).fetchone()
        tasks = [
            row_dict(row)
            for row in conn.execute(
                "SELECT id, agent_id, title, status, result, error_message FROM tasks WHERE workflow_id = %s ORDER BY sort_order",
                (workflow_id,),
            ).fetchall()
        ]
        return {
            "employee_id": employee_id,
            "workflow_id": workflow_id,
            "employee_status": employee["status"],
            "workflow_status": workflow["status"] if workflow else None,
            "tasks": tasks,
            "approval": row_dict(approval),
        }


@app.post("/api/finance/analyze")
def analyze_finance_invoice(payload: InvoiceAnalysisRequest) -> dict[str, Any]:
    analysis = analyze_invoice(payload.model_dump())
    if analysis["valid"]:
        with connect() as conn:
            duplicate = conn.execute(
                """SELECT 1 FROM finance_reviews
                   WHERE lower(vendor) = lower(%s)
                     AND lower(invoice_number) = lower(%s) LIMIT 1""",
                (payload.vendor.strip(), payload.invoice_number.strip()),
            ).fetchone()
        if duplicate:
            analysis["duplicate"] = True
            analysis["valid"] = False
            analysis["errors"].append(
                "An invoice with this vendor and invoice number has already been submitted."
            )
    return analysis


@app.post("/api/finance/invoices")
def submit_finance_invoice(
    vendor: str | None = Form(default=None),
    invoice_number: str | None = Form(default=None),
    invoice_date: str | None = Form(default=None),
    due_date: str | None = Form(default=None),
    amount: str | None = Form(default=None),
    vendor_email: str | None = Form(default=None),
    gst_percentage: str | None = Form(default=None),
    tax_amount: str | None = Form(default=None),
    total_amount: str | None = Form(default=None),
    currency: str = Form(default="INR"),
    expense_category: str | None = Form(default=None),
    description: str | None = Form(default=None),
    attachment: UploadFile | None = File(default=None),
) -> dict[str, Any]:
    principal = current_user()
    values = {
        "vendor": vendor,
        "invoice_number": invoice_number,
        "vendor_email": vendor_email,
        "invoice_date": invoice_date,
        "due_date": due_date,
        "amount": amount,
        "gst_percentage": gst_percentage,
        "tax_amount": tax_amount,
        "total_amount": total_amount,
        "currency": currency,
        "expense_category": expense_category,
        "description": description,
    }
    analysis = analyze_invoice(values)
    if not analysis["valid"]:
        raise HTTPException(
            422,
            detail={
                "message": "Invoice validation failed; review the analysis and correct the listed fields.",
                "analysis": analysis,
            },
        )

    attachment_data: tuple[str, str, bytes] | None = None
    attachment_path: str | None = None
    if attachment is not None and attachment.filename:
        content = attachment.file.read(MAX_INVOICE_FILE_SIZE + 1)
        try:
            validate_invoice_file(
                attachment.filename, attachment.content_type or "", content
            )
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        if len(content) > MAX_INVOICE_FILE_SIZE:
            raise HTTPException(422, "Invoice attachment must be 10 MB or smaller.")
        attachment_data = (
            attachment.filename,
            attachment.content_type or "",
            content,
        )

    with connect() as conn:
        duplicate = conn.execute(
            """SELECT 1 FROM finance_reviews
               WHERE lower(vendor) = lower(%s)
                 AND lower(invoice_number) = lower(%s) LIMIT 1""",
            (vendor.strip(), invoice_number.strip()),
        ).fetchone()
    if duplicate:
        analysis["duplicate"] = True
        analysis["valid"] = False
        analysis["errors"].append(
            "An invoice with this vendor and invoice number has already been submitted."
        )
        raise HTTPException(
            409,
            detail={"message": analysis["errors"][-1], "analysis": analysis},
        )

    if attachment_data:
        try:
            attachment_path = upload_invoice_file(
                *attachment_data
            )
        except RuntimeError as exc:
            raise HTTPException(503, str(exc)) from exc

    invoice_details = {
        **values,
        "amount": analysis["amount"],
        "gst_percentage": analysis["gst_percentage"],
        "tax_amount": analysis["tax_amount"],
        "total_amount": analysis["total_amount"],
        "expense_category": analysis["categorized_expense"],
        "attachment_path": attachment_path,
        "analysis_warnings": analysis["warnings"],
    }
    safe_invoice_number = re.sub(
        r"[^A-Za-z0-9_-]", "_", invoice_number.strip()
    )[:100] or "invoice"
    safe_vendor_name = re.sub(r"\s+", " ", vendor.strip())
    request_text = (
        f"Process invoice {safe_invoice_number} from {safe_vendor_name} "
        f"for {analysis['currency']} {analysis['amount']}."
    )
    workflow = _create_workflow(
        WorkflowCreate(request=request_text, created_by=principal["name"]),
        invoice_details=invoice_details,
    )
    with connect() as conn:
        invoice = row_dict(
            conn.execute(
                """SELECT finance_reviews.* FROM finance_reviews
                   JOIN payment_requests
                     ON payment_requests.invoice_id = finance_reviews.id
                   WHERE payment_requests.workflow_id = %s""",
                (workflow["id"],),
            ).fetchone()
        )
        payment = row_dict(
            conn.execute(
                "SELECT * FROM payment_requests WHERE workflow_id = %s",
                (workflow["id"],),
            ).fetchone()
        )
    if invoice is None or payment is None:
        raise HTTPException(
            500, "Finance workflow completed without its persisted invoice and payment request."
        )
    return {
        "invoice": invoice,
        "payment_request": payment,
        "workflow": workflow,
        "analysis": invoice.get("analysis") or analysis,
        "approval": workflow.get("approval"),
        "payment_execution": "disabled",
    }


@app.get("/api/finance/reviews")
def finance_reviews() -> list[dict[str, Any]]:
    with connect() as conn:
        return [row_dict(row) for row in conn.execute("SELECT * FROM finance_reviews ORDER BY created_at DESC").fetchall()]


@app.post("/api/finance/reviews")
def create_finance_review(payload: FinanceReviewCreate) -> dict[str, Any]:
    principal = current_user()
    try:
        amount = Decimal(payload.amount.replace(",", "").strip())
    except InvalidOperation as exc:
        raise HTTPException(422, "Invoice amount must be a valid positive number.") from exc
    if not amount.is_finite() or amount <= 0:
        raise HTTPException(422, "Invoice amount must be greater than zero.")
    if amount.as_tuple().exponent < -2:
        raise HTTPException(422, "Invoice amount cannot have more than two decimal places.")
    vendor = payload.vendor.strip()
    invoice_number = payload.invoice_number.strip()
    if not vendor or not invoice_number:
        raise HTTPException(422, "Vendor and invoice number cannot be blank.")
    request = f"Process invoice {invoice_number} from {vendor} for INR {format(amount, 'f')}."
    create_workflow(WorkflowCreate(request=request, created_by=principal["name"]))
    with connect() as conn:
        review = row_dict(
            conn.execute(
                "SELECT * FROM finance_reviews WHERE lower(vendor) = lower(%s) AND lower(invoice_number) = lower(%s) ORDER BY created_at DESC LIMIT 1",
                (vendor, invoice_number),
            ).fetchone()
        )
    if review is None:
        raise HTTPException(500, "Finance workflow was created without its invoice review record.")
    return review


@app.get("/api/finance/invoices")
def invoices(limit: int = Query(default=100, ge=1, le=500), offset: int = Query(default=0, ge=0)) -> list[dict[str, Any]]:
    with connect() as conn:
        return [
            row_dict(row)
            for row in conn.execute(
                """SELECT finance_reviews.*, payment_requests.id AS payment_request_id,
                          payment_requests.workflow_id,
                          payment_requests.status AS payment_status,
                          payment_requests.amount AS payment_amount,
                          payment_requests.currency AS payment_currency,
                          COALESCE(payment_requests.status, finance_reviews.status) AS approval_status
                   FROM finance_reviews
                   LEFT JOIN payment_requests ON payment_requests.invoice_id = finance_reviews.id
                   ORDER BY finance_reviews.created_at DESC LIMIT %s OFFSET %s""",
                (limit, offset),
            ).fetchall()
        ]


@app.get("/api/finance/dashboard")
def finance_dashboard() -> dict[str, Any]:
    with connect() as conn:
        row = conn.execute(
            """SELECT COUNT(finance_reviews.id) AS total_invoices,
                      COUNT(*) FILTER (
                        WHERE COALESCE(payment_requests.status, finance_reviews.status)
                              IN ('pending_approval', 'pending_review')
                      ) AS pending_approvals,
                      COUNT(*) FILTER (
                        WHERE COALESCE(payment_requests.status, finance_reviews.status)
                              = 'approved_simulated'
                      ) AS approved_invoices,
                      COUNT(*) FILTER (
                        WHERE COALESCE(payment_requests.status, finance_reviews.status)
                              = 'rejected'
                      ) AS rejected_invoices,
                      COALESCE(SUM(payment_requests.amount::numeric), 0) AS total_amount
               FROM finance_reviews
               LEFT JOIN payment_requests ON payment_requests.invoice_id = finance_reviews.id"""
        ).fetchone()
    return {
        "total_invoices": row["total_invoices"],
        "pending_approvals": row["pending_approvals"],
        "approved_invoices": row["approved_invoices"],
        "rejected_invoices": row["rejected_invoices"],
        "total_amount": format(Decimal(str(row["total_amount"])), "f"),
        "currency": "mixed",
        "payments_executed": 0,
    }


@app.get("/api/finance/payment-requests")
def payment_requests(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[dict[str, Any]]:
    with connect() as conn:
        return [
            row_dict(row)
            for row in conn.execute(
                """SELECT payment_requests.*, finance_reviews.vendor,
                          finance_reviews.invoice_number
                   FROM payment_requests
                   JOIN finance_reviews ON finance_reviews.id = payment_requests.invoice_id
                   ORDER BY payment_requests.created_at DESC LIMIT %s OFFSET %s""",
                (limit, offset),
            ).fetchall()
        ]


@app.get("/api/finance/invoices/{invoice_id}")
def invoice_detail(invoice_id: str) -> dict[str, Any]:
    with connect() as conn:
        invoice = row_dict(conn.execute("SELECT * FROM finance_reviews WHERE id = %s", (invoice_id,)).fetchone())
    if not invoice:
        raise HTTPException(404, "Invoice not found")
    return invoice


@app.get("/api/finance/reports")
def finance_report() -> dict[str, Any]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT status, COUNT(*) AS count FROM finance_reviews GROUP BY status"
        ).fetchall()
        return {
            "total_invoices": sum(row["count"] for row in rows),
            "by_status": {row["status"]: row["count"] for row in rows},
            "payments_executed": 0,
            "mode": "simulated_only",
        }


@app.post("/api/agents/it/requests")
def create_it_access_workflow(payload: ITAccessWorkflowCreate) -> dict[str, Any]:
    principal = current_user()
    access = list(dict.fromkeys(item.strip() for item in payload.access if item.strip()))
    equipment = payload.equipment.strip()
    if not access and not equipment:
        raise HTTPException(422, "Request at least one access permission or equipment item.")
    if any(len(item) > 120 for item in access):
        raise HTTPException(422, "Access request names must be at most 120 characters.")

    workflow_id = new_id("wf")
    created_at = now()
    with connect() as conn:
        employee = conn.execute(
            "SELECT id, name, department FROM employees WHERE id = %s",
            (payload.employee_id,),
        ).fetchone()
        if employee is None:
            raise HTTPException(404, "Employee not found.")
        request_data = {
            "workflow_type": "it_access_request",
            "employee_id": employee["id"],
            "employee_name": employee["name"],
            "department": employee["department"],
            "access": access,
            "equipment": equipment,
        }
        title = f"IT access request for {employee['name']}"
        request = (
            f"Request IT access for {employee['name']}: "
            f"{', '.join(access) if access else 'no software access'}; "
            f"equipment: {equipment or 'none'}."
        )
        conn.execute(
            """INSERT INTO workflows
               (id, title, request, status, created_by, department, employee_name,
                joining_date, created_at, updated_at, final_result, shared_context)
               VALUES (%s, %s, %s, 'running', %s, %s, %s, NULL, %s, %s, NULL, %s)""",
            (
                workflow_id,
                title,
                request,
                principal["name"],
                employee["department"],
                employee["name"],
                created_at,
                created_at,
                json.dumps(
                    {
                        "workflow_type": "it_access_request",
                        "orchestration": "langgraph",
                        "request_data": request_data,
                    }
                ),
            ),
        )
        add_tasks(
            conn,
            workflow_id,
            [
                (
                    "it",
                    "Prepare access and equipment requests",
                    "Persist the requested internal access and equipment items for human review.",
                    "queued",
                    1,
                    0,
                    None,
                    None,
                    "it.create_requests",
                    {"employee_id": employee["id"], "access": access, "equipment": equipment},
                ),
                (
                    "approval",
                    "Manager approval checkpoint",
                    "Require an authorized human decision before simulated provisioning.",
                    "queued",
                    2,
                    1,
                    None,
                    "it",
                    "approval.create_request",
                    {
                        "approval_title": "Approve IT access & equipment",
                        "approval_action": "Approve requested access and equipment for simulated provisioning",
                        "approval_reason": "Employee access and equipment requests require a human checkpoint.",
                        "approval_info": {
                            "employee": employee["name"],
                            "department": employee["department"],
                            "access": access,
                            "equipment": equipment,
                            "mode": "simulated only",
                        },
                        "protected_agent": "it",
                    },
                ),
                (
                    "communication",
                    "Prepare request update",
                    "Create a persisted draft after the human approval decision.",
                    "queued",
                    3,
                    0,
                    None,
                    "approval",
                    "communication.create_notification",
                    {},
                ),
            ],
        )
        audit(
            conn,
            workflow_id,
            "human",
            principal["name"],
            "it.workflow_created",
            "Created an IT access workflow with a human approval checkpoint.",
        )

    try:
        run_workflow_execution(
            workflow_id,
            principal["name"],
            "it_access_request",
            principal["id"],
        )
    except (AgentConflictError, CheckpointPersistenceError, SQLAlchemyError, ValueError) as exc:
        with connect() as conn:
            conn.execute(
                "UPDATE workflows SET status = 'failed', updated_at = %s, final_result = %s WHERE id = %s",
                (
                    now(),
                    "IT access workflow failed during agent execution.",
                    workflow_id,
                ),
            )
        raise HTTPException(500, "IT access workflow could not be executed.") from exc
    with connect() as conn:
        result = serialize_workflow(conn, workflow_id)
    if result is None:
        raise HTTPException(500, "IT access workflow was created but could not be loaded.")
    return result


@app.post("/api/it/requests")
def create_it_request(payload: ITRequestCreate) -> dict[str, Any]:
    principal = current_user()
    request = {
        "id": new_id("it"),
        "employee_name": payload.employee_name.strip(),
        "request_type": payload.request_type.strip(),
        "description": payload.description.strip(),
        "status": "pending_approval",
        "created_by": principal["name"],
        "created_at": now(),
        "employee_id": None,
        "workflow_id": None,
    }
    with connect() as conn:
        conn.execute(
            """INSERT INTO it_requests
               (id, employee_name, request_type, description, status, created_by,
                created_at, employee_id, workflow_id)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            tuple(request.values()),
        )
        audit(conn, None, "human", principal["name"], "it.request_created", f"{request['request_type']} request created for {request['employee_name']}.", "pending")
    return request


@app.get("/api/it/requests")
def it_requests(limit: int = Query(default=100, ge=1, le=500), offset: int = Query(default=0, ge=0)) -> list[dict[str, Any]]:
    with connect() as conn:
        return [
            row_dict(row)
            for row in conn.execute(
                "SELECT * FROM it_requests ORDER BY created_at DESC LIMIT %s OFFSET %s",
                (limit, offset),
            ).fetchall()
        ]


@app.get("/api/it/requests/{request_id}")
def it_request_detail(request_id: str) -> dict[str, Any]:
    with connect() as conn:
        request = row_dict(conn.execute("SELECT * FROM it_requests WHERE id = %s", (request_id,)).fetchone())
    if not request:
        raise HTTPException(404, "IT request not found")
    return request


@app.put("/api/it/requests/{request_id}")
def update_it_request(request_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    principal = current_user()
    status = payload.get("status")
    allowed_statuses = {"pending_approval", "approved_simulated", "rejected"}
    if status not in allowed_statuses:
        raise HTTPException(422, f"Status must be one of: {', '.join(sorted(allowed_statuses))}.")
    if status != "pending_approval" and principal["role"] not in {"manager", "admin", "finance_admin"}:
        raise HTTPException(403, "Only an authorized manager can decide IT requests.")
    with connect() as conn:
        existing = conn.execute(
            "SELECT workflow_id FROM it_requests WHERE id = %s", (request_id,)
        ).fetchone()
        if not existing:
            raise HTTPException(404, "IT request not found")
        if status != "pending_approval" and existing["workflow_id"]:
            raise HTTPException(
                409, "Decide workflow-linked IT requests in the Approval Center."
            )
        conn.execute("UPDATE it_requests SET status = %s WHERE id = %s", (status, request_id))
        audit(conn, None, "human", principal["name"], "it.request_updated", f"IT request {request_id} was marked {status}.")
        return row_dict(conn.execute("SELECT * FROM it_requests WHERE id = %s", (request_id,)).fetchone())


@app.post("/api/communications/send")
def create_communication(payload: CommunicationCreate) -> dict[str, Any]:
    if payload.workflow_id:
        with connect() as conn:
            if not conn.execute("SELECT 1 FROM workflows WHERE id = %s", (payload.workflow_id,)).fetchone():
                raise HTTPException(404, "Workflow not found")
    notification = {
        "id": new_id("msg"),
        "workflow_id": payload.workflow_id,
        "recipient": payload.recipient.strip(),
        "subject": payload.subject.strip(),
        "body": payload.body.strip(),
        "status": "draft_simulated",
        "created_at": now(),
    }
    with connect() as conn:
        conn.execute(
            "INSERT INTO notifications VALUES (%s, %s, %s, %s, %s, %s, %s)",
            tuple(notification.values()),
        )
        audit(conn, payload.workflow_id, "agent", "communication", "notification.preview_created", "Draft notification stored; no email was sent.")
    return notification


@app.get("/api/communications")
def communications(limit: int = Query(default=100, ge=1, le=500), offset: int = Query(default=0, ge=0)) -> list[dict[str, Any]]:
    with connect() as conn:
        return [
            row_dict(row)
            for row in conn.execute(
                "SELECT * FROM notifications ORDER BY created_at DESC LIMIT %s OFFSET %s",
                (limit, offset),
            ).fetchall()
        ]


@app.get("/api/communications/{message_id}")
def communication_detail(message_id: str) -> dict[str, Any]:
    with connect() as conn:
        message = row_dict(conn.execute("SELECT * FROM notifications WHERE id = %s", (message_id,)).fetchone())
    if not message:
        raise HTTPException(404, "Notification not found")
    return message


@app.put("/api/communications/{message_id}")
def update_communication(message_id: str, payload: CommunicationUpdate) -> dict[str, Any]:
    principal = current_user()
    recipient = payload.recipient.strip()
    subject = payload.subject.strip()
    body = payload.body.strip()
    if not recipient or not subject or not body:
        raise HTTPException(422, "Recipient, subject, and body cannot be blank.")
    with connect() as conn:
        message = conn.execute(
            "SELECT status, workflow_id FROM notifications WHERE id = %s FOR UPDATE",
            (message_id,),
        ).fetchone()
        if message is None:
            raise HTTPException(404, "Notification not found")
        if message["status"] != "draft_simulated":
            raise HTTPException(409, "Only draft notifications can be edited.")
        conn.execute(
            "UPDATE notifications SET recipient = %s, subject = %s, body = %s WHERE id = %s",
            (recipient, subject, body, message_id),
        )
        audit(
            conn,
            message["workflow_id"],
            "human",
            principal["name"],
            "notification.draft_updated",
            f"Draft notification {message_id} was edited; no email was sent.",
        )
        return row_dict(
            conn.execute(
                "SELECT * FROM notifications WHERE id = %s", (message_id,)
            ).fetchone()
        )


@app.get("/api/audit")
@app.get("/api/audit-logs")
def audit_log(limit: int = Query(default=100, ge=1, le=500), offset: int = Query(default=0, ge=0)) -> list[dict[str, Any]]:
    with connect() as conn:
        return [
            row_dict(row)
            for row in conn.execute(
                "SELECT * FROM audit_events ORDER BY created_at DESC LIMIT %s OFFSET %s",
                (limit, offset),
            ).fetchall()
        ]


@app.get("/api/audit-logs/{log_id}")
def audit_detail(log_id: str) -> dict[str, Any]:
    with connect() as conn:
        event = row_dict(conn.execute("SELECT * FROM audit_events WHERE id = %s", (log_id,)).fetchone())
    if not event:
        raise HTTPException(404, "Audit event not found")
    return event


@app.get("/api/analytics")
def analytics() -> dict[str, Any]:
    with connect() as conn:
        days = []
        for days_ago in range(6, -1, -1):
            date = (datetime.now(timezone.utc).date() - timedelta(days=days_ago))
            count = conn.execute(
                """SELECT COUNT(*) FROM workflows
                   WHERE (created_at AT TIME ZONE 'UTC')::date = CAST(%s AS date)""",
                (date.isoformat(),),
            ).fetchone()[0]
            days.append({"label": date.strftime("%a"), "value": count})
        by_agent = [
            {
                "label": item["name"].replace(" Agent", ""),
                "value": item["tasks"],
                "color": {
                    "planner": "#5b5bf7",
                    "hr": "#ee77a8",
                    "it": "#4ca6ef",
                    "finance": "#4dbd91",
                    "communication": "#9d7cf5",
                    "approval": "#f0a24f",
                }[item["id"]],
            }
            for item in get_agent_stats(conn)
        ]
        completed = conn.execute(
            "SELECT created_at, updated_at FROM workflows WHERE status = 'completed'"
        ).fetchall()
        resolved = conn.execute(
            "SELECT COUNT(*) FROM workflows WHERE status IN ('completed', 'failed', 'rejected')"
        ).fetchone()[0]
        success_count = conn.execute(
            "SELECT COUNT(*) FROM workflows WHERE status = 'completed'"
        ).fetchone()[0]
        workflow_count = conn.execute("SELECT COUNT(*) FROM workflows").fetchone()[0]
        reviewed = conn.execute(
            "SELECT COUNT(DISTINCT workflow_id) FROM approvals"
        ).fetchone()[0]
        durations = []
        for item in completed:
            try:
                start = datetime.fromisoformat(item["created_at"])
                end = datetime.fromisoformat(item["updated_at"])
                durations.append(max(0, int((end - start).total_seconds())))
            except ValueError:
                continue
        average_seconds = round(sum(durations) / len(durations)) if durations else 0
        avg_duration = (
            f"{average_seconds // 60}m {average_seconds % 60}s"
            if average_seconds
            else "No completed workflows"
        )
        return {
            "volume": days,
            "by_agent": by_agent,
            "health": {
                "success_rate": round(success_count * 100 / resolved, 1) if resolved else 0,
                "avg_duration": avg_duration,
                "human_review_rate": round(reviewed * 100 / workflow_count, 1) if workflow_count else 0,
            },
        }


@app.get("/api/analytics/workflows")
def workflow_analytics() -> dict[str, Any]:
    with connect() as conn:
        return {
            row["status"]: row["count"]
            for row in conn.execute(
                "SELECT status, COUNT(*) AS count FROM workflows GROUP BY status"
            ).fetchall()
        }


@app.get("/api/analytics/agents")
def agent_analytics() -> list[dict[str, Any]]:
    with connect() as conn:
        return get_agent_stats(conn)


def integration_status() -> dict[str, Any]:
    try:
        check_database_health()
        database = {"configured": True, "status": "connected", "provider": "postgresql"}
    except DatabaseConfigurationError:
        database = {"configured": False, "status": "not_configured", "provider": "postgresql"}
    except SQLAlchemyError:
        database = {"configured": True, "status": "unavailable", "provider": "postgresql"}

    gemini_configured = bool(
        os.getenv("GOOGLE_API_KEY", "").strip()
        or os.getenv("GEMINI_API_KEY", "").strip()
    )
    email_configured = all(
        os.getenv(key, "").strip()
        for key in ("SMTP_HOST", "SMTP_PORT", "SMTP_USERNAME", "SMTP_PASSWORD", "EMAIL_FROM")
    )
    redis_url = os.getenv("REDIS_URL", "").strip()
    redis_status = "not_configured"
    if redis_url:
        redis_status = "unavailable"
        parsed = urlparse(redis_url)
        if parsed.hostname and parsed.port:
            try:
                with socket.create_connection((parsed.hostname, parsed.port), timeout=1):
                    redis_status = "reachable"
            except OSError:
                pass

    return {
        "gemini": {
            "configured": gemini_configured,
            "status": "configured_not_tested" if gemini_configured else "not_configured",
            "model": os.getenv("LLM_MODEL", "gemini-2.5-flash"),
            "detail": (
                "Gemini can summarize validated plans; LangGraph retains control of agent routing and approval gates."
                if gemini_configured
                else "Set GOOGLE_API_KEY on the server to enable Gemini plan summaries; LangGraph uses a local planner otherwise."
            ),
        },
        "database": database,
        "email": {
            "configured": email_configured,
            "status": "configured_not_tested" if email_configured else "not_configured",
            "detail": "Notifications remain drafts; SMTP delivery is not implemented.",
        },
        "redis": {
            "configured": bool(redis_url),
            "status": redis_status,
        },
    }


@app.get("/api/integrations/status")
def integrations_status() -> dict[str, Any]:
    return integration_status()


@app.get("/api/settings")
def settings() -> dict[str, Any]:
    with connect() as conn:
        row = conn.execute("SELECT payload, updated_at FROM workspace_settings WHERE id = 1").fetchone()
        preferences = {**DEFAULT_SETTINGS, **(json.loads(row["payload"]) if row else {})}
        integrations = integration_status()
        return {
            "preferences": preferences,
            "updated_at": row["updated_at"] if row else now(),
            "mode": "LangGraph workflow orchestration",
            "llm_provider": (
                "Gemini plan summaries enabled"
                if integrations["gemini"]["configured"]
                else "Gemini not configured; local LangGraph planner active"
            ),
            "external_integrations": [
                {"name": "Gemini", "status": integrations["gemini"]["status"], "detail": integrations["gemini"]["detail"]},
                {"name": "Email", "status": integrations["email"]["status"], "detail": integrations["email"]["detail"]},
                {"name": "Database", "status": integrations["database"]["status"], "detail": integrations["database"]["provider"]},
                {"name": "Redis", "status": integrations["redis"]["status"], "detail": "Optional background processing"},
                {"name": "Payments", "status": "disabled", "detail": "No real payments are supported"},
            ],
        }


@app.put("/api/settings")
def update_settings(payload: SettingsUpdate) -> dict[str, Any]:
    principal = current_user()
    if principal["role"] not in {"manager", "admin"}:
        raise HTTPException(403, "Only a workspace manager can change workspace settings.")
    allowed = set(DEFAULT_SETTINGS)
    updates = {key: value for key, value in payload.preferences.items() if key in allowed}
    if "appearance" in updates and updates["appearance"] not in {"light", "dark"}:
        raise HTTPException(400, "Appearance must be light or dark")
    if "accent" in updates and updates["accent"] not in {"aurora", "ocean", "sunset"}:
        raise HTTPException(400, "Accent must be aurora, ocean, or sunset")
    if "retention_days" in updates:
        try:
            updates["retention_days"] = max(30, min(3650, int(updates["retention_days"])))
        except (TypeError, ValueError) as exc:
            raise HTTPException(400, "Retention days must be a number") from exc
    with connect() as conn:
        row = conn.execute("SELECT payload FROM workspace_settings WHERE id = 1").fetchone()
        current = {**DEFAULT_SETTINGS, **(json.loads(row["payload"]) if row else {})}
        current.update(updates)
        updated_at = now()
        conn.execute(
            """INSERT INTO workspace_settings (id, payload, updated_at)
               VALUES (1, %s, %s)
               ON CONFLICT (id) DO UPDATE
               SET payload = EXCLUDED.payload, updated_at = EXCLUDED.updated_at""",
            (json.dumps(current), updated_at),
        )
        audit(conn, None, "human", principal["name"], "settings.updated", "Workspace preferences were updated.")
        integrations = integration_status()
        return {
            "preferences": current,
            "updated_at": updated_at,
            "mode": "LangGraph workflow orchestration",
            "llm_provider": (
                "Gemini plan summaries enabled"
                if integrations["gemini"]["configured"]
                else "Gemini not configured; local LangGraph planner active"
            ),
            "external_integrations": [
                {"name": "Gemini", "status": integrations["gemini"]["status"], "detail": integrations["gemini"]["detail"]},
                {"name": "Email", "status": integrations["email"]["status"], "detail": integrations["email"]["detail"]},
                {"name": "Database", "status": integrations["database"]["status"], "detail": integrations["database"]["provider"]},
                {"name": "Redis", "status": integrations["redis"]["status"], "detail": "Optional background processing"},
                {"name": "Payments", "status": "disabled", "detail": "No real payments are supported"},
            ],
        }


if DIST.exists():
    assets = DIST / "assets"
    if assets.exists():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")


@app.get("/{full_path:path}")
def frontend(full_path: str):
    if full_path == "api" or full_path.startswith("api/"):
        raise HTTPException(404, "API endpoint not found")
    if full_path == "manus-routes.json":
        path = DIST / "manus-routes.json"
        if path.exists():
            return FileResponse(path)
        return JSONResponse({"routes": []})
    index = DIST / "index.html"
    if index.exists():
        return FileResponse(index)
    return JSONResponse({"status": "building", "message": "Run npm run build before starting the API."}, status_code=503)
