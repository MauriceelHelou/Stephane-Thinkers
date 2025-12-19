from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.database import get_db
from app.models.timeline import Timeline
from app.schemas import timeline as schemas

router = APIRouter(prefix="/api/timelines", tags=["timelines"])

@router.post("/", response_model=schemas.Timeline, status_code=201)
def create_timeline(timeline: schemas.TimelineCreate, db: Session = Depends(get_db)):
    db_timeline = Timeline(**timeline.model_dump())
    db.add(db_timeline)
    db.commit()
    db.refresh(db_timeline)
    return db_timeline

@router.get("/", response_model=List[schemas.Timeline])
def get_timelines(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    timelines = db.query(Timeline).offset(skip).limit(limit).all()
    return timelines

@router.get("/{timeline_id}", response_model=schemas.Timeline)
def get_timeline(timeline_id: UUID, db: Session = Depends(get_db)):
    timeline = db.query(Timeline).filter(Timeline.id == timeline_id).first()

    if timeline is None:
        raise HTTPException(status_code=404, detail="Timeline not found")
    return timeline

@router.put("/{timeline_id}", response_model=schemas.Timeline)
def update_timeline(timeline_id: UUID, timeline_update: schemas.TimelineUpdate, db: Session = Depends(get_db)):
    db_timeline = db.query(Timeline).filter(Timeline.id == timeline_id).first()

    if db_timeline is None:
        raise HTTPException(status_code=404, detail="Timeline not found")

    update_data = timeline_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_timeline, field, value)

    db.commit()
    db.refresh(db_timeline)
    return db_timeline

@router.delete("/{timeline_id}", status_code=204)
def delete_timeline(timeline_id: UUID, db: Session = Depends(get_db)):
    db_timeline = db.query(Timeline).filter(Timeline.id == timeline_id).first()

    if db_timeline is None:
        raise HTTPException(status_code=404, detail="Timeline not found")

    db.delete(db_timeline)
    db.commit()
    return None
