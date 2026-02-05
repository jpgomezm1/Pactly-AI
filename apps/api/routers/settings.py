from __future__ import annotations

import os
import uuid
import shutil
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from config import settings as app_settings
from database import get_session
from models.user import User, UserRole
from models.organization import Organization
from schemas.settings import CompanySettingsResponse, CompanySettingsUpdateRequest
from services.auth import get_current_user
from services.tenant import get_current_org, check_branding_allowed

router = APIRouter(prefix="/settings", tags=["settings"])

LOGOS_DIR = os.path.join(app_settings.storage_path, "logos")


def _require_admin(user: User) -> None:
    if user.role not in (UserRole.admin, UserRole.super_admin):
        raise HTTPException(status_code=403, detail="Admin access required")


@router.get("", response_model=CompanySettingsResponse)
async def get_settings(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    org = await get_current_org(user, session)
    return CompanySettingsResponse(
        logo_url=org.logo_url,
        primary_color=org.primary_color,
        company_name=org.name,
        updated_at=org.updated_at or org.created_at,
    )


@router.put("", response_model=CompanySettingsResponse)
async def update_settings(
    req: CompanySettingsUpdateRequest,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    _require_admin(user)
    org = await get_current_org(user, session)

    if req.primary_color is not None:
        check_branding_allowed(org)
        org.primary_color = req.primary_color
    if req.logo_url is not None:
        check_branding_allowed(org)
        org.logo_url = req.logo_url if req.logo_url != "" else None
    if req.company_name is not None:
        org.name = req.company_name
    org.updated_at = datetime.utcnow()
    session.add(org)
    await session.commit()
    await session.refresh(org)
    return CompanySettingsResponse(
        logo_url=org.logo_url,
        primary_color=org.primary_color,
        company_name=org.name,
        updated_at=org.updated_at or org.created_at,
    )


@router.post("/logo", response_model=CompanySettingsResponse)
async def upload_logo(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    _require_admin(user)
    org = await get_current_org(user, session)
    check_branding_allowed(org)

    allowed = {"image/png", "image/jpeg", "image/svg+xml"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Only PNG, JPG, and SVG files are allowed")

    os.makedirs(LOGOS_DIR, exist_ok=True)

    ext = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "png"
    filename = f"logo_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = os.path.join(LOGOS_DIR, filename)

    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Remove old logo file if exists
    if org.logo_url:
        old_path = os.path.join(app_settings.storage_path, org.logo_url.lstrip("/storage/"))
        if os.path.exists(old_path):
            os.remove(old_path)

    org.logo_url = f"/storage/logos/{filename}"
    org.updated_at = datetime.utcnow()
    session.add(org)
    await session.commit()
    await session.refresh(org)
    return CompanySettingsResponse(
        logo_url=org.logo_url,
        primary_color=org.primary_color,
        company_name=org.name,
        updated_at=org.updated_at or org.created_at,
    )


@router.delete("/logo", response_model=CompanySettingsResponse)
async def delete_logo(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    _require_admin(user)
    org = await get_current_org(user, session)

    if org.logo_url:
        old_path = os.path.join(app_settings.storage_path, org.logo_url.lstrip("/storage/"))
        if os.path.exists(old_path):
            os.remove(old_path)
        org.logo_url = None
        org.updated_at = datetime.utcnow()
        session.add(org)
        await session.commit()
        await session.refresh(org)

    return CompanySettingsResponse(
        logo_url=org.logo_url,
        primary_color=org.primary_color,
        company_name=org.name,
        updated_at=org.updated_at or org.created_at,
    )
