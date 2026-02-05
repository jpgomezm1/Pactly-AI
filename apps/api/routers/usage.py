from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session
from models.user import User
from services.auth import get_current_user
from services.tenant import get_current_org
from services.tokens import get_token_status

router = APIRouter(prefix="/usage", tags=["usage"])


@router.get("")
async def get_usage(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    org = await get_current_org(user, session)
    return await get_token_status(session, org)
