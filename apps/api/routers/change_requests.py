from __future__ import annotations

import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from database import get_session
from models.user import User
from models.change_request import ChangeRequest
from models.deal import Deal
from models.job import JobRecord
from schemas.change_requests import (
    ChangeRequestCreate, ChangeRequestResponse, AnalyzeResponse,
    GenerateVersionRequest, GenerateVersionResponse,
    RejectRequest, CounterRequest, AcceptResponse, RejectResponse, CounterResponse,
    BatchActionRequest,
)
from services.auth import get_current_user
from services.rbac import check_deal_access
from services.timeline import record_event, transition_state, get_next_state
from services.notifications import notify_deal_participants
import asyncio
from workers.inline_runner import run_analyze_change_request, run_generate_version
from services.email import notify_cr_submitted

router = APIRouter(prefix="/deals/{deal_id}/change-requests", tags=["change-requests"])


def _cr_response(cr: ChangeRequest) -> ChangeRequestResponse:
    return ChangeRequestResponse(
        id=str(cr.id), deal_id=str(cr.deal_id), raw_text=cr.raw_text,
        created_by=str(cr.created_by), role=cr.role,
        cycle_id=str(cr.cycle_id) if cr.cycle_id else None,
        status=cr.status,
        rejection_reason=cr.rejection_reason,
        parent_cr_id=str(cr.parent_cr_id) if cr.parent_cr_id else None,
        batch_id=cr.batch_id,
        analysis_status=cr.analysis_status, analysis_result=cr.analysis_result,
        analysis_job_id=cr.analysis_job_id, prompt_version=cr.prompt_version,
        input_tokens=cr.input_tokens, output_tokens=cr.output_tokens,
        created_at=cr.created_at, analyzed_at=cr.analyzed_at,
    )


async def _get_cr(session: AsyncSession, deal_id: uuid.UUID, cr_id: uuid.UUID) -> ChangeRequest:
    result = await session.exec(
        select(ChangeRequest).where(ChangeRequest.id == cr_id, ChangeRequest.deal_id == deal_id)
    )
    cr = result.first()
    if not cr:
        raise HTTPException(status_code=404, detail="Change request not found")
    return cr


async def _get_deal(session: AsyncSession, deal_id: uuid.UUID) -> Deal:
    result = await session.exec(select(Deal).where(Deal.id == deal_id))
    deal = result.first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    return deal


