from __future__ import annotations

import json
import os
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, TypedDict

import httpx
import psycopg
from psycopg.rows import dict_row
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, interrupt

from api.agents import execute_task, finish_approval, validate_execution_plan
from api.database import database_url, get_connection


class CheckpointPersistenceError(RuntimeError):
    pass


@contextmanager
def _postgres_checkpointer():
    connection_string = database_url().set(drivername="postgresql").render_as_string(
        hide_password=False
    )
    try:
        with psycopg.connect(
            connection_string,
            autocommit=True,
            prepare_threshold=None,
            row_factory=dict_row,
        ) as connection:
            yield PostgresSaver(connection)
    except psycopg.Error as exc:
        raise CheckpointPersistenceError(
            "LangGraph PostgreSQL checkpoint storage is unavailable."
        ) from exc


def initialize_checkpointer() -> None:
    with _postgres_checkpointer() as checkpointer:
        checkpointer.setup()


TaskSpec = tuple[
    str, str, str, str, int, int, str | None, str | None, str, dict[str, Any]
]


class WorkflowState(TypedDict, total=False):
    parsed: dict[str, Any]
    tasks: list[TaskSpec]
    planner_summary: str
    mode: str
    warning: str | None
    approval_title: str
    approval_action: str
    approval_reason: str
    approval_info: dict[str, Any]


def _append(state: WorkflowState, task: TaskSpec) -> list[TaskSpec]:
    return [*state.get("tasks", []), task]


def _planner(state: WorkflowState) -> dict[str, Any]:
    parsed = state["parsed"]
    workflow_type = parsed["workflow_type"]
    summary = (
        "Planner validated the employee onboarding request and sequenced HR, IT, approval, and communication work."
        if workflow_type == "employee_onboarding"
        else "Planner validated the invoice request and sequenced finance, approval, and communication work."
    )
    mode = "rule_based_demo"
    warning = None

    api_key = os.getenv("GOOGLE_API_KEY", "").strip() or os.getenv("GEMINI_API_KEY", "").strip()
    if api_key:
        try:
            from google import genai
            from google.genai import types
            from google.genai.errors import APIError

            client = genai.Client(api_key=api_key)
            response = client.models.generate_content(
                model=os.getenv("LLM_MODEL", "gemini-2.5-flash"),
                contents=(
                    "Summarize this validated enterprise workflow in one concise sentence. "
                    "Do not add tasks, make decisions, or suggest executing external actions. "
                    f"Workflow type: {workflow_type}. Department: {parsed.get('department', 'Finance')}."
                ),
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema={
                        "type": "OBJECT",
                        "properties": {"summary": {"type": "STRING"}},
                        "required": ["summary"],
                    },
                ),
            )
            result = json.loads(response.text or "{}")
            model_summary = result.get("summary")
            if isinstance(model_summary, str) and model_summary.strip():
                summary = model_summary.strip()[:500]
                mode = "langgraph_gemini"
            else:
                warning = "Gemini returned no planner summary; the validated local plan was used."
        except (APIError, httpx.HTTPError, TimeoutError, OSError, json.JSONDecodeError) as exc:
            warning = f"Gemini planner unavailable ({type(exc).__name__}); the validated local plan was used."

    return {
        "tasks": [
            (
                "planner",
                "Create execution plan",
                summary,
                "completed",
                1,
                0,
                "Validated plan generated",
                None,
                "planner.validate_plan",
                parsed,
            )
        ],
        "planner_summary": summary,
        "mode": mode,
        "warning": warning,
    }


def _route(state: WorkflowState) -> str:
    if state["parsed"]["workflow_type"] == "employee_onboarding":
        return "hr"
    return "finance"


def _hr(state: WorkflowState) -> dict[str, Any]:
    parsed = state["parsed"]
    return {
        "tasks": _append(
            state,
            (
                "hr",
                "Create employee record",
                f"Validate and persist {parsed['name']}'s onboarding record.",
                "queued",
                2,
                0,
                None,
                "planner",
                "hr.create_employee",
                parsed,
            ),
        )
    }


def _it(state: WorkflowState) -> dict[str, Any]:
    return {
        "tasks": _append(
            state,
            (
                "it",
                "Create access & equipment requests",
                "Create persisted internal account and equipment requests for the employee.",
                "queued",
                3,
                0,
                None,
                "hr",
                "it.create_requests",
                {},
            ),
        )
    }


