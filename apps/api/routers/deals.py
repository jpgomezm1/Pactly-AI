from __future__ import annotations

import io
import uuid
import base64
import asyncio
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from database import get_session
from models.user import User, UserRole
from models.deal import Deal, DealAssignment
from models.audit import AuditEvent
from schemas.deals import DealCreate, DealResponse, DealAssignRequest, DealAssignmentResponse, EnrichedDealResponse, HealthSummary
from services.auth import get_current_user
from services.rbac import check_deal_access
from services.timeline import record_event
from services.tenant import get_current_org
from services.tokens import consume_token

router = APIRouter(prefix="/deals", tags=["deals"])


def _deal_response(deal: Deal) -> DealResponse:
    return DealResponse(
        id=str(deal.id), title=deal.title, address=deal.address,
        description=deal.description, deal_type=deal.deal_type,
        created_by=str(deal.created_by),
        current_state=deal.current_state,
        buyer_accepted_at=deal.buyer_accepted_at,
        seller_accepted_at=deal.seller_accepted_at,
        created_at=deal.created_at,
    )


@router.post("", response_model=DealResponse, status_code=201)
async def create_deal(
    req: DealCreate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    if user.role not in (UserRole.admin, UserRole.super_admin):
        raise HTTPException(status_code=403, detail="Only admins can create deals")

    org = await get_current_org(user, session)

    # 1 token = 1 deal. Everything inside the deal is unlimited.
    await consume_token(session, org)

    deal = Deal(
        title=req.title,
        address=req.address,
        description=req.description,
        deal_type=req.deal_type,
        created_by=user.id,
        organization_id=org.id,
    )
    session.add(deal)
    await session.commit()
    await session.refresh(deal)

    # Auto-assign creator
    assignment = DealAssignment(deal_id=deal.id, user_id=user.id, role_in_deal=user.role.value)
    session.add(assignment)
    await session.commit()

    await record_event(session, deal.id, "deal_created", user.id, {"title": deal.title, "deal_type": deal.deal_type})

    # PLG: first deal by referred user
    if user.referred_by_share_link_id:
        from sqlmodel import func
        deal_count = (await session.exec(
            select(func.count()).where(Deal.created_by == user.id)
        )).one()
        if deal_count == 1:
            from services.plg import record_plg_event
            await record_plg_event(
                session, "signup_first_deal",
                share_link_id=user.referred_by_share_link_id,
                user_id=user.id,
                deal_id=deal.id,
            )

    return _deal_response(deal)


@router.get("")
async def list_deals(
    deal_type: Optional[str] = Query(default=None, description="Filter by deal_type: 'purchase' or 'sale'"),
    with_health: bool = Query(default=False, description="Include health metrics"),
    sort_by: str = Query(default="created_at", description="Sort by: created_at, health, activity"),
    health_status: Optional[str] = Query(default=None, description="Filter by health: healthy, needs_attention, at_risk"),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    if user.role == UserRole.super_admin:
        stmt = select(Deal).order_by(Deal.created_at.desc())  # type: ignore
    elif user.role == UserRole.admin:
        stmt = (
            select(Deal)
            .where(Deal.organization_id == user.organization_id)
            .order_by(Deal.created_at.desc())  # type: ignore
        )
    else:
        stmt = (
            select(Deal)
            .join(DealAssignment, Deal.id == DealAssignment.deal_id)
            .where(
                DealAssignment.user_id == user.id,
                Deal.organization_id == user.organization_id,
            )
            .order_by(Deal.created_at.desc())  # type: ignore
        )

    if deal_type and deal_type in ("purchase", "sale"):
        stmt = stmt.where(Deal.deal_type == deal_type)

    result = await session.exec(stmt)
    deals = result.all()

    if not with_health:
        return [_deal_response(d) for d in deals]

    # Compute health for all deals using sync engine
    import asyncio
    from database import sync_engine
    from sqlmodel import Session as SyncSession
    from services.deal_health import compute_deals_health_batch

    deal_ids = [d.id for d in deals]

    def _compute():
        with SyncSession(sync_engine) as sync_session:
            return compute_deals_health_batch(sync_session, deal_ids)

    health_map = await asyncio.to_thread(_compute)

    enriched = []
    for d in deals:
        h = health_map.get(str(d.id), {})
        enriched.append(EnrichedDealResponse(
            id=str(d.id), title=d.title, address=d.address,
            description=d.description, deal_type=d.deal_type,
            created_by=str(d.created_by),
            current_state=d.current_state,
            buyer_accepted_at=d.buyer_accepted_at,
            seller_accepted_at=d.seller_accepted_at,
            created_at=d.created_at,
            health_score=h.get("health_score"),
            health_status=h.get("health_status"),
            days_since_last_activity=h.get("days_since_last_activity"),
            days_in_current_state=h.get("days_in_current_state"),
            open_crs=h.get("open_crs"),
            versions_count=h.get("versions_count"),
            issues=h.get("issues", []),
        ))

    # Filter by health_status
    if health_status:
        enriched = [e for e in enriched if e.health_status == health_status]

    # Sort
    if sort_by == "health":
        enriched.sort(key=lambda e: e.health_score or 100)
    elif sort_by == "activity":
        enriched.sort(key=lambda e: e.days_since_last_activity or 0, reverse=True)

    return enriched


@router.get("/health-summary", response_model=HealthSummary)
async def health_summary(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Returns aggregate health counts for the user's deals."""
    import asyncio
    from database import sync_engine
    from sqlmodel import Session as SyncSession
    from services.deal_health import compute_deals_health_batch

    if user.role == UserRole.super_admin:
        stmt = select(Deal)
    elif user.role == UserRole.admin:
        stmt = select(Deal).where(Deal.organization_id == user.organization_id)
    else:
        stmt = (
            select(Deal)
            .join(DealAssignment, Deal.id == DealAssignment.deal_id)
            .where(DealAssignment.user_id == user.id)
        )

    deals = (await session.exec(stmt)).all()
    deal_ids = [d.id for d in deals]

    def _compute():
        with SyncSession(sync_engine) as sync_session:
            return compute_deals_health_batch(sync_session, deal_ids)

    health_map = await asyncio.to_thread(_compute)

    healthy = sum(1 for h in health_map.values() if h.get("health_status") == "healthy")
    needs_attention = sum(1 for h in health_map.values() if h.get("health_status") == "needs_attention")
    at_risk = sum(1 for h in health_map.values() if h.get("health_status") == "at_risk")

    return HealthSummary(
        total=len(deals),
        healthy_count=healthy,
        needs_attention_count=needs_attention,
        at_risk_count=at_risk,
    )


@router.get("/activity-feed")
async def activity_feed(
    limit: int = 10,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Recent activity across all deals the user can access."""
    if user.role == UserRole.super_admin:
        result = await session.exec(
            select(AuditEvent, Deal.title)
            .join(Deal, AuditEvent.deal_id == Deal.id)
            .order_by(AuditEvent.created_at.desc())
            .limit(limit)
        )
    elif user.role == UserRole.admin:
        result = await session.exec(
            select(AuditEvent, Deal.title)
            .join(Deal, AuditEvent.deal_id == Deal.id)
            .where(Deal.organization_id == user.organization_id)
            .order_by(AuditEvent.created_at.desc())
            .limit(limit)
        )
    else:
        result = await session.exec(
            select(AuditEvent, Deal.title)
            .join(Deal, AuditEvent.deal_id == Deal.id)
            .join(DealAssignment, Deal.id == DealAssignment.deal_id)
            .where(DealAssignment.user_id == user.id)
            .order_by(AuditEvent.created_at.desc())
            .limit(limit)
        )

    events = result.all()
    return [
        {
            "id": str(e[0].id),
            "deal_id": str(e[0].deal_id),
            "deal_title": e[1],
            "action": e[0].action,
            "details": e[0].details,
            "created_at": e[0].created_at.isoformat(),
        }
        for e in events
    ]


@router.get("/{deal_id}", response_model=DealResponse)
async def get_deal(
    deal_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    await check_deal_access(session, user, deal_id)
    result = await session.exec(select(Deal).where(Deal.id == deal_id))
    deal = result.first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    return _deal_response(deal)


@router.post("/{deal_id}/accept-terms")
async def accept_terms(
    deal_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Admin accepts terms. Role determined by deal_type: sale→admin=seller, purchase→admin=buyer."""
    await check_deal_access(session, user, deal_id)
    deal = (await session.exec(select(Deal).where(Deal.id == deal_id))).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    now = datetime.utcnow()

    # Determine which side the admin represents
    if deal.deal_type == "sale":
        # admin = seller
        if deal.seller_accepted_at:
            raise HTTPException(status_code=400, detail="Seller has already accepted")
        deal.seller_accepted_at = now
    else:
        # admin = buyer
        if deal.buyer_accepted_at:
            raise HTTPException(status_code=400, detail="Buyer has already accepted")
        deal.buyer_accepted_at = now

    # Check if both sides accepted
    both_accepted = deal.buyer_accepted_at is not None and deal.seller_accepted_at is not None
    if both_accepted:
        deal.current_state = "accepted"
    elif deal.current_state != "final_review":
        deal.current_state = "final_review"

    session.add(deal)
    await session.commit()
    await session.refresh(deal)

    side = "seller" if deal.deal_type == "sale" else "buyer"
    await record_event(session, deal.id, "terms_accepted", user.id, {"side": side})

    # Trigger timeline PDF generation on both_accepted
    if both_accepted:
        try:
            from models.job import JobRecord
            from workers.inline_runner import run_generate_timeline_pdf
            timeline_job_id = str(uuid.uuid4())
            timeline_job = JobRecord(id=timeline_job_id, deal_id=deal.id, job_type="generate_timeline_pdf", status="pending")
            session.add(timeline_job)
            await session.commit()
            asyncio.create_task(run_generate_timeline_pdf(timeline_job_id, str(deal.id)))
        except Exception:
            pass

    # Email counterparty
    try:
        from services.email import notify_deal_accepted, get_counterparty_emails
        counterparties = await get_counterparty_emails(session, deal.id)
        if both_accepted:
            for email, name, slug in counterparties:
                notify_deal_accepted(to=email, deal_title=deal.title, deal_url_or_review_url=f"/review/{slug}")
        else:
            for email, name, slug in counterparties:
                from services.email import send_email
                send_email(
                    to=email,
                    subject=f"Terms accepted on {deal.title}",
                    html=f"<p>The other party has accepted the terms on <strong>{deal.title}</strong>. Please review and accept to finalize the deal.</p>",
                )
    except Exception:
        pass

    return {
        "deal_id": str(deal.id),
        "current_state": deal.current_state,
        "buyer_accepted_at": deal.buyer_accepted_at.isoformat() if deal.buyer_accepted_at else None,
        "seller_accepted_at": deal.seller_accepted_at.isoformat() if deal.seller_accepted_at else None,
    }


@router.post("/{deal_id}/assign", response_model=DealAssignmentResponse, status_code=201)
async def assign_user(
    deal_id: uuid.UUID,
    req: DealAssignRequest,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    if user.role not in (UserRole.admin, UserRole.super_admin):
        raise HTTPException(status_code=403, detail="Only admins can assign users")

    await check_deal_access(session, user, deal_id)

    assignment = DealAssignment(
        deal_id=deal_id, user_id=uuid.UUID(req.user_id), role_in_deal=req.role_in_deal,
    )
    session.add(assignment)
    await session.commit()
    await session.refresh(assignment)

    await record_event(session, deal_id, "user_assigned", user.id, {
        "assigned_user_id": req.user_id, "role": req.role_in_deal,
    })

    return DealAssignmentResponse(
        id=str(assignment.id), deal_id=str(assignment.deal_id),
        user_id=str(assignment.user_id), role_in_deal=assignment.role_in_deal,
        assigned_at=assignment.assigned_at,
    )


@router.post("/{deal_id}/share", response_model=DealAssignmentResponse, status_code=201)
async def share_deal_with_agent(
    deal_id: uuid.UUID,
    req: DealAssignRequest,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Allow an agent to share a deal with another agent in the same org."""
    await check_deal_access(session, user, deal_id)

    # Verify target user exists and is in the same org
    target = (await session.exec(
        select(User).where(User.id == uuid.UUID(req.user_id))
    )).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.organization_id != user.organization_id:
        raise HTTPException(status_code=403, detail="User is not in your organization")

    # Check not already assigned
    existing = (await session.exec(
        select(DealAssignment).where(
            DealAssignment.deal_id == deal_id,
            DealAssignment.user_id == target.id,
        )
    )).first()
    if existing:
        raise HTTPException(status_code=400, detail="User is already assigned to this deal")

    assignment = DealAssignment(
        deal_id=deal_id, user_id=target.id, role_in_deal=req.role_in_deal or "agent",
    )
    session.add(assignment)
    await session.commit()
    await session.refresh(assignment)

    await record_event(session, deal_id, "deal_shared", user.id, {
        "shared_with_user_id": req.user_id,
    })

    return DealAssignmentResponse(
        id=str(assignment.id), deal_id=str(assignment.deal_id),
        user_id=str(assignment.user_id), role_in_deal=assignment.role_in_deal,
        assigned_at=assignment.assigned_at,
    )


@router.get("/{deal_id}/timeline-pdf")
async def get_timeline_pdf(
    deal_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Download the Critical Dates PDF."""
    await check_deal_access(session, user, deal_id)
    deal = (await session.exec(select(Deal).where(Deal.id == deal_id))).first()
    if not deal or not deal.timeline_pdf_base64:
        raise HTTPException(status_code=404, detail="Timeline PDF not yet generated")

    pdf_bytes = base64.b64decode(deal.timeline_pdf_base64)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="Critical_Dates_{deal.title}.pdf"'},
    )


@router.post("/{deal_id}/generate-timeline")
async def generate_timeline(
    deal_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Manually trigger timeline PDF generation (admin only)."""
    if user.role not in (UserRole.admin, UserRole.super_admin):
        raise HTTPException(status_code=403, detail="Only admins can generate timeline PDFs")
    await check_deal_access(session, user, deal_id)

    from models.job import JobRecord
    from workers.inline_runner import run_generate_timeline_pdf

    job_id = str(uuid.uuid4())
    job = JobRecord(id=job_id, deal_id=deal_id, job_type="generate_timeline_pdf", status="pending")
    session.add(job)
    await session.commit()

    asyncio.create_task(run_generate_timeline_pdf(job_id, str(deal_id)))

    return {"job_id": job_id}
