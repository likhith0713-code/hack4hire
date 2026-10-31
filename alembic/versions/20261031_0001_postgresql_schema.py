"""Create the workforce PostgreSQL schema.

Revision ID: 20261031_0001
Revises:
Create Date: 2026-10-31
"""

from alembic import op

from api.database import metadata

revision = "20261031_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    metadata.create_all(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    # Application data is intentionally never dropped by a schema downgrade.
    pass
