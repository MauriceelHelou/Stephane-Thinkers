import os
from difflib import SequenceMatcher
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.thinker import Thinker

AUTOPOPULATE_CANONICAL_FIELDS = (
    os.getenv("TIMELINE_BOOTSTRAP_AUTOFILL_MATCHED_METADATA", "true").strip().lower()
    in {"1", "true", "yes", "on"}
)
AUTOPOPULATE_MIN_SCORE = float(os.getenv("TIMELINE_BOOTSTRAP_AUTOFILL_MATCHED_METADATA_MIN_SCORE", "0.9"))


def _normalize_name(name: str) -> str:
    return " ".join((name or "").strip().lower().replace(".", " ").split())


def _metadata_completeness(thinker: Thinker) -> int:
    score = 0
    for value in [
        thinker.birth_year,
        thinker.death_year,
        thinker.active_period,
        thinker.field,
        thinker.biography_notes,
    ]:
        if value is not None and str(value).strip():
            score += 1
    return score


def _exact_match_has_conflicts(matches: List[Thinker]) -> bool:
    if len(matches) < 2:
        return False

    birth_values = {int(item.birth_year) for item in matches if item.birth_year is not None}
    death_values = {int(item.death_year) for item in matches if item.death_year is not None}
    if len(birth_values) > 1 or len(death_values) > 1:
        return True

    return False


def _pick_preferred_exact_match(matches: List[Thinker]) -> Optional[Thinker]:
    if not matches:
        return None
    # Prefer records with richer canonical metadata; tie-break by id for determinism.
    return sorted(
        matches,
        key=lambda item: (
            _metadata_completeness(item),
            int(item.birth_year is not None),
            int(item.death_year is not None),
            str(item.id),
        ),
        reverse=True,
    )[0]


def _score_match(candidate_fields: Dict[str, Any], thinker: Thinker) -> Tuple[float, List[str]]:
    reasons: List[str] = []
    score = 0.0

    candidate_name = _normalize_name(candidate_fields.get("name", ""))
    thinker_name = _normalize_name(thinker.name or "")
    if candidate_name and thinker_name:
        similarity = SequenceMatcher(a=candidate_name, b=thinker_name).ratio()
        if similarity >= 0.98:
            score += 0.7
            reasons.append("exact name match")
        elif similarity >= 0.9:
            score += 0.55
            reasons.append("near-exact name match")
        elif similarity >= 0.8:
            score += 0.4
            reasons.append("high name similarity")

    candidate_birth = candidate_fields.get("birth_year")
    if candidate_birth is not None and thinker.birth_year is not None:
        if candidate_birth == thinker.birth_year:
            score += 0.15
            reasons.append("birth year match")
        elif abs(candidate_birth - thinker.birth_year) <= 2:
            score += 0.08
            reasons.append("near birth year")

    candidate_death = candidate_fields.get("death_year")
    if candidate_death is not None and thinker.death_year is not None:
        if candidate_death == thinker.death_year:
            score += 0.15
            reasons.append("death year match")
        elif abs(candidate_death - thinker.death_year) <= 2:
            score += 0.08
            reasons.append("near death year")

    candidate_field = (candidate_fields.get("field") or "").strip().lower()
    thinker_field = (thinker.field or "").strip().lower()
    if candidate_field and thinker_field:
        if candidate_field == thinker_field:
            score += 0.08
            reasons.append("field match")
        elif candidate_field in thinker_field or thinker_field in candidate_field:
            score += 0.04
            reasons.append("field overlap")

    return (round(min(score, 1.0), 4), reasons)


def _build_metadata_delta(candidate_fields: Dict[str, Any], thinker: Thinker) -> Dict[str, Dict[str, Any]]:
    delta: Dict[str, Dict[str, Any]] = {}
    compare_fields = ["birth_year", "death_year", "active_period", "field", "biography_notes"]
    for field_name in compare_fields:
        candidate_value = candidate_fields.get(field_name)
        canonical_value = getattr(thinker, field_name)
        if candidate_value is not None and canonical_value is not None and candidate_value != canonical_value:
            delta[field_name] = {
                "canonical": canonical_value,
                "extracted": candidate_value,
            }
    return delta


