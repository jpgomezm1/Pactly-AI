"""Version generation service — deterministic field apply + constrained LLM text generation."""

import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, desc

from models.contract import ContractVersion
from models.change_request import ChangeRequest
from services.contract_intelligence import apply_field_changes, apply_clause_actions


async def get_latest_version(session: AsyncSession, deal_id: uuid.UUID) -> Optional[ContractVersion]:
    result = await session.exec(
        select(ContractVersion)
        .where(ContractVersion.deal_id == deal_id)
        .order_by(desc(ContractVersion.version_number))
    )
    return result.first()


async def create_new_version(
    session: AsyncSession,
    deal_id: uuid.UUID,
    new_text: str,
    new_fields: dict,
    new_clauses: list,
    change_summary: dict,
    source_cr_id: Optional[uuid.UUID],
    created_by: uuid.UUID,
    prev_version: ContractVersion,
    prompt_version: Optional[str] = None,
) -> ContractVersion:
    version = ContractVersion(
        deal_id=deal_id,
        version_number=prev_version.version_number + 1,
        full_text=new_text,
        extracted_fields=new_fields,
        clause_tags=new_clauses,
        contract_type=prev_version.contract_type,
        change_summary=change_summary,
        source="generated",
        source_cr_id=source_cr_id,
        created_by=created_by,
        prompt_version=prompt_version,
    )
    session.add(version)
    await session.commit()
    await session.refresh(version)
    return version
