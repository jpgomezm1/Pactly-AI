"""Diff generation sanity tests."""

from services.diffing import compute_diff


def test_identical_texts_no_diff():
    result = compute_diff("Hello world", "Hello world")
    assert result["diff_lines"] == []
    assert result["diff_html"] == ""


def test_simple_change_detected():
    result = compute_diff("Purchase price: $350,000", "Purchase price: $340,000")
    assert len(result["diff_lines"]) > 0
    assert "diff-remove" in result["diff_html"] or "diff-add" in result["diff_html"]


def test_multiline_diff():
    a = "Line 1\nLine 2\nLine 3"
    b = "Line 1\nLine 2 modified\nLine 3"
    result = compute_diff(a, b)
    assert any("-Line 2" in line or "+Line 2" in line for line in result["diff_lines"])
