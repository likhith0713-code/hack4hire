import os
import uuid

import json

import pytest
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from fastapi.testclient import TestClient

from api import main
from api import database
from api import orchestration


@pytest.fixture
def client(monkeypatch):
    test_url = os.getenv("WORKFORCE_TEST_DATABASE_URL")
    if not test_url:
        pytest.skip("Set WORKFORCE_TEST_DATABASE_URL to run PostgreSQL integration tests.")
    base_url = make_url(test_url).set(drivername="postgresql+psycopg")
    if base_url.host not in {"localhost", "127.0.0.1", "::1"}:
        pytest.fail("WORKFORCE_TEST_DATABASE_URL must point to a local test PostgreSQL server.")
    admin_engine = create_engine(
        base_url,
        pool_pre_ping=True,
        connect_args={"prepare_threshold": None},
    )
    schema = f"workforce_test_{uuid.uuid4().hex}"
    with admin_engine.begin() as connection:
        connection.exec_driver_sql(f'CREATE SCHEMA "{schema}"')
    isolated_url = base_url.update_query_dict(
        {"options": f"-csearch_path={schema}"}
    ).render_as_string(hide_password=False)
    monkeypatch.setenv("DATABASE_URL", isolated_url)
    try:
        main.init_db()
        with TestClient(main.app) as test_client:
            response = test_client.post(
                "/api/auth/register",
                json={
                    "name": "Maya Chen",
                    "email": "maya@example.com",
                    "password": "secure-workforce-password",
                },
            )
            assert response.status_code == 200
            assert "httponly" in response.headers["set-cookie"].lower()
            yield test_client
    finally:
        database.dispose_engine()
        with admin_engine.begin() as connection:
            connection.exec_driver_sql(f'DROP SCHEMA "{schema}" CASCADE')
        admin_engine.dispose()


ONBOARDING_REQUEST = (
    "Onboard a new employee named Rahul Kumar in the Engineering department, "
    "with a joining date of November 10, 2026."
)


def test_planner_preview_runs_without_database_and_keeps_plan_deterministic(monkeypatch):
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    preview = main.preview_workflow_plan(
        main.PlannerPreviewCreate(request=ONBOARDING_REQUEST)
    )

    assert preview["workflow_type"] == "employee_onboarding"
    assert preview["mode"] == "rule_based_demo"
    assert [step["agent_id"] for step in preview["steps"]] == [
        "planner",
        "hr",
        "it",
        "approval",
        "communication",
    ]


def test_planner_preview_post_contract_and_get_method(monkeypatch):
    monkeypatch.setattr(
        main,
        "_session_user",
        lambda _token: {
            "id": "test-user",
            "name": "Test User",
            "email": "test@example.com",
            "role": "manager",
        },
    )
    monkeypatch.setattr(
        main,
        "create_workflow_plan",
        lambda parsed: {
            "planner_summary": "Validated onboarding plan.",
            "mode": "rule_based_demo",
            "warning": None,
            "tasks": [
                (
                    "planner",
                    "Create execution plan",
                    "Validate request",
                    "completed",
                    1,
                    0,
                    "Validated",
                    None,
                    "planner.validate_plan",
                    parsed,
                )
            ],
        },
    )
    client = TestClient(main.app)

    response = client.post(
        "/api/planner/preview",
        json={"request": ONBOARDING_REQUEST},
    )
    wrong_method = client.get("/api/planner/preview")

    assert response.status_code == 200
    assert response.json()["steps"][0]["agent_id"] == "planner"
    assert wrong_method.status_code == 405


def test_it_access_approval_plan_targets_it_and_requires_a_human_checkpoint():
    plan = orchestration._approval(
        {
            "parsed": {
                "workflow_type": "it_access_request",
                "employee_name": "Avery Quinn",
                "department": "Engineering",
                "access": ["GitHub Enterprise"],
                "equipment": "Laptop",
            },
            "tasks": [],
        }
    )

    approval_task = plan["tasks"][0]
    assert approval_task[0] == "approval"
    assert approval_task[5] == 1
    assert approval_task[7] == "it"
    assert approval_task[9]["protected_agent"] == "it"
    assert approval_task[9]["approval_info"]["access"] == ["GitHub Enterprise"]


def test_agent_statistics_include_rejected_tasks_in_success_rate():
    class Result:
        def __init__(self, row):
            self.row = row

        def fetchone(self):
            return self.row

    class Connection:
        def execute(self, query, _params):
            if "COUNT(*) AS total" in query:
                return Result(
                    {
                        "total": 3,
                        "completed": 1,
                        "failed": 1,
                        "rejected": 1,
                        "active": 0,
                    }
                )
            return Result({"status": "rejected"})

    planner = main.get_agent_stats(Connection())[0]

    assert planner["tasks"] == 3
    assert planner["success"] == 33
    assert planner["status"] == "rejected"


