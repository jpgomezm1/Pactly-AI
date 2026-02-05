"""Run task logic inline (no Redis/Celery needed)."""

import asyncio
import logging
import uuid

from workers.tasks import (
    parse_contract as _parse_contract_celery,
    analyze_change_request as _analyze_change_request_celery,
    generate_version as _generate_version_celery,
    _update_job,
    _read_prompt,
)
from database import sync_engine
from models.job import JobRecord
from sqlmodel import Session

logger = logging.getLogger(__name__)


def _notify_deal_sync(session: Session, deal_id, type: str, title: str, message: str):
    """Create notifications for deal participants (sync context)."""
    from sqlmodel import select as _select
    from models.deal import DealAssignment
    from models.notification import Notification
    import uuid as _uuid

    stmt = _select(DealAssignment).where(DealAssignment.deal_id == deal_id)
    assignments = session.exec(stmt).all()
    for a in assignments:
        n = Notification(
            user_id=a.user_id,
            deal_id=deal_id,
            type=type,
            title=title,
            message=message,
        )
        session.add(n)



def _run_parse_contract(job_id: str, deal_id: str, version_id: str):
    """Sync function that runs parse_contract logic using its own DB session."""
    import json, uuid as _uuid
    from datetime import datetime
    from models.contract import ContractVersion
    from models.audit import AuditEvent
    from llm.anthropic_client import generate_json

    with Session(sync_engine) as session:
        _update_job(session, job_id, "processing")

        version = session.get(ContractVersion, _uuid.UUID(version_id))
        if not version:
            _update_job(session, job_id, "failed", error="Version not found")
            return

        try:
            prompt_template = _read_prompt("parse_contract_v1.md")
            prompt = prompt_template.replace("{contract_text}", version.full_text[:15000])
            result = generate_json(prompt, "Return the contract analysis JSON.")

            meta = result.pop("_meta", {})
            version.extracted_fields = result.get("fields", {})
            version.clause_tags = result.get("clauses", [])
            version.contract_type = result.get("contract_type", "UNKNOWN")
            version.prompt_version = "parse_contract_v1"
            session.add(version)


            event = AuditEvent(
                deal_id=_uuid.UUID(deal_id),
                action="contract_parsed",
                details={"version_id": version_id, "contract_type": version.contract_type},
            )
            session.add(event)
            _update_job(session, job_id, "completed", result={"contract_type": version.contract_type})
            session.commit()

            # Run risk analysis (best-effort, won't fail parse)
            try:
                from services.risk_analysis import run_risk_analysis_sync
                run_risk_analysis_sync(session, version)
            except Exception:
                logger.exception("Risk analysis failed (non-fatal)")

        except Exception as e:
            logger.exception("parse_contract failed")
            _update_job(session, job_id, "failed", error=str(e))


