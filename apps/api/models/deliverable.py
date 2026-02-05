import uuid
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import Text


class Deliverable(SQLModel, table=True):
    __tablename__ = "deliverables"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    deal_id: uuid.UUID = Field(foreign_key="deals.id", index=True)
    description: str
    due_date: str  # YYYY-MM-DD or descriptive string
    category: str = Field(default="other")
    responsible_party: str = Field(default="admin")  # "admin" or "counterparty"
    ai_suggested_party: Optional[str] = None
    is_confirmed: bool = Field(default=False)
    status: str = Field(default="pending")  # pending | submitted | approved | overdue
    filename: Optional[str] = None
    file_content_base64: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    submitted_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    approved_by: Optional[uuid.UUID] = Field(default=None, foreign_key="users.id")
    reminder_7d_sent: bool = Field(default=False)
    reminder_3d_sent: bool = Field(default=False)
    reminder_1d_sent: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
