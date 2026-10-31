"""Add structured invoice details and analysis metadata.

Revision ID: 20261031_0002
Revises: 20261031_0001
Create Date: 2026-10-31
"""

from alembic import op
from sqlalchemy import Column, String, Text, inspect
from sqlalchemy.dialects.postgresql import JSONB

revision = "20261031_0002"
down_revision = "20261031_0001"
branch_labels = None
depends_on = None


INVOICE_COLUMNS = (
    ("vendor_email", Text()),
    ("invoice_date", Text()),
    ("due_date", Text()),
    ("gst_percentage", Text()),
    ("tax_amount", Text()),
    ("total_amount", Text()),
    ("currency", String()),
    ("expense_category", Text()),
    ("description", Text()),
    ("attachment_path", Text()),
    ("analysis", JSONB()),
)


def upgrade() -> None:
    existing = {
        column["name"]
        for column in inspect(op.get_bind()).get_columns("finance_reviews")
    }
    for name, column_type in INVOICE_COLUMNS:
        if name not in existing:
            op.add_column(
                "finance_reviews",
                Column(name, column_type, nullable=True),
            )


def downgrade() -> None:
    pass
