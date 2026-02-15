import hashlib
import re
from collections import defaultdict
from typing import Any, Dict, Iterable, List, Optional, Tuple

NON_PERSON_ENDPOINT_SINGLE_TOKENS = {
    "stoic",
    "stoics",
    "epicurean",
    "epicureans",
    "christian",
    "christians",
    "greek",
    "greeks",
    "roman",
    "romans",
    "marxism",
    "academy",
    "lyceum",
    "neoplatonic",
}
NON_PERSON_ENDPOINT_SUFFIXES = ("ism", "ist", "ists", "ian", "ians", "ology", "ologies")
ATTRIBUTION_VERBS_PATTERN = (
    r"(?:said|wrote|argued|noted|claimed|stated|observed|maintained|explained|published|authored)"
)


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


def _dedupe_warnings(values: Iterable[str]) -> List[str]:
    deduped: List[str] = []
    seen = set()
    for value in values:
        warning = str(value or "").strip()
        if not warning or warning in seen:
            continue
        seen.add(warning)
        deduped.append(warning)
    return deduped


def _compact_warning_noise(values: Iterable[str]) -> List[str]:
    raw = [str(value or "").strip() for value in values if str(value or "").strip()]
    if not raw:
        return []

    categories = {
        "model_note": [],
        "model_omitted": [],
        "model_non_thinker_connection": [],
        "model_connection_omitted": [],
    }
    passthrough: List[str] = []

    for warning in raw:
        lowered = warning.lower()
        if warning.startswith("Note:"):
            categories["model_note"].append(warning)
            continue
        if warning.startswith("Omitted "):
            categories["model_omitted"].append(warning)
            continue
        if warning.startswith("Connection '") and "not a thinker" in lowered:
            categories["model_non_thinker_connection"].append(warning)
            continue
        if warning.startswith("Connection '") and " omitted" in lowered:
            categories["model_connection_omitted"].append(warning)
            continue
        passthrough.append(warning)

    compacted = list(passthrough)
    for key, label in [
        ("model_note", "Model extraction notes"),
        ("model_omitted", "Model omission notes"),
        ("model_non_thinker_connection", "Model non-thinker connection notes"),
        ("model_connection_omitted", "Model connection omission notes"),
    ]:
        rows = categories[key]
        if not rows:
            continue
        if len(rows) == 1:
            compacted.append(rows[0])
            continue
        examples = " | ".join(rows[:2])
        more = ""
        if len(rows) > 2:
            more = f" (+{len(rows) - 2} more)"
        compacted.append(f"{label}: {len(rows)} items. Examples: {examples}{more}")

    return compacted


def _coerce_year(value: Any) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return None


def _coerce_confidence(value: Any, default: float = 0.5) -> float:
    if value is None:
        return default
    if isinstance(value, bool):
        return default
    if isinstance(value, (int, float)):
        return max(0.0, min(1.0, float(value)))

    text = str(value).strip().lower()
    if not text:
        return default

    lexical = {
        "high": 0.85,
        "medium": 0.6,
        "low": 0.35,
        "very high": 0.92,
        "very low": 0.2,
    }
    if text in lexical:
        return lexical[text]

    if text.endswith("%"):
        try:
            return max(0.0, min(1.0, float(text[:-1].strip()) / 100.0))
        except (TypeError, ValueError):
            return default

    try:
        return max(0.0, min(1.0, float(text)))
    except (TypeError, ValueError):
        return default


def _tokenize_label(value: Optional[str]) -> List[str]:
    normalized = _normalize_label(value)
    if not normalized:
        return []
    return normalized.split()


def _is_plausible_person_reference(value: Optional[str]) -> bool:
    normalized = _normalize_label(value)
    if not normalized:
        return False
    tokens = normalized.split()
    if len(tokens) != 1:
        return True
    token = tokens[0]
    if token in NON_PERSON_ENDPOINT_SINGLE_TOKENS:
        return False
    if any(token.endswith(suffix) for suffix in NON_PERSON_ENDPOINT_SUFFIXES):
        return False
    return True


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
    *,
    strict: bool = False,
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

    if strict:
        return None

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


