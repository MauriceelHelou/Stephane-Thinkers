"""
Algorithmic thinker-name detection and co-occurrence utilities.
"""

import re
from dataclasses import dataclass, field
from itertools import combinations
from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.thinker_mention import ThinkerCoOccurrence


@dataclass
class DetectedMatch:
    thinker_id: UUID
    thinker_name: str
    matched_text: str
    paragraph_index: int
    char_offset: int
    match_length: int


@dataclass
class ThinkerVariants:
    thinker_id: UUID
    thinker_name: str
    birth_year: Optional[int]
    death_year: Optional[int]
    field_name: Optional[str]
    variants: List[str] = field(default_factory=list)


def generate_name_variants(full_name: str) -> List[str]:
    if not full_name or not full_name.strip():
        return []

    name = full_name.strip()
    suffixes = ["Jr.", "Jr", "Sr.", "Sr", "III", "II", "IV"]
    name_without_suffix = name
    found_suffix = ""
    for suffix in suffixes:
        if name.endswith(suffix):
            name_without_suffix = name[: -len(suffix)].strip().rstrip(",")
            found_suffix = suffix
            break

    parts = name_without_suffix.split()
    variants = set([name])

    if len(parts) == 1:
        return [name]

    if found_suffix:
        variants.add(name_without_suffix)

    first_name = parts[0]
    last_name = parts[-1]

    if len(last_name) > 2:
        variants.add(last_name)

    if len(parts) > 2:
        variants.add(f"{first_name} {last_name}")

    if len(first_name) > 1:
        variants.add(f"{first_name[0]}. {last_name}")

    if len(parts) >= 3:
        initials_no_space = "".join(f"{part[0]}." for part in parts[:-1])
        initials_with_space = " ".join(f"{part[0]}." for part in parts[:-1])
        variants.add(f"{initials_no_space} {last_name}")
        variants.add(f"{initials_with_space} {last_name}")

    if len(parts) == 3:
        middle = parts[1]
        variants.add(f"{first_name} {middle[0]}. {last_name}")

    return sorted(variants, key=len, reverse=True)


def build_variant_index(thinkers: list) -> List[ThinkerVariants]:
    result: List[ThinkerVariants] = []
    for thinker in thinkers:
        result.append(
            ThinkerVariants(
                thinker_id=thinker.id,
                thinker_name=thinker.name,
                birth_year=thinker.birth_year,
                death_year=thinker.death_year,
                field_name=thinker.field,
                variants=generate_name_variants(thinker.name),
            )
        )
    return result


def detect_thinker_names(content: str, thinkers: list) -> Tuple[List[DetectedMatch], List[str]]:
    if not content or not content.strip():
        return [], []

    variant_index = build_variant_index(thinkers)
    paragraphs = content.split("\n")

    all_matches: dict[tuple[int, int], DetectedMatch] = {}
    for para_idx, paragraph in enumerate(paragraphs):
        if not paragraph.strip():
            continue
        for thinker in variant_index:
            for variant in thinker.variants:
                pattern = r"\b" + re.escape(variant) + r"\b"
                try:
                    for match in re.finditer(pattern, paragraph, re.IGNORECASE):
                        key = (para_idx, match.start())
                        candidate = DetectedMatch(
                            thinker_id=thinker.thinker_id,
                            thinker_name=thinker.thinker_name,
                            matched_text=match.group(),
                            paragraph_index=para_idx,
                            char_offset=match.start(),
                            match_length=len(variant),
                        )
                        existing = all_matches.get(key)
                        if existing is None or candidate.match_length > existing.match_length:
                            all_matches[key] = candidate
                except re.error:
                    continue

    # Remove overlaps in each paragraph by scanning in order.
    sorted_matches = sorted(all_matches.values(), key=lambda m: (m.paragraph_index, m.char_offset))
    deduped: List[DetectedMatch] = []
    for match in sorted_matches:
        if not deduped:
            deduped.append(match)
            continue
        prev = deduped[-1]
        if match.paragraph_index != prev.paragraph_index:
            deduped.append(match)
            continue
        prev_end = prev.char_offset + prev.match_length
        if match.char_offset >= prev_end:
            deduped.append(match)

    # Unknowns are explicitly marked by wiki syntax.
    wiki_names = re.findall(r"\[\[([^\]]+)\]\]", content)
    known_names_lower = {t.name.lower() for t in thinkers}
    for tv in variant_index:
        for variant in tv.variants:
            known_names_lower.add(variant.lower())

    unknown_names: List[str] = []
    seen_unknown: set[str] = set()
    for name in wiki_names:
        cleaned = name.strip()
        lower = cleaned.lower()
        if cleaned and lower not in known_names_lower and lower not in seen_unknown:
            seen_unknown.add(lower)
            unknown_names.append(cleaned)

    return deduped, unknown_names


