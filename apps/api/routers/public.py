from __future__ import annotations

import io
import os
import json
import uuid
import asyncio
from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import or_
from sqlmodel import select

from database import get_session
from models.share_link import ShareLink
from models.external_feedback import ExternalFeedback
from models.deal import Deal
from models.contract import ContractVersion
from models.change_request import ChangeRequest
from models.company_settings import CompanySettings
from models.audit import AuditEvent
from schemas.share_link import (
    PublicContractResponse, SubmitFeedbackRequest, FeedbackResponse,
    PublicFeedbackHistoryItem, SubmitCounterResponseRequest, ChatRequest,
    PublicTimelineEvent, PublicVersionItem,
    SubmitBatchFeedbackRequest, BatchFeedbackResponse, GroupFeedbackRequest,
    PublicDiffResponse, PublicChangesSummary, FieldChangeItem,
)
from services.timeline import record_event
from services.diffing import compute_diff, compute_field_changes
from services.plg import record_plg_event
from services.notifications import notify_deal_participants
from config import settings as app_settings
from services.email import notify_external_feedback
from models.job import JobRecord
from models.user import User
import asyncio
from workers.inline_runner import run_analyze_change_request, run_generate_timeline_pdf
from services.transcription import transcribe_audio
import time

_chat_counts: dict[str, list] = {}  # session_id -> list of timestamps
CHAT_LIMIT = 5
CHAT_WINDOW = 3600  # 1 hour

router = APIRouter(prefix="/public/review", tags=["public"])


async def _get_active_link(session: AsyncSession, identifier: str) -> ShareLink:
    result = await session.exec(
        select(ShareLink).where(
            or_(ShareLink.slug == identifier, ShareLink.token == identifier),
            ShareLink.is_active == True,  # noqa: E712
        )
    )
    link = result.first()
    if not link:
        raise HTTPException(status_code=404, detail="Share link not found or inactive")
    if link.expires_at and link.expires_at < datetime.utcnow():
        raise HTTPException(status_code=410, detail="Share link has expired")
    return link


@router.get("/{token}", response_model=PublicContractResponse)
async def get_public_contract(
    token: str,
    session: AsyncSession = Depends(get_session),
):
    link = await _get_active_link(session, token)
    await record_plg_event(session, "share_link_opened", share_link_id=link.id, deal_id=link.deal_id)

    deal = (await session.exec(select(Deal).where(Deal.id == link.deal_id))).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    version = (await session.exec(
        select(ContractVersion)
        .where(ContractVersion.deal_id == link.deal_id)
        .order_by(ContractVersion.version_number.desc())  # type: ignore
    )).first()
    if not version:
        raise HTTPException(status_code=404, detail="No contract version found")

    # Update visit tracking
    link.last_visit_at = datetime.utcnow()
    link.last_viewed_version_number = version.version_number
    session.add(link)
    await session.commit()

    return PublicContractResponse(
        deal_title=deal.title,
        deal_type=deal.deal_type,
        full_text=version.full_text,
        version_number=version.version_number,
        counterparty_name=link.counterparty_name,
        counterparty_email=getattr(link, "counterparty_email", None),
        extracted_fields=version.extracted_fields,
        clause_tags=version.clause_tags,
        contract_type=version.contract_type,
        buyer_accepted_at=deal.buyer_accepted_at,
        seller_accepted_at=deal.seller_accepted_at,
        risk_flags=version.risk_flags,
        suggestions=version.suggestions,
    )


