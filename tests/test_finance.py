import pytest
from fastapi.testclient import TestClient

from api.finance import analyze_invoice
from api import main
from api import storage
from api.storage import MAX_INVOICE_FILE_SIZE, validate_invoice_file


VALID_INVOICE = {
    "vendor": "Acme Cloud Services",
    "vendor_email": "billing@acme.example",
    "invoice_number": "INV-2026-001",
    "invoice_date": "2026-10-01",
    "due_date": "2026-10-31",
    "amount": "1000.00",
    "gst_percentage": "18",
    "tax_amount": "180.00",
    "total_amount": "1180.00",
    "currency": "INR",
    "description": "Annual cloud hosting subscription",
}


def test_invoice_analysis_validates_and_categorizes_invoice():
    analysis = analyze_invoice(VALID_INVOICE)

    assert analysis["valid"] is True
    assert analysis["errors"] == []
    assert analysis["categorized_expense"] == "Software & cloud"
    assert analysis["tax_amount"] == "180.00"
    assert analysis["total_amount"] == "1180.00"
    assert analysis["requires_human_review"] is True
    assert analysis["payment_execution"] == "disabled"


def test_invoice_analysis_explains_missing_required_fields():
    analysis = analyze_invoice(
        {
            "vendor": "",
            "invoice_number": "",
            "invoice_date": "",
            "due_date": "",
            "amount": "",
        }
    )

    assert analysis["valid"] is False
    assert any("Vendor name is required" in error for error in analysis["errors"])
    assert any("Invoice number is required" in error for error in analysis["errors"])
    assert any("Invoice date is required" in error for error in analysis["errors"])
    assert any("Due date is required" in error for error in analysis["errors"])
    assert any("Invoice amount is required" in error for error in analysis["errors"])


@pytest.mark.parametrize(
    ("updates", "expected_error"),
    [
        ({"invoice_date": "not-a-date"}, "Invoice date must be a valid ISO date"),
        ({"due_date": "2026-09-30"}, "Due date cannot be before"),
        ({"tax_amount": "181.00"}, "Tax amount does not match GST"),
        ({"total_amount": "1200.00"}, "Total amount does not match"),
        ({"vendor_email": "not-an-email"}, "Vendor email must be a valid email"),
    ],
)
def test_invoice_analysis_reports_validation_failure(updates, expected_error):
    values = {**VALID_INVOICE, **updates}

    analysis = analyze_invoice(values)

    assert analysis["valid"] is False
    assert any(expected_error in error for error in analysis["errors"])


def test_invoice_analysis_flags_high_amount_without_approving():
    analysis = analyze_invoice(
        {**VALID_INVOICE, "amount": "100001.00", "tax_amount": "18000.18", "total_amount": "118001.18"}
    )

    assert analysis["valid"] is True
    assert analysis["warnings"]
    assert analysis["requires_human_review"] is True


@pytest.mark.parametrize(
    ("filename", "content_type", "content"),
    [
        ("invoice.exe", "application/octet-stream", b"MZ"),
        ("invoice.pdf", "application/pdf", b"not a pdf"),
        ("invoice.jpg", "image/png", b"\xff\xd8\xffdata"),
        ("invoice.png", "image/png", b""),
    ],
)
def test_invoice_file_validation_rejects_unsafe_files(filename, content_type, content):
    with pytest.raises(ValueError):
        validate_invoice_file(filename, content_type, content)


def test_invoice_file_validation_accepts_pdf_jpg_and_png():
    cases = (
        ("invoice.pdf", "application/pdf", b"%PDF-1.7 data"),
        ("invoice.jpg", "image/jpeg", b"\xff\xd8\xffdata"),
        ("invoice.png", "image/png", b"\x89PNG\r\n\x1a\ndata"),
    )
    for filename, content_type, content in cases:
        assert validate_invoice_file(filename, content_type, content) == content_type


def test_invoice_file_validation_enforces_size_limit():
    with pytest.raises(ValueError, match="10 MB or smaller"):
        validate_invoice_file(
            "invoice.pdf",
            "application/pdf",
            b"%PDF-" + b"x" * MAX_INVOICE_FILE_SIZE,
        )


