import json
import os
from datetime import datetime, timedelta
from typing import Any, Dict, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.constants import notes_ai_phase_enabled, notes_ai_timeline_bootstrap_enabled
from app.database import get_db
from app.models.notes_ai import (
    INGESTION_JOB_TYPES,
    IngestionJob,
    TimelineBootstrapCandidate,
    TimelineBootstrapCommitAudit,
    TimelineBootstrapSession,
)
from app.schemas.analysis import (
    IngestionRequest,
    IngestionResponse,
    TimelineBootstrapAuditResponse,
    TimelineBootstrapCandidatesResponse,
    TimelineBootstrapCandidateItem,
    TimelineBootstrapCommitRequest,
    TimelineBootstrapCommitResponse,
    TimelineBootstrapSessionResponse,
    TimelineBootstrapValidationRequest,
    TimelineBootstrapValidationResponse,
    TimelinePreviewRequest,
    TimelinePreviewResponse,
)
from app.services.notes_ai.ingestion_jobs import (
    dispatch_ingestion_job,
    load_session_graph,
    run_commit,
)
from app.services.notes_ai.timeline_bootstrap_validation import apply_validation, validate_graph
from app.utils.queue import RQ_ENABLED, enqueue_or_run

router = APIRouter(prefix="/api/ingestion", tags=["ingestion"])

ENVIRONMENT = os.getenv("ENVIRONMENT", "development").strip().lower()
MAX_CONTENT_BYTES = 500 * 1024
MAX_CONTENT_CHARS = 250_000
INLINE_DEV_MAX_BYTES = 100 * 1024
SESSION_TTL_DAYS = int(os.getenv("TIMELINE_BOOTSTRAP_SESSION_TTL_DAYS", "30"))


def _json_loads(value: Optional[str], default: Any) -> Any:
    if value is None:
        return default
    try:
        return json.loads(value)
    except Exception:
        return default


def _is_dev_like_environment() -> bool:
    return ENVIRONMENT in {"development", "dev", "test", "local"}


def _ensure_phase_f_enabled() -> None:
    if not notes_ai_phase_enabled("F"):
        raise HTTPException(status_code=503, detail="Notes AI phase F is disabled")


def _ensure_bootstrap_enabled() -> None:
    _ensure_phase_f_enabled()

    if not notes_ai_timeline_bootstrap_enabled():
        raise HTTPException(status_code=503, detail="Timeline bootstrap feature is disabled")

    if not _is_dev_like_environment() and not RQ_ENABLED:
        raise HTTPException(
            status_code=503,
            detail="Timeline bootstrap requires queue mode in production/staging. Set RQ_ENABLED=true.",
        )


def _validate_content_limits(content: str) -> None:
    encoded = (content or "").encode("utf-8")
    size_bytes = len(encoded)
    char_count = len(content or "")

    if size_bytes > MAX_CONTENT_BYTES:
        raise HTTPException(
            status_code=422,
            detail=f"Content exceeds max size ({MAX_CONTENT_BYTES} bytes). Split the source and retry.",
        )

    if char_count > MAX_CONTENT_CHARS:
        raise HTTPException(
            status_code=422,
            detail=f"Content exceeds max characters ({MAX_CONTENT_CHARS}). Split the source and retry.",
        )

    if not RQ_ENABLED and size_bytes > INLINE_DEV_MAX_BYTES:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Content exceeds inline-dev cap ({INLINE_DEV_MAX_BYTES} bytes) while RQ is disabled. "
                "Enable RQ or submit a smaller input."
            ),
        )


def _create_ingestion_job(db: Session, *, job_type: str, payload: Dict[str, Any]) -> IngestionJob:
    if job_type not in INGESTION_JOB_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported job_type '{job_type}'")

    job = IngestionJob(
        job_type=job_type,
        status="queued",
        payload_json=json.dumps(payload),
    )
    db.add(job)
    db.flush()
    return job


def _preview_counts_for_session(db: Session, session_id: UUID) -> Dict[str, int]:
    counts = {"thinkers": 0, "events": 0, "connections": 0, "publications": 0, "quotes": 0}
    rows = (
        db.query(TimelineBootstrapCandidate.entity_type, func.count(TimelineBootstrapCandidate.id))
        .filter(TimelineBootstrapCandidate.session_id == session_id)
        .group_by(TimelineBootstrapCandidate.entity_type)
        .all()
    )
    for entity_type, count in rows:
        if entity_type in counts:
            counts[entity_type] = int(count)
    return counts


