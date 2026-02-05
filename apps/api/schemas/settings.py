from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class CompanySettingsResponse(BaseModel):
    logo_url: Optional[str] = None
    primary_color: str
    company_name: str
    updated_at: datetime

    class Config:
        from_attributes = True


class CompanySettingsUpdateRequest(BaseModel):
    primary_color: Optional[str] = None
    company_name: Optional[str] = None
    logo_url: Optional[str] = None
