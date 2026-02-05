"""Deal health scoring for dashboard intelligence."""

import uuid
import logging
from datetime import datetime, timedelta
from typing import Optional

from sqlmodel import Session, select, func
from models.deal import Deal
from models.audit import AuditEvent
from models.change_request import ChangeRequest
from models.contract import ContractVersion

logger = logging.getLogger(__name__)


def compute_deal_health(session: Session, deal_id: uuid.UUID) -> dict:
    """Compute health metrics for a single deal.

    Returns:
        dict with health_score, health_status, days_since_last_activity,
        days_in_current_state, open_crs, versions_count, issues
    """
    deal = session.get(Deal, deal_id)
    if not deal:
        return {"health_score": 0, "health_status": "at_risk", "issues": ["Deal not found"]}

    now = datetime.utcnow()
    score = 100
    issues: list[str] = []

    # Days since last activity (from latest AuditEvent)
    latest_event = session.exec(
        select(AuditEvent)
        .where(AuditEvent.deal_id == deal_id)
        .order_by(AuditEvent.created_at.desc())
        .limit(1)
    ).first()

    if latest_event:
        days_since_activity = (now - latest_event.created_at).days
    else:
        days_since_activity = (now - deal.created_at).days

    if days_since_activity > 2:
        penalty = min(30, (days_since_activity - 2) * 5)
        score -= penalty
        issues.append(f"No activity in {days_since_activity} days")

    # Days in current state
    state_ref = deal.updated_at or deal.created_at
    days_in_state = (now - state_ref).days

    if days_in_state > 3:
        penalty = min(40, (days_in_state - 3) * 8)
        score -= penalty
        state_label = deal.current_state.replace("_", " ")
        issues.append(f"Stuck in {state_label} for {days_in_state} days")

    # Open CRs count
    open_crs_count = session.exec(
        select(func.count()).select_from(ChangeRequest).where(
            ChangeRequest.deal_id == deal_id,
            ChangeRequest.status == "open",
        )
    ).one()

    if open_crs_count > 0:
        penalty = min(20, open_crs_count * 5)
        score -= penalty
        issues.append(f"{open_crs_count} open CRs pending")

    # Version count
    versions_count = session.exec(
        select(func.count()).select_from(ContractVersion).where(
            ContractVersion.deal_id == deal_id,
        )
    ).one()

    if versions_count > 3:
        penalty = min(10, (versions_count - 3) * 2)
        score -= penalty
        issues.append(f"{versions_count} versions (high iteration)")

    score = max(0, score)

    if score >= 80:
        status = "healthy"
    elif score >= 50:
        status = "needs_attention"
    else:
        status = "at_risk"

    return {
        "health_score": score,
        "health_status": status,
        "days_since_last_activity": days_since_activity,
        "days_in_current_state": days_in_state,
        "open_crs": open_crs_count,
        "versions_count": versions_count,
        "issues": issues,
    }


def compute_deals_health_batch(session: Session, deal_ids: list[uuid.UUID]) -> dict[str, dict]:
    """Compute health for multiple deals. Returns {deal_id_str: health_dict}."""
    result = {}
    for did in deal_ids:
        result[str(did)] = compute_deal_health(session, did)
    return result


def detect_stale_deals(session: Session, org_id: uuid.UUID, threshold_days: int = 7) -> list[dict]:
    """Find deals with no activity in threshold_days."""
    cutoff = datetime.utcnow() - timedelta(days=threshold_days)

    # Get all org deals
    deals = session.exec(
        select(Deal).where(
            Deal.organization_id == org_id,
            Deal.current_state != "accepted",
        )
    ).all()

    stale = []
    for deal in deals:
        latest = session.exec(
            select(AuditEvent)
            .where(AuditEvent.deal_id == deal.id)
            .order_by(AuditEvent.created_at.desc())
            .limit(1)
        ).first()

        last_activity = latest.created_at if latest else deal.created_at
        if last_activity < cutoff:
            days = (datetime.utcnow() - last_activity).days
            stale.append({
                "deal_id": str(deal.id),
                "title": deal.title,
                "days_inactive": days,
                "current_state": deal.current_state,
            })

    return stale
