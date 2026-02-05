"""Add contract_templates and supporting_documents tables

Revision ID: 003
Revises: 002
Create Date: 2025-01-31
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # Create tables only if they don't already exist
    if not conn.dialect.has_table(conn, "contract_templates"):
        op.create_table(
            "contract_templates",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column("name", sa.String, nullable=False),
            sa.Column("slug", sa.String, nullable=False, unique=True),
            sa.Column("description", sa.String, nullable=False, server_default=""),
            sa.Column("state", sa.String, nullable=False, server_default="FL"),
            sa.Column("required_fields", sa.JSON, nullable=False, server_default="{}"),
            sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        )
        op.create_index("ix_contract_templates_slug", "contract_templates", ["slug"])

    if not conn.dialect.has_table(conn, "supporting_documents"):
        op.create_table(
            "supporting_documents",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column("deal_id", UUID(as_uuid=True), sa.ForeignKey("deals.id"), nullable=False),
            sa.Column("doc_type", sa.String, nullable=False),
            sa.Column("filename", sa.String, nullable=False),
            sa.Column("extracted_text", sa.Text, nullable=False, server_default=""),
            sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        )
        op.create_index("ix_supporting_documents_deal_id", "supporting_documents", ["deal_id"])

    # Seed templates (only if empty)
    import uuid as _uuid

    row = conn.execute(sa.text("SELECT count(*) FROM contract_templates")).scalar()
    if row == 0:
        far_bar_asis_id = str(_uuid.uuid4())
        far_bar_standard_id = str(_uuid.uuid4())

        asis_fields = '["buyer_name","seller_name","property_address","purchase_price","closing_date","earnest_money","inspection_period_days","financing_type"]'
        standard_fields = '["buyer_name","seller_name","property_address","purchase_price","closing_date","earnest_money","inspection_period_days","financing_type","appraisal_contingency","seller_concessions"]'

        op.execute(
            f"INSERT INTO contract_templates (id, name, slug, description, state, required_fields, is_active) VALUES "
            f"('{far_bar_asis_id}', 'FAR/BAR As-Is Residential', 'far_bar_asis', "
            f"'Florida standard As-Is residential contract. Seller makes no warranties regarding property condition. Commonly used for investor purchases and bank-owned properties.', "
            f"'FL', '{asis_fields}', true)"
        )
        op.execute(
            f"INSERT INTO contract_templates (id, name, slug, description, state, required_fields, is_active) VALUES "
            f"('{far_bar_standard_id}', 'FAR/BAR Standard Residential', 'far_bar_standard', "
            f"'Florida standard residential contract with seller repair obligations. Includes appraisal and financing contingencies. Most common for traditional home purchases.', "
            f"'FL', '{standard_fields}', true)"
        )


def downgrade() -> None:
    op.drop_table("supporting_documents")
    op.drop_table("contract_templates")
