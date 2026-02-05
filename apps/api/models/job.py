import uuid
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import JSON


class JobRecord(SQLModel, table=True):
    __tablename__ = "job_records"

    id: str = Field(primary_key=True)  # celery task id
    deal_id: uuid.UUID = Field(foreign_key="deals.id", index=True)
    job_type: str  # parse_contract, analyze_change_request, generate_version
    status: str = Field(default="pending")  # pending, processing, completed, failed
    result: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    error: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
