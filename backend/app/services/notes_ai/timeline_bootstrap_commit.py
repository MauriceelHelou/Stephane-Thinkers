import json
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.models.connection import Connection, ConnectionType
from app.models.notes_ai import TimelineBootstrapCommitAudit, TimelineBootstrapSession
from app.models.publication import Publication
from app.models.quote import Quote
from app.models.thinker import Thinker
from app.models.timeline import Timeline
from app.models.timeline_event import TimelineEvent


def _increment(counter: Dict[str, int], key: str, by: int = 1) -> None:
    counter[key] = int(counter.get(key, 0)) + by


def commit_validated_session(
    db: Session,
    *,
    session: TimelineBootstrapSession,
    graph: Dict[str, Any],
    force_skip_invalid: bool,
    commit_message: Optional[str],
    committed_by: Optional[str] = None,
) -> Dict[str, Any]:
    created_counts: Dict[str, int] = {
        "timeline": 0,
        "thinkers_created": 0,
        "thinkers_reused": 0,
        "events": 0,
        "connections": 0,
        "publications": 0,
        "quotes": 0,
    }
    skipped_counts: Dict[str, int] = {
        "thinkers": 0,
        "events": 0,
        "connections": 0,
        "publications": 0,
        "quotes": 0,
    }
    warnings: list[str] = []
    id_mappings: Dict[str, str] = {}

    timeline_payload = graph.get("timeline_candidate", {}) or {}
    timeline = Timeline(
        name=str(timeline_payload.get("name") or "Imported Timeline").strip(),
        description=timeline_payload.get("description"),
        start_year=timeline_payload.get("start_year"),
        end_year=timeline_payload.get("end_year"),
    )
    db.add(timeline)
    db.flush()
    created_counts["timeline"] = 1

    thinker_id_map: Dict[str, str] = {}

    # 1) Thinkers
    for thinker in graph.get("thinkers", []) or []:
        candidate_id = thinker.get("candidate_id")
        if not candidate_id or not thinker.get("include"):
            continue

        fields = thinker.get("fields", {}) or {}
        resolution = str(thinker.get("thinker_resolution") or "").strip().lower()
        if not resolution:
            if str(thinker.get("match_status", "")).strip().lower() == "reuse_high_confidence":
                resolution = "reuse"
            else:
                resolution = "create"

        matched_id = thinker.get("matched_thinker_id")

        def _skip_or_raise(reason: str) -> bool:
            if force_skip_invalid:
                _increment(skipped_counts, "thinkers")
                warnings.append(reason)
                return True
            raise ValueError(reason)

        if resolution == "reuse":
            if not matched_id:
                if _skip_or_raise(f"Skipped thinker {candidate_id}: reuse selected but matched thinker id is missing."):
                    continue

            existing = db.query(Thinker).filter(Thinker.id == matched_id).first()
            if not existing:
                if _skip_or_raise(f"Skipped thinker {candidate_id}: matched thinker {matched_id} not found."):
                    continue

            if existing.timeline_id is None:
                existing.timeline_id = timeline.id
                thinker_id_map[candidate_id] = str(existing.id)
                id_mappings[candidate_id] = str(existing.id)
                _increment(created_counts, "thinkers_reused")
                continue

            if str(existing.timeline_id) == str(timeline.id):
                thinker_id_map[candidate_id] = str(existing.id)
                id_mappings[candidate_id] = str(existing.id)
                _increment(created_counts, "thinkers_reused")
                continue

            # Current schema stores one timeline FK on thinker. To avoid moving thinkers between timelines,
            # clone metadata into this timeline when a cross-timeline reuse conflict is detected.
            clone = Thinker(
                name=existing.name,
                birth_year=existing.birth_year,
                death_year=existing.death_year,
                active_period=existing.active_period,
                field=existing.field,
                biography_notes=existing.biography_notes,
                timeline_id=timeline.id,
                anchor_year=existing.anchor_year,
                position_x=existing.position_x,
                position_y=existing.position_y,
                is_manually_positioned=False,
            )
            db.add(clone)
            db.flush()
            thinker_id_map[candidate_id] = str(clone.id)
            id_mappings[candidate_id] = str(clone.id)
            _increment(created_counts, "thinkers_created")
            warnings.append(
                f"Thinker {existing.name} was matched to existing record {existing.id} on another timeline; cloned metadata for this timeline."
            )
            continue

        name = str(fields.get("name", "")).strip()
        if not name:
            if _skip_or_raise(f"Skipped thinker {candidate_id}: missing name."):
                continue

        new_thinker = Thinker(
            name=name,
            birth_year=fields.get("birth_year"),
            death_year=fields.get("death_year"),
            active_period=fields.get("active_period"),
            field=fields.get("field"),
            biography_notes=fields.get("biography_notes"),
            timeline_id=timeline.id,
            anchor_year=fields.get("anchor_year"),
            position_x=fields.get("position_x"),
            position_y=fields.get("position_y"),
            is_manually_positioned=False,
        )
        db.add(new_thinker)
        db.flush()
        thinker_id_map[candidate_id] = str(new_thinker.id)
        id_mappings[candidate_id] = str(new_thinker.id)
        _increment(created_counts, "thinkers_created")

    # 2) Events
    for event in graph.get("events", []) or []:
        candidate_id = event.get("candidate_id")
        if not candidate_id or not event.get("include"):
            continue

        fields = event.get("fields", {}) or {}
        year = fields.get("year")
        event_name = str(fields.get("name", "")).strip()

        if not isinstance(year, int) or not event_name:
            if force_skip_invalid:
                _increment(skipped_counts, "events")
                warnings.append(f"Skipped event {candidate_id}: invalid name/year.")
                continue
            raise ValueError(f"Invalid event candidate {candidate_id}")

        db_event = TimelineEvent(
            timeline_id=timeline.id,
            name=event_name,
            year=year,
            event_type=fields.get("event_type") or "other",
            description=fields.get("description"),
        )
        db.add(db_event)
        db.flush()
        id_mappings[candidate_id] = str(db_event.id)
        _increment(created_counts, "events")

    # 3) Connections (dedupe by directional endpoint pair)
    seen_pairs: set[tuple[str, str]] = set()
    for connection in graph.get("connections", []) or []:
        candidate_id = connection.get("candidate_id")
        if not candidate_id or not connection.get("include"):
            continue

        fields = connection.get("fields", {}) or {}
        from_candidate = fields.get("from_thinker_candidate_id")
        to_candidate = fields.get("to_thinker_candidate_id")
        from_thinker_id = thinker_id_map.get(from_candidate)
        to_thinker_id = thinker_id_map.get(to_candidate)

        if not from_thinker_id or not to_thinker_id:
            if force_skip_invalid:
                _increment(skipped_counts, "connections")
                warnings.append(f"Skipped connection {candidate_id}: unresolved thinker endpoints.")
                continue
            raise ValueError(f"Connection {candidate_id} has unresolved endpoints")

        if from_thinker_id == to_thinker_id:
            if force_skip_invalid:
                _increment(skipped_counts, "connections")
                warnings.append(f"Skipped connection {candidate_id}: self-loop not allowed.")
                continue
            raise ValueError(f"Connection {candidate_id} is self-loop")

        pair = (from_thinker_id, to_thinker_id)
        if pair in seen_pairs:
            if force_skip_invalid:
                _increment(skipped_counts, "connections")
                warnings.append(f"Skipped connection {candidate_id}: duplicate directional pair in commit payload.")
                continue
            raise ValueError(f"Duplicate connection pair for candidate {candidate_id}")

        seen_pairs.add(pair)

        existing = (
            db.query(Connection)
            .filter(Connection.from_thinker_id == from_thinker_id, Connection.to_thinker_id == to_thinker_id)
            .first()
        )
        if existing:
            _increment(skipped_counts, "connections")
            warnings.append(
                f"Skipped connection {candidate_id}: canonical pair already exists ({existing.id})."
            )
            continue

        raw_type = str(fields.get("connection_type") or "influenced")
        try:
            normalized_type = ConnectionType(raw_type)
        except ValueError:
            if force_skip_invalid:
                _increment(skipped_counts, "connections")
                warnings.append(f"Skipped connection {candidate_id}: invalid connection type '{raw_type}'.")
                continue
            raise

        db_connection = Connection(
            from_thinker_id=from_thinker_id,
            to_thinker_id=to_thinker_id,
            connection_type=normalized_type,
            name=fields.get("name"),
            notes=fields.get("notes"),
            bidirectional=bool(fields.get("bidirectional", False)),
            strength=fields.get("strength"),
        )
        db.add(db_connection)
        db.flush()
        id_mappings[candidate_id] = str(db_connection.id)
        _increment(created_counts, "connections")

    # 4) Publications
    for publication in graph.get("publications", []) or []:
        candidate_id = publication.get("candidate_id")
        if not candidate_id or not publication.get("include"):
            continue

        fields = publication.get("fields", {}) or {}
        thinker_candidate_id = fields.get("thinker_candidate_id")
        thinker_id = thinker_id_map.get(thinker_candidate_id)

        if not thinker_id:
            if force_skip_invalid:
                _increment(skipped_counts, "publications")
                warnings.append(f"Skipped publication {candidate_id}: unresolved thinker dependency.")
                continue
            raise ValueError(f"Publication {candidate_id} has unresolved thinker dependency")

        title = str(fields.get("title", "")).strip()
        if not title:
            if force_skip_invalid:
                _increment(skipped_counts, "publications")
                warnings.append(f"Skipped publication {candidate_id}: missing title.")
                continue
            raise ValueError(f"Publication {candidate_id} missing title")

        db_publication = Publication(
            thinker_id=thinker_id,
            title=title,
            year=fields.get("year"),
            citation=fields.get("citation"),
            notes=fields.get("notes"),
            publication_type=fields.get("publication_type") or "other",
        )
        db.add(db_publication)
        db.flush()
        id_mappings[candidate_id] = str(db_publication.id)
        _increment(created_counts, "publications")

    # 5) Quotes
    for quote in graph.get("quotes", []) or []:
        candidate_id = quote.get("candidate_id")
        if not candidate_id or not quote.get("include"):
            continue

        fields = quote.get("fields", {}) or {}
        thinker_candidate_id = fields.get("thinker_candidate_id")
        thinker_id = thinker_id_map.get(thinker_candidate_id)

        if not thinker_id:
            if force_skip_invalid:
                _increment(skipped_counts, "quotes")
                warnings.append(f"Skipped quote {candidate_id}: unresolved thinker dependency.")
                continue
            raise ValueError(f"Quote {candidate_id} has unresolved thinker dependency")

        quote_text = str(fields.get("text", "")).strip()
        if not quote_text:
            if force_skip_invalid:
                _increment(skipped_counts, "quotes")
                warnings.append(f"Skipped quote {candidate_id}: empty text.")
                continue
            raise ValueError(f"Quote {candidate_id} is empty")

        db_quote = Quote(
            thinker_id=thinker_id,
            text=quote_text,
            source=fields.get("source"),
            year=fields.get("year"),
            context_notes=fields.get("context_notes"),
        )
        db.add(db_quote)
        db.flush()
        id_mappings[candidate_id] = str(db_quote.id)
        _increment(created_counts, "quotes")

    if commit_message:
        warnings.append(f"Commit note: {commit_message}")

    audit = TimelineBootstrapCommitAudit(
        session_id=session.id,
        created_counts_json=json.dumps(created_counts),
        skipped_counts_json=json.dumps(skipped_counts),
        warnings_json=json.dumps(warnings),
        id_mappings_json=json.dumps(id_mappings),
        committed_by=committed_by,
    )
    db.add(audit)
    db.flush()

    session.committed_timeline_id = timeline.id
    session.error_message = None

    return {
        "timeline_id": str(timeline.id),
        "audit_id": str(audit.id),
        "created_counts": created_counts,
        "skipped_counts": skipped_counts,
        "warnings": warnings,
        "id_mappings": id_mappings,
    }