@router.get("/{token}/versions/{version_id}/diff", response_model=PublicDiffResponse)
async def get_version_diff(
    token: str,
    version_id: str,
    against: str = "prev",
    session: AsyncSession = Depends(get_session),
):
    link = await _get_active_link(session, token)

    version_b = (await session.exec(
        select(ContractVersion).where(
            ContractVersion.id == uuid.UUID(version_id),
            ContractVersion.deal_id == link.deal_id,
        )
    )).first()
    if not version_b:
        raise HTTPException(status_code=404, detail="Version not found")

    if against == "prev":
        version_a = (await session.exec(
            select(ContractVersion)
            .where(
                ContractVersion.deal_id == link.deal_id,
                ContractVersion.version_number < version_b.version_number,
            )
            .order_by(ContractVersion.version_number.desc())
        )).first()
        if not version_a:
            raise HTTPException(status_code=400, detail="No previous version to diff against")
    else:
        version_a = (await session.exec(
            select(ContractVersion).where(
                ContractVersion.id == uuid.UUID(against),
                ContractVersion.deal_id == link.deal_id,
            )
        )).first()
        if not version_a:
            raise HTTPException(status_code=404, detail="Comparison version not found")

    diff_result = compute_diff(version_a.full_text, version_b.full_text)
    field_changes = compute_field_changes(version_a.extracted_fields, version_b.extracted_fields)

    return PublicDiffResponse(
        version_a_number=version_a.version_number,
        version_b_number=version_b.version_number,
        diff_html=diff_result["diff_html"],
        field_changes=field_changes,
    )


@router.get("/{token}/changes-summary", response_model=PublicChangesSummary)
async def get_changes_summary(
    token: str,
    session: AsyncSession = Depends(get_session),
):
    link = await _get_active_link(session, token)
    last_viewed = link.last_viewed_version_number

    # Get all versions for this deal
    all_versions = (await session.exec(
        select(ContractVersion)
        .where(ContractVersion.deal_id == link.deal_id)
        .order_by(ContractVersion.version_number.asc())
    )).all()

    if last_viewed is None:
        # First visit — no "new" versions
        return PublicChangesSummary(
            new_versions_count=0,
            last_visit_at=link.last_visit_at,
            changes=[],
            feedback_incorporated={},
        )

    new_versions = [v for v in all_versions if v.version_number > last_viewed]
    if not new_versions:
        return PublicChangesSummary(
            new_versions_count=0,
            last_visit_at=link.last_visit_at,
            changes=[],
            feedback_incorporated={},
        )

    # Compute field changes from last_viewed version to latest
    old_version = next((v for v in all_versions if v.version_number == last_viewed), None)
    latest_version = all_versions[-1] if all_versions else None

    changes: list[FieldChangeItem] = []
    if old_version and latest_version:
        raw_changes = compute_field_changes(old_version.extracted_fields, latest_version.extracted_fields)
        changes = [
            FieldChangeItem(field=c["field"], from_value=str(c["from"]) if c["from"] is not None else None, to_value=str(c["to"]) if c["to"] is not None else None)
            for c in raw_changes
        ]

    # Check which feedback was incorporated: feedback → CR → version
    feedback_incorporated: dict = {}
    feedbacks = (await session.exec(
        select(ExternalFeedback).where(ExternalFeedback.share_link_id == link.id)
    )).all()

    for fb in feedbacks:
        if not fb.change_request_id:
            continue
        # Check if any new version was generated from this CR
        for v in new_versions:
            if v.source_cr_id == fb.change_request_id:
                feedback_incorporated[str(fb.id)] = {
                    "feedback_text": fb.feedback_text[:100],
                    "version_number": v.version_number,
                }
                break

    return PublicChangesSummary(
        new_versions_count=len(new_versions),
        last_visit_at=link.last_visit_at,
        changes=changes,
        feedback_incorporated=feedback_incorporated,
    )


async def _create_feedback_item(
    session: AsyncSession, link: ShareLink, reviewer_name: str, reviewer_email: str | None,
    feedback_text: str, batch_id: str | None = None,
) -> tuple[ExternalFeedback, ChangeRequest, str]:
    """Helper to create a single feedback + CR + analysis job. Returns (feedback, cr, job_id)."""
    cr = ChangeRequest(
        deal_id=link.deal_id,
        raw_text=f"[External feedback from {reviewer_name}]: {feedback_text}",
        created_by=link.created_by,
        role="external",
        batch_id=batch_id,
    )
    session.add(cr)
    await session.flush()

    feedback = ExternalFeedback(
        share_link_id=link.id,
        deal_id=link.deal_id,
        reviewer_name=reviewer_name,
        reviewer_email=reviewer_email,
        feedback_text=feedback_text,
        change_request_id=cr.id,
        batch_id=batch_id,
    )
    session.add(feedback)

    job_id = str(uuid.uuid4())
    job = JobRecord(id=job_id, deal_id=link.deal_id, job_type="analyze_change_request", status="pending")
    session.add(job)
    cr.analysis_status = "processing"
    cr.analysis_job_id = job_id
    session.add(cr)

    return feedback, cr, job_id


