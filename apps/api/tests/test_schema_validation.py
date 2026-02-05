"""JSON schema validation tests for AI output formats."""

import json
import pytest


VALID_ANALYSIS = {
    "changes": [
        {"field": "purchase_price", "action": "update", "from": "350000", "to": "340000", "confidence": 0.95}
    ],
    "clause_actions": [
        {"clause_key": "inspection_contingency", "action": "remove", "details": "Buyer waives inspection", "confidence": 0.9}
    ],
    "questions": [],
    "recommendation": "counter",
    "counter_proposal": {"purchase_price": 345000},
}

REQUIRED_TOP_KEYS = {"changes", "clause_actions", "questions", "recommendation"}


def test_valid_analysis_has_required_keys():
    assert REQUIRED_TOP_KEYS.issubset(set(VALID_ANALYSIS.keys()))


def test_changes_have_required_fields():
    for change in VALID_ANALYSIS["changes"]:
        assert "field" in change
        assert "action" in change
        assert "confidence" in change
        assert 0.0 <= change["confidence"] <= 1.0


def test_recommendation_is_valid_enum():
    assert VALID_ANALYSIS["recommendation"] in ("accept", "reject", "counter")


def test_questions_max_three():
    assert len(VALID_ANALYSIS["questions"]) <= 3


def test_invalid_recommendation_detected():
    bad = {**VALID_ANALYSIS, "recommendation": "maybe"}
    assert bad["recommendation"] not in ("accept", "reject", "counter")
