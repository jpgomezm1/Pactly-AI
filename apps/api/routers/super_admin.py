from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, cast, String
from sqlmodel import select, func

from database import get_session
from models.user import User, UserRole
from models.deal import Deal
from models.organization import Organization, PlanTier
from models.token_usage import TokenUsage
from models.change_request import ChangeRequest
from models.contract import ContractVersion
from models.plg_event import PLGEvent
from models.share_link import ShareLink
from schemas.super_admin import (
    OrgCreateRequest, OrgUpdateRequest, OrgResponse,
    OrgUserCreateRequest, OrgUsageResponse,
)
from schemas.super_admin_dashboard import (
    DashboardMetrics, OrgAICost, DailyTokens, MonthCount,
    OrgAIUsageDetail,
)
from schemas.auth import UserResponse
from services.auth import get_current_user, hash_password

router = APIRouter(prefix="/super-admin", tags=["super-admin"])

# Claude Sonnet pricing per 1M tokens
AI_INPUT_COST_PER_M = 3.00
AI_OUTPUT_COST_PER_M = 15.00


def _require_super_admin(user: User) -> User:
    if user.role != UserRole.super_admin:
        raise HTTPException(status_code=403, detail="Super admin access required")
    return user


def _estimate_cost(input_tokens: int, output_tokens: int) -> float:
    return round((input_tokens * AI_INPUT_COST_PER_M + output_tokens * AI_OUTPUT_COST_PER_M) / 1_000_000, 4)


# ── Dashboard ────────────────────────────────────────────────────────────────


