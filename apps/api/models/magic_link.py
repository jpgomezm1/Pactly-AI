import uuid
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field


class MagicLink(SQLModel, table=True):
    __tablename__ = "magic_links"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    token: str = Field(index=True, unique=True)
    deal_id: Optional[uuid.UUID] = None
    redirect_path: Optional[str] = None
    expires_at: datetime
    used_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
