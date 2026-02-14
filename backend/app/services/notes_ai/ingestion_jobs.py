import json
import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.notes_ai import (
    INGESTION_JOB_TYPES,
    IngestionJob,
    SourceArtifact,
    TimelineBootstrapCandidate,
    TimelineBootstrapCandidateEvidence,
    TimelineBootstrapSession,
)
from app.services.notes_ai.timeline_bootstrap_chunking import chunk_text, should_use_full_context
from app.services.notes_ai.timeline_bootstrap_commit import commit_validated_session
from app.services.notes_ai.timeline_bootstrap_extract import (
    extract_chunk_entities,
    extract_full_text_entities,
    extract_relation_salvage_entities,
)
from app.services.notes_ai.timeline_bootstrap_merge import merge_extraction_outputs
from app.services.notes_ai.timeline_bootstrap_summary import build_preview_summary
from app.services.notes_ai.timeline_bootstrap_thinker_enrichment import enrich_thinker_years
from app.services.notes_ai.timeline_bootstrap_thinker_matcher import apply_thinker_matching
from app.services.notes_ai.timeline_bootstrap_validation import apply_validation, validate_graph
from app.utils.ai_service import estimate_token_count

PREVIEW_ENTITY_TYPES = ("thinkers", "events", "connections", "publications", "quotes")
SESSION_TTL_DAYS = int(os.getenv("TIMELINE_BOOTSTRAP_SESSION_TTL_DAYS", "30"))
SESSION_SOFT_TOKEN_BUDGET = int(os.getenv("TIMELINE_BOOTSTRAP_SOFT_TOKEN_BUDGET", "90000"))
RELATION_RECOVERY_MIN_THINKERS = int(os.getenv("TIMELINE_BOOTSTRAP_RELATION_RECOVERY_MIN_THINKERS", "4"))


class TimelineBootstrapError(RuntimeError):
    pass


def _json_dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def _json_loads(value: Optional[str], default: Any) -> Any:
    if value is None:
        return default
    try:
        return json.loads(value)
    except Exception:
        return default


def _parse_job_id(job_id: str) -> UUID:
    return UUID(str(job_id))


def _get_or_create_session(db: Session, job: IngestionJob) -> TimelineBootstrapSession:
    session = (
        db.query(TimelineBootstrapSession)
        .filter(TimelineBootstrapSession.ingestion_job_id == job.id)
        .order_by(TimelineBootstrapSession.created_at.desc())
        .first()
    )
    if session is not None:
        return session

    session = TimelineBootstrapSession(
        ingestion_job_id=job.id,
        status="queued",
        preview_json=_json_dumps({}),
        validation_json=_json_dumps({"timeline": {}, "candidates": {}}),
        expires_at=datetime.utcnow() + timedelta(days=SESSION_TTL_DAYS),
    )
    db.add(session)
    db.flush()
    return session


def _hydrate_candidate_payload(row: TimelineBootstrapCandidate, include_evidence: bool = True) -> Dict[str, Any]:
    payload = _json_loads(row.payload_json, {})
    payload.setdefault("candidate_id", row.candidate_id)
    payload.setdefault("dependency_keys", _json_loads(row.dependency_keys_json, []))
    payload.setdefault("sort_key", row.sort_key)
    if include_evidence:
        payload["evidence"] = [
            {
                "chunk_index": evidence.chunk_index,
                "char_start": evidence.char_start,
                "char_end": evidence.char_end,
                "excerpt": evidence.excerpt,
                "source_artifact_id": str(evidence.source_artifact_id),
            }
            for evidence in row.evidence_rows
        ]
    return payload


def load_session_graph(db: Session, session: TimelineBootstrapSession, *, include_evidence: bool = True) -> Dict[str, Any]:
    preview = _json_loads(session.preview_json, {})

    graph: Dict[str, Any] = {
        "timeline_candidate": preview.get("timeline_candidate") or {},
        "summary": preview.get("summary") or {},
        "warnings": list(preview.get("warnings") or []),
        "thinkers": [],
        "events": [],
        "connections": [],
        "publications": [],
        "quotes": [],
    }

    rows = (
        db.query(TimelineBootstrapCandidate)
        .filter(TimelineBootstrapCandidate.session_id == session.id)
        .order_by(TimelineBootstrapCandidate.entity_type.asc(), TimelineBootstrapCandidate.sort_key.asc())
        .all()
    )

    for row in rows:
        if row.entity_type not in PREVIEW_ENTITY_TYPES:
            continue
        graph[row.entity_type].append(_hydrate_candidate_payload(row, include_evidence=include_evidence))

    return graph


