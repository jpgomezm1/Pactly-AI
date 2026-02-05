import uuid
from datetime import datetime
from typing import Optional, List
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import Text
from sqlalchemy.dialects.postgresql import JSONB


class OfferLetter(SQLModel, table=True):
    __tablename__ = "offer_letters"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    deal_id: uuid.UUID = Field(foreign_key="deals.id", index=True)

    # Input
    user_prompt: str = Field(sa_column=Column(Text, nullable=False))

    # Generated content
    full_text: str = Field(sa_column=Column(Text, nullable=False))

    # Extracted fields (for display/editing)
    buyer_name: Optional[str] = None
    seller_name: Optional[str] = None
    property_address: Optional[str] = None
    purchase_price: Optional[float] = None
    earnest_money: Optional[float] = None
    closing_date: Optional[str] = None
    contingencies: Optional[List[str]] = Field(default=None, sa_column=Column(JSONB))
    additional_terms: Optional[str] = Field(default=None, sa_column=Column(Text))

    # Metadata
    prompt_version: str = Field(default="generate_offer_letter_v1")
    status: str = Field(default="draft")  # "draft" | "sent" | "accepted"
    created_by: uuid.UUID = Field(foreign_key="users.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
