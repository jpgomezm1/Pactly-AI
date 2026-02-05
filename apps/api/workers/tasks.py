"""Celery background tasks for contract processing."""

import json
import logging
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from sqlmodel import Session, select
from workers.celery_app import celery_app
from database import sync_engine
from models.contract import ContractVersion
from models.change_request import ChangeRequest
from models.job import JobRecord
from models.audit import AuditEvent
from services.contract_intelligence import (
    ALLOWED_FIELDS,
    apply_field_changes,
    apply_clause_actions,
    build_empty_contract_state,
)
from llm.anthropic_client import generate_json, generate_text

logger = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def _read_prompt(name: str) -> str:
    return (PROMPTS_DIR / name).read_text()


def _update_job(session: Session, job_id: str, status: str, result: Optional[dict] = None, error: Optional[str] = None):
    job = session.get(JobRecord, job_id)
    if job:
        job.status = status
        job.result = result
        job.error = error
        if status in ("completed", "failed"):
            job.completed_at = datetime.utcnow()
        session.add(job)
        session.commit()


@celery_app.task(name="parse_contract", bind=True)
def parse_contract(self, deal_id: str, version_id: str):
    job_id = self.request.id
    with Session(sync_engine) as session:
        _update_job(session, job_id, "processing")

        version = session.get(ContractVersion, uuid.UUID(version_id))
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

            # Audit
            event = AuditEvent(
                deal_id=uuid.UUID(deal_id),
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


@celery_app.task(name="analyze_change_request", bind=True)
def analyze_change_request(self, deal_id: str, cr_id: str):
    job_id = self.request.id
    with Session(sync_engine) as session:
        _update_job(session, job_id, "processing")

        cr = session.get(ChangeRequest, uuid.UUID(cr_id))
        if not cr:
            _update_job(session, job_id, "failed", error="Change request not found")
            return

        # Get latest version
        stmt = (
            select(ContractVersion)
            .where(ContractVersion.deal_id == uuid.UUID(deal_id))
            .order_by(ContractVersion.version_number.desc())  # type: ignore
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
                deal_id=uuid.UUID(deal_id),
                user_id=cr.created_by,
                action="change_request_analyzed",
                details={"cr_id": cr_id, "recommendation": result.get("recommendation")},
            )
            session.add(event)

            _update_job(session, job_id, "completed", result={"recommendation": result.get("recommendation")})
            session.commit()
        except Exception as e:
            logger.exception("analyze_change_request failed")
            cr.analysis_status = "failed"
            session.add(cr)
            _update_job(session, job_id, "failed", error=str(e))
            session.commit()


@celery_app.task(name="check_stale_deals")
def check_stale_deals():
    """Daily task to detect stale deals and create notifications."""
    from models.organization import Organization
    from models.notification import Notification
    from models.deal import DealAssignment
    from services.deal_health import detect_stale_deals

    with Session(sync_engine) as session:
        orgs = session.exec(select(Organization)).all()
        for org in orgs:
            stale = detect_stale_deals(session, org.id, threshold_days=7)
            for item in stale:
                # Notify all participants
                assignments = session.exec(
                    select(DealAssignment).where(
                        DealAssignment.deal_id == uuid.UUID(item["deal_id"])
                    )
                ).all()
                for a in assignments:
                    n = Notification(
                        user_id=a.user_id,
                        deal_id=uuid.UUID(item["deal_id"]),
                        type="stale_deal",
                        title="Deal needs attention",
                        message=f'"{item["title"]}" has had no activity for {item["days_inactive"]} days.',
                    )
                    session.add(n)
            session.commit()
    logger.info("check_stale_deals completed")


@celery_app.task(name="generate_timeline_pdf", bind=True)
def generate_timeline_pdf(self, deal_id: str):
    job_id = self.request.id
    with Session(sync_engine) as session:
        _update_job(session, job_id, "processing")

        from models.deal import Deal
        deal = session.get(Deal, uuid.UUID(deal_id))
        if not deal:
            _update_job(session, job_id, "failed", error="Deal not found")
            return

        stmt = (
            select(ContractVersion)
            .where(ContractVersion.deal_id == uuid.UUID(deal_id))
            .order_by(ContractVersion.version_number.desc())  # type: ignore
        )
        version = session.exec(stmt).first()
        if not version or not version.full_text:
            _update_job(session, job_id, "failed", error="No contract version found")
            return

        try:
            import base64
            from services.timeline_pdf import extract_timeline_dates, build_pdf, get_brand_for_deal_sync

            timeline = extract_timeline_dates(version.full_text)

            # Create deliverables from timeline
            try:
                from services.timeline_pdf import create_deliverables_from_timeline
                create_deliverables_from_timeline(session, deal, timeline)
                event_del = AuditEvent(
                    deal_id=uuid.UUID(deal_id),
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

            # Email to counterparties
            try:
                from services.email import notify_timeline_generated, get_counterparty_emails
                import asyncio
                # get_counterparty_emails is async; use sync query instead
                from models.share_link import ShareLink
                links = session.exec(
                    select(ShareLink).where(
                        ShareLink.deal_id == uuid.UUID(deal_id),
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
                # Also email deal owner
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
                deal_id=uuid.UUID(deal_id),
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


@celery_app.task(name="check_deliverable_reminders")
def check_deliverable_reminders():
    """Daily task to send reminders for upcoming and overdue deliverables."""
    from models.deliverable import Deliverable
    from models.deal import Deal, DealAssignment
    from models.share_link import ShareLink
    from models.notification import Notification
    from models.user import User
    from services.email import notify_deliverable_reminder, notify_deliverable_overdue
    from datetime import date

    today = date.today()

    with Session(sync_engine) as session:
        # All confirmed, pending deliverables
        stmt = select(Deliverable).where(
            Deliverable.is_confirmed == True,  # noqa: E712
            Deliverable.status.in_(["pending"]),
        )
        deliverables = session.exec(stmt).all()

        for d in deliverables:
            # Parse due_date
            try:
                due = date.fromisoformat(d.due_date)
            except (ValueError, TypeError):
                continue

            days_remaining = (due - today).days
            deal = session.get(Deal, d.deal_id)
            if not deal:
                continue

            # Overdue
            if days_remaining < 0:
                d.status = "overdue"
                session.add(d)
                _send_deliverable_notification(
                    session, deal, d, "overdue", 0, notify_deliverable_overdue
                )
                continue

            # 7 / 3 / 1 day reminders
            if days_remaining <= 7 and not d.reminder_7d_sent:
                d.reminder_7d_sent = True
                session.add(d)
                _send_deliverable_notification(
                    session, deal, d, "reminder", days_remaining, notify_deliverable_reminder
                )
            if days_remaining <= 3 and not d.reminder_3d_sent:
                d.reminder_3d_sent = True
                session.add(d)
                _send_deliverable_notification(
                    session, deal, d, "reminder", days_remaining, notify_deliverable_reminder
                )
            if days_remaining <= 1 and not d.reminder_1d_sent:
                d.reminder_1d_sent = True
                session.add(d)
                _send_deliverable_notification(
                    session, deal, d, "reminder", days_remaining, notify_deliverable_reminder
                )

        session.commit()
    logger.info("check_deliverable_reminders completed")


def _send_deliverable_notification(session, deal, deliverable, notif_type, days_remaining, email_fn):
    """Send in-app + email notifications for a deliverable."""
    from models.deal import DealAssignment
    from models.notification import Notification
    from models.share_link import ShareLink
    from models.user import User

    if deliverable.responsible_party == "admin":
        # Notify deal participants in-app
        assignments = session.exec(
            select(DealAssignment).where(DealAssignment.deal_id == deal.id)
        ).all()
        for a in assignments:
            n = Notification(
                user_id=a.user_id,
                deal_id=deal.id,
                type=f"deliverable_{notif_type}",
                title=f"Deliverable {'overdue' if notif_type == 'overdue' else 'due soon'}",
                message=f'"{deliverable.description}" on "{deal.title}" is {"overdue" if notif_type == "overdue" else f"due in {days_remaining} day(s)"}.',
            )
            session.add(n)
            # Email the user
            user = session.get(User, a.user_id)
            if user and user.email:
                try:
                    email_fn(
                        to=user.email,
                        deal_title=deal.title,
                        description=deliverable.description,
                        due_date=deliverable.due_date,
                        **({"days_remaining": days_remaining} if notif_type == "reminder" else {}),
                    )
                except Exception:
                    pass
    else:
        # Counterparty: email only via ShareLink
        links = session.exec(
            select(ShareLink).where(
                ShareLink.deal_id == deal.id,
                ShareLink.is_active == True,  # noqa: E712
            )
        ).all()
        for sl in links:
            if sl.counterparty_email:
                try:
                    email_fn(
                        to=sl.counterparty_email,
                        deal_title=deal.title,
                        description=deliverable.description,
                        due_date=deliverable.due_date,
                        **({"days_remaining": days_remaining} if notif_type == "reminder" else {}),
                    )
                except Exception:
                    pass


@celery_app.task(name="generate_version", bind=True)
def generate_version(self, deal_id: str, cr_id: str, user_id: str):
    job_id = self.request.id
    with Session(sync_engine) as session:
        _update_job(session, job_id, "processing")

        cr = session.get(ChangeRequest, uuid.UUID(cr_id))
        if not cr or not cr.analysis_result:
            _update_job(session, job_id, "failed", error="CR not found or not analyzed")
            return

        stmt = (
            select(ContractVersion)
            .where(ContractVersion.deal_id == uuid.UUID(deal_id))
            .order_by(ContractVersion.version_number.desc())  # type: ignore
        )
        prev_version = session.exec(stmt).first()
        if not prev_version:
            _update_job(session, job_id, "failed", error="No contract version found")
            return

        try:
            analysis = cr.analysis_result
            changes = analysis.get("changes", [])
            clause_actions = analysis.get("clause_actions", [])

            # Step 1: Deterministic field apply
            current_fields = prev_version.extracted_fields or {}
            new_fields = apply_field_changes(current_fields, changes)

            # Step 1b: Clause apply
            current_clauses = prev_version.clause_tags or []
            new_clauses = apply_clause_actions(current_clauses, clause_actions)

            # Step 2: Constrained LLM text generation
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

            # Create new version
            new_version = ContractVersion(
                deal_id=uuid.UUID(deal_id),
                version_number=prev_version.version_number + 1,
                full_text=new_text,
                extracted_fields=new_fields,
                clause_tags=new_clauses,
                contract_type=prev_version.contract_type,
                change_summary={"changes": changes, "clause_actions": clause_actions},
                source="generated",
                source_cr_id=uuid.UUID(cr_id),
                created_by=uuid.UUID(user_id),
                prompt_version="generate_version_v1",
            )
            session.add(new_version)

            event = AuditEvent(
                deal_id=uuid.UUID(deal_id),
                user_id=uuid.UUID(user_id),
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
            session.commit()
        except Exception as e:
            logger.exception("generate_version failed")
            _update_job(session, job_id, "failed", error=str(e))
            session.commit()