def _persist_session_candidates(
    db: Session,
    *,
    session: TimelineBootstrapSession,
    source_artifact_id: UUID,
    graph: Dict[str, Any],
) -> None:
    existing = (
        db.query(TimelineBootstrapCandidate)
        .filter(TimelineBootstrapCandidate.session_id == session.id)
        .all()
    )
    for row in existing:
        db.delete(row)
    db.flush()

    for entity_type in PREVIEW_ENTITY_TYPES:
        for index, candidate in enumerate(graph.get(entity_type, []) or []):
            payload = dict(candidate)
            evidence = list(payload.pop("evidence", []) or [])
            dependency_keys = payload.get("dependency_keys", []) or []
            payload["dependency_keys"] = dependency_keys
            payload.setdefault("sort_key", payload.get("sort_key", index))

            row = TimelineBootstrapCandidate(
                session_id=session.id,
                entity_type=entity_type,
                candidate_id=str(payload.get("candidate_id")),
                payload_json=_json_dumps(payload),
                dependency_keys_json=_json_dumps(dependency_keys),
                sort_key=int(payload.get("sort_key", index)),
            )
            db.add(row)
            db.flush()

            for ev in evidence:
                if not isinstance(ev, dict):
                    continue
                evidence_row = TimelineBootstrapCandidateEvidence(
                    candidate_row_id=row.id,
                    source_artifact_id=source_artifact_id,
                    chunk_index=int(ev.get("chunk_index", 0)),
                    char_start=int(ev.get("char_start", 0)),
                    char_end=int(ev.get("char_end", 0)),
                    excerpt=str(ev.get("excerpt", ""))[:280],
                )
                db.add(evidence_row)

    db.flush()


def _default_preview(validation_graph: Dict[str, Any], partial: bool) -> Dict[str, Any]:
    warnings = list(validation_graph.get("warnings", []) or [])
    if partial:
        warnings.append("Preview was truncated due to token budget constraints.")

    return {
        "timeline_candidate": validation_graph.get("timeline_candidate") or {},
        "summary": validation_graph.get("summary") or {},
        "warnings": warnings,
        "partial": partial,
    }


def _candidate_count(graph: Dict[str, Any], key: str) -> int:
    rows = graph.get(key) or []
    if not isinstance(rows, list):
        return 0
    return len(rows)


def process_ingestion_job(job_id: str, file_name: str, file_type: str, content: str) -> Dict[str, object]:
    """
    Queue-safe worker for transcript/pdf artifact ingestion.
    """
    db = SessionLocal()
    try:
        parsed_job_id = _parse_job_id(job_id)
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
            metadata_json=_json_dumps({"length": len(content)}),
        )
        db.add(artifact)
        db.flush()

        job.status = "completed"
        job.result_json = _json_dumps({"artifact_count": 1, "file_type": file_type})
        db.commit()
        return {"status": "completed", "artifact_count": 1}
    except Exception as error:
        db.rollback()
        try:
            parsed_job_id = _parse_job_id(job_id)
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


