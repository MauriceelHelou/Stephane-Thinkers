"""
Quiz API Routes for Intellectual Genealogy Mapper.

Endpoints:
- POST /api/quiz/generate-question - Generate or retrieve a question
- POST /api/quiz/generate-quiz - Generate a full quiz session
- POST /api/quiz/validate-answer - Validate an answer
- GET /api/quiz/session/{session_id} - Get session details
- GET /api/quiz/history - Get quiz history
- GET /api/quiz/statistics - Get overall stats
- GET /api/quiz/review-queue - Get spaced repetition review queue
- POST /api/quiz/reset-question/{question_id} - Reset question stats
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Optional
from uuid import UUID
from datetime import datetime
import uuid

from app.database import get_db
from app.models.quiz import QuizQuestion, QuizSession, QuizAnswer, SpacedRepetitionQueue
from app.models.thinker import Thinker
from app.models.quote import Quote
from app.models.publication import Publication
from app.models.connection import Connection
from app.models.timeline import Timeline
from app.schemas import quiz as schemas
from app.utils.quiz_service import (
    generate_question,
    generate_question_with_ai,
    validate_answer,
    validate_answer_with_ai,
    calculate_next_review,
    calculate_quality_score,
    get_next_difficulty,
    calculate_session_statistics,
)
from app.utils.ai_service import is_ai_enabled

router = APIRouter(prefix="/api/quiz", tags=["quiz"])


# ============ Helper Functions ============

def get_thinker_dicts(db: Session, timeline_id: Optional[str] = None) -> List[dict]:
    """Get thinkers as dictionaries."""
    query = db.query(Thinker)
    if timeline_id:
        query = query.filter(Thinker.timeline_id == timeline_id)
    thinkers = query.all()
    return [
        {
            "id": str(t.id),
            "name": t.name,
            "birth_year": t.birth_year,
            "death_year": t.death_year,
            "field": t.field,
            "biography_notes": t.biography_notes,
            "timeline_id": str(t.timeline_id) if t.timeline_id else None,
        }
        for t in thinkers
    ]


def get_quote_dicts(db: Session) -> List[dict]:
    """Get quotes as dictionaries."""
    quotes = db.query(Quote).all()
    return [
        {
            "id": str(q.id),
            "thinker_id": str(q.thinker_id),
            "text": q.text,
            "source": q.source,
        }
        for q in quotes
    ]


def get_publication_dicts(db: Session) -> List[dict]:
    """Get publications as dictionaries."""
    publications = db.query(Publication).all()
    return [
        {
            "id": str(p.id),
            "thinker_id": str(p.thinker_id),
            "title": p.title,
            "year": p.year,
            "publication_type": p.publication_type.value if p.publication_type else None,
        }
        for p in publications
    ]


def get_connection_dicts(db: Session) -> List[dict]:
    """Get connections as dictionaries."""
    connections = db.query(Connection).all()
    return [
        {
            "id": str(c.id),
            "from_thinker_id": str(c.from_thinker_id),
            "to_thinker_id": str(c.to_thinker_id),
            "connection_type": c.connection_type.value if c.connection_type else "influenced",
            "notes": c.notes,
        }
        for c in connections
    ]


def question_to_response(q: QuizQuestion) -> schemas.QuizQuestionResponse:
    """Convert QuizQuestion model to response schema."""
    accuracy = (q.times_correct / q.times_asked * 100) if q.times_asked > 0 else 0
    return schemas.QuizQuestionResponse(
        question_id=str(q.id),
        question_text=q.question_text,
        question_type=q.question_type,
        category=q.category,
        options=q.options,
        correct_answer=q.correct_answer,
        difficulty=q.difficulty,
        related_thinker_ids=q.related_thinker_ids or [],
        explanation=q.explanation or "",
        from_pool=True,
        times_asked=q.times_asked,
        accuracy_rate=accuracy,
    )


# ============ Endpoints ============

@router.post("/generate-question", response_model=schemas.QuizQuestionResponse)
async def generate_question_endpoint(
    params: schemas.QuestionGenerationParams,
    db: Session = Depends(get_db),
):
    """
    Generate or retrieve a quiz question.

    First checks the question pool for existing suitable questions.
    If none found, generates a new question (with AI if enabled).
    """
    # Check for spaced repetition questions first
    if params.use_spaced_repetition:
        review_entry = db.query(SpacedRepetitionQueue).filter(
            SpacedRepetitionQueue.next_review_at <= datetime.now()
        ).first()

        if review_entry:
            question = db.query(QuizQuestion).filter(
                QuizQuestion.id == review_entry.question_id
            ).first()
            if question and str(question.id) not in params.exclude_question_ids:
                # Update times_asked
                question.times_asked = (question.times_asked or 0) + 1
                db.commit()
                return question_to_response(question)

    # Try to find existing question from pool
    query = db.query(QuizQuestion).filter(
        QuizQuestion.category.in_(params.question_categories),
        QuizQuestion.difficulty == params.difficulty if params.difficulty != "adaptive" else True,
    )

    if params.timeline_id:
        query = query.filter(
            (QuizQuestion.timeline_id == params.timeline_id) |
            (QuizQuestion.timeline_id.is_(None))
        )

    if params.exclude_question_ids:
        query = query.filter(~QuizQuestion.id.in_([
            uuid.UUID(qid.replace('-', '')) if '-' in qid else uuid.UUID(qid)
            for qid in params.exclude_question_ids
        ]))

    # Order by least asked to vary questions
    existing_question = query.order_by(QuizQuestion.times_asked.asc()).first()

    if existing_question:
        existing_question.times_asked = (existing_question.times_asked or 0) + 1
        db.commit()
        return question_to_response(existing_question)

    # Generate new question
    thinkers = get_thinker_dicts(db, params.timeline_id)
    quotes = get_quote_dicts(db)
    publications = get_publication_dicts(db)
    connections = get_connection_dicts(db)

    if not thinkers:
        raise HTTPException(status_code=400, detail="No thinkers in database to generate questions from")

    difficulty = params.difficulty if params.difficulty != "adaptive" else "medium"
    q_type = params.question_type if params.question_type != "auto" else "multiple_choice"

    generated = await generate_question(
        thinkers=thinkers,
        quotes=quotes,
        publications=publications,
        connections=connections,
        allowed_categories=params.question_categories,
        difficulty=difficulty,
        question_type=q_type,
        timeline_id=params.timeline_id,
    )

    if not generated:
        # Try AI generation as fallback
        if is_ai_enabled():
            category = params.question_categories[0] if params.question_categories else "birth_year"
            generated = await generate_question_with_ai(
                thinkers, quotes, publications, connections, category, difficulty
            )

    if not generated:
        raise HTTPException(status_code=500, detail="Could not generate question")

    # Save to database
    new_question = QuizQuestion(
        id=uuid.uuid4(),
        question_text=generated.question_text,
        question_type=generated.question_type,
        category=generated.category,
        correct_answer=generated.correct_answer,
        options=generated.options,
        difficulty=generated.difficulty,
        explanation=generated.explanation,
        related_thinker_ids=generated.related_thinker_ids,
        timeline_id=uuid.UUID(params.timeline_id) if params.timeline_id else None,
        times_asked=1,
        times_correct=0,
    )
    db.add(new_question)
    db.commit()
    db.refresh(new_question)

    return question_to_response(new_question)


@router.post("/generate-quiz", response_model=schemas.QuizSessionWithQuestions)
async def generate_quiz_endpoint(
    params: schemas.QuizGenerationParams,
    db: Session = Depends(get_db),
):
    """
    Generate a full quiz session with multiple questions.
    """
    # Create session
    session = QuizSession(
        id=uuid.uuid4(),
        timeline_id=uuid.UUID(params.timeline_id) if params.timeline_id else None,
        difficulty=params.difficulty if params.difficulty != "adaptive" else "medium",
        question_count=params.question_count,
        question_categories=params.question_categories,
        score=0,
        completed=False,
        current_question_index=0,
    )
    db.add(session)
    db.commit()

    # Generate questions
    questions = []
    exclude_ids = []
    current_difficulty = params.difficulty if params.difficulty != "adaptive" else "medium"

    thinkers = get_thinker_dicts(db, params.timeline_id)
    quotes = get_quote_dicts(db)
    publications = get_publication_dicts(db)
    connections = get_connection_dicts(db)

    for i in range(params.question_count):
        # Determine question type based on ratio
        import random
        q_type = "multiple_choice" if random.random() < params.multiple_choice_ratio else "short_answer"

        existing = None
        # Try to find existing question (unless force_fresh is True)
        if not params.force_fresh:
            query = db.query(QuizQuestion).filter(
                QuizQuestion.category.in_(params.question_categories),
            )

            if params.timeline_id:
                query = query.filter(
                    (QuizQuestion.timeline_id == params.timeline_id) |
                    (QuizQuestion.timeline_id.is_(None))
                )

            if exclude_ids:
                query = query.filter(~QuizQuestion.id.in_(exclude_ids))

            existing = query.order_by(QuizQuestion.times_asked.asc()).first()

        if existing:
            existing.times_asked = (existing.times_asked or 0) + 1
            exclude_ids.append(existing.id)
            questions.append(question_to_response(existing))
        else:
            # Generate new question
            generated = await generate_question(
                thinkers=thinkers,
                quotes=quotes,
                publications=publications,
                connections=connections,
                allowed_categories=params.question_categories,
                difficulty=current_difficulty,
                question_type=q_type,
                timeline_id=params.timeline_id,
            )

            if generated:
                new_q = QuizQuestion(
                    id=uuid.uuid4(),
                    question_text=generated.question_text,
                    question_type=generated.question_type,
                    category=generated.category,
                    correct_answer=generated.correct_answer,
                    options=generated.options,
                    difficulty=generated.difficulty,
                    explanation=generated.explanation,
                    related_thinker_ids=generated.related_thinker_ids,
                    timeline_id=uuid.UUID(params.timeline_id) if params.timeline_id else None,
                    times_asked=1,
                    times_correct=0,
                )
                db.add(new_q)
                exclude_ids.append(new_q.id)
                questions.append(schemas.QuizQuestionResponse(
                    question_id=str(new_q.id),
                    question_text=new_q.question_text,
                    question_type=new_q.question_type,
                    category=new_q.category,
                    options=new_q.options,
                    correct_answer=new_q.correct_answer,
                    difficulty=new_q.difficulty,
                    related_thinker_ids=new_q.related_thinker_ids or [],
                    explanation=new_q.explanation or "",
                    from_pool=False,
                ))

    db.commit()

    return schemas.QuizSessionWithQuestions(
        id=session.id,
        timeline_id=session.timeline_id,
        difficulty=session.difficulty,
        question_count=session.question_count,
        question_categories=session.question_categories,
        score=session.score,
        completed=session.completed,
        current_question_index=session.current_question_index,
        created_at=session.created_at,
        questions=questions,
    )


@router.post("/validate-answer", response_model=schemas.AnswerValidationResponse)
async def validate_answer_endpoint(
    request: schemas.AnswerValidationRequest,
    db: Session = Depends(get_db),
):
    """
    Validate a user's answer and update statistics.
    """
    # Get question
    question_uuid = uuid.UUID(request.question_id.replace('-', '')) if '-' in request.question_id else uuid.UUID(request.question_id)
    question = db.query(QuizQuestion).filter(QuizQuestion.id == question_uuid).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    # Get session
    session_uuid = uuid.UUID(request.session_id.replace('-', '')) if '-' in request.session_id else uuid.UUID(request.session_id)
    session = db.query(QuizSession).filter(QuizSession.id == session_uuid).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Validate answer
    is_correct = validate_answer(
        user_answer=request.user_answer,
        correct_answer=question.correct_answer,
        question_type=question.question_type,
    )

    # Try AI validation for short answer if simple validation fails
    if not is_correct and question.question_type == "short_answer" and is_ai_enabled():
        is_correct = await validate_answer_with_ai(
            request.user_answer,
            question.correct_answer,
            question.question_text,
        )

    # Update question stats
    question.times_asked = (question.times_asked or 0) + 1
    if is_correct:
        question.times_correct = (question.times_correct or 0) + 1

    # Record answer
    answer = QuizAnswer(
        id=uuid.uuid4(),
        session_id=session.id,
        question_id=question.id,
        user_answer=request.user_answer,
        is_correct=is_correct,
        time_taken_seconds=request.time_taken_seconds,
    )
    db.add(answer)

    # Update session
    if is_correct:
        session.score = (session.score or 0) + 1
    session.current_question_index = (session.current_question_index or 0) + 1

    # Update spaced repetition
    quality = calculate_quality_score(is_correct, request.time_taken_seconds)
    sr_entry = db.query(SpacedRepetitionQueue).filter(
        SpacedRepetitionQueue.question_id == question.id
    ).first()

    next_review_at = None
    if sr_entry:
        update = calculate_next_review(
            ease_factor=sr_entry.ease_factor,
            interval_days=sr_entry.interval_days,
            repetitions=sr_entry.repetitions,
            quality=quality,
        )
        sr_entry.ease_factor = update.ease_factor
        sr_entry.interval_days = update.interval_days
        sr_entry.repetitions = update.repetitions
        sr_entry.next_review_at = update.next_review_at
        sr_entry.last_answered_at = datetime.now()
        next_review_at = update.next_review_at
    else:
        # Create new spaced repetition entry
        update = calculate_next_review(
            ease_factor=2.5,
            interval_days=1,
            repetitions=0,
            quality=quality,
        )
        new_sr = SpacedRepetitionQueue(
            id=uuid.uuid4(),
            question_id=question.id,
            ease_factor=update.ease_factor,
            interval_days=update.interval_days,
            repetitions=update.repetitions,
            next_review_at=update.next_review_at,
            last_answered_at=datetime.now(),
        )
        db.add(new_sr)
        next_review_at = update.next_review_at

    # Determine next difficulty for adaptive mode
    recent_answers = db.query(QuizAnswer).filter(
        QuizAnswer.session_id == session.id
    ).order_by(QuizAnswer.answered_at.desc()).limit(5).all()

    recent_results = [a.is_correct for a in reversed(recent_answers)]
    next_difficulty = get_next_difficulty(recent_results, session.difficulty)

    db.commit()

    return schemas.AnswerValidationResponse(
        correct=is_correct,
        explanation=question.explanation or "",
        correct_answer=question.correct_answer,
        additional_context=None,
        next_difficulty=next_difficulty,
        next_review_at=next_review_at,
    )


@router.get("/session/{session_id}", response_model=schemas.QuizSession)
def get_session_endpoint(
    session_id: str,
    db: Session = Depends(get_db),
):
    """Get quiz session details."""
    session_uuid = uuid.UUID(session_id.replace('-', '')) if '-' in session_id else uuid.UUID(session_id)
    session = db.query(QuizSession).filter(QuizSession.id == session_uuid).first()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return session


@router.get("/history", response_model=List[schemas.QuizSessionSummary])
def get_history_endpoint(
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    timeline_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Get quiz session history."""
    query = db.query(QuizSession).order_by(QuizSession.created_at.desc())

    if timeline_id:
        tl_uuid = uuid.UUID(timeline_id.replace('-', '')) if '-' in timeline_id else uuid.UUID(timeline_id)
        query = query.filter(QuizSession.timeline_id == tl_uuid)

    sessions = query.offset(offset).limit(limit).all()

    result = []
    for session in sessions:
        accuracy = (session.score / session.question_count * 100) if session.question_count > 0 else 0

        timeline_name = None
        if session.timeline_id:
            timeline = db.query(Timeline).filter(Timeline.id == session.timeline_id).first()
            if timeline:
                timeline_name = timeline.name

        result.append(schemas.QuizSessionSummary(
            session_id=str(session.id),
            created_at=session.created_at,
            completed_at=session.completed_at,
            score=session.score or 0,
            total_questions=session.question_count,
            accuracy_percentage=accuracy,
            difficulty=session.difficulty,
            timeline_name=timeline_name,
        ))

    return result


