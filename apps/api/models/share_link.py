import uuid
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field


class ShareLink(SQLModel, table=True):
    __tablename__ = "share_links"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    deal_id: uuid.UUID = Field(foreign_key="deals.id", index=True)
    token: str = Field(index=True, unique=True)
    created_by: uuid.UUID = Field(foreign_key="users.id")
    counterparty_name: str
    counterparty_email: Optional[str] = None
    expires_at: Optional[datetime] = None
    is_active: bool = Field(default=True)
    slug: Optional[str] = Field(default=None, index=True, unique=True)
    cached_insight: Optional[str] = None
    last_viewed_version_number: Optional[int] = None
    last_visit_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