def _finance(state: WorkflowState) -> dict[str, Any]:
    parsed = state["parsed"]
    return {
        "tasks": _append(
            state,
            (
                "finance",
                "Validate invoice",
                "Validate invoice and persist a payment request.",
                "queued",
                2,
                0,
                None,
                "planner",
                "finance.process_invoice",
                parsed,
            ),
        )
    }


def _approval(state: WorkflowState) -> dict[str, Any]:
    parsed = state["parsed"]
    onboarding = parsed["workflow_type"] == "employee_onboarding"
    it_access = parsed["workflow_type"] == "it_access_request"
    approval_title = (
        "Approve IT access & equipment"
        if onboarding or it_access
        else f"Approve invoice {parsed['invoice_number']}"
    )
    approval_action = (
        "Approve internal account and equipment requests for simulated provisioning"
        if onboarding
        else "Approve requested employee access and equipment for simulated provisioning"
        if it_access
        else f"Request human approval for invoice payment of {parsed.get('total_amount', parsed['amount'])} {parsed['currency']}"
    )
    approval_reason = (
        "External access and equipment requests require a human checkpoint."
        if onboarding
        else "Employee access and equipment requests require a human checkpoint."
        if it_access
        else "Financial payment requests require a human decision; no payment is executed."
    )
    approval_info = (
        {
            "employee": parsed["name"],
            "department": parsed["department"],
            "joining_date": parsed["joining_date"],
            "access": ["Google Workspace", "GitHub Enterprise", "Linear"],
            "equipment": "MacBook Pro 14-inch",
            "mode": "simulated only",
        }
        if onboarding
        else {
            "employee": parsed.get("employee_name", ""),
            "department": parsed.get("department", ""),
            "access": parsed.get("access", []),
            "equipment": parsed.get("equipment", ""),
            "mode": "simulated only",
        }
        if it_access
        else {
            "invoice_number": parsed["invoice_number"],
            "vendor": parsed["vendor"],
            "amount": parsed["amount"],
            "invoice_date": parsed.get("invoice_date"),
            "due_date": parsed.get("due_date"),
            "gst_percentage": parsed.get("gst_percentage"),
            "tax_amount": parsed.get("tax_amount"),
            "total_amount": parsed.get("total_amount", parsed["amount"]),
            "expense_category": parsed.get("expense_category"),
            "vendor_email": parsed.get("vendor_email"),
            "analysis_warnings": parsed.get("analysis_warnings", []),
            "currency": parsed["currency"],
            "mode": "simulated only",
        }
    )
    task = (
        "approval",
        "Manager approval checkpoint",
        "Route the protected action to an authorized human decision-maker.",
        "queued",
        4 if onboarding else 3,
        1,
        None,
        "it" if onboarding or it_access else "finance",
        "approval.create_request",
        {
            "approval_title": approval_title,
            "approval_action": approval_action,
            "approval_reason": approval_reason,
            "approval_info": approval_info,
            "protected_agent": "it" if onboarding or it_access else "finance",
        },
    )
    return {
        "tasks": _append(state, task),
        "approval_title": approval_title,
        "approval_action": approval_action,
        "approval_reason": approval_reason,
        "approval_info": approval_info,
    }


def _communication(state: WorkflowState) -> dict[str, Any]:
    parsed = state["parsed"]
    onboarding = parsed["workflow_type"] in {
        "employee_onboarding",
        "it_access_request",
    }
    return {
        "tasks": _append(
            state,
            (
                "communication",
                "Prepare welcome email" if onboarding else "Notify requester",
                "Prepare and persist a message draft after the approval decision.",
                "queued",
                5 if onboarding else 4,
                0,
                None,
                "approval",
                "communication.create_notification",
                {},
            ),
        )
    }


def _build_planner_graph():
    graph = StateGraph(WorkflowState)
    graph.add_node("planner", _planner)
    graph.add_node("hr", _hr)
    graph.add_node("it", _it)
    graph.add_node("finance", _finance)
    graph.add_node("approval", _approval)
    graph.add_node("communication", _communication)
    graph.add_edge(START, "planner")
    graph.add_conditional_edges("planner", _route, {"hr": "hr", "finance": "finance"})
    graph.add_edge("hr", "it")
    graph.add_edge("it", "approval")
    graph.add_edge("finance", "approval")
    graph.add_edge("approval", "communication")
    graph.add_edge("communication", END)
    return graph.compile()


_planner_graph = _build_planner_graph()


