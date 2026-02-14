from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.database import get_db
from app.models.tag import Tag
from app.schemas import tag as schemas

router = APIRouter(prefix="/api/note-tags", tags=["note-tags"])


@router.post("/", response_model=schemas.Tag, status_code=201)
def create_note_tag(tag: schemas.TagCreate, db: Session = Depends(get_db)):
    existing_tag = db.query(Tag).filter(func.lower(Tag.name) == tag.name.lower()).first()
    if existing_tag:
        return existing_tag

    db_tag = Tag(**tag.model_dump())
    db.add(db_tag)
    try:
        db.commit()
        db.refresh(db_tag)
    except IntegrityError:
        db.rollback()
        existing_tag = db.query(Tag).filter(func.lower(Tag.name) == tag.name.lower()).first()
        if existing_tag:
            return existing_tag
        raise HTTPException(status_code=400, detail="Note tag name already exists")

    return db_tag


@router.get("/", response_model=List[schemas.Tag])
def get_note_tags(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
):
    return db.query(Tag).order_by(Tag.name.asc()).offset(skip).limit(limit).all()


@router.get("/{tag_id}", response_model=schemas.Tag)
def get_note_tag(tag_id: UUID, db: Session = Depends(get_db)):
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if tag is None:
        raise HTTPException(status_code=404, detail="Note tag not found")
    return tag


@router.put("/{tag_id}", response_model=schemas.Tag)
def update_note_tag(tag_id: UUID, tag_update: schemas.TagUpdate, db: Session = Depends(get_db)):
    db_tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if db_tag is None:
        raise HTTPException(status_code=404, detail="Note tag not found")

    update_data = tag_update.model_dump(exclude_unset=True)
    if "name" in update_data:
        existing_tag = (
            db.query(Tag)
            .filter(func.lower(Tag.name) == update_data["name"].lower(), Tag.id != tag_id)
            .first()
        )
        if existing_tag:
            raise HTTPException(status_code=400, detail="Note tag name already exists")

    for field, value in update_data.items():
        setattr(db_tag, field, value)

    try:
        db.commit()
        db.refresh(db_tag)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Note tag name already exists")

    return db_tag


@router.delete("/{tag_id}", status_code=204)
def delete_note_tag(tag_id: UUID, db: Session = Depends(get_db)):
    db_tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if db_tag is None:
        raise HTTPException(status_code=404, detail="Note tag not found")

    db.delete(db_tag)
    db.commit()
    return None
