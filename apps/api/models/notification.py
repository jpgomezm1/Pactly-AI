import uuid
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field


class Notification(SQLModel, table=True):
    __tablename__ = "notifications"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    deal_id: Optional[uuid.UUID] = Field(default=None, foreign_key="deals.id")
    type: str  # external_feedback, cr_analyzed, cr_accepted, cr_rejected, version_generated, deal_state_changed
    title: str
    message: str
    is_read: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
