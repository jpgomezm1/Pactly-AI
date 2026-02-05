from __future__ import annotations

from typing import Optional
import re
import string
import random
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import or_
from sqlmodel import select

from database import get_session
from models.user import User
from models.organization import Organization
from models.magic_link import MagicLink
from schemas.auth import SignupRequest, LoginRequest, RegisterRequest, TokenResponse, UserResponse
from services.auth import hash_password, verify_password, create_access_token, get_current_user
from models.organization import Organization, PlanTier, BillingCycle, PLAN_LIMITS
from models.token_usage import TokenUsage

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=UserResponse, status_code=201)
async def signup(req: SignupRequest, session: AsyncSession = Depends(get_session)):
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Open signup is disabled. Accounts are created by your organization admin.",
    )


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(req: RegisterRequest, session: AsyncSession = Depends(get_session)):
    # Check email not taken
    result = await session.exec(select(User).where(User.email == req.email))
    if result.first():
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    # Validate plan and billing_cycle
    try:
        plan = PlanTier(req.plan)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid plan")
    try:
        billing_cycle = BillingCycle(req.billing_cycle)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid billing cycle")

    # Generate slug
    slug = re.sub(r"[^a-z0-9]+", "-", req.organization_name.lower()).strip("-")
    if not slug:
        slug = "org"
    result = await session.exec(select(Organization).where(Organization.slug == slug))
    if result.first():
        suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=4))
        slug = f"{slug}-{suffix}"

    # Create organization
    today = date.today()
    org = Organization(
        name=req.organization_name,
        slug=slug,
        plan=plan,
        billing_cycle=billing_cycle,
        billing_anchor_day=today.day,
    )
    session.add(org)
    await session.flush()

    # Create admin user
    user = User(
        email=req.email,
        hashed_password=hash_password(req.password),
        full_name=req.full_name,
        role="admin",
        organization_id=org.id,
    )
    session.add(user)
    await session.flush()

    # PLG: referral attribution
    if req.ref_token:
        from models.share_link import ShareLink
        from services.plg import record_plg_event
        ref_link = (await session.exec(
            select(ShareLink).where(
                or_(ShareLink.slug == req.ref_token, ShareLink.token == req.ref_token),
                ShareLink.is_active == True,
            )
        )).first()
        if ref_link:
            user.referred_by_share_link_id = ref_link.id
            session.add(user)
            await session.flush()
            await record_plg_event(session, "share_link_signup", share_link_id=ref_link.id, user_id=user.id)

    # Create initial token usage for current period
    limits = PLAN_LIMITS[plan]
    anchor = org.billing_anchor_day
    year, month = today.year, today.month
    try:
        period_start = date(year, month, min(anchor, 28))
    except ValueError:
        period_start = date(year, month, 28)
    if today < period_start:
        if month == 1:
            period_start = date(year - 1, 12, min(anchor, 28))
        else:
            try:
                period_start = date(year, month - 1, min(anchor, 28))
            except ValueError:
                period_start = date(year, month - 1, 28)
    end_month = period_start.month + 1
    end_year = period_start.year
    if end_month > 12:
        end_month = 1
        end_year += 1
    try:
        period_end = date(end_year, end_month, min(anchor, 28))
    except ValueError:
        period_end = date(end_year, end_month, 28)

    usage = TokenUsage(
        organization_id=org.id,
        period_start=period_start,
        period_end=period_end,
        tokens_included=limits["tokens"] if limits["tokens"] != -1 else 999999,
        tokens_used=0,
        extra_tokens_used=0,
    )
    session.add(usage)
    await session.commit()

    token = create_access_token(str(user.id), user.role)
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, session: AsyncSession = Depends(get_session)):
    result = await session.exec(select(User).where(User.email == req.email))
    user = result.first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account deactivated")
    token = create_access_token(str(user.id), user.role)
    return TokenResponse(access_token=token)


class MagicLinkValidateRequest(BaseModel):
    token: str


class MagicLinkValidateResponse(BaseModel):
    access_token: str
    redirect_path: Optional[str] = None


@router.post("/magic-link/validate", response_model=MagicLinkValidateResponse)
async def validate_magic_link(
    req: MagicLinkValidateRequest,
    session: AsyncSession = Depends(get_session),
):
    result = await session.exec(
        select(MagicLink).where(MagicLink.token == req.token)
    )
    ml = result.first()
    if not ml:
        raise HTTPException(status_code=404, detail="Invalid magic link")
    if ml.used_at:
        raise HTTPException(status_code=400, detail="Magic link already used")
    if ml.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Magic link expired")

    ml.used_at = datetime.utcnow()
    session.add(ml)

    user = (await session.exec(select(User).where(User.id == ml.user_id))).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    await session.commit()

    token = create_access_token(str(user.id), user.role)
    return MagicLinkValidateResponse(
        access_token=token,
        redirect_path=ml.redirect_path,
    )


@router.get("/me", response_model=UserResponse)
async def me(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    org_name = None
    plan = None
    org_id = None
    logo_url = None
    if user.organization_id:
        result = await session.exec(
            select(Organization).where(Organization.id == user.organization_id)
        )
        org = result.first()
        if org:
            org_name = org.name
            plan = org.plan
            org_id = str(org.id)
            logo_url = org.logo_url
    return UserResponse(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        organization_id=org_id,
        organization_name=org_name,
        plan=plan,
        logo_url=logo_url,
        has_completed_onboarding=user.has_completed_onboarding,
    )
