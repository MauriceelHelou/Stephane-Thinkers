import asyncio
import json
import os
import re
from typing import Any, Dict, List, Optional, Set, Tuple

from app.services.notes_ai.timeline_bootstrap_chunking import TextChunk
from app.utils.ai_service import AIServiceError, _call_deepseek_api, estimate_token_count, is_ai_enabled

MAX_EXCERPT_LEN = 280
TEST_ENV = os.getenv("ENVIRONMENT", "development") == "test"

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

EVENT_TYPE_KEYWORDS = {
    "council": "council",
    "synod": "council",
    "war": "war",
    "battle": "war",
    "invention": "invention",
    "invented": "invention",
    "discovery": "invention",
    "published": "publication",
    "publication": "publication",
    "book": "publication",
    "article": "publication",
    "chapter": "publication",
    "election": "political",
    "revolution": "political",
    "government": "political",
    "treaty": "political",
    "movement": "cultural",
    "cultural": "cultural",
    "theater": "cultural",
    "theatre": "cultural",
}

PUBLICATION_TYPE_KEYWORDS = {
    "book": "book",
    "article": "article",
    "chapter": "chapter",
    "thesis": "thesis",
    "conference": "conference",
    "report": "report",
}

STOP_NAMES = {
    "The", "This", "That", "These", "Those", "In", "On", "By", "From", "For", "And", "But", "Or",
    "Chapter", "Section", "Part", "University", "Journal", "Philosophy", "History",
}

NON_PERSON_SINGLE_TOKENS = {
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
    "aristotelian",
    "platonist",
    "platonic",
    "academy",
    "lyceum",
    "neoplatonic",
}
NON_PERSON_SUFFIXES = ("ism", "ist", "ists", "ian", "ians", "ology", "ologies")

RELATION_VERB_TO_TYPE = {
    "influenced": "influenced",
    "inspired": "influenced",
    "shaped": "influenced",
    "guided": "influenced",
    "critiqued": "critiqued",
    "criticized": "critiqued",
    "criticised": "critiqued",
    "challenged": "critiqued",
    "opposed": "critiqued",
    "rejected": "critiqued",
    "disputed": "critiqued",
    "debated": "critiqued",
    "argued against": "critiqued",
    "built upon": "built_upon",
    "built on": "built_upon",
    "extended": "built_upon",
    "developed": "built_upon",
    "adapted": "built_upon",
    "borrowed from": "built_upon",
    "drew on": "built_upon",
    "commented on": "built_upon",
    "interpreted": "built_upon",
    "synthesized": "synthesized",
    "synthesised": "synthesized",
    "integrated": "synthesized",
    "combined": "synthesized",
    "reconciled": "synthesized",
}

RELATION_TYPE_CUES: Dict[str, Set[str]] = {
    "influenced": set(),
    "critiqued": set(),
    "built_upon": set(),
    "synthesized": set(),
}
for _verb, _relation_type in RELATION_VERB_TO_TYPE.items():
    RELATION_TYPE_CUES.setdefault(_relation_type, set()).add(_verb)

RELATION_VERB_PATTERN = "|".join(
    sorted((re.escape(verb) for verb in RELATION_VERB_TO_TYPE.keys()), key=len, reverse=True)
)

RELATION_DIRECT_PATTERN = re.compile(
    r"\b(?P<from>[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3})"
    r"(?:'s\s+[^.!?,;:\n]{0,40})?\s+"
    rf"(?P<verb>(?i:{RELATION_VERB_PATTERN}))\s+"
    r"(?P<to>[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3})\b",
)

RELATION_WITH_PATTERN = re.compile(
    r"\b(?P<from>[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3})\s+"
    r"(?P<verb>(?i:debated|disputed|argued|engaged))\b"
    r"[^.!?\n]{0,100}?\bwith\s+"
    r"(?P<to>[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3})\b",
)
SENTENCE_SPLIT_PATTERN = re.compile(r"(?<=[.!?])\s+|\n+")


def _strip_markdown_fence(raw: str) -> str:
    cleaned = (raw or "").strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    return cleaned.strip()


def _safe_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(str(value).strip())
    except Exception:
        return None