@router.post("/{token}/feedback", response_model=FeedbackResponse, status_code=201)
async def submit_feedback(
    token: str,
    req: SubmitFeedbackRequest,
    session: AsyncSession = Depends(get_session),
):
    link = await _get_active_link(session, token)

    reviewer_name = req.reviewer_name or link.counterparty_name
    reviewer_email = req.reviewer_email or getattr(link, "counterparty_email", None)

    feedback, cr, job_id = await _create_feedback_item(
        session, link, reviewer_name, reviewer_email, req.feedback_text,
    )

    await session.commit()
    await session.refresh(feedback)

    asyncio.create_task(run_analyze_change_request(job_id, str(link.deal_id), str(cr.id)))

    await record_event(session, link.deal_id, "external_feedback_received", details={
        "reviewer_name": reviewer_name,
        "feedback_preview": req.feedback_text[:100],
        "share_link_id": str(link.id),
    })

    await notify_deal_participants(
        session, link.deal_id,
        type="external_feedback",
        title="New external feedback",
        message=f"{reviewer_name} submitted feedback on the contract.",
    )

    # Email notification to deal owner (best-effort)
    try:
        deal = (await session.exec(select(Deal).where(Deal.id == link.deal_id))).first()
        if deal:
            owner = (await session.exec(select(User).where(User.id == link.created_by))).first()
            if owner and owner.email:
                notify_external_feedback(
                    to=owner.email,
                    deal_title=deal.title,
                    reviewer_name=reviewer_name,
                )
    except Exception:
        pass

    await record_plg_event(session, "share_link_feedback_submitted", share_link_id=link.id, deal_id=link.deal_id)

    return FeedbackResponse(
        id=str(feedback.id),
        reviewer_name=feedback.reviewer_name,
        reviewer_email=feedback.reviewer_email,
        feedback_text=feedback.feedback_text,
        batch_id=feedback.batch_id,
        created_at=feedback.created_at,
    )


@router.post("/{token}/feedback/batch", response_model=BatchFeedbackResponse, status_code=201)
async def submit_batch_feedback(
    token: str,
    req: SubmitBatchFeedbackRequest,
    session: AsyncSession = Depends(get_session),
):
    """Submit multiple feedback items at once, grouped under a batch_id."""
    link = await _get_active_link(session, token)
    batch_id = str(uuid.uuid4())

    items: list[FeedbackResponse] = []
    job_ids: list[tuple[str, str]] = []  # (job_id, cr_id)

    for item in req.items:
        reviewer_name = item.reviewer_name or link.counterparty_name
        reviewer_email = item.reviewer_email or getattr(link, "counterparty_email", None)

        feedback, cr, job_id = await _create_feedback_item(
            session, link, reviewer_name, reviewer_email, item.feedback_text, batch_id,
        )
        await session.flush()
        job_ids.append((job_id, str(cr.id)))
        items.append(FeedbackResponse(
            id=str(feedback.id),
            reviewer_name=feedback.reviewer_name,
            reviewer_email=feedback.reviewer_email,
            feedback_text=feedback.feedback_text,
            batch_id=batch_id,
            created_at=feedback.created_at,
        ))

    await session.commit()

    # Dispatch analysis for all CRs
    for job_id, cr_id in job_ids:
        asyncio.create_task(run_analyze_change_request(job_id, str(link.deal_id), cr_id))

    # Single timeline event for the batch
    reviewer_name = req.items[0].reviewer_name or link.counterparty_name
    await record_event(session, link.deal_id, "external_feedback_batch_received", details={
        "reviewer_name": reviewer_name,
        "item_count": len(req.items),
        "batch_id": batch_id,
        "share_link_id": str(link.id),
    })

    await notify_deal_participants(
        session, link.deal_id,
        type="external_feedback",
        title="Batch feedback received",
        message=f"{reviewer_name} submitted {len(req.items)} feedback items.",
    )

    # Email notification (best-effort)
    try:
        deal = (await session.exec(select(Deal).where(Deal.id == link.deal_id))).first()
        if deal:
            owner = (await session.exec(select(User).where(User.id == link.created_by))).first()
            if owner and owner.email:
                notify_external_feedback(to=owner.email, deal_title=deal.title, reviewer_name=reviewer_name)
    except Exception:
        pass

    await record_plg_event(session, "share_link_batch_feedback_submitted", share_link_id=link.id, deal_id=link.deal_id)

    return BatchFeedbackResponse(batch_id=batch_id, items=items)