def _run_analyze_change_request(job_id: str, deal_id: str, cr_id: str):
    """Sync function that runs analyze_change_request logic."""
    import json, uuid as _uuid
    from datetime import datetime
    from sqlmodel import select
    from models.contract import ContractVersion
    from models.change_request import ChangeRequest
    from models.audit import AuditEvent
    from llm.anthropic_client import generate_json

    with Session(sync_engine) as session:
        _update_job(session, job_id, "processing")

        cr = session.get(ChangeRequest, _uuid.UUID(cr_id))
        if not cr:
            _update_job(session, job_id, "failed", error="Change request not found")
            return

        stmt = (
            select(ContractVersion)
            .where(ContractVersion.deal_id == _uuid.UUID(deal_id))
            .order_by(ContractVersion.version_number.desc())
        )
        version = session.exec(stmt).first()
        if not version:
            _update_job(session, job_id, "failed", error="No contract version found")
            return

        try:
            cr.analysis_status = "processing"
            cr.analysis_job_id = job_id
            session.add(cr)
            session.commit()

            prompt_template = _read_prompt("analyze_change_request_v1.md")
            contract_state = json.dumps({
                "contract_type": version.contract_type,
                "clauses": version.clause_tags or [],
            })
            current_fields = json.dumps(version.extracted_fields or {})

            prompt = (
                prompt_template
                .replace("{contract_state}", contract_state)
                .replace("{current_fields}", current_fields)
                .replace("{change_request_text}", cr.raw_text)
            )

            result = generate_json(prompt)
            meta = result.pop("_meta", {})

            cr.analysis_status = "completed"
            cr.analysis_result = result
            cr.prompt_version = "analyze_change_request_v1"
            cr.input_tokens = meta.get("input_tokens")
            cr.output_tokens = meta.get("output_tokens")
            cr.analyzed_at = datetime.utcnow()
            session.add(cr)


            event = AuditEvent(
                deal_id=_uuid.UUID(deal_id),
                user_id=cr.created_by,
                action="change_request_analyzed",
                details={"cr_id": cr_id, "recommendation": result.get("recommendation")},
            )
            session.add(event)

            _update_job(session, job_id, "completed", result={"recommendation": result.get("recommendation")})

            # Create notifications for deal participants (sync)
            _notify_deal_sync(session, _uuid.UUID(deal_id), "cr_analyzed",
                              "Change request analyzed",
                              f"AI analysis complete. Recommendation: {result.get('recommendation', 'N/A')}")

            # Email notification (best-effort)
            try:
                from services.email import notify_analysis_complete
                from models.deal import Deal
                deal_obj = session.get(Deal, _uuid.UUID(deal_id))
                if deal_obj:
                    from models.user import User
                    user_obj = session.get(User, cr.created_by)
                    if user_obj and hasattr(user_obj, "email") and user_obj.email:
                        notify_analysis_complete(
                            to=user_obj.email,
                            deal_title=deal_obj.title,
                            recommendation=result.get("recommendation", "N/A"),
                        )
            except Exception:
                pass

            session.commit()
        except Exception as e:
            logger.exception("analyze_change_request failed")
            cr.analysis_status = "failed"
            session.add(cr)
            _update_job(session, job_id, "failed", error=str(e))
            session.commit()


def _run_generate_version(job_id: str, deal_id: str, cr_id: str, user_id: str):
    """Sync function that runs generate_version logic."""
    import json, uuid as _uuid
    from datetime import datetime
    from sqlmodel import select
    from models.contract import ContractVersion
    from models.change_request import ChangeRequest
    from models.audit import AuditEvent
    from models.job import JobRecord
    from llm.anthropic_client import generate_text
    from services.contract_intelligence import apply_field_changes, apply_clause_actions

    with Session(sync_engine) as session:
        _update_job(session, job_id, "processing")

        cr = session.get(ChangeRequest, _uuid.UUID(cr_id))
        if not cr or not cr.analysis_result:
            _update_job(session, job_id, "failed", error="CR not found or not analyzed")
            return

        stmt = (
            select(ContractVersion)
            .where(ContractVersion.deal_id == _uuid.UUID(deal_id))
            .order_by(ContractVersion.version_number.desc())
        )
        prev_version = session.exec(stmt).first()
        if not prev_version:
            _update_job(session, job_id, "failed", error="No contract version found")
            return

        try:
            analysis = cr.analysis_result
            changes = analysis.get("changes", [])
            clause_actions = analysis.get("clause_actions", [])

            current_fields = prev_version.extracted_fields or {}
            new_fields = apply_field_changes(current_fields, changes)

            current_clauses = prev_version.clause_tags or []
            new_clauses = apply_clause_actions(current_clauses, clause_actions)

            prompt_template = _read_prompt("generate_version_v1.md")
            prompt = (
                prompt_template
                .replace("{field_changes}", json.dumps(changes, indent=2))
                .replace("{clause_actions}", json.dumps(clause_actions, indent=2))
                .replace("{original_text}", prev_version.full_text[:15000])
            )

            result = generate_text(prompt)
            new_text = result["text"]
            meta = result.get("_meta", {})

            new_version = ContractVersion(
                deal_id=_uuid.UUID(deal_id),
                version_number=prev_version.version_number + 1,
                full_text=new_text,
                extracted_fields=new_fields,
                clause_tags=new_clauses,
                contract_type=prev_version.contract_type,
                change_summary={"changes": changes, "clause_actions": clause_actions},
                source="generated",
                source_cr_id=_uuid.UUID(cr_id),
                created_by=_uuid.UUID(user_id),
                prompt_version="generate_version_v1",
            )
            session.add(new_version)


            event = AuditEvent(
                deal_id=_uuid.UUID(deal_id),
                user_id=_uuid.UUID(user_id),
                action="version_generated",
                details={
                    "version_number": new_version.version_number,
                    "cr_id": cr_id,
                    "input_tokens": meta.get("input_tokens"),
                    "output_tokens": meta.get("output_tokens"),
                },
            )
            session.add(event)

            _update_job(session, job_id, "completed", result={
                "version_id": str(new_version.id),
                "version_number": new_version.version_number,
            })

            _notify_deal_sync(session, _uuid.UUID(deal_id), "version_generated",
                              "New contract version generated",
                              f"Contract version {new_version.version_number} has been generated.")

            session.commit()
        except Exception as e:
            logger.exception("generate_version failed")
            _update_job(session, job_id, "failed", error=str(e))
            session.commit()


