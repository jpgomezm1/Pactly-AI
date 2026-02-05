from __future__ import annotations

import uuid
from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, File, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, desc

from database import get_session
from models.user import User
from models.contract import ContractVersion
from models.contract_template import ContractTemplate
from models.supporting_doc import SupportingDocument
from models.job import JobRecord
from schemas.contracts import (
    ContractPasteRequest, ContractVersionResponse, DiffResponse,
    ContractTemplateResponse, ContractGenerateRequest, SupportingDocResponse,
    PDFGenerateRequest, PDFGenerateResponse, PDFTemplateInfo,
)
from services.auth import get_current_user
from services.rbac import check_deal_access
from services.ingestion import extract_text
from services.diffing import compute_diff
from services.transcription import transcribe_audio
from services.timeline import record_event
import asyncio
from workers.inline_runner import run_parse_contract, run_generate_initial_contract

router = APIRouter(prefix="/deals/{deal_id}/contract", tags=["contracts"])
templates_router = APIRouter(prefix="/contract-templates", tags=["contracts"])

MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB


def _version_response(v: ContractVersion) -> ContractVersionResponse:
    return ContractVersionResponse(
        id=str(v.id), deal_id=str(v.deal_id), version_number=v.version_number,
        full_text=v.full_text, extracted_fields=v.extracted_fields,
        clause_tags=v.clause_tags, contract_type=v.contract_type,
        change_summary=v.change_summary, source=v.source,
        source_cr_id=str(v.source_cr_id) if v.source_cr_id else None,
        cycle_id=str(v.cycle_id) if v.cycle_id else None,
        prompt_version=v.prompt_version, created_by=str(v.created_by),
        created_at=v.created_at,
    )


