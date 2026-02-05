import uuid
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import Text, JSON


class ChangeRequest(SQLModel, table=True):
    __tablename__ = "change_requests"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    deal_id: uuid.UUID = Field(foreign_key="deals.id", index=True)
    raw_text: str = Field(sa_column=Column(Text, nullable=False))
    created_by: uuid.UUID = Field(foreign_key="users.id")
    role: str = Field(default="buyer_agent")
    cycle_id: Optional[uuid.UUID] = None

    # Negotiation status
    status: str = Field(default="open")  # open, accepted, rejected, countered
    rejection_reason: Optional[str] = None
    parent_cr_id: Optional[uuid.UUID] = None  # links counter to original CR
    batch_id: Optional[str] = Field(default=None, index=True)

    # AI analysis result
    analysis_status: str = Field(default="pending")  # pending, processing, completed, failed
    analysis_result: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    analysis_job_id: Optional[str] = None
    prompt_version: Optional[str] = None

    # Token usage tracking
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)
    analyzed_at: Optional[datetime] = None