def _normalize_connection_type(raw_type: Optional[str]) -> str:
    if not raw_type:
        return "influenced"
    key = raw_type.strip().lower().replace("-", "_")
    return CONNECTION_TYPE_ALIASES.get(key, CONNECTION_TYPE_ALIASES.get(key.replace("_", " "), "influenced"))


def _normalize_relation_verb(verb: Optional[str]) -> str:
    key = str(verb or "").strip().lower()
    return RELATION_VERB_TO_TYPE.get(key, "influenced")


def _guess_event_type(sentence: str) -> str:
    lowered = sentence.lower()
    for keyword, normalized in EVENT_TYPE_KEYWORDS.items():
        if keyword in lowered:
            return normalized
    return "other"


def _guess_publication_type(sentence: str) -> str:
    lowered = sentence.lower()
    for keyword, normalized in PUBLICATION_TYPE_KEYWORDS.items():
        if keyword in lowered:
            return normalized
    return "other"


def _build_evidence(chunk: TextChunk, relative_start: int, relative_end: int) -> Dict[str, Any]:
    abs_start = max(chunk.char_start, chunk.char_start + max(0, relative_start))
    abs_end = min(chunk.char_end, chunk.char_start + max(relative_start, relative_end))
    excerpt = chunk.text[max(0, relative_start):max(relative_start, relative_end)]
    if len(excerpt) > MAX_EXCERPT_LEN:
        excerpt = excerpt[: MAX_EXCERPT_LEN - 3].rstrip() + "..."
    return {
        "chunk_index": chunk.index,
        "char_start": abs_start,
        "char_end": abs_end,
        "excerpt": excerpt,
    }


def _empty_payload() -> Dict[str, Any]:
    return {
        "thinkers": [],
        "events": [],
        "connections": [],
        "publications": [],
        "quotes": [],
        "warnings": [],
    }


def _looks_like_name(value: str) -> bool:
    name = str(value or "").strip()
    if not name:
        return False
    tokens = name.split()
    if len(tokens) == 1:
        token = tokens[0]
        if token.title() in STOP_NAMES:
            return False
        if len(token) < 3:
            return False
        lowered_token = re.sub(r"[^a-z0-9]", "", token.lower())
        if lowered_token in NON_PERSON_SINGLE_TOKENS:
            return False
        if any(lowered_token.endswith(suffix) for suffix in NON_PERSON_SUFFIXES):
            return False
    return True


def _normalize_for_search(value: str) -> str:
    lowered = str(value or "").lower()
    lowered = re.sub(r"[^a-z0-9\s]", " ", lowered)
    lowered = re.sub(r"\s+", " ", lowered).strip()
    return lowered


def _contains_phrase(text: str, phrase: str) -> bool:
    normalized_text = _normalize_for_search(text)
    normalized_phrase = _normalize_for_search(phrase)
    if not normalized_phrase:
        return False
    return f" {normalized_phrase} " in f" {normalized_text} "


def _find_span_case_insensitive(text: str, phrase: str) -> Optional[Tuple[int, int]]:
    phrase = str(phrase or "").strip()
    if not phrase:
        return None
    start = text.lower().find(phrase.lower())
    if start < 0:
        return None
    return (start, start + len(phrase))


def _fallback_evidence_from_phrase(chunk: TextChunk, phrase: str) -> List[Dict[str, Any]]:
    span = _find_span_case_insensitive(chunk.text, phrase)
    if span is None:
        return []
    return [_build_evidence(chunk, span[0], span[1])]


def _supports_relation_type(text: str, relation_type: str) -> bool:
    normalized_relation = _normalize_connection_type(relation_type)
    cues = RELATION_TYPE_CUES.get(normalized_relation, set())
    if not cues:
        return False

    normalized_text = _normalize_for_search(text)
    if not normalized_text:
        return False

    normalized_text = f" {normalized_text} "
    for cue in cues:
        normalized_cue = _normalize_for_search(cue)
        if not normalized_cue:
            continue
        if f" {normalized_cue} " in normalized_text:
            return True
    return False


