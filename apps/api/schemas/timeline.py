from __future__ import annotations

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class TimelineEvent(BaseModel):
    id: str
    action: str
    details: Optional[dict]
    user_id: Optional[str]
    created_at: datetime


class TimelineResponse(BaseModel):
    deal_id: str
    current_state: str
    events: list[TimelineEvent]


class AuditEventResponse(BaseModel):
    id: str
    deal_id: str
    user_id: Optional[str]
    action: str
    details: Optional[dict]
    created_at: datetime

    class Config:
        from_attributes = True
