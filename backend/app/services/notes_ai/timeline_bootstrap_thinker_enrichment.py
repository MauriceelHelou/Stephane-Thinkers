import asyncio
import json
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

from app.utils.ai_service import AIServiceError, _call_deepseek_api, is_ai_enabled

ENRICH_ENABLED = os.getenv("TIMELINE_BOOTSTRAP_ENRICH_THINKER_YEARS", "true").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}
STRICT_EVIDENCE_GATE = os.getenv("TIMELINE_BOOTSTRAP_STRICT_EVIDENCE_GATE", "true").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}
ALLOW_UNGROUNDED_YEAR_ENRICHMENT = os.getenv(
    "TIMELINE_BOOTSTRAP_ALLOW_UNGROUNDED_YEAR_ENRICHMENT",
    "false",
).strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}
ENRICH_MAX_THINKERS = max(1, int(os.getenv("TIMELINE_BOOTSTRAP_ENRICH_MAX_THINKERS", "40")))
ENRICH_MIN_CONFIDENCE = float(os.getenv("TIMELINE_BOOTSTRAP_ENRICH_MIN_CONFIDENCE", "0.78"))
ENRICH_MIN_YEAR = int(os.getenv("TIMELINE_BOOTSTRAP_ENRICH_MIN_YEAR", "-3000"))
ENRICH_MAX_YEAR = int(os.getenv("TIMELINE_BOOTSTRAP_ENRICH_MAX_YEAR", str(datetime.utcnow().year + 5)))


def _strip_markdown_fence(raw: str) -> str:
    cleaned = (raw or "").strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    return cleaned.strip()


def _normalize_name(name: str) -> str:
    return " ".join((name or "").strip().lower().split())


def _safe_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(str(value).strip())
    except Exception:
        return None


def _safe_float(value: Any) -> float:
    if value is None:
        return 0.0
    try:
        return float(str(value).strip())
    except Exception:
        return 0.0


def _is_valid_year(value: Optional[int]) -> bool:
    if value is None:
        return False
    return ENRICH_MIN_YEAR <= value <= ENRICH_MAX_YEAR


def _is_dev_test_environment() -> bool:
    return os.getenv("ENVIRONMENT", "development").strip().lower() == "test"


def _extract_enrichment_map(raw: str) -> Dict[str, Dict[str, Any]]:
    if not raw:
        return {}

    try:
        payload = json.loads(_strip_markdown_fence(raw))
    except Exception:
        return {}

    thinkers = payload.get("thinkers", []) if isinstance(payload, dict) else []
    if not isinstance(thinkers, list):
        return {}

    results: Dict[str, Dict[str, Any]] = {}
    for item in thinkers:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name", "")).strip()
        key = _normalize_name(name)
        if not key:
            continue

        birth_year = _safe_int(item.get("birth_year"))
        death_year = _safe_int(item.get("death_year"))
        confidence = _safe_float(item.get("confidence"))

        if birth_year is not None and not _is_valid_year(birth_year):
            birth_year = None
        if death_year is not None and not _is_valid_year(death_year):
            death_year = None
        if birth_year is not None and death_year is not None and birth_year > death_year:
            continue

        results[key] = {
            "birth_year": birth_year,
            "death_year": death_year,
            "confidence": max(0.0, min(1.0, confidence)),
        }

    return results


def _build_enrichment_prompt(names: List[str]) -> List[Dict[str, str]]:
    return [
        {
            "role": "system",
            "content": (
                "You are a cautious historian. "
                "For each thinker name, infer birth and death year from general historical knowledge. "
                "If uncertain, return null values with low confidence."
            ),
        },
        {
            "role": "user",
            "content": (
                "Return strict JSON only with this shape:\n"
                '{"thinkers":[{"name":"...", "birth_year":1234|null, "death_year":1234|null, "confidence":0.0-1.0}]}\n'
                "Rules:\n"
                "1) Keep names exactly as provided.\n"
                "2) Never invent years when uncertain.\n"
                "3) confidence reflects certainty of the year pair.\n"
                "Thinkers:\n"
                + json.dumps(names, ensure_ascii=False)
            ),
        },
    ]


