# Prompts Overview

All prompts stored in `/apps/api/prompts/` with version suffixes.

## parse_contract_v1.md
Extracts structured fields and clause tags from contract text. Returns strict JSON with field values, clause statuses, and clarifying questions.

## analyze_change_request_v1.md
Analyzes a natural-language change request against current contract state. Produces field changes with confidence scores, clause actions, questions, and a recommendation (accept/reject/counter).

## generate_version_v1.md
Generates updated contract text by applying ONLY approved changes. Constrained to not invent clauses, not guess, and preserve formatting.

## Prompt Versioning
Every AI output record stores `prompt_version` (e.g., "parse_contract_v1") to enable tracking which prompt produced which result.
