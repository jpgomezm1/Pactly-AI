import uuid
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field


class CompanySettings(SQLModel, table=True):
    __tablename__ = "company_settings"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    logo_url: Optional[str] = None
    primary_color: str = Field(default="#4F46E5")
    company_name: str = Field(default="ContractAI")
    email_notifications_enabled: bool = Field(default=False)
    updated_by: Optional[uuid.UUID] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)
