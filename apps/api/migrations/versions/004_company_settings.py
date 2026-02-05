"""Add company_settings table

Revision ID: 004
Revises: 003
Create Date: 2025-01-31
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'company_settings')"
    ))
    if result.scalar():
        return

    op.create_table(
        "company_settings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("logo_url", sa.String(), nullable=True),
        sa.Column("primary_color", sa.String(), nullable=False, server_default="#4F46E5"),
        sa.Column("company_name", sa.String(), nullable=False, server_default="ContractAI"),
        sa.Column("updated_by", UUID(as_uuid=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # Seed default row
    op.execute(
        "INSERT INTO company_settings (id, primary_color, company_name, updated_at) "
        "VALUES (gen_random_uuid(), '#4F46E5', 'ContractAI', now())"
    )


def downgrade() -> None:
    op.drop_table("company_settings")
