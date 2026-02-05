from __future__ import annotations

import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, desc

from database import get_session
from models.user import User
from models.contract import ContractVersion
from models.job import JobRecord
from schemas.contracts import ContractVersionResponse, DiffResponse
from schemas.change_requests import GenerateVersionRequest, GenerateVersionResponse
from services.auth import get_current_user
from services.rbac import check_deal_access
from services.diffing import compute_diff, compute_field_changes
import asyncio
from workers.inline_runner import run_generate_version

router = APIRouter(prefix="/deals/{deal_id}/versions", tags=["versions"])


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


@router.post("/generate", response_model=GenerateVersionResponse)
async def generate_new_version(
    deal_id: uuid.UUID,
    req: GenerateVersionRequest,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    await check_deal_access(session, user, deal_id)

    job_id = str(uuid.uuid4())
    job = JobRecord(id=job_id, deal_id=deal_id, job_type="generate_version", status="pending")
    session.add(job)
    await session.commit()

    asyncio.create_task(run_generate_version(job_id, str(deal_id), req.change_request_id, str(user.id)))

    return GenerateVersionResponse(job_id=job_id, status="pending")


@router.get("", response_model=list[ContractVersionResponse])
async def list_versions(
    deal_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    await check_deal_access(session, user, deal_id)
    result = await session.exec(
        select(ContractVersion)
        .where(ContractVersion.deal_id == deal_id)
        .order_by(ContractVersion.version_number)
    )
    return [_version_response(v) for v in result.all()]


@router.get("/{version_id}", response_model=ContractVersionResponse)
async def get_version(
    deal_id: uuid.UUID,
    version_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    await check_deal_access(session, user, deal_id)
    result = await session.exec(
        select(ContractVersion).where(
            ContractVersion.id == version_id, ContractVersion.deal_id == deal_id
        )
    )
    v = result.first()
    if not v:
        raise HTTPException(status_code=404, detail="Version not found")
    return _version_response(v)


@router.get("/{version_id}/diff", response_model=DiffResponse)
async def get_diff(
    deal_id: uuid.UUID,
    version_id: uuid.UUID,
    against: str = Query(default="prev", description="Version ID or 'prev'"),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    await check_deal_access(session, user, deal_id)

    result = await session.exec(
        select(ContractVersion).where(
            ContractVersion.id == version_id, ContractVersion.deal_id == deal_id
        )
    )
    version_b = result.first()
    if not version_b:
        raise HTTPException(status_code=404, detail="Version not found")

    if against == "prev":
        result = await session.exec(
            select(ContractVersion).where(
                ContractVersion.deal_id == deal_id,
                ContractVersion.version_number == version_b.version_number - 1,
            )
        )
        version_a = result.first()
        if not version_a:
            raise HTTPException(status_code=404, detail="No previous version")
    else:
        result = await session.exec(
            select(ContractVersion).where(
                ContractVersion.id == uuid.UUID(against),
                ContractVersion.deal_id == deal_id,
            )
        )
        version_a = result.first()
        if not version_a:
            raise HTTPException(status_code=404, detail="Comparison version not found")

    diff = compute_diff(version_a.full_text, version_b.full_text)
    field_changes = compute_field_changes(version_a.extracted_fields, version_b.extracted_fields)

    return DiffResponse(
        version_a_id=str(version_a.id),
        version_b_id=str(version_b.id),
        version_a_number=version_a.version_number,
        version_b_number=version_b.version_number,
        diff_html=diff["diff_html"],
        diff_lines=diff["diff_lines"],
        field_changes=field_changes,
    )
