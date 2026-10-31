from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Callable

from sqlalchemy.exc import SQLAlchemyError

from api.database import DatabaseConnection, get_connection
from api.finance import analyze_invoice


@dataclass(frozen=True)
class AgentTask:
    id: str
    workflow_id: str
    agent_id: str
    action: str
    input_data: dict[str, Any]


@dataclass(frozen=True)
class AgentContext:
    db_path: Path | None
    actor_name: str


AgentHandler = Callable[[DatabaseConnection, AgentTask, AgentContext], dict[str, Any]]


class AgentConflictError(ValueError):
    pass


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id(prefix: str) -> str:
    import uuid

    return f"{prefix}_{uuid.uuid4().hex[:10]}"


def _audit(
    conn: DatabaseConnection,
    task: AgentTask,
    action: str,
    detail: str,
    status: str = "success",
) -> None:
    conn.execute(
        "INSERT INTO audit_events VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
        (
            _new_id("evt"),
            task.workflow_id,
            "agent",
            task.agent_id,
            action,
            detail,
            status,
            _now(),
        ),
    )


def _employee_data(
    conn: DatabaseConnection, task: AgentTask, context: AgentContext
) -> dict[str, Any]:
    _ = context
    request_data = task.input_data
    name = str(request_data.get("name", "")).strip()
    department = str(request_data.get("department", "")).strip()
    joining_date = str(request_data.get("joining_date", "")).strip()
    email = str(request_data.get("email", "")).strip().lower() or None

    if len(name) < 2 or len(department) < 2 or not joining_date:
        raise ValueError("Employee name, department, and joining date are required.")
    try:
        datetime.fromisoformat(joining_date)
    except ValueError as exc:
        raise ValueError("Joining date must be a valid ISO date.") from exc
    if email and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise ValueError("Employee email address is invalid.")
    if email and conn.execute(
        "SELECT 1 FROM employees WHERE lower(email) = lower(%s)", (email,)
    ).fetchone():
        raise AgentConflictError("An employee with this email address already exists.")

    employee_id = _new_id("emp")
    conn.execute(
        """INSERT INTO employees
           (id, name, department, title, joining_date, status, workflow_id, created_at, email)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
        (
            employee_id,
            name,
            department,
            str(request_data.get("title") or "Not specified"),
            joining_date,
            "Onboarding",
            task.workflow_id,
            _now(),
            email,
        ),
    )
    _audit(conn, task, "employee.created", f"Created employee record {employee_id}.")
    return {
        "employee_id": employee_id,
        "employee_name": name,
        "department": department,
        "email": email,
    }


def _it_requests(
    conn: DatabaseConnection, task: AgentTask, context: AgentContext
) -> dict[str, Any]:
    employee_id = str(task.input_data.get("employee_id", "")).strip()
    employee = conn.execute(
        "SELECT id, name, department FROM employees WHERE id = %s", (employee_id,)
    ).fetchone()
    if not employee:
        raise ValueError("IT requests require an existing employee record.")

    access = task.input_data.get("access")
    equipment = str(task.input_data.get("equipment", "")).strip()
    request_types = [
        (f"Software access: {item}", f"Request simulated {item} access for {employee['name']}.")
        for item in access
        if isinstance(item, str) and item.strip()
    ] if isinstance(access, list) else []
    if equipment:
        request_types.append(
            (f"Equipment: {equipment}", f"Request simulated {equipment} equipment for {employee['name']}.")
        )
    if not request_types:
        request_types = [
            ("Enterprise account", f"Create an account request for {employee['name']}."),
            ("Laptop", f"Prepare a laptop request for {employee['name']}."),
        ]
    request_ids: list[str] = []
    for request_type, description in request_types:
        existing = conn.execute(
            """SELECT id FROM it_requests
               WHERE workflow_id = %s AND employee_id = %s AND request_type = %s""",
            (task.workflow_id, employee_id, request_type),
        ).fetchone()
        if existing:
            request_ids.append(existing["id"])
            continue
        request_id = _new_id("it")
        conn.execute(
            """INSERT INTO it_requests
               (id, employee_name, request_type, description, status, created_by,
                created_at, employee_id, workflow_id)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (
                request_id,
                employee["name"],
                request_type,
                description,
                "pending_approval",
                context.actor_name,
                _now(),
                employee_id,
                task.workflow_id,
            ),
        )
        request_ids.append(request_id)

    _audit(
        conn,
        task,
        "it.requests_created",
        f"Created {len(request_ids)} persisted IT requests for employee {employee_id}; external provisioning has not occurred.",
        "pending",
    )
    return {
        "employee_id": employee_id,
        "request_ids": request_ids,
        "external_provisioning": "not_performed",
    }