@router.get("/statistics", response_model=schemas.QuizStatistics)
def get_statistics_endpoint(db: Session = Depends(get_db)):
    """Get overall quiz statistics."""
    # Total sessions
    total_sessions = db.query(func.count(QuizSession.id)).scalar() or 0

    # Total answers
    total_answers = db.query(func.count(QuizAnswer.id)).scalar() or 0
    correct_answers = db.query(func.count(QuizAnswer.id)).filter(QuizAnswer.is_correct == True).scalar() or 0

    overall_accuracy = (correct_answers / total_answers * 100) if total_answers > 0 else 0

    # Category performance
    category_stats = db.query(
        QuizQuestion.category,
        func.count(QuizAnswer.id).label('total'),
        func.sum(func.cast(QuizAnswer.is_correct, db.bind.dialect.type_descriptor(db.bind.dialect.supports_native_boolean and type(True) or type(1)))).label('correct')
    ).join(QuizAnswer, QuizQuestion.id == QuizAnswer.question_id).group_by(QuizQuestion.category).all()

    category_performance = []
    for stat in category_stats:
        total = stat.total or 0
        correct = stat.correct or 0
        category_performance.append(schemas.CategoryPerformance(
            category=stat.category,
            total_asked=total,
            accuracy=(correct / total * 100) if total > 0 else 0,
        ))

    # Difficulty distribution
    easy_count = db.query(func.count(QuizQuestion.id)).filter(QuizQuestion.difficulty == "easy").scalar() or 0
    medium_count = db.query(func.count(QuizQuestion.id)).filter(QuizQuestion.difficulty == "medium").scalar() or 0
    hard_count = db.query(func.count(QuizQuestion.id)).filter(QuizQuestion.difficulty == "hard").scalar() or 0

    # Review queue size
    review_queue_size = db.query(func.count(SpacedRepetitionQueue.id)).filter(
        SpacedRepetitionQueue.next_review_at <= datetime.now()
    ).scalar() or 0

    # Average session score
    avg_score_result = db.query(
        func.avg(QuizSession.score * 100.0 / QuizSession.question_count)
    ).filter(QuizSession.question_count > 0).scalar()
    avg_session_score = float(avg_score_result) if avg_score_result else 0

    # Improvement trend (compare last 5 sessions to previous 5)
    recent_sessions = db.query(QuizSession).order_by(QuizSession.created_at.desc()).limit(10).all()
    improvement_trend = 0.0
    if len(recent_sessions) >= 10:
        recent_5_avg = sum(
            (s.score / s.question_count * 100) if s.question_count > 0 else 0
            for s in recent_sessions[:5]
        ) / 5
        prev_5_avg = sum(
            (s.score / s.question_count * 100) if s.question_count > 0 else 0
            for s in recent_sessions[5:10]
        ) / 5
        improvement_trend = recent_5_avg - prev_5_avg

    return schemas.QuizStatistics(
        total_sessions=total_sessions,
        total_questions_answered=total_answers,
        overall_accuracy=overall_accuracy,
        category_performance=category_performance,
        difficulty_distribution=schemas.DifficultyDistribution(
            easy=easy_count,
            medium=medium_count,
            hard=hard_count,
        ),
        review_queue_size=review_queue_size,
        average_session_score=avg_session_score,
        improvement_trend=improvement_trend,
    )


