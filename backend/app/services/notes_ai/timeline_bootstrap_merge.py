import hashlib
import re
from collections import defaultdict
from typing import Any, Dict, Iterable, List, Optional, Tuple


def _normalize_label(value: Optional[str]) -> str:
    text = (value or "").strip().lower()
    text = re.sub(r"[^a-z0-9\s]", "", text)
    text = re.sub(r"\s+", " ", text)
    return text


def _stable_candidate_id(prefix: str, key: str) -> str:
    digest = hashlib.sha1(key.encode("utf-8")).hexdigest()[:16]
    return f"{prefix}_{digest}"


def _dedupe_evidence(evidence: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    deduped: List[Dict[str, Any]] = []
    seen = set()
    for item in evidence:
        if not isinstance(item, dict):
            continue
        key = (
            item.get("chunk_index"),
            item.get("char_start"),
            item.get("char_end"),
            hashlib.sha1(str(item.get("excerpt", "")).encode("utf-8")).hexdigest(),
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(
            {
                "chunk_index": int(item.get("chunk_index", 0)),
                "char_start": int(item.get("char_start", 0)),
                "char_end": int(item.get("char_end", 0)),
                "excerpt": str(item.get("excerpt", ""))[:280],
            }
        )
    return deduped


def _aggregate_confidence(values: List[float]) -> float:
    if not values:
        return 0.5
    avg = sum(values) / max(1, len(values))
    return max(0.0, min(1.0, round(avg, 4)))


def _default_include(confidence: float) -> bool:
    return confidence >= 0.45


def _coerce_year(value: Any) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return None


def _tokenize_label(value: Optional[str]) -> List[str]:
    normalized = _normalize_label(value)
    if not normalized:
        return []
    return normalized.split()


def _build_thinker_alias_index(thinker_name_to_candidate_id: Dict[str, str]) -> Dict[str, str]:
    alias_to_candidates: Dict[str, set[str]] = defaultdict(set)
    for normalized_name, candidate_id in thinker_name_to_candidate_id.items():
        tokens = _tokenize_label(normalized_name)
        if len(tokens) < 2:
            continue

        # Common short references: surname and two-token surname (for e.g. "du bois").
        alias_to_candidates[tokens[-1]].add(candidate_id)
        alias_to_candidates[" ".join(tokens[-2:])].add(candidate_id)

    return {
        alias: next(iter(candidate_ids))
        for alias, candidate_ids in alias_to_candidates.items()
        if len(candidate_ids) == 1
    }


def _resolve_candidate_from_reference(
    reference_name: Optional[str],
    thinker_name_to_candidate_id: Dict[str, str],
    thinker_alias_to_candidate_id: Dict[str, str],
) -> Optional[str]:
    normalized_reference = _normalize_label(reference_name)
    if not normalized_reference:
        return None

    direct = thinker_name_to_candidate_id.get(normalized_reference)
    if direct:
        return direct

    alias = thinker_alias_to_candidate_id.get(normalized_reference)
    if alias:
        return alias

    substring_matches = {
        candidate_id
        for normalized_name, candidate_id in thinker_name_to_candidate_id.items()
        if normalized_reference in normalized_name or normalized_name in normalized_reference
    }
    if len(substring_matches) == 1:
        return next(iter(substring_matches))

    reference_tokens = set(_tokenize_label(normalized_reference))
    if not reference_tokens:
        return None

    token_matches = {
        candidate_id
        for normalized_name, candidate_id in thinker_name_to_candidate_id.items()
        if reference_tokens.issubset(set(_tokenize_label(normalized_name)))
    }
    if len(token_matches) == 1:
        return next(iter(token_matches))

    return None


def _collect_context_text(raw_item: Dict[str, Any]) -> str:
    parts: List[str] = []
    for key in ("context_notes", "source", "notes", "description", "text"):
        value = raw_item.get(key)
        if value:
            parts.append(str(value))

    for evidence in raw_item.get("evidence", []) or []:
        if not isinstance(evidence, dict):
            continue
        excerpt = evidence.get("excerpt")
        if excerpt:
            parts.append(str(excerpt))

    return " ".join(parts).strip()


def _resolve_candidate_from_context(
    context_text: str,
    thinker_name_to_candidate_id: Dict[str, str],
    thinker_alias_to_candidate_id: Dict[str, str],
) -> Optional[str]:
    normalized_context = _normalize_label(context_text)
    if not normalized_context:
        return None
    padded_context = f" {normalized_context} "

    full_name_hits = {
        candidate_id
        for normalized_name, candidate_id in thinker_name_to_candidate_id.items()
        if normalized_name and f" {normalized_name} " in padded_context
    }
    if len(full_name_hits) == 1:
        return next(iter(full_name_hits))

    alias_hits = {
        candidate_id
        for alias, candidate_id in thinker_alias_to_candidate_id.items()
        if alias and f" {alias} " in padded_context
    }
    if len(alias_hits) == 1:
        return next(iter(alias_hits))

    return None


def _distance_between_ranges(start_a: int, end_a: int, start_b: int, end_b: int) -> int:
    if end_a < start_b:
        return start_b - end_a
    if end_b < start_a:
        return start_a - end_b
    return 0


def _resolve_candidate_from_evidence_proximity(
    raw_item: Dict[str, Any],
    thinker_evidence_by_candidate: Dict[str, List[Dict[str, Any]]],
    *,
    max_distance_chars: int = 240,
) -> Optional[str]:
    item_evidence = [ev for ev in (raw_item.get("evidence") or []) if isinstance(ev, dict)]
    if not item_evidence:
        return None

    best_distance_by_candidate: Dict[str, int] = {}

    for item_ev in item_evidence:
        item_chunk = int(item_ev.get("chunk_index", 0))
        item_start = int(item_ev.get("char_start", 0))
        item_end = int(item_ev.get("char_end", item_start))

        for candidate_id, thinker_evidence in thinker_evidence_by_candidate.items():
            for thinker_ev in thinker_evidence:
                thinker_chunk = int(thinker_ev.get("chunk_index", 0))
                if thinker_chunk != item_chunk:
                    continue

                thinker_start = int(thinker_ev.get("char_start", 0))
                thinker_end = int(thinker_ev.get("char_end", thinker_start))
                distance = _distance_between_ranges(item_start, item_end, thinker_start, thinker_end)
                previous = best_distance_by_candidate.get(candidate_id)
                if previous is None or distance < previous:
                    best_distance_by_candidate[candidate_id] = distance

    if not best_distance_by_candidate:
        return None

    ranked = sorted(best_distance_by_candidate.items(), key=lambda item: item[1])
    best_candidate, best_distance = ranked[0]
    if best_distance > max_distance_chars:
        return None

    # Avoid arbitrary picks when multiple candidates are equally close.
    if len(ranked) > 1 and ranked[1][1] == best_distance:
        return None

    return best_candidate


def _resolve_thinker_candidate_id(
    reference_name: Optional[str],
    raw_item: Dict[str, Any],
    thinker_name_to_candidate_id: Dict[str, str],
    thinker_alias_to_candidate_id: Dict[str, str],
    thinker_evidence_by_candidate: Dict[str, List[Dict[str, Any]]],
) -> Optional[str]:
    by_reference = _resolve_candidate_from_reference(
        reference_name,
        thinker_name_to_candidate_id,
        thinker_alias_to_candidate_id,
    )
    if by_reference:
        return by_reference

    by_context = _resolve_candidate_from_context(
        _collect_context_text(raw_item),
        thinker_name_to_candidate_id,
        thinker_alias_to_candidate_id,
    )
    if by_context:
        return by_context

    return _resolve_candidate_from_evidence_proximity(raw_item, thinker_evidence_by_candidate)


def merge_extraction_outputs(
    extraction_outputs: List[Dict[str, Any]],
    *,
    timeline_name_hint: Optional[str] = None,
    start_year_hint: Optional[int] = None,
    end_year_hint: Optional[int] = None,
) -> Dict[str, Any]:
    warnings: List[str] = []

    thinker_bucket: Dict[str, Dict[str, Any]] = {}
    thinker_confidences: Dict[str, List[float]] = defaultdict(list)
    thinker_evidence: Dict[str, List[Dict[str, Any]]] = defaultdict(list)

    raw_connections: List[Dict[str, Any]] = []
    raw_events: List[Dict[str, Any]] = []
    raw_publications: List[Dict[str, Any]] = []
    raw_quotes: List[Dict[str, Any]] = []

    for output in extraction_outputs:
        warnings.extend([str(item) for item in output.get("warnings", []) if str(item).strip()])

        for thinker in output.get("thinkers", []) or []:
            if not isinstance(thinker, dict):
                continue
            name = str(thinker.get("name", "")).strip()
            if not name:
                continue
            name_key = _normalize_label(name)
            if not name_key:
                continue

            existing = thinker_bucket.get(name_key)
            if existing is None:
                thinker_bucket[name_key] = {
                    "name": name,
                    "birth_year": thinker.get("birth_year"),
                    "death_year": thinker.get("death_year"),
                    "active_period": thinker.get("active_period"),
                    "field": thinker.get("field"),
                    "biography_notes": thinker.get("biography_notes"),
                }
            else:
                for key in ["birth_year", "death_year", "active_period", "field", "biography_notes"]:
                    candidate_value = thinker.get(key)
                    if existing.get(key) is None and candidate_value is not None:
                        existing[key] = candidate_value

            thinker_confidences[name_key].append(float(thinker.get("confidence", 0.5)))
            thinker_evidence[name_key].extend(thinker.get("evidence", []) or [])

        for event in output.get("events", []) or []:
            if isinstance(event, dict):
                raw_events.append(event)

        for connection in output.get("connections", []) or []:
            if isinstance(connection, dict):
                raw_connections.append(connection)

        for publication in output.get("publications", []) or []:
            if isinstance(publication, dict):
                raw_publications.append(publication)

        for quote in output.get("quotes", []) or []:
            if isinstance(quote, dict):
                raw_quotes.append(quote)

    thinkers: List[Dict[str, Any]] = []
    thinker_name_to_candidate_id: Dict[str, str] = {}
    thinker_evidence_by_candidate: Dict[str, List[Dict[str, Any]]] = {}
    for idx, (name_key, payload) in enumerate(sorted(thinker_bucket.items(), key=lambda item: item[1]["name"].lower())):
        candidate_id = _stable_candidate_id("thinker", name_key)
        thinker_name_to_candidate_id[name_key] = candidate_id

        confidence = _aggregate_confidence(thinker_confidences[name_key])
        deduped_thinker_evidence = _dedupe_evidence(thinker_evidence[name_key])
        thinker_evidence_by_candidate[candidate_id] = deduped_thinker_evidence
        include_by_default = _default_include(confidence) and bool(deduped_thinker_evidence)
        thinkers.append(
            {
                "candidate_id": candidate_id,
                "confidence": confidence,
                "include": include_by_default,
                "fields": payload,
                "dependency_keys": [],
                "evidence": deduped_thinker_evidence,
                "match_status": "create_new",
                "matched_thinker_id": None,
                "match_score": 0.0,
                "match_reasons": [],
                "metadata_delta": {},
                "sort_key": idx,
            }
        )

    thinker_alias_to_candidate_id = _build_thinker_alias_index(thinker_name_to_candidate_id)

    events: List[Dict[str, Any]] = []
    event_bucket: Dict[Tuple[str, Optional[int]], Dict[str, Any]] = {}
    for raw_event in raw_events:
        name = str(raw_event.get("name", "")).strip()
        year = _coerce_year(raw_event.get("year"))
        if not name:
            continue
        key = (_normalize_label(name), year)
        confidence = float(raw_event.get("confidence", 0.5))
        existing = event_bucket.get(key)
        if existing is None or confidence > existing["confidence"]:
            event_bucket[key] = {
                "name": name,
                "year": year,
                "event_type": raw_event.get("event_type") or "other",
                "description": raw_event.get("description"),
                "confidence": confidence,
                "evidence": list(raw_event.get("evidence", []) or []),
            }
        else:
            existing["evidence"].extend(raw_event.get("evidence", []) or [])

    for idx, ((normalized_name, year), payload) in enumerate(
        sorted(event_bucket.items(), key=lambda item: ((item[0][1] if item[0][1] is not None else 0), item[1]["name"].lower()))
    ):
        candidate_id = _stable_candidate_id("event", f"{normalized_name}:{year}")
        deduped_event_evidence = _dedupe_evidence(payload["evidence"])
        include_by_default = _default_include(payload["confidence"]) and bool(deduped_event_evidence)
        events.append(
            {
                "candidate_id": candidate_id,
                "confidence": payload["confidence"],
                "include": include_by_default,
                "fields": {
                    "name": payload["name"],
                    "year": payload["year"],
                    "event_type": payload["event_type"],
                    "description": payload["description"],
                },
                "dependency_keys": [],
                "evidence": deduped_event_evidence,
                "sort_key": idx,
            }
        )

    connections: List[Dict[str, Any]] = []
    connection_bucket: Dict[Tuple[str, str], Dict[str, Any]] = {}
    for raw_connection in raw_connections:
        from_name = raw_connection.get("from_name")
        to_name = raw_connection.get("to_name")
        normalized_from_name = _normalize_label(from_name)
        normalized_to_name = _normalize_label(to_name)
        if not from_name or not to_name:
            continue
        from_candidate_id = _resolve_thinker_candidate_id(
            from_name,
            raw_connection,
            thinker_name_to_candidate_id,
            thinker_alias_to_candidate_id,
            thinker_evidence_by_candidate,
        )
        to_candidate_id = _resolve_thinker_candidate_id(
            to_name,
            raw_connection,
            thinker_name_to_candidate_id,
            thinker_alias_to_candidate_id,
            thinker_evidence_by_candidate,
        )
        if not from_candidate_id or not to_candidate_id:
            warnings.append(
                f"Skipped connection due to unmatched endpoints: {normalized_from_name or from_name} -> {normalized_to_name or to_name}"
            )
            continue
        if from_candidate_id == to_candidate_id:
            warnings.append(
                f"Skipped connection due to self-loop endpoint resolution: {normalized_from_name or from_name} -> {normalized_to_name or to_name}"
            )
            continue

        pair_key = (from_candidate_id, to_candidate_id)
        confidence = float(raw_connection.get("confidence", 0.5))
        connection_type = str(raw_connection.get("connection_type") or "influenced")
        existing = connection_bucket.get(pair_key)
        if existing is None:
            connection_bucket[pair_key] = {
                "connection_type": connection_type,
                "name": raw_connection.get("name"),
                "notes": raw_connection.get("notes"),
                "bidirectional": bool(raw_connection.get("bidirectional", False)),
                "strength": raw_connection.get("strength"),
                "confidence": confidence,
                "evidence": list(raw_connection.get("evidence", []) or []),
                "alternate_types": [],
            }
        else:
            existing["evidence"].extend(raw_connection.get("evidence", []) or [])
            if existing["connection_type"] != connection_type:
                existing["alternate_types"].append(connection_type)
                if confidence > existing["confidence"]:
                    existing["connection_type"] = connection_type
                    existing["confidence"] = confidence

    for idx, ((from_candidate_id, to_candidate_id), payload) in enumerate(
        sorted(connection_bucket.items(), key=lambda item: (item[0][0], item[0][1]))
    ):
        if payload["alternate_types"]:
            alt = ", ".join(sorted(set(payload["alternate_types"])))
            warnings.append(
                f"Connection {from_candidate_id}->{to_candidate_id} had multiple types; selected '{payload['connection_type']}', alternates: {alt}."
            )

        key = f"{from_candidate_id}:{to_candidate_id}"
        candidate_id = _stable_candidate_id("connection", key)
        deduped_connection_evidence = _dedupe_evidence(payload["evidence"])
        include_by_default = _default_include(payload["confidence"]) and bool(deduped_connection_evidence)
        connections.append(
            {
                "candidate_id": candidate_id,
                "confidence": payload["confidence"],
                "include": include_by_default,
                "fields": {
                    "from_thinker_candidate_id": from_candidate_id,
                    "to_thinker_candidate_id": to_candidate_id,
                    "connection_type": payload["connection_type"],
                    "name": payload["name"],
                    "notes": payload["notes"],
                    "bidirectional": payload["bidirectional"],
                    "strength": payload["strength"],
                },
                "dependency_keys": [from_candidate_id, to_candidate_id],
                "evidence": deduped_connection_evidence,
                "sort_key": idx,
            }
        )

    publications: List[Dict[str, Any]] = []
    publication_bucket: Dict[Tuple[str, str, Optional[int]], Dict[str, Any]] = {}
    for raw_publication in raw_publications:
        thinker_name = raw_publication.get("thinker_name")
        title = str(raw_publication.get("title", "")).strip()
        if not title:
            continue
        thinker_candidate_id = _resolve_thinker_candidate_id(
            thinker_name,
            raw_publication,
            thinker_name_to_candidate_id,
            thinker_alias_to_candidate_id,
            thinker_evidence_by_candidate,
        )
        if not thinker_candidate_id:
            warnings.append(f"Skipped publication with unmatched thinker: {raw_publication.get('thinker_name')}")
            continue

        year = _coerce_year(raw_publication.get("year"))
        key = (thinker_candidate_id, _normalize_label(title), year)
        confidence = float(raw_publication.get("confidence", 0.5))
        existing = publication_bucket.get(key)
        if existing is None or confidence > existing["confidence"]:
            publication_bucket[key] = {
                "thinker_candidate_id": thinker_candidate_id,
                "title": title,
                "year": year,
                "publication_type": raw_publication.get("publication_type") or "other",
                "citation": raw_publication.get("citation"),
                "notes": raw_publication.get("notes"),
                "confidence": confidence,
                "evidence": list(raw_publication.get("evidence", []) or []),
            }
        else:
            existing["evidence"].extend(raw_publication.get("evidence", []) or [])

    for idx, ((thinker_candidate_id, normalized_title, year), payload) in enumerate(
        sorted(publication_bucket.items(), key=lambda item: ((item[0][2] or 0), item[1]["title"].lower()))
    ):
        candidate_id = _stable_candidate_id("publication", f"{thinker_candidate_id}:{normalized_title}:{year}")
        deduped_publication_evidence = _dedupe_evidence(payload["evidence"])
        include_by_default = _default_include(payload["confidence"]) and bool(deduped_publication_evidence)
        publications.append(
            {
                "candidate_id": candidate_id,
                "confidence": payload["confidence"],
                "include": include_by_default,
                "fields": {
                    "thinker_candidate_id": thinker_candidate_id,
                    "title": payload["title"],
                    "year": payload["year"],
                    "publication_type": payload["publication_type"],
                    "citation": payload["citation"],
                    "notes": payload["notes"],
                },
                "dependency_keys": [thinker_candidate_id],
                "evidence": deduped_publication_evidence,
                "sort_key": idx,
            }
        )

    quotes: List[Dict[str, Any]] = []
    quote_bucket: Dict[Tuple[str, str], Dict[str, Any]] = {}
    for raw_quote in raw_quotes:
        quote_text = str(raw_quote.get("text", "")).strip()
        if not quote_text:
            continue
        thinker_candidate_id = _resolve_thinker_candidate_id(
            raw_quote.get("thinker_name"),
            raw_quote,
            thinker_name_to_candidate_id,
            thinker_alias_to_candidate_id,
            thinker_evidence_by_candidate,
        )
        key = (thinker_candidate_id or "unlinked", _normalize_label(quote_text))
        confidence = float(raw_quote.get("confidence", 0.5))
        existing = quote_bucket.get(key)
        quote_payload = {
            "thinker_candidate_id": thinker_candidate_id,
            "text": quote_text,
            "source": raw_quote.get("source"),
            "year": _coerce_year(raw_quote.get("year")),
            "context_notes": raw_quote.get("context_notes"),
            "confidence": confidence,
            "evidence": list(raw_quote.get("evidence", []) or []),
        }
        if existing is None or confidence > existing["confidence"]:
            quote_bucket[key] = quote_payload
        else:
            existing["evidence"].extend(raw_quote.get("evidence", []) or [])

    for idx, ((thinker_candidate_id, normalized_text), payload) in enumerate(
        sorted(quote_bucket.items(), key=lambda item: item[1]["text"].lower())
    ):
        candidate_id = _stable_candidate_id("quote", f"{thinker_candidate_id}:{normalized_text}")
        dependency_keys = [thinker_candidate_id] if thinker_candidate_id != "unlinked" else []
        deduped_quote_evidence = _dedupe_evidence(payload["evidence"])
        if thinker_candidate_id == "unlinked":
            warnings.append(f"Quote candidate {candidate_id} is missing thinker attribution and was excluded by default.")

        quotes.append(
            {
                "candidate_id": candidate_id,
                "confidence": payload["confidence"],
                "include": (
                    _default_include(payload["confidence"]) and bool(deduped_quote_evidence)
                    if thinker_candidate_id != "unlinked"
                    else False
                ),
                "fields": {
                    "thinker_candidate_id": None if thinker_candidate_id == "unlinked" else thinker_candidate_id,
                    "text": payload["text"],
                    "source": payload["source"],
                    "year": payload["year"],
                    "context_notes": payload["context_notes"],
                },
                "dependency_keys": dependency_keys,
                "evidence": deduped_quote_evidence,
                "sort_key": idx,
            }
        )

    timeline_name = (timeline_name_hint or "").strip()
    if not timeline_name:
        main_names = [item["fields"]["name"] for item in thinkers[:3]]
        timeline_name = " / ".join(main_names) if main_names else "Imported Timeline"

    graph = {
        "timeline_candidate": {
            "name": timeline_name,
            "description": "Generated from source text",
            "start_year": start_year_hint,
            "end_year": end_year_hint,
        },
        "summary": {
            "candidate_counts": {
                "thinkers": len(thinkers),
                "events": len(events),
                "connections": len(connections),
                "publications": len(publications),
                "quotes": len(quotes),
            }
        },
        "thinkers": thinkers,
        "events": events,
        "connections": connections,
        "publications": publications,
        "quotes": quotes,
        "warnings": warnings,
    }
    return graph
