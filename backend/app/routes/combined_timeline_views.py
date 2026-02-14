from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List
from uuid import UUID

from app.database import get_db
from app.models.combined_timeline_view import CombinedTimelineView
from app.models.combined_view_member import CombinedViewMember
from app.models.timeline import Timeline
from app.models.timeline_event import TimelineEvent
from app.schemas import combined_timeline_view as schemas
from app.schemas.timeline_event import TimelineEvent as TimelineEventSchema

router = APIRouter(prefix="/api/combined-views", tags=["combined-views"])

@router.post("/", response_model=schemas.CombinedTimelineView, status_code=201)
def create_combined_view(view: schemas.CombinedTimelineViewCreate, db: Session = Depends(get_db)):
    # Validate that all timelines exist
    for timeline_id in view.timeline_ids:
        timeline = db.query(Timeline).filter(Timeline.id == timeline_id).first()
        if not timeline:
            raise HTTPException(status_code=404, detail=f"Timeline with id {timeline_id} not found")

    # Create the combined view
    db_view = CombinedTimelineView(
        name=view.name,
        description=view.description
    )
    db.add(db_view)
    db.flush()  # Get the view ID without committing

    # Create members for each timeline
    for index, timeline_id in enumerate(view.timeline_ids):
        member = CombinedViewMember(
            view_id=db_view.id,
            timeline_id=timeline_id,
            display_order=index,
            y_offset=index * 200  # Default spacing of 200 pixels between timelines
        )
        db.add(member)

    db.commit()
    db.refresh(db_view)

    # Load with relationships
    db_view = db.query(CombinedTimelineView).options(
        joinedload(CombinedTimelineView.members).joinedload(CombinedViewMember.timeline)
    ).filter(CombinedTimelineView.id == db_view.id).first()

    return db_view

@router.get("/", response_model=List[schemas.CombinedTimelineViewSimple])
def get_combined_views(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
):
    views = db.query(CombinedTimelineView).order_by(CombinedTimelineView.created_at.desc()).offset(skip).limit(limit).all()
    return views

@router.get("/{view_id}", response_model=schemas.CombinedTimelineView)
def get_combined_view(view_id: UUID, db: Session = Depends(get_db)):
    view = db.query(CombinedTimelineView).options(
        joinedload(CombinedTimelineView.members).joinedload(CombinedViewMember.timeline)
    ).filter(CombinedTimelineView.id == view_id).first()

    if view is None:
        raise HTTPException(status_code=404, detail="Combined view not found")
    return view

@router.put("/{view_id}", response_model=schemas.CombinedTimelineView)
def update_combined_view(view_id: UUID, view_update: schemas.CombinedTimelineViewUpdate, db: Session = Depends(get_db)):
    db_view = db.query(CombinedTimelineView).filter(CombinedTimelineView.id == view_id).first()

    if db_view is None:
        raise HTTPException(status_code=404, detail="Combined view not found")

    update_data = view_update.model_dump(exclude_unset=True)

    # Update basic fields (name, description)
    for field in ['name', 'description']:
        if field in update_data:
            setattr(db_view, field, update_data[field])

    # Handle timeline_ids update if provided
    if 'timeline_ids' in update_data and update_data['timeline_ids'] is not None:
        timeline_ids = update_data['timeline_ids']

        # Validate that all timelines exist
        for timeline_id in timeline_ids:
            timeline = db.query(Timeline).filter(Timeline.id == timeline_id).first()
            if not timeline:
                raise HTTPException(status_code=404, detail=f"Timeline with id {timeline_id} not found")

        # Delete existing members
        db.query(CombinedViewMember).filter(CombinedViewMember.view_id == view_id).delete()

        # Create new members
        for index, timeline_id in enumerate(timeline_ids):
            member = CombinedViewMember(
                view_id=db_view.id,
                timeline_id=timeline_id,
                display_order=index,
                y_offset=index * 200
            )
            db.add(member)

    db.commit()
    db.refresh(db_view)

    # Load with relationships
    db_view = db.query(CombinedTimelineView).options(
        joinedload(CombinedTimelineView.members).joinedload(CombinedViewMember.timeline)
    ).filter(CombinedTimelineView.id == db_view.id).first()

    return db_view


@router.delete("/{view_id}", status_code=204)
def delete_combined_view(view_id: UUID, db: Session = Depends(get_db)):
    db_view = db.query(CombinedTimelineView).filter(CombinedTimelineView.id == view_id).first()

    if db_view is None:
        raise HTTPException(status_code=404, detail="Combined view not found")

    db.delete(db_view)
    db.commit()
    return None

@router.get("/{view_id}/events", response_model=List[TimelineEventSchema])
def get_combined_view_events(view_id: UUID, db: Session = Depends(get_db)):
    # Get the combined view with its members
    view = db.query(CombinedTimelineView).options(
        joinedload(CombinedTimelineView.members)
    ).filter(CombinedTimelineView.id == view_id).first()

    if view is None:
        raise HTTPException(status_code=404, detail="Combined view not found")

    # Get timeline IDs from members
    timeline_ids = [member.timeline_id for member in view.members]

    if not timeline_ids:
        return []

    # Query all events from all member timelines
    events = db.query(TimelineEvent).filter(
        TimelineEvent.timeline_id.in_(timeline_ids)
    ).order_by(TimelineEvent.year.asc(), TimelineEvent.created_at.asc()).all()

    return events
