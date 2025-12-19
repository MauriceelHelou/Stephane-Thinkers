from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.database import get_db
from app.models.publication import Publication
from app.models.thinker import Thinker
from app.schemas import publication as schemas
from app.utils.citation_formatter import (
    format_citation_chicago,
    format_citation_mla,
    format_citation_apa,
)

router = APIRouter(prefix="/api/publications", tags=["publications"])


def validate_thinker_exists(db: Session, thinker_id: UUID):
    """Validate that the thinker exists in the database."""
    thinker = db.query(Thinker).filter(Thinker.id == thinker_id).first()
    if not thinker:
        raise HTTPException(status_code=404, detail=f"Thinker with id {thinker_id} not found")


@router.post("/", response_model=schemas.Publication, status_code=201)
def create_publication(publication: schemas.PublicationCreate, db: Session = Depends(get_db)):
    # Validate thinker exists
    validate_thinker_exists(db, publication.thinker_id)

    db_publication = Publication(**publication.model_dump())
    db.add(db_publication)
    db.commit()
    db.refresh(db_publication)
    return db_publication

@router.get("/", response_model=List[schemas.Publication])
def get_publications(thinker_id: UUID = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(Publication)
    if thinker_id:
        query = query.filter(Publication.thinker_id == thinker_id)
    publications = query.offset(skip).limit(limit).all()
    return publications

@router.get("/{publication_id}", response_model=schemas.Publication)
def get_publication(publication_id: UUID, db: Session = Depends(get_db)):
    db_publication = db.query(Publication).filter(Publication.id == publication_id).first()

    if db_publication is None:
        raise HTTPException(status_code=404, detail="Publication not found")

    return db_publication

@router.put("/{publication_id}", response_model=schemas.Publication)
def update_publication(publication_id: UUID, publication_update: schemas.PublicationUpdate, db: Session = Depends(get_db)):
    db_publication = db.query(Publication).filter(Publication.id == publication_id).first()

    if db_publication is None:
        raise HTTPException(status_code=404, detail="Publication not found")

    update_data = publication_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_publication, field, value)

    db.commit()
    db.refresh(db_publication)
    return db_publication

@router.delete("/{publication_id}", status_code=204)
def delete_publication(publication_id: UUID, db: Session = Depends(get_db)):
    db_publication = db.query(Publication).filter(Publication.id == publication_id).first()

    if db_publication is None:
        raise HTTPException(status_code=404, detail="Publication not found")

    db.delete(db_publication)
    db.commit()
    return None


@router.get("/{publication_id}/citations")
def get_publication_citations(publication_id: UUID, db: Session = Depends(get_db)):
    """Get formatted citations for a publication in multiple styles."""
    db_publication = db.query(Publication).filter(Publication.id == publication_id).first()

    if db_publication is None:
        raise HTTPException(status_code=404, detail="Publication not found")

    return {
        "chicago": format_citation_chicago(db_publication),
        "mla": format_citation_mla(db_publication),
        "apa": format_citation_apa(db_publication),
    }
