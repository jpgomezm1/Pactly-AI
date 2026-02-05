"""Create offer_letters table

Revision ID: 014
Revises: 013
Create Date: 2026-02-03
"""
from alembic import op
import sqlalchemy as sa

revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None


def _table_exists(name: str) -> bool:
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = :t)"
    ), {"t": name})
    return result.scalar()


def upgrade() -> None:
    if _table_exists("offer_letters"):
        return

    op.create_table(
        "offer_letters",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("deal_id", sa.Uuid(), sa.ForeignKey("deals.id"), nullable=False, index=True),
        sa.Column("user_prompt", sa.Text(), nullable=False),
        sa.Column("full_text", sa.Text(), nullable=False),
        sa.Column("buyer_name", sa.String(255), nullable=True),
        sa.Column("seller_name", sa.String(255), nullable=True),
        sa.Column("property_address", sa.String(500), nullable=True),
        sa.Column("purchase_price", sa.Float(), nullable=True),
        sa.Column("earnest_money", sa.Float(), nullable=True),
        sa.Column("closing_date", sa.String(50), nullable=True),
        sa.Column("contingencies", sa.dialects.postgresql.JSONB(), nullable=True),
        sa.Column("additional_terms", sa.Text(), nullable=True),
        sa.Column("prompt_version", sa.String(50), nullable=False, server_default="generate_offer_letter_v1"),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("created_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    if _table_exists("offer_letters"):
        op.drop_table("offer_letters")
