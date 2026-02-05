import enum
import uuid
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field


class NegotiationState(str, enum.Enum):
    draft = "draft"
    waiting_on_seller = "waiting_on_seller"
    waiting_on_buyer = "waiting_on_buyer"
    counter_sent = "counter_sent"
    final_review = "final_review"
    accepted = "accepted"


class NegotiationCycle(SQLModel, table=True):
    __tablename__ = "negotiation_cycles"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    deal_id: uuid.UUID = Field(foreign_key="deals.id", index=True)
    cycle_number: int = Field(default=1)
    state: str = Field(default=NegotiationState.draft.value)
    initiated_by: Optional[uuid.UUID] = Field(default=None, foreign_key="users.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