def _iter_sentence_spans(text: str) -> List[Tuple[int, int]]:
    spans: List[Tuple[int, int]] = []
    start = 0
    for match in SENTENCE_SPLIT_PATTERN.finditer(text):
        end = match.start()
        if end > start:
            spans.append((start, end))
        start = match.end()
    if start < len(text):
        spans.append((start, len(text)))
    return spans


def _find_supported_connection_span(
    chunk: TextChunk,
    from_name: str,
    to_name: str,
    connection_type: str,
) -> Optional[Tuple[int, int]]:
    for start, end in _iter_sentence_spans(chunk.text):
        sentence = chunk.text[start:end]
        if not sentence.strip():
            continue
        if not _contains_phrase(sentence, from_name) or not _contains_phrase(sentence, to_name):
            continue
        if not _supports_relation_type(sentence, connection_type):
            continue
        return (start, end)
    return None


def _ground_candidate(
    collection_key: str,
    raw_item: Dict[str, Any],
    chunk: TextChunk,
) -> Optional[Dict[str, Any]]:
    item = dict(raw_item)
    evidence = [
        ev
        for ev in (item.get("evidence") or [])
        if isinstance(ev, dict) and str(ev.get("excerpt", "")).strip()
    ]
    item["evidence"] = evidence

    if collection_key == "thinkers":
        name = str(item.get("name", "")).strip()
        if not name or not _contains_phrase(chunk.text, name):
            return None
        if not item["evidence"]:
            item["evidence"] = _fallback_evidence_from_phrase(chunk, name)
        return item if item["evidence"] else None

    if collection_key == "connections":
        from_name = str(item.get("from_name", "")).strip()
        to_name = str(item.get("to_name", "")).strip()
        connection_type = _normalize_connection_type(item.get("connection_type"))
        item["connection_type"] = connection_type
        if not from_name or not to_name or from_name.lower() == to_name.lower():
            return None
        if not _contains_phrase(chunk.text, from_name) or not _contains_phrase(chunk.text, to_name):
            return None

        supported_evidence = []
        for ev in item["evidence"]:
            excerpt = str(ev.get("excerpt", "")).strip()
            if not excerpt:
                continue
            if not _contains_phrase(excerpt, from_name) or not _contains_phrase(excerpt, to_name):
                continue
            if not _supports_relation_type(excerpt, connection_type):
                continue
            supported_evidence.append(ev)
        item["evidence"] = supported_evidence

        if not item["evidence"]:
            supported_span = _find_supported_connection_span(chunk, from_name, to_name, connection_type)
            if supported_span:
                item["evidence"] = [_build_evidence(chunk, supported_span[0], supported_span[1])]
        return item if item["evidence"] else None

    if collection_key == "publications":
        title = str(item.get("title", "")).strip()
        if not title:
            return None
        if not _contains_phrase(chunk.text, title):
            return None
        if not item["evidence"]:
            item["evidence"] = _fallback_evidence_from_phrase(chunk, title)
        return item if item["evidence"] else None

    if collection_key == "quotes":
        text = str(item.get("text", "")).strip()
        if not text:
            return None
        snippet = text[:120]
        if not _contains_phrase(chunk.text, snippet):
            return None
        if not item["evidence"]:
            item["evidence"] = _fallback_evidence_from_phrase(chunk, snippet)
        return item if item["evidence"] else None

    if collection_key == "events":
        name = str(item.get("name", "")).strip()
        year = item.get("year")
        year_match = isinstance(year, int) and _contains_phrase(chunk.text, str(year))
        if not name:
            return None
        if not _contains_phrase(chunk.text, name[:120]):
            return None
        if not item["evidence"]:
            item["evidence"] = _fallback_evidence_from_phrase(chunk, name[:120])
            if not item["evidence"] and year_match:
                item["evidence"] = _fallback_evidence_from_phrase(chunk, str(year))
        return item if item["evidence"] else None

    return item if item["evidence"] else None


