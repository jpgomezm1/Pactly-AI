import uuid
from datetime import date, datetime
from sqlmodel import SQLModel, Field


class TokenUsage(SQLModel, table=True):
    __tablename__ = "token_usage"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    organization_id: uuid.UUID = Field(foreign_key="organizations.id", index=True)
    period_start: date
    period_end: date
    tokens_included: int = Field(default=0)
    tokens_used: int = Field(default=0)
    extra_tokens_used: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)
