from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class GenerateOfferLetterRequest(BaseModel):
    prompt: str  # User's natural language request


class OfferLetterUpdate(BaseModel):
    buyer_name: Optional[str] = None
    seller_name: Optional[str] = None
    property_address: Optional[str] = None
    purchase_price: Optional[float] = None
    earnest_money: Optional[float] = None
    closing_date: Optional[str] = None
    contingencies: Optional[List[str]] = None
    additional_terms: Optional[str] = None
    full_text: Optional[str] = None
    status: Optional[str] = None


class OfferLetterResponse(BaseModel):
    id: str
    deal_id: str
    user_prompt: str
    full_text: str
    buyer_name: Optional[str] = None
    seller_name: Optional[str] = None
    property_address: Optional[str] = None
    purchase_price: Optional[float] = None
    earnest_money: Optional[float] = None
    closing_date: Optional[str] = None
    contingencies: Optional[List[str]] = None
    additional_terms: Optional[str] = None
    prompt_version: str
    status: str
    created_by: str
    created_at: datetime
    updated_at: Optional[datetime] = None
