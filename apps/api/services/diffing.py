"""Deterministic diff computation between contract versions."""

from __future__ import annotations

import difflib
from typing import Optional


def compute_field_changes(fields_a: Optional[dict], fields_b: Optional[dict]) -> list:
    """Compare extracted_fields between two versions and return a list of changes."""
    fields_a = fields_a or {}
    fields_b = fields_b or {}
    all_keys = sorted(set(list(fields_a.keys()) + list(fields_b.keys())))
    changes = []
    for key in all_keys:
        val_a = fields_a.get(key)
        val_b = fields_b.get(key)
        if val_a != val_b:
            changes.append({
                "field": key,
                "from": val_a,
                "to": val_b,
            })
    return changes


def compute_diff(text_a: str, text_b: str) -> dict:
    """Compute a unified diff between two texts. Returns diff lines and an HTML representation."""
    lines_a = text_a.splitlines(keepends=True)
    lines_b = text_b.splitlines(keepends=True)

    diff_lines = list(difflib.unified_diff(lines_a, lines_b, fromfile="Version A", tofile="Version B", lineterm=""))

    # Build simple HTML diff
    html_parts = []
    for line in diff_lines:
        if line.startswith("+++") or line.startswith("---"):
            html_parts.append(f'<div class="diff-header">{_escape(line)}</div>')
        elif line.startswith("@@"):
            html_parts.append(f'<div class="diff-hunk">{_escape(line)}</div>')
        elif line.startswith("+"):
            html_parts.append(f'<div class="diff-add">{_escape(line)}</div>')
        elif line.startswith("-"):
            html_parts.append(f'<div class="diff-remove">{_escape(line)}</div>')
        else:
            html_parts.append(f'<div class="diff-context">{_escape(line)}</div>')

    return {
        "diff_lines": diff_lines,
        "diff_html": "\n".join(html_parts),
    }


def _escape(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