async def run_parse_contract(job_id: str, deal_id: str, version_id: str):
    """Fire-and-forget async wrapper for parse_contract."""
    try:
        await asyncio.to_thread(_run_parse_contract, job_id, deal_id, version_id)
    except Exception:
        logger.exception("run_parse_contract wrapper failed")


async def run_analyze_change_request(job_id: str, deal_id: str, cr_id: str):
    """Fire-and-forget async wrapper for analyze_change_request."""
    try:
        await asyncio.to_thread(_run_analyze_change_request, job_id, deal_id, cr_id)
    except Exception:
        logger.exception("run_analyze_change_request wrapper failed")


async def run_generate_version(job_id: str, deal_id: str, cr_id: str, user_id: str):
    """Fire-and-forget async wrapper for generate_version."""
    try:
        await asyncio.to_thread(_run_generate_version, job_id, deal_id, cr_id, user_id)
    except Exception:
        logger.exception("run_generate_version wrapper failed")


def _run_generate_timeline_pdf(job_id: str, deal_id: str):
    """Sync function that runs generate_timeline_pdf logic."""
    import base64, uuid as _uuid
    from datetime import datetime
    from models.deal import Deal
    from models.contract import ContractVersion
    from models.share_link import ShareLink
    from models.audit import AuditEvent
    from services.timeline_pdf import extract_timeline_dates, build_pdf, get_brand_for_deal_sync

    with Session(sync_engine) as session:
        _update_job(session, job_id, "processing")

        deal = session.get(Deal, _uuid.UUID(deal_id))
        if not deal:
            _update_job(session, job_id, "failed", error="Deal not found")
            return

        from sqlmodel import select
        stmt = (
            select(ContractVersion)
            .where(ContractVersion.deal_id == _uuid.UUID(deal_id))
            .order_by(ContractVersion.version_number.desc())
        )
        version = session.exec(stmt).first()
        if not version or not version.full_text:
            _update_job(session, job_id, "failed", error="No contract version found")
            return

        try:
            timeline = extract_timeline_dates(version.full_text)

            # Create deliverables from timeline
            try:
                from services.timeline_pdf import create_deliverables_from_timeline
                from models.audit import AuditEvent
                create_deliverables_from_timeline(session, deal, timeline)
                event_del = AuditEvent(
                    deal_id=_uuid.UUID(deal_id),
                    action="deliverables_created",
                    details={"count": len(timeline)},
                )
                session.add(event_del)
            except Exception:
                logger.exception("Deliverable creation failed (non-fatal)")

            brand = get_brand_for_deal_sync(session, deal)
            pdf_bytes = build_pdf(
                timeline=timeline,
                property_address=deal.address or "",
                company_name=brand["company_name"],
                primary_color=brand["primary_color"],
            )
            pdf_b64 = base64.b64encode(pdf_bytes).decode()

            deal.timeline_pdf_base64 = pdf_b64
            deal.timeline_generated_at = datetime.utcnow()
            session.add(deal)

            # Email notifications
            try:
                from services.email import notify_timeline_generated
                links = session.exec(
                    select(ShareLink).where(
                        ShareLink.deal_id == _uuid.UUID(deal_id),
                        ShareLink.is_active == True,
                    )
                ).all()
                for sl in links:
                    if sl.counterparty_email:
                        notify_timeline_generated(
                            to=sl.counterparty_email,
                            deal_title=deal.title,
                            address=deal.address or "",
                            pdf_base64=pdf_b64,
                        )
                from models.user import User
                owner = session.get(User, deal.created_by)
                if owner and owner.email:
                    notify_timeline_generated(
                        to=owner.email,
                        deal_title=deal.title,
                        address=deal.address or "",
                        pdf_base64=pdf_b64,
                    )
            except Exception:
                logger.exception("Timeline PDF email notification failed (non-fatal)")

            event = AuditEvent(
                deal_id=_uuid.UUID(deal_id),
                action="timeline_pdf_generated",
                details={"timeline_items": len(timeline)},
            )
            session.add(event)

            _update_job(session, job_id, "completed", result={"timeline_items": len(timeline)})
            session.commit()
        except Exception as e:
            logger.exception("generate_timeline_pdf failed")
            _update_job(session, job_id, "failed", error=str(e))
            session.commit()


