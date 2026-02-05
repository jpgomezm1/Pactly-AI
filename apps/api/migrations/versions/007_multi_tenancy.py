"""Multi-tenancy: organizations, token_usage, org scoping

Revision ID: 007
Revises: 006
Create Date: 2025-02-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def _table_exists(name: str) -> bool:
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = :t)"
    ), {"t": name})
    return result.scalar()


def _column_exists(table: str, column: str) -> bool:
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT FROM information_schema.columns "
        "WHERE table_name = :t AND column_name = :c)"
    ), {"t": table, "c": column})
    return result.scalar()


def _enum_value_exists(enum_name: str, value: str) -> bool:
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = :v "
        "AND enumtypid = (SELECT oid FROM pg_type WHERE typname = :e))"
    ), {"v": value, "e": enum_name})
    return result.scalar()


def upgrade() -> None:
    # --- Create organizations table ---
    if not _table_exists("organizations"):
        op.create_table(
            "organizations",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column("name", sa.String, nullable=False),
            sa.Column("slug", sa.String, nullable=False, unique=True),
            sa.Column("plan", sa.String, nullable=False, server_default="starter"),
            sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
            sa.Column("logo_url", sa.String, nullable=True),
            sa.Column("primary_color", sa.String, nullable=False, server_default="#14B8A6"),
            sa.Column("billing_anchor_day", sa.Integer, nullable=False, server_default="1"),
            sa.Column("billing_cycle", sa.String, nullable=False, server_default="monthly"),
            sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime, nullable=True),
        )
        op.create_index("ix_organizations_slug", "organizations", ["slug"])

    # --- Create token_usage table ---
    if not _table_exists("token_usage"):
        op.create_table(
            "token_usage",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column("organization_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
            sa.Column("period_start", sa.Date, nullable=False),
            sa.Column("period_end", sa.Date, nullable=False),
            sa.Column("tokens_included", sa.Integer, nullable=False, server_default="0"),
            sa.Column("tokens_used", sa.Integer, nullable=False, server_default="0"),
            sa.Column("extra_tokens_used", sa.Integer, nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        )
        op.create_index("ix_token_usage_organization_id", "token_usage", ["organization_id"])

    # --- Add super_admin to userrole enum ---
    if not _enum_value_exists("userrole", "super_admin"):
        op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'super_admin'")

    # --- Create default organization for backfill ---
    conn = op.get_bind()
    import uuid as _uuid
    default_org_id = str(_uuid.uuid4())

    # Check if any org already exists
    existing = conn.execute(sa.text("SELECT id FROM organizations LIMIT 1")).first()
    if not existing:
        conn.execute(sa.text(
            "INSERT INTO organizations (id, name, slug, plan, is_active, primary_color, billing_anchor_day, billing_cycle, created_at) "
            "VALUES (:id, 'Default', 'default', 'growth', true, '#14B8A6', 1, 'monthly', NOW())"
        ), {"id": default_org_id})
    else:
        default_org_id = str(existing[0])

    # --- Add organization_id to users ---
    if not _column_exists("users", "organization_id"):
        op.add_column(
            "users",
            sa.Column("organization_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=True),
        )
        # Backfill existing users
        conn.execute(sa.text(
            "UPDATE users SET organization_id = :org_id WHERE organization_id IS NULL"
        ), {"org_id": default_org_id})

    # --- Add organization_id to deals ---
    if not _column_exists("deals", "organization_id"):
        op.add_column(
            "deals",
            sa.Column("organization_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=True),
        )
        # Backfill existing deals
        conn.execute(sa.text(
            "UPDATE deals SET organization_id = :org_id WHERE organization_id IS NULL"
        ), {"org_id": default_org_id})


def downgrade() -> None:
    op.drop_column("deals", "organization_id")
    op.drop_column("users", "organization_id")
    op.drop_table("token_usage")
    op.drop_table("organizations")
