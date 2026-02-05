from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ChangeRequestCreate(BaseModel):
    raw_text: str


class ChangeRequestResponse(BaseModel):
    id: str
    deal_id: str
    raw_text: str
    created_by: str
    role: str
    cycle_id: Optional[str]
    status: str
    rejection_reason: Optional[str]
    parent_cr_id: Optional[str]
    batch_id: Optional[str] = None
    analysis_status: str
    analysis_result: Optional[dict]
    analysis_job_id: Optional[str]
    prompt_version: Optional[str]
    input_tokens: Optional[int]
    output_tokens: Optional[int]
    created_at: datetime
    analyzed_at: Optional[datetime]

    class Config:
        from_attributes = True


class AnalyzeResponse(BaseModel):
    job_id: str
    status: str


class GenerateVersionRequest(BaseModel):
    change_request_id: str


class GenerateVersionResponse(BaseModel):
    job_id: str
    status: str


class RejectRequest(BaseModel):
    reason: Optional[str] = None


class CounterRequest(BaseModel):
    counter_text: str


class AcceptResponse(BaseModel):
    job_id: str
    new_state: str


class RejectResponse(BaseModel):
    new_state: str


class CounterResponse(BaseModel):
    id: str
    deal_id: str
    raw_text: str
    status: str
    parent_cr_id: Optional[str]
    new_state: str


class BatchActionRequest(BaseModel):
    batch_id: str
    action: str  # accept, reject, counter
    reason: Optional[str] = None
    counter_text: Optional[str] = None
