from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from uuid import UUID

from app.database import get_db
from app.models.note import Note, NoteVersion, note_mentions
from app.models.thinker import Thinker
from app.schemas import note as schemas
from app.schemas.note import parse_wiki_links, convert_wiki_links_to_html

router = APIRouter(prefix="/api/notes", tags=["notes"])


def validate_thinker_exists(db: Session, thinker_id: UUID):
    """Validate that the thinker exists in the database."""
    thinker = db.query(Thinker).filter(Thinker.id == thinker_id).first()
    if not thinker:
        raise HTTPException(status_code=404, detail=f"Thinker with id {thinker_id} not found")
    return thinker


def process_wiki_links(db: Session, note: Note, content: str):
    """Process [[Thinker Name]] links and create mention relationships."""
    # Clear existing mentions
    note.mentioned_thinkers = []

    # Parse wiki links from content
    mentioned_names = parse_wiki_links(content)

    # Build thinker map for HTML conversion
    thinker_map = {}
    for name in mentioned_names:
        thinker = db.query(Thinker).filter(Thinker.name.ilike(name)).first()
        if thinker:
            note.mentioned_thinkers.append(thinker)
            thinker_map[name.lower()] = {"id": str(thinker.id), "name": thinker.name}

    # Convert wiki links to HTML
    note.content_html = convert_wiki_links_to_html(content, thinker_map)


@router.post("/", response_model=schemas.NoteWithMentions, status_code=201)
def create_note(note_data: schemas.NoteCreate, db: Session = Depends(get_db)):
    if note_data.thinker_id:
        validate_thinker_exists(db, note_data.thinker_id)

    db_note = Note(**note_data.model_dump())
    db.add(db_note)
    db.flush()  # Get the ID before processing mentions

    # Process wiki links
    process_wiki_links(db, db_note, note_data.content)

    db.commit()
    db.refresh(db_note)

    return db_note


@router.get("/", response_model=List[schemas.Note])
def get_notes(
    thinker_id: Optional[UUID] = None,
    note_type: Optional[str] = None,
    is_canvas_note: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(Note)

    if thinker_id:
        query = query.filter(Note.thinker_id == thinker_id)
    if note_type:
        query = query.filter(Note.note_type == note_type)
    if is_canvas_note is not None:
        query = query.filter(Note.is_canvas_note == is_canvas_note)

    notes = query.order_by(Note.updated_at.desc()).offset(skip).limit(limit).all()
    return notes


@router.get("/{note_id}", response_model=schemas.NoteWithMentions)
def get_note(note_id: UUID, db: Session = Depends(get_db)):
    db_note = db.query(Note).options(
        joinedload(Note.mentioned_thinkers)
    ).filter(Note.id == note_id).first()

    if db_note is None:
        raise HTTPException(status_code=404, detail="Note not found")

    return db_note


@router.put("/{note_id}", response_model=schemas.NoteWithMentions)
def update_note(note_id: UUID, note_update: schemas.NoteUpdate, db: Session = Depends(get_db)):
    db_note = db.query(Note).filter(Note.id == note_id).first()

    if db_note is None:
        raise HTTPException(status_code=404, detail="Note not found")

    # Save version before updating
    version_count = db.query(NoteVersion).filter(NoteVersion.note_id == note_id).count()
    version = NoteVersion(
        note_id=note_id,
        content=db_note.content,
        version_number=version_count + 1
    )
    db.add(version)

    update_data = note_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_note, field, value)

    # Re-process wiki links if content changed
    if 'content' in update_data:
        process_wiki_links(db, db_note, update_data['content'])

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


@router.get("/{note_id}/versions", response_model=List[schemas.NoteVersion])
def get_note_versions(note_id: UUID, db: Session = Depends(get_db)):
    """Get version history for a note."""
    db_note = db.query(Note).filter(Note.id == note_id).first()

    if db_note is None:
        raise HTTPException(status_code=404, detail="Note not found")

    versions = db.query(NoteVersion).filter(
        NoteVersion.note_id == note_id
    ).order_by(NoteVersion.version_number.desc()).all()

    return versions


@router.get("/backlinks/{thinker_id}", response_model=List[schemas.Note])
def get_backlinks(thinker_id: UUID, db: Session = Depends(get_db)):
    """Get all notes that mention a specific thinker (backlinks)."""
    validate_thinker_exists(db, thinker_id)

    notes = db.query(Note).join(
        note_mentions
    ).filter(
        note_mentions.c.mentioned_thinker_id == thinker_id
    ).order_by(Note.updated_at.desc()).all()

    return notes
