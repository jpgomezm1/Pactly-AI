from __future__ import annotations

import uuid
import asyncio
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, desc

from database import get_session
from models.user import User
from models.deal import Deal
from models.offer_letter import OfferLetter
from models.job import JobRecord
from models.audit import AuditEvent
from schemas.offer_letter import (
    GenerateOfferLetterRequest,
    OfferLetterResponse,
    OfferLetterUpdate,
)
from services.auth import get_current_user
from services.rbac import check_deal_access
from workers.inline_runner import run_generate_offer_letter

router = APIRouter(prefix="/deals/{deal_id}/offer-letters", tags=["offer-letters"])


def _offer_letter_response(ol: OfferLetter) -> OfferLetterResponse:
    return OfferLetterResponse(
        id=str(ol.id),
        deal_id=str(ol.deal_id),
        user_prompt=ol.user_prompt,
        full_text=ol.full_text,
        buyer_name=ol.buyer_name,
        seller_name=ol.seller_name,
        property_address=ol.property_address,
        purchase_price=ol.purchase_price,
        earnest_money=ol.earnest_money,
        closing_date=ol.closing_date,
        contingencies=ol.contingencies,
        additional_terms=ol.additional_terms,
        prompt_version=ol.prompt_version,
        status=ol.status,
        created_by=str(ol.created_by),
        created_at=ol.created_at,
        updated_at=ol.updated_at,
    )


@router.post("/generate", response_model=dict, status_code=201)
async def generate_offer_letter(
    deal_id: uuid.UUID,
    req: GenerateOfferLetterRequest,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Generate an AI-powered offer letter for the deal."""
    await check_deal_access(session, user, deal_id)

    # Get deal for context
    deal = await session.get(Deal, deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    # Create job record
    job_id = str(uuid.uuid4())
    job = JobRecord(
        id=job_id,
        deal_id=deal_id,
        job_type="generate_offer_letter",
        status="pending",
    )
    session.add(job)
    await session.commit()

    # Run generation in background
    asyncio.create_task(
        run_generate_offer_letter(
            job_id=job_id,
            deal_id=str(deal_id),
            user_prompt=req.prompt,
            deal_title=deal.title,
            deal_address=deal.address or "",
            deal_type=deal.deal_type,
            user_id=str(user.id),
        )
    )

    # Record audit event
    audit_event = AuditEvent(
        deal_id=deal_id,
        user_id=user.id,
        action="offer_letter_generation_started",
        details={"job_id": job_id},
    )
    session.add(audit_event)
    await session.commit()

    return {"job_id": job_id, "message": "Offer letter generation started."}


@router.get("", response_model=list[OfferLetterResponse])
async def list_offer_letters(
    deal_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """List all offer letters for a deal."""
    await check_deal_access(session, user, deal_id)

    result = await session.exec(
        select(OfferLetter)
        .where(OfferLetter.deal_id == deal_id)
        .order_by(desc(OfferLetter.created_at))
    )
    letters = result.all()
    return [_offer_letter_response(ol) for ol in letters]


@router.get("/{offer_letter_id}", response_model=OfferLetterResponse)
async def get_offer_letter(
    deal_id: uuid.UUID,
    offer_letter_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Get a single offer letter."""
    await check_deal_access(session, user, deal_id)

    ol = await session.get(OfferLetter, offer_letter_id)
    if not ol or ol.deal_id != deal_id:
        raise HTTPException(status_code=404, detail="Offer letter not found")

    return _offer_letter_response(ol)


@router.put("/{offer_letter_id}", response_model=OfferLetterResponse)
async def update_offer_letter(
    deal_id: uuid.UUID,
    offer_letter_id: uuid.UUID,
    req: OfferLetterUpdate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Update an offer letter."""
    await check_deal_access(session, user, deal_id)

    ol = await session.get(OfferLetter, offer_letter_id)
    if not ol or ol.deal_id != deal_id:
        raise HTTPException(status_code=404, detail="Offer letter not found")

    # Update fields
    update_data = req.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(ol, key, value)

    ol.updated_at = datetime.utcnow()
    session.add(ol)

    # Record audit event
    audit_event = AuditEvent(
        deal_id=deal_id,
        user_id=user.id,
        action="offer_letter_updated",
        details={"offer_letter_id": str(offer_letter_id), "fields_updated": list(update_data.keys())},
    )
    session.add(audit_event)

    await session.commit()
    await session.refresh(ol)

    return _offer_letter_response(ol)


@router.delete("/{offer_letter_id}", response_model=dict)
async def delete_offer_letter(
    deal_id: uuid.UUID,
    offer_letter_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Delete an offer letter."""
    await check_deal_access(session, user, deal_id)

    ol = await session.get(OfferLetter, offer_letter_id)
    if not ol or ol.deal_id != deal_id:
        raise HTTPException(status_code=404, detail="Offer letter not found")

    await session.delete(ol)

    # Record audit event
    audit_event = AuditEvent(
        deal_id=deal_id,
        user_id=user.id,
        action="offer_letter_deleted",
        details={"offer_letter_id": str(offer_letter_id)},
    )
    session.add(audit_event)

    await session.commit()

    return {"message": "Offer letter deleted."}
