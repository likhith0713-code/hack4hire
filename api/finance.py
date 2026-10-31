from __future__ import annotations

import re
from datetime import date
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any


CENT = Decimal("0.01")
MAX_INVOICE_AMOUNT = Decimal("100000")


def _money(value: Any, label: str, errors: list[str], *, required: bool = True) -> Decimal | None:
    if value is None or str(value).strip() == "":
        if required:
            errors.append(f"{label} is required.")
        return None
    try:
        amount = Decimal(str(value).replace(",", "").strip())
    except (InvalidOperation, ValueError):
        errors.append(f"{label} must be a valid number.")
        return None
    if not amount.is_finite() or amount < 0 or (required and amount == 0):
        errors.append(f"{label} must be a finite positive amount.")
        return None
    if amount.as_tuple().exponent < -2:
        errors.append(f"{label} cannot have more than two decimal places.")
        return None
    return amount


def _invoice_date(
    value: Any, label: str, errors: list[str], *, required: bool
) -> date | None:
    if value is None or not str(value).strip():
        if required:
            errors.append(f"{label} is required.")
        return None
    try:
        return date.fromisoformat(str(value).strip())
    except ValueError:
        errors.append(f"{label} must be a valid ISO date (YYYY-MM-DD).")
        return None


def categorize_expense(description: str, vendor: str) -> str:
    text = f"{description} {vendor}".casefold()
    rules = (
        (("cloud", "software", "license", "subscription", "hosting", "saas"), "Software & cloud"),
        (("laptop", "computer", "hardware", "equipment", "device"), "Hardware & equipment"),
        (("travel", "flight", "hotel", "taxi", "transport"), "Travel"),
        (("marketing", "advertising", "campaign"), "Marketing"),
        (("consult", "professional service", "legal", "accounting"), "Professional services"),
        (("utility", "electricity", "internet", "telecom"), "Utilities"),
        (("office", "stationery", "supplies"), "Office supplies"),
        (("salary", "payroll", "recruit"), "People"),
    )
    for keywords, category in rules:
        if any(keyword in text for keyword in keywords):
            return category
    return "General expenses"


def analyze_invoice(
    values: dict[str, Any], *, require_dates: bool = True
) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []
    vendor = str(values.get("vendor") or "").strip()
    invoice_number = str(values.get("invoice_number") or "").strip()
    vendor_email = str(values.get("vendor_email", "") or "").strip()
    currency = str(values.get("currency", "INR") or "INR").strip().upper()
    description = str(values.get("description", "") or "").strip()
    category = str(values.get("expense_category", "") or "").strip()

    if len(vendor) < 2:
        errors.append("Vendor name is required and must contain at least two characters.")
    elif len(vendor) > 200:
        errors.append("Vendor name must be at most 200 characters.")
    if not invoice_number or len(invoice_number) > 100:
        errors.append("Invoice number is required and must be at most 100 characters.")
    if vendor_email and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", vendor_email):
        errors.append("Vendor email must be a valid email address.")
    if currency not in {"INR", "USD"}:
        errors.append("Currency must be INR or USD.")
    if len(category) > 80:
        errors.append("Expense category must be at most 80 characters.")
    if len(description) > 2000:
        errors.append("Invoice description must be at most 2000 characters.")

    invoice_date = _invoice_date(
        values.get("invoice_date"), "Invoice date", errors, required=require_dates
    )
    due_date = _invoice_date(
        values.get("due_date"), "Due date", errors, required=require_dates
    )
    if invoice_date and due_date and due_date < invoice_date:
        errors.append("Due date cannot be before the invoice date.")

    amount = _money(values.get("amount"), "Invoice amount", errors)
    gst = _money(values.get("gst_percentage"), "GST percentage", errors, required=False)
    if gst is None:
        gst = Decimal("0")
    elif gst > 100:
        errors.append("GST percentage must be between 0 and 100.")
    supplied_tax = _money(values.get("tax_amount"), "Tax amount", errors, required=False)

    expected_tax = (
        (amount * gst / Decimal("100")).quantize(CENT, rounding=ROUND_HALF_UP)
        if amount is not None
        else None
    )
    tax = supplied_tax if supplied_tax is not None else expected_tax
    if supplied_tax is not None and expected_tax is not None and supplied_tax != expected_tax:
        errors.append(
            f"Tax amount does not match GST: expected {expected_tax:.2f} for the supplied invoice amount."
        )

    expected_total = (
        (amount + tax).quantize(CENT, rounding=ROUND_HALF_UP)
        if amount is not None and tax is not None
        else None
    )
    supplied_total = _money(values.get("total_amount"), "Total amount", errors, required=False)
    if supplied_total is not None and expected_total is not None and supplied_total != expected_total:
        errors.append(f"Total amount does not match invoice amount plus tax: expected {expected_total:.2f}.")
    total = supplied_total if supplied_total is not None else expected_total

    if amount is not None:
        high_amount_limit = MAX_INVOICE_AMOUNT if currency == "INR" else Decimal("2000")
        if amount > high_amount_limit:
            warnings.append(
                f"Invoice amount exceeds the {currency} {high_amount_limit:.2f} review threshold; enhanced human review is recommended."
            )

    resolved_category = category or categorize_expense(description, vendor)
    return {
        "valid": not errors,
        "engine": "finance_policy_validation",
        "errors": errors,
        "warnings": warnings,
        "duplicate": False,
        "categorized_expense": resolved_category,
        "invoice_date": invoice_date.isoformat() if invoice_date else str(values.get("invoice_date", "")),
        "due_date": due_date.isoformat() if due_date else str(values.get("due_date", "")),
        "currency": currency,
        "amount": f"{amount:.2f}" if amount is not None else None,
        "gst_percentage": f"{gst:.2f}",
        "tax_amount": f"{tax:.2f}" if tax is not None else None,
        "total_amount": f"{total:.2f}" if total is not None else None,
        "requires_human_review": True,
        "payment_execution": "disabled",
    }
