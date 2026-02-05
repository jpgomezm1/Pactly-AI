from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from database import get_session
from models.user import User, UserRole
from models.deal import Deal
from models.job import JobRecord
from services.auth import get_current_user

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("/{job_id}")
async def get_job_status(
    job_id: str,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    result = await session.exec(select(JobRecord).where(JobRecord.id == job_id))
    job = result.first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Org boundary check: verify job's deal belongs to user's org
    if user.role != UserRole.super_admin and job.deal_id:
        deal = (await session.exec(select(Deal).where(Deal.id == job.deal_id))).first()
        if deal and deal.organization_id != user.organization_id:
            raise HTTPException(status_code=403, detail="Access denied")

    return {
        "id": job.id,
        "job_type": job.job_type,
        "status": job.status,
        "result": job.result,
        "error": job.error,
        "created_at": str(job.created_at),
        "completed_at": str(job.completed_at) if job.completed_at else None,
    }
