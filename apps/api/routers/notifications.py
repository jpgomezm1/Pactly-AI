from __future__ import annotations

import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func

from database import get_session
from models.user import User
from models.notification import Notification
from services.auth import get_current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
async def list_notifications(
    limit: int = Query(20, le=100),
    offset: int = Query(0),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    result = await session.exec(
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())  # type: ignore
        .offset(offset)
        .limit(limit)
    )
    notifications = result.all()
    return [
        {
            "id": str(n.id),
            "deal_id": str(n.deal_id) if n.deal_id else None,
            "type": n.type,
            "title": n.title,
            "message": n.message,
            "is_read": n.is_read,
            "created_at": n.created_at,
        }
        for n in notifications
    ]


@router.get("/unread-count")
async def unread_count(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    result = await session.exec(
        select(func.count(Notification.id)).where(
            Notification.user_id == user.id,
            Notification.is_read == False,  # noqa: E712
        )
    )
    count = result.one()
    return {"count": count}


@router.put("/{notification_id}/read")
async def mark_read(
    notification_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    result = await session.exec(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user.id,
        )
    )
    n = result.first()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    n.is_read = True
    session.add(n)
    await session.commit()
    return {"detail": "Marked as read"}


@router.put("/read-all")
async def mark_all_read(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    result = await session.exec(
        select(Notification).where(
            Notification.user_id == user.id,
            Notification.is_read == False,  # noqa: E712
        )
    )
    for n in result.all():
        n.is_read = True
        session.add(n)
    await session.commit()
    return {"detail": "All marked as read"}
