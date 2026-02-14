import copy
import os
from typing import Any, Dict, List, Optional, Set, Tuple

CONNECTION_TYPE_ALIASES = {
    "influenced": "influenced",
    "influence": "influenced",
    "inspired": "influenced",
    "critiqued": "critiqued",
    "criticized": "critiqued",
    "criticised": "critiqued",
    "built_upon": "built_upon",
    "built upon": "built_upon",
    "extended": "built_upon",
    "developed": "built_upon",
    "synthesized": "synthesized",
    "synthesised": "synthesized",
    "combined": "synthesized",
}

EVENT_TYPE_ALIASES = {
    "council": "council",
    "publication": "publication",
    "war": "war",
    "invention": "invention",
    "cultural": "cultural",
    "political": "political",
    "other": "other",
    "treaty": "political",
    "movement": "cultural",
}

PUBLICATION_TYPE_ALIASES = {
    "book": "book",
    "article": "article",
    "chapter": "chapter",
    "thesis": "thesis",
    "conference": "conference",
    "report": "report",
    "other": "other",
}


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


STRICT_RELATION_GATE = _env_bool("TIMELINE_BOOTSTRAP_STRICT_RELATION_GATE", True)
RELATION_GATE_MIN_THINKERS = int(os.getenv("TIMELINE_BOOTSTRAP_RELATION_GATE_MIN_THINKERS", "4"))
SPARSE_COVERAGE_MIN_THINKERS = int(os.getenv("TIMELINE_BOOTSTRAP_SPARSE_COVERAGE_MIN_THINKERS", "6"))
STRICT_EVIDENCE_GATE = _env_bool("TIMELINE_BOOTSTRAP_STRICT_EVIDENCE_GATE", True)