async def run_generate_timeline_pdf(job_id: str, deal_id: str):
    """Fire-and-forget async wrapper for generate_timeline_pdf."""
    try:
        await asyncio.to_thread(_run_generate_timeline_pdf, job_id, deal_id)
    except Exception:
        logger.exception("run_generate_timeline_pdf wrapper failed")


def _run_generate_initial_contract(
    job_id: str, deal_id: str, template_slug: str,
    deal_details: dict, supporting_texts: list[str], user_id: str,
):
    """Generate an initial contract from a template and deal details."""
    import json, uuid as _uuid
    from datetime import datetime
    from models.contract import ContractVersion
    from models.audit import AuditEvent
    from llm.anthropic_client import generate_text, generate_json

    TEMPLATE_NAMES = {
        "far_bar_asis": "FAR/BAR As-Is Residential Contract for Sale and Purchase",
        "far_bar_standard": "FAR/BAR Standard Residential Contract for Sale and Purchase",
    }

    with Session(sync_engine) as session:
        _update_job(session, job_id, "processing")

        try:
            template_type = TEMPLATE_NAMES.get(template_slug, template_slug)
            supporting_docs_text = "\n\n".join(supporting_texts) if supporting_texts else "None provided."

            prompt_template = _read_prompt("generate_initial_contract_v1.md")
            prompt = (
                prompt_template
                .replace("{template_type}", template_type)
                .replace("{deal_details_json}", json.dumps(deal_details, indent=2))
                .replace("{supporting_docs_text}", supporting_docs_text)
            )

            result = generate_text(
                prompt,
                system=(
                    "You are a senior Florida real estate attorney drafting system. "
                    "You produce complete, legally binding contracts that follow the official "
                    "FAR/BAR form structure exactly. Your contracts are comprehensive — every section, "
                    "every standard clause, every legal provision must be included in full. "
                    "Never abbreviate or summarize legal language. Output only the contract text."
                ),
                max_tokens=16000,
            )
            new_text = result["text"]
            meta = result.get("_meta", {})

            # Create version 0
            version = ContractVersion(
                deal_id=_uuid.UUID(deal_id),
                version_number=0,
                full_text=new_text,
                source="ai_generated",
                created_by=_uuid.UUID(user_id),
                prompt_version="generate_initial_contract_v1",
            )
            session.add(version)
            session.flush()

            # Auto-parse the generated contract to extract fields/clauses
            parse_prompt_template = _read_prompt("parse_contract_v1.md")
            parse_prompt = parse_prompt_template.replace("{contract_text}", new_text[:15000])
            parse_result = generate_json(parse_prompt, "Return the contract analysis JSON.")
            parse_result.pop("_meta", None)

            version.extracted_fields = parse_result.get("fields", {})
            version.clause_tags = parse_result.get("clauses", [])
            version.contract_type = parse_result.get("contract_type", "UNKNOWN")
            session.add(version)


            event = AuditEvent(
                deal_id=_uuid.UUID(deal_id),
                user_id=_uuid.UUID(user_id),
                action="contract_ai_generated",
                details={
                    "version_id": str(version.id),
                    "template": template_slug,
                    "input_tokens": meta.get("input_tokens"),
                    "output_tokens": meta.get("output_tokens"),
                },
            )
            session.add(event)

            _update_job(session, job_id, "completed", result={
                "version_id": str(version.id),
            })
            session.commit()
        except Exception as e:
            logger.exception("generate_initial_contract failed")
            _update_job(session, job_id, "failed", error=str(e))
            session.commit()