def _finance_invoice(
    conn: DatabaseConnection, task: AgentTask, context: AgentContext
) -> dict[str, Any]:
    request_data = task.input_data
    vendor = str(request_data.get("vendor", "")).strip()
    invoice_number = str(request_data.get("invoice_number", "")).strip()
    currency = str(request_data.get("currency", "INR")).strip().upper()
    try:
        amount = Decimal(str(request_data.get("amount", "")).replace(",", ""))
    except InvalidOperation as exc:
        raise ValueError("Invoice amount must be a valid positive number.") from exc
    if not vendor or not invoice_number or not amount.is_finite() or amount <= 0:
        raise ValueError("Invoice vendor, number, and positive amount are required.")
    if amount.as_tuple().exponent < -2:
        raise ValueError("Invoice amount cannot have more than two decimal places.")

    existing = conn.execute(
        """SELECT id FROM finance_reviews
           WHERE lower(vendor) = lower(%s) AND lower(invoice_number) = lower(%s)""",
        (vendor, invoice_number),
    ).fetchone()
    if existing:
        raise AgentConflictError("An invoice with this vendor and invoice number is already recorded.")

    analysis = analyze_invoice(
        request_data,
        require_dates=bool(request_data.get("invoice_date") or request_data.get("due_date")),
    )
    if not analysis["valid"]:
        raise ValueError("; ".join(analysis["errors"]))

    invoice_id = _new_id("inv")
    payment_request_id = _new_id("pay")
    created_at = _now()
    conn.execute(
        """INSERT INTO finance_reviews
           (id, vendor, invoice_number, amount, status, created_by, created_at,
            vendor_email, invoice_date, due_date, gst_percentage, tax_amount,
            total_amount, currency, expense_category, description, attachment_path,
            analysis)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
        (
            invoice_id,
            vendor,
            invoice_number,
            format(amount, "f"),
            "pending_approval",
            context.actor_name,
            created_at,
            request_data.get("vendor_email") or None,
            request_data.get("invoice_date"),
            request_data.get("due_date"),
            analysis["gst_percentage"],
            analysis["tax_amount"],
            analysis["total_amount"],
            currency,
            analysis["categorized_expense"],
            request_data.get("description") or None,
            request_data.get("attachment_path") or None,
            json.dumps(analysis),
        ),
    )
    conn.execute(
        """INSERT INTO payment_requests
           (id, invoice_id, workflow_id, amount, currency, status, created_at)
           VALUES (%s, %s, %s, %s, %s, %s, %s)""",
        (
            payment_request_id,
            invoice_id,
            task.workflow_id,
            analysis["total_amount"],
            currency,
            "pending_approval",
            created_at,
        ),
    )
    _audit(
        conn,
        task,
        "invoice.validated",
        f"Created invoice {invoice_id} and payment request {payment_request_id}; no payment was executed.",
        "pending",
    )
    return {
        "invoice_id": invoice_id,
        "payment_request_id": payment_request_id,
        "invoice_number": invoice_number,
        "amount": format(amount, "f"),
        "currency": currency,
        "analysis": analysis,
        "payment_executed": False,
    }


def _approval_request(
    conn: DatabaseConnection, task: AgentTask, context: AgentContext
) -> dict[str, Any]:
    existing = conn.execute(
        "SELECT id FROM approvals WHERE workflow_id = %s AND status = 'pending'",
        (task.workflow_id,),
    ).fetchone()
    if existing:
        return {"approval_id": existing["id"], "status": "pending"}

    approval_info = task.input_data.get("approval_info", {})
    approval_id = _new_id("apr")
    conn.execute(
        """INSERT INTO approvals
           (id, workflow_id, title, action, agent_id, requester, reason,
            information, risk, status, requested_at, decided_at, decided_by, decision_reason)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NULL, NULL, NULL)""",
        (
            approval_id,
            task.workflow_id,
            str(task.input_data["approval_title"]),
            str(task.input_data["approval_action"]),
            str(task.input_data["protected_agent"]),
            context.actor_name,
            str(task.input_data["approval_reason"]),
            json.dumps(approval_info),
            "medium",
            "pending",
            _now(),
        ),
    )
    _audit(conn, task, "approval.requested", "Created a human approval checkpoint.", "pending")
    return {"approval_id": approval_id, "status": "pending"}


def _notification(
    conn: DatabaseConnection, task: AgentTask, context: AgentContext
) -> dict[str, Any]:
    _ = context
    workflow = conn.execute(
        "SELECT * FROM workflows WHERE id = %s", (task.workflow_id,)
    ).fetchone()
    if workflow is None:
        raise ValueError("Workflow not found for communication task.")
    workflow_context = json.loads(workflow["shared_context"] or "{}")
    request_data = workflow_context.get("request_data", {})
    workflow_type = workflow_context.get("workflow_type")
    if workflow_type == "employee_onboarding":
        employee = conn.execute(
            "SELECT email FROM employees WHERE workflow_id = %s ORDER BY created_at DESC LIMIT 1",
            (task.workflow_id,),
        ).fetchone()
        recipient = employee["email"] if employee and employee["email"] else workflow["employee_name"]
        subject = f"Welcome to {workflow['department']}, {workflow['employee_name']}"
        body = (
            f"Hello {workflow['employee_name']},\n\n"
            f"Welcome to {workflow['department']}. Your onboarding record is ready for "
            f"{workflow['joining_date']}. Account and equipment requests are recorded "
            "and await simulated provisioning.\n\nThis is a draft preview. No email was sent."
        )
    elif workflow_type == "it_access_request":
        recipient = workflow["created_by"]
        subject = f"IT access request update for {request_data.get('employee_name', 'employee')}"
        requested = ", ".join(request_data.get("access", []))
        equipment = request_data.get("equipment") or "none"
        body = (
            f"The IT access request for {request_data.get('employee_name', 'the employee')} "
            f"was reviewed. Requested access: {requested or 'none'}. Equipment: {equipment}. "
            "Provisioning remains simulated; no external systems were changed.\n\n"
            "This is a draft preview. No email was sent."
        )
    else:
        recipient = workflow["created_by"]
        subject = f"Invoice {request_data.get('invoice_number', '')} review update"
        body = (
            f"The invoice from {request_data.get('vendor', 'the vendor')} was reviewed. "
            "The payment request is recorded as simulated; no money was transferred.\n\n"
            "This is a draft preview. No email was sent."
        )

    notification_id = _new_id("msg")
    conn.execute(
        "INSERT INTO notifications VALUES (%s, %s, %s, %s, %s, %s, %s)",
        (
            notification_id,
            task.workflow_id,
            recipient,
            subject,
            body,
            "draft_simulated",
            _now(),
        ),
    )
    _audit(
        conn,
        task,
        "notification.draft_created",
        f"Stored notification draft {notification_id}; no email was sent.",
    )
    return {
        "notification_id": notification_id,
        "recipient": recipient,
        "status": "draft_simulated",
        "email_sent": False,
    }


def _validate_plan(
    conn: DatabaseConnection, task: AgentTask, context: AgentContext
) -> dict[str, Any]:
    _ = (conn, context)
    workflow_type = task.input_data.get("workflow_type")
    if workflow_type not in {
        "employee_onboarding",
        "invoice_processing",
        "it_access_request",
    }:
        raise ValueError("Planner received an unsupported workflow type.")
    return {"workflow_type": workflow_type, "validated": True}


ACTION_REGISTRY: dict[str, tuple[str, AgentHandler]] = {
    "planner.validate_plan": ("planner", _validate_plan),
    "hr.create_employee": ("hr", _employee_data),
    "it.create_requests": ("it", _it_requests),
    "finance.process_invoice": ("finance", _finance_invoice),
    "approval.create_request": ("approval", _approval_request),
    "communication.create_notification": ("communication", _notification),
}


def validate_execution_plan(tasks: list[tuple[Any, ...]]) -> None:
    agent_by_action = {
        action: owner for action, (owner, _) in ACTION_REGISTRY.items()
    }
    seen_agents: set[str] = set()
    for spec in tasks:
        agent_id, dependency, action = spec[0], spec[7], spec[8]
        owner = agent_by_action.get(action)
        if owner is None or owner != agent_id:
            raise ValueError(f"Planner selected an unregistered action: {action!r}.")
        if dependency and dependency not in seen_agents:
            raise ValueError(f"Planner task {agent_id!r} has an unresolved dependency.")
        seen_agents.add(agent_id)


def execute_task(
    db_path: Path | None, task_id: str, actor_name: str
) -> dict[str, Any]:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM tasks WHERE id = %s", (task_id,)).fetchone()
        if row is None:
            raise ValueError("Agent task not found.")
        if row["status"] in {"completed", "waiting_approval"} and row["result"]:
            return json.loads(row["execution_result"] or "{}")
        task = AgentTask(
            id=row["id"],
            workflow_id=row["workflow_id"],
            agent_id=row["agent_id"],
            action=row["action"],
            input_data=json.loads(row["input_data"] or "{}"),
        )
        workflow_row = conn.execute(
            "SELECT shared_context FROM workflows WHERE id = %s",
            (task.workflow_id,),
        ).fetchone()
        if workflow_row is None:
            raise ValueError("Workflow not found for agent task.")
        workflow_context = json.loads(workflow_row["shared_context"] or "{}")
        if task.agent_id == "it":
            employee_result = workflow_context.get("agent_results", {}).get("hr", {})
            employee_id = employee_result.get("employee_id") or task.input_data.get(
                "employee_id"
            )
            if not employee_id:
                raise ValueError("IT task cannot run before HR returns an employee ID.")
            task = AgentTask(
                task.id,
                task.workflow_id,
                task.agent_id,
                task.action,
                {**task.input_data, "employee_id": employee_id},
            )
        registration = ACTION_REGISTRY.get(task.action)
        if not registration or registration[0] != task.agent_id:
            raise ValueError(f"Unsupported action {task.action!r} for {task.agent_id!r}.")

    handler = registration[1]
    try:
        with get_connection() as conn:
            task_row = conn.execute(
                "SELECT title, status, result, execution_result FROM tasks "
                "WHERE id = %s FOR UPDATE",
                (task_id,),
            ).fetchone()
            if task_row is None:
                raise ValueError("Agent task disappeared before execution.")
            if task_row["status"] in {"completed", "waiting_approval"} and task_row["result"]:
                return json.loads(task_row["execution_result"] or "{}")
            if task_row["status"] not in {"queued", "failed"}:
                raise ValueError("Agent task is not in an executable state.")
            started_at = _now()
            conn.execute(
                "UPDATE tasks SET status = 'running', started_at = %s, error_message = NULL "
                "WHERE id = %s",
                (started_at, task_id),
            )
            conn.execute(
                "INSERT INTO audit_events VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
                (
                    _new_id("evt"),
                    task.workflow_id,
                    "agent",
                    task.agent_id,
                    "task.started",
                    f"Started registered action {task.action}: {task_row['title']}.",
                    "running",
                    started_at,
                ),
            )
            result = handler(conn, task, AgentContext(db_path, actor_name))
            next_status = (
                "waiting_approval"
                if task.agent_id in {"it", "approval"}
                else "completed"
            )
            completed_at = _now()
            conn.execute(
                """UPDATE tasks
                   SET status = %s, result = %s, execution_result = %s, completed_at = %s
                   WHERE id = %s""",
                (
                    next_status,
                    json.dumps(result, sort_keys=True),
                    json.dumps(result, sort_keys=True),
                    completed_at,
                    task_id,
                ),
            )
            workflow_row = conn.execute(
                "SELECT shared_context FROM workflows WHERE id = %s",
                (task.workflow_id,),
            ).fetchone()
            workflow_context = json.loads(workflow_row["shared_context"] or "{}")
            workflow_context.setdefault("agent_results", {})[task.agent_id] = result
            conn.execute(
                "UPDATE workflows SET shared_context = %s, updated_at = %s WHERE id = %s",
                (json.dumps(workflow_context), completed_at, task.workflow_id),
            )
            if task.agent_id == "approval":
                conn.execute(
                    "UPDATE workflows SET status = 'waiting_approval' WHERE id = %s",
                    (task.workflow_id,),
                )
            return result
    except (SQLAlchemyError, ValueError, KeyError) as exc:
        failed_at = _now()
        error_message = (
            "Database operation failed."
            if isinstance(exc, SQLAlchemyError)
            else str(exc)
        )
        with get_connection() as conn:
            conn.execute(
                """UPDATE tasks
                   SET status = 'failed', error_message = %s, completed_at = %s
                   WHERE id = %s""",
                (error_message, failed_at, task_id),
            )
            conn.execute(
                """UPDATE workflows SET status = 'failed', updated_at = %s, final_result = %s
                   WHERE id = %s""",
                (
                    failed_at,
                    f"{task.agent_id} task failed: {error_message}",
                    task.workflow_id,
                ),
            )
            conn.execute(
                "INSERT INTO audit_events VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
                (
                    _new_id("evt"),
                    task.workflow_id,
                    "agent",
                    task.agent_id,
                    "task.failed",
                    f"Registered action {task.action} failed: {error_message}",
                    "failed",
                    failed_at,
                ),
            )
        raise


def finish_approval(
    db_path: Path | None, workflow_id: str, decision: str, actor_name: str, reason: str
) -> None:
    with get_connection() as conn:
        workflow = conn.execute(
            "SELECT shared_context FROM workflows WHERE id = %s", (workflow_id,)
        ).fetchone()
        if workflow is None:
            raise ValueError("Workflow not found.")
        workflow_context = json.loads(workflow["shared_context"] or "{}")
        agent_results = workflow_context.get("agent_results", {})
        it_result = agent_results.get("it", {})
        finance_result = agent_results.get("finance", {})
        completed_at = _now()
        conn.execute(
            """UPDATE tasks SET status = %s, result = %s, completed_at = %s
               WHERE workflow_id = %s AND agent_id = 'approval'""",
            (
                "completed" if decision == "approved" else "rejected",
                f"Human decision: {decision}",
                completed_at,
                workflow_id,
            ),
        )
        if decision == "approved":
            conn.execute(
                """UPDATE tasks SET status = 'completed', result = %s, completed_at = %s
                   WHERE workflow_id = %s AND agent_id = 'it' AND status = 'waiting_approval'""",
                (
                    "Internal access and equipment requests approved for simulated provisioning; no external changes were made.",
                    completed_at,
                    workflow_id,
                ),
            )
            for request_id in it_result.get("request_ids", []):
                conn.execute(
                    "UPDATE it_requests SET status = 'approved_simulated' WHERE id = %s",
                    (request_id,),
                )
            if finance_result.get("payment_request_id"):
                conn.execute(
                    "UPDATE payment_requests SET status = 'approved_simulated' WHERE id = %s",
                    (finance_result["payment_request_id"],),
                )
            if finance_result.get("invoice_id"):
                conn.execute(
                    "UPDATE finance_reviews SET status = 'approved_simulated' WHERE id = %s",
                    (finance_result["invoice_id"],),
                )
            conn.execute(
                "UPDATE workflows SET status = 'running', updated_at = %s WHERE id = %s",
                (completed_at, workflow_id),
            )
        else:
            conn.execute(
                """UPDATE tasks SET status = 'rejected',
                   result = 'Protected action blocked because approval was rejected.',
                   completed_at = %s WHERE workflow_id = %s AND agent_id = 'it'
                   AND status = 'waiting_approval'""",
                (completed_at, workflow_id),
            )
            for request_id in it_result.get("request_ids", []):
                conn.execute(
                    "UPDATE it_requests SET status = 'rejected' WHERE id = %s",
                    (request_id,),
                )
            if finance_result.get("payment_request_id"):
                conn.execute(
                    "UPDATE payment_requests SET status = 'rejected' WHERE id = %s",
                    (finance_result["payment_request_id"],),
                )
            if finance_result.get("invoice_id"):
                conn.execute(
                    "UPDATE finance_reviews SET status = 'rejected' WHERE id = %s",
                    (finance_result["invoice_id"],),
                )
            conn.execute(
                """UPDATE workflows SET status = 'rejected', updated_at = %s, final_result = %s
                   WHERE id = %s""",
                (
                    completed_at,
                    "Sensitive action rejected; protected provisioning or payment action was not executed.",
                    workflow_id,
                ),
            )
        conn.execute(
            "INSERT INTO audit_events VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
            (
                _new_id("evt"),
                workflow_id,
                "human",
                actor_name,
                f"approval.{decision}",
                reason,
                decision,
                completed_at,
            ),
        )
