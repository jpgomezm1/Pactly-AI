import uuid
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func

from models.organization import Organization, PLAN_LIMITS
from models.user import User


async def get_current_org(user: User, session: AsyncSession) -> Organization:
    """Resolve the caller's organization. Super admins have no org."""
    if user.role == "super_admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Super admin is not bound to an organization",
        )
    if not user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User has no organization assigned",
        )
    result = await session.exec(
        select(Organization).where(Organization.id == user.organization_id)
    )
    org = result.first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    if not org.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Organization is deactivated",
        )
    return org


async def check_user_limit(session: AsyncSession, org: Organization) -> None:
    """Raise 403 if org is at its plan user limit."""
    limits = PLAN_LIMITS[org.plan]
    max_users = limits["users"]
    if max_users == -1:
        return  # unlimited
    result = await session.exec(
        select(func.count()).select_from(User).where(
            User.organization_id == org.id,
            User.is_active == True,  # noqa: E712
        )
    )
    current = result.one()
    if current >= max_users:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Organization has reached the {max_users}-user limit for the {org.plan} plan",
        )


def check_branding_allowed(org: Organization) -> None:
    """Raise 403 if branding is not allowed on this plan."""
    limits = PLAN_LIMITS[org.plan]
    if not limits["branding"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Branding customization is not available on the Starter plan. Upgrade to Growth or above.",
        )