@router.post("", response_model=ChangeRequestResponse, status_code=201)
async def create_change_request(
    deal_id: uuid.UUID,
    req: ChangeRequestCreate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    await check_deal_access(session, user, deal_id)

    cr = ChangeRequest(
        deal_id=deal_id, raw_text=req.raw_text,
        created_by=user.id, role=user.role.value,
    )
    session.add(cr)
    await session.commit()
    await session.refresh(cr)

    await record_event(session, deal_id, "change_request_created", user.id, {
        "cr_id": str(cr.id), "text_preview": req.raw_text[:100],
    })

    # Auto-transition deal state when CR is created
    deal = await _get_deal(session, deal_id)
    next_state = get_next_state(deal.current_state, "cr_created", user.role.value)
    if next_state:
        await transition_state(session, deal_id, next_state, user.id)

    # Auto-dispatch analysis job
    job_id = str(uuid.uuid4())
    job = JobRecord(id=job_id, deal_id=deal_id, job_type="analyze_change_request", status="pending")
    session.add(job)
    cr.analysis_status = "processing"
    cr.analysis_job_id = job_id
    session.add(cr)
    await session.commit()
    await session.refresh(cr)

    asyncio.create_task(run_analyze_change_request(job_id, str(deal_id), str(cr.id)))

    # Fire-and-forget email notification for CR creation
    try:
        deal_obj = await _get_deal(session, deal_id)
        notify_cr_submitted(
            to=user.email if hasattr(user, "email") and user.email else "",
            deal_title=deal_obj.title,
            cr_preview=req.raw_text[:200],
        )
    except Exception:
        pass  # email is best-effort

    return _cr_response(cr)


@router.get("", response_model=list[ChangeRequestResponse])
async def list_change_requests(
    deal_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    await check_deal_access(session, user, deal_id)
    result = await session.exec(
        select(ChangeRequest)
        .where(ChangeRequest.deal_id == deal_id)
        .order_by(ChangeRequest.created_at.desc())  # type: ignore
    )
    return [_cr_response(cr) for cr in result.all()]


@router.post("/{cr_id}/analyze", response_model=AnalyzeResponse)
async def analyze_cr(
    deal_id: uuid.UUID,
    cr_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    await check_deal_access(session, user, deal_id)

    result = await session.exec(
        select(ChangeRequest).where(ChangeRequest.id == cr_id, ChangeRequest.deal_id == deal_id)
    )
    cr = result.first()
    if not cr:
        raise HTTPException(status_code=404, detail="Change request not found")

    job_id = str(uuid.uuid4())
    job = JobRecord(id=job_id, deal_id=deal_id, job_type="analyze_change_request", status="pending")
    session.add(job)
    await session.commit()

    asyncio.create_task(run_analyze_change_request(job_id, str(deal_id), str(cr_id)))

    return AnalyzeResponse(job_id=job_id, status="pending")


@router.get("/{cr_id}", response_model=ChangeRequestResponse)
async def get_change_request(
    deal_id: uuid.UUID,
    cr_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    await check_deal_access(session, user, deal_id)
    cr = await _get_cr(session, deal_id, cr_id)
    return _cr_response(cr)


@router.post("/{cr_id}/accept", response_model=AcceptResponse)
async def accept_change_request(
    deal_id: uuid.UUID,
    cr_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    await check_deal_access(session, user, deal_id)
    cr = await _get_cr(session, deal_id, cr_id)

    if cr.analysis_status != "completed":
        raise HTTPException(status_code=400, detail="CR must be analyzed before accepting")
    if cr.status != "open":
        raise HTTPException(status_code=400, detail="CR is not open")

    cr.status = "accepted"
    session.add(cr)
    await session.commit()

    # Create job for version generation
    job_id = str(uuid.uuid4())
    job = JobRecord(id=job_id, deal_id=deal_id, job_type="generate_version", status="pending")
    session.add(job)
    await session.commit()

    asyncio.create_task(run_generate_version(job_id, str(deal_id), str(cr_id), str(user.id)))

    # Transition state
    deal = await _get_deal(session, deal_id)
    next_state = get_next_state(deal.current_state, "accept", user.role.value)
    if next_state:
        await transition_state(session, deal_id, next_state, user.id)

    await record_event(session, deal_id, "change_request_accepted", user.id, {"cr_id": str(cr_id)})

    await notify_deal_participants(
        session, deal_id,
        type="cr_accepted",
        title="Change request accepted",
        message=f"A change request was accepted and a new version is being generated.",
        exclude_user_id=user.id,
    )

    # Email counterparty
    try:
        from services.email import notify_cr_accepted, get_counterparty_emails
        counterparties = await get_counterparty_emails(session, deal_id)
        for email, name, slug in counterparties:
            notify_cr_accepted(to=email, deal_title=deal.title, deal_url_or_review_url=f"/review/{slug}")
    except Exception:
        pass

    # Re-read deal for updated state
    deal = await _get_deal(session, deal_id)
    return AcceptResponse(job_id=job_id, new_state=deal.current_state)


@router.post("/{cr_id}/reject", response_model=RejectResponse)
async def reject_change_request(
    deal_id: uuid.UUID,
    cr_id: uuid.UUID,
    req: RejectRequest,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    await check_deal_access(session, user, deal_id)
    cr = await _get_cr(session, deal_id, cr_id)

    if cr.status != "open":
        raise HTTPException(status_code=400, detail="CR is not open")

    cr.status = "rejected"
    cr.rejection_reason = req.reason
    session.add(cr)
    await session.commit()

    deal = await _get_deal(session, deal_id)
    next_state = get_next_state(deal.current_state, "reject", user.role.value)
    if next_state:
        await transition_state(session, deal_id, next_state, user.id)

    await record_event(session, deal_id, "change_request_rejected", user.id, {
        "cr_id": str(cr_id), "reason": req.reason,
    })

    await notify_deal_participants(
        session, deal_id,
        type="cr_rejected",
        title="Change request rejected",
        message=f"A change request was rejected.{' Reason: ' + req.reason if req.reason else ''}",
        exclude_user_id=user.id,
    )

    # Email counterparty
    try:
        from services.email import notify_cr_rejected, get_counterparty_emails
        counterparties = await get_counterparty_emails(session, deal_id)
        for email, name, slug in counterparties:
            notify_cr_rejected(to=email, deal_title=deal.title, reason=req.reason or "", deal_url_or_review_url=f"/review/{slug}")
    except Exception:
        pass

    deal = await _get_deal(session, deal_id)
    return RejectResponse(new_state=deal.current_state)


@router.post("/{cr_id}/counter", response_model=CounterResponse)
async def counter_change_request(
    deal_id: uuid.UUID,
    cr_id: uuid.UUID,
    req: CounterRequest,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    await check_deal_access(session, user, deal_id)
    cr = await _get_cr(session, deal_id, cr_id)

    if cr.status != "open":
        raise HTTPException(status_code=400, detail="CR is not open")

    # Mark original as countered
    cr.status = "countered"
    session.add(cr)
    await session.commit()

    # Create new CR linked to original
    new_cr = ChangeRequest(
        deal_id=deal_id,
        raw_text=req.counter_text,
        created_by=user.id,
        role=user.role.value,
        parent_cr_id=cr.id,
    )
    session.add(new_cr)
    await session.commit()
    await session.refresh(new_cr)

    # Transition state
    deal = await _get_deal(session, deal_id)
    next_state = get_next_state(deal.current_state, "counter", user.role.value)
    if next_state:
        await transition_state(session, deal_id, next_state, user.id)

    await record_event(session, deal_id, "change_request_countered", user.id, {
        "original_cr_id": str(cr_id), "new_cr_id": str(new_cr.id),
    })

    await notify_deal_participants(
        session, deal_id,
        type="cr_countered",
        title="Counter proposal submitted",
        message=f"A counter proposal was submitted on a change request.",
        exclude_user_id=user.id,
    )

    deal = await _get_deal(session, deal_id)

    # Email counterparty about counter
    try:
        from services.email import notify_cr_countered, get_counterparty_emails
        counterparties = await get_counterparty_emails(session, deal_id)
        for email, name, slug in counterparties:
            notify_cr_countered(to=email, deal_title=deal.title, counter_text=req.counter_text[:200], deal_url_or_review_url=f"/review/{slug}")
    except Exception:
        pass

    return CounterResponse(
        id=str(new_cr.id),
        deal_id=str(new_cr.deal_id),
        raw_text=new_cr.raw_text,
        status=new_cr.status,
        parent_cr_id=str(new_cr.parent_cr_id) if new_cr.parent_cr_id else None,
        new_state=deal.current_state,
    )


@router.post("/batch-action")
async def batch_action(
    deal_id: uuid.UUID,
    req: BatchActionRequest,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Apply accept/reject/counter to all open CRs in a batch."""
    await check_deal_access(session, user, deal_id)

    result = await session.exec(
        select(ChangeRequest).where(
            ChangeRequest.deal_id == deal_id,
            ChangeRequest.batch_id == req.batch_id,
            ChangeRequest.status == "open",
        )
    )
    crs = result.all()
    if not crs:
        raise HTTPException(status_code=404, detail="No open change requests found for this batch")

    results = []
    for cr in crs:
        if req.action == "accept":
            if cr.analysis_status != "completed":
                continue
            cr.status = "accepted"
            session.add(cr)
            await session.commit()

            job_id = str(uuid.uuid4())
            job = JobRecord(id=job_id, deal_id=deal_id, job_type="generate_version", status="pending")
            session.add(job)
            await session.commit()
            asyncio.create_task(run_generate_version(job_id, str(deal_id), str(cr.id), str(user.id)))
            results.append({"cr_id": str(cr.id), "action": "accepted", "job_id": job_id})

        elif req.action == "reject":
            cr.status = "rejected"
            cr.rejection_reason = req.reason
            session.add(cr)
            results.append({"cr_id": str(cr.id), "action": "rejected"})

        elif req.action == "counter":
            if not req.counter_text:
                continue
            cr.status = "countered"
            session.add(cr)
            new_cr = ChangeRequest(
                deal_id=deal_id, raw_text=req.counter_text,
                created_by=user.id, role=user.role.value, parent_cr_id=cr.id,
            )
            session.add(new_cr)
            results.append({"cr_id": str(cr.id), "action": "countered"})

    await session.commit()

    await record_event(session, deal_id, f"batch_{req.action}", user.id, {
        "batch_id": req.batch_id, "count": len(results),
    })

    # Email counterparty
    try:
        deal = await _get_deal(session, deal_id)
        from services.email import get_counterparty_emails
        if req.action == "accept":
            from services.email import notify_cr_accepted
            for email, name, slug in await get_counterparty_emails(session, deal_id):
                notify_cr_accepted(to=email, deal_title=deal.title, deal_url_or_review_url=f"/review/{slug}")
        elif req.action == "reject":
            from services.email import notify_cr_rejected
            for email, name, slug in await get_counterparty_emails(session, deal_id):
                notify_cr_rejected(to=email, deal_title=deal.title, reason=req.reason or "", deal_url_or_review_url=f"/review/{slug}")
    except Exception:
        pass

    return {"batch_id": req.batch_id, "results": results}
