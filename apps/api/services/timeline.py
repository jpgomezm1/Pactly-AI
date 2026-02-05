import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from models.audit import AuditEvent
from models.deal import Deal
from models.negotiation import NegotiationCycle, NegotiationState


def get_next_state(current_state: str, action: str, actor_role: str) -> Optional[NegotiationState]:
    """Determine the next deal state based on current state, action, and actor role."""
    is_buyer = "buyer" in actor_role
    is_seller = "seller" in actor_role or "listing" in actor_role

    transitions = {
        # CR created
        ("draft", "cr_created", True): NegotiationState.waiting_on_seller,
        ("draft", "cr_created", False): NegotiationState.waiting_on_buyer,
        # Accept
        ("waiting_on_seller", "accept", False): NegotiationState.accepted,
        ("waiting_on_seller", "accept", True): NegotiationState.accepted,
        ("waiting_on_buyer", "accept", True): NegotiationState.accepted,
        ("waiting_on_buyer", "accept", False): NegotiationState.accepted,
        # Reject
        ("waiting_on_seller", "reject", False): NegotiationState.draft,
        ("waiting_on_seller", "reject", True): NegotiationState.draft,
        ("waiting_on_buyer", "reject", True): NegotiationState.draft,
        ("waiting_on_buyer", "reject", False): NegotiationState.draft,
        # Counter
        ("waiting_on_seller", "counter", False): NegotiationState.waiting_on_buyer,
        ("waiting_on_seller", "counter", True): NegotiationState.waiting_on_buyer,
        ("waiting_on_buyer", "counter", True): NegotiationState.waiting_on_seller,
        ("waiting_on_buyer", "counter", False): NegotiationState.waiting_on_seller,
    }

    key = (current_state, action, is_buyer)
    result = transitions.get(key)
    if result is None and not is_buyer:
        # Try with is_buyer=False explicitly
        key = (current_state, action, False)
        result = transitions.get(key)
    return result


async def record_event(
    session: AsyncSession,
    deal_id: uuid.UUID,
    action: str,
    user_id: Optional[uuid.UUID] = None,
    details: Optional[dict] = None,
) -> AuditEvent:
    event = AuditEvent(
        deal_id=deal_id,
        user_id=user_id,
        action=action,
        details=details or {},
    )
    session.add(event)
    await session.commit()
    await session.refresh(event)
    return event


async def transition_state(
    session: AsyncSession,
    deal_id: uuid.UUID,
    new_state: NegotiationState,
    user_id: Optional[uuid.UUID] = None,
) -> None:
    result = await session.exec(select(Deal).where(Deal.id == deal_id))
    deal = result.first()
    if deal:
        old_state = deal.current_state
        deal.current_state = new_state.value
        deal.updated_at = datetime.utcnow()
        session.add(deal)
        await session.commit()
        await record_event(
            session, deal_id, "state_transition",
            user_id=user_id,
            details={"from": old_state, "to": new_state.value},
        )