@router.get("/review-queue", response_model=List[schemas.QuizQuestionResponse])
def get_review_queue_endpoint(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Get questions due for spaced repetition review."""
    entries = db.query(SpacedRepetitionQueue).filter(
        SpacedRepetitionQueue.next_review_at <= datetime.now()
    ).order_by(SpacedRepetitionQueue.next_review_at.asc()).limit(limit).all()

    questions = []
    for entry in entries:
        question = db.query(QuizQuestion).filter(QuizQuestion.id == entry.question_id).first()
        if question:
            questions.append(question_to_response(question))

    return questions


@router.post("/reset-question/{question_id}")
def reset_question_endpoint(
    question_id: str,
    db: Session = Depends(get_db),
):
    """Reset question statistics (admin endpoint)."""
    question_uuid = uuid.UUID(question_id.replace('-', '')) if '-' in question_id else uuid.UUID(question_id)
    question = db.query(QuizQuestion).filter(QuizQuestion.id == question_uuid).first()

    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    question.times_asked = 0
    question.times_correct = 0

    # Reset spaced repetition
    sr_entry = db.query(SpacedRepetitionQueue).filter(
        SpacedRepetitionQueue.question_id == question.id
    ).first()
    if sr_entry:
        sr_entry.ease_factor = 2.5
        sr_entry.interval_days = 1
        sr_entry.repetitions = 0
        sr_entry.next_review_at = datetime.now()

    db.commit()

    return {"status": "success", "message": "Question statistics reset"}


@router.post("/complete-session/{session_id}")
def complete_session_endpoint(
    session_id: str,
    time_spent_seconds: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Mark a quiz session as completed."""
    session_uuid = uuid.UUID(session_id.replace('-', '')) if '-' in session_id else uuid.UUID(session_id)
    session = db.query(QuizSession).filter(QuizSession.id == session_uuid).first()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.completed = True
    session.completed_at = datetime.now()
    if time_spent_seconds:
        session.time_spent_seconds = time_spent_seconds

    db.commit()

    return {"status": "success", "session_id": str(session.id)}


@router.post("/clear-question-pool")
def clear_question_pool_endpoint(
    timeline_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Clear all quiz questions from the pool.
    Use this when thinker data has been updated and you want fresh questions.
    """
    # Delete spaced repetition entries first (foreign key constraint)
    sr_query = db.query(SpacedRepetitionQueue)
    if timeline_id:
        tl_uuid = uuid.UUID(timeline_id.replace('-', '')) if '-' in timeline_id else uuid.UUID(timeline_id)
        # Get question IDs for this timeline
        question_ids = [q.id for q in db.query(QuizQuestion.id).filter(
            (QuizQuestion.timeline_id == tl_uuid) | (QuizQuestion.timeline_id.is_(None))
        ).all()]
        sr_query = sr_query.filter(SpacedRepetitionQueue.question_id.in_(question_ids))

    sr_deleted = sr_query.delete(synchronize_session=False)

    # Delete quiz answers (foreign key constraint)
    answer_query = db.query(QuizAnswer)
    if timeline_id:
        answer_query = answer_query.filter(QuizAnswer.question_id.in_(question_ids))
    answer_deleted = answer_query.delete(synchronize_session=False)

    # Delete questions
    query = db.query(QuizQuestion)
    if timeline_id:
        tl_uuid = uuid.UUID(timeline_id.replace('-', '')) if '-' in timeline_id else uuid.UUID(timeline_id)
        query = query.filter(
            (QuizQuestion.timeline_id == tl_uuid) | (QuizQuestion.timeline_id.is_(None))
        )

    deleted_count = query.delete(synchronize_session=False)
    db.commit()

    return {
        "status": "success",
        "message": f"Cleared {deleted_count} questions, {sr_deleted} spaced repetition entries, and {answer_deleted} answers from the pool",
        "questions_deleted": deleted_count,
        "sr_entries_deleted": sr_deleted,
        "answers_deleted": answer_deleted,
    }


@router.post("/refresh-questions")
async def refresh_questions_endpoint(
    count: int = Query(10, ge=1, le=50),
    timeline_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Clear the question pool and generate fresh questions from current data.
    Use this after updating thinker information.
    """
    # First clear existing questions
    sr_deleted = db.query(SpacedRepetitionQueue).delete(synchronize_session=False)
    answer_deleted = db.query(QuizAnswer).delete(synchronize_session=False)

    if timeline_id:
        tl_uuid = uuid.UUID(timeline_id.replace('-', '')) if '-' in timeline_id else uuid.UUID(timeline_id)
        deleted_count = db.query(QuizQuestion).filter(
            (QuizQuestion.timeline_id == tl_uuid) | (QuizQuestion.timeline_id.is_(None))
        ).delete(synchronize_session=False)
    else:
        deleted_count = db.query(QuizQuestion).delete(synchronize_session=False)

    db.commit()

    # Now generate fresh questions
    thinkers = get_thinker_dicts(db, timeline_id)
    quotes = get_quote_dicts(db)
    publications = get_publication_dicts(db)
    connections = get_connection_dicts(db)

    if not thinkers:
        return {
            "status": "success",
            "message": f"Cleared {deleted_count} questions, but no thinkers available to generate new questions",
            "questions_cleared": deleted_count,
            "questions_generated": 0,
        }

    categories = ["birth_year", "death_year", "quote", "publication", "connection", "field"]
    generated_count = 0

    for i in range(count):
        generated = await generate_question(
            thinkers=thinkers,
            quotes=quotes,
            publications=publications,
            connections=connections,
            allowed_categories=categories,
            difficulty="medium",
            question_type="multiple_choice",
            timeline_id=timeline_id,
        )

        if generated:
            new_q = QuizQuestion(
                id=uuid.uuid4(),
                question_text=generated.question_text,
                question_type=generated.question_type,
                category=generated.category,
                correct_answer=generated.correct_answer,
                options=generated.options,
                difficulty=generated.difficulty,
                explanation=generated.explanation,
                related_thinker_ids=generated.related_thinker_ids,
                timeline_id=uuid.UUID(timeline_id) if timeline_id else None,
                times_asked=0,
                times_correct=0,
            )
            db.add(new_q)
            generated_count += 1

    db.commit()

    return {
        "status": "success",
        "message": f"Cleared {deleted_count} old questions and generated {generated_count} new questions",
        "questions_cleared": deleted_count,
        "questions_generated": generated_count,
    }
