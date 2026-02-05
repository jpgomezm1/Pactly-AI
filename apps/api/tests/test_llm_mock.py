"""Tests for LLM mock mode."""

import os
import json
import pytest


def test_mock_mode_activates_without_key(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "")
    monkeypatch.setenv("LLM_MOCK_MODE", "")
    # Reload to pick up env
    from llm.anthropic_client import is_mock_mode
    # With empty key and no mock flag, should still be mock (key missing)
    assert is_mock_mode() is True


def test_mock_mode_explicit_flag(monkeypatch):
    monkeypatch.setenv("LLM_MOCK_MODE", "true")
    from llm.anthropic_client import is_mock_mode
    assert is_mock_mode() is True


def test_mock_generate_json_returns_valid_parse():
    os.environ["LLM_MOCK_MODE"] = "true"
    from llm.anthropic_client import generate_json
    result = generate_json("FIELDS TO EXTRACT dummy prompt")
    assert "fields" in result
    assert "clauses" in result
    assert result["fields"]["purchase_price"] == 350000
    os.environ.pop("LLM_MOCK_MODE", None)


def test_mock_generate_json_returns_valid_analysis():
    os.environ["LLM_MOCK_MODE"] = "true"
    from llm.anthropic_client import generate_json
    result = generate_json("analyze change request dummy prompt")
    assert "changes" in result
    assert "recommendation" in result
    assert result["recommendation"] in ("accept", "reject", "counter")
    os.environ.pop("LLM_MOCK_MODE", None)


def test_mock_generate_text_returns_string():
    os.environ["LLM_MOCK_MODE"] = "true"
    from llm.anthropic_client import generate_text
    result = generate_text("generate version dummy prompt")
    assert "text" in result
    assert isinstance(result["text"], str)
    assert len(result["text"]) > 50
    os.environ.pop("LLM_MOCK_MODE", None)
