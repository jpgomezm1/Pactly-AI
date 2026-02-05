from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime


class DealCreate(BaseModel):
    title: str
    address: Optional[str] = None
    description: Optional[str] = None
    deal_type: str = "sale"

    @field_validator("deal_type")
    @classmethod
    def validate_deal_type(cls, v: str) -> str:
        if v not in ("purchase", "sale"):
            raise ValueError("deal_type must be 'purchase' or 'sale'")
        return v


class DealResponse(BaseModel):
    id: str
    title: str
    address: Optional[str]
    description: Optional[str]
    deal_type: str
    created_by: str
    current_state: str
    buyer_accepted_at: Optional[datetime] = None
    seller_accepted_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class DealHealthMetrics(BaseModel):
    health_score: int
    health_status: str  # healthy, needs_attention, at_risk
    days_since_last_activity: int = 0
    days_in_current_state: int = 0
    open_crs: int = 0
    versions_count: int = 0
    issues: list[str] = []


class EnrichedDealResponse(DealResponse):
    health_score: Optional[int] = None
    health_status: Optional[str] = None
    days_since_last_activity: Optional[int] = None
    days_in_current_state: Optional[int] = None
    open_crs: Optional[int] = None
    versions_count: Optional[int] = None
    issues: list[str] = []


class HealthSummary(BaseModel):
    total: int
    healthy_count: int
    needs_attention_count: int
    at_risk_count: int


class DealAssignRequest(BaseModel):
    user_id: str
    role_in_deal: str  # buyer_agent, seller_agent, transaction_coordinator


class DealAssignmentResponse(BaseModel):
    id: str
    deal_id: str
    user_id: str
    role_in_deal: str
    assigned_at: datetime

    class Config:
        from_attributes = True
