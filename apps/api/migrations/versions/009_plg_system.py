"""PLG system: plg_events table, share_links slug/cached_insight, users referred_by

Revision ID: 009
Revises: 008
Create Date: 2026-02-02
"""
from alembic import op
import sqlalchemy as sa

revision = "009"
down_revision = "008"
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
    # -- plg_events table --
    if not _table_exists("plg_events"):
        op.create_table(
            "plg_events",
            sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("event_type", sa.VARCHAR(), nullable=False, index=True),
            sa.Column("share_link_id", sa.dialects.postgresql.UUID(as_uuid=True),
                       sa.ForeignKey("share_links.id"), nullable=True, index=True),
            sa.Column("session_id", sa.VARCHAR(), nullable=True),
            sa.Column("user_id", sa.dialects.postgresql.UUID(as_uuid=True),
                       sa.ForeignKey("users.id"), nullable=True),
            sa.Column("deal_id", sa.dialects.postgresql.UUID(as_uuid=True),
                       sa.ForeignKey("deals.id"), nullable=True),
            sa.Column("event_metadata", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

    # -- share_links: add slug --
    if not _column_exists("share_links", "slug"):
        op.add_column(
            "share_links",
            sa.Column("slug", sa.VARCHAR(), nullable=True, unique=True, index=True),
        )

    # -- share_links: add cached_insight --
    if not _column_exists("share_links", "cached_insight"):
        op.add_column(
            "share_links",
            sa.Column("cached_insight", sa.Text(), nullable=True),
        )

    # -- users: add referred_by_share_link_id --
    if not _column_exists("users", "referred_by_share_link_id"):
        op.add_column(
            "users",
            sa.Column(
                "referred_by_share_link_id",
                sa.dialects.postgresql.UUID(as_uuid=True),
                sa.ForeignKey("share_links.id"),
                nullable=True,
            ),
        )


def downgrade() -> None:
    if _column_exists("users", "referred_by_share_link_id"):
        op.drop_column("users", "referred_by_share_link_id")
    if _column_exists("share_links", "cached_insight"):
        op.drop_column("share_links", "cached_insight")
    if _column_exists("share_links", "slug"):
        op.drop_column("share_links", "slug")
    if _table_exists("plg_events"):
        op.drop_table("plg_events")
