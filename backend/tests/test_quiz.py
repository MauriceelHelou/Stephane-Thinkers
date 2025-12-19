"""
Comprehensive tests for the Quiz system.

Tests cover:
- Quiz question generation
- Quiz session management
- Answer validation
- Spaced repetition (SM-2 algorithm)
- Statistics and history endpoints
"""

import pytest
import uuid
from datetime import datetime, timedelta
from unittest.mock import patch, AsyncMock

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.models.quiz import QuizQuestion, QuizSession, QuizAnswer, SpacedRepetitionQueue
from app.models.thinker import Thinker
from app.models.quote import Quote
from app.models.publication import Publication
from app.models.connection import Connection
from app.models.timeline import Timeline
from app.utils.quiz_service import (
    calculate_quality_score,
    calculate_next_review,
    get_next_difficulty,
    validate_answer,
    generate_birth_year_question,
    generate_year_distractors,
)


client = TestClient(app)


# ============ Fixtures ============

@pytest.fixture
def sample_timeline(db: Session):
    """Create a sample timeline."""
    timeline = Timeline(
        id=uuid.uuid4(),
        name="Test Philosophy Timeline",
        start_year=1700,
        end_year=1900,
    )
    db.add(timeline)
    db.commit()
    db.refresh(timeline)
    return timeline


@pytest.fixture
def sample_thinkers(db: Session, sample_timeline):
    """Create sample thinkers for testing."""
    thinkers = [
        Thinker(
            id=uuid.uuid4(),
            name="Immanuel Kant",
            birth_year=1724,
            death_year=1804,
            field="Philosophy",
            biography_notes="German philosopher",
            timeline_id=sample_timeline.id,
        ),
        Thinker(
            id=uuid.uuid4(),
            name="Georg Wilhelm Friedrich Hegel",
            birth_year=1770,
            death_year=1831,
            field="Philosophy",
            biography_notes="German philosopher",
            timeline_id=sample_timeline.id,
        ),
        Thinker(
            id=uuid.uuid4(),
            name="Arthur Schopenhauer",
            birth_year=1788,
            death_year=1860,
            field="Philosophy",
            biography_notes="German philosopher",
            timeline_id=sample_timeline.id,
        ),
        Thinker(
            id=uuid.uuid4(),
            name="John Stuart Mill",
            birth_year=1806,
            death_year=1873,
            field="Philosophy",
            biography_notes="British philosopher",
            timeline_id=sample_timeline.id,
        ),
    ]
    for t in thinkers:
        db.add(t)
    db.commit()
    return thinkers


@pytest.fixture
def sample_quotes(db: Session, sample_thinkers):
    """Create sample quotes for testing."""
    quotes = [
        Quote(
            id=uuid.uuid4(),
            thinker_id=sample_thinkers[0].id,  # Kant
            text="Two things fill the mind with ever new and increasing admiration and awe.",
            source="Critique of Practical Reason",
        ),
        Quote(
            id=uuid.uuid4(),
            thinker_id=sample_thinkers[1].id,  # Hegel
            text="The owl of Minerva spreads its wings only with the falling of the dusk.",
            source="Philosophy of Right",
        ),
    ]
    for q in quotes:
        db.add(q)
    db.commit()
    return quotes


@pytest.fixture
def sample_publications(db: Session, sample_thinkers):
    """Create sample publications for testing."""
    publications = [
        Publication(
            id=uuid.uuid4(),
            thinker_id=sample_thinkers[0].id,  # Kant
            title="Critique of Pure Reason",
            year=1781,
        ),
        Publication(
            id=uuid.uuid4(),
            thinker_id=sample_thinkers[1].id,  # Hegel
            title="Phenomenology of Spirit",
            year=1807,
        ),
    ]
    for p in publications:
        db.add(p)
    db.commit()
    return publications


@pytest.fixture
def sample_connections(db: Session, sample_thinkers):
    """Create sample connections for testing."""
    connections = [
        Connection(
            id=uuid.uuid4(),
            from_thinker_id=sample_thinkers[0].id,  # Kant
            to_thinker_id=sample_thinkers[1].id,  # Hegel
            connection_type="influenced",
            notes="Kant's critical philosophy influenced Hegel's dialectical method",
        ),
    ]
    for c in connections:
        db.add(c)
    db.commit()
    return connections