@router.post("/{token}/feedback/group", status_code=200)
async def group_feedback(
    token: str,
    req: GroupFeedbackRequest,
    session: AsyncSession = Depends(get_session),
):
    """Group existing feedback items under a common batch_id."""
    link = await _get_active_link(session, token)
    batch_id = str(uuid.uuid4())

    for fid in req.feedback_ids:
        fb = (await session.exec(
            select(ExternalFeedback).where(
                ExternalFeedback.id == uuid.UUID(fid),
                ExternalFeedback.share_link_id == link.id,
            )
        )).first()
        if fb:
            fb.batch_id = batch_id
            session.add(fb)
            # Also tag the linked CR
            if fb.change_request_id:
                cr = (await session.exec(
                    select(ChangeRequest).where(ChangeRequest.id == fb.change_request_id)
                )).first()
                if cr:
                    cr.batch_id = batch_id
                    session.add(cr)

    await session.commit()
    return {"batch_id": batch_id, "grouped_count": len(req.feedback_ids)}


@router.post("/{token}/accept-terms")
async def counterparty_accept_terms(
    token: str,
    session: AsyncSession = Depends(get_session),
):
    """Counterparty accepts terms. Role is inverse of admin's based on deal_type."""
    link = await _get_active_link(session, token)
    deal = (await session.exec(select(Deal).where(Deal.id == link.deal_id))).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    now = datetime.utcnow()

    # Counterparty is the opposite side of the admin
    if deal.deal_type == "sale":
        # admin = seller, counterparty = buyer
        if deal.buyer_accepted_at:
            raise HTTPException(status_code=400, detail="Buyer has already accepted")
        deal.buyer_accepted_at = now
    else:
        # admin = buyer, counterparty = seller
        if deal.seller_accepted_at:
            raise HTTPException(status_code=400, detail="Seller has already accepted")
        deal.seller_accepted_at = now

    both_accepted = deal.buyer_accepted_at is not None and deal.seller_accepted_at is not None
    if both_accepted:
        deal.current_state = "accepted"
    elif deal.current_state != "final_review":
        deal.current_state = "final_review"

    session.add(deal)
    await session.commit()
    await session.refresh(deal)

    side = "buyer" if deal.deal_type == "sale" else "seller"
    await record_event(session, deal.id, "terms_accepted", details={
        "side": side, "share_link_id": str(link.id),
    })

    await record_plg_event(session, "share_link_terms_accepted", share_link_id=link.id, deal_id=link.deal_id)

    # Email admin
    try:
        from services.email import notify_deal_accepted, send_email
        from services.auth import create_magic_link
        owner = (await session.exec(select(User).where(User.id == link.created_by))).first()
        if owner and owner.email:
            if both_accepted:
                notify_deal_accepted(to=owner.email, deal_title=deal.title, deal_url_or_review_url=f"/deals/{deal.id}")
                # Trigger timeline PDF generation
                try:
                    timeline_job_id = str(uuid.uuid4())
                    timeline_job = JobRecord(id=timeline_job_id, deal_id=deal.id, job_type="generate_timeline_pdf", status="pending")
                    session.add(timeline_job)
                    await session.commit()
                    asyncio.create_task(run_generate_timeline_pdf(timeline_job_id, str(deal.id)))
                except Exception:
                    pass
            else:
                magic_url = await create_magic_link(session, owner.id, deal.id, f"/deals/{deal.id}")
                send_email(
                    to=owner.email,
                    subject=f"Counterparty accepted terms on {deal.title}",
                    html=f'<p>The counterparty has accepted the terms on <strong>{deal.title}</strong>. '
                         f'<a href="{magic_url}">Click here to review and accept</a>.</p>',
                )
    except Exception:
        pass

    return {
        "deal_id": str(deal.id),
        "current_state": deal.current_state,
        "buyer_accepted_at": deal.buyer_accepted_at.isoformat() if deal.buyer_accepted_at else None,
        "seller_accepted_at": deal.seller_accepted_at.isoformat() if deal.seller_accepted_at else None,
    }


