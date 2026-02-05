"""Add change_request_id to external_feedback table

Revision ID: 006
Revises: 005
Create Date: 2025-01-31
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def _column_exists(table: str, column: str) -> bool:
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT FROM information_schema.columns "
        "WHERE table_name = :t AND column_name = :c)"
    ), {"t": table, "c": column})
    return result.scalar()


def upgrade() -> None:
    if not _column_exists("external_feedback", "change_request_id"):
        op.add_column(
            "external_feedback",
            sa.Column("change_request_id", UUID(as_uuid=True), sa.ForeignKey("change_requests.id"), nullable=True),
        )


def downgrade() -> None:
    op.drop_column("external_feedback", "change_request_id")
