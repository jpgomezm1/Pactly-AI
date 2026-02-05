from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


class CreateShareLinkRequest(BaseModel):
    counterparty_name: str
    counterparty_email: Optional[str] = None
    expires_at: Optional[datetime] = None


class ShareLinkResponse(BaseModel):
    id: str
    deal_id: str
    token: str
    url: str
    counterparty_name: str
    counterparty_email: Optional[str] = None
    slug: Optional[str] = None
    is_active: bool
    expires_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PublicContractResponse(BaseModel):
    deal_title: str
    deal_type: str = "sale"
    full_text: str
    version_number: int
    counterparty_name: str
    counterparty_email: Optional[str] = None
    extracted_fields: Optional[dict] = None
    clause_tags: Optional[list] = None
    contract_type: Optional[str] = None
    buyer_accepted_at: Optional[datetime] = None
    seller_accepted_at: Optional[datetime] = None
    risk_flags: Optional[list] = None
    suggestions: Optional[list] = None


class SubmitFeedbackRequest(BaseModel):
    reviewer_name: Optional[str] = None
    reviewer_email: Optional[str] = None
    feedback_text: str


class SubmitBatchFeedbackRequest(BaseModel):
    items: List[SubmitFeedbackRequest]


class GroupFeedbackRequest(BaseModel):
    feedback_ids: List[str]


class FeedbackResponse(BaseModel):
    id: str
    reviewer_name: str
    reviewer_email: Optional[str] = None
    feedback_text: str
    batch_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class BatchFeedbackResponse(BaseModel):
    batch_id: str
    items: List[FeedbackResponse]


class PublicFeedbackHistoryItem(BaseModel):
    id: str
    reviewer_name: str
    feedback_text: str
    created_at: datetime
    cr_status: Optional[str] = None
    analysis_status: Optional[str] = None
    analysis_result: Optional[dict] = None  # sanitized: no token counts
    counter_proposal: Optional[str] = None
    batch_id: Optional[str] = None


class SubmitCounterResponseRequest(BaseModel):
    reviewer_name: Optional[str] = None
    reviewer_email: Optional[str] = None
    response_text: str
    original_feedback_id: str


class PublicVersionItem(BaseModel):
    id: str
    version_number: int
    source: str
    contract_type: Optional[str] = None
    change_summary: Optional[dict] = None
    has_diff: bool = False
    created_at: datetime


class PublicDiffResponse(BaseModel):
    version_a_number: int
    version_b_number: int
    diff_html: str
    field_changes: list


class FieldChangeItem(BaseModel):
    field: str
    from_value: Optional[str] = None
    to_value: Optional[str] = None


class PublicChangesSummary(BaseModel):
    new_versions_count: int
    last_visit_at: Optional[datetime] = None
    changes: List[FieldChangeItem]
    feedback_incorporated: dict = {}


class PublicTimelineEvent(BaseModel):
    id: str
    action: str
    details: Optional[dict] = None
    created_at: datetime


class ChatRequest(BaseModel):
    question: str
    history: List[dict] = []
    session_id: Optional[str] = None