@pytest.fixture
def sample_question(db: Session, sample_thinkers):
    """Create a sample quiz question."""
    question = QuizQuestion(
        id=uuid.uuid4(),
        question_text="When was Immanuel Kant born?",
        question_type="multiple_choice",
        category="birth_year",
        correct_answer="1724",
        options=["1724", "1770", "1788", "1806"],
        difficulty="medium",
        explanation="Immanuel Kant was born in 1724 in Königsberg.",
        related_thinker_ids=[str(sample_thinkers[0].id)],
        times_asked=0,
        times_correct=0,
    )
    db.add(question)
    db.commit()
    db.refresh(question)
    return question


@pytest.fixture
def sample_session(db: Session, sample_question):
    """Create a sample quiz session."""
    session = QuizSession(
        id=uuid.uuid4(),
        difficulty="medium",
        question_count=10,
        score=0,
        completed=False,
        current_question_index=0,
        question_categories=["birth_year", "quote"],
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


# ============ SM-2 Algorithm Tests ============

class TestSM2Algorithm:
    """Tests for the SM-2 spaced repetition algorithm."""

    def test_calculate_quality_score_correct_fast(self):
        """Test quality score for fast correct answer."""
        score = calculate_quality_score(is_correct=True, time_taken_seconds=5)
        assert score == 5  # Perfect

    def test_calculate_quality_score_correct_normal(self):
        """Test quality score for normal speed correct answer."""
        score = calculate_quality_score(is_correct=True, time_taken_seconds=15)
        assert score == 4  # Correct after hesitation

    def test_calculate_quality_score_correct_slow(self):
        """Test quality score for slow correct answer."""
        score = calculate_quality_score(is_correct=True, time_taken_seconds=25)
        assert score == 3  # Correct with difficulty

    def test_calculate_quality_score_incorrect_quick(self):
        """Test quality score for quick incorrect answer."""
        score = calculate_quality_score(is_correct=False, time_taken_seconds=5)
        assert score == 2  # Incorrect but remembered

    def test_calculate_quality_score_incorrect_slow(self):
        """Test quality score for slow incorrect answer."""
        score = calculate_quality_score(is_correct=False, time_taken_seconds=35)
        assert score == 0  # Complete blackout

    def test_calculate_next_review_success_first_time(self):
        """Test next review for first successful answer."""
        result = calculate_next_review(
            ease_factor=2.5,
            interval_days=1,
            repetitions=0,
            quality=4,
        )
        assert result.repetitions == 1
        assert result.interval_days == 1
        assert result.ease_factor >= 2.3  # Should increase slightly

    def test_calculate_next_review_success_second_time(self):
        """Test next review for second successful answer."""
        result = calculate_next_review(
            ease_factor=2.5,
            interval_days=1,
            repetitions=1,
            quality=4,
        )
        assert result.repetitions == 2
        assert result.interval_days == 6  # Standard second interval

    def test_calculate_next_review_failure_resets(self):
        """Test that failure resets the repetition count."""
        result = calculate_next_review(
            ease_factor=2.5,
            interval_days=15,
            repetitions=5,
            quality=2,  # Incorrect
        )
        assert result.repetitions == 0
        assert result.interval_days == 1
        assert result.ease_factor < 2.5  # Should decrease

    def test_ease_factor_minimum(self):
        """Test that ease factor doesn't go below 1.3."""
        result = calculate_next_review(
            ease_factor=1.3,
            interval_days=1,
            repetitions=0,
            quality=0,  # Complete failure
        )
        assert result.ease_factor >= 1.3


# ============ Difficulty Adaptation Tests ============

class TestDifficultyAdaptation:
    """Tests for adaptive difficulty adjustment."""

    def test_increase_difficulty_after_streak(self):
        """Test difficulty increases after 3 correct answers."""
        answers = [True, True, True]
        new_diff = get_next_difficulty(answers, "medium")
        assert new_diff == "hard"

    def test_decrease_difficulty_after_failures(self):
        """Test difficulty decreases after 2 wrong answers."""
        answers = [True, False, False]
        new_diff = get_next_difficulty(answers, "medium")
        assert new_diff == "easy"

    def test_maintain_difficulty_mixed_answers(self):
        """Test difficulty stays same with mixed answers."""
        answers = [True, False, True, False]
        new_diff = get_next_difficulty(answers, "medium")
        assert new_diff == "medium"

    def test_cannot_exceed_hard(self):
        """Test difficulty cannot go above hard."""
        answers = [True, True, True]
        new_diff = get_next_difficulty(answers, "hard")
        assert new_diff == "hard"

    def test_cannot_go_below_easy(self):
        """Test difficulty cannot go below easy."""
        answers = [False, False]
        new_diff = get_next_difficulty(answers, "easy")
        assert new_diff == "easy"


# ============ Answer Validation Tests ============

class TestAnswerValidation:
    """Tests for answer validation logic."""

    def test_validate_multiple_choice_exact_match(self):
        """Test exact match for multiple choice."""
        result = validate_answer("1724", "1724", "multiple_choice")
        assert result is True

    def test_validate_multiple_choice_case_insensitive(self):
        """Test case insensitive matching."""
        result = validate_answer("KANT", "Kant", "multiple_choice")
        assert result is True

    def test_validate_short_answer_partial_match(self):
        """Test partial match for short answer."""
        result = validate_answer("Kant", "Immanuel Kant", "short_answer")
        assert result is True

    def test_validate_short_answer_year_match(self):
        """Test year extraction for short answer."""
        result = validate_answer("1724", "1724", "short_answer")
        assert result is True

    def test_validate_wrong_answer(self):
        """Test incorrect answer detection."""
        result = validate_answer("1770", "1724", "multiple_choice")
        assert result is False


# ============ Question Generation Tests ============

class TestQuestionGeneration:
    """Tests for question generation functions."""

    def test_generate_year_distractors_easy(self):
        """Test year distractor generation for easy difficulty."""
        distractors = generate_year_distractors(
            correct_year=1724,
            all_thinkers=[],
            difficulty="easy",
        )
        assert len(distractors) >= 3
        assert "1724" not in distractors

    def test_generate_year_distractors_hard(self):
        """Test year distractor generation for hard difficulty."""
        distractors = generate_year_distractors(
            correct_year=1724,
            all_thinkers=[],
            difficulty="hard",
        )
        assert len(distractors) >= 3
        # Hard distractors should be closer to correct answer
        for d in distractors:
            diff = abs(int(d) - 1724)
            assert diff <= 20

    def test_generate_birth_year_question(self):
        """Test birth year question generation."""
        thinker = {
            "id": str(uuid.uuid4()),
            "name": "Immanuel Kant",
            "birth_year": 1724,
            "death_year": 1804,
            "field": "Philosophy",
        }
        question = generate_birth_year_question(
            thinker=thinker,
            all_thinkers=[thinker],
            difficulty="medium",
            question_type="multiple_choice",
        )
        assert question is not None
        assert "Kant" in question.question_text
        assert question.correct_answer == "1724"
        assert len(question.options) == 4
        assert "1724" in question.options


# ============ API Endpoint Tests ============

class TestQuizAPIEndpoints:
    """Tests for quiz API endpoints."""

    def test_generate_question_no_thinkers(self, db: Session):
        """Test question generation fails gracefully with no thinkers."""
        response = client.post("/api/quiz/generate-question", json={
            "question_categories": ["birth_year"],
            "difficulty": "medium",
        })
        assert response.status_code == 400
        assert "No thinkers" in response.json()["detail"]

    def test_generate_question_success(self, db: Session, sample_thinkers):
        """Test successful question generation."""
        response = client.post("/api/quiz/generate-question", json={
            "question_categories": ["birth_year", "death_year", "field"],
            "difficulty": "medium",
        })
        assert response.status_code == 200
        data = response.json()
        assert "question_id" in data
        assert "question_text" in data
        assert "correct_answer" in data

    def test_generate_quiz_session(self, db: Session, sample_thinkers):
        """Test quiz session generation."""
        response = client.post("/api/quiz/generate-quiz", json={
            "question_categories": ["birth_year", "death_year"],
            "difficulty": "medium",
            "question_count": 5,
            "multiple_choice_ratio": 1.0,
        })
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "questions" in data
        assert len(data["questions"]) <= 5

    def test_validate_answer_correct(self, db: Session, sample_question, sample_session):
        """Test validating a correct answer."""
        response = client.post("/api/quiz/validate-answer", json={
            "question_id": str(sample_question.id),
            "user_answer": "1724",
            "session_id": str(sample_session.id),
            "time_taken_seconds": 10,
        })
        assert response.status_code == 200
        data = response.json()
        assert data["correct"] is True
        assert data["correct_answer"] == "1724"

    def test_validate_answer_incorrect(self, db: Session, sample_question, sample_session):
        """Test validating an incorrect answer."""
        response = client.post("/api/quiz/validate-answer", json={
            "question_id": str(sample_question.id),
            "user_answer": "1770",
            "session_id": str(sample_session.id),
            "time_taken_seconds": 15,
        })
        assert response.status_code == 200
        data = response.json()
        assert data["correct"] is False

    def test_get_session(self, db: Session, sample_session):
        """Test getting session details."""
        response = client.get(f"/api/quiz/session/{sample_session.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(sample_session.id)

    def test_get_session_not_found(self, db: Session):
        """Test getting non-existent session."""
        fake_id = str(uuid.uuid4())
        response = client.get(f"/api/quiz/session/{fake_id}")
        assert response.status_code == 404

    def test_get_history_empty(self, db: Session):
        """Test getting empty quiz history."""
        response = client.get("/api/quiz/history")
        assert response.status_code == 200
        assert response.json() == []

    def test_get_history_with_sessions(self, db: Session, sample_session):
        """Test getting quiz history with sessions."""
        response = client.get("/api/quiz/history")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

    def test_get_statistics(self, db: Session):
        """Test getting quiz statistics."""
        response = client.get("/api/quiz/statistics")
        assert response.status_code == 200
        data = response.json()
        assert "total_sessions" in data
        assert "overall_accuracy" in data
        assert "category_performance" in data

    def test_get_review_queue_empty(self, db: Session):
        """Test getting empty review queue."""
        response = client.get("/api/quiz/review-queue")
        assert response.status_code == 200
        assert response.json() == []

    def test_reset_question_stats(self, db: Session, sample_question):
        """Test resetting question statistics."""
        # First, update the question stats
        sample_question.times_asked = 10
        sample_question.times_correct = 7
        db.commit()

        response = client.post(f"/api/quiz/reset-question/{sample_question.id}")
        assert response.status_code == 200

        # Verify stats were reset
        db.refresh(sample_question)
        assert sample_question.times_asked == 0
        assert sample_question.times_correct == 0

    def test_complete_session(self, db: Session, sample_session):
        """Test completing a quiz session."""
        response = client.post(
            f"/api/quiz/complete-session/{sample_session.id}",
            params={"time_spent_seconds": 300}
        )
        assert response.status_code == 200

        # Verify session was marked complete
        db.refresh(sample_session)
        assert sample_session.completed is True
        assert sample_session.time_spent_seconds == 300


# ============ Integration Tests ============

class TestQuizIntegration:
    """Integration tests for the complete quiz flow."""

    def test_full_quiz_flow(self, db: Session, sample_thinkers):
        """Test a complete quiz session from start to finish."""
        # 1. Generate a quiz
        gen_response = client.post("/api/quiz/generate-quiz", json={
            "question_categories": ["birth_year"],
            "difficulty": "easy",
            "question_count": 3,
            "multiple_choice_ratio": 1.0,
        })
        assert gen_response.status_code == 200
        quiz_data = gen_response.json()
        session_id = quiz_data["id"]
        questions = quiz_data["questions"]

        # 2. Answer each question
        for q in questions:
            val_response = client.post("/api/quiz/validate-answer", json={
                "question_id": q["question_id"],
                "user_answer": q["correct_answer"],  # Answer correctly
                "session_id": session_id,
                "time_taken_seconds": 10,
            })
            assert val_response.status_code == 200
            assert val_response.json()["correct"] is True

        # 3. Complete the session
        complete_response = client.post(f"/api/quiz/complete-session/{session_id}")
        assert complete_response.status_code == 200

        # 4. Verify session in history
        history_response = client.get("/api/quiz/history")
        assert history_response.status_code == 200
        history = history_response.json()
        assert any(s["session_id"] == session_id for s in history)

        # 5. Check statistics updated
        stats_response = client.get("/api/quiz/statistics")
        assert stats_response.status_code == 200
        stats = stats_response.json()
        assert stats["total_questions_answered"] >= len(questions)

    def test_spaced_repetition_flow(self, db: Session, sample_question, sample_session):
        """Test spaced repetition tracking through answers."""
        # Answer incorrectly - should create SR entry
        response = client.post("/api/quiz/validate-answer", json={
            "question_id": str(sample_question.id),
            "user_answer": "wrong",
            "session_id": str(sample_session.id),
            "time_taken_seconds": 5,
        })
        assert response.status_code == 200
        assert response.json()["correct"] is False

        # Check SR entry was created
        sr_entry = db.query(SpacedRepetitionQueue).filter(
            SpacedRepetitionQueue.question_id == sample_question.id
        ).first()
        assert sr_entry is not None
        assert sr_entry.repetitions == 0  # Reset due to failure

    def test_adaptive_difficulty_flow(self, db: Session, sample_thinkers):
        """Test adaptive difficulty adjustment during quiz."""
        # Generate a quiz with adaptive difficulty
        gen_response = client.post("/api/quiz/generate-quiz", json={
            "question_categories": ["birth_year"],
            "difficulty": "adaptive",
            "question_count": 5,
            "multiple_choice_ratio": 1.0,
        })
        assert gen_response.status_code == 200
        quiz_data = gen_response.json()
        session_id = quiz_data["id"]
        questions = quiz_data["questions"]

        # Answer 3 questions correctly in a row
        last_difficulty = None
        for i, q in enumerate(questions[:3]):
            val_response = client.post("/api/quiz/validate-answer", json={
                "question_id": q["question_id"],
                "user_answer": q["correct_answer"],
                "session_id": session_id,
                "time_taken_seconds": 5,
            })
            assert val_response.status_code == 200
            last_difficulty = val_response.json().get("next_difficulty")

        # After 3 correct, difficulty should increase
        assert last_difficulty is not None


# ============ Edge Cases ============

class TestQuizEdgeCases:
    """Tests for edge cases and error handling."""

    def test_question_not_found(self, db: Session, sample_session):
        """Test handling of non-existent question."""
        fake_id = str(uuid.uuid4())
        response = client.post("/api/quiz/validate-answer", json={
            "question_id": fake_id,
            "user_answer": "test",
            "session_id": str(sample_session.id),
        })
        assert response.status_code == 404

    def test_session_not_found(self, db: Session, sample_question):
        """Test handling of non-existent session."""
        fake_id = str(uuid.uuid4())
        response = client.post("/api/quiz/validate-answer", json={
            "question_id": str(sample_question.id),
            "user_answer": "test",
            "session_id": fake_id,
        })
        assert response.status_code == 404

    def test_invalid_question_count(self, db: Session, sample_thinkers):
        """Test validation of question count limits."""
        response = client.post("/api/quiz/generate-quiz", json={
            "question_categories": ["birth_year"],
            "difficulty": "medium",
            "question_count": 100,  # Over limit
            "multiple_choice_ratio": 0.7,
        })
        assert response.status_code == 422  # Validation error

    def test_empty_categories(self, db: Session, sample_thinkers):
        """Test handling of empty categories."""
        response = client.post("/api/quiz/generate-question", json={
            "question_categories": [],
            "difficulty": "medium",
        })
        # Should still work, defaulting to some category
        assert response.status_code in [200, 400]

    def test_timeline_filter(self, db: Session, sample_thinkers, sample_timeline):
        """Test filtering by timeline."""
        response = client.post("/api/quiz/generate-question", json={
            "timeline_id": str(sample_timeline.id),
            "question_categories": ["birth_year"],
            "difficulty": "medium",
        })
        assert response.status_code == 200