@router.get("/{token}/feedback", response_model=List[PublicFeedbackHistoryItem])
async def get_feedback_history(
    token: str,
    session: AsyncSession = Depends(get_session),
):
    link = await _get_active_link(session, token)

    result = await session.exec(
        select(ExternalFeedback)
        .where(ExternalFeedback.share_link_id == link.id)
        .order_by(ExternalFeedback.created_at.desc())  # type: ignore
    )
    feedbacks = result.all()

    items: list[PublicFeedbackHistoryItem] = []
    for fb in feedbacks:
        cr_status = None
        analysis_status = None
        analysis_result = None
        counter_proposal = None

        if fb.change_request_id:
            cr = (await session.exec(
                select(ChangeRequest).where(ChangeRequest.id == fb.change_request_id)
            )).first()
            if cr:
                cr_status = cr.status
                analysis_status = cr.analysis_status
                if cr.analysis_result:
                    analysis_result = {
                        k: v for k, v in cr.analysis_result.items()
                        if k not in ("input_tokens", "output_tokens", "token_usage")
                    }
                if cr.status == "countered":
                    counter_cr = (await session.exec(
                        select(ChangeRequest).where(ChangeRequest.parent_cr_id == cr.id)
                    )).first()
                    if counter_cr:
                        counter_proposal = counter_cr.raw_text

        items.append(PublicFeedbackHistoryItem(
            id=str(fb.id),
            reviewer_name=fb.reviewer_name,
            feedback_text=fb.feedback_text,
            created_at=fb.created_at,
            cr_status=cr_status,
            analysis_status=analysis_status,
            analysis_result=analysis_result,
            counter_proposal=counter_proposal,
            batch_id=fb.batch_id,
        ))

    return items


@router.post("/{token}/counter", response_model=FeedbackResponse, status_code=201)
async def submit_counter_response(
    token: str,
    req: SubmitCounterResponseRequest,
    session: AsyncSession = Depends(get_session),
):
    link = await _get_active_link(session, token)

    reviewer_name = req.reviewer_name or link.counterparty_name
    reviewer_email = req.reviewer_email or getattr(link, "counterparty_email", None)

    original_fb = (await session.exec(
        select(ExternalFeedback).where(
            ExternalFeedback.id == uuid.UUID(req.original_feedback_id),
            ExternalFeedback.share_link_id == link.id,
        )
    )).first()
    if not original_fb:
        raise HTTPException(status_code=404, detail="Original feedback not found")
    if not original_fb.change_request_id:
        raise HTTPException(status_code=400, detail="Original feedback has no linked change request")

    original_cr = (await session.exec(
        select(ChangeRequest).where(ChangeRequest.id == original_fb.change_request_id)
    )).first()
    if not original_cr or original_cr.status != "countered":
        raise HTTPException(status_code=400, detail="This feedback is not in a countered state")

    new_cr = ChangeRequest(
        deal_id=link.deal_id,
        raw_text=f"[Counter-response from {reviewer_name}]: {req.response_text}",
        created_by=link.created_by,
        role="external",
        parent_cr_id=original_cr.id,
    )
    session.add(new_cr)
    await session.flush()

    new_feedback = ExternalFeedback(
        share_link_id=link.id,
        deal_id=link.deal_id,
        reviewer_name=reviewer_name,
        reviewer_email=reviewer_email,
        feedback_text=req.response_text,
        change_request_id=new_cr.id,
    )
    session.add(new_feedback)

    job_id = str(uuid.uuid4())
    job = JobRecord(id=job_id, deal_id=link.deal_id, job_type="analyze_change_request", status="pending")
    session.add(job)
    new_cr.analysis_status = "processing"
    new_cr.analysis_job_id = job_id
    session.add(new_cr)

    await session.commit()
    await session.refresh(new_feedback)

    asyncio.create_task(run_analyze_change_request(job_id, str(link.deal_id), str(new_cr.id)))

    await record_event(session, link.deal_id, "external_counter_response", details={
        "reviewer_name": reviewer_name,
        "response_preview": req.response_text[:100],
        "original_feedback_id": req.original_feedback_id,
    })

    await notify_deal_participants(
        session, link.deal_id,
        type="external_feedback",
        title="Counter-proposal response received",
        message=f"{reviewer_name} responded to a counter-proposal.",
    )

    return FeedbackResponse(
        id=str(new_feedback.id),
        reviewer_name=new_feedback.reviewer_name,
        reviewer_email=new_feedback.reviewer_email,
        feedback_text=new_feedback.feedback_text,
        created_at=new_feedback.created_at,
    )


