"""Contract intelligence service tests."""

from services.contract_intelligence import apply_field_changes, apply_clause_actions, build_empty_contract_state


def test_apply_field_changes_updates_allowed():
    fields = {"purchase_price": 350000, "closing_date": "2025-06-01"}
    changes = [{"field": "purchase_price", "action": "update", "to": 340000}]
    result = apply_field_changes(fields, changes)
    assert result["purchase_price"] == 340000
    assert result["closing_date"] == "2025-06-01"


def test_apply_field_changes_ignores_unknown():
    fields = {"purchase_price": 350000}
    changes = [{"field": "unknown_field", "action": "update", "to": "bad"}]
    result = apply_field_changes(fields, changes)
    assert "unknown_field" not in result


def test_apply_clause_remove():
    clauses = [{"key": "inspection_contingency", "status": "active", "editable": True}]
    actions = [{"clause_key": "inspection_contingency", "action": "remove"}]
    result = apply_clause_actions(clauses, actions)
    assert result[0]["status"] == "removed"


def test_build_empty_state():
    state = build_empty_contract_state()
    assert state["contract_type"] == "UNKNOWN"
    assert "purchase_price" in state["fields"]
    assert len(state["clauses"]) > 0
