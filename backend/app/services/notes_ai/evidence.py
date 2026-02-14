from collections import defaultdict
from datetime import date
from typing import Dict, List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.critical_term import CriticalTerm, TermOccurrence
from app.models.folder import Folder
from app.models.note import Note
from app.models.thinker import Thinker
from app.models.thinker_mention import ThinkerMention
from app.schemas import critical_term as schemas


def build_term_evidence_map(
    db: Session,
    term_id: UUID,
    folder_id: Optional[UUID] = None,
    thinker_id: Optional[UUID] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> schemas.TermEvidenceMapResponse:
    term = db.query(CriticalTerm).filter(CriticalTerm.id == term_id).first()
    if term is None:
        raise ValueError("Critical term not found")

    query = (
        db.query(TermOccurrence, Note, Folder)
        .join(Note, TermOccurrence.note_id == Note.id)
        .outerjoin(Folder, Note.folder_id == Folder.id)
        .filter(TermOccurrence.term_id == term_id)
    )

    if folder_id is not None:
        query = query.filter(Note.folder_id == folder_id)
    if thinker_id is not None:
        query = query.join(ThinkerMention, ThinkerMention.note_id == Note.id).filter(
            ThinkerMention.thinker_id == thinker_id
        )
    if date_from is not None:
        query = query.filter(Note.updated_at >= date_from)
    if date_to is not None:
        query = query.filter(Note.updated_at <= date_to)

    rows = query.order_by(Note.updated_at.desc()).all()
    note_ids = list({note.id for _, note, _ in rows})

    mentions = (
        db.query(ThinkerMention.note_id, Thinker.id, Thinker.name)
        .join(Thinker, ThinkerMention.thinker_id == Thinker.id)
        .filter(ThinkerMention.note_id.in_(note_ids))
        .all()
        if note_ids
        else []
    )

    thinkers_by_note: Dict[UUID, List[dict]] = defaultdict(list)
    seen_note_thinker = set()
    for note_id_val, thinker_uuid, thinker_name in mentions:
        key = (note_id_val, thinker_uuid)
        if key in seen_note_thinker:
            continue
        seen_note_thinker.add(key)
        thinkers_by_note[note_id_val].append({"id": str(thinker_uuid), "name": thinker_name})

    excerpts: List[schemas.TermOccurrenceResponse] = []
    thinker_distribution: Dict[str, int] = defaultdict(int)
    folder_distribution: Dict[str, int] = defaultdict(int)
    note_ids_with_occurrence: set[UUID] = set()

    for occurrence, note, folder in rows:
        associated_thinkers = thinkers_by_note.get(note.id, [])
        thinker_names = [t["name"] for t in associated_thinkers]
        for thinker_name in thinker_names:
            thinker_distribution[thinker_name] += 1

        folder_name = folder.name if folder is not None else "Unfiled"
        folder_distribution[folder_name] += 1
        note_ids_with_occurrence.add(note.id)

        excerpts.append(
            schemas.TermOccurrenceResponse(
                id=occurrence.id,
                term_id=occurrence.term_id,
                note_id=occurrence.note_id,
                context_snippet=occurrence.context_snippet,
                paragraph_index=occurrence.paragraph_index,
                char_offset=occurrence.char_offset,
                created_at=occurrence.created_at,
                note_title=note.title or "Untitled note",
                folder_name=folder_name,
                thinker_names=thinker_names,
                note_folder_name=folder_name,
                note_folder_id=note.folder_id,
                associated_thinkers=associated_thinkers,
            )
        )

    co_term_rows = (
        db.query(CriticalTerm.name)
        .join(TermOccurrence, TermOccurrence.term_id == CriticalTerm.id)
        .join(Note, Note.id == TermOccurrence.note_id)
        .filter(Note.id.in_(note_ids_with_occurrence))
        .filter(CriticalTerm.id != term_id)
        .distinct()
        .order_by(CriticalTerm.name.asc())
        .limit(20)
        .all()
        if note_ids_with_occurrence
        else []
    )

    return schemas.TermEvidenceMapResponse(
        term=schemas.CriticalTerm.model_validate(term),
        excerpts=excerpts,
        stats=schemas.EvidenceStats(
            total_occurrences=len(excerpts),
            total_notes=len(note_ids_with_occurrence),
            thinker_distribution=dict(sorted(thinker_distribution.items())),
            folder_distribution=dict(sorted(folder_distribution.items())),
            co_terms=[row[0] for row in co_term_rows],
        ),
    )
