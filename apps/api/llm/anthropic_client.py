"""Anthropic LLM wrapper — the ONLY LLM provider for this system.

When ANTHROPIC_API_KEY is missing or LLM_MOCK_MODE=true, returns deterministic
sample data so the full E2E flow works without a real key.
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict

import anthropic

from config import settings

logger = logging.getLogger(__name__)

MODEL = "claude-sonnet-4-20250514"
MAX_RETRIES_JSON = 2


def is_mock_mode() -> bool:
    if settings.llm_mock_mode:
        return True
    if not settings.anthropic_api_key:
        return True
    return False


# ── Mock responses ──────────────────────────────────────────────────────────

MOCK_PARSE_RESULT: dict[str, Any] = {
    "contract_type": "FAR_BAR_ASIS",
    "fields": {
        "purchase_price": 350000,
        "closing_date": "2025-07-15",
        "inspection_period_days": 15,
        "earnest_money": 10000,
        "financing_type": "conventional",
        "appraisal_contingency": True,
        "title_company": "First American Title",
        "occupancy_date": None,
        "seller_concessions": 5000,
    },
    "clauses": [
        {"key": "inspection_contingency", "status": "active", "editable": True},
        {"key": "financing_contingency", "status": "active", "editable": True},
        {"key": "appraisal_contingency", "status": "active", "editable": True},
        {"key": "title_contingency", "status": "active", "editable": True},
        {"key": "closing_terms", "status": "active", "editable": True},
        {"key": "earnest_money_terms", "status": "active", "editable": True},
        {"key": "seller_disclosure", "status": "active", "editable": True},
        {"key": "property_condition", "status": "active", "editable": True},
    ],
    "questions": [],
}

MOCK_ANALYZE_RESULT: dict[str, Any] = {
    "changes": [
        {
            "field": "purchase_price",
            "action": "update",
            "from": "350000",
            "to": "340000",
            "confidence": 0.95,
        }
    ],
    "clause_actions": [],
    "questions": [],
    "recommendation": "counter",
    "counter_proposal": {"purchase_price": 345000},
}

MOCK_GENERATE_TEXT = (
    "FLORIDA AS-IS RESIDENTIAL CONTRACT FOR SALE AND PURCHASE\n\n"
    "1. PURCHASE PRICE: $340,000.00\n\n"
    "2. CLOSING DATE: July 15, 2025\n\n"
    "3. INSPECTION PERIOD: 15 calendar days from Effective Date.\n\n"
    "4. EARNEST MONEY: $10,000.00 to be deposited within 3 business days.\n\n"
    "5. FINANCING: Conventional\n\n"
    "6. APPRAISAL CONTINGENCY: Yes\n\n"
    "7. TITLE COMPANY: First American Title\n\n"
    "8. SELLER CONCESSIONS: $5,000.00 towards buyer closing costs.\n\n"
    "[Mock-generated contract text — LLM mock mode is active]"
)

MOCK_GENERATE_INITIAL_TEXT = (
    "FAR/BAR AS-IS RESIDENTIAL CONTRACT FOR SALE AND PURCHASE\n\n"
    "1. PARTIES:\n"
    "   BUYER: John Smith\n"
    "   SELLER: Jane Doe\n\n"
    "2. PROPERTY ADDRESS: 123 Palm Avenue, Miami, FL 33101\n"
    "   Legal Description: Lot 5, Block 3, Coral Estates, as recorded in Plat Book 45, Page 12\n\n"
    "3. PURCHASE PRICE: $350,000.00\n"
    "   (a) Deposit to be held in escrow: $10,000.00\n"
    "   (b) Balance due at closing: $340,000.00\n\n"
    "4. FINANCING: Conventional mortgage\n\n"
    "5. CLOSING DATE: July 15, 2025\n\n"
    "6. INSPECTION PERIOD: 15 calendar days from Effective Date.\n"
    "   During the Inspection Period, Buyer may have the Property inspected at Buyer's expense.\n"
    "   If Buyer determines, in Buyer's sole discretion, that the Property is not acceptable,\n"
    "   Buyer may terminate this Contract by delivering written notice to Seller before expiration\n"
    "   of the Inspection Period. If Buyer timely terminates, Buyer shall be refunded the Deposit.\n\n"
    "7. TITLE CONTINGENCY: Seller shall convey marketable title by statutory warranty deed.\n"
    "   Title insurance commitment shall be obtained within 15 days of Effective Date.\n\n"
    "8. AS-IS CONDITION: Buyer acknowledges and agrees that Buyer is purchasing the Property\n"
    "   in its present \"AS IS\" condition, with all faults. Seller makes no warranties\n"
    "   regarding the condition of the Property.\n\n"
    "9. EARNEST MONEY: $10,000.00 to be deposited within 3 business days of Effective Date\n"
    "   with First American Title, as escrow agent.\n\n"
    "10. CLOSING COSTS: Buyer and Seller shall each pay their own closing costs as customary\n"
    "    in the county where the Property is located.\n\n"
    "11. DEFAULT: If Buyer fails to perform, Seller may retain the Deposit as liquidated damages.\n"
    "    If Seller fails to perform, Buyer may seek specific performance or return of Deposit.\n\n"
    "12. RISK OF LOSS: If the Property is damaged by fire or other casualty before closing,\n"
    "    Buyer may terminate this Contract and receive a refund of the Deposit.\n\n"
    "13. GOVERNING LAW: This Contract shall be governed by and construed in accordance with\n"
    "    the laws of the State of Florida.\n\n"
    "[Mock-generated contract — LLM mock mode is active]"
)

MOCK_TIMELINE_RESULT: dict[str, Any] = {
    "timeline": [
        {"description": "Effective Date", "due_date": "2025-06-01", "category": "other", "responsible_party": "buyer"},
        {"description": "Initial Deposit Due", "due_date": "2025-06-04", "category": "deposit", "responsible_party": "buyer"},
        {"description": "Inspection Period Ends", "due_date": "2025-06-16", "category": "inspection", "responsible_party": "buyer"},
        {"description": "Loan Approval Deadline", "due_date": "2025-06-30", "category": "financing", "responsible_party": "buyer"},
        {"description": "Closing Date", "due_date": "2025-07-15", "category": "closing", "responsible_party": "seller"},
    ],
}

MOCK_META = {"input_tokens": 0, "output_tokens": 0, "model": "mock"}

# ── Real client ─────────────────────────────────────────────────────────────


def _get_client() -> anthropic.Anthropic:
    key = settings.anthropic_api_key
    if not key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set. Cannot call LLM.")
    return anthropic.Anthropic(api_key=key)


def generate_json(
    prompt: str,
    json_schema_description: str = "",
    max_tokens: int = 4096,
    temperature: float = 0.1,
) -> dict[str, Any]:
    """Call Anthropic and parse strict JSON response. Retries on parse failure.
    Falls back to mock data when mock mode is active."""

    if is_mock_mode():
        logger.warning("LLM_MOCK_MODE active — returning deterministic sample JSON")
        # Heuristic: detect which prompt is calling
        if "critical dates" in prompt.lower() or "extract_timeline" in prompt.lower() or "chronologically" in prompt.lower():
            result = dict(MOCK_TIMELINE_RESULT)
        elif "FIELDS TO EXTRACT" in prompt or "contract_text" in prompt:
            result = dict(MOCK_PARSE_RESULT)
        else:
            result = dict(MOCK_ANALYZE_RESULT)
        result["_meta"] = dict(MOCK_META)
        return result

    client = _get_client()
    system_msg = (
        "You are an AI assistant for real estate contract analysis. "
        "You MUST return ONLY valid JSON. No markdown, no code fences, no explanation outside JSON. "
        "Do not guess missing information — use the 'questions' array instead. "
        f"{json_schema_description}"
    )

    last_error = None
    for attempt in range(MAX_RETRIES_JSON + 1):
        user_msg = prompt
        if attempt > 0 and last_error:
            user_msg = (
                f"{prompt}\n\n"
                f"IMPORTANT: Your previous response was not valid JSON. Error: {last_error}\n"
                "Please return ONLY valid JSON with no other text."
            )

        response = client.messages.create(
            model=MODEL,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_msg,
            messages=[{"role": "user", "content": user_msg}],
        )

        text = response.content[0].text.strip()
        # Strip markdown code fences if present
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
            text = text.strip()

        input_tokens = response.usage.input_tokens
        output_tokens = response.usage.output_tokens

        try:
            parsed = json.loads(text)
            logger.info("LLM JSON response parsed", extra={
                "attempt": attempt + 1,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
            })
            parsed["_meta"] = {
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "model": MODEL,
            }
            return parsed
        except json.JSONDecodeError as e:
            last_error = str(e)
            logger.warning("LLM returned invalid JSON, retrying", extra={
                "attempt": attempt + 1, "error": last_error,
            })

    raise ValueError(f"LLM failed to return valid JSON after {MAX_RETRIES_JSON + 1} attempts: {last_error}")


def generate_text(
    prompt: str,
    system: str = "You are an AI assistant for real estate contract drafting. Follow instructions precisely.",
    max_tokens: int = 8192,
    temperature: float = 0.2,
) -> dict[str, Any]:
    """Call Anthropic for freeform text generation. Returns text + usage metadata.
    Falls back to mock data when mock mode is active."""

    if is_mock_mode():
        logger.warning("LLM_MOCK_MODE active — returning deterministic sample text")
        mock_text = MOCK_GENERATE_INITIAL_TEXT if "TEMPLATE TYPE" in prompt else MOCK_GENERATE_TEXT
        return {"text": mock_text, "_meta": dict(MOCK_META)}

    client = _get_client()

    response = client.messages.create(
        model=MODEL,
        max_tokens=max_tokens,
        temperature=temperature,
        system=system,
        messages=[{"role": "user", "content": prompt}],
    )

    text = response.content[0].text
    return {
        "text": text,
        "_meta": {
            "input_tokens": response.usage.input_tokens,
            "output_tokens": response.usage.output_tokens,
            "model": MODEL,
        },
    }
