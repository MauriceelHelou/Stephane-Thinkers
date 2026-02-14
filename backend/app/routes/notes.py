from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload
from typing import List, Optional
from uuid import UUID

from app.constants import notes_ai_phase_enabled
from app.database import get_db
from app.models.critical_term import TermOccurrence
from app.models.folder import Folder
from app.models.note import Note, NoteVersion, note_mentions
from app.models.tag import Tag
from app.models.thinker import Thinker
from app.models.thinker_mention import ThinkerMention
from app.schemas import note as schemas
from app.schemas.analysis import (
    DetectedThinker,
    DraftFromExcerptsRequest,
    DraftFromExcerptsResponse,
    ThinkerDetectionResult,
    YearAnnotationResult,
)
from app.schemas.note import parse_wiki_links, convert_wiki_links_to_html
from app.utils.term_scanner import scan_note_for_all_terms
from app.utils.thinker_detection import (
    aggregate_matches,
    compute_co_occurrences,
    detect_thinker_names,
)
from app.utils.year_insertion import insert_years_html, insert_years_plain_text

router = APIRouter(prefix="/api/notes", tags=["notes"])


def validate_thinker_exists(db: Session, thinker_id: UUID):
    thinker = db.query(Thinker).filter(Thinker.id == thinker_id).first()
    if not thinker:
        raise HTTPException(status_code=404, detail=f"Thinker with id {thinker_id} not found")
    return thinker


def validate_folder_exists(db: Session, folder_id: UUID, check_archived: bool = False):
    folder = db.query(Folder).filter(Folder.id == folder_id).first()
    if not folder:
        raise HTTPException(status_code=404, detail=f"Folder with id {folder_id} not found")
    if check_archived and folder.is_archived:
        raise HTTPException(status_code=400, detail="Cannot add or move notes into an archived folder")
    return folder


def parse_tag_ids_query_param(tag_ids: Optional[str]) -> List[UUID]:
    """Parse comma-separated tag IDs from query params."""
    if not tag_ids:
        return []

    parsed: List[UUID] = []
    for raw_value in tag_ids.split(","):
        candidate = raw_value.strip()
        if not candidate:
            continue
        try:
            parsed.append(UUID(candidate))
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=f"Invalid UUID in tag_ids: {candidate}") from exc

    # Preserve ordering while removing duplicates.
    return list(dict.fromkeys(parsed))


def get_tags_by_ids(db: Session, tag_ids: List[UUID]) -> List[Tag]:
    """Fetch tags by IDs and ensure all requested IDs exist."""
    if not tag_ids:
        return []

    db_tags = db.query(Tag).filter(Tag.id.in_(tag_ids)).all()
    found_ids = {tag.id for tag in db_tags}
    missing_ids = [str(tag_id) for tag_id in tag_ids if tag_id not in found_ids]
    if missing_ids:
        raise HTTPException(status_code=404, detail=f"Unknown tag IDs: {', '.join(missing_ids)}")

    # Return in input order for stable responses.
    tags_by_id = {tag.id: tag for tag in db_tags}
    return [tags_by_id[tag_id] for tag_id in tag_ids if tag_id in tags_by_id]


def process_wiki_links(db: Session, note: Note, content: str, content_html: Optional[str] = None):
    """Process [[Thinker Name]] links and create mention relationships."""
    note.mentioned_thinkers = []

    mentioned_names = parse_wiki_links(content)
    normalized_names = []
    seen = set()
    for name in mentioned_names:
        key = name.strip().lower()
        if key and key not in seen:
            seen.add(key)
            normalized_names.append(key)

    thinker_map = {}
    if normalized_names:
        matched_thinkers = db.query(Thinker).filter(func.lower(Thinker.name).in_(normalized_names)).all()
        thinkers_by_name = {thinker.name.lower(): thinker for thinker in matched_thinkers}

        for key in normalized_names:
            thinker = thinkers_by_name.get(key)
            if thinker:
                note.mentioned_thinkers.append(thinker)
                thinker_map[key] = {"id": str(thinker.id), "name": thinker.name}

    if content_html is not None and content_html.strip():
        note.content_html = content_html
    else:
        note.content_html = convert_wiki_links_to_html(content, thinker_map)


@router.post("/", response_model=schemas.NoteWithMentions, status_code=201)
def create_note(note_data: schemas.NoteCreate, db: Session = Depends(get_db)):
    if note_data.thinker_id:
        validate_thinker_exists(db, note_data.thinker_id)
    if note_data.folder_id:
        validate_folder_exists(db, note_data.folder_id, check_archived=True)
    requested_tag_ids = list(dict.fromkeys(note_data.tag_ids or []))
    requested_tags = get_tags_by_ids(db, requested_tag_ids)

    db_note = Note(**note_data.model_dump(exclude={"tag_ids"}))
    db.add(db_note)
    db.flush()

    process_wiki_links(db, db_note, note_data.content, note_data.content_html)
    db_note.tags = requested_tags
    scan_note_for_all_terms(db, db_note.id)

    db.commit()
    db.refresh(db_note)
    return db_note