def aggregate_matches(matches: List[DetectedMatch]) -> dict:
    aggregated: dict = {}
    for match in matches:
        item = aggregated.get(match.thinker_id)
        if item is None:
            aggregated[match.thinker_id] = {
                "thinker_id": match.thinker_id,
                "thinker_name": match.thinker_name,
                "mention_count": 1,
                "paragraph_indices": [match.paragraph_index],
            }
            continue
        item["mention_count"] += 1
        if match.paragraph_index not in item["paragraph_indices"]:
            item["paragraph_indices"].append(match.paragraph_index)
    return aggregated


def _ordered_pair(id_a: UUID, id_b: UUID) -> tuple[UUID, UUID]:
    if id_a.hex < id_b.hex:
        return id_a, id_b
    return id_b, id_a


def compute_co_occurrences(note_id: UUID, detected_thinkers: List[DetectedMatch], db: Session) -> int:
    """Recompute pairwise co-occurrence rows for a note from detection results."""
    db.query(ThinkerCoOccurrence).filter(ThinkerCoOccurrence.note_id == note_id).delete(
        synchronize_session="fetch"
    )

    if len(detected_thinkers) < 2:
        return 0

    new_records: List[ThinkerCoOccurrence] = []
    seen_keys: set[tuple[str, str, Optional[int], str]] = set()

    def add_record(a_id: UUID, b_id: UUID, paragraph_index: Optional[int], co_type: str) -> None:
        thinker_a_id, thinker_b_id = _ordered_pair(a_id, b_id)
        key = (thinker_a_id.hex, thinker_b_id.hex, paragraph_index, co_type)
        if key in seen_keys:
            return
        seen_keys.add(key)
        new_records.append(
            ThinkerCoOccurrence(
                thinker_a_id=thinker_a_id,
                thinker_b_id=thinker_b_id,
                note_id=note_id,
                paragraph_index=paragraph_index,
                co_occurrence_type=co_type,
            )
        )

    by_paragraph: dict[int, set[UUID]] = {}
    all_thinker_ids: set[UUID] = set()
    for match in detected_thinkers:
        all_thinker_ids.add(match.thinker_id)
        by_paragraph.setdefault(match.paragraph_index, set()).add(match.thinker_id)

    # Same paragraph pairs (strong signal)
    for paragraph_index, thinker_ids in by_paragraph.items():
        if len(thinker_ids) < 2:
            continue
        for a_id, b_id in combinations(sorted(thinker_ids, key=lambda tid: tid.hex), 2):
            add_record(a_id, b_id, paragraph_index, "same_paragraph")

    # Same note pairs (broader signal)
    if len(all_thinker_ids) >= 2:
        for a_id, b_id in combinations(sorted(all_thinker_ids, key=lambda tid: tid.hex), 2):
            add_record(a_id, b_id, None, "same_note")

    if new_records:
        db.bulk_save_objects(new_records)
    return len(new_records)
