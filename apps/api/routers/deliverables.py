"""Deliverables CRUD for deal participants (authenticated)."""
from __future__ import annotations

import base64
import uuid
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from database import get_session
from models.deliverable import Deliverable
from schemas.deliverables import DeliverableResponse, DeliverableUpdate
from services.auth import get_current_user
from services.rbac import check_deal_access
from models.user import User
from models.audit import AuditEvent

router = APIRouter(prefix="/deals/{deal_id}/deliverables", tags=["deliverables"])

MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB


def _to_response(d: Deliverable) -> DeliverableResponse:
    return DeliverableResponse(
        id=str(d.id),
        deal_id=str(d.deal_id),
        description=d.description,
        due_date=d.due_date,
        category=d.category,
        responsible_party=d.responsible_party,
        ai_suggested_party=d.ai_suggested_party,
        is_confirmed=d.is_confirmed,
        status=d.status,
        filename=d.filename,
        submitted_at=d.submitted_at,
        approved_at=d.approved_at,
        approved_by=str(d.approved_by) if d.approved_by else None,
        reminder_7d_sent=d.reminder_7d_sent,
        reminder_3d_sent=d.reminder_3d_sent,
        reminder_1d_sent=d.reminder_1d_sent,
        created_at=d.created_at,
        updated_at=d.updated_at,
    )


@router.get("/", response_model=List[DeliverableResponse])
async def list_deliverables(
    deal_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    await check_deal_access(session, user, deal_id)
    result = await session.exec(
        select(Deliverable)
        .where(Deliverable.deal_id == deal_id)
        .order_by(Deliverable.due_date.asc())  # type: ignore
    )
    return [_to_response(d) for d in result.all()]


@router.put("/{deliverable_id}", response_model=DeliverableResponse)
async def update_deliverable(
    deal_id: uuid.UUID,
    deliverable_id: uuid.UUID,
    body: DeliverableUpdate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    await check_deal_access(session, user, deal_id)

    d = (await session.exec(
        select(Deliverable).where(
            Deliverable.id == deliverable_id,
            Deliverable.deal_id == deal_id,
        )
    )).first()
    if not d:
        raise HTTPException(status_code=404, detail="Deliverable not found")

    if body.responsible_party is not None:
        d.responsible_party = body.responsible_party
    if body.is_confirmed is not None:
        d.is_confirmed = body.is_confirmed
    if body.status is not None:
        if body.status == "approved":
            d.status = "approved"
            d.approved_at = datetime.utcnow()
            d.approved_by = user.id
        else:
            d.status = body.status
    d.updated_at = datetime.utcnow()
    session.add(d)
    await session.commit()
    await session.refresh(d)
    return _to_response(d)


@router.post("/{deliverable_id}/upload", response_model=DeliverableResponse)
async def upload_deliverable_file(
    deal_id: uuid.UUID,
    deliverable_id: uuid.UUID,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    await check_deal_access(session, user, deal_id)

    d = (await session.exec(
        select(Deliverable).where(
            Deliverable.id == deliverable_id,
            Deliverable.deal_id == deal_id,
        )
    )).first()
    if not d:
        raise HTTPException(status_code=404, detail="Deliverable not found")

    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds 10 MB limit")

    d.filename = file.filename
    d.file_content_base64 = base64.b64encode(content).decode()
    d.status = "submitted"
    d.submitted_at = datetime.utcnow()
    d.updated_at = datetime.utcnow()
    session.add(d)
    await session.commit()
    await session.refresh(d)
    return _to_response(d)


@router.post("/confirm-all")
async def confirm_all_deliverables(
    deal_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    await check_deal_access(session, user, deal_id)

    result = await session.exec(
        select(Deliverable).where(
            Deliverable.deal_id == deal_id,
            Deliverable.is_confirmed == False,  # noqa: E712
        )
    )
    count = 0
    for d in result.all():
        d.is_confirmed = True
        d.updated_at = datetime.utcnow()
        session.add(d)
        count += 1

    event = AuditEvent(
        deal_id=deal_id,
        user_id=user.id,
        action="deliverables_confirmed",
        details={"count": count},
    )
    session.add(event)
    await session.commit()
    return {"confirmed": count}


@router.get("/{deliverable_id}/download")
async def download_deliverable_file(
    deal_id: uuid.UUID,
    deliverable_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    await check_deal_access(session, user, deal_id)

    d = (await session.exec(
        select(Deliverable).where(
            Deliverable.id == deliverable_id,
            Deliverable.deal_id == deal_id,
        )
    )).first()
    if not d or not d.file_content_base64:
        raise HTTPException(status_code=404, detail="No file uploaded")

    import io
    from fastapi.responses import StreamingResponse

    file_bytes = base64.b64decode(d.file_content_base64)
    return StreamingResponse(
        io.BytesIO(file_bytes),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{d.filename or "file"}"'},
    )
