"""Add PDF storage fields to contract_versions

Revision ID: 015
Revises: 014
Create Date: 2026-02-03
"""
from alembic import op
import sqlalchemy as sa

revision = "015"
down_revision = "014"
branch_labels = None
depends_on = None


def _column_exists(table: str, column: str) -> bool:
    conn = op.get_bind()
    result = conn.execute(sa.text(
        """
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = :table AND column_name = :column
        )
        """
    ), {"table": table, "column": column})
    return result.scalar()


def upgrade() -> None:
    # Add PDF template slug column
    if not _column_exists("contract_versions", "pdf_template_slug"):
        op.add_column(
            "contract_versions",
            sa.Column("pdf_template_slug", sa.String(50), nullable=True)
        )

    # Add PDF base64 storage column
    if not _column_exists("contract_versions", "pdf_base64"):
        op.add_column(
            "contract_versions",
            sa.Column("pdf_base64", sa.Text(), nullable=True)
        )

    # Add PDF generation timestamp
    if not _column_exists("contract_versions", "pdf_generated_at"):
        op.add_column(
            "contract_versions",
            sa.Column("pdf_generated_at", sa.DateTime(), nullable=True)
        )


def downgrade() -> None:
    if _column_exists("contract_versions", "pdf_generated_at"):
        op.drop_column("contract_versions", "pdf_generated_at")

    if _column_exists("contract_versions", "pdf_base64"):
        op.drop_column("contract_versions", "pdf_base64")

    if _column_exists("contract_versions", "pdf_template_slug"):
        op.drop_column("contract_versions", "pdf_template_slug")