def _resolve_candidate_from_attribution_context(
    context_text: str,
    thinker_name_to_candidate_id: Dict[str, str],
    thinker_alias_to_candidate_id: Dict[str, str],
) -> Optional[str]:
    normalized_context = _normalize_label(context_text)
    if not normalized_context:
        return None

    candidate_hits: set[str] = set()
    phrases: Dict[str, str] = {}
    phrases.update(thinker_name_to_candidate_id)
    phrases.update(thinker_alias_to_candidate_id)

    for phrase, candidate_id in phrases.items():
        normalized_phrase = _normalize_label(phrase)
        if not normalized_phrase:
            continue
        escaped = re.escape(normalized_phrase)
        patterns = [
            rf"(?:according to|by)\s+{escaped}\b",
            rf"\b{escaped}\s+{ATTRIBUTION_VERBS_PATTERN}\b",
            rf"{ATTRIBUTION_VERBS_PATTERN}\s+{escaped}\b",
        ]
        if any(re.search(pattern, normalized_context) for pattern in patterns):
            candidate_hits.add(candidate_id)

    if len(candidate_hits) == 1:
        return next(iter(candidate_hits))
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
    *,
    allow_contextual_fallback: bool = True,
    strict_reference_match: bool = False,
) -> Optional[str]:
    by_reference = _resolve_candidate_from_reference(
        reference_name,
        thinker_name_to_candidate_id,
        thinker_alias_to_candidate_id,
        strict=strict_reference_match,
    )
    if by_reference:
        return by_reference

    if not allow_contextual_fallback:
        return None

    by_context = _resolve_candidate_from_context(
        _collect_context_text(raw_item),
        thinker_name_to_candidate_id,
        thinker_alias_to_candidate_id,
    )
    if by_context:
        return by_context

    by_attribution = _resolve_candidate_from_attribution_context(
        _collect_context_text(raw_item),
        thinker_name_to_candidate_id,
        thinker_alias_to_candidate_id,
    )
    if by_attribution:
        return by_attribution

    return _resolve_candidate_from_evidence_proximity(raw_item, thinker_evidence_by_candidate)


