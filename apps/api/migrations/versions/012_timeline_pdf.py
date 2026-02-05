"""Add timeline PDF columns to deals

Revision ID: 012
Revises: 011
Create Date: 2026-02-02
"""
from alembic import op
import sqlalchemy as sa

revision = "012"
down_revision = "011"
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
    if not _column_exists("deals", "timeline_pdf_base64"):
        op.add_column("deals", sa.Column("timeline_pdf_base64", sa.Text(), nullable=True))
    if not _column_exists("deals", "timeline_generated_at"):
        op.add_column("deals", sa.Column("timeline_generated_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    if _column_exists("deals", "timeline_generated_at"):
        op.drop_column("deals", "timeline_generated_at")
    if _column_exists("deals", "timeline_pdf_base64"):
        op.drop_column("deals", "timeline_pdf_base64")
