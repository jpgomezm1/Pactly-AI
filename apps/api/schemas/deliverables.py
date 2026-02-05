import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class DeliverableResponse(BaseModel):
    id: str
    deal_id: str
    description: str
    due_date: str
    category: str
    responsible_party: str
    ai_suggested_party: Optional[str] = None
    is_confirmed: bool
    status: str
    filename: Optional[str] = None
    submitted_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    approved_by: Optional[str] = None
    reminder_7d_sent: bool = False
    reminder_3d_sent: bool = False
    reminder_1d_sent: bool = False
    created_at: datetime
    updated_at: Optional[datetime] = None


class DeliverablePublicResponse(BaseModel):
    id: str
    description: str
    due_date: str
    category: str
    responsible_party: str
    status: str
    filename: Optional[str] = None
    submitted_at: Optional[datetime] = None
    created_at: datetime


class DeliverableUpdate(BaseModel):
    responsible_party: Optional[str] = None
    is_confirmed: Optional[bool] = None
    status: Optional[str] = None
