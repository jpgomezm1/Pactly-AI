import uuid
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import Text


class ExternalFeedback(SQLModel, table=True):
    __tablename__ = "external_feedback"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    share_link_id: uuid.UUID = Field(foreign_key="share_links.id", index=True)
    deal_id: uuid.UUID = Field(foreign_key="deals.id", index=True)
    reviewer_name: str
    reviewer_email: Optional[str] = None
    feedback_text: str = Field(sa_column=Column(Text, nullable=False))
    change_request_id: Optional[uuid.UUID] = Field(default=None, foreign_key="change_requests.id")
    batch_id: Optional[str] = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
