"""Add has_completed_onboarding to users

Revision ID: 008
Revises: 007
Create Date: 2026-02-02
"""
from alembic import op
import sqlalchemy as sa

revision = "008"
down_revision = "007"
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
    if not _column_exists("users", "has_completed_onboarding"):
        op.add_column(
            "users",
            sa.Column("has_completed_onboarding", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        )


def downgrade() -> None:
    if _column_exists("users", "has_completed_onboarding"):
        op.drop_column("users", "has_completed_onboarding")
