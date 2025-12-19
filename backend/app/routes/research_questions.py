from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from uuid import UUID

from app.database import get_db
from app.models.research_question import ResearchQuestion
from app.models.thinker import Thinker
from app.schemas import research_question as schemas

router = APIRouter(prefix="/api/research-questions", tags=["research-questions"])


def validate_thinker_exists(db: Session, thinker_id: UUID):
    """Validate that the thinker exists in the database."""
    thinker = db.query(Thinker).filter(Thinker.id == thinker_id).first()
    if not thinker:
        raise HTTPException(status_code=404, detail=f"Thinker with id {thinker_id} not found")
    return thinker


@router.post("/", response_model=schemas.ResearchQuestionWithRelations, status_code=201)
def create_question(
    question_data: schemas.ResearchQuestionCreate,
    db: Session = Depends(get_db)
):
    # Validate parent question if provided
    if question_data.parent_question_id:
        parent = db.query(ResearchQuestion).filter(
            ResearchQuestion.id == question_data.parent_question_id
        ).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent question not found")

    # Extract related thinker IDs before creating the question
    related_thinker_ids = question_data.related_thinker_ids or []
    question_dict = question_data.model_dump(exclude={'related_thinker_ids'})

    db_question = ResearchQuestion(**question_dict)
    db.add(db_question)
    db.flush()

    # Add related thinkers
    if related_thinker_ids:
        for thinker_id in related_thinker_ids:
            thinker = validate_thinker_exists(db, thinker_id)
            db_question.related_thinkers.append(thinker)

    db.commit()

    # Re-query with relationships loaded
    db_question = db.query(ResearchQuestion).options(
        joinedload(ResearchQuestion.related_thinkers),
        joinedload(ResearchQuestion.sub_questions)
    ).filter(ResearchQuestion.id == db_question.id).first()

    return db_question


@router.get("/", response_model=List[schemas.ResearchQuestion])
def get_questions(
    status: Optional[str] = None,
    category: Optional[str] = None,
    priority: Optional[int] = None,
    thinker_id: Optional[UUID] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(ResearchQuestion)

    if status:
        query = query.filter(ResearchQuestion.status == status)
    if category:
        query = query.filter(ResearchQuestion.category == category)
    if priority:
        query = query.filter(ResearchQuestion.priority == priority)
    if thinker_id:
        query = query.join(ResearchQuestion.related_thinkers).filter(
            Thinker.id == thinker_id
        )

    questions = query.order_by(
        ResearchQuestion.priority,
        ResearchQuestion.updated_at.desc()
    ).offset(skip).limit(limit).all()

    return questions


@router.get("/{question_id}", response_model=schemas.ResearchQuestionWithRelations)
def get_question(question_id: UUID, db: Session = Depends(get_db)):
    db_question = db.query(ResearchQuestion).options(
        joinedload(ResearchQuestion.related_thinkers),
        joinedload(ResearchQuestion.sub_questions)
    ).filter(ResearchQuestion.id == question_id).first()

    if db_question is None:
        raise HTTPException(status_code=404, detail="Research question not found")

    return db_question


@router.put("/{question_id}", response_model=schemas.ResearchQuestionWithRelations)
def update_question(
    question_id: UUID,
    question_update: schemas.ResearchQuestionUpdate,
    db: Session = Depends(get_db)
):
    db_question = db.query(ResearchQuestion).filter(ResearchQuestion.id == question_id).first()

    if db_question is None:
        raise HTTPException(status_code=404, detail="Research question not found")

    # Handle related thinkers update
    related_thinker_ids = question_update.related_thinker_ids
    update_data = question_update.model_dump(exclude_unset=True, exclude={'related_thinker_ids'})

    for field, value in update_data.items():
        setattr(db_question, field, value)

    if related_thinker_ids is not None:
        db_question.related_thinkers = []
        for thinker_id in related_thinker_ids:
            thinker = validate_thinker_exists(db, thinker_id)
            db_question.related_thinkers.append(thinker)

    db.commit()

    # Re-query with relationships loaded
    db_question = db.query(ResearchQuestion).options(
        joinedload(ResearchQuestion.related_thinkers),
        joinedload(ResearchQuestion.sub_questions)
    ).filter(ResearchQuestion.id == question_id).first()

    return db_question


@router.delete("/{question_id}", status_code=204)
def delete_question(question_id: UUID, db: Session = Depends(get_db)):
    db_question = db.query(ResearchQuestion).filter(ResearchQuestion.id == question_id).first()

    if db_question is None:
        raise HTTPException(status_code=404, detail="Research question not found")

    db.delete(db_question)
    db.commit()
    return None


@router.get("/stats/summary")
def get_question_stats(db: Session = Depends(get_db)):
    """Get summary statistics for research questions."""
    total = db.query(ResearchQuestion).count()
    open_count = db.query(ResearchQuestion).filter(ResearchQuestion.status == "open").count()
    in_progress = db.query(ResearchQuestion).filter(ResearchQuestion.status == "in_progress").count()
    answered = db.query(ResearchQuestion).filter(ResearchQuestion.status == "answered").count()
    abandoned = db.query(ResearchQuestion).filter(ResearchQuestion.status == "abandoned").count()

    # Priority breakdown
    priority_1 = db.query(ResearchQuestion).filter(ResearchQuestion.priority == 1).count()
    priority_2 = db.query(ResearchQuestion).filter(ResearchQuestion.priority == 2).count()
    priority_3 = db.query(ResearchQuestion).filter(ResearchQuestion.priority == 3).count()

    return {
        "total": total,
        "by_status": {
            "open": open_count,
            "in_progress": in_progress,
            "answered": answered,
            "abandoned": abandoned,
        },
        "high_priority": priority_1 + priority_2,
        "medium_priority": priority_3,
    }
