from __future__ import annotations

from pydantic import BaseModel
from typing import Optional, Union
from datetime import datetime


class ContractPasteRequest(BaseModel):
    text: str


class ContractVersionResponse(BaseModel):
    id: str
    deal_id: str
    version_number: int
    full_text: str
    extracted_fields: Optional[dict]
    clause_tags: Optional[list]
    contract_type: str
    change_summary: Optional[dict]
    source: str
    source_cr_id: Optional[str]
    cycle_id: Optional[str]
    prompt_version: Optional[str]
    created_by: str
    created_at: datetime

    class Config:
        from_attributes = True


class DiffResponse(BaseModel):
    version_a_id: str
    version_b_id: str
    version_a_number: int
    version_b_number: int
    diff_html: str
    diff_lines: list
    field_changes: Optional[list] = None


class ContractTemplateResponse(BaseModel):
    id: str
    name: str
    slug: str
    description: str
    state: str
    required_fields: Union[list, dict]

    class Config:
        from_attributes = True


class ContractGenerateRequest(BaseModel):
    template_id: str
    deal_details: dict  # buyer_name, seller_name, property_address, purchase_price, etc.
    supporting_doc_ids: list[str] = []


class SupportingDocResponse(BaseModel):
    id: str
    deal_id: str
    doc_type: str
    filename: str
    created_at: datetime

    class Config:
        from_attributes = True


class PDFGenerateRequest(BaseModel):
    template_slug: str
    deal_data: Optional[dict] = None  # Override data; if None, uses extracted_fields
    flatten: bool = False  # Make PDF non-editable


class PDFGenerateResponse(BaseModel):
    pdf_base64: str
    filename: str
    template_used: str
    template_version: str
    warnings: list[str]


class PDFTemplateInfo(BaseModel):
    slug: str
    name: str
    version: str
    pdf_file: str
