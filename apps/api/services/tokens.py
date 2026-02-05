from datetime import date, timedelta
from typing import Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from models.organization import Organization, PLAN_LIMITS
from models.token_usage import TokenUsage


def _current_period(anchor_day: int, today: Optional[date] = None) -> Tuple[date, date]:
    """Calculate current billing period based on anchor day."""
    today = today or date.today()
    year, month = today.year, today.month
    # Period starts on anchor_day of some month
    try:
        period_start = date(year, month, min(anchor_day, 28))
    except ValueError:
        period_start = date(year, month, 28)

    if today < period_start:
        # We're before this month's anchor → period started last month
        if month == 1:
            period_start = date(year - 1, 12, min(anchor_day, 28))
        else:
            try:
                period_start = date(year, month - 1, min(anchor_day, 28))
            except ValueError:
                period_start = date(year, month - 1, 28)

    # Period end = start + ~1 month
    end_month = period_start.month + 1
    end_year = period_start.year
    if end_month > 12:
        end_month = 1
        end_year += 1
    try:
        period_end = date(end_year, end_month, min(anchor_day, 28))
    except ValueError:
        period_end = date(end_year, end_month, 28)

    return period_start, period_end


async def _get_or_create_usage(
    session: AsyncSession, org: Organization
) -> TokenUsage:
    """Find or create the TokenUsage row for the current billing period."""
    period_start, period_end = _current_period(org.billing_anchor_day)
    limits = PLAN_LIMITS[org.plan]

    result = await session.exec(
        select(TokenUsage).where(
            TokenUsage.organization_id == org.id,
            TokenUsage.period_start == period_start,
        )
    )
    usage = result.first()
    if usage:
        return usage

    usage = TokenUsage(
        organization_id=org.id,
        period_start=period_start,
        period_end=period_end,
        tokens_included=limits["tokens"] if limits["tokens"] != -1 else 999999,
        tokens_used=0,
        extra_tokens_used=0,
    )
    session.add(usage)
    await session.flush()
    return usage


async def consume_token(session: AsyncSession, org: Organization) -> None:
    """Consume one token for a deal creation. 1 token = 1 deal. Everything inside the deal is unlimited."""
    usage = await _get_or_create_usage(session, org)
    if usage.tokens_used < usage.tokens_included:
        usage.tokens_used += 1
    else:
        usage.extra_tokens_used += 1
    session.add(usage)


async def get_token_status(session: AsyncSession, org: Organization) -> dict:
    """Return current period token stats."""
    usage = await _get_or_create_usage(session, org)
    limits = PLAN_LIMITS[org.plan]
    token_limit = limits["tokens"]
    return {
        "used": usage.tokens_used,
        "limit": token_limit,
        "extra": usage.extra_tokens_used,
        "available": max(0, token_limit - usage.tokens_used) if token_limit != -1 else -1,
        "period_start": str(usage.period_start),
        "period_end": str(usage.period_end),
    }
