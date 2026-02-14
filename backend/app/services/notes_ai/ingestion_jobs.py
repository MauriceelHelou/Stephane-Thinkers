import json
from typing import Dict
from uuid import UUID

from app.database import SessionLocal
from app.models.notes_ai import IngestionJob, SourceArtifact


def process_ingestion_job(job_id: str, file_name: str, file_type: str, content: str) -> Dict[str, object]:
    """
    Queue-safe ingestion worker function.

    Receives only JSON-serializable args so it can run in RQ workers.
    """
    db = SessionLocal()
    try:
        parsed_job_id = UUID(str(job_id))
        job = db.query(IngestionJob).filter(IngestionJob.id == parsed_job_id).first()
        if job is None:
            return {"status": "failed", "error": "job not found"}

        job.status = "running"
        db.flush()

        artifact = SourceArtifact(
            job_id=job.id,
            file_name=file_name,
            file_type=file_type,
            raw_text=content,
            metadata_json=json.dumps({"length": len(content)}),
        )
        db.add(artifact)
        db.flush()

        job.status = "completed"
        job.result_json = json.dumps({"artifact_count": 1, "file_type": file_type})
        db.commit()
        return {"status": "completed", "artifact_count": 1}
    except Exception as error:
        db.rollback()
        try:
            parsed_job_id = UUID(str(job_id))
            failed_job = db.query(IngestionJob).filter(IngestionJob.id == parsed_job_id).first()
            if failed_job is not None:
                failed_job.status = "failed"
                failed_job.error_message = str(error)
                db.commit()
        except Exception:
            db.rollback()
        return {"status": "failed", "error": str(error)}
    finally:
        db.close()