def _entity_key(entity_type: str, row: Dict[str, Any]) -> Tuple[str, ...]:
    if entity_type == "thinkers":
        return ("thinker", str(row.get("name", "")).strip().lower())

    if entity_type == "events":
        return ("event", str(row.get("name", "")).strip().lower(), str(row.get("year")))

    if entity_type == "connections":
        return (
            "connection",
            str(row.get("from_name", "")).strip().lower(),
            str(row.get("to_name", "")).strip().lower(),
            _normalize_connection_type(row.get("connection_type")),
        )

    if entity_type == "publications":
        return (
            "publication",
            str(row.get("thinker_name", "")).strip().lower(),
            str(row.get("title", "")).strip().lower(),
            str(row.get("year")),
        )

    if entity_type == "quotes":
        return (
            "quote",
            str(row.get("thinker_name", "")).strip().lower(),
            str(row.get("text", "")).strip().lower(),
        )

    return (entity_type, str(row))


def _augment_with_heuristics(primary: Dict[str, Any], heuristic: Dict[str, Any]) -> Dict[str, Any]:
    merged = _empty_payload()
    added_counts: Dict[str, int] = {key: 0 for key in ["thinkers", "events", "connections", "publications", "quotes"]}

    for key in ["thinkers", "events", "connections", "publications", "quotes"]:
        seen: Set[Tuple[str, ...]] = set()
        primary_keys: Set[Tuple[str, ...]] = set()
        merged[key] = []

        for row in primary.get(key, []) or []:
            if not isinstance(row, dict):
                continue
            row_key = _entity_key(key, row)
            if row_key in primary_keys:
                continue
            primary_keys.add(row_key)

        for source_name, source in [("primary", primary), ("heuristic", heuristic)]:
            for row in source.get(key, []) or []:
                if not isinstance(row, dict):
                    continue
                row_key = _entity_key(key, row)
                if row_key in seen:
                    continue
                seen.add(row_key)
                merged[key].append(dict(row))
                if source_name == "heuristic" and row_key not in primary_keys:
                    added_counts[key] += 1

    primary_warnings = [str(item) for item in (primary.get("warnings") or []) if str(item).strip()]
    heuristic_warnings = [str(item) for item in (heuristic.get("warnings") or []) if str(item).strip()]
    merged["warnings"] = primary_warnings + heuristic_warnings

    augmentation_bits = [
        f"{key}={count}" for key, count in added_counts.items() if count > 0 and key in {"connections", "events", "publications", "thinkers"}
    ]
    if augmentation_bits:
        merged["warnings"].append(
            "Heuristic augmentation added additional candidates (" + ", ".join(augmentation_bits) + ")."
        )

    return merged


