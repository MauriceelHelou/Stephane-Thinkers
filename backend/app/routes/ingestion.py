import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.constants import notes_ai_phase_enabled
from app.database import get_db
from app.models.notes_ai import IngestionJob
from app.schemas.analysis import IngestionRequest, IngestionResponse
from app.services.notes_ai.ingestion_jobs import process_ingestion_job
from app.utils.queue import enqueue_or_run

router = APIRouter(prefix="/api/ingestion", tags=["ingestion"])


@router.post("/transcript", response_model=IngestionResponse)
def ingest_transcript(payload: IngestionRequest, db: Session = Depends(get_db)):
    if not notes_ai_phase_enabled("F"):
        raise HTTPException(status_code=503, detail="Notes AI phase F is disabled")

    job = IngestionJob(
        job_type="transcript",
        status="queued",
        payload_json=json.dumps(payload.model_dump()),
    )
    db.add(job)
    db.flush()

    enqueue_or_run(
        process_ingestion_job,
        str(job.id),
        payload.file_name,
        "transcript",
        payload.content,
        job_id=str(job.id),
    )
    db.commit()
    db.refresh(job)

    return IngestionResponse(job_id=job.id, status=job.status, artifact_count=1 if job.status == "completed" else 0)


@router.post("/pdf-highlights", response_model=IngestionResponse)
def ingest_pdf_highlights(payload: IngestionRequest, db: Session = Depends(get_db)):
    if not notes_ai_phase_enabled("F"):
        raise HTTPException(status_code=503, detail="Notes AI phase F is disabled")

    job = IngestionJob(
        job_type="pdf_highlights",
        status="queued",
        payload_json=json.dumps(payload.model_dump()),
    )
    db.add(job)
    db.flush()

    enqueue_or_run(
        process_ingestion_job,
        str(job.id),
        payload.file_name,
        "pdf",
        payload.content,
        job_id=str(job.id),
    )
    db.commit()
    db.refresh(job)

    return IngestionResponse(job_id=job.id, status=job.status, artifact_count=1 if job.status == "completed" else 0)