def test_new_workspace_starts_without_fabricated_workflow_or_agent_counts(client):
    assert client.get("/api/workflows").json() == []
    overview = client.get("/api/overview").json()
    assert overview["metrics"]["active_workflows"] == 0
    assert all(agent["tasks"] == 0 and agent["status"] == "idle" for agent in overview["agents"])


def test_onboarding_workflow_persists_employee_and_waits_for_approval(client):
    response = client.post("/api/workflows", json={"request": ONBOARDING_REQUEST})

    assert response.status_code == 200
    workflow = response.json()
    assert workflow["status"] == "waiting_approval"
    assert workflow["employee_name"] == "Rahul Kumar"
    assert workflow["joining_date"] == "2026-11-10"
    assert workflow["shared_context"]["mode"] == "rule_based_demo"
    assert workflow["shared_context"]["orchestration"] == "langgraph"
    assert [task["agent_id"] for task in workflow["tasks"]] == [
        "planner",
        "hr",
        "it",
        "approval",
        "communication",
    ]
    assert workflow["approval"]["status"] == "pending"
    assert any(task["agent_id"] == "it" and task["status"] == "waiting_approval" for task in workflow["tasks"])

    employees = client.get("/api/employees").json()
    assert any(employee["workflow_id"] == workflow["id"] for employee in employees)


def test_planner_preview_returns_registered_steps_without_creating_a_workflow(client):
    preview = client.post(
        "/api/planner/preview",
        json={"request": ONBOARDING_REQUEST},
    )

    assert preview.status_code == 200
    result = preview.json()
    assert result["workflow_type"] == "employee_onboarding"
    assert [step["agent_id"] for step in result["steps"]] == [
        "planner",
        "hr",
        "it",
        "approval",
        "communication",
    ]
    assert result["steps"][3]["requires_approval"] is True
    assert client.get("/api/workflows").json() == []


def test_it_agent_creates_and_resumes_a_real_approval_workflow(client):
    employee = client.post(
        "/api/employees",
        json={
            "name": "Temporary IT Employee",
            "department": "Engineering",
            "title": "Engineer",
            "joining_date": "2026-11-10",
        },
    ).json()

    response = client.post(
        "/api/agents/it/requests",
        json={
            "employee_id": employee["id"],
            "access": ["GitHub Enterprise", "Linear"],
            "equipment": "Laptop",
        },
    )

    assert response.status_code == 200
    workflow = response.json()
    assert workflow["status"] == "waiting_approval"
    assert workflow["shared_context"]["workflow_type"] == "it_access_request"
    assert workflow["approval"]["status"] == "pending"
    it_requests = [
        item
        for item in client.get("/api/it/requests").json()
        if item["workflow_id"] == workflow["id"]
    ]
    assert len(it_requests) == 3
    assert all(item["status"] == "pending_approval" for item in it_requests)
    with orchestration._postgres_checkpointer() as checkpointer:
        state = orchestration._build_execution_graph(checkpointer).get_state(
            {"configurable": {"thread_id": workflow["id"]}}
        ).values
    assert state["current_status"] == "waiting_approval"
    assert state["pending_approvals"] == [workflow["approval"]["id"]]

    approved = client.post(
        f"/api/approvals/{workflow['approval']['id']}/decision",
        json={"decision": "approved", "reason": "Test approval"},
    )

    assert approved.status_code == 200
    assert approved.json()["status"] == "completed"
    assert all(
        item["status"] == "approved_simulated"
        for item in client.get("/api/it/requests").json()
        if item["workflow_id"] == workflow["id"]
    )
    assert any(
        item["workflow_id"] == workflow["id"]
        for item in client.get("/api/communications").json()
    )
    with orchestration._postgres_checkpointer() as checkpointer:
        final_state = orchestration._build_execution_graph(checkpointer).get_state(
            {"configurable": {"thread_id": workflow["id"]}}
        ).values
    assert final_state["decision"] == "approved"
    assert final_state["current_status"] == "completed"


def test_it_agent_rejection_does_not_resume_to_communication(client):
    employee = client.post(
        "/api/employees",
        json={
            "name": "Temporary Rejection Employee",
            "department": "IT",
            "title": "Analyst",
            "joining_date": "2026-11-11",
        },
    ).json()
    workflow = client.post(
        "/api/agents/it/requests",
        json={
            "employee_id": employee["id"],
            "access": ["Notion"],
            "equipment": "",
        },
    ).json()

    rejected = client.post(
        f"/api/approvals/{workflow['approval']['id']}/decision",
        json={"decision": "rejected", "reason": "Test rejection"},
    )

    assert rejected.status_code == 200
    assert rejected.json()["status"] == "rejected"
    assert not any(
        item["workflow_id"] == workflow["id"]
        for item in client.get("/api/communications").json()
    )
    assert all(
        item["status"] == "rejected"
        for item in client.get("/api/it/requests").json()
        if item["workflow_id"] == workflow["id"]
    )
    with orchestration._postgres_checkpointer() as checkpointer:
        state = orchestration._build_execution_graph(checkpointer).get_state(
            {"configurable": {"thread_id": workflow["id"]}}
        ).values
    assert state["decision"] == "rejected"
    assert state["current_status"] == "rejected"