def _heuristic_extract(chunk: TextChunk) -> Dict[str, Any]:
    text = chunk.text
    output: Dict[str, Any] = _empty_payload()

    # Thinkers
    thinker_matches = list(re.finditer(r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b", text))
    seen_thinkers = set()

    def _push_thinker(
        name: str,
        start: int,
        end: int,
        *,
        confidence: float = 0.58,
        birth_year: Optional[int] = None,
        death_year: Optional[int] = None,
    ) -> None:
        name = str(name or "").strip()
        if not _looks_like_name(name):
            return
        lowered = name.lower()
        if lowered in seen_thinkers:
            return
        seen_thinkers.add(lowered)

        output["thinkers"].append(
            {
                "name": name,
                "birth_year": birth_year,
                "death_year": death_year,
                "field": None,
                "active_period": None,
                "biography_notes": None,
                "confidence": confidence,
                "evidence": [_build_evidence(chunk, start, end)],
            }
        )

    for match in thinker_matches:
        name = match.group(1).strip()
        if name in STOP_NAMES:
            continue
        if len(name.split()) < 2:
            continue

        context_start = max(0, match.start() - 80)
        context_end = min(len(text), match.end() + 80)
        context = text[context_start:context_end]
        years_match = re.search(r"(\d{3,4})\s*[\-–]\s*(\d{3,4})", context)
        birth_year = _safe_int(years_match.group(1)) if years_match else None
        death_year = _safe_int(years_match.group(2)) if years_match else None

        _push_thinker(
            name,
            match.start(),
            match.end(),
            confidence=0.58,
            birth_year=birth_year,
            death_year=death_year,
        )

    # Connections
    seen_connections: Set[Tuple[str, str, str]] = set()

    def _push_connection(
        from_name: str,
        to_name: str,
        verb: str,
        start: int,
        end: int,
        confidence: float,
        *,
        from_span: Optional[Tuple[int, int]] = None,
        to_span: Optional[Tuple[int, int]] = None,
    ) -> None:
        from_name = str(from_name or "").strip()
        to_name = str(to_name or "").strip()
        if not _looks_like_name(from_name) or not _looks_like_name(to_name):
            return
        if from_name.lower() == to_name.lower():
            return

        if from_span is not None:
            _push_thinker(from_name, from_span[0], from_span[1], confidence=0.54)
        if to_span is not None:
            _push_thinker(to_name, to_span[0], to_span[1], confidence=0.54)

        connection_type = _normalize_relation_verb(verb)
        key = (from_name.lower(), to_name.lower(), connection_type)
        if key in seen_connections:
            return
        seen_connections.add(key)
        output["connections"].append(
            {
                "from_name": from_name,
                "to_name": to_name,
                "connection_type": connection_type,
                "name": None,
                "notes": None,
                "confidence": confidence,
                "evidence": [_build_evidence(chunk, start, end)],
            }
        )

    for match in RELATION_DIRECT_PATTERN.finditer(text):
        _push_connection(
            match.group("from"),
            match.group("to"),
            match.group("verb"),
            match.start(),
            match.end(),
            confidence=0.66,
            from_span=(match.start("from"), match.end("from")),
            to_span=(match.start("to"), match.end("to")),
        )

    for match in RELATION_WITH_PATTERN.finditer(text):
        _push_connection(
            match.group("from"),
            match.group("to"),
            match.group("verb"),
            match.start(),
            match.end(),
            confidence=0.62,
            from_span=(match.start("from"), match.end("from")),
            to_span=(match.start("to"), match.end("to")),
        )

    # Sentence-level event/publication extraction
    sentence_pattern = re.compile(r"[^\n.!?]+[.!?]?", re.MULTILINE)
    for match in sentence_pattern.finditer(text):
        sentence = match.group(0).strip()
        if len(sentence) < 30:
            continue

        year_match = re.search(r"\b(\d{3,4})\b", sentence)
        year = _safe_int(year_match.group(1)) if year_match else None

        if year is not None:
            output["events"].append(
                {
                    "name": sentence[:140],
                    "year": year,
                    "event_type": _guess_event_type(sentence),
                    "description": sentence[:240],
                    "confidence": 0.54,
                    "evidence": [_build_evidence(chunk, match.start(), match.end())],
                }
            )

        publication_match = re.search(
            r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}).{0,60}?"
            r"(?:wrote|published|authored)\s+(?:the\s+)?[\"“]?([^\"”]{3,160})[\"”]?",
            sentence,
            re.IGNORECASE,
        )
        if publication_match:
            output["publications"].append(
                {
                    "thinker_name": publication_match.group(1).strip(),
                    "title": publication_match.group(2).strip(" .,;"),
                    "year": year,
                    "publication_type": _guess_publication_type(sentence),
                    "citation": None,
                    "notes": sentence[:200],
                    "confidence": 0.57,
                    "evidence": [_build_evidence(chunk, match.start(), match.end())],
                }
            )

    # Quotes
    quote_pattern = re.compile(
        r"[\"“]([^\"”]{20,280})[\"”](?:\s*[—\-]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}))?"
    )
    for match in quote_pattern.finditer(text):
        quote_text = match.group(1).strip()
        thinker_name = match.group(2).strip() if match.group(2) else None
        if thinker_name is None:
            context_before = text[max(0, match.start() - 180):match.start()]
            preceding_names = list(re.finditer(r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b", context_before))
            for candidate in reversed(preceding_names):
                inferred_name = candidate.group(1).strip()
                if inferred_name in STOP_NAMES:
                    continue
                if len(inferred_name.split()) < 2:
                    continue
                thinker_name = inferred_name
                break

        evidence_start = max(0, match.start() - 140)
        evidence_end = min(len(text), match.end() + 80)
        output["quotes"].append(
            {
                "thinker_name": thinker_name,
                "text": quote_text,
                "source": None,
                "year": None,
                "context_notes": None,
                "confidence": 0.6 if match.group(2) else (0.52 if thinker_name else 0.42),
                "evidence": [_build_evidence(chunk, evidence_start, evidence_end)],
            }
        )

    return output


def _llm_extract(
    chunk: TextChunk,
    *,
    scope_label: str = "chunk",
    completion_tokens: int = 1800,
) -> Optional[Dict[str, Any]]:
    if TEST_ENV or not is_ai_enabled():
        return None

    messages = [
        {
            "role": "system",
            "content": (
                "Extract structured timeline entities from source text. "
                "Prioritize recall for explicit thinker-to-thinker relations and temporal anchors. "
                "Return valid JSON only with keys: thinkers, events, connections, publications, quotes, warnings."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Extract entities from this {scope_label}. Preserve only facts grounded in text. "
                "Use conservative confidence for uncertain facts.\n"
                "Critical requirements:\n"
                "1) Do not omit explicit relation claims between thinkers.\n"
                "2) Keep competing claims as separate connections; do not collapse relation types.\n"
                "3) Prefer including uncertain but explicit relations with lower confidence over dropping them.\n"
                "4) Include publication/event anchors whenever a year is explicit.\n"
                "5) If you cannot attach an exact evidence excerpt and char span to a candidate, omit it.\n\n"
                f"Source text:\n{chunk.text}\n\n"
                "JSON schema guidance:\n"
                "thinkers[]: {name,birth_year,death_year,field,active_period,biography_notes,confidence,evidence:[{char_start,char_end,excerpt}]}\n"
                "events[]: {name,year,event_type,description,confidence,evidence:[...]}\n"
                "connections[]: {from_name,to_name,connection_type,name,notes,confidence,evidence:[...]}\n"
                "publications[]: {thinker_name,title,year,publication_type,citation,notes,confidence,evidence:[...]}\n"
                "quotes[]: {thinker_name,text,source,year,context_notes,confidence,evidence:[...]}\n"
                "Allowed connection_type values: influenced|critiqued|built_upon|synthesized.\n"
                "warnings[]: strings"
            ),
        },
    ]

    try:
        asyncio.get_running_loop()
        return None
    except RuntimeError:
        pass

    try:
        raw = asyncio.run(_call_deepseek_api(messages=messages, temperature=0.1, max_tokens=completion_tokens))
    except AIServiceError:
        return None
    except Exception:
        return None

    if not raw:
        return None

    try:
        parsed = json.loads(_strip_markdown_fence(raw))
    except json.JSONDecodeError:
        return None

    if not isinstance(parsed, dict):
        return None

    for key in ["thinkers", "events", "connections", "publications", "quotes", "warnings"]:
        if key not in parsed:
            parsed[key] = [] if key != "warnings" else []

    return parsed


def extract_chunk_entities(chunk: TextChunk) -> Dict[str, Any]:
    llm_payload = _llm_extract(chunk, scope_label="chunk", completion_tokens=1800)
    if llm_payload is None:
        return _heuristic_extract(chunk)

    normalized = _normalize_llm_payload(llm_payload, chunk)
    heuristic = _heuristic_extract(chunk)
    return _augment_with_heuristics(normalized, heuristic)


def extract_full_text_entities(content: str) -> Dict[str, Any]:
    text = (content or "").strip()
    chunk = TextChunk(
        index=0,
        text=text,
        char_start=0,
        char_end=len(text),
        token_estimate=max(1, estimate_token_count(text)),
        paragraphs=[],
    )

    llm_payload = _llm_extract(chunk, scope_label="full source text", completion_tokens=2400)
    if llm_payload is None:
        return _heuristic_extract(chunk)

    normalized = _normalize_llm_payload(llm_payload, chunk)
    heuristic = _heuristic_extract(chunk)
    return _augment_with_heuristics(normalized, heuristic)


def extract_relation_salvage_entities(content: str, thinker_names: List[str]) -> Dict[str, Any]:
    text = (content or "").strip()
    if not text:
        return _empty_payload()

    chunk = TextChunk(
        index=0,
        text=text,
        char_start=0,
        char_end=len(text),
        token_estimate=max(1, estimate_token_count(text)),
        paragraphs=[],
    )

    heuristic = _heuristic_extract(chunk)
    heuristic_only_relations = _empty_payload()
    heuristic_only_relations["events"] = heuristic.get("events", []) or []
    heuristic_only_relations["connections"] = heuristic.get("connections", []) or []
    heuristic_only_relations["publications"] = heuristic.get("publications", []) or []
    heuristic_only_relations["warnings"] = heuristic.get("warnings", []) or []

    if TEST_ENV or not is_ai_enabled():
        return heuristic_only_relations

    curated_thinkers = [str(name).strip() for name in thinker_names if str(name).strip()][:40]
    messages = [
        {
            "role": "system",
            "content": (
                "Extract missing relation signal from source text. "
                "Do not summarize. Return strict JSON only."
            ),
        },
        {
            "role": "user",
            "content": (
                "Given source text and known thinker names, recover explicit connections/events/publications that may be missed.\n"
                "Use only thinker endpoints grounded in text and preferably from known thinker names.\n"
                "Keep competing claims as separate connections.\n"
                "If you cannot ground a candidate in an explicit excerpt, omit it.\n"
                "Allowed connection_type: influenced|critiqued|built_upon|synthesized.\n"
                'Return JSON with keys: thinkers,events,connections,publications,quotes,warnings.\n'
                "Set thinkers and quotes to empty arrays.\n\n"
                f"Known thinkers:\n{json.dumps(curated_thinkers, ensure_ascii=False)}\n\n"
                f"Source text:\n{text}"
            ),
        },
    ]

    try:
        asyncio.get_running_loop()
        return heuristic_only_relations
    except RuntimeError:
        pass

    try:
        raw = asyncio.run(_call_deepseek_api(messages=messages, temperature=0.1, max_tokens=1500))
    except AIServiceError:
        return heuristic_only_relations
    except Exception:
        return heuristic_only_relations

    if not raw:
        return heuristic_only_relations

    try:
        parsed = json.loads(_strip_markdown_fence(raw))
    except json.JSONDecodeError:
        return heuristic_only_relations

    if not isinstance(parsed, dict):
        return heuristic_only_relations

    for key in ["thinkers", "events", "connections", "publications", "quotes", "warnings"]:
        if key not in parsed:
            parsed[key] = [] if key != "warnings" else []

    normalized = _normalize_llm_payload(parsed, chunk)
    normalized["thinkers"] = []
    normalized["quotes"] = []
    return _augment_with_heuristics(normalized, heuristic_only_relations)


def _normalize_llm_payload(llm_payload: Dict[str, Any], chunk: TextChunk) -> Dict[str, Any]:
    grounding_warnings: List[str] = []
    for collection_key in ["thinkers", "events", "connections", "publications", "quotes"]:
        cleaned_items = []
        dropped_count = 0
        for raw_item in llm_payload.get(collection_key, []) or []:
            if not isinstance(raw_item, dict):
                continue
            evidences = []
            for raw_evidence in raw_item.get("evidence", []) or []:
                if not isinstance(raw_evidence, dict):
                    continue
                relative_start = _safe_int(raw_evidence.get("char_start"))
                relative_end = _safe_int(raw_evidence.get("char_end"))
                if relative_start is None or relative_end is None:
                    continue
                ev = _build_evidence(chunk, relative_start, relative_end)
                evidences.append(ev)
            raw_item["evidence"] = evidences
            grounded = _ground_candidate(collection_key, raw_item, chunk)
            if grounded is None:
                dropped_count += 1
                continue
            cleaned_items.append(grounded)
        llm_payload[collection_key] = cleaned_items
        if dropped_count > 0:
            grounding_warnings.append(
                f"Dropped {dropped_count} ungrounded {collection_key} candidate(s) due to missing source evidence."
            )

    llm_payload["warnings"] = [str(item) for item in (llm_payload.get("warnings") or []) if str(item).strip()]
    llm_payload["warnings"].extend(grounding_warnings)
    return llm_payload
