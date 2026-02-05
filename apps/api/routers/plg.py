from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func, col

from database import get_session
from models.plg_event import PLGEvent
from schemas.plg import PLGEventRequest, PLGMetricsResponse
from services.auth import get_current_user
from models.user import User, UserRole

router = APIRouter(prefix="/plg", tags=["plg"])


@router.post("/events", status_code=201)
async def create_plg_event(
    req: PLGEventRequest,
    session: AsyncSession = Depends(get_session),
):
    event = PLGEvent(
        event_type=req.event_type,
        share_link_id=uuid.UUID(req.share_link_id) if req.share_link_id else None,
        session_id=req.session_id,
        event_metadata=req.metadata,
    )
    session.add(event)
    await session.commit()
    await session.refresh(event)
    return {"id": str(event.id), "event_type": event.event_type}


@router.get("/metrics", response_model=PLGMetricsResponse)
async def get_plg_metrics(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.super_admin:
        raise HTTPException(status_code=403, detail="Super admin access required")

    since = datetime.utcnow() - timedelta(days=30)

    # Funnel: count per event_type in last 30 days
    funnel_q = (
        select(PLGEvent.event_type, func.count().label("cnt"))
        .where(PLGEvent.created_at >= since)
        .group_by(PLGEvent.event_type)
    )
    funnel_rows = (await session.exec(funnel_q)).all()
    funnel = {row[0]: row[1] for row in funnel_rows}

    # Time series: daily share_link_opened counts
    ts_q = (
        select(
            func.date(PLGEvent.created_at).label("day"),
            func.count().label("cnt"),
        )
        .where(PLGEvent.created_at >= since, PLGEvent.event_type == "share_link_opened")
        .group_by(func.date(PLGEvent.created_at))
        .order_by(func.date(PLGEvent.created_at))
    )
    ts_rows = (await session.exec(ts_q)).all()
    time_series = [{"date": str(row[0]), "count": row[1]} for row in ts_rows]

    # Top links: share_link_id with most events
    top_q = (
        select(PLGEvent.share_link_id, func.count().label("cnt"))
        .where(PLGEvent.created_at >= since, PLGEvent.share_link_id.isnot(None))  # type: ignore
        .group_by(PLGEvent.share_link_id)
        .order_by(func.count().desc())
        .limit(10)
    )
    top_rows = (await session.exec(top_q)).all()
    top_links = [{"share_link_id": str(row[0]), "event_count": row[1]} for row in top_rows]

    return PLGMetricsResponse(funnel=funnel, time_series=time_series, top_links=top_links)