def create_workflow_plan(parsed: dict[str, Any]) -> WorkflowState:
    plan = _planner_graph.invoke({"parsed": parsed, "tasks": []})
    task_agents = [task[0] for task in plan["tasks"]]
    if parsed["workflow_type"] == "employee_onboarding":
        expected = ["planner", "hr", "it", "approval", "communication"]
    elif parsed["workflow_type"] == "invoice_processing":
        expected = ["planner", "finance", "approval", "communication"]
    else:
        raise ValueError(f"Unsupported workflow type: {parsed['workflow_type']}")
    if task_agents != expected:
        raise ValueError("Planner generated a plan with an invalid agent sequence.")
    validate_execution_plan(plan["tasks"])
    return plan


class ExecutionState(TypedDict, total=False):
    workflow_id: str
    actor_name: str
    user_id: str
    workflow_type: str
    original_request: str
    execution_plan: list[dict[str, Any]]
    tasks: list[dict[str, Any]]
    assigned_agents: list[str]
    shared_context: dict[str, Any]
    completed_tasks: list[str]
    failed_tasks: list[str]
    pending_approvals: list[str]
    current_status: str
    final_result: str | None
    approval_result: dict[str, Any]
    decision: str


def _refresh_state(state: ExecutionState) -> dict[str, Any]:
    with get_connection() as conn:
        workflow = conn.execute(
            "SELECT request, status, final_result, shared_context FROM workflows WHERE id = %s",
            (state["workflow_id"],),
        ).fetchone()
        if workflow is None:
            raise ValueError("Workflow not found while updating agent state.")
        task_rows = conn.execute(
            "SELECT * FROM tasks WHERE workflow_id = %s ORDER BY sort_order",
            (state["workflow_id"],),
        ).fetchall()
        approval_rows = conn.execute(
            "SELECT id FROM approvals WHERE workflow_id = %s AND status = 'pending'",
            (state["workflow_id"],),
        ).fetchall()
    tasks = []
    for row in task_rows:
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
        tasks.append(task)
    return {
        "workflow_id": state["workflow_id"],
        "actor_name": state["actor_name"],
        "user_id": state.get("user_id", ""),
        "workflow_type": state["workflow_type"],
        "original_request": workflow["request"],
        "execution_plan": [
            {
                "task_id": task["task_id"],
                "workflow_id": task["workflow_id"],
                "task_name": task["task_name"],
                "assigned_agent": task["assigned_agent"],
                "action": task["action"],
                "input_data": task["input_data"],
                "dependencies": task["dependencies"],
                "priority": task["priority"],
                "status": task["status"],
                "created_at": task["created_at"],
                "completed_at": task["completed_at"],
                "execution_result": task["execution_result"],
                "error_message": task["error_message"],
            }
            for task in tasks
        ],
        "tasks": tasks,
        "assigned_agents": list(dict.fromkeys(task["assigned_agent"] for task in tasks)),
        "shared_context": json.loads(workflow["shared_context"] or "{}"),
        "completed_tasks": [
            task["id"] for task in tasks if task["status"] == "completed"
        ],
        "failed_tasks": [
            task["id"] for task in tasks if task["status"] == "failed"
        ],
        "pending_approvals": [row["id"] for row in approval_rows],
        "current_status": workflow["status"],
        "final_result": workflow["final_result"],
        "decision": state.get("decision", ""),
    }


def _find_task(state: ExecutionState, agent_id: str) -> str:
    with get_connection() as conn:
        row = conn.execute(
            """SELECT id FROM tasks
               WHERE workflow_id = %s AND agent_id = %s
               ORDER BY sort_order LIMIT 1""",
            (state["workflow_id"], agent_id),
        ).fetchone()
    if row is None:
        raise ValueError(f"No {agent_id} task exists for this workflow.")
    return str(row["id"])


def _run_agent(state: ExecutionState, agent_id: str) -> dict[str, Any]:
    result = execute_task(
        None,
        _find_task(state, agent_id),
        state["actor_name"],
    )
    return {**_refresh_state(state), f"{agent_id}_result": result}


def _run_hr(state: ExecutionState) -> dict[str, Any]:
    return _run_agent(state, "hr")


def _run_it(state: ExecutionState) -> dict[str, Any]:
    return _run_agent(state, "it")


def _run_finance(state: ExecutionState) -> dict[str, Any]:
    return _run_agent(state, "finance")


def _run_approval_request(state: ExecutionState) -> dict[str, Any]:
    approval_result = execute_task(
        None,
        _find_task(state, "approval"),
        state["actor_name"],
    )
    refreshed = _refresh_state(state)
    return {**refreshed, "approval_result": approval_result}