def _summarize_pair_warnings(prefix: str, pairs: List[Tuple[str, str]], *, examples_limit: int = 4) -> Optional[str]:
    if not pairs:
        return None
    unique_pairs: List[Tuple[str, str]] = []
    seen: set[Tuple[str, str]] = set()
    for pair in pairs:
        if pair in seen:
            continue
        seen.add(pair)
        unique_pairs.append(pair)

    examples = "; ".join(f"{left} -> {right}" for left, right in unique_pairs[:examples_limit])
    more = ""
    if len(unique_pairs) > examples_limit:
        more = f" (+{len(unique_pairs) - examples_limit} more unique pairs)"
    return (
        f"{prefix}: {len(pairs)} total ({len(unique_pairs)} unique). "
        f"Examples: {examples}{more}."
    )


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

            thinker_confidences[name_key].append(_coerce_confidence(thinker.get("confidence", 0.5)))
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
        confidence = _coerce_confidence(raw_event.get("confidence", 0.5))
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
    connection_bucket: Dict[Tuple[str, str, str], Dict[str, Any]] = {}
    connection_types_by_pair: Dict[Tuple[str, str], set[str]] = defaultdict(set)
    best_confidence_by_pair: Dict[Tuple[str, str], float] = defaultdict(float)
    skipped_non_person_pairs: List[Tuple[str, str]] = []
    skipped_unmatched_pairs: List[Tuple[str, str]] = []
    skipped_self_loop_pairs: List[Tuple[str, str]] = []
    for raw_connection in raw_connections:
        from_name = raw_connection.get("from_name")
        to_name = raw_connection.get("to_name")
        normalized_from_name = _normalize_label(from_name)
        normalized_to_name = _normalize_label(to_name)
        if not from_name or not to_name:
            continue
        if not _is_plausible_person_reference(from_name) or not _is_plausible_person_reference(to_name):
            skipped_non_person_pairs.append(
                (
                    normalized_from_name or str(from_name).strip(),
                    normalized_to_name or str(to_name).strip(),
                )
            )
            continue
        from_candidate_id = _resolve_thinker_candidate_id(
            from_name,
            raw_connection,
            thinker_name_to_candidate_id,
            thinker_alias_to_candidate_id,
            thinker_evidence_by_candidate,
            allow_contextual_fallback=False,
            strict_reference_match=True,
        )
        to_candidate_id = _resolve_thinker_candidate_id(
            to_name,
            raw_connection,
            thinker_name_to_candidate_id,
            thinker_alias_to_candidate_id,
            thinker_evidence_by_candidate,
            allow_contextual_fallback=False,
            strict_reference_match=True,
        )
        if not from_candidate_id or not to_candidate_id:
            skipped_unmatched_pairs.append(
                (
                    normalized_from_name or str(from_name).strip(),
                    normalized_to_name or str(to_name).strip(),
                )
            )
            continue
        if from_candidate_id == to_candidate_id:
            skipped_self_loop_pairs.append(
                (
                    normalized_from_name or str(from_name).strip(),
                    normalized_to_name or str(to_name).strip(),
                )
            )
            continue

        connection_type = str(raw_connection.get("connection_type") or "influenced")
        pair_key = (from_candidate_id, to_candidate_id)
        bucket_key = (from_candidate_id, to_candidate_id, connection_type)
        confidence = _coerce_confidence(raw_connection.get("confidence", 0.5))
        existing = connection_bucket.get(bucket_key)
        if existing is None:
            connection_bucket[bucket_key] = {
                "connection_type": connection_type,
                "name": raw_connection.get("name"),
                "notes": raw_connection.get("notes"),
                "bidirectional": bool(raw_connection.get("bidirectional", False)),
                "strength": raw_connection.get("strength"),
                "confidence": confidence,
                "evidence": list(raw_connection.get("evidence", []) or []),
            }
        else:
            existing["evidence"].extend(raw_connection.get("evidence", []) or [])
            if confidence > existing["confidence"]:
                existing["confidence"] = confidence
                if raw_connection.get("name"):
                    existing["name"] = raw_connection.get("name")
                if raw_connection.get("notes"):
                    existing["notes"] = raw_connection.get("notes")
                if raw_connection.get("strength") is not None:
                    existing["strength"] = raw_connection.get("strength")
                existing["bidirectional"] = bool(raw_connection.get("bidirectional", False))

        connection_types_by_pair[pair_key].add(connection_type)
        if confidence > best_confidence_by_pair[pair_key]:
            best_confidence_by_pair[pair_key] = confidence

    for pair, relation_types in sorted(connection_types_by_pair.items(), key=lambda item: (item[0][0], item[0][1])):
        if len(relation_types) > 1:
            warnings.append(
                "Multiple relation types extracted for pair "
                f"{pair[0]}->{pair[1]}: {', '.join(sorted(relation_types))}. "
                "Keeping all as separate candidates; lower-confidence ones default to excluded."
            )

    for prefix, pairs in [
        ("Skipped connection due to non-thinker endpoint references", skipped_non_person_pairs),
        ("Skipped connection due to unmatched endpoints", skipped_unmatched_pairs),
        ("Skipped connection due to self-loop endpoint resolution", skipped_self_loop_pairs),
    ]:
        summary = _summarize_pair_warnings(prefix, pairs)
        if summary:
            warnings.append(summary)

    for idx, ((from_candidate_id, to_candidate_id, connection_type), payload) in enumerate(
        sorted(connection_bucket.items(), key=lambda item: (item[0][0], item[0][1], item[0][2]))
    ):
        pair_key = (from_candidate_id, to_candidate_id)
        is_pair_primary = abs(payload["confidence"] - best_confidence_by_pair[pair_key]) < 1e-9
        key = f"{from_candidate_id}:{to_candidate_id}:{connection_type}"
        candidate_id = _stable_candidate_id("connection", key)
        deduped_connection_evidence = _dedupe_evidence(payload["evidence"])
        include_by_default = (
            _default_include(payload["confidence"])
            and bool(deduped_connection_evidence)
            and is_pair_primary
        )
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
    unmatched_publication_thinkers: List[str] = []
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
            unmatched_publication_thinkers.append(str(raw_publication.get("thinker_name") or "").strip())
            continue

        year = _coerce_year(raw_publication.get("year"))
        key = (thinker_candidate_id, _normalize_label(title), year)
        confidence = _coerce_confidence(raw_publication.get("confidence", 0.5))
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

    if unmatched_publication_thinkers:
        unique_unmatched = []
        seen_unmatched = set()
        for name in unmatched_publication_thinkers:
            key = _normalize_label(name) or name
            if key in seen_unmatched:
                continue
            seen_unmatched.add(key)
            unique_unmatched.append(name or "(missing thinker_name)")
        examples = ", ".join(unique_unmatched[:4])
        more = ""
        if len(unique_unmatched) > 4:
            more = f" (+{len(unique_unmatched) - 4} more unique names)"
        warnings.append(
            "Skipped publication with unmatched thinker references: "
            f"{len(unmatched_publication_thinkers)} total ({len(unique_unmatched)} unique). "
            f"Examples: {examples}{more}."
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
        confidence = _coerce_confidence(raw_quote.get("confidence", 0.5))
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
        "warnings": _dedupe_warnings(_compact_warning_noise(warnings)),
    }
    return graph
