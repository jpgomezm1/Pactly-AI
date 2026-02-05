from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel


class OrgCreateRequest(BaseModel):
    name: str
    slug: str
    plan: str = "starter"
    billing_anchor_day: int = 1
    billing_cycle: str = "monthly"


class OrgUpdateRequest(BaseModel):
    name: Optional[str] = None
    plan: Optional[str] = None
    is_active: Optional[bool] = None
    billing_anchor_day: Optional[int] = None
    billing_cycle: Optional[str] = None
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None


class OrgResponse(BaseModel):
    id: str
    name: str
    slug: str
    plan: str
    is_active: bool
    logo_url: Optional[str] = None
    primary_color: str
    billing_anchor_day: int
    billing_cycle: str
    created_at: datetime
    user_count: Optional[int] = None
    deal_count: Optional[int] = None


class OrgUserCreateRequest(BaseModel):
    email: str
    full_name: str
    password: str
    role: str = "admin"


class OrgUsageResponse(BaseModel):
    period_start: str
    period_end: str
    tokens_included: int
    tokens_used: int
    extra_tokens_used: int
