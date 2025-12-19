from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from uuid import UUID

from app.database import get_db
from app.models.thinker import Thinker
from app.schemas import thinker as schemas

router = APIRouter(prefix="/api/thinkers", tags=["thinkers"])

@router.post("/", response_model=schemas.Thinker, status_code=201)
def create_thinker(thinker: schemas.ThinkerCreate, db: Session = Depends(get_db)):
    # Validate that the timeline exists if timeline_id is provided
    if thinker.timeline_id:
        from app.models.timeline import Timeline
        timeline = db.query(Timeline).filter(Timeline.id == thinker.timeline_id).first()
        if not timeline:
            raise HTTPException(status_code=404, detail=f"Timeline with id {thinker.timeline_id} not found")

    db_thinker = Thinker(**thinker.model_dump())
    db.add(db_thinker)
    db.commit()
    db.refresh(db_thinker)
    return db_thinker

# BUG #8 FIX: Add optional timeline_id filter parameter
@router.get("/", response_model=List[schemas.Thinker])
def get_thinkers(
    skip: int = 0,
    limit: int = 100,
    timeline_id: Optional[UUID] = Query(None, description="Filter by timeline ID"),
    db: Session = Depends(get_db)
):
    query = db.query(Thinker)
    if timeline_id:
        query = query.filter(Thinker.timeline_id == timeline_id)
    thinkers = query.offset(skip).limit(limit).all()
    return thinkers

@router.get("/{thinker_id}", response_model=schemas.ThinkerWithRelations)
def get_thinker(thinker_id: UUID, db: Session = Depends(get_db)):
    thinker = db.query(Thinker).options(
        joinedload(Thinker.publications),
        joinedload(Thinker.quotes),
        joinedload(Thinker.tags)
    ).filter(Thinker.id == thinker_id).first()

    if thinker is None:
        raise HTTPException(status_code=404, detail="Thinker not found")
    return thinker

@router.put("/{thinker_id}", response_model=schemas.Thinker)
def update_thinker(thinker_id: UUID, thinker_update: schemas.ThinkerUpdate, db: Session = Depends(get_db)):
    db_thinker = db.query(Thinker).filter(Thinker.id == thinker_id).first()

    if db_thinker is None:
        raise HTTPException(status_code=404, detail="Thinker not found")

    update_data = thinker_update.model_dump(exclude_unset=True)

    # Validate that the timeline exists if timeline_id is being updated
    if 'timeline_id' in update_data and update_data['timeline_id']:
        from app.models.timeline import Timeline
        timeline = db.query(Timeline).filter(Timeline.id == update_data['timeline_id']).first()
        if not timeline:
            raise HTTPException(status_code=404, detail=f"Timeline with id {update_data['timeline_id']} not found")

    for field, value in update_data.items():
        setattr(db_thinker, field, value)

    db.commit()
    db.refresh(db_thinker)
    return db_thinker

@router.delete("/{thinker_id}", status_code=204)
def delete_thinker(thinker_id: UUID, db: Session = Depends(get_db)):
    db_thinker = db.query(Thinker).filter(Thinker.id == thinker_id).first()

    if db_thinker is None:
        raise HTTPException(status_code=404, detail="Thinker not found")

    db.delete(db_thinker)
    db.commit()
    return None