def _serialize_session_response(db: Session, session: TimelineBootstrapSession) -> TimelineBootstrapSessionResponse:
    preview_json = _json_loads(session.preview_json, {})
    summary = preview_json.get("summary") or {}
    candidate_counts = summary.get("candidate_counts")
    if not isinstance(candidate_counts, dict):
        candidate_counts = _preview_counts_for_session(db, session.id)

    warnings = [str(item) for item in (preview_json.get("warnings") or []) if str(item).strip()]
    telemetry = preview_json.get("telemetry")
    if not isinstance(telemetry, dict):
        telemetry = {}

    return TimelineBootstrapSessionResponse(
        session_id=session.id,
        ingestion_job_id=session.ingestion_job_id,
        status=session.status,
        timeline_name_suggested=session.timeline_name_suggested,
        summary_markdown=session.summary_markdown,
        candidate_counts={key: int(value) for key, value in candidate_counts.items()},
        warnings=warnings,
        partial=bool(preview_json.get("partial", False)),
        telemetry=telemetry,
        error_message=session.error_message,
        committed_timeline_id=session.committed_timeline_id,
        created_at=session.created_at.isoformat() if session.created_at else "",
        updated_at=session.updated_at.isoformat() if session.updated_at else "",
    )


@router.post("/transcript", response_model=IngestionResponse)
def ingest_transcript(payload: IngestionRequest, db: Session = Depends(get_db)):
    _ensure_phase_f_enabled()

    job = _create_ingestion_job(db, job_type="transcript", payload=payload.model_dump())
    db.commit()
    db.refresh(job)

    enqueue_or_run(
        dispatch_ingestion_job,
        job.job_type,
        str(job.id),
        payload.model_dump(),
        job_id=str(job.id),
    )
    db.expire_all()
    job = db.query(IngestionJob).filter(IngestionJob.id == job.id).first()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found after enqueue")

    return IngestionResponse(job_id=job.id, status=job.status, artifact_count=1 if job.status == "completed" else 0)


@router.post("/pdf-highlights", response_model=IngestionResponse)
def ingest_pdf_highlights(payload: IngestionRequest, db: Session = Depends(get_db)):
    _ensure_phase_f_enabled()

    job = _create_ingestion_job(db, job_type="pdf_highlights", payload=payload.model_dump())
    db.commit()
    db.refresh(job)

    enqueue_or_run(
        dispatch_ingestion_job,
        job.job_type,
        str(job.id),
        payload.model_dump(),
        job_id=str(job.id),
    )
    db.expire_all()
    job = db.query(IngestionJob).filter(IngestionJob.id == job.id).first()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found after enqueue")

    return IngestionResponse(job_id=job.id, status=job.status, artifact_count=1 if job.status == "completed" else 0)


@router.post("/text-to-timeline/preview", response_model=TimelinePreviewResponse)
def create_timeline_preview(payload: TimelinePreviewRequest, db: Session = Depends(get_db)):
    _ensure_bootstrap_enabled()
    _validate_content_limits(payload.content)

    if payload.start_year_hint is not None and payload.end_year_hint is not None:
        if payload.start_year_hint > payload.end_year_hint:
            raise HTTPException(status_code=422, detail="start_year_hint must be <= end_year_hint")

    payload_data = payload.model_dump()
    job = _create_ingestion_job(db, job_type="text_to_timeline_preview", payload=payload_data)

    session = TimelineBootstrapSession(
        ingestion_job_id=job.id,
        status="queued",
        timeline_name_suggested=payload.timeline_name_hint,
        preview_json=json.dumps({}),
        validation_json=json.dumps({"timeline": {}, "candidates": {}}),
        expires_at=datetime.utcnow() + timedelta(days=SESSION_TTL_DAYS),
    )
    db.add(session)
    db.flush()
    db.commit()
    db.refresh(job)
    db.refresh(session)

    queue_result = enqueue_or_run(
        dispatch_ingestion_job,
        job.job_type,
        str(job.id),
        payload_data,
        job_id=str(job.id),
    )
    db.expire_all()
    job = db.query(IngestionJob).filter(IngestionJob.id == job.id).first()
    session = db.query(TimelineBootstrapSession).filter(TimelineBootstrapSession.id == session.id).first()
    if job is None or session is None:
        raise HTTPException(status_code=404, detail="Job or session not found after enqueue")

    execution_mode = "queued"
    if queue_result.mode == "inline":
        execution_mode = "inline_dev"
    elif queue_result.mode == "inline_fallback":
        execution_mode = "inline_fallback"

    return TimelinePreviewResponse(
        job_id=job.id,
        session_id=session.id,
        status=session.status,
        execution_mode=execution_mode,
    )