@router.post("/upload", response_model=dict, status_code=201)
async def upload_contract(
    deal_id: uuid.UUID,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    await check_deal_access(session, user, deal_id)

    file_bytes = await file.read()
    if len(file_bytes) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum 10 MB.")

    text, ok = extract_text(file.filename or "unknown.txt", file_bytes)

    version = ContractVersion(
        deal_id=deal_id, version_number=0, full_text=text,
        source="upload", created_by=user.id,
    )
    session.add(version)
    await session.commit()
    await session.refresh(version)

    # Create job and run parse inline in background
    job_id = str(uuid.uuid4())
    job = JobRecord(id=job_id, deal_id=deal_id, job_type="parse_contract", status="pending")
    session.add(job)
    await session.commit()

    asyncio.create_task(run_parse_contract(job_id, str(deal_id), str(version.id)))

    await record_event(session, deal_id, "contract_uploaded", user.id, {
        "version_id": str(version.id), "filename": file.filename, "extraction_ok": ok,
    })

    return {
        "version_id": str(version.id),
        "extraction_ok": ok,
        "job_id": job_id,
        "message": "Contract uploaded. Parsing in background." if ok else
                   "Extraction quality may be poor. Consider using paste fallback.",
    }


@router.post("/paste", response_model=dict, status_code=201)
async def paste_contract(
    deal_id: uuid.UUID,
    req: ContractPasteRequest,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    await check_deal_access(session, user, deal_id)

    version = ContractVersion(
        deal_id=deal_id, version_number=0, full_text=req.text,
        source="paste", created_by=user.id,
    )
    session.add(version)
    await session.commit()
    await session.refresh(version)

    job_id = str(uuid.uuid4())
    job = JobRecord(id=job_id, deal_id=deal_id, job_type="parse_contract", status="pending")
    session.add(job)
    await session.commit()

    asyncio.create_task(run_parse_contract(job_id, str(deal_id), str(version.id)))

    await record_event(session, deal_id, "contract_pasted", user.id, {
        "version_id": str(version.id),
    })

    return {"version_id": str(version.id), "job_id": job_id, "message": "Contract saved. Parsing in background."}


@router.get("/current", response_model=ContractVersionResponse)
async def get_current_contract(
    deal_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    await check_deal_access(session, user, deal_id)
    result = await session.exec(
        select(ContractVersion)
        .where(ContractVersion.deal_id == deal_id)
        .order_by(desc(ContractVersion.version_number))
    )
    version = result.first()
    if not version:
        raise HTTPException(status_code=404, detail="No contract version found")
    return _version_response(version)


# ── Templates ────────────────────────────────────────────────────────────────


@templates_router.get("", response_model=list[ContractTemplateResponse])
async def list_templates(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    result = await session.exec(
        select(ContractTemplate).where(ContractTemplate.is_active == True)
    )
    templates = result.all()
    return [
        ContractTemplateResponse(
            id=str(t.id), name=t.name, slug=t.slug,
            description=t.description, state=t.state,
            required_fields=t.required_fields,
        )
        for t in templates
    ]


# ── Supporting Documents ─────────────────────────────────────────────────────


@router.post("/documents", response_model=SupportingDocResponse, status_code=201,
             tags=["documents"])
async def upload_supporting_doc(
    deal_id: uuid.UUID,
    file: UploadFile = File(...),
    doc_type: str = Form(...),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    await check_deal_access(session, user, deal_id)

    allowed_types = {"mls_listing", "inspection_report", "pre_approval_letter"}
    if doc_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"doc_type must be one of {allowed_types}")

    file_bytes = await file.read()
    if len(file_bytes) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum 10 MB.")

    text, _ = extract_text(file.filename or "unknown.txt", file_bytes)

    doc = SupportingDocument(
        deal_id=deal_id,
        doc_type=doc_type,
        filename=file.filename or "unknown",
        extracted_text=text,
        created_by=user.id,
    )
    session.add(doc)
    await session.commit()
    await session.refresh(doc)

    return SupportingDocResponse(
        id=str(doc.id), deal_id=str(doc.deal_id),
        doc_type=doc.doc_type, filename=doc.filename,
        created_at=doc.created_at,
    )


@router.get("/documents", response_model=list[SupportingDocResponse],
            tags=["documents"])
async def list_supporting_docs(
    deal_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    await check_deal_access(session, user, deal_id)
    result = await session.exec(
        select(SupportingDocument)
        .where(SupportingDocument.deal_id == deal_id)
        .order_by(SupportingDocument.created_at)
    )
    docs = result.all()
    return [
        SupportingDocResponse(
            id=str(d.id), deal_id=str(d.deal_id),
            doc_type=d.doc_type, filename=d.filename,
            created_at=d.created_at,
        )
        for d in docs
    ]


# ── Generate Initial Contract ────────────────────────────────────────────────


@router.post("/generate", response_model=dict, status_code=201)
async def generate_contract(
    deal_id: uuid.UUID,
    req: ContractGenerateRequest,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    await check_deal_access(session, user, deal_id)

    # Validate template
    template = await session.get(ContractTemplate, uuid.UUID(req.template_id))
    if not template or not template.is_active:
        raise HTTPException(status_code=404, detail="Template not found")

    # Gather supporting doc texts
    supporting_texts: list[str] = []
    for doc_id in req.supporting_doc_ids:
        doc = await session.get(SupportingDocument, uuid.UUID(doc_id))
        if doc and doc.deal_id == deal_id:
            supporting_texts.append(f"[{doc.doc_type} — {doc.filename}]\n{doc.extracted_text[:5000]}")

    job_id = str(uuid.uuid4())
    job = JobRecord(id=job_id, deal_id=deal_id, job_type="generate_initial_contract", status="pending")
    session.add(job)
    await session.commit()

    asyncio.create_task(run_generate_initial_contract(
        job_id, str(deal_id), template.slug, req.deal_details,
        supporting_texts, str(user.id),
    ))

    await record_event(session, deal_id, "contract_generation_started", user.id, {
        "template": template.slug, "job_id": job_id,
    })

    return {"job_id": job_id, "message": "Contract generation started."}


MAX_AUDIO_SIZE = 25 * 1024 * 1024  # 25 MB (Whisper limit)


@router.post("/transcribe", response_model=dict)
async def transcribe_voice(
    deal_id: uuid.UUID,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Transcribe an audio file using Whisper STT."""
    await check_deal_access(session, user, deal_id)

    audio_bytes = await file.read()
    if len(audio_bytes) > MAX_AUDIO_SIZE:
        raise HTTPException(status_code=413, detail="Audio file too large. Maximum 25 MB.")

    try:
        text = await transcribe_audio(audio_bytes, file.filename or "audio.webm")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Transcription failed: {str(e)}")

    return {"text": text}


# ── PDF Form Filling ──────────────────────────────────────────────────────────


from services.pdf_form_filler import pdf_filler, PDFFormFillerError
from models.deal import Deal


@templates_router.get("/pdf-templates", response_model=list[PDFTemplateInfo])
async def list_pdf_templates(
    user: User = Depends(get_current_user),
):
    """List available PDF templates for form filling."""
    templates = pdf_filler.get_available_templates()
    return [
        PDFTemplateInfo(
            slug=t["slug"],
            name=t["name"],
            version=t["version"],
            pdf_file=t["pdf_file"],
        )
        for t in templates
    ]


@router.post("/generate-pdf", response_model=PDFGenerateResponse)
async def generate_filled_pdf(
    deal_id: uuid.UUID,
    req: PDFGenerateRequest,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """
    Generate a filled PDF from an official FAR/BAR template.

    Uses the deal's current contract version data to fill the PDF form fields.
    The template_slug must match an available PDF template mapping.
    """
    await check_deal_access(session, user, deal_id)

    # Get deal
    deal = await session.get(Deal, deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    # Get latest contract version for extracted fields
    result = await session.exec(
        select(ContractVersion)
        .where(ContractVersion.deal_id == deal_id)
        .order_by(desc(ContractVersion.version_number))
    )
    version = result.first()

    # Build deal_data: use request override if provided, else extracted_fields
    if req.deal_data:
        deal_data = req.deal_data
    elif version and version.extracted_fields:
        deal_data = version.extracted_fields.copy()
    else:
        deal_data = {}

    # Ensure property address from deal is included
    if deal.address and "property_address" not in deal_data:
        deal_data["property_address"] = deal.address

    # Get mapping for template info
    try:
        mapping = pdf_filler.get_mapping(req.template_slug)
    except PDFFormFillerError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Fill the PDF
    try:
        pdf_base64, warnings = pdf_filler.fill_pdf_base64(
            req.template_slug, deal_data, req.flatten
        )
    except PDFFormFillerError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Generate filename
    safe_title = (deal.title or "contract").replace(" ", "_").replace("/", "-")
    filename = f"{safe_title}_{req.template_slug}.pdf"

    await record_event(session, deal_id, "pdf_generated", user.id, {
        "template_slug": req.template_slug,
        "flatten": req.flatten,
        "warnings_count": len(warnings),
    })

    return PDFGenerateResponse(
        pdf_base64=pdf_base64,
        filename=filename,
        template_used=req.template_slug,
        template_version=mapping.get("template_version", "UNKNOWN"),
        warnings=warnings,
    )


@router.get("/generate-pdf/download")
async def download_filled_pdf(
    deal_id: uuid.UUID,
    template_slug: str = Query(..., description="Template slug, e.g. far_bar_asis"),
    flatten: bool = Query(False, description="Make PDF non-editable"),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """
    Download a filled PDF directly as a file.

    Alternative to the POST endpoint for direct browser downloads.
    """
    await check_deal_access(session, user, deal_id)

    deal = await session.get(Deal, deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    # Get latest contract version
    result = await session.exec(
        select(ContractVersion)
        .where(ContractVersion.deal_id == deal_id)
        .order_by(desc(ContractVersion.version_number))
    )
    version = result.first()

    deal_data = {}
    if version and version.extracted_fields:
        deal_data = version.extracted_fields.copy()
    if deal.address:
        deal_data.setdefault("property_address", deal.address)

    try:
        pdf_bytes, warnings = pdf_filler.fill_pdf(template_slug, deal_data, flatten)
    except PDFFormFillerError as e:
        raise HTTPException(status_code=400, detail=str(e))

    safe_title = (deal.title or "contract").replace(" ", "_").replace("/", "-")
    filename = f"{safe_title}_{template_slug}.pdf"

    await record_event(session, deal_id, "pdf_downloaded", user.id, {
        "template_slug": template_slug,
        "flatten": flatten,
    })

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )
