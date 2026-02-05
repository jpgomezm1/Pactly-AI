"""Diff tracking, risk flags, deal health indexes

Revision ID: 011
Revises: 010
Create Date: 2026-02-02
"""
from alembic import op
import sqlalchemy as sa

revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def _column_exists(table: str, column: str) -> bool:
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT FROM information_schema.columns "
        "WHERE table_name = :t AND column_name = :c)"
    ), {"t": table, "c": column})
    return result.scalar()


def _index_exists(index_name: str) -> bool:
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT FROM pg_indexes WHERE indexname = :n)"
    ), {"n": index_name})
    return result.scalar()


def upgrade() -> None:
    # -- Priority 1: counterparty visit tracking --
    if not _column_exists("share_links", "last_viewed_version_number"):
        op.add_column(
            "share_links",
            sa.Column("last_viewed_version_number", sa.Integer(), nullable=True),
        )
    if not _column_exists("share_links", "last_visit_at"):
        op.add_column(
            "share_links",
            sa.Column("last_visit_at", sa.DateTime(), nullable=True),
        )

    # -- Priority 2: risk analysis on contract versions --
    if not _column_exists("contract_versions", "risk_flags"):
        op.add_column(
            "contract_versions",
            sa.Column("risk_flags", sa.JSON(), nullable=True),
        )
    if not _column_exists("contract_versions", "risk_analysis_status"):
        op.add_column(
            "contract_versions",
            sa.Column("risk_analysis_status", sa.VARCHAR(), nullable=False, server_default="pending"),
        )
    if not _column_exists("contract_versions", "risk_prompt_version"):
        op.add_column(
            "contract_versions",
            sa.Column("risk_prompt_version", sa.VARCHAR(), nullable=True),
        )
    if not _column_exists("contract_versions", "suggestions"):
        op.add_column(
            "contract_versions",
            sa.Column("suggestions", sa.JSON(), nullable=True),
        )

    # -- Priority 3: performance indexes --
    if not _index_exists("idx_audit_events_deal_created"):
        op.create_index(
            "idx_audit_events_deal_created",
            "audit_events",
            ["deal_id", sa.text("created_at DESC")],
        )
    if not _index_exists("idx_change_requests_deal_status"):
        op.create_index(
            "idx_change_requests_deal_status",
            "change_requests",
            ["deal_id", "status"],
        )


def downgrade() -> None:
    if _index_exists("idx_change_requests_deal_status"):
        op.drop_index("idx_change_requests_deal_status", table_name="change_requests")
    if _index_exists("idx_audit_events_deal_created"):
        op.drop_index("idx_audit_events_deal_created", table_name="audit_events")
    if _column_exists("contract_versions", "suggestions"):
        op.drop_column("contract_versions", "suggestions")
    if _column_exists("contract_versions", "risk_prompt_version"):
        op.drop_column("contract_versions", "risk_prompt_version")
    if _column_exists("contract_versions", "risk_analysis_status"):
        op.drop_column("contract_versions", "risk_analysis_status")
    if _column_exists("contract_versions", "risk_flags"):
        op.drop_column("contract_versions", "risk_flags")
    if _column_exists("share_links", "last_visit_at"):
        op.drop_column("share_links", "last_visit_at")
    if _column_exists("share_links", "last_viewed_version_number"):
        op.drop_column("share_links", "last_viewed_version_number")
