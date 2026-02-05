import uuid
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from models.user import User, UserRole
from models.deal import Deal, DealAssignment


def require_roles(*allowed_roles: UserRole):
    """Returns a dependency that checks the user has one of the allowed roles."""
    def checker(user: User) -> User:
        # super_admin bypasses all role checks
        if user.role == UserRole.super_admin:
            return user
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user.role}' is not permitted for this action",
            )
        return user
    return checker


async def check_deal_access(
    session: AsyncSession, user: User, deal_id: uuid.UUID
) -> bool:
    """Admin has full access within their org. Agents must be assigned.
    super_admin bypasses all checks."""
    if user.role == UserRole.super_admin:
        return True

    # Org boundary check: ensure deal belongs to user's org
    result = await session.exec(select(Deal).where(Deal.id == deal_id))
    deal = result.first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    if deal.organization_id and user.organization_id and deal.organization_id != user.organization_id:
        raise HTTPException(status_code=403, detail="Deal belongs to a different organization")

    if user.role == UserRole.admin:
        return True
    # Agents must be assigned
    assign_result = await session.exec(
        select(DealAssignment).where(
            DealAssignment.deal_id == deal_id,
            DealAssignment.user_id == user.id,
        )
    )
    if not assign_result.first():
        raise HTTPException(status_code=403, detail="You are not assigned to this deal")
    return True


async def check_audit_access(user: User) -> bool:
    if user.role == UserRole.super_admin:
        return True
    if user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Audit access requires admin role")
    return True
