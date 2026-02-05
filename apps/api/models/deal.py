import uuid
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import Text


class Deal(SQLModel, table=True):
    __tablename__ = "deals"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    title: str
    address: Optional[str] = None
    description: Optional[str] = None
    deal_type: str = Field(default="sale")  # "sale" or "purchase"
    created_by: uuid.UUID = Field(foreign_key="users.id")
    organization_id: Optional[uuid.UUID] = Field(default=None, foreign_key="organizations.id")
    current_state: str = Field(default="draft")  # NegotiationState value
    buyer_accepted_at: Optional[datetime] = None
    seller_accepted_at: Optional[datetime] = None
    timeline_pdf_base64: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    timeline_generated_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None


class DealAssignment(SQLModel, table=True):
    __tablename__ = "deal_assignments"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    deal_id: uuid.UUID = Field(foreign_key="deals.id", index=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    role_in_deal: str  # buyer_agent, seller_agent, transaction_coordinator
    assigned_at: datetime = Field(default_factory=datetime.utcnow)