def test_communication_agent_edits_persisted_draft_without_sending(client):
    created = client.post(
        "/api/communications/send",
        json={"recipient": "team@example.com", "subject": "Original", "body": "Draft"},
    )
    assert created.status_code == 200

    updated = client.put(
        f"/api/communications/{created.json()['id']}",
        json={
            "recipient": "ops@example.com",
            "subject": "Updated subject",
            "body": "Updated draft body",
        },
    )

    assert updated.status_code == 200
    assert updated.json()["recipient"] == "ops@example.com"
    assert updated.json()["subject"] == "Updated subject"
    assert updated.json()["body"] == "Updated draft body"
    assert updated.json()["status"] == "draft_simulated"


def test_agent_execution_persists_employee_and_linked_it_requests(client):
    workflow = client.post(
        "/api/workflows",
        json={"request": ONBOARDING_REQUEST},
    ).json()
    tasks = {task["agent_id"]: task for task in workflow["tasks"]}
    employee_result = tasks["hr"]["execution_result"]
    it_result = tasks["it"]["execution_result"]

    assert all(task["created_at"] for task in tasks.values())
    assert tasks["hr"]["action"] == "hr.create_employee"
    assert tasks["it"]["action"] == "it.create_requests"
    assert tasks["hr"]["task_id"] == tasks["hr"]["id"]
    assert tasks["hr"]["task_name"] == tasks["hr"]["title"]
    assert tasks["hr"]["assigned_agent"] == "hr"
    assert isinstance(tasks["hr"]["input_data"], dict)
    assert isinstance(tasks["hr"]["priority"], int)
    assert tasks["it"]["dependencies"] == [tasks["hr"]["task_id"]]
    assert tasks["hr"]["status"] == "completed"
    assert employee_result["employee_id"].startswith("emp_")
    assert workflow["shared_context"]["agent_results"]["hr"]["employee_id"] == employee_result["employee_id"]
    assert tasks["it"]["status"] == "waiting_approval"
    assert it_result["employee_id"] == employee_result["employee_id"]
    assert len(it_result["request_ids"]) == 2
    requests = client.get("/api/it/requests").json()
    workflow_requests = [request for request in requests if request["workflow_id"] == workflow["id"]]
    assert {request["id"] for request in workflow_requests} == set(it_result["request_ids"])
    assert all(request["employee_id"] == employee_result["employee_id"] for request in workflow_requests)
    assert all(request["status"] == "pending_approval" for request in workflow_requests)
    assert tasks["approval"]["status"] == "waiting_approval"
    assert tasks["communication"]["status"] == "queued"
    agent_statuses = {
        agent["id"]: agent["status"] for agent in client.get("/api/agents").json()
    }
    assert agent_statuses["hr"] == "completed"
    assert agent_statuses["it"] == "waiting_for_approval"
    assert agent_statuses["approval"] == "waiting_for_approval"
    assert agent_statuses["communication"] == "assigned"
    status = client.get(
        f"/api/employees/{employee_result['employee_id']}/onboarding-status"
    ).json()
    assert status["workflow_status"] == "waiting_approval"
    assert status["approval"]["status"] == "pending"
    assert client.get("/api/departments").status_code == 200
    with main.connect() as conn:
        checkpoint_tables = conn.execute(
            """SELECT table_name FROM information_schema.tables
               WHERE table_schema = current_schema() AND table_name LIKE '%checkpoint%'"""
        ).fetchall()
    assert checkpoint_tables
    with orchestration._postgres_checkpointer() as checkpointer:
        graph = orchestration._build_execution_graph(checkpointer)
        state = graph.get_state(
            {"configurable": {"thread_id": workflow["id"]}}
        ).values
    assert state["original_request"] == ONBOARDING_REQUEST
    assert state["user_id"] == client.get("/api/auth/me").json()["user"]["id"]
    assert state["current_status"] == "waiting_approval"
    assert state["pending_approvals"] == [workflow["approval"]["id"]]
    assert state["completed_tasks"] == [tasks["planner"]["id"], tasks["hr"]["id"]]
    assert state["assigned_agents"] == ["planner", "hr", "it", "approval", "communication"]


