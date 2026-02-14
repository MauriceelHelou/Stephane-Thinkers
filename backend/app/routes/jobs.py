import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.constants import notes_ai_phase_enabled
from app.database import get_db
from app.models.notes_ai import INGESTION_JOB_TYPES, IngestionJob
from app.services.notes_ai.ingestion_jobs import dispatch_ingestion_job
from app.schemas.analysis import JobStatusResponse
from app.utils.queue import cancel_queued_job, enqueue_or_run

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.get("/{job_id}", response_model=JobStatusResponse)
def get_job_status(job_id: UUID, db: Session = Depends(get_db)):
    if not notes_ai_phase_enabled("F"):
        raise HTTPException(status_code=503, detail="Notes AI phase F is disabled")

    job = db.query(IngestionJob).filter(IngestionJob.id == job_id).first()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    return JobStatusResponse(
        job_id=job.id,
        job_type=job.job_type,
        status=job.status,
        result_json=job.result_json,
        error_message=job.error_message,
    )


@router.post("/{job_id}/cancel", response_model=JobStatusResponse)
def cancel_job(job_id: UUID, db: Session = Depends(get_db)):
    if not notes_ai_phase_enabled("F"):
        raise HTTPException(status_code=503, detail="Notes AI phase F is disabled")

    job = db.query(IngestionJob).filter(IngestionJob.id == job_id).first()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status in {"completed", "failed", "cancelled"}:
        raise HTTPException(status_code=409, detail=f"Cannot cancel job in status '{job.status}'")

    cancel_queued_job(str(job.id))
    job.status = "cancelled"
    db.commit()
    db.refresh(job)
    return JobStatusResponse(
        job_id=job.id,
        job_type=job.job_type,
        status=job.status,
        result_json=job.result_json,
        error_message=job.error_message,
    )


@router.post("/{job_id}/retry", response_model=JobStatusResponse)
def retry_job(job_id: UUID, db: Session = Depends(get_db)):
    if not notes_ai_phase_enabled("F"):
        raise HTTPException(status_code=503, detail="Notes AI phase F is disabled")

    job = db.query(IngestionJob).filter(IngestionJob.id == job_id).first()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status not in {"failed", "cancelled"}:
        raise HTTPException(status_code=409, detail=f"Can only retry failed/cancelled jobs (got '{job.status}')")

    payload = json.loads(job.payload_json or "{}")
    if job.job_type not in INGESTION_JOB_TYPES:
        raise HTTPException(status_code=400, detail=f"Unknown job type '{job.job_type}'")

    file_name = payload.get("file_name")
    content = payload.get("content")
    if job.job_type in {"transcript", "pdf_highlights"} and (not file_name or content is None):
        raise HTTPException(status_code=400, detail="Job payload is incomplete; cannot retry")

    job.status = "queued"
    job.result_json = None
    job.error_message = None
    db.flush()

    enqueue_or_run(
        dispatch_ingestion_job,
        job.job_type,
        str(job.id),
        payload,
        job_id=str(job.id),
    )
    db.commit()
    db.refresh(job)

    return JobStatusResponse(
        job_id=job.id,
        job_type=job.job_type,
        status=job.status,
        result_json=job.result_json,
        error_message=job.error_message,
    )