@router.get("/", response_model=List[schemas.Note])
def get_notes(
    thinker_id: Optional[UUID] = None,
    note_type: Optional[str] = None,
    is_canvas_note: Optional[bool] = None,
    folder_id: Optional[UUID] = None,
    tag_ids: Optional[str] = Query(
        None,
        description="Comma-separated tag UUIDs; only notes with ALL selected tags are returned.",
    ),
    include_archived: bool = False,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
):
    parsed_tag_ids = parse_tag_ids_query_param(tag_ids)
    query = db.query(Note).options(selectinload(Note.tags))

    if thinker_id:
        query = query.filter(Note.thinker_id == thinker_id)
    if note_type:
        query = query.filter(Note.note_type == note_type)
    if is_canvas_note is not None:
        query = query.filter(Note.is_canvas_note == is_canvas_note)
    if folder_id:
        query = query.filter(Note.folder_id == folder_id)
    if parsed_tag_ids:
        tag_filter_subquery = (
            db.query(Note.id.label("note_id"))
            .join(Note.tags)
            .filter(Tag.id.in_(parsed_tag_ids))
            .group_by(Note.id)
            .having(func.count(func.distinct(Tag.id)) == len(parsed_tag_ids))
            .subquery()
        )
        query = query.join(tag_filter_subquery, Note.id == tag_filter_subquery.c.note_id)

    if not include_archived:
        query = query.outerjoin(Folder, Note.folder_id == Folder.id).filter(
            (Note.folder_id.is_(None)) | (Folder.is_archived == False)  # noqa: E712
        )

    notes = query.order_by(Note.updated_at.desc()).offset(skip).limit(limit).all()
    return notes


@router.get("/backlinks/{thinker_id}", response_model=List[schemas.Note])
def get_backlinks(thinker_id: UUID, db: Session = Depends(get_db)):
    validate_thinker_exists(db, thinker_id)

    notes = (
        db.query(Note)
        .options(selectinload(Note.tags))
        .join(note_mentions)
        .filter(note_mentions.c.mentioned_thinker_id == thinker_id)
        .order_by(Note.updated_at.desc())
        .all()
    )
    return notes


@router.get("/{note_id}/versions", response_model=List[schemas.NoteVersion])
def get_note_versions(note_id: UUID, db: Session = Depends(get_db)):
    db_note = db.query(Note).filter(Note.id == note_id).first()
    if db_note is None:
        raise HTTPException(status_code=404, detail="Note not found")

    versions = (
        db.query(NoteVersion)
        .filter(NoteVersion.note_id == note_id)
        .order_by(NoteVersion.version_number.desc())
        .all()
    )
    return versions


@router.post("/{note_id}/detect-thinkers", response_model=ThinkerDetectionResult)
def detect_thinkers_in_note(note_id: UUID, db: Session = Depends(get_db)):
    db_note = db.query(Note).filter(Note.id == note_id).first()
    if db_note is None:
        raise HTTPException(status_code=404, detail="Note not found")

    all_thinkers = db.query(Thinker).all()
    matches, unknown_names = detect_thinker_names(db_note.content or "", all_thinkers)

    db.query(ThinkerMention).filter(ThinkerMention.note_id == note_id).delete(synchronize_session="fetch")

    for match in matches:
        db.add(
            ThinkerMention(
                note_id=note_id,
                thinker_id=match.thinker_id,
                paragraph_index=match.paragraph_index,
                char_offset=match.char_offset,
                mention_text=match.matched_text,
                is_auto_detected=True,
            )
        )

    mentioned_ids = sorted({match.thinker_id for match in matches}, key=lambda tid: tid.hex)
    db_note.mentioned_thinkers = []
    if mentioned_ids:
        mentioned = db.query(Thinker).filter(Thinker.id.in_(mentioned_ids)).all()
        thinker_by_id = {thinker.id: thinker for thinker in mentioned}
        for thinker_id in mentioned_ids:
            thinker = thinker_by_id.get(thinker_id)
            if thinker:
                db_note.mentioned_thinkers.append(thinker)

    compute_co_occurrences(note_id=note_id, detected_thinkers=matches, db=db)
    db.commit()

    aggregated = aggregate_matches(matches)
    thinker_map = {thinker.id: thinker for thinker in all_thinkers}

    known_thinkers: List[DetectedThinker] = []
    for thinker_id, data in aggregated.items():
        thinker = thinker_map.get(thinker_id)
        if thinker is None:
            continue
        known_thinkers.append(
            DetectedThinker(
                id=thinker.id,
                name=thinker.name,
                birth_year=thinker.birth_year,
                death_year=thinker.death_year,
                field=thinker.field,
                mention_count=data["mention_count"],
                paragraph_indices=sorted(data["paragraph_indices"]),
            )
        )

    known_thinkers.sort(key=lambda item: item.mention_count, reverse=True)

    return ThinkerDetectionResult(
        known_thinkers=known_thinkers,
        unknown_names=unknown_names,
        total_mentions=sum(item.mention_count for item in known_thinkers),
    )