def test_invoice_api_returns_structured_validation_errors_without_database(monkeypatch):
    monkeypatch.setattr(
        main,
        "_session_user",
        lambda _token: {
            "id": "test-manager",
            "name": "Test Manager",
            "email": "manager@example.test",
            "role": "manager",
        },
    )
    client = TestClient(main.app)

    response = client.post(
        "/api/finance/analyze",
        json={**VALID_INVOICE, "invoice_date": "not-a-date"},
    )

    assert response.status_code == 200
    result = response.json()
    assert result["valid"] is False
    assert any("Invoice date must be a valid ISO date" in error for error in result["errors"])


def test_invoice_api_rejects_invalid_attachment_before_database_access(monkeypatch):
    monkeypatch.setattr(
        main,
        "_session_user",
        lambda _token: {
            "id": "test-manager",
            "name": "Test Manager",
            "email": "manager@example.test",
            "role": "manager",
        },
    )
    client = TestClient(main.app)

    response = client.post(
        "/api/finance/invoices",
        data=VALID_INVOICE,
        files={"attachment": ("invoice.exe", b"unsafe", "application/octet-stream")},
    )

    assert response.status_code == 422
    assert "PDF, JPG, or PNG" in response.json()["detail"]


def test_invoice_api_reports_missing_fields_as_structured_errors(monkeypatch):
    monkeypatch.setattr(
        main,
        "_session_user",
        lambda _token: {
            "id": "test-manager",
            "name": "Test Manager",
            "email": "manager@example.test",
            "role": "manager",
        },
    )
    client = TestClient(main.app)

    response = client.post("/api/finance/analyze", json={})

    assert response.status_code == 200
    result = response.json()
    assert result["valid"] is False
    assert len(result["errors"]) >= 5


def test_invoice_submission_returns_structured_missing_field_errors(monkeypatch):
    monkeypatch.setattr(
        main,
        "_session_user",
        lambda _token: {
            "id": "test-manager",
            "name": "Test Manager",
            "email": "manager@example.test",
            "role": "manager",
        },
    )
    client = TestClient(main.app)

    response = client.post("/api/finance/invoices", data={})

    assert response.status_code == 422
    result = response.json()["detail"]
    assert result["analysis"]["valid"] is False
    assert any("Invoice date is required" in error for error in result["analysis"]["errors"])


def test_supabase_invoice_upload_requires_private_bucket(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://project.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
    monkeypatch.setenv("SUPABASE_INVOICE_BUCKET", "private-invoices")
    monkeypatch.setattr(
        storage.httpx,
        "get",
        lambda *args, **kwargs: _StorageResponse({"public": True}),
    )

    with pytest.raises(RuntimeError, match="must be private"):
        storage.upload_invoice_file("invoice.pdf", "application/pdf", b"%PDF-1.7 data")


def test_supabase_invoice_upload_targets_private_bucket(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://project.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
    monkeypatch.setenv("SUPABASE_INVOICE_BUCKET", "private-invoices")
    monkeypatch.setattr(
        storage.httpx,
        "get",
        lambda *args, **kwargs: _StorageResponse({"public": False}),
    )
    uploaded: dict[str, object] = {}

    def fake_post(url, **kwargs):
        uploaded.update({"url": url, **kwargs})
        return _StorageResponse({})

    monkeypatch.setattr(storage.httpx, "post", fake_post)

    path = storage.upload_invoice_file(
        "Invoice (Q4).pdf", "application/pdf", b"%PDF-1.7 data"
    )

    assert path.startswith("invoices/")
    assert "/private-invoices/" in str(uploaded["url"])
    assert uploaded["headers"]["Content-Type"] == "application/pdf"
    assert uploaded["content"] == b"%PDF-1.7 data"


class _StorageResponse:
    status_code = 200

    def __init__(self, value):
        self.value = value

    def json(self):
        return self.value

    def raise_for_status(self):
        return None