@router.post("/{token}/chat")
async def chat_with_contract(
    token: str,
    req: ChatRequest,
    session: AsyncSession = Depends(get_session),
):
    link = await _get_active_link(session, token)
    await record_plg_event(session, "share_link_chat_used", share_link_id=link.id, deal_id=link.deal_id, session_id=getattr(req, 'session_id', None))

    sid = getattr(req, 'session_id', None)
    if sid:
        now = time.time()
        _chat_counts.setdefault(sid, [])
        _chat_counts[sid] = [t for t in _chat_counts[sid] if now - t < CHAT_WINDOW]
        if len(_chat_counts[sid]) >= CHAT_LIMIT:
            raise HTTPException(
                status_code=429,
                detail="You've used your free AI messages.",
            )
        _chat_counts[sid].append(now)

    deal = (await session.exec(select(Deal).where(Deal.id == link.deal_id))).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    version = (await session.exec(
        select(ContractVersion)
        .where(ContractVersion.deal_id == link.deal_id)
        .order_by(ContractVersion.version_number.desc())  # type: ignore
    )).first()
    if not version:
        raise HTTPException(status_code=404, detail="No contract version found")

    contract_context = f"CONTRACT TITLE: {deal.title}\n\n"
    contract_context += f"FULL TEXT:\n{version.full_text}\n\n"
    if version.extracted_fields:
        contract_context += f"EXTRACTED FIELDS:\n{json.dumps(version.extracted_fields, indent=2)}\n\n"
    if version.clause_tags:
        contract_context += f"CLAUSE TAGS:\n{json.dumps(version.clause_tags, indent=2)}\n\n"

    system_prompt = (
        "You are Pactly AI, a helpful contract assistant. "
        "Answer questions about this contract clearly and concisely based only on the contract content. "
        "If something isn't in the contract, say so.\n\n"
        f"{contract_context}"
    )

    messages = []
    for msg in req.history:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": req.question})

    api_key = app_settings.anthropic_api_key

    if not api_key:
        async def mock_stream():
            canned = (
                "Based on my review of the contract, I can help answer your question. "
                "However, I'm currently running in demo mode without an AI API key configured. "
                "Please contact the administrator to enable the full AI chat experience. "
                "In the meantime, you can use the Feedback tab to submit your questions or concerns directly."
            )
            words = canned.split(" ")
            for word in words:
                yield f"data: {json.dumps({'text': word + ' '})}\n\n"
                await asyncio.sleep(0.05)
            yield "data: [DONE]\n\n"

        return StreamingResponse(mock_stream(), media_type="text/event-stream")

    import anthropic

    client = anthropic.Anthropic(api_key=api_key)

    async def stream_response():
        try:
            with client.messages.stream(
                model="claude-sonnet-4-20250514",
                max_tokens=1024,
                system=system_prompt,
                messages=messages,
            ) as stream:
                for text in stream.text_stream:
                    yield f"data: {json.dumps({'text': text})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'text': f'Error: {str(e)}'})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(stream_response(), media_type="text/event-stream")


