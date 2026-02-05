from __future__ import annotations

from pydantic import BaseModel


class OrgAICost(BaseModel):
    org_id: str
    org_name: str
    input_tokens: int
    output_tokens: int
    estimated_cost: float


class DailyTokens(BaseModel):
    date: str
    input_tokens: int
    output_tokens: int


class MonthCount(BaseModel):
    month: str
    count: int


class DashboardMetrics(BaseModel):
    # Product
    total_deals: int
    deals_this_month: int
    deals_last_month: int
    deals_by_state: dict[str, int]
    avg_crs_per_deal: float
    avg_versions_per_deal: float
    total_users: int
    new_users_this_month: int
    active_orgs: int
    total_orgs: int
    orgs_by_plan: dict[str, int]

    # AI Cost
    total_input_tokens_30d: int
    total_output_tokens_30d: int
    estimated_cost_30d: float
    ai_cost_per_deal: float
    top_orgs_by_ai_cost: list[OrgAICost]
    daily_token_usage: list[DailyTokens]
    ai_cost_by_job_type: dict[str, float]

    # PLG & Growth
    plg_funnel: dict[str, int]
    share_links_created_30d: int
    unique_share_link_visitors_30d: int
    plg_signups_30d: int
    activation_rate: float
    growth_coefficient: float

    # Retention
    orgs_created_by_month: list[MonthCount]
    churned_orgs_30d: int
    users_active_30d: int


class OrgAIUsageDetail(BaseModel):
    org_id: str
    org_name: str
    total_input_tokens: int
    total_output_tokens: int
    estimated_cost: float
    deals_breakdown: list[dict]
    daily_usage: list[DailyTokens]