@router.get("/text-to-timeline/sessions/{session_id}", response_model=TimelineBootstrapSessionResponse)
def get_timeline_preview_session(session_id: UUID, db: Session = Depends(get_db)):
    _ensure_bootstrap_enabled()

    session = db.query(TimelineBootstrapSession).filter(TimelineBootstrapSession.id == session_id).first()
    if session is None:
        raise HTTPException(status_code=404, detail="Preview session not found")

    return _serialize_session_response(db, session)


@router.get("/text-to-timeline/sessions/{session_id}/candidates", response_model=TimelineBootstrapCandidatesResponse)
def get_timeline_preview_candidates(
    session_id: UUID,
    entity_type: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    cursor: Optional[str] = Query(default=None),
    include_evidence: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    _ensure_bootstrap_enabled()

    session = db.query(TimelineBootstrapSession).filter(TimelineBootstrapSession.id == session_id).first()
    if session is None:
        raise HTTPException(status_code=404, detail="Preview session not found")

    if entity_type and entity_type not in {"thinkers", "events", "connections", "publications", "quotes"}:
        raise HTTPException(status_code=422, detail="Invalid entity_type")

    offset = 0
    if cursor:
        try:
            offset = int(cursor)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid cursor")

    query = db.query(TimelineBootstrapCandidate).filter(TimelineBootstrapCandidate.session_id == session_id)
    if entity_type:
        query = query.filter(TimelineBootstrapCandidate.entity_type == entity_type)

    query = query.order_by(TimelineBootstrapCandidate.sort_key.asc(), TimelineBootstrapCandidate.created_at.asc())

    total = query.count()
    rows = query.offset(offset).limit(limit + 1).all()
    has_more = len(rows) > limit
    page_rows = rows[:limit]
    next_cursor = str(offset + limit) if has_more else None

    items: list[TimelineBootstrapCandidateItem] = []
    for row in page_rows:
        payload = _json_loads(row.payload_json, {})
        payload.setdefault("candidate_id", row.candidate_id)
        payload.setdefault("dependency_keys", _json_loads(row.dependency_keys_json, []))
        payload.setdefault("sort_key", row.sort_key)
        payload["entity_type"] = row.entity_type

        if include_evidence:
            payload["evidence"] = [
                {
                    "source_artifact_id": ev.source_artifact_id,
                    "chunk_index": ev.chunk_index,
                    "char_start": ev.char_start,
                    "char_end": ev.char_end,
                    "excerpt": ev.excerpt,
                }
                for ev in row.evidence_rows
            ]
        else:
            payload["evidence"] = []

        items.append(TimelineBootstrapCandidateItem(**payload))

    return TimelineBootstrapCandidatesResponse(
        items=items,
        next_cursor=next_cursor,
        has_more=has_more,
        total=total,
    )


@router.put("/text-to-timeline/sessions/{session_id}/validation", response_model=TimelineBootstrapValidationResponse)
def update_timeline_preview_validation(
    session_id: UUID,
    payload: TimelineBootstrapValidationRequest,
    db: Session = Depends(get_db),
):
    _ensure_bootstrap_enabled()

    session = db.query(TimelineBootstrapSession).filter(TimelineBootstrapSession.id == session_id).first()
    if session is None:
        raise HTTPException(status_code=404, detail="Preview session not found")

    if session.status in {"committing", "committed", "expired"}:
        raise HTTPException(status_code=409, detail=f"Cannot modify validation for session in status '{session.status}'")

    validation_json = _json_loads(session.validation_json, {"timeline": {}, "candidates": {}})
    validation_json.setdefault("timeline", {})
    validation_json.setdefault("candidates", {})

    if payload.timeline is not None:
        timeline_patch = payload.timeline.model_dump(exclude_none=True)
        validation_json["timeline"].update(timeline_patch)

    for update in payload.candidates:
        key = f"{update.entity_type}:{update.candidate_id}"
        current = validation_json["candidates"].get(key, {})
        patch = update.model_dump(exclude_none=True)
        patch.pop("entity_type", None)
        patch.pop("candidate_id", None)
        if "matched_thinker_id" in patch and patch["matched_thinker_id"] is not None:
            patch["matched_thinker_id"] = str(patch["matched_thinker_id"])
        current.update(patch)
        validation_json["candidates"][key] = current

    session.validation_json = json.dumps(validation_json)

    session_graph = load_session_graph(db, session, include_evidence=False)
    hydrated_graph = apply_validation(session_graph, validation_json)
    diagnostics_raw = validate_graph(hydrated_graph)

    db.commit()
    db.refresh(session)

    return TimelineBootstrapValidationResponse(
        validation_json=validation_json,
        diagnostics=diagnostics_raw,
    )


@router.post("/text-to-timeline/sessions/{session_id}/commit", response_model=TimelineBootstrapCommitResponse)
def commit_timeline_preview(
    session_id: UUID,
    payload: TimelineBootstrapCommitRequest,
    db: Session = Depends(get_db),
):
    _ensure_bootstrap_enabled()

    session = db.query(TimelineBootstrapSession).filter(TimelineBootstrapSession.id == session_id).first()
    if session is None:
        raise HTTPException(status_code=404, detail="Preview session not found")

    if session.status == "committed":
        audit = (
            db.query(TimelineBootstrapCommitAudit)
            .filter(TimelineBootstrapCommitAudit.session_id == session.id)
            .order_by(TimelineBootstrapCommitAudit.created_at.desc())
            .first()
        )
        if audit is None or session.committed_timeline_id is None:
            raise HTTPException(status_code=409, detail="Session marked committed but audit data is missing")

        return TimelineBootstrapCommitResponse(
            timeline_id=session.committed_timeline_id,
            audit_id=audit.id,
            created_counts=_json_loads(audit.created_counts_json, {}),
            skipped_counts=_json_loads(audit.skipped_counts_json, {}),
            warnings=_json_loads(audit.warnings_json, []),
        )

    if session.status == "committing":
        raise HTTPException(status_code=409, detail="Session is currently committing. Retry shortly.")

    update_count = (
        db.query(TimelineBootstrapSession)
        .filter(
            TimelineBootstrapSession.id == session.id,
            TimelineBootstrapSession.status.in_(["ready_for_review", "ready_for_review_partial"]),
        )
        .update({
            TimelineBootstrapSession.status: "committing",
            TimelineBootstrapSession.error_message: None,
        }, synchronize_session=False)
    )
    db.flush()

    if update_count == 0:
        db.refresh(session)
        if session.status == "committed":
            return commit_timeline_preview(session_id=session_id, payload=payload, db=db)
        raise HTTPException(status_code=409, detail=f"Session cannot be committed from status '{session.status}'")

    session = db.query(TimelineBootstrapSession).filter(TimelineBootstrapSession.id == session_id).first()
    if session is None:
        raise HTTPException(status_code=404, detail="Preview session not found")

    try:
        session_graph = load_session_graph(db, session, include_evidence=False)
        validation_json = _json_loads(session.validation_json, {"timeline": {}, "candidates": {}})

        commit_result = run_commit(
            db,
            session=session,
            session_graph=session_graph,
            validation_json=validation_json,
            force_skip_invalid=payload.force_skip_invalid,
            commit_message=payload.commit_message,
            committed_by=None,
        )

        session.status = "committed"
        session.error_message = None
        db.commit()
        db.refresh(session)

        return TimelineBootstrapCommitResponse(
            timeline_id=UUID(commit_result["timeline_id"]),
            audit_id=UUID(commit_result["audit_id"]),
            created_counts=commit_result["created_counts"],
            skipped_counts=commit_result["skipped_counts"],
            warnings=commit_result["warnings"],
        )
    except Exception as error:
        db.rollback()
        fallback_session = db.query(TimelineBootstrapSession).filter(TimelineBootstrapSession.id == session_id).first()
        if fallback_session is not None:
            preview = _json_loads(fallback_session.preview_json, {})
            fallback_session.status = "ready_for_review_partial" if preview.get("partial") else "ready_for_review"
            fallback_session.error_message = str(error)
            db.commit()
        raise HTTPException(status_code=422, detail=str(error))


@router.get("/text-to-timeline/sessions/{session_id}/audit", response_model=TimelineBootstrapAuditResponse)
def get_timeline_preview_audit(session_id: UUID, db: Session = Depends(get_db)):
    _ensure_bootstrap_enabled()

    session = db.query(TimelineBootstrapSession).filter(TimelineBootstrapSession.id == session_id).first()
    if session is None:
        raise HTTPException(status_code=404, detail="Preview session not found")

    audit = (
        db.query(TimelineBootstrapCommitAudit)
        .filter(TimelineBootstrapCommitAudit.session_id == session.id)
        .order_by(TimelineBootstrapCommitAudit.created_at.desc())
        .first()
    )
    if audit is None:
        raise HTTPException(status_code=404, detail="No commit audit found for this session")

    return TimelineBootstrapAuditResponse(
        audit_id=audit.id,
        session_id=session.id,
        created_counts=_json_loads(audit.created_counts_json, {}),
        skipped_counts=_json_loads(audit.skipped_counts_json, {}),
        warnings=_json_loads(audit.warnings_json, []),
        id_mappings=_json_loads(audit.id_mappings_json, {}),
        committed_by=audit.committed_by,
        created_at=audit.created_at.isoformat() if audit.created_at else "",
    )