def test_approval_creates_preview_without_sending_email(client):
    workflow = client.post("/api/workflows", json={"request": ONBOARDING_REQUEST}).json()

    response = client.post(f"/api/approvals/{workflow['approval']['id']}/approve", json={})

    assert response.status_code == 200
    assert response.json()["status"] == "completed"
    messages = client.get("/api/communications").json()
    assert len(messages) == 1
    assert messages[0]["status"] == "draft_simulated"
    assert "No email was sent" in messages[0]["body"]
    result = response.json()
    tasks = {task["agent_id"]: task for task in result["tasks"]}
    message_result = tasks["communication"]["execution_result"]
    assert message_result["notification_id"] == messages[0]["id"]
    assert tasks["communication"]["status"] == "completed"
    assert client.get("/api/it/requests").json()[0]["status"] == "approved_simulated"


def test_approval_decision_requires_an_explicit_choice(client):
    workflow = client.post("/api/workflows", json={"request": ONBOARDING_REQUEST}).json()
    approval_id = workflow["approval"]["id"]

    response = client.post(
        f"/api/approvals/{approval_id}/decision",
        json={"reason": "Rejected after review."},
    )

    assert response.status_code == 422
    approval = next(
        item for item in client.get("/api/approvals").json() if item["id"] == approval_id
    )
    assert approval["status"] == "pending"
    assert approval["decided_at"] is None


def test_explicit_approval_decisions_resume_or_reject_workflows(client):
    approved_workflow = client.post(
        "/api/workflows", json={"request": ONBOARDING_REQUEST}
    ).json()
    approved = client.post(
        f"/api/approvals/{approved_workflow['approval']['id']}/decision",
        json={"decision": "approved", "reason": "Approved after review."},
    )

    assert approved.status_code == 200
    assert approved.json()["status"] == "completed"
    assert approved.json()["approval"]["status"] == "approved"
    assert approved.json()["approval"]["decided_by"] == "Maya Chen"
    assert approved.json()["approval"]["decided_at"]
    assert any(
        task["agent_id"] == "communication" and task["status"] == "completed"
        for task in approved.json()["tasks"]
    )

    rejected_workflow = client.post(
        "/api/workflows", json={"request": ONBOARDING_REQUEST}
    ).json()
    rejected = client.post(
        f"/api/approvals/{rejected_workflow['approval']['id']}/decision",
        json={"decision": "rejected", "reason": "Rejected after review."},
    )

    assert rejected.status_code == 200
    assert rejected.json()["status"] == "rejected"
    assert rejected.json()["approval"]["status"] == "rejected"
    assert rejected.json()["approval"]["decided_by"] == "Maya Chen"
    assert rejected.json()["approval"]["decided_at"]
    assert all(
        task["status"] != "completed"
        for task in rejected.json()["tasks"]
        if task["agent_id"] == "communication"
    )


def test_rejection_blocks_protected_action_and_is_idempotent(client):
    workflow = client.post("/api/workflows", json={"request": ONBOARDING_REQUEST}).json()
    approval_id = workflow["approval"]["id"]

    rejected = client.post(f"/api/approvals/{approval_id}/reject", json={})

    assert rejected.status_code == 200
    result = rejected.json()
    assert result["status"] == "rejected"
    assert not client.get("/api/communications").json()
    assert all(
        request["status"] == "rejected"
        for request in client.get("/api/it/requests").json()
        if request["workflow_id"] == workflow["id"]
    )
    it_task = next(task for task in result["tasks"] if task["agent_id"] == "it")
    assert it_task["status"] == "rejected"
    duplicate = client.post(f"/api/approvals/{approval_id}/approve", json={})
    assert duplicate.status_code == 409


def test_invoice_request_detects_duplicates_and_never_executes_payment(client):
    request = "Process invoice INV-1025 from ABC Technologies for Rs. 50,000."
    workflow_response = client.post("/api/workflows", json={"request": request})
    assert workflow_response.status_code == 200
    workflow = workflow_response.json()
    assert workflow["department"] == "Finance"
    assert workflow["approval"]["information"]["amount"] == "50000"
    finance_task = next(task for task in workflow["tasks"] if task["agent_id"] == "finance")
    finance_result = finance_task["execution_result"]
    payment_request = next(
        request
        for request in client.get("/api/finance/payment-requests").json()
        if request["workflow_id"] == workflow["id"]
    )
    assert finance_result["payment_request_id"] == payment_request["id"]
    assert payment_request["status"] == "pending_approval"
    assert finance_task["status"] == "completed"

    duplicate = client.post("/api/workflows", json={"request": request})
    assert duplicate.status_code == 409

    approved = client.post(f"/api/approvals/{workflow['approval']['id']}/approve", json={})
    assert approved.status_code == 200
    assert approved.json()["status"] == "completed"
    assert client.get("/api/finance/reports").json()["payments_executed"] == 0
    assert client.get("/api/finance/invoices").json()[0]["status"] == "approved_simulated"
    approved_payment = next(
        row
        for row in client.get("/api/finance/payment-requests").json()
        if row["workflow_id"] == workflow["id"]
    )
    assert approved_payment["status"] == "approved_simulated"


