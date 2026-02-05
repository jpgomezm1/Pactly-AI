"""Lightweight email notifications via Resend. Skips silently if not configured."""

from __future__ import annotations

import logging
import httpx

from config import settings

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"


def _is_configured() -> bool:
    return bool(settings.resend_api_key)


def send_email(to: str, subject: str, html: str, attachments: list[dict] | None = None) -> bool:
    """Send an email via Resend. Returns True on success, False on failure. Never raises."""
    if not _is_configured() or not to:
        return False

    try:
        payload: dict = {
            "from": settings.resend_from_email,
            "to": [to],
            "subject": subject,
            "html": html,
        }
        if attachments:
            payload["attachments"] = attachments

        response = httpx.post(
            RESEND_API_URL,
            headers={
                "Authorization": f"Bearer {settings.resend_api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=10,
        )
        if response.status_code in (200, 201):
            logger.info("Email sent to %s: %s", to, subject)
            return True
        else:
            logger.warning("Resend returned %s: %s", response.status_code, response.text)
            return False
    except Exception:
        logger.exception("Failed to send email to %s", to)
        return False


def notify_cr_submitted(to: str, deal_title: str, cr_preview: str) -> bool:
    """Notify that a change request was submitted."""
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 24px; border-radius: 12px 12px 0 0;">
        <h2 style="color: white; margin: 0; font-size: 18px;">New Change Request</h2>
      </div>
      <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="color: #334155; margin: 0 0 16px;">A change request was submitted on <strong>{deal_title}</strong>:</p>
        <blockquote style="border-left: 3px solid #6366f1; padding-left: 12px; color: #64748b; margin: 0 0 16px;">
          {cr_preview}
        </blockquote>
        <p style="color: #334155; margin: 0;">Log in to Pactly to review and respond.</p>
      </div>
      <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 16px;">Sent by Pactly — AI-powered contract management</p>
    </div>
    """
    return send_email(to, f"New change request on {deal_title}", html)


def notify_analysis_complete(to: str, deal_title: str, recommendation: str) -> bool:
    """Notify that AI analysis is complete."""
    rec_color = {"accept": "#10b981", "reject": "#ef4444", "counter": "#f59e0b"}.get(recommendation, "#6366f1")
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 24px; border-radius: 12px 12px 0 0;">
        <h2 style="color: white; margin: 0; font-size: 18px;">AI Analysis Complete</h2>
      </div>
      <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="color: #334155; margin: 0 0 16px;">The AI analysis for a change request on <strong>{deal_title}</strong> is ready.</p>
        <div style="display: inline-block; background: {rec_color}; color: white; padding: 4px 12px; border-radius: 9999px; font-size: 13px; font-weight: 600; text-transform: capitalize;">
          {recommendation}
        </div>
        <p style="color: #334155; margin: 16px 0 0;">Log in to Pactly to review the full analysis.</p>
      </div>
      <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 16px;">Sent by Pactly — AI-powered contract management</p>
    </div>
    """
    return send_email(to, f"Analysis complete: {deal_title}", html)


def notify_feedback_analyzed(to: str, deal_title: str, recommendation: str, review_url: str) -> bool:
    """Notify counterparty that their feedback was analyzed."""
    rec_color = {"accept": "#10b981", "reject": "#ef4444", "counter": "#f59e0b"}.get(recommendation, "#6366f1")
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 24px; border-radius: 12px 12px 0 0;">
        <h2 style="color: white; margin: 0; font-size: 18px;">Your Feedback Was Reviewed</h2>
      </div>
      <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="color: #334155; margin: 0 0 16px;">Your feedback on <strong>{deal_title}</strong> has been analyzed by our AI.</p>
        <div style="display: inline-block; background: {rec_color}; color: white; padding: 4px 12px; border-radius: 9999px; font-size: 13px; font-weight: 600; text-transform: capitalize;">
          Recommendation: {recommendation}
        </div>
        <p style="color: #334155; margin: 16px 0 0;"><a href="{review_url}" style="color: #6366f1; text-decoration: none; font-weight: 600;">View the full analysis &rarr;</a></p>
      </div>
      <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 16px;">Sent by Pactly — AI-powered contract management</p>
    </div>
    """
    return send_email(to, f"Feedback analyzed: {deal_title}", html)


def notify_cr_accepted(to: str, deal_title: str, deal_url_or_review_url: str) -> bool:
    """Notify that a change request was accepted."""
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 24px; border-radius: 12px 12px 0 0;">
        <h2 style="color: white; margin: 0; font-size: 18px;">Change Request Accepted</h2>
      </div>
      <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="color: #334155; margin: 0 0 16px;">A change request on <strong>{deal_title}</strong> was accepted. A new version of the contract is being generated.</p>
        <p style="color: #334155; margin: 0;"><a href="{deal_url_or_review_url}" style="color: #6366f1; text-decoration: none; font-weight: 600;">View the deal &rarr;</a></p>
      </div>
      <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 16px;">Sent by Pactly — AI-powered contract management</p>
    </div>
    """
    return send_email(to, f"Change request accepted: {deal_title}", html)


def notify_cr_rejected(to: str, deal_title: str, reason: str, deal_url_or_review_url: str) -> bool:
    """Notify that a change request was rejected."""
    reason_block = f'<blockquote style="border-left: 3px solid #ef4444; padding-left: 12px; color: #64748b; margin: 0 0 16px;">{reason}</blockquote>' if reason else ""
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #ef4444, #dc2626); padding: 24px; border-radius: 12px 12px 0 0;">
        <h2 style="color: white; margin: 0; font-size: 18px;">Change Request Rejected</h2>
      </div>
      <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="color: #334155; margin: 0 0 16px;">A change request on <strong>{deal_title}</strong> was rejected.</p>
        {reason_block}
        <p style="color: #334155; margin: 0;"><a href="{deal_url_or_review_url}" style="color: #6366f1; text-decoration: none; font-weight: 600;">View the deal &rarr;</a></p>
      </div>
      <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 16px;">Sent by Pactly — AI-powered contract management</p>
    </div>
    """
    return send_email(to, f"Change request rejected: {deal_title}", html)


def notify_cr_countered(to: str, deal_title: str, counter_text: str, deal_url_or_review_url: str) -> bool:
    """Notify that a counter proposal was submitted."""
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 24px; border-radius: 12px 12px 0 0;">
        <h2 style="color: white; margin: 0; font-size: 18px;">Counter Proposal Submitted</h2>
      </div>
      <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="color: #334155; margin: 0 0 16px;">A counter proposal was submitted on <strong>{deal_title}</strong>:</p>
        <blockquote style="border-left: 3px solid #f59e0b; padding-left: 12px; color: #64748b; margin: 0 0 16px;">
          {counter_text}
        </blockquote>
        <p style="color: #334155; margin: 0;"><a href="{deal_url_or_review_url}" style="color: #6366f1; text-decoration: none; font-weight: 600;">View and respond &rarr;</a></p>
      </div>
      <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 16px;">Sent by Pactly — AI-powered contract management</p>
    </div>
    """
    return send_email(to, f"Counter proposal on {deal_title}", html)


def notify_deal_accepted(to: str, deal_title: str, deal_url_or_review_url: str) -> bool:
    """Notify that both parties accepted the deal."""
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 24px; border-radius: 12px 12px 0 0;">
        <h2 style="color: white; margin: 0; font-size: 18px;">Deal Accepted!</h2>
      </div>
      <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="color: #334155; margin: 0 0 16px;">Both parties have accepted the terms on <strong>{deal_title}</strong>. The deal is now finalized.</p>
        <p style="color: #334155; margin: 0;"><a href="{deal_url_or_review_url}" style="color: #6366f1; text-decoration: none; font-weight: 600;">View the deal &rarr;</a></p>
      </div>
      <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 16px;">Sent by Pactly — AI-powered contract management</p>
    </div>
    """
    return send_email(to, f"Deal accepted: {deal_title}", html)


def notify_new_version(to: str, deal_title: str, version_number: int, deal_url_or_review_url: str) -> bool:
    """Notify that a new contract version was generated."""
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 24px; border-radius: 12px 12px 0 0;">
        <h2 style="color: white; margin: 0; font-size: 18px;">New Contract Version</h2>
      </div>
      <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="color: #334155; margin: 0 0 16px;">Version {version_number} of the contract for <strong>{deal_title}</strong> has been generated.</p>
        <p style="color: #334155; margin: 0;"><a href="{deal_url_or_review_url}" style="color: #6366f1; text-decoration: none; font-weight: 600;">View the new version &rarr;</a></p>
      </div>
      <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 16px;">Sent by Pactly — AI-powered contract management</p>
    </div>
    """
    return send_email(to, f"New version (v{version_number}): {deal_title}", html)


async def get_counterparty_emails(session, deal_id) -> list[tuple[str, str, str]]:
    """Return list of (email, name, slug) for active share links with email on this deal."""
    from sqlmodel import select
    from models.share_link import ShareLink
    result = await session.exec(
        select(ShareLink).where(
            ShareLink.deal_id == deal_id,
            ShareLink.is_active == True,
        )
    )
    links = result.all()
    return [
        (sl.counterparty_email, sl.counterparty_name, sl.slug or sl.token)
        for sl in links
        if sl.counterparty_email
    ]


async def get_deal_owner_email(session, deal_id) -> tuple[str, str]:
    """Return (email, user_id) of the deal creator."""
    from sqlmodel import select
    from models.deal import Deal
    from models.user import User
    deal = (await session.exec(select(Deal).where(Deal.id == deal_id))).first()
    if not deal:
        return ("", "")
    user = (await session.exec(select(User).where(User.id == deal.created_by))).first()
    if not user:
        return ("", "")
    return (user.email or "", str(user.id))


def notify_timeline_generated(to: str, deal_title: str, address: str, pdf_base64: str) -> bool:
    """Notify with the Critical Dates PDF attached."""
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 24px; border-radius: 12px 12px 0 0;">
        <h2 style="color: white; margin: 0; font-size: 18px;">Critical Dates Ready</h2>
      </div>
      <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="color: #334155; margin: 0 0 16px;">Both parties have accepted <strong>{deal_title}</strong>. The Critical Dates timeline for <strong>{address or 'the property'}</strong> is attached.</p>
        <p style="color: #334155; margin: 0;">Please review the attached PDF for all important deadlines.</p>
      </div>
      <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 16px;">Sent by Pactly — AI-powered contract management</p>
    </div>
    """
    attachments = [{"filename": "Critical_Dates.pdf", "content": pdf_base64}]
    return send_email(to, f"Critical Dates: {deal_title}", html, attachments=attachments)


def notify_deliverable_reminder(to: str, deal_title: str, description: str, due_date: str, days_remaining: int) -> bool:
    """Remind about an upcoming deliverable deadline."""
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 24px; border-radius: 12px 12px 0 0;">
        <h2 style="color: white; margin: 0; font-size: 18px;">Deliverable Due Soon</h2>
      </div>
      <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="color: #334155; margin: 0 0 16px;">A deliverable on <strong>{deal_title}</strong> is due in <strong>{days_remaining} day(s)</strong>:</p>
        <blockquote style="border-left: 3px solid #f59e0b; padding-left: 12px; color: #64748b; margin: 0 0 16px;">
          {description}<br><small>Due: {due_date}</small>
        </blockquote>
        <p style="color: #334155; margin: 0;">Please upload the required document before the deadline.</p>
      </div>
      <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 16px;">Sent by Pactly — AI-powered contract management</p>
    </div>
    """
    return send_email(to, f"Deliverable due in {days_remaining} day(s): {deal_title}", html)


def notify_deliverable_overdue(to: str, deal_title: str, description: str, due_date: str) -> bool:
    """Alert about an overdue deliverable."""
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #ef4444, #dc2626); padding: 24px; border-radius: 12px 12px 0 0;">
        <h2 style="color: white; margin: 0; font-size: 18px;">Deliverable Overdue</h2>
      </div>
      <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="color: #334155; margin: 0 0 16px;">A deliverable on <strong>{deal_title}</strong> is <strong>overdue</strong>:</p>
        <blockquote style="border-left: 3px solid #ef4444; padding-left: 12px; color: #64748b; margin: 0 0 16px;">
          {description}<br><small>Was due: {due_date}</small>
        </blockquote>
        <p style="color: #334155; margin: 0;">Please upload the required document as soon as possible.</p>
      </div>
      <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 16px;">Sent by Pactly — AI-powered contract management</p>
    </div>
    """
    return send_email(to, f"OVERDUE deliverable: {deal_title}", html)


def notify_external_feedback(to: str, deal_title: str, reviewer_name: str) -> bool:
    """Notify that external feedback was received."""
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #14b8a6, #0d9488); padding: 24px; border-radius: 12px 12px 0 0;">
        <h2 style="color: white; margin: 0; font-size: 18px;">External Feedback Received</h2>
      </div>
      <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="color: #334155; margin: 0 0 16px;"><strong>{reviewer_name}</strong> submitted feedback on <strong>{deal_title}</strong>.</p>
        <p style="color: #334155; margin: 0;">Log in to Pactly to review their feedback.</p>
      </div>
      <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 16px;">Sent by Pactly — AI-powered contract management</p>
    </div>
    """
    return send_email(to, f"Feedback received on {deal_title}", html)
