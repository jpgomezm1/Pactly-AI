"""Create deliverables table

Revision ID: 013
Revises: 012
Create Date: 2026-02-02
"""
from alembic import op
import sqlalchemy as sa

revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def _table_exists(name: str) -> bool:
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = :t)"
    ), {"t": name})
    return result.scalar()


def upgrade() -> None:
    if _table_exists("deliverables"):
        return

    op.create_table(
        "deliverables",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("deal_id", sa.Uuid(), sa.ForeignKey("deals.id"), nullable=False, index=True),
        sa.Column("description", sa.String(), nullable=False),
        sa.Column("due_date", sa.String(), nullable=False),
        sa.Column("category", sa.String(), nullable=False, server_default="other"),
        sa.Column("responsible_party", sa.String(), nullable=False, server_default="admin"),
        sa.Column("ai_suggested_party", sa.String(), nullable=True),
        sa.Column("is_confirmed", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("filename", sa.String(), nullable=True),
        sa.Column("file_content_base64", sa.Text(), nullable=True),
        sa.Column("submitted_at", sa.DateTime(), nullable=True),
        sa.Column("approved_at", sa.DateTime(), nullable=True),
        sa.Column("approved_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("reminder_7d_sent", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("reminder_3d_sent", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("reminder_1d_sent", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    if _table_exists("deliverables"):
        op.drop_table("deliverables")