def test_hr_agent_rejects_duplicate_email_without_creating_second_employee(client):
    first = client.post(
        "/api/workflows",
        json={"request": ONBOARDING_REQUEST, "email": "rahul@example.com"},
    )
    assert first.status_code == 200

    duplicate = client.post(
        "/api/workflows",
        json={
            "request": "Onboard a new employee named Rohan Kumar in Engineering department joining date 2026-11-11",
            "email": "RAHUL@example.com",
        },
    )

    assert duplicate.status_code == 409
    assert duplicate.json()["detail"] == "An employee with this email address already exists."
    assert len(
        [
            employee
            for employee in client.get("/api/employees").json()
            if employee["email"] == "rahul@example.com"
        ]
    ) == 1


def test_failed_agent_task_can_retry_after_input_correction(client):
    failed = client.post(
        "/api/workflows",
        json={"request": ONBOARDING_REQUEST, "email": "not-an-email"},
    )
    assert failed.status_code == 422
    workflow = next(
        item
        for item in client.get("/api/workflows").json()
        if item["title"] == "Onboard Rahul Kumar" and item["status"] == "failed"
    )
    hr_task = next(task for task in workflow["tasks"] if task["agent_id"] == "hr")
    corrected_input = hr_task["input_data"]
    corrected_input["email"] = "rahul.retry@example.com"
    with main.connect() as conn:
        conn.execute(
            "UPDATE tasks SET input_data = %s WHERE id = %s",
            (json.dumps(corrected_input), hr_task["id"]),
        )

    retried = client.post(f"/api/workflows/{workflow['id']}/retry", json={})

    assert retried.status_code == 200
    assert retried.json()["status"] == "waiting_approval"
    assert any(
        employee["email"] == "rahul.retry@example.com"
        for employee in client.get("/api/employees").json()
    )


def test_seeded_pending_approval_resumes_after_schema_migration(client):
    with main.connect() as conn:
        main.seed(conn)
        main.upgrade_seeded_onboarding_workflow(conn)
    workflow = client.get("/api/workflows/wf_rahul_onboarding").json()
    assert workflow["shared_context"]["workflow_type"] == "employee_onboarding"
    assert len(
        [
            request
            for request in client.get("/api/it/requests").json()
            if request["workflow_id"] == workflow["id"]
        ]
    ) == 2

    approved = client.post(
        f"/api/approvals/{workflow['approval']['id']}/approve", json={}
    )

    assert approved.status_code == 200
    assert approved.json()["status"] == "completed"
    assert any(
        message["workflow_id"] == workflow["id"]
        and message["status"] == "draft_simulated"
        for message in client.get("/api/communications").json()
    )


def test_analytics_and_agent_counts_are_database_derived(client):
    overview = client.get("/api/overview").json()
    analytics = client.get("/api/analytics").json()
    agent_tasks = sum(agent["tasks"] for agent in overview["agents"])

    with main.connect() as conn:
        task_count = conn.execute("SELECT COUNT(*) FROM tasks").fetchone()[0]

    assert overview["metrics"]["automated_actions"] == sum(
        1 for task in client.get("/api/workflows").json() for task in task["tasks"] if task["status"] == "completed"
    )
    assert agent_tasks == task_count
    assert len(analytics["volume"]) == 7
    assert analytics["health"]["success_rate"] <= 100


