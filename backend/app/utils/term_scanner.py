"""
Regex-based critical term scanning utilities.
"""

import re
from dataclasses import dataclass
from typing import List
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.critical_term import CriticalTerm, TermOccurrence
from app.models.note import Note


@dataclass
class TermMatch:
    term_id: UUID
    context_snippet: str
    paragraph_index: int
    char_offset: int


def _strip_html_tags(content: str) -> str:
    text = re.sub(r"</(?:p|div|h[1-6]|li|blockquote)>", "\n", content, flags=re.IGNORECASE)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    text = (
        text.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", '"')
        .replace("&#39;", "'")
        .replace("&nbsp;", " ")
    )
    return text


def _extract_context_snippet(content: str, match_start: int, match_end: int, window: int = 100) -> str:
    snippet_start = max(0, match_start - window)
    snippet_end = min(len(content), match_end + window)
    prefix = "..." if snippet_start > 0 else ""
    suffix = "..." if snippet_end < len(content) else ""
    return f"{prefix}{content[snippet_start:snippet_end]}{suffix}"


def _compute_paragraph_index(content: str, char_offset: int) -> int:
    return content[:char_offset].count("\n")


def scan_note_for_terms(content: str, terms: list) -> List[TermMatch]:
    if not content or not terms:
        return []

    plain_text = _strip_html_tags(content)
    if not plain_text.strip():
        return []

    matches: List[TermMatch] = []
    for term in terms:
        pattern = r"\b" + re.escape(term.name) + r"\b"
        for found in re.finditer(pattern, plain_text, re.IGNORECASE):
            matches.append(
                TermMatch(
                    term_id=term.id,
                    context_snippet=_extract_context_snippet(plain_text, found.start(), found.end(), window=100),
                    paragraph_index=_compute_paragraph_index(plain_text, found.start()),
                    char_offset=found.start(),
                )
            )
    return matches


def scan_all_notes_for_term(db: Session, term: CriticalTerm) -> int:
    db.query(TermOccurrence).filter(TermOccurrence.term_id == term.id).delete()

    notes = db.query(Note).filter(Note.is_canvas_note == False).all()  # noqa: E712
    new_occurrences: list[TermOccurrence] = []
    for note in notes:
        content = note.content or ""
        if not content.strip():
            continue
        for match in scan_note_for_terms(content, [term]):
            new_occurrences.append(
                TermOccurrence(
                    term_id=match.term_id,
                    note_id=note.id,
                    context_snippet=match.context_snippet,
                    paragraph_index=match.paragraph_index,
                    char_offset=match.char_offset,
                )
            )

    if new_occurrences:
        db.bulk_save_objects(new_occurrences)
    db.flush()
    return len(new_occurrences)


def scan_note_for_all_terms(db: Session, note_id: UUID) -> int:
    db.query(TermOccurrence).filter(TermOccurrence.note_id == note_id).delete()

    note = db.query(Note).filter(Note.id == note_id).first()
    if not note or not note.content or not note.content.strip() or note.is_canvas_note:
        return 0

    active_terms = db.query(CriticalTerm).filter(CriticalTerm.is_active == True).all()  # noqa: E712
    if not active_terms:
        return 0

    matches = scan_note_for_terms(note.content, active_terms)
    new_occurrences: list[TermOccurrence] = []
    for match in matches:
        new_occurrences.append(
            TermOccurrence(
                term_id=match.term_id,
                note_id=note.id,
                context_snippet=match.context_snippet,
                paragraph_index=match.paragraph_index,
                char_offset=match.char_offset,
            )
        )

    if new_occurrences:
        db.bulk_save_objects(new_occurrences)
    db.flush()
    return len(new_occurrences)