def _run_enrichment_query(names: List[str]) -> Dict[str, Dict[str, Any]]:
    if not names or not is_ai_enabled() or _is_dev_test_environment():
        return {}

    messages = _build_enrichment_prompt(names)

    try:
        asyncio.get_running_loop()
        return {}
    except RuntimeError:
        pass

    try:
        raw = asyncio.run(_call_deepseek_api(messages=messages, temperature=0.0, max_tokens=900))
    except AIServiceError:
        return {}
    except Exception:
        return {}

    return _extract_enrichment_map(raw or "")


def enrich_thinker_years(graph: Dict[str, Any]) -> Dict[str, Any]:
    if not ENRICH_ENABLED:
        return graph

    if STRICT_EVIDENCE_GATE and not ALLOW_UNGROUNDED_YEAR_ENRICHMENT:
        summary = graph.get("summary") or {}
        summary["thinker_year_enrichment"] = {
            "requested": 0,
            "applied": 0,
            "disabled_reason": "strict_grounding_mode",
        }
        graph["summary"] = summary
        warnings = list(graph.get("warnings", []) or [])
        warnings.append(
            "Year enrichment from model context is disabled while strict grounding mode is enabled."
        )
        graph["warnings"] = warnings
        return graph

    thinkers = graph.get("thinkers", []) or []
    if not thinkers:
        return graph

    thinker_rows: List[Dict[str, Any]] = []
    names_for_lookup: List[str] = []
    seen_keys = set()

    for thinker in thinkers:
        if not isinstance(thinker, dict):
            continue
        fields = thinker.get("fields", {}) or {}
        if not isinstance(fields, dict):
            continue

        name = str(fields.get("name", "")).strip()
        if not name:
            continue

        birth_year = fields.get("birth_year")
        death_year = fields.get("death_year")
        if birth_year is not None and death_year is not None:
            continue

        thinker_rows.append(thinker)
        key = _normalize_name(name)
        if key and key not in seen_keys and len(names_for_lookup) < ENRICH_MAX_THINKERS:
            seen_keys.add(key)
            names_for_lookup.append(name)

    if not thinker_rows or not names_for_lookup:
        return graph

    enrichment_map = _run_enrichment_query(names_for_lookup)
    if not enrichment_map:
        return graph

    enriched_count = 0
    warnings = list(graph.get("warnings", []) or [])

    for thinker in thinker_rows:
        fields = thinker.get("fields", {}) or {}
        name_key = _normalize_name(str(fields.get("name", "")).strip())
        enrichment = enrichment_map.get(name_key)
        if not enrichment:
            continue

        confidence = _safe_float(enrichment.get("confidence"))
        if confidence < ENRICH_MIN_CONFIDENCE:
            continue

        changed = False
        birth_year = fields.get("birth_year")
        death_year = fields.get("death_year")

        enriched_birth = _safe_int(enrichment.get("birth_year"))
        enriched_death = _safe_int(enrichment.get("death_year"))

        if birth_year is None and _is_valid_year(enriched_birth):
            fields["birth_year"] = enriched_birth
            changed = True
        if death_year is None and _is_valid_year(enriched_death):
            fields["death_year"] = enriched_death
            changed = True

        current_birth = fields.get("birth_year")
        current_death = fields.get("death_year")
        if current_birth is not None and current_death is not None and int(current_birth) > int(current_death):
            if changed:
                fields["birth_year"] = birth_year
                fields["death_year"] = death_year
            continue

        if changed:
            thinker["fields"] = fields
            metadata_delta = thinker.get("metadata_delta") or {}
            metadata_delta["year_enrichment"] = {
                "source": "llm_context",
                "confidence": round(confidence, 4),
            }
            thinker["metadata_delta"] = metadata_delta
            enriched_count += 1

    if enriched_count > 0:
        warnings.append(
            f"Filled missing thinker birth/death years for {enriched_count} candidates from model context."
        )
        graph["warnings"] = warnings

    summary = graph.get("summary") or {}
    summary["thinker_year_enrichment"] = {
        "requested": len(names_for_lookup),
        "applied": enriched_count,
    }
    graph["summary"] = summary

    return graph
