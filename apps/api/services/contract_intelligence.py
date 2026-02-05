"""Contract Intelligence Layer — field extraction and clause tagging."""
from __future__ import annotations

from typing import Optional, Dict, List

# V1 allowed fields schema
ALLOWED_FIELDS = {
    "purchase_price": {"type": "number"},
    "closing_date": {"type": "date"},
    "inspection_period_days": {"type": "int"},
    "earnest_money": {"type": "number"},
    "financing_type": {"type": "enum", "values": ["cash", "conventional", "fha", "va", "other"]},
    "appraisal_contingency": {"type": "bool"},
    "title_company": {"type": "string", "optional": True},
    "occupancy_date": {"type": "date", "optional": True},
    "seller_concessions": {"type": "number", "optional": True},
    "effective_date": {"type": "date", "optional": True},
    "first_deposit_date": {"type": "date", "optional": True},
    "first_deposit_amount": {"type": "number", "optional": True},
    "financing_deadline": {"type": "date", "optional": True},
    "additional_deposit_date": {"type": "date", "optional": True},
    "additional_deposit_amount": {"type": "number", "optional": True},
    "loan_approval_deadline": {"type": "date", "optional": True},
}

DEFAULT_CLAUSES = [
    "inspection_contingency",
    "financing_contingency",
    "appraisal_contingency",
    "title_contingency",
    "closing_terms",
    "earnest_money_terms",
    "seller_disclosure",
    "property_condition",
    "occupancy_terms",
]


def build_empty_contract_state() -> dict:
    return {
        "contract_type": "UNKNOWN",
        "fields": {k: None for k in ALLOWED_FIELDS},
        "clauses": [
            {"key": c, "status": "active", "editable": True} for c in DEFAULT_CLAUSES
        ],
    }


def apply_field_changes(current_fields: dict, changes: list[dict]) -> dict:
    """Apply deterministic field changes. Only allowed keys are modified."""
    updated = dict(current_fields)
    for change in changes:
        field = change.get("field")
        if field not in ALLOWED_FIELDS:
            continue
        action = change.get("action", "update")
        if action == "update":
            updated[field] = change.get("to")
        elif action == "remove":
            updated[field] = None
    return updated


def apply_clause_actions(current_clauses: list[dict], clause_actions: list[dict]) -> list[dict]:
    """Apply clause status changes."""
    clause_map = {c["key"]: dict(c) for c in current_clauses}
    for action in clause_actions:
        key = action.get("clause_key")
        act = action.get("action")
        if act == "remove" and key in clause_map:
            clause_map[key]["status"] = "removed"
        elif act == "modify" and key in clause_map:
            clause_map[key]["status"] = "modified"
        elif act == "add" and key not in clause_map:
            clause_map[key] = {"key": key, "status": "active", "editable": True}
    return list(clause_map.values())
