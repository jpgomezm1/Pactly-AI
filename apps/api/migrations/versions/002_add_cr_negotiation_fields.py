"""Add negotiation fields to change_requests

Revision ID: 002
Revises: 001
Create Date: 2025-01-30
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("change_requests", sa.Column("status", sa.String, nullable=False, server_default="open"))
    op.add_column("change_requests", sa.Column("rejection_reason", sa.String, nullable=True))
    op.add_column("change_requests", sa.Column("parent_cr_id", UUID(as_uuid=True), nullable=True))


def downgrade() -> None:
    op.drop_column("change_requests", "parent_cr_id")
    op.drop_column("change_requests", "rejection_reason")
    op.drop_column("change_requests", "status")
