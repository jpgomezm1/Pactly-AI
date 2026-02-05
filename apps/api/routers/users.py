from __future__ import annotations

import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from database import get_session
from models.user import User, UserRole
from schemas.users import UserCreateRequest, UserUpdateRequest, UserListResponse
from services.auth import get_current_user, hash_password
from services.tenant import get_current_org, check_user_limit

router = APIRouter(prefix="/users", tags=["users"])


def _require_admin(user: User) -> User:
    if user.role not in (UserRole.admin, UserRole.super_admin):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


@router.get("", response_model=list[UserListResponse])
async def list_users(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    _require_admin(user)
    org = await get_current_org(user, session)
    result = await session.exec(
        select(User)
        .where(User.organization_id == org.id)
        .order_by(User.created_at.desc())  # type: ignore
    )
    users = result.all()
    return [
        UserListResponse(
            id=str(u.id), email=u.email, full_name=u.full_name,
            role=u.role, is_active=u.is_active, created_at=u.created_at,
        ) for u in users
    ]


@router.post("", response_model=UserListResponse, status_code=201)
async def create_user(
    req: UserCreateRequest,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    _require_admin(user)
    org = await get_current_org(user, session)
    await check_user_limit(session, org)

    existing = (await session.exec(select(User).where(User.email == req.email))).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Don't allow creating super_admin via this endpoint
    if req.role == "super_admin":
        raise HTTPException(status_code=403, detail="Cannot create super_admin users")

    new_user = User(
        email=req.email,
        hashed_password=hash_password(req.password),
        full_name=req.full_name,
        role=req.role,
        organization_id=org.id,
    )
    session.add(new_user)
    await session.commit()
    await session.refresh(new_user)
    return UserListResponse(
        id=str(new_user.id), email=new_user.email,
        full_name=new_user.full_name, role=new_user.role,
        is_active=new_user.is_active, created_at=new_user.created_at,
    )


@router.put("/{user_id}", response_model=UserListResponse)
async def update_user(
    user_id: uuid.UUID,
    req: UserUpdateRequest,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    _require_admin(user)
    org = await get_current_org(user, session)

    target = (await session.exec(
        select(User).where(User.id == user_id, User.organization_id == org.id)
    )).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found in your organization")

    if req.role is not None:
        if req.role == "super_admin":
            raise HTTPException(status_code=403, detail="Cannot assign super_admin role")
        target.role = req.role
    if req.is_active is not None:
        target.is_active = req.is_active
    if req.full_name is not None:
        target.full_name = req.full_name

    target.updated_at = datetime.utcnow()
    session.add(target)
    await session.commit()
    await session.refresh(target)
    return UserListResponse(
        id=str(target.id), email=target.email,
        full_name=target.full_name, role=target.role,
        is_active=target.is_active, created_at=target.created_at,
    )


@router.patch("/me/onboarding")
async def complete_onboarding(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    user.has_completed_onboarding = True
    user.updated_at = datetime.utcnow()
    session.add(user)
    await session.commit()
    return {"status": "ok"}