async def run_generate_initial_contract(
    job_id: str, deal_id: str, template_slug: str,
    deal_details: dict, supporting_texts: list[str], user_id: str,
):
    """Fire-and-forget async wrapper for generate_initial_contract."""
    try:
        await asyncio.to_thread(
            _run_generate_initial_contract, job_id, deal_id,
            template_slug, deal_details, supporting_texts, user_id,
        )
    except Exception:
        logger.exception("run_generate_initial_contract wrapper failed")


def _run_generate_offer_letter(
    job_id: str, deal_id: str, user_prompt: str,
    deal_title: str, deal_address: str, deal_type: str, user_id: str,
):
    """Generate an offer letter using Claude."""
    import uuid as _uuid
    from datetime import datetime
    from models.offer_letter import OfferLetter
    from models.audit import AuditEvent
    from llm.anthropic_client import generate_json

    with Session(sync_engine) as session:
        _update_job(session, job_id, "processing")

        try:
            prompt_template = _read_prompt("generate_offer_letter_v1.md")
            prompt = (
                prompt_template
                .replace("{user_prompt}", user_prompt)
                .replace("{deal_title}", deal_title or "N/A")
                .replace("{deal_address}", deal_address or "N/A")
                .replace("{deal_type}", deal_type or "sale")
            )

            result = generate_json(prompt, "Return the offer letter JSON.")
            meta = result.pop("_meta", {})

            # Create OfferLetter record
            offer_letter = OfferLetter(
                deal_id=_uuid.UUID(deal_id),
                user_prompt=user_prompt,
                full_text=result.get("full_text", ""),
                buyer_name=result.get("buyer_name"),
                seller_name=result.get("seller_name"),
                property_address=result.get("property_address"),
                purchase_price=result.get("purchase_price"),
                earnest_money=result.get("earnest_money"),
                closing_date=result.get("closing_date"),
                contingencies=result.get("contingencies"),
                additional_terms=result.get("additional_terms"),
                prompt_version="generate_offer_letter_v1",
                status="draft",
                created_by=_uuid.UUID(user_id),
            )
            session.add(offer_letter)
            session.flush()

            # Audit event
            event = AuditEvent(
                deal_id=_uuid.UUID(deal_id),
                user_id=_uuid.UUID(user_id),
                action="offer_letter_generated",
                details={
                    "offer_letter_id": str(offer_letter.id),
                    "input_tokens": meta.get("input_tokens"),
                    "output_tokens": meta.get("output_tokens"),
                },
            )
            session.add(event)

            _update_job(session, job_id, "completed", result={
                "offer_letter_id": str(offer_letter.id),
            })
            session.commit()
        except Exception as e:
            logger.exception("generate_offer_letter failed")
            _update_job(session, job_id, "failed", error=str(e))
            session.commit()


async def run_generate_offer_letter(
    job_id: str, deal_id: str, user_prompt: str,
    deal_title: str, deal_address: str, deal_type: str, user_id: str,
):
    """Fire-and-forget async wrapper for generate_offer_letter."""
    try:
        await asyncio.to_thread(
            _run_generate_offer_letter, job_id, deal_id, user_prompt,
            deal_title, deal_address, deal_type, user_id,
        )
    except Exception:
        logger.exception("run_generate_offer_letter wrapper failed")
