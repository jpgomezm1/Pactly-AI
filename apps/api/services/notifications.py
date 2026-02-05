import uuid
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from models.notification import Notification
from models.deal import DealAssignment
from models.user import User, UserRole


async def create_notification(
    session: AsyncSession,
    user_id: uuid.UUID,
    type: str,
    title: str,
    message: str,
    deal_id: Optional[uuid.UUID] = None,
) -> Notification:
    notification = Notification(
        user_id=user_id,
        deal_id=deal_id,
        type=type,
        title=title,
        message=message,
    )
    session.add(notification)
    await session.commit()
    await session.refresh(notification)
    return notification


async def notify_deal_participants(
    session: AsyncSession,
    deal_id: uuid.UUID,
    type: str,
    title: str,
    message: str,
    exclude_user_id: Optional[uuid.UUID] = None,
) -> list[Notification]:
    result = await session.exec(
        select(DealAssignment).where(DealAssignment.deal_id == deal_id)
    )
    assignments = result.all()
    notifications = []
    for a in assignments:
        if exclude_user_id and a.user_id == exclude_user_id:
            continue
        n = Notification(
            user_id=a.user_id,
            deal_id=deal_id,
            type=type,
            title=title,
            message=message,
        )
        session.add(n)
        notifications.append(n)
    if notifications:
        await session.commit()
    return notifications


async def notify_admins(
    session: AsyncSession,
    type: str,
    title: str,
    message: str,
    deal_id: Optional[uuid.UUID] = None,
    exclude_user_id: Optional[uuid.UUID] = None,
) -> list[Notification]:
    result = await session.exec(
        select(User).where(
            User.role.in_([UserRole.admin, UserRole.transaction_coordinator]),  # type: ignore
            User.is_active == True,  # noqa: E712
        )
    )
    admins = result.all()
    notifications = []
    for admin in admins:
        if exclude_user_id and admin.id == exclude_user_id:
            continue
        n = Notification(
            user_id=admin.id,
            deal_id=deal_id,
            type=type,
            title=title,
            message=message,
        )
        session.add(n)
        notifications.append(n)
    if notifications:
        await session.commit()
    return notifications