def normalize_connection_type(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    key = str(value).strip().lower().replace("-", "_")
    return CONNECTION_TYPE_ALIASES.get(key, CONNECTION_TYPE_ALIASES.get(key.replace("_", " ")))


def normalize_event_type(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    key = str(value).strip().lower().replace("-", "_")
    return EVENT_TYPE_ALIASES.get(key)


def normalize_publication_type(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    key = str(value).strip().lower().replace("-", "_")
    return PUBLICATION_TYPE_ALIASES.get(key)


def _candidate_key(entity_type: str, candidate_id: str) -> str:
    return f"{entity_type}:{candidate_id}"


def apply_validation(graph: Dict[str, Any], validation_json: Dict[str, Any]) -> Dict[str, Any]:
    hydrated = copy.deepcopy(graph)
    timeline_update = (validation_json or {}).get("timeline") or {}
    if isinstance(timeline_update, dict):
        hydrated.setdefault("timeline_candidate", {}).update({
            "name": timeline_update.get("name", hydrated.get("timeline_candidate", {}).get("name")),
            "description": timeline_update.get("description", hydrated.get("timeline_candidate", {}).get("description")),
            "start_year": timeline_update.get("start_year", hydrated.get("timeline_candidate", {}).get("start_year")),
            "end_year": timeline_update.get("end_year", hydrated.get("timeline_candidate", {}).get("end_year")),
        })

    candidate_updates = (validation_json or {}).get("candidates") or {}
    if not isinstance(candidate_updates, dict):
        candidate_updates = {}

    for entity_type in ["thinkers", "events", "connections", "publications", "quotes"]:
        updated_rows = []
        for row in hydrated.get(entity_type, []) or []:
            candidate_id = row.get("candidate_id")
            if not candidate_id:
                updated_rows.append(row)
                continue

            key = _candidate_key(entity_type, candidate_id)
            update = candidate_updates.get(key)
            if not isinstance(update, dict):
                updated_rows.append(row)
                continue

            if "include" in update:
                row["include"] = bool(update.get("include"))

            if isinstance(update.get("fields"), dict):
                row_fields = row.get("fields", {}) or {}
                row_fields.update(update.get("fields") or {})
                row["fields"] = row_fields

            if entity_type == "thinkers":
                action = str(update.get("match_action", "")).strip().lower()
                if action in {"reuse", "create"}:
                    row["thinker_resolution"] = action
                if update.get("matched_thinker_id"):
                    row["matched_thinker_id"] = str(update.get("matched_thinker_id"))

            updated_rows.append(row)

        hydrated[entity_type] = updated_rows

    return hydrated


def _diag(
    *,
    code: str,
    message: str,
    severity: str,
    entity_type: Optional[str] = None,
    candidate_id: Optional[str] = None,
) -> Dict[str, Any]:
    return {
        "code": code,
        "message": message,
        "severity": severity,
        "entity_type": entity_type,
        "candidate_id": candidate_id,
    }


def validate_graph(graph: Dict[str, Any]) -> Dict[str, Any]:
    blocking: List[Dict[str, Any]] = []
    non_blocking: List[Dict[str, Any]] = []

    timeline = graph.get("timeline_candidate", {}) or {}
    name = str(timeline.get("name", "")).strip()
    start_year = timeline.get("start_year")
    end_year = timeline.get("end_year")

    if not name:
        blocking.append(_diag(code="timeline_name_missing", message="Timeline name is required.", severity="blocking"))
    if start_year is not None and end_year is not None and start_year > end_year:
        blocking.append(
            _diag(
                code="timeline_year_range_invalid",
                message="Timeline start year must be less than or equal to end year.",
                severity="blocking",
            )
        )

    thinkers = graph.get("thinkers", []) or []
    thinker_lookup: Dict[str, Dict[str, Any]] = {row.get("candidate_id"): row for row in thinkers if row.get("candidate_id")}
    included_thinkers: Set[str] = {row["candidate_id"] for row in thinkers if row.get("include") and row.get("candidate_id")}

    for thinker in thinkers:
        candidate_id = thinker.get("candidate_id")
        if not candidate_id or not thinker.get("include"):
            continue

        fields = thinker.get("fields", {}) or {}
        thinker_name = str(fields.get("name", "")).strip()
        birth_year = fields.get("birth_year")
        death_year = fields.get("death_year")

        if not thinker_name:
            blocking.append(
                _diag(
                    code="thinker_name_missing",
                    message="Included thinker must have a name.",
                    severity="blocking",
                    entity_type="thinkers",
                    candidate_id=candidate_id,
                )
            )

        if birth_year is not None and death_year is not None and birth_year > death_year:
            blocking.append(
                _diag(
                    code="thinker_year_order_invalid",
                    message="Thinker birth year must be <= death year.",
                    severity="blocking",
                    entity_type="thinkers",
                    candidate_id=candidate_id,
                )
            )

        match_status = str(thinker.get("match_status") or "").strip().lower()
        resolution = str(thinker.get("thinker_resolution") or "").strip().lower()
        matched_id = thinker.get("matched_thinker_id")

        if match_status == "review_needed" and resolution not in {"reuse", "create"}:
            blocking.append(
                _diag(
                    code="thinker_match_decision_missing",
                    message="Ambiguous thinker match requires explicit reuse/create decision.",
                    severity="blocking",
                    entity_type="thinkers",
                    candidate_id=candidate_id,
                )
            )

        if resolution == "reuse" and not matched_id:
            blocking.append(
                _diag(
                    code="thinker_reuse_target_missing",
                    message="Reuse decision requires matched thinker id.",
                    severity="blocking",
                    entity_type="thinkers",
                    candidate_id=candidate_id,
                )
            )

    # Connection validation
    seen_pairs: Set[Tuple[str, str]] = set()
    for connection in graph.get("connections", []) or []:
        candidate_id = connection.get("candidate_id")
        if not candidate_id or not connection.get("include"):
            continue

        fields = connection.get("fields", {}) or {}
        from_id = fields.get("from_thinker_candidate_id")
        to_id = fields.get("to_thinker_candidate_id")
        normalized_type = normalize_connection_type(fields.get("connection_type"))

        if not from_id or not to_id:
            blocking.append(
                _diag(
                    code="connection_endpoints_missing",
                    message="Connection endpoints are required.",
                    severity="blocking",
                    entity_type="connections",
                    candidate_id=candidate_id,
                )
            )
            continue

        if from_id == to_id:
            blocking.append(
                _diag(
                    code="connection_self_loop",
                    message="Connection cannot point to the same thinker.",
                    severity="blocking",
                    entity_type="connections",
                    candidate_id=candidate_id,
                )
            )

        if from_id not in included_thinkers or to_id not in included_thinkers:
            blocking.append(
                _diag(
                    code="connection_missing_thinker_dependency",
                    message="Connection endpoints must resolve to included thinkers.",
                    severity="blocking",
                    entity_type="connections",
                    candidate_id=candidate_id,
                )
            )

        pair = (from_id, to_id)
        if pair in seen_pairs:
            blocking.append(
                _diag(
                    code="connection_duplicate_pair",
                    message="Only one connection per directional thinker pair is allowed.",
                    severity="blocking",
                    entity_type="connections",
                    candidate_id=candidate_id,
                )
            )
        seen_pairs.add(pair)

        if not normalized_type:
            blocking.append(
                _diag(
                    code="connection_type_invalid",
                    message="Connection type must map to allowed enum values.",
                    severity="blocking",
                    entity_type="connections",
                    candidate_id=candidate_id,
                )
            )
        else:
            fields["connection_type"] = normalized_type

    # Event validation
    for event in graph.get("events", []) or []:
        candidate_id = event.get("candidate_id")
        if not candidate_id or not event.get("include"):
            continue

        fields = event.get("fields", {}) or {}
        year = fields.get("year")
        event_type = normalize_event_type(fields.get("event_type"))

        if year is None or not isinstance(year, int):
            blocking.append(
                _diag(
                    code="event_year_invalid",
                    message="Event year must be an integer.",
                    severity="blocking",
                    entity_type="events",
                    candidate_id=candidate_id,
                )
            )

        if not event_type:
            blocking.append(
                _diag(
                    code="event_type_invalid",
                    message="Event type must map to an allowed value.",
                    severity="blocking",
                    entity_type="events",
                    candidate_id=candidate_id,
                )
            )
        else:
            fields["event_type"] = event_type

    # Publications
    for publication in graph.get("publications", []) or []:
        candidate_id = publication.get("candidate_id")
        if not candidate_id or not publication.get("include"):
            continue

        fields = publication.get("fields", {}) or {}
        thinker_candidate_id = fields.get("thinker_candidate_id")
        publication_type = normalize_publication_type(fields.get("publication_type"))

        if thinker_candidate_id not in included_thinkers:
            blocking.append(
                _diag(
                    code="publication_missing_thinker_dependency",
                    message="Publication must reference an included thinker.",
                    severity="blocking",
                    entity_type="publications",
                    candidate_id=candidate_id,
                )
            )

        if not publication_type:
            blocking.append(
                _diag(
                    code="publication_type_invalid",
                    message="Publication type must map to allowed values.",
                    severity="blocking",
                    entity_type="publications",
                    candidate_id=candidate_id,
                )
            )
        else:
            fields["publication_type"] = publication_type

    # Quotes
    for quote in graph.get("quotes", []) or []:
        candidate_id = quote.get("candidate_id")
        if not candidate_id or not quote.get("include"):
            continue

        fields = quote.get("fields", {}) or {}
        thinker_candidate_id = fields.get("thinker_candidate_id")
        text = str(fields.get("text", "")).strip()

        if thinker_candidate_id not in included_thinkers:
            blocking.append(
                _diag(
                    code="quote_missing_thinker_dependency",
                    message="Quote must reference an included thinker.",
                    severity="blocking",
                    entity_type="quotes",
                    candidate_id=candidate_id,
                )
            )

        if not text:
            blocking.append(
                _diag(
                    code="quote_text_missing",
                    message="Quote text cannot be empty.",
                    severity="blocking",
                    entity_type="quotes",
                    candidate_id=candidate_id,
                )
            )

    # Evidence-grounding gate
    for entity_type in ["thinkers", "events", "connections", "publications", "quotes"]:
        for row in graph.get(entity_type, []) or []:
            candidate_id = row.get("candidate_id")
            if not candidate_id or not row.get("include"):
                continue

            evidence = row.get("evidence") or []
            has_evidence = isinstance(evidence, list) and any(
                isinstance(ev, dict) and str(ev.get("excerpt", "")).strip() for ev in evidence
            )
            if has_evidence:
                continue

            diag = _diag(
                code="candidate_evidence_missing",
                message="Included candidate must contain at least one grounded evidence span.",
                severity="blocking" if STRICT_EVIDENCE_GATE else "warning",
                entity_type=entity_type,
                candidate_id=candidate_id,
            )
            if STRICT_EVIDENCE_GATE:
                blocking.append(diag)
            else:
                non_blocking.append(diag)

    included_connections = [row for row in (graph.get("connections", []) or []) if row.get("include")]
    included_events = [row for row in (graph.get("events", []) or []) if row.get("include")]
    included_publications = [row for row in (graph.get("publications", []) or []) if row.get("include")]
    included_quotes = [row for row in (graph.get("quotes", []) or []) if row.get("include")]

    if len(included_thinkers) >= RELATION_GATE_MIN_THINKERS and len(included_connections) == 0:
        relation_diag = _diag(
            code="relationship_signal_low",
            message=(
                "No included thinker-to-thinker connections were extracted for a multi-thinker timeline. "
                "Review extraction, rerun preview, or add relationships before committing."
            ),
            severity="blocking" if STRICT_RELATION_GATE else "warning",
        )
        if STRICT_RELATION_GATE:
            blocking.append(relation_diag)
        else:
            non_blocking.append(relation_diag)

    if (
        len(included_thinkers) >= SPARSE_COVERAGE_MIN_THINKERS
        and len(included_events) <= 1
        and len(included_publications) == 0
        and len(included_quotes) <= 1
    ):
        coverage_diag = _diag(
            code="extraction_coverage_sparse",
            message=(
                "Entity coverage looks sparse for a multi-thinker text (few events/publications/quotes). "
                "Review candidates before commit."
            ),
            severity="warning",
        )
        non_blocking.append(coverage_diag)

    # Non-blocking diagnostics
    for warning in graph.get("warnings", []) or []:
        non_blocking.append(
            _diag(
                code="extraction_warning",
                message=str(warning),
                severity="warning",
            )
        )

    return {
        "blocking": blocking,
        "non_blocking": non_blocking,
        "has_blocking": len(blocking) > 0,
    }