def test_postgres_transaction_rolls_back_all_changes_on_error(client):
    with pytest.raises(RuntimeError, match="simulate failure"):
        with main.connect() as conn:
            conn.execute(
                """INSERT INTO workflows
                   (id, title, request, status, created_by, created_at, updated_at, shared_context)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                (
                    "wf_rollback_test",
                    "Rollback test",
                    "This row must not persist.",
                    "running",
                    "test",
                    main.now(),
                    main.now(),
                    "{}",
                ),
            )
            raise RuntimeError("simulate failure")

    with main.connect() as conn:
        row = conn.execute(
            "SELECT id FROM workflows WHERE id = %s", ("wf_rollback_test",)
        ).fetchone()
    assert row is None


def test_unsupported_request_is_rejected_instead_of_becoming_fake_employee(client):
    response = client.post("/api/workflows", json={"request": "Please update my laptop settings."})

    assert response.status_code == 422
    assert "supports employee onboarding and invoice requests" in response.json()["detail"]


def test_integration_status_reports_real_local_configuration(client, monkeypatch):
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("REDIS_URL", raising=False)
    response = client.get("/api/integrations/status")

    assert response.status_code == 200
    status = response.json()
    assert status["database"]["status"] == "connected"
    assert status["database"]["provider"] == "postgresql"
    assert status["gemini"]["status"] == "not_configured"
    assert status["email"]["status"] == "not_configured"
    assert status["redis"]["status"] == "not_configured"


def test_workspace_requires_authentication_and_accounts_use_secure_sessions(client):
    with TestClient(main.app) as anonymous:
        response = anonymous.get("/api/overview")
        assert response.status_code == 401
        assert anonymous.get("/api/health").status_code == 200
        assert anonymous.get("/api/health").json()["mode"] == "langgraph"
        blocked_origin = anonymous.post(
            "/api/auth/register",
            headers={"Origin": "https://untrusted.example"},
            json={
                "name": "Untrusted User",
                "email": "untrusted@example.com",
                "password": "untrusted-secure-password",
            },
        )
        assert blocked_origin.status_code == 403

    identity = client.get("/api/auth/me")
    assert identity.status_code == 200
    assert identity.json()["user"]["email"] == "maya@example.com"
    assert "password" not in identity.json()["user"]

    session_cookie = client.cookies.get(main.SESSION_COOKIE)
    assert session_cookie
    with main.connect() as conn:
        row = conn.execute("SELECT token_hash, password_hash FROM users JOIN sessions ON users.id = sessions.user_id").fetchone()
    assert row["token_hash"] != session_cookie
    assert row["password_hash"].startswith("pbkdf2_sha256$")

    logout = client.post("/api/auth/logout")
    assert logout.status_code == 200
    assert client.get("/api/auth/me").status_code == 401


def test_vite_loopback_alias_can_create_and_login_account(client, monkeypatch):
    monkeypatch.setenv(
        "FRONTEND_URLS",
        "http://localhost:5173,http://localhost:3000",
    )
    origin = "http://127.0.0.1:5173"
    email = f"origin-{uuid.uuid4().hex}@example.com"
    payload = {
        "name": "Loopback Origin User",
        "email": email,
        "password": "valid-temporary-password",
    }

    registration = client.post(
        "/api/auth/register",
        headers={"Origin": origin},
        json=payload,
    )

    assert registration.status_code == 200
    assert registration.headers["access-control-allow-origin"] == origin
    assert "httponly" in registration.headers["set-cookie"].lower()
    assert registration.json()["user"]["email"] == email
    client.post("/api/auth/logout")

    login = client.post(
        "/api/auth/login",
        headers={"Origin": origin},
        json={"email": email, "password": payload["password"]},
    )

    assert login.status_code == 200
    assert login.headers["access-control-allow-origin"] == origin
    assert login.json()["user"]["email"] == email
    assert client.get("/api/auth/me").json()["user"]["email"] == email


def test_account_login_duplicate_registration_and_role_based_approval(client):
    with TestClient(main.app) as member:
        registration = member.post(
            "/api/auth/register",
            json={
                "name": "Jordan Lee",
                "email": "jordan@example.com",
                "password": "another-secure-password",
            },
        )
        assert registration.status_code == 200
        assert registration.json()["user"]["role"] == "member"
        duplicate = member.post(
            "/api/auth/register",
            json={
                "name": "Maya Chen",
                "email": "MAYA@example.com",
                "password": "secure-workforce-password",
            },
        )
        assert duplicate.status_code == 409
        invalid = member.post(
            "/api/auth/login",
            json={"email": "maya@example.com", "password": "incorrect-password"},
        )
        assert invalid.status_code == 401

        workflow = member.post("/api/workflows", json={"request": ONBOARDING_REQUEST}).json()
        denied = member.post(
            f"/api/approvals/{workflow['approval']['id']}/decision",
            json={
                "role": "manager",
                "actor": "Maya Chen",
                "reason": "approve",
            },
        )
        assert denied.status_code == 403
        assert member.put(
            "/api/settings", json={"preferences": {"appearance": "dark"}}
        ).status_code == 403
        it_request = member.post(
            "/api/it/requests",
            json={
                "employee_name": "Jordan Lee",
                "request_type": "Laptop",
                "description": "Prepare a simulated laptop request.",
            },
        ).json()
        assert member.put(
            f"/api/it/requests/{it_request['id']}",
            json={"status": "approved_simulated"},
        ).status_code == 403

        logged_in = member.post(
            "/api/auth/login",
            json={
                "email": "maya@example.com",
                "password": "secure-workforce-password",
            },
        )
        assert logged_in.status_code == 200
        assert logged_in.json()["user"]["role"] == "manager"


def test_gemini_planner_is_optional_and_cannot_change_agent_routing(monkeypatch):
    from google import genai

    captured = {}

    class FakeModels:
        def generate_content(self, **kwargs):
            captured.update(kwargs)
            return type("Response", (), {"text": '{"summary":"Validated onboarding plan."}'})()

    class FakeClient:
        def __init__(self, api_key):
            captured["api_key"] = api_key
            self.models = FakeModels()

    monkeypatch.setenv("GOOGLE_API_KEY", "test-secret")
    monkeypatch.setattr(genai, "Client", FakeClient)
    plan = orchestration.create_workflow_plan(
        {
            "workflow_type": "employee_onboarding",
            "name": "Private Name",
            "department": "Engineering",
            "joining_date": "2026-11-10",
        }
    )

    assert plan["mode"] == "langgraph_gemini"
    assert [task[0] for task in plan["tasks"]] == [
        "planner",
        "hr",
        "it",
        "approval",
        "communication",
    ]
    assert "Private Name" not in captured["contents"]
    assert captured["api_key"] == "test-secret"


def test_frontend_api_surfaces_are_authenticated_and_operational(client):
    assert client.get("/api/overview").status_code == 200
    assert client.get("/api/workflows").status_code == 200
    seeded = client.post(
        "/api/workflows", json={"request": ONBOARDING_REQUEST}
    ).json()
    assert client.get(f"/api/workflows/{seeded['id']}/events").status_code == 200
    assert client.get("/api/agents").status_code == 200
    assert client.get("/api/agents/planner").status_code == 200
    assert client.get("/api/agents/planner/executions").status_code == 200
    assert client.get("/api/approvals").status_code == 200
    assert client.get("/api/approvals/pending").status_code == 200
    assert client.get("/api/employees").status_code == 200
    assert client.get("/api/departments").status_code == 200
    employee = client.post(
        "/api/employees",
        json={
            "name": "Avery Quinn",
            "department": "Design",
            "title": "Product Designer",
            "joining_date": "2026-12-01",
            "created_by": "Spoofed actor",
        },
    ).json()
    assert client.get(f"/api/employees/{employee['id']}").status_code == 200
    assert client.get(
        f"/api/employees/{employee['id']}/onboarding-status"
    ).status_code == 200
    assert client.put(f"/api/employees/{employee['id']}", json={"title": "Senior Designer"}).status_code == 200
    assert client.delete(f"/api/employees/{employee['id']}").status_code == 200

    invoice = client.post(
        "/api/finance/reviews",
        json={"vendor": "Example Vendor", "invoice_number": "SURFACE-1", "amount": "125.00"},
    ).json()
    assert invoice["status"] == "pending_approval"
    assert client.get("/api/finance/reviews").status_code == 200
    assert client.get("/api/finance/invoices").status_code == 200
    assert client.get(f"/api/finance/invoices/{invoice['id']}").status_code == 200
    assert client.get("/api/finance/reports").status_code == 200
    finance_workflow = next(
        workflow
        for workflow in client.get("/api/workflows").json()
        if workflow["shared_context"].get("request_data", {}).get("invoice_number")
        == "SURFACE-1"
    )
    assert finance_workflow["approval"]["status"] == "pending"
    assert client.post(
        f"/api/approvals/{finance_workflow['approval']['id']}/approve", json={}
    ).json()["status"] == "completed"
    duplicate_invoice = client.post(
        "/api/finance/reviews",
        json={"vendor": "Example Vendor", "invoice_number": "SURFACE-1", "amount": "125.00"},
    )
    assert duplicate_invoice.status_code == 409

    it_request = client.post(
        "/api/it/requests",
        json={
            "employee_name": "Avery Quinn",
            "request_type": "Laptop",
            "description": "Prepare a simulated laptop request.",
        },
    ).json()
    assert client.get("/api/it/requests").status_code == 200
    assert client.get(f"/api/it/requests/{it_request['id']}").status_code == 200
    assert client.put(
        f"/api/it/requests/{it_request['id']}",
        json={"status": "approved_simulated"},
    ).status_code == 200

    message = client.post(
        "/api/communications/send",
        json={
            "recipient": "avery@example.com",
            "subject": "Welcome",
            "body": "This is a test preview.",
            "workflow_id": seeded["id"],
        },
    ).json()
    assert client.get("/api/communications").status_code == 200
    assert client.get(f"/api/communications/{message['id']}").status_code == 200

    audit_rows = client.get("/api/audit").json()
    assert client.get("/api/audit-logs").status_code == 200
    assert audit_rows
    assert client.get(f"/api/audit-logs/{audit_rows[0]['id']}").status_code == 200
    assert client.get("/api/analytics").status_code == 200
    assert client.get("/api/analytics/workflows").status_code == 200
    assert client.get("/api/analytics/agents").status_code == 200
    assert client.get("/api/integrations/status").status_code == 200
    assert client.get("/api/settings").status_code == 200
    assert client.put("/api/settings", json={"preferences": {"appearance": "light"}}).status_code == 200

    workflow = client.post(
        "/api/workflows",
        json={"request": "Onboard a new employee named Jordan Lee in Finance department joining date 2026-12-02"},
    ).json()
    assert client.post(f"/api/workflows/{workflow['id']}/cancel").status_code == 200
    retryable = client.post(
        "/api/workflows",
        json={"request": "Onboard a new employee named Taylor Reed in Design department joining date 2026-12-03"},
    ).json()
    with main.connect() as conn:
        conn.execute(
            "UPDATE workflows SET status = 'failed' WHERE id = %s",
            (retryable["id"],),
        )
        conn.execute(
            "UPDATE tasks SET status = 'failed', action = '' WHERE workflow_id = %s AND agent_id = 'it'",
            (retryable["id"],),
        )
    retry = client.post(f"/api/workflows/{retryable['id']}/retry", json={})
    assert retry.status_code == 409
    assert "no registered agent handler" in retry.json()["detail"]


def test_invoice_submission_analysis_approval_history_and_rejection(client):
    invoice = {
        "vendor": "Acme Cloud Services",
        "vendor_email": "billing@acme.example",
        "invoice_number": "FINANCE-2026-001",
        "invoice_date": "2026-10-01",
        "due_date": "2026-10-31",
        "amount": "1000.00",
        "gst_percentage": "18",
        "tax_amount": "180.00",
        "total_amount": "1180.00",
        "currency": "INR",
        "expense_category": "",
        "description": "Annual cloud hosting subscription",
    }

    analysis = client.post("/api/finance/analyze", json=invoice)
    assert analysis.status_code == 200
    assert analysis.json()["valid"] is True
    assert analysis.json()["categorized_expense"] == "Software & cloud"

    submitted = client.post("/api/finance/invoices", data=invoice)
    assert submitted.status_code == 200
    result = submitted.json()
    assert result["invoice"]["analysis"]["valid"] is True
    assert result["payment_request"]["amount"] == "1180.00"
    assert result["payment_request"]["status"] == "pending_approval"
    assert result["approval"]["status"] == "pending"
    assert result["payment_execution"] == "disabled"

    duplicate = client.post("/api/finance/invoices", data=invoice)
    assert duplicate.status_code == 409
    assert duplicate.json()["detail"]["analysis"]["duplicate"] is True

    approved = client.post(
        f"/api/approvals/{result['approval']['id']}/decision",
        json={"decision": "approved", "reason": "Invoice verified."},
    )
    assert approved.status_code == 200
    assert approved.json()["status"] == "completed"
    payment = next(
        item
        for item in client.get("/api/finance/payment-requests").json()
        if item["id"] == result["payment_request"]["id"]
    )
    assert payment["status"] == "approved_simulated"
    history = client.get("/api/finance/invoices").json()
    assert next(item for item in history if item["id"] == result["invoice"]["id"])[
        "due_date"
    ] == "2026-10-31"

    rejected_invoice = {**invoice, "invoice_number": "FINANCE-2026-002"}
    rejected_result = client.post(
        "/api/finance/invoices", data=rejected_invoice
    ).json()
    rejected = client.post(
        f"/api/approvals/{rejected_result['approval']['id']}/decision",
        json={"decision": "rejected", "reason": "Invoice requires correction."},
    )
    assert rejected.status_code == 200
    rejected_payment = next(
        item
        for item in client.get("/api/finance/payment-requests").json()
        if item["id"] == rejected_result["payment_request"]["id"]
    )
    assert rejected_payment["status"] == "rejected"
    summary = client.get("/api/finance/dashboard").json()
    assert summary["total_invoices"] == 2
    assert summary["approved_invoices"] == 1
    assert summary["rejected_invoices"] == 1
    assert summary["payments_executed"] == 0


def test_invoice_submission_rejects_bad_dates_tax_and_uploads(client):
    invoice = {
        "vendor": "Acme Cloud Services",
        "invoice_number": "FINANCE-INVALID-001",
        "invoice_date": "not-a-date",
        "due_date": "2026-09-30",
        "amount": "1000.00",
        "gst_percentage": "18",
        "tax_amount": "181.00",
        "total_amount": "1181.00",
        "currency": "INR",
    }
    analysis = client.post("/api/finance/analyze", json=invoice)
    assert analysis.status_code == 200
    assert analysis.json()["valid"] is False
    assert any("valid ISO date" in error for error in analysis.json()["errors"])
    assert any("Due date cannot be before" in error for error in analysis.json()["errors"])
    assert any("does not match GST" in error for error in analysis.json()["errors"])

    invoice.update(
        {
            "invoice_date": "2026-10-01",
            "due_date": "2026-10-31",
            "tax_amount": "180.00",
            "total_amount": "1180.00",
        }
    )
    upload = client.post(
        "/api/finance/invoices",
        data=invoice,
        files={"attachment": ("invoice.exe", b"unsafe", "application/octet-stream")},
    )
    assert upload.status_code == 422
    assert "PDF, JPG, or PNG" in upload.json()["detail"]
