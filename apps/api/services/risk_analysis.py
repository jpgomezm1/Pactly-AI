"""Proactive risk analysis for contract versions."""

import json
import logging
from pathlib import Path

from sqlmodel import Session
from models.contract import ContractVersion
from llm.anthropic_client import generate_json

logger = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def run_risk_analysis_sync(session: Session, version: ContractVersion) -> None:
    """Run risk analysis on a contract version. Updates the version in-place.

    Should be called after successful contract parsing when extracted_fields
    are available. Safe to call — catches all exceptions internally.
    """
    try:
        version.risk_analysis_status = "processing"
        session.add(version)
        session.commit()

        prompt_template = (PROMPTS_DIR / "proactive_risk_review_v1.md").read_text()

        extracted_fields = json.dumps(version.extracted_fields or {}, indent=2)
        clause_tags = json.dumps(version.clause_tags or [], indent=2)
        full_text = (version.full_text or "")[:15000]

        prompt = (
            prompt_template
            .replace("{extracted_fields}", extracted_fields)
            .replace("{clause_tags}", clause_tags)
            .replace("{full_text}", full_text)
        )

        result = generate_json(prompt, "Return the risk analysis JSON.")
        result.pop("_meta", None)

        version.risk_flags = result.get("risk_flags", [])
        version.suggestions = result.get("suggestions", [])
        version.risk_analysis_status = "completed"
        version.risk_prompt_version = "proactive_risk_review_v1"
        session.add(version)
        session.commit()

        logger.info("Risk analysis completed for version %s", version.id)

    except Exception:
        logger.exception("Risk analysis failed for version %s", version.id)
        version.risk_analysis_status = "failed"
        session.add(version)
        session.commit()
