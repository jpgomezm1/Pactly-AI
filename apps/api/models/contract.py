import uuid
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import Text, JSON


class ContractVersion(SQLModel, table=True):
    __tablename__ = "contract_versions"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    deal_id: uuid.UUID = Field(foreign_key="deals.id", index=True)
    version_number: int = Field(default=0)
    full_text: str = Field(sa_column=Column(Text, nullable=False, default=""))
    extracted_fields: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    clause_tags: Optional[list] = Field(default=None, sa_column=Column(JSON))
    contract_type: str = Field(default="UNKNOWN")
    change_summary: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    source: str = Field(default="upload")  # upload, paste, generated
    source_cr_id: Optional[uuid.UUID] = None
    cycle_id: Optional[uuid.UUID] = None
    prompt_version: Optional[str] = None
    risk_flags: Optional[list] = Field(default=None, sa_column=Column(JSON, name="risk_flags"))
    risk_analysis_status: str = Field(default="pending")
    risk_prompt_version: Optional[str] = None
    suggestions: Optional[list] = Field(default=None, sa_column=Column(JSON, name="suggestions"))
    pdf_template_slug: Optional[str] = None
    pdf_base64: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    pdf_generated_at: Optional[datetime] = None
    created_by: uuid.UUID = Field(foreign_key="users.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
