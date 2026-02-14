from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.database import get_db
from app.models.timeline_event import TimelineEvent
from app.schemas import timeline_event as schemas

router = APIRouter(prefix="/api/timeline-events", tags=["timeline-events"])

@router.post("/", response_model=schemas.TimelineEvent, status_code=201)
def create_timeline_event(event: schemas.TimelineEventCreate, db: Session = Depends(get_db)):
    # Validate that the timeline exists
    from app.models.timeline import Timeline
    timeline = db.query(Timeline).filter(Timeline.id == event.timeline_id).first()
    if not timeline:
        raise HTTPException(status_code=404, detail=f"Timeline with id {event.timeline_id} not found")

    db_event = TimelineEvent(**event.model_dump())
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event

@router.get("/", response_model=List[schemas.TimelineEvent])
def get_timeline_events(
    timeline_id: UUID | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db)
):
    query = db.query(TimelineEvent)
    if timeline_id:
        query = query.filter(TimelineEvent.timeline_id == timeline_id)
    events = query.order_by(TimelineEvent.year.asc(), TimelineEvent.created_at.asc()).offset(skip).limit(limit).all()
    return events

@router.get("/{event_id}", response_model=schemas.TimelineEvent)
def get_timeline_event(event_id: UUID, db: Session = Depends(get_db)):
    event = db.query(TimelineEvent).filter(TimelineEvent.id == event_id).first()

    if event is None:
        raise HTTPException(status_code=404, detail="Timeline event not found")
    return event

@router.put("/{event_id}", response_model=schemas.TimelineEvent)
def update_timeline_event(
    event_id: UUID,
    event_update: schemas.TimelineEventUpdate,
    db: Session = Depends(get_db)
):
    db_event = db.query(TimelineEvent).filter(TimelineEvent.id == event_id).first()

    if db_event is None:
        raise HTTPException(status_code=404, detail="Timeline event not found")

    update_data = event_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_event, field, value)

    db.commit()
    db.refresh(db_event)
    return db_event

@router.delete("/{event_id}", status_code=204)
def delete_timeline_event(event_id: UUID, db: Session = Depends(get_db)):
    db_event = db.query(TimelineEvent).filter(TimelineEvent.id == event_id).first()

    if db_event is None:
        raise HTTPException(status_code=404, detail="Timeline event not found")

    db.delete(db_event)
    db.commit()
    return None
