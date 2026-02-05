import uuid
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from models.plg_event import PLGEvent


async def record_plg_event(
    session: AsyncSession,
    event_type: str,
    share_link_id: Optional[uuid.UUID] = None,
    session_id: Optional[str] = None,
    user_id: Optional[uuid.UUID] = None,
    deal_id: Optional[uuid.UUID] = None,
    event_metadata: Optional[dict] = None,
) -> PLGEvent:
    event = PLGEvent(
        event_type=event_type,
        share_link_id=share_link_id,
        session_id=session_id,
        user_id=user_id,
        deal_id=deal_id,
        event_metadata=event_metadata,
    )
    session.add(event)
    await session.commit()
    await session.refresh(event)
    return event
