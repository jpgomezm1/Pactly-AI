from __future__ import annotations

import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from database import get_session
from models.user import User
from models.deal import Deal
from models.audit import AuditEvent
from schemas.timeline import TimelineEvent, TimelineResponse, AuditEventResponse
from services.auth import get_current_user
from services.rbac import check_deal_access, check_audit_access

router = APIRouter(prefix="/deals/{deal_id}", tags=["timeline"])


@router.get("/timeline", response_model=TimelineResponse)
async def get_timeline(
    deal_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    await check_deal_access(session, user, deal_id)

    deal_result = await session.exec(select(Deal).where(Deal.id == deal_id))
    deal = deal_result.first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    result = await session.exec(
        select(AuditEvent)
        .where(AuditEvent.deal_id == deal_id)
        .order_by(AuditEvent.created_at)
    )
    events = [
        TimelineEvent(
            id=str(e.id), action=e.action,
            details=e.details, user_id=str(e.user_id) if e.user_id else None,
            created_at=e.created_at,
        )
        for e in result.all()
    ]

    return TimelineResponse(
        deal_id=str(deal_id), current_state=deal.current_state, events=events,
    )


@router.get("/audit", response_model=list[AuditEventResponse])
async def get_audit(
    deal_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    await check_deal_access(session, user, deal_id)
    await check_audit_access(user)

    result = await session.exec(
        select(AuditEvent)
        .where(AuditEvent.deal_id == deal_id)
        .order_by(AuditEvent.created_at.desc())  # type: ignore
    )
    return [
        AuditEventResponse(
            id=str(e.id), deal_id=str(e.deal_id),
            user_id=str(e.user_id) if e.user_id else None,
            action=e.action, details=e.details, created_at=e.created_at,
        )
        for e in result.all()
    ]