def process_timeline_bootstrap(job_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    db = SessionLocal()
    try:
        parsed_job_id = _parse_job_id(job_id)
        job = db.query(IngestionJob).filter(IngestionJob.id == parsed_job_id).first()
        if job is None:
            return {"status": "failed", "error": "job not found"}

        session = _get_or_create_session(db, job)
        job.status = "running"
        session.status = "running"
        session.error_message = None
        db.flush()

        file_name = str(payload.get("file_name") or "source.txt")
        content = str(payload.get("content") or "")
        timeline_name_hint = payload.get("timeline_name_hint")
        start_year_hint = payload.get("start_year_hint")
        end_year_hint = payload.get("end_year_hint")

        artifact = SourceArtifact(
            job_id=job.id,
            file_name=file_name,
            file_type="text",
            raw_text=content,
            metadata_json=_json_dumps({"length": len(content), "estimated_tokens": estimate_token_count(content)}),
        )
        db.add(artifact)
        db.flush()

        session.source_artifact_id = artifact.id
        session.expires_at = datetime.utcnow() + timedelta(days=SESSION_TTL_DAYS)
        db.flush()

        chunking_result = chunk_text(content)
        extraction_outputs: List[Dict[str, Any]] = []
        session_warnings: List[str] = []
        projected_tokens = 0
        partial = False
        extraction_mode = "chunked"

        if should_use_full_context(chunking_result.total_token_estimate):
            extraction_mode = "full_context"
            db.refresh(job)
            if job.status == "cancelled":
                session.status = "failed"
                session.error_message = "Preview generation cancelled by user"
                db.commit()
                return {"status": "cancelled", "session_id": str(session.id)}
            projected_tokens = chunking_result.total_token_estimate
            extraction_outputs.append(extract_full_text_entities(chunking_result.normalized_text))
        else:
            for index, chunk in enumerate(chunking_result.chunks):
                if index == 0 or (index + 1) % 3 == 0:
                    db.refresh(job)
                    if job.status == "cancelled":
                        session.status = "failed"
                        session.error_message = "Preview generation cancelled by user"
                        db.commit()
                        return {"status": "cancelled", "session_id": str(session.id)}

                projected_tokens += chunk.token_estimate
                if projected_tokens > SESSION_SOFT_TOKEN_BUDGET:
                    partial = True
                    session_warnings.append(
                        f"Stopped extraction at chunk {index + 1} due to soft token budget ({SESSION_SOFT_TOKEN_BUDGET})."
                    )
                    break

                extraction_outputs.append(extract_chunk_entities(chunk))

        if chunking_result.truncated:
            partial = True
            session_warnings.append("Chunk count exceeded max limit; preview truncated.")

        relation_recovery_summary: Dict[str, Any] = {
            "triggered": False,
            "reason": None,
            "added_candidates": {"connections": 0, "events": 0, "publications": 0},
        }

        merged_graph = merge_extraction_outputs(
            extraction_outputs,
            timeline_name_hint=timeline_name_hint,
            start_year_hint=start_year_hint,
            end_year_hint=end_year_hint,
        )

        thinker_count = _candidate_count(merged_graph, "thinkers")
        connection_count = _candidate_count(merged_graph, "connections")
        if thinker_count >= RELATION_RECOVERY_MIN_THINKERS and connection_count == 0:
            relation_recovery_summary["reason"] = "no_connections_after_primary_extraction"
            thinker_names = [
                str(item.get("fields", {}).get("name", "")).strip()
                for item in (merged_graph.get("thinkers", []) or [])
                if str(item.get("fields", {}).get("name", "")).strip()
            ]
            relation_output = extract_relation_salvage_entities(
                chunking_result.normalized_text,
                thinker_names=thinker_names,
            )
            added_candidates = {
                "connections": len(relation_output.get("connections", []) or []),
                "events": len(relation_output.get("events", []) or []),
                "publications": len(relation_output.get("publications", []) or []),
            }

            if any(value > 0 for value in added_candidates.values()):
                extraction_outputs.append(relation_output)
                merged_graph = merge_extraction_outputs(
                    extraction_outputs,
                    timeline_name_hint=timeline_name_hint,
                    start_year_hint=start_year_hint,
                    end_year_hint=end_year_hint,
                )
                relation_recovery_summary["triggered"] = True
                relation_recovery_summary["added_candidates"] = added_candidates
            else:
                relation_recovery_summary["reason"] = "recovery_attempted_no_additions"

        merged_graph["warnings"] = list(merged_graph.get("warnings", []) or []) + session_warnings
        if relation_recovery_summary["triggered"]:
            added = relation_recovery_summary["added_candidates"]
            merged_graph["warnings"].append(
                "Relation recovery pathway added candidates "
                f"(connections={added['connections']}, events={added['events']}, publications={added['publications']})."
            )
        elif relation_recovery_summary["reason"] == "recovery_attempted_no_additions":
            merged_graph["warnings"].append(
                "Relation recovery pathway ran but did not find additional relation candidates."
            )

        # Fill missing thinker years from model context before matcher scoring.
        merged_graph = enrich_thinker_years(merged_graph)
        merged_graph = apply_thinker_matching(db, merged_graph)

        summary_markdown = build_preview_summary(merged_graph, file_name)
        enrichment_summary = (merged_graph.get("summary") or {}).get("thinker_year_enrichment", {})

        preview_payload = _default_preview(merged_graph, partial)
        preview_payload["telemetry"] = {
            "chunk_count": len(chunking_result.chunks),
            "processed_chunks": len(extraction_outputs),
            "estimated_tokens": projected_tokens,
            "chunk_truncated": chunking_result.truncated,
            "extraction_mode": extraction_mode,
            "relation_recovery": relation_recovery_summary,
            "thinker_year_enrichment": enrichment_summary,
        }

        _persist_session_candidates(
            db,
            session=session,
            source_artifact_id=artifact.id,
            graph=merged_graph,
        )

        session.timeline_name_suggested = merged_graph.get("timeline_candidate", {}).get("name")
        session.summary_markdown = summary_markdown
        session.preview_json = _json_dumps(preview_payload)
        session.validation_json = _json_dumps({"timeline": {}, "candidates": {}})
        session.status = "ready_for_review_partial" if partial else "ready_for_review"
        session.error_message = None

        job.status = "completed"
        job.result_json = _json_dumps(
            {
                "session_id": str(session.id),
                "status": session.status,
                "candidate_counts": merged_graph.get("summary", {}).get("candidate_counts", {}),
            }
        )

        db.commit()
        return {"status": session.status, "session_id": str(session.id)}

    except Exception as error:
        db.rollback()
        try:
            parsed_job_id = _parse_job_id(job_id)
            failed_job = db.query(IngestionJob).filter(IngestionJob.id == parsed_job_id).first()
            if failed_job is not None:
                failed_job.status = "failed"
                failed_job.error_message = str(error)

            session = (
                db.query(TimelineBootstrapSession)
                .filter(TimelineBootstrapSession.ingestion_job_id == parsed_job_id)
                .order_by(TimelineBootstrapSession.created_at.desc())
                .first()
            )
            if session is not None:
                session.status = "failed"
                session.error_message = str(error)
            db.commit()
        except Exception:
            db.rollback()

        return {"status": "failed", "error": str(error)}
    finally:
        db.close()


def dispatch_ingestion_job(job_type: str, job_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    if job_type == "transcript":
        return process_ingestion_job(
            job_id=job_id,
            file_name=str(payload.get("file_name") or "transcript.txt"),
            file_type="transcript",
            content=str(payload.get("content") or ""),
        )

    if job_type == "pdf_highlights":
        return process_ingestion_job(
            job_id=job_id,
            file_name=str(payload.get("file_name") or "highlights.txt"),
            file_type="pdf",
            content=str(payload.get("content") or ""),
        )

    if job_type == "text_to_timeline_preview":
        return process_timeline_bootstrap(job_id=job_id, payload=payload)

    return {
        "status": "failed",
        "error": f"Unsupported ingestion job_type '{job_type}'. Allowed: {', '.join(INGESTION_JOB_TYPES)}",
    }


def prepare_graph_for_commit(session_graph: Dict[str, Any], validation_json: Dict[str, Any]) -> Dict[str, Any]:
    return apply_validation(session_graph, validation_json or {})


def run_commit(
    db: Session,
    *,
    session: TimelineBootstrapSession,
    session_graph: Dict[str, Any],
    validation_json: Dict[str, Any],
    force_skip_invalid: bool,
    commit_message: Optional[str],
    committed_by: Optional[str],
) -> Dict[str, Any]:
    hydrated_graph = prepare_graph_for_commit(session_graph, validation_json)
    diagnostics = validate_graph(hydrated_graph)
    if diagnostics["has_blocking"] and not force_skip_invalid:
        raise TimelineBootstrapError("Blocking validation errors must be resolved before commit")

    return commit_validated_session(
        db,
        session=session,
        graph=hydrated_graph,
        force_skip_invalid=force_skip_invalid,
        commit_message=commit_message,
        committed_by=committed_by,
    )
