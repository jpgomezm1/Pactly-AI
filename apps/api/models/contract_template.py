import uuid
from typing import Optional
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import JSON


class ContractTemplate(SQLModel, table=True):
    __tablename__ = "contract_templates"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str
    slug: str = Field(unique=True, index=True)
    description: str = ""
    state: str = Field(default="FL")
    required_fields: dict = Field(default_factory=dict, sa_column=Column(JSON))
    is_active: bool = Field(default=True)