@router.get("/dashboard", response_model=DashboardMetrics)
async def get_dashboard(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    _require_super_admin(user)

    now = datetime.utcnow()
    thirty_days_ago = now - timedelta(days=30)
    this_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_month_start = (this_month_start - timedelta(days=1)).replace(day=1)

    # ── Product metrics ──────────────────────────────────────────────────

    total_deals = (await session.exec(
        select(func.count()).select_from(Deal)
    )).one()

    deals_this_month = (await session.exec(
        select(func.count()).select_from(Deal).where(Deal.created_at >= this_month_start)
    )).one()

    deals_last_month = (await session.exec(
        select(func.count()).select_from(Deal).where(
            Deal.created_at >= last_month_start,
            Deal.created_at < this_month_start,
        )
    )).one()

    state_rows = (await session.exec(
        select(Deal.current_state, func.count().label("cnt"))
        .group_by(Deal.current_state)
    )).all()
    deals_by_state = {row[0]: row[1] for row in state_rows}

    # avg CRs per deal
    cr_per_deal_q = (
        select(func.count().label("cnt"))
        .select_from(ChangeRequest)
        .group_by(ChangeRequest.deal_id)
    )
    cr_counts = (await session.exec(cr_per_deal_q)).all()
    avg_crs = round(sum(cr_counts) / len(cr_counts), 2) if cr_counts else 0.0

    # avg versions per deal
    ver_per_deal_q = (
        select(func.count().label("cnt"))
        .select_from(ContractVersion)
        .group_by(ContractVersion.deal_id)
    )
    ver_counts = (await session.exec(ver_per_deal_q)).all()
    avg_versions = round(sum(ver_counts) / len(ver_counts), 2) if ver_counts else 0.0

    total_users = (await session.exec(
        select(func.count()).select_from(User).where(cast(User.role, String) != "super_admin")
    )).one()

    new_users_this_month = (await session.exec(
        select(func.count()).select_from(User).where(
            User.created_at >= this_month_start,
            cast(User.role, String) != "super_admin",
        )
    )).one()

    total_orgs = (await session.exec(
        select(func.count()).select_from(Organization)
    )).one()

    active_orgs = (await session.exec(
        select(func.count()).select_from(Organization).where(Organization.is_active == True)  # noqa: E712
    )).one()

    plan_rows = (await session.exec(
        select(Organization.plan, func.count().label("cnt"))
        .group_by(Organization.plan)
    )).all()
    orgs_by_plan = {str(row[0].value) if hasattr(row[0], "value") else str(row[0]): row[1] for row in plan_rows}

    # ── AI Cost metrics (last 30 days) ───────────────────────────────────

    token_q = (
        select(
            func.coalesce(func.sum(ChangeRequest.input_tokens), 0),
            func.coalesce(func.sum(ChangeRequest.output_tokens), 0),
        )
        .where(ChangeRequest.created_at >= thirty_days_ago)
    )
    token_row = (await session.exec(token_q)).one()
    total_input_30d = int(token_row[0])
    total_output_30d = int(token_row[1])
    cost_30d = _estimate_cost(total_input_30d, total_output_30d)

    # deals with AI usage in last 30d
    deals_with_ai = (await session.exec(
        select(func.count(func.distinct(ChangeRequest.deal_id)))
        .where(
            ChangeRequest.created_at >= thirty_days_ago,
            ChangeRequest.input_tokens.isnot(None),  # type: ignore
        )
    )).one()
    ai_cost_per_deal = round(cost_30d / max(deals_with_ai, 1), 4)

    # top orgs by AI cost
    top_org_q = (
        select(
            Organization.id,
            Organization.name,
            func.coalesce(func.sum(ChangeRequest.input_tokens), 0).label("inp"),
            func.coalesce(func.sum(ChangeRequest.output_tokens), 0).label("outp"),
        )
        .join(Deal, Deal.organization_id == Organization.id)
        .join(ChangeRequest, ChangeRequest.deal_id == Deal.id)
        .where(ChangeRequest.created_at >= thirty_days_ago)
        .group_by(Organization.id, Organization.name)
        .order_by(func.sum(
            func.coalesce(ChangeRequest.input_tokens, 0) * AI_INPUT_COST_PER_M
            + func.coalesce(ChangeRequest.output_tokens, 0) * AI_OUTPUT_COST_PER_M
        ).desc())
        .limit(10)
    )
    top_org_rows = (await session.exec(top_org_q)).all()
    top_orgs_by_ai_cost = [
        OrgAICost(
            org_id=str(r[0]), org_name=r[1],
            input_tokens=int(r[2]), output_tokens=int(r[3]),
            estimated_cost=_estimate_cost(int(r[2]), int(r[3])),
        )
        for r in top_org_rows
    ]

    # daily token usage (last 30 days)
    daily_q = (
        select(
            func.date(ChangeRequest.created_at).label("day"),
            func.coalesce(func.sum(ChangeRequest.input_tokens), 0),
            func.coalesce(func.sum(ChangeRequest.output_tokens), 0),
        )
        .where(ChangeRequest.created_at >= thirty_days_ago)
        .group_by(func.date(ChangeRequest.created_at))
        .order_by(func.date(ChangeRequest.created_at))
    )
    daily_rows = (await session.exec(daily_q)).all()
    daily_token_usage = [
        DailyTokens(date=str(r[0]), input_tokens=int(r[1]), output_tokens=int(r[2]))
        for r in daily_rows
    ]

    # cost by analysis_status as proxy for job type (parse/analyze/generate)
    job_type_q = (
        select(
            ChangeRequest.analysis_status,
            func.coalesce(func.sum(ChangeRequest.input_tokens), 0),
            func.coalesce(func.sum(ChangeRequest.output_tokens), 0),
        )
        .where(ChangeRequest.created_at >= thirty_days_ago)
        .group_by(ChangeRequest.analysis_status)
    )
    job_type_rows = (await session.exec(job_type_q)).all()
    ai_cost_by_job_type = {
        str(r[0]): _estimate_cost(int(r[1]), int(r[2]))
        for r in job_type_rows
    }

    # ── PLG & Growth ─────────────────────────────────────────────────────

    funnel_q = (
        select(PLGEvent.event_type, func.count().label("cnt"))
        .where(PLGEvent.created_at >= thirty_days_ago)
        .group_by(PLGEvent.event_type)
    )
    funnel_rows = (await session.exec(funnel_q)).all()
    plg_funnel = {row[0]: row[1] for row in funnel_rows}

    share_links_created_30d = (await session.exec(
        select(func.count()).select_from(ShareLink).where(ShareLink.created_at >= thirty_days_ago)
    )).one()

    unique_visitors_30d = (await session.exec(
        select(func.count(func.distinct(PLGEvent.session_id)))
        .where(
            PLGEvent.created_at >= thirty_days_ago,
            PLGEvent.event_type == "share_link_opened",
        )
    )).one()

    plg_signups_30d = plg_funnel.get("share_link_signup", 0)

    # activation = users who created at least 1 deal / new users this month
    users_with_deals = (await session.exec(
        select(func.count(func.distinct(Deal.created_by)))
        .where(Deal.created_at >= this_month_start)
    )).one()
    activation_rate = round(users_with_deals / max(new_users_this_month, 1), 4)

    # growth coefficient = share_links_created / active orgs
    growth_coefficient = round(share_links_created_30d / max(active_orgs, 1), 4)

    # ── Retention ────────────────────────────────────────────────────────

    month_expr = func.to_char(Organization.created_at, text("'YYYY-MM'"))
    orgs_by_month_q = (
        select(
            month_expr.label("mo"),
            func.count().label("cnt"),
        )
        .select_from(Organization)
        .group_by(text("1"))
        .order_by(text("1"))
    )
    orgs_by_month_rows = (await session.exec(orgs_by_month_q)).all()
    orgs_created_by_month = [MonthCount(month=r[0], count=r[1]) for r in orgs_by_month_rows]

    churned_orgs_30d = (await session.exec(
        select(func.count()).select_from(Organization).where(
            Organization.is_active == False,  # noqa: E712
            Organization.updated_at >= thirty_days_ago,
        )
    )).one()

    # users active = users who created a deal or CR in last 30d
    active_deal_users = (await session.exec(
        select(func.count(func.distinct(Deal.created_by)))
        .where(Deal.created_at >= thirty_days_ago)
    )).one()
    active_cr_users = (await session.exec(
        select(func.count(func.distinct(ChangeRequest.created_by)))
        .where(ChangeRequest.created_at >= thirty_days_ago)
    )).one()
    users_active_30d = max(active_deal_users, active_cr_users)

    return DashboardMetrics(
        total_deals=total_deals,
        deals_this_month=deals_this_month,
        deals_last_month=deals_last_month,
        deals_by_state=deals_by_state,
        avg_crs_per_deal=avg_crs,
        avg_versions_per_deal=avg_versions,
        total_users=total_users,
        new_users_this_month=new_users_this_month,
        active_orgs=active_orgs,
        total_orgs=total_orgs,
        orgs_by_plan=orgs_by_plan,
        total_input_tokens_30d=total_input_30d,
        total_output_tokens_30d=total_output_30d,
        estimated_cost_30d=cost_30d,
        ai_cost_per_deal=ai_cost_per_deal,
        top_orgs_by_ai_cost=top_orgs_by_ai_cost,
        daily_token_usage=daily_token_usage,
        ai_cost_by_job_type=ai_cost_by_job_type,
        plg_funnel=plg_funnel,
        share_links_created_30d=share_links_created_30d,
        unique_share_link_visitors_30d=unique_visitors_30d,
        plg_signups_30d=plg_signups_30d,
        activation_rate=activation_rate,
        growth_coefficient=growth_coefficient,
        orgs_created_by_month=orgs_created_by_month,
        churned_orgs_30d=churned_orgs_30d,
        users_active_30d=users_active_30d,
    )


# ── Per-org AI usage ─────────────────────────────────────────────────────────


@router.get("/organizations/{org_id}/ai-usage", response_model=OrgAIUsageDetail)
async def get_org_ai_usage(
    org_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    _require_super_admin(user)

    org = (await session.exec(
        select(Organization).where(Organization.id == org_id)
    )).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # totals
    totals_q = (
        select(
            func.coalesce(func.sum(ChangeRequest.input_tokens), 0),
            func.coalesce(func.sum(ChangeRequest.output_tokens), 0),
        )
        .join(Deal, Deal.id == ChangeRequest.deal_id)
        .where(Deal.organization_id == org_id)
    )
    totals = (await session.exec(totals_q)).one()
    total_inp = int(totals[0])
    total_outp = int(totals[1])

    # breakdown by deal
    deal_q = (
        select(
            Deal.id, Deal.title,
            func.coalesce(func.sum(ChangeRequest.input_tokens), 0),
            func.coalesce(func.sum(ChangeRequest.output_tokens), 0),
        )
        .join(ChangeRequest, ChangeRequest.deal_id == Deal.id)
        .where(Deal.organization_id == org_id)
        .group_by(Deal.id, Deal.title)
        .order_by(func.sum(
            func.coalesce(ChangeRequest.input_tokens, 0)
            + func.coalesce(ChangeRequest.output_tokens, 0)
        ).desc())
    )
    deal_rows = (await session.exec(deal_q)).all()
    deals_breakdown = [
        {
            "deal_id": str(r[0]),
            "title": r[1],
            "input_tokens": int(r[2]),
            "output_tokens": int(r[3]),
            "estimated_cost": _estimate_cost(int(r[2]), int(r[3])),
        }
        for r in deal_rows
    ]

    # daily usage
    daily_q = (
        select(
            func.date(ChangeRequest.created_at).label("day"),
            func.coalesce(func.sum(ChangeRequest.input_tokens), 0),
            func.coalesce(func.sum(ChangeRequest.output_tokens), 0),
        )
        .join(Deal, Deal.id == ChangeRequest.deal_id)
        .where(Deal.organization_id == org_id)
        .group_by(func.date(ChangeRequest.created_at))
        .order_by(func.date(ChangeRequest.created_at))
    )
    daily_rows = (await session.exec(daily_q)).all()
    daily_usage = [
        DailyTokens(date=str(r[0]), input_tokens=int(r[1]), output_tokens=int(r[2]))
        for r in daily_rows
    ]

    return OrgAIUsageDetail(
        org_id=str(org.id),
        org_name=org.name,
        total_input_tokens=total_inp,
        total_output_tokens=total_outp,
        estimated_cost=_estimate_cost(total_inp, total_outp),
        deals_breakdown=deals_breakdown,
        daily_usage=daily_usage,
    )


# ── Delete organization ──────────────────────────────────────────────────────


@router.delete("/organizations/{org_id}", status_code=200)
async def delete_organization(
    org_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Soft-delete: deactivates the org and all its users. Data is preserved."""
    _require_super_admin(user)
    org = (await session.exec(
        select(Organization).where(Organization.id == org_id)
    )).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Deactivate all users in the org via bulk update
    from sqlalchemy import update as sa_update
    await session.exec(
        sa_update(User)
        .where(User.organization_id == org_id)
        .values(is_active=False)
    )  # type: ignore

    # Soft-delete the organization
    org.is_active = False
    org.updated_at = datetime.utcnow()
    org.name = f"[DELETED] {org.name}"
    session.add(org)
    await session.commit()
    return {"detail": "Organization deleted (soft)", "id": str(org_id)}


# ── Existing endpoints ───────────────────────────────────────────────────────


@router.get("/organizations", response_model=list[OrgResponse])
async def list_organizations(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    _require_super_admin(user)
    result = await session.exec(
        select(Organization)
        .where(Organization.name.not_like("[DELETED]%"))  # type: ignore
        .order_by(Organization.created_at.desc())  # type: ignore
    )
    orgs = result.all()

    responses = []
    for org in orgs:
        user_count = (await session.exec(
            select(func.count()).select_from(User).where(User.organization_id == org.id)
        )).one()
        deal_count = (await session.exec(
            select(func.count()).select_from(Deal).where(Deal.organization_id == org.id)
        )).one()
        responses.append(OrgResponse(
            id=str(org.id), name=org.name, slug=org.slug, plan=org.plan,
            is_active=org.is_active, logo_url=org.logo_url,
            primary_color=org.primary_color,
            billing_anchor_day=org.billing_anchor_day,
            billing_cycle=org.billing_cycle,
            created_at=org.created_at,
            user_count=user_count, deal_count=deal_count,
        ))
    return responses


@router.post("/organizations", response_model=OrgResponse, status_code=201)
async def create_organization(
    req: OrgCreateRequest,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    _require_super_admin(user)
    existing = (await session.exec(
        select(Organization).where(Organization.slug == req.slug)
    )).first()
    if existing:
        raise HTTPException(status_code=400, detail="Slug already in use")

    org = Organization(
        name=req.name,
        slug=req.slug,
        plan=req.plan,
        billing_anchor_day=req.billing_anchor_day,
        billing_cycle=req.billing_cycle,
    )
    session.add(org)
    await session.commit()
    await session.refresh(org)
    return OrgResponse(
        id=str(org.id), name=org.name, slug=org.slug, plan=org.plan,
        is_active=org.is_active, logo_url=org.logo_url,
        primary_color=org.primary_color,
        billing_anchor_day=org.billing_anchor_day,
        billing_cycle=org.billing_cycle,
        created_at=org.created_at,
        user_count=0, deal_count=0,
    )


@router.get("/organizations/{org_id}", response_model=OrgResponse)
async def get_organization(
    org_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    _require_super_admin(user)
    org = (await session.exec(
        select(Organization).where(Organization.id == org_id)
    )).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    user_count = (await session.exec(
        select(func.count()).select_from(User).where(User.organization_id == org.id)
    )).one()
    deal_count = (await session.exec(
        select(func.count()).select_from(Deal).where(Deal.organization_id == org.id)
    )).one()
    return OrgResponse(
        id=str(org.id), name=org.name, slug=org.slug, plan=org.plan,
        is_active=org.is_active, logo_url=org.logo_url,
        primary_color=org.primary_color,
        billing_anchor_day=org.billing_anchor_day,
        billing_cycle=org.billing_cycle,
        created_at=org.created_at,
        user_count=user_count, deal_count=deal_count,
    )


@router.put("/organizations/{org_id}", response_model=OrgResponse)
async def update_organization(
    org_id: uuid.UUID,
    req: OrgUpdateRequest,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    _require_super_admin(user)
    org = (await session.exec(
        select(Organization).where(Organization.id == org_id)
    )).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    if req.name is not None:
        org.name = req.name
    if req.plan is not None:
        org.plan = req.plan
    if req.is_active is not None:
        org.is_active = req.is_active
    if req.billing_anchor_day is not None:
        org.billing_anchor_day = req.billing_anchor_day
    if req.billing_cycle is not None:
        org.billing_cycle = req.billing_cycle
    if req.logo_url is not None:
        org.logo_url = req.logo_url
    if req.primary_color is not None:
        org.primary_color = req.primary_color

    org.updated_at = datetime.utcnow()
    session.add(org)
    await session.commit()
    await session.refresh(org)

    user_count = (await session.exec(
        select(func.count()).select_from(User).where(User.organization_id == org.id)
    )).one()
    deal_count = (await session.exec(
        select(func.count()).select_from(Deal).where(Deal.organization_id == org.id)
    )).one()
    return OrgResponse(
        id=str(org.id), name=org.name, slug=org.slug, plan=org.plan,
        is_active=org.is_active, logo_url=org.logo_url,
        primary_color=org.primary_color,
        billing_anchor_day=org.billing_anchor_day,
        billing_cycle=org.billing_cycle,
        created_at=org.created_at,
        user_count=user_count, deal_count=deal_count,
    )


@router.get("/organizations/{org_id}/users")
async def list_org_users(
    org_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    _require_super_admin(user)
    result = await session.execute(
        select(
            User.id, User.email, User.full_name,
            cast(User.role, String).label("role"),
            User.is_active, User.created_at,
        )
        .where(User.organization_id == org_id)
        .order_by(User.created_at.desc())  # type: ignore
    )
    rows = result.all()
    return [
        {
            "id": str(r.id),
            "email": r.email,
            "full_name": r.full_name,
            "role": r.role,
            "is_active": r.is_active,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@router.post("/organizations/{org_id}/users", response_model=UserResponse, status_code=201)
async def create_org_user(
    org_id: uuid.UUID,
    req: OrgUserCreateRequest,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    _require_super_admin(user)
    org = (await session.exec(
        select(Organization).where(Organization.id == org_id)
    )).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    existing = (await session.exec(select(User).where(User.email == req.email))).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = User(
        email=req.email,
        hashed_password=hash_password(req.password),
        full_name=req.full_name,
        role=req.role,
        organization_id=org.id,
    )
    session.add(new_user)
    await session.commit()
    await session.refresh(new_user)
    return UserResponse(
        id=str(new_user.id), email=new_user.email,
        full_name=new_user.full_name, role=new_user.role,
        is_active=new_user.is_active,
        organization_id=str(org.id), organization_name=org.name, plan=org.plan,
    )


@router.get("/organizations/{org_id}/usage", response_model=list[OrgUsageResponse])
async def get_org_usage(
    org_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    _require_super_admin(user)
    result = await session.exec(
        select(TokenUsage)
        .where(TokenUsage.organization_id == org_id)
        .order_by(TokenUsage.period_start.desc())  # type: ignore
    )
    usages = result.all()
    return [
        OrgUsageResponse(
            period_start=str(u.period_start),
            period_end=str(u.period_end),
            tokens_included=u.tokens_included,
            tokens_used=u.tokens_used,
            extra_tokens_used=u.extra_tokens_used,
        ) for u in usages
    ]
