import uuid
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import Text


class SupportingDocument(SQLModel, table=True):
    __tablename__ = "supporting_documents"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    deal_id: uuid.UUID = Field(foreign_key="deals.id", index=True)
    doc_type: str  # mls_listing, inspection_report, pre_approval_letter
    filename: str
    extracted_text: str = Field(sa_column=Column(Text, nullable=False, default=""))
    created_by: uuid.UUID = Field(foreign_key="users.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
