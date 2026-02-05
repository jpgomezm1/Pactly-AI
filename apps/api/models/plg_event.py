import uuid
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import JSON


class PLGEvent(SQLModel, table=True):
    __tablename__ = "plg_events"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    event_type: str = Field(index=True)
    share_link_id: Optional[uuid.UUID] = Field(default=None, foreign_key="share_links.id", index=True)
    session_id: Optional[str] = None
    user_id: Optional[uuid.UUID] = Field(default=None, foreign_key="users.id")
    deal_id: Optional[uuid.UUID] = Field(default=None, foreign_key="deals.id")
    event_metadata: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)