def _autofill_from_canonical(candidate_fields: Dict[str, Any], thinker: Thinker) -> Dict[str, Any]:
    autofilled: Dict[str, Any] = {}
    for field_name in ["birth_year", "death_year", "active_period", "field", "biography_notes"]:
        if candidate_fields.get(field_name) is not None:
            continue
        canonical_value = getattr(thinker, field_name)
        if canonical_value is None:
            continue
        candidate_fields[field_name] = canonical_value
        autofilled[field_name] = canonical_value
    return autofilled


def apply_thinker_matching(db: Session, graph: Dict[str, Any]) -> Dict[str, Any]:
    thinkers = graph.get("thinkers", []) or []
    if not thinkers:
        return graph

    all_existing = db.query(Thinker).all()
    by_name: Dict[str, List[Thinker]] = {}
    for thinker in all_existing:
        key = _normalize_name(thinker.name or "")
        by_name.setdefault(key, []).append(thinker)

    for candidate in thinkers:
        fields = candidate.get("fields", {}) or {}
        normalized_name = _normalize_name(fields.get("name", ""))
        if not normalized_name:
            candidate["match_status"] = "create_new"
            candidate["matched_thinker_id"] = None
            candidate["match_score"] = 0.0
            candidate["match_reasons"] = ["missing thinker name"]
            candidate["metadata_delta"] = {}
            continue

        exact_name_matches = by_name.get(normalized_name, [])
        candidate_birth = fields.get("birth_year")
        candidate_death = fields.get("death_year")
        exact_match_conflicts = _exact_match_has_conflicts(exact_name_matches)
        preferred_exact_match = _pick_preferred_exact_match(exact_name_matches)

        potential_matches = exact_name_matches if exact_name_matches else all_existing
        scored: List[Tuple[Thinker, float, List[str]]] = []
        score_by_id: Dict[str, Tuple[Thinker, float, List[str]]] = {}
        for thinker in potential_matches:
            score, reasons = _score_match(fields, thinker)
            if score <= 0.35:
                continue
            row = (thinker, score, reasons)
            scored.append(row)
            score_by_id[str(thinker.id)] = row

        scored.sort(key=lambda item: item[1], reverse=True)

        if not scored:
            candidate["match_status"] = "create_new"
            candidate["matched_thinker_id"] = None
            candidate["match_score"] = 0.0
            candidate["match_reasons"] = ["no strong canonical match"]
            candidate["metadata_delta"] = {}
            continue

        best, best_score, reasons = scored[0]
        if preferred_exact_match is not None:
            preferred_scored = score_by_id.get(str(preferred_exact_match.id))
            if preferred_scored is not None:
                best, best_score, reasons = preferred_scored

        if (
            len(exact_name_matches) > 1
            and candidate_birth is None
            and candidate_death is None
            and exact_match_conflicts
        ):
            # Name-only matching remains ambiguous when canonical duplicates disagree on key years.
            candidate["match_status"] = "review_needed"
        elif len(exact_name_matches) > 1 and not exact_match_conflicts:
            # Duplicates across timelines can be equivalent records; pick the richest canonical profile.
            candidate["match_status"] = "reuse_high_confidence"
            reasons = list(reasons) + ["equivalent exact-name canonical duplicates"]
        elif best_score >= 0.9:
            candidate["match_status"] = "reuse_high_confidence"
        elif best_score >= 0.75:
            candidate["match_status"] = "review_needed"
        else:
            candidate["match_status"] = "create_new"

        candidate["matched_thinker_id"] = str(best.id)
        candidate["match_score"] = best_score
        candidate["match_reasons"] = reasons
        metadata_delta = _build_metadata_delta(fields, best)

        can_autofill = (
            best_score >= AUTOPOPULATE_MIN_SCORE
            or (len(exact_name_matches) == 1 and exact_name_matches[0].id == best.id)
            or (len(exact_name_matches) > 1 and not exact_match_conflicts)
        )
        if AUTOPOPULATE_CANONICAL_FIELDS and can_autofill:
            autofilled = _autofill_from_canonical(fields, best)
            if autofilled:
                metadata_delta["autofilled_from_canonical"] = autofilled
                candidate["match_reasons"] = list(candidate["match_reasons"]) + ["autofilled canonical metadata"]
                candidate["fields"] = fields

        candidate["metadata_delta"] = metadata_delta

    graph["thinkers"] = thinkers
    return graph
