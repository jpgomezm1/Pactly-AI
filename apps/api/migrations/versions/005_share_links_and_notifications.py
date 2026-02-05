"""Add share_links, external_feedback, and notifications tables

Revision ID: 005
Revises: 004
Create Date: 2025-01-31
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def _table_exists(name: str) -> bool:
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = :t)"
    ), {"t": name})
    return result.scalar()


def upgrade() -> None:
    if not _table_exists("share_links"):
        op.create_table(
            "share_links",
            sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("deal_id", UUID(as_uuid=True), sa.ForeignKey("deals.id"), nullable=False, index=True),
            sa.Column("token", sa.String(), nullable=False, unique=True, index=True),
            sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("counterparty_name", sa.String(), nullable=False),
            sa.Column("counterparty_email", sa.String(), nullable=True),
            sa.Column("expires_at", sa.DateTime(), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

    if not _table_exists("external_feedback"):
        op.create_table(
            "external_feedback",
            sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("share_link_id", UUID(as_uuid=True), sa.ForeignKey("share_links.id"), nullable=False, index=True),
            sa.Column("deal_id", UUID(as_uuid=True), sa.ForeignKey("deals.id"), nullable=False, index=True),
            sa.Column("reviewer_name", sa.String(), nullable=False),
            sa.Column("reviewer_email", sa.String(), nullable=True),
            sa.Column("feedback_text", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

    if not _table_exists("notifications"):
        op.create_table(
            "notifications",
            sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False, index=True),
            sa.Column("deal_id", UUID(as_uuid=True), sa.ForeignKey("deals.id"), nullable=True),
            sa.Column("type", sa.String(), nullable=False),
            sa.Column("title", sa.String(), nullable=False),
            sa.Column("message", sa.String(), nullable=False),
            sa.Column("is_read", sa.Boolean(), nullable=False, server_default="false"),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )


def downgrade() -> None:
    op.drop_table("notifications")
    op.drop_table("external_feedback")
    op.drop_table("share_links")