def _run_approval(state: ExecutionState) -> dict[str, Any]:
    approval_result = state.get("approval_result")
    if not approval_result:
        raise ValueError("Approval task did not return a persisted approval record.")
    decision = interrupt(
        {
            "workflow_id": state["workflow_id"],
            "approval_id": approval_result["approval_id"],
            "status": "waiting_approval",
        }
    )
    if not isinstance(decision, dict) or decision.get("decision") not in {
        "approved",
        "rejected",
    }:
        raise ValueError("Approval resume requires an approved or rejected decision.")
    finish_approval(
        None,
        state["workflow_id"],
        decision["decision"],
        decision["actor_name"],
        decision["reason"],
    )
    refreshed = _refresh_state(state)
    return {**refreshed, "decision": decision["decision"]}


def _run_communication(state: ExecutionState) -> dict[str, Any]:
    result = _run_agent(state, "communication")
    with get_connection() as conn:
        conn.execute(
            """UPDATE workflows SET status = 'completed', updated_at = %s,
               final_result = %s WHERE id = %s""",
            (
                datetime.now(timezone.utc).isoformat(),
                "Workflow completed. External provisioning, payment, and email delivery were not performed.",
                state["workflow_id"],
            ),
        )
    return {**_refresh_state(state), **result}


def _approval_route(state: ExecutionState) -> str:
    return "communication" if state.get("decision") == "approved" else END


def _build_execution_graph(checkpointer: PostgresSaver):
    graph = StateGraph(ExecutionState)
    graph.add_node("hr", _run_hr)
    graph.add_node("it", _run_it)
    graph.add_node("finance", _run_finance)
    graph.add_node("approval_request", _run_approval_request)
    graph.add_node("approval_interrupt", _run_approval)
    graph.add_node("communication", _run_communication)
    graph.add_conditional_edges(
        START,
        lambda state: (
            "hr"
            if state["workflow_type"] == "employee_onboarding"
            else "it"
            if state["workflow_type"] == "it_access_request"
            else "finance"
        ),
        {"hr": "hr", "it": "it", "finance": "finance"},
    )
    graph.add_edge("hr", "it")
    graph.add_edge("it", "approval_request")
    graph.add_edge("finance", "approval_request")
    graph.add_edge("approval_request", "approval_interrupt")
    graph.add_conditional_edges(
        "approval_interrupt",
        _approval_route,
        {"communication": "communication", END: END},
    )
    graph.add_edge("communication", END)
    return graph.compile(checkpointer=checkpointer)


def run_workflow_execution(
    workflow_id: str,
    actor_name: str,
    workflow_type: str,
    user_id: str = "",
) -> None:
    with _postgres_checkpointer() as checkpointer:
        graph = _build_execution_graph(checkpointer)
        try:
            graph.invoke(
                _refresh_state(
                    {
                        "workflow_id": workflow_id,
                        "actor_name": actor_name,
                        "user_id": user_id,
                        "workflow_type": workflow_type,
                    }
                ),
                {"configurable": {"thread_id": workflow_id}},
            )
        except psycopg.Error as exc:
            raise CheckpointPersistenceError(
                "LangGraph PostgreSQL checkpoint storage is unavailable."
            ) from exc


def resume_workflow_execution(
    workflow_id: str,
    actor_name: str,
    decision: str,
    reason: str,
    user_id: str = "",
) -> None:
    with _postgres_checkpointer() as checkpointer:
        graph = _build_execution_graph(checkpointer)
        config = {"configurable": {"thread_id": workflow_id}}
        if not graph.get_state(config).values:
            with get_connection() as conn:
                row = conn.execute(
                    "SELECT shared_context FROM workflows WHERE id = %s",
                    (workflow_id,),
                ).fetchone()
            if row is None:
                raise ValueError("Workflow not found.")
            context = json.loads(row["shared_context"] or "{}")
            workflow_type = context.get("workflow_type")
            if workflow_type not in {
                "employee_onboarding",
                "invoice_processing",
                "it_access_request",
            }:
                raise ValueError("Workflow has no resumable LangGraph execution plan.")
            graph.invoke(
                _refresh_state(
                    {
                        "workflow_id": workflow_id,
                        "actor_name": actor_name,
                        "user_id": user_id,
                        "workflow_type": workflow_type,
                    }
                ),
                config,
            )
        try:
            graph.invoke(
                Command(
                    resume={
                        "decision": decision,
                        "actor_name": actor_name,
                        "reason": reason,
                    }
                ),
                config,
            )
        except psycopg.Error as exc:
            raise CheckpointPersistenceError(
                "LangGraph PostgreSQL checkpoint storage is unavailable."
            ) from exc
