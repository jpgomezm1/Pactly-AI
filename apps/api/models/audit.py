import uuid
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import JSON, Text


class AuditEvent(SQLModel, table=True):
    __tablename__ = "audit_events"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    deal_id: uuid.UUID = Field(foreign_key="deals.id", index=True)
    user_id: Optional[uuid.UUID] = Field(default=None, foreign_key="users.id")
    action: str  # e.g. "contract_uploaded", "change_request_created", "version_generated"
    details: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)
