"""Initial schema

Revision ID: 001
Revises:
Create Date: 2025-01-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String, nullable=False, unique=True, index=True),
        sa.Column("hashed_password", sa.String, nullable=False),
        sa.Column("full_name", sa.String, nullable=False),
        sa.Column("role", sa.String, nullable=False, server_default="buyer_agent"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=True),
    )

    op.create_table(
        "deals",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String, nullable=False),
        sa.Column("address", sa.String, nullable=True),
        sa.Column("description", sa.String, nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("current_state", sa.String, nullable=False, server_default="draft"),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=True),
    )

    op.create_table(
        "deal_assignments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("deal_id", UUID(as_uuid=True), sa.ForeignKey("deals.id"), nullable=False, index=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("role_in_deal", sa.String, nullable=False),
        sa.Column("assigned_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "contract_versions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("deal_id", UUID(as_uuid=True), sa.ForeignKey("deals.id"), nullable=False, index=True),
        sa.Column("version_number", sa.Integer, nullable=False, server_default="0"),
        sa.Column("full_text", sa.Text, nullable=False, server_default=""),
        sa.Column("extracted_fields", sa.JSON, nullable=True),
        sa.Column("clause_tags", sa.JSON, nullable=True),
        sa.Column("contract_type", sa.String, nullable=False, server_default="UNKNOWN"),
        sa.Column("change_summary", sa.JSON, nullable=True),
        sa.Column("source", sa.String, nullable=False, server_default="upload"),
        sa.Column("source_cr_id", UUID(as_uuid=True), nullable=True),
        sa.Column("cycle_id", UUID(as_uuid=True), nullable=True),
        sa.Column("prompt_version", sa.String, nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "change_requests",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("deal_id", UUID(as_uuid=True), sa.ForeignKey("deals.id"), nullable=False, index=True),
        sa.Column("raw_text", sa.Text, nullable=False),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("role", sa.String, nullable=False, server_default="buyer_agent"),
        sa.Column("cycle_id", UUID(as_uuid=True), nullable=True),
        sa.Column("analysis_status", sa.String, nullable=False, server_default="pending"),
        sa.Column("analysis_result", sa.JSON, nullable=True),
        sa.Column("analysis_job_id", sa.String, nullable=True),
        sa.Column("prompt_version", sa.String, nullable=True),
        sa.Column("input_tokens", sa.Integer, nullable=True),
        sa.Column("output_tokens", sa.Integer, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("analyzed_at", sa.DateTime, nullable=True),
    )

    op.create_table(
        "negotiation_cycles",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("deal_id", UUID(as_uuid=True), sa.ForeignKey("deals.id"), nullable=False, index=True),
        sa.Column("cycle_number", sa.Integer, nullable=False, server_default="1"),
        sa.Column("state", sa.String, nullable=False, server_default="draft"),
        sa.Column("initiated_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=True),
    )

    op.create_table(
        "audit_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("deal_id", UUID(as_uuid=True), sa.ForeignKey("deals.id"), nullable=False, index=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("action", sa.String, nullable=False),
        sa.Column("details", sa.JSON, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "job_records",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("deal_id", UUID(as_uuid=True), sa.ForeignKey("deals.id"), nullable=False, index=True),
        sa.Column("job_type", sa.String, nullable=False),
        sa.Column("status", sa.String, nullable=False, server_default="pending"),
        sa.Column("result", sa.JSON, nullable=True),
        sa.Column("error", sa.String, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime, nullable=True),
    )


def downgrade() -> None:
    op.drop_table("job_records")
    op.drop_table("audit_events")
    op.drop_table("negotiation_cycles")
    op.drop_table("change_requests")
    op.drop_table("contract_versions")
    op.drop_table("deal_assignments")
    op.drop_table("deals")
    op.drop_table("users")