@router.get("/{token}/timeline", response_model=List[PublicTimelineEvent])
async def get_public_timeline(
    token: str,
    session: AsyncSession = Depends(get_session),
):
    link = await _get_active_link(session, token)

    result = await session.exec(
        select(AuditEvent)
        .where(AuditEvent.deal_id == link.deal_id)
        .order_by(AuditEvent.created_at.asc())  # type: ignore
    )
    events = result.all()

    sanitized_keys = {"user_id", "created_by"}
    items: list[PublicTimelineEvent] = []
    for ev in events:
        details = None
        if ev.details:
            details = {k: v for k, v in ev.details.items() if k not in sanitized_keys}
        items.append(PublicTimelineEvent(
            id=str(ev.id),
            action=ev.action,
            details=details,
            created_at=ev.created_at,
        ))

    return items


@router.get("/{token}/versions", response_model=List[PublicVersionItem])
async def get_public_versions(
    token: str,
    session: AsyncSession = Depends(get_session),
):
    link = await _get_active_link(session, token)

    result = await session.exec(
        select(ContractVersion)
        .where(ContractVersion.deal_id == link.deal_id)
        .order_by(ContractVersion.version_number.desc())  # type: ignore
    )
    versions = result.all()

    return [
        PublicVersionItem(
            id=str(v.id),
            version_number=v.version_number,
            source=v.source,
            contract_type=v.contract_type,
            change_summary=v.change_summary,
            has_diff=v.version_number > 0,
            created_at=v.created_at,
        )
        for v in versions
    ]


@router.get("/{token}/brand")
async def get_public_brand(
    token: str,
    session: AsyncSession = Depends(get_session),
):
    link = await _get_active_link(session, token)
    deal = (await session.exec(select(Deal).where(Deal.id == link.deal_id))).first()
    if deal and deal.organization_id:
        from models.organization import Organization
        org = (await session.exec(
            select(Organization).where(Organization.id == deal.organization_id)
        )).first()
        if org:
            return {
                "logo_url": org.logo_url,
                "primary_color": org.primary_color,
                "company_name": org.name,
            }
    return {"logo_url": None, "primary_color": "#14B8A6", "company_name": "Pactly"}


@router.get("/{token}/timeline-pdf")
async def get_public_timeline_pdf(
    token: str,
    session: AsyncSession = Depends(get_session),
):
    """Download the Critical Dates PDF (public)."""
    link = await _get_active_link(session, token)
    deal = (await session.exec(select(Deal).where(Deal.id == link.deal_id))).first()
    if not deal or not deal.timeline_pdf_base64:
        raise HTTPException(status_code=404, detail="Timeline PDF not yet generated")

    import base64
    pdf_bytes = base64.b64decode(deal.timeline_pdf_base64)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="Critical_Dates_{deal.title}.pdf"'},
    )


@router.get("/{token}/deliverables")
async def get_public_deliverables(
    token: str,
    session: AsyncSession = Depends(get_session),
):
    """Return confirmed deliverables for the counterparty view."""
    link = await _get_active_link(session, token)
    from models.deliverable import Deliverable
    from schemas.deliverables import DeliverablePublicResponse

    result = await session.exec(
        select(Deliverable).where(
            Deliverable.deal_id == link.deal_id,
            Deliverable.is_confirmed == True,  # noqa: E712
        ).order_by(Deliverable.due_date.asc())  # type: ignore
    )
    deliverables = result.all()
    return [
        DeliverablePublicResponse(
            id=str(d.id),
            description=d.description,
            due_date=d.due_date,
            category=d.category,
            responsible_party=d.responsible_party,
            status=d.status,
            filename=d.filename,
            submitted_at=d.submitted_at,
            created_at=d.created_at,
        )
        for d in deliverables
    ]