@router.post("/{note_id}/annotate-years", response_model=YearAnnotationResult)
def annotate_years_in_note(note_id: UUID, db: Session = Depends(get_db)):
    db_note = (
        db.query(Note)
        .options(selectinload(Note.mentioned_thinkers))
        .filter(Note.id == note_id)
        .first()
    )
    if db_note is None:
        raise HTTPException(status_code=404, detail="Note not found")

    # Years are applied only for thinkers explicitly linked to the note.
    thinkers_with_years = [t for t in db_note.mentioned_thinkers if t.birth_year or t.death_year]
    if not thinkers_with_years:
        return YearAnnotationResult(
            content_modified=False,
            updated_content=db_note.content,
            updated_content_html=db_note.content_html,
        )

    matches, _ = detect_thinker_names(db_note.content or "", thinkers_with_years)
    if not matches:
        return YearAnnotationResult(
            content_modified=False,
            updated_content=db_note.content,
            updated_content_html=db_note.content_html,
        )

    thinker_years = {
        thinker.id: (thinker.birth_year, thinker.death_year)
        for thinker in thinkers_with_years
    }
    original_content = db_note.content
    original_html = db_note.content_html

    if db_note.content:
        db_note.content = insert_years_plain_text(db_note.content, matches, thinker_years)
    if db_note.content_html:
        db_note.content_html = insert_years_html(db_note.content_html, matches, thinker_years)

    content_modified = (db_note.content != original_content) or (db_note.content_html != original_html)
    if content_modified:
        db.commit()

    return YearAnnotationResult(
        content_modified=content_modified,
        updated_content=db_note.content,
        updated_content_html=db_note.content_html,
    )


@router.get("/{note_id}", response_model=schemas.NoteWithMentions)
def get_note(note_id: UUID, db: Session = Depends(get_db)):
    db_note = (
        db.query(Note)
        .options(selectinload(Note.mentioned_thinkers), selectinload(Note.tags))
        .filter(Note.id == note_id)
        .first()
    )

    if db_note is None:
        raise HTTPException(status_code=404, detail="Note not found")

    return db_note


@router.put("/{note_id}", response_model=schemas.NoteWithMentions)
def update_note(note_id: UUID, note_update: schemas.NoteUpdate, db: Session = Depends(get_db)):
    db_note = db.query(Note).options(selectinload(Note.tags)).filter(Note.id == note_id).first()

    if db_note is None:
        raise HTTPException(status_code=404, detail="Note not found")

    if note_update.folder_id:
        validate_folder_exists(db, note_update.folder_id, check_archived=True)

    version_count = db.query(func.coalesce(func.max(NoteVersion.version_number), 0)).filter(
        NoteVersion.note_id == note_id
    ).scalar()
    version = NoteVersion(
        note_id=note_id,
        content=db_note.content,
        version_number=(version_count or 0) + 1,
    )
    db.add(version)

    update_data = note_update.model_dump(exclude_unset=True)
    tag_ids_update = update_data.pop("tag_ids", None)
    if tag_ids_update is not None:
        requested_tag_ids = list(dict.fromkeys(tag_ids_update))
        db_note.tags = get_tags_by_ids(db, requested_tag_ids)

    for field, value in update_data.items():
        setattr(db_note, field, value)

    if "content" in update_data:
        process_wiki_links(
            db,
            db_note,
            update_data["content"],
            update_data.get("content_html"),
        )
        scan_note_for_all_terms(db, note_id)

    db.commit()
    db.refresh(db_note)
    return db_note


@router.delete("/{note_id}", status_code=204)
def delete_note(note_id: UUID, db: Session = Depends(get_db)):
    db_note = db.query(Note).filter(Note.id == note_id).first()

    if db_note is None:
        raise HTTPException(status_code=404, detail="Note not found")

    db.delete(db_note)
    db.commit()
    return None


@router.post("/draft-from-excerpts", response_model=DraftFromExcerptsResponse)
def draft_from_excerpts(payload: DraftFromExcerptsRequest, db: Session = Depends(get_db)):
    if not notes_ai_phase_enabled("C"):
        raise HTTPException(status_code=503, detail="Notes AI phase C is disabled")

    if not payload.excerpt_ids:
        return DraftFromExcerptsResponse(draft="", citations=[])

    occurrences = (
        db.query(TermOccurrence, Note)
        .join(Note, Note.id == TermOccurrence.note_id)
        .filter(TermOccurrence.id.in_(payload.excerpt_ids))
        .all()
    )

    if not occurrences:
        return DraftFromExcerptsResponse(draft="", citations=[])

    lines = []
    citations: List[str] = []
    for index, (occurrence, note) in enumerate(occurrences, start=1):
        lines.append(
            f"{index}. {occurrence.context_snippet.strip()} (from {note.title or 'Untitled note'})"
        )
        citations.append(str(note.id))

    intro = "Synthesized draft (evidence-first):"
    body = " ".join([line.split(". ", 1)[1] for line in lines[:5]])
    if payload.tone:
        intro = f"Synthesized draft in {payload.tone} tone (evidence-first):"

    max_length = max(200, min(payload.max_length or 800, 2000))
    draft = f"{intro}\n\n{body}".strip()[:max_length]
    return DraftFromExcerptsResponse(draft=draft, citations=citations)
