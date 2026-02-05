from __future__ import annotations

import re
import secrets
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from database import get_session
from models.user import User
from models.deal import Deal
from models.share_link import ShareLink
from models.external_feedback import ExternalFeedback
from schemas.share_link import (
    CreateShareLinkRequest, ShareLinkResponse, FeedbackResponse,
)
from services.auth import get_current_user
from services.rbac import check_deal_access
from services.timeline import record_event

router = APIRouter(prefix="/deals/{deal_id}/share-links", tags=["share-links"])

FRONTEND_URL = "http://localhost:3000"


def _link_response(link: ShareLink) -> ShareLinkResponse:
    url_id = link.slug or link.token
    return ShareLinkResponse(
        id=str(link.id),
        deal_id=str(link.deal_id),
        token=link.token,
        slug=link.slug,
        url=f"{FRONTEND_URL}/review/{url_id}",
        counterparty_name=link.counterparty_name,
        counterparty_email=link.counterparty_email,
        is_active=link.is_active,
        expires_at=link.expires_at,
        created_at=link.created_at,
    )


@router.post("", response_model=ShareLinkResponse, status_code=201)
async def create_share_link(
    deal_id: uuid.UUID,
    req: CreateShareLinkRequest,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    await check_deal_access(session, user, deal_id)

    # Generate clean slug
    deal = (await session.exec(select(Deal).where(Deal.id == deal_id))).first()
    slug_base = re.sub(r"[^a-z0-9]+", "-", (deal.title if deal else "contract").lower()).strip("-")[:40]
    slug = f"{slug_base}-{secrets.token_urlsafe(4)}"

    token = secrets.token_hex(16)
    link = ShareLink(
        deal_id=deal_id,
        token=token,
        slug=slug,
        created_by=user.id,
        counterparty_name=req.counterparty_name,
        counterparty_email=req.counterparty_email,
        expires_at=req.expires_at,
    )
    session.add(link)
    await session.commit()
    await session.refresh(link)

    await record_event(session, deal_id, "share_link_created", user.id, {
        "counterparty_name": req.counterparty_name,
        "link_id": str(link.id),
    })

    return _link_response(link)


@router.get("", response_model=list[ShareLinkResponse])
async def list_share_links(
    deal_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    await check_deal_access(session, user, deal_id)
    result = await session.exec(
        select(ShareLink)
        .where(ShareLink.deal_id == deal_id)
        .order_by(ShareLink.created_at.desc())  # type: ignore
    )
    return [_link_response(link) for link in result.all()]


@router.delete("/{link_id}", status_code=200)
async def deactivate_share_link(
    deal_id: uuid.UUID,
    link_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    await check_deal_access(session, user, deal_id)
    result = await session.exec(
        select(ShareLink).where(ShareLink.id == link_id, ShareLink.deal_id == deal_id)
    )
    link = result.first()
    if not link:
        raise HTTPException(status_code=404, detail="Share link not found")

    link.is_active = False
    session.add(link)
    await session.commit()

    await record_event(session, deal_id, "share_link_deactivated", user.id, {
        "link_id": str(link_id),
    })

    return {"detail": "Share link deactivated"}


@router.get("/feedback", response_model=list[FeedbackResponse])
async def list_external_feedback(
    deal_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    await check_deal_access(session, user, deal_id)
    result = await session.exec(
        select(ExternalFeedback)
        .where(ExternalFeedback.deal_id == deal_id)
        .order_by(ExternalFeedback.created_at.desc())  # type: ignore
    )
    return [
        FeedbackResponse(
            id=str(f.id),
            reviewer_name=f.reviewer_name,
            reviewer_email=f.reviewer_email,
            feedback_text=f.feedback_text,
            created_at=f.created_at,
        )
        for f in result.all()
    ]