@router.post("/{token}/deliverables/{deliverable_id}/upload")
async def public_upload_deliverable_file(
    token: str,
    deliverable_id: str,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
):
    """Counterparty uploads a file for their assigned deliverable (multipart)."""
    import base64
    from models.deliverable import Deliverable

    link = await _get_active_link(session, token)

    d = (await session.exec(
        select(Deliverable).where(
            Deliverable.id == uuid.UUID(deliverable_id),
            Deliverable.deal_id == link.deal_id,
            Deliverable.is_confirmed == True,  # noqa: E712
            Deliverable.responsible_party == "counterparty",
        )
    )).first()
    if not d:
        raise HTTPException(status_code=404, detail="Deliverable not found or not assigned to you")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File exceeds 10 MB limit")

    d.filename = file.filename
    d.file_content_base64 = base64.b64encode(content).decode()
    d.status = "submitted"
    d.submitted_at = datetime.utcnow()
    d.updated_at = datetime.utcnow()
    session.add(d)

    # Audit event
    event = AuditEvent(
        deal_id=link.deal_id,
        action="deliverable_uploaded_by_counterparty",
        details={
            "deliverable_id": deliverable_id,
            "filename": file.filename,
            "share_link_id": str(link.id),
        },
    )
    session.add(event)

    # Notify deal participants
    from services.notifications import notify_deal_participants
    await notify_deal_participants(
        session, link.deal_id,
        type="deliverable_submitted",
        title="Counterparty uploaded a deliverable",
        message=f'{link.counterparty_name} uploaded "{file.filename}" for "{d.description}".',
    )

    await session.commit()
    await session.refresh(d)

    from schemas.deliverables import DeliverablePublicResponse
    return DeliverablePublicResponse(
        id=str(d.id),
        description=d.description,
        due_date=d.due_date,
        category=d.category,
        responsible_party=d.responsible_party,
        status=d.status,
        filename=d.filename,
        submitted_at=d.submitted_at,
        created_at=d.created_at,
    )


@router.get("/{token}/insight")
async def get_contract_insight(
    token: str,
    session: AsyncSession = Depends(get_session),
):
    link = await _get_active_link(session, token)

    if link.cached_insight:
        return {"insight": link.cached_insight}

    deal = (await session.exec(select(Deal).where(Deal.id == link.deal_id))).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    version = (await session.exec(
        select(ContractVersion)
        .where(ContractVersion.deal_id == link.deal_id)
        .order_by(ContractVersion.version_number.desc())
    )).first()
    if not version:
        return {"insight": None}

    api_key = app_settings.anthropic_api_key
    if not api_key:
        return {"insight": "This contract is ready for your review. Use the AI chat to ask specific questions about terms, obligations, and deadlines."}

    import anthropic
    try:
        client = anthropic.Anthropic(api_key=api_key)
        contract_preview = (version.full_text or "")[:3000]
        fields_str = json.dumps(version.extracted_fields, indent=2) if version.extracted_fields else ""

        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=200,
            system="Give a 2-3 sentence insight about the most important thing a reviewer should know about this contract. Focus on key obligations, deadlines, or financial terms. Be specific with numbers and dates from the contract. Do not use markdown.",
            messages=[{"role": "user", "content": f"Contract title: {deal.title}\n\nKey fields:\n{fields_str}\n\nContract text (preview):\n{contract_preview}"}],
        )
        insight = response.content[0].text
    except Exception:
        insight = "This contract is ready for your review. Use the AI chat to ask specific questions."

    link.cached_insight = insight
    session.add(link)
    await session.commit()

    return {"insight": insight}


MAX_AUDIO_SIZE = 25 * 1024 * 1024  # 25 MB


@router.post("/{token}/transcribe")
async def public_transcribe_voice(
    token: str,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
):
    """Transcribe audio for public review users."""
    await _get_active_link(session, token)

    audio_bytes = await file.read()
    if len(audio_bytes) > MAX_AUDIO_SIZE:
        raise HTTPException(status_code=413, detail="Audio file too large. Maximum 25 MB.")

    try:
        text = await transcribe_audio(audio_bytes, file.filename or "audio.webm")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Transcription failed: {str(e)}")

    return {"text": text}
