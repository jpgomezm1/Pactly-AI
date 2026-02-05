"""Deal type, batch feedback, deal acceptance, magic links

Revision ID: 010
Revises: 009
Create Date: 2026-02-02
"""
from alembic import op
import sqlalchemy as sa

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def _table_exists(table: str) -> bool:
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT FROM information_schema.tables "
        "WHERE table_name = :t)"
    ), {"t": table})
    return result.scalar()


def _column_exists(table: str, column: str) -> bool:
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT FROM information_schema.columns "
        "WHERE table_name = :t AND column_name = :c)"
    ), {"t": table, "c": column})
    return result.scalar()


def upgrade() -> None:
    # -- deals.deal_type --
    if not _column_exists("deals", "deal_type"):
        op.add_column(
            "deals",
            sa.Column("deal_type", sa.VARCHAR(), nullable=False, server_default="sale"),
        )

    # -- deals.buyer_accepted_at --
    if not _column_exists("deals", "buyer_accepted_at"):
        op.add_column(
            "deals",
            sa.Column("buyer_accepted_at", sa.DateTime(), nullable=True),
        )

    # -- deals.seller_accepted_at --
    if not _column_exists("deals", "seller_accepted_at"):
        op.add_column(
            "deals",
            sa.Column("seller_accepted_at", sa.DateTime(), nullable=True),
        )

    # -- external_feedback.batch_id --
    if not _column_exists("external_feedback", "batch_id"):
        op.add_column(
            "external_feedback",
            sa.Column("batch_id", sa.VARCHAR(), nullable=True, index=True),
        )

    # -- change_requests.batch_id --
    if not _column_exists("change_requests", "batch_id"):
        op.add_column(
            "change_requests",
            sa.Column("batch_id", sa.VARCHAR(), nullable=True, index=True),
        )

    # -- magic_links table --
    if not _table_exists("magic_links"):
        op.create_table(
            "magic_links",
            sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("user_id", sa.dialects.postgresql.UUID(as_uuid=True),
                       sa.ForeignKey("users.id"), nullable=False, index=True),
            sa.Column("token", sa.VARCHAR(), nullable=False, unique=True, index=True),
            sa.Column("deal_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("redirect_path", sa.VARCHAR(), nullable=True),
            sa.Column("expires_at", sa.DateTime(), nullable=False),
            sa.Column("used_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )


def downgrade() -> None:
    if _table_exists("magic_links"):
        op.drop_table("magic_links")
    if _column_exists("change_requests", "batch_id"):
        op.drop_column("change_requests", "batch_id")
    if _column_exists("external_feedback", "batch_id"):
        op.drop_column("external_feedback", "batch_id")
    if _column_exists("deals", "seller_accepted_at"):
        op.drop_column("deals", "seller_accepted_at")
    if _column_exists("deals", "buyer_accepted_at"):
        op.drop_column("deals", "buyer_accepted_at")
    if _column_exists("deals", "deal_type"):
        op.drop_column("deals", "deal_type")
