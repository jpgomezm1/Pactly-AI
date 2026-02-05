from typing import Optional, List
from pydantic import BaseModel


class PLGEventRequest(BaseModel):
    event_type: str
    share_link_id: Optional[str] = None
    session_id: Optional[str] = None
    metadata: Optional[dict] = None


class PLGMetricsResponse(BaseModel):
    funnel: dict
    time_series: list
    top_links: list
