import enum
import uuid
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field


class PlanTier(str, enum.Enum):
    starter = "starter"
    growth = "growth"
    business = "business"
    enterprise = "enterprise"


class BillingCycle(str, enum.Enum):
    monthly = "monthly"
    annual = "annual"


PLAN_LIMITS = {
    PlanTier.starter: {
        "tokens": 5,
        "users": 3,
        "branding": False,
        "extra_token_price": 5.00,
    },
    PlanTier.growth: {
        "tokens": 15,
        "users": 10,
        "branding": True,
        "extra_token_price": 3.50,
    },
    PlanTier.business: {
        "tokens": 40,
        "users": 50,
        "branding": True,
        "extra_token_price": 2.00,
    },
    PlanTier.enterprise: {
        "tokens": 100,
        "users": -1,   # unlimited users
        "branding": True,
        "extra_token_price": 0.00,
    },
}


class Organization(SQLModel, table=True):
    __tablename__ = "organizations"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str
    slug: str = Field(unique=True, index=True)
    plan: PlanTier = Field(default=PlanTier.starter)
    is_active: bool = Field(default=True)
    logo_url: Optional[str] = None
    primary_color: str = Field(default="#14B8A6")
    billing_anchor_day: int = Field(default=1)
    billing_cycle: BillingCycle = Field(default=BillingCycle.monthly)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
