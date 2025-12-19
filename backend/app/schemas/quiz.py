"""
Pydantic schemas for quiz system - request/response validation.
"""
from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional, List, Literal
from datetime import datetime
from uuid import UUID


# Type literals for enums
QuestionCategoryStr = Literal[
    "birth_year", "death_year", "quote", "quote_completion",
    "publication", "connection", "field", "biography"
]
QuestionTypeStr = Literal["multiple_choice", "short_answer"]
DifficultyStr = Literal["easy", "medium", "hard", "adaptive"]


# ============ Quiz Question Schemas ============

class QuizQuestionBase(BaseModel):
    """Base schema for quiz questions."""
    question_text: str
    question_type: QuestionTypeStr
    category: QuestionCategoryStr
    correct_answer: str
    options: Optional[List[str]] = None
    difficulty: DifficultyStr = "medium"
    explanation: Optional[str] = None
    related_thinker_ids: Optional[List[str]] = None
    timeline_id: Optional[UUID] = None


class QuizQuestionCreate(QuizQuestionBase):
    """Schema for creating a quiz question."""
    pass


class QuizQuestion(QuizQuestionBase):
    """Schema for quiz question response."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    times_asked: int = 0
    times_correct: int = 0
    created_at: datetime
    updated_at: datetime

    @property
    def accuracy_rate(self) -> float:
        """Calculate accuracy rate for this question."""
        if self.times_asked == 0:
            return 0.0
        return (self.times_correct / self.times_asked) * 100


class QuizQuestionResponse(BaseModel):
    """API response for a quiz question (client-friendly)."""
    question_id: str
    question_text: str
    question_type: QuestionTypeStr
    category: QuestionCategoryStr
    options: Optional[List[str]] = None
    correct_answer: str
    difficulty: DifficultyStr
    related_thinker_ids: List[str] = []
    explanation: str = ""
    from_pool: bool = True
    times_asked: Optional[int] = None
    accuracy_rate: Optional[float] = None


# ============ Quiz Session Schemas ============

class QuizSessionBase(BaseModel):
    """Base schema for quiz sessions."""
    timeline_id: Optional[UUID] = None
    difficulty: DifficultyStr = "medium"
    question_count: int
    question_categories: Optional[List[QuestionCategoryStr]] = None


class QuizSessionCreate(QuizSessionBase):
    """Schema for creating a quiz session."""
    pass


class QuizSessionUpdate(BaseModel):
    """Schema for updating a quiz session."""
    score: Optional[int] = None
    completed: Optional[bool] = None
    time_spent_seconds: Optional[int] = None
    current_question_index: Optional[int] = None
    completed_at: Optional[datetime] = None


class QuizSession(QuizSessionBase):
    """Schema for quiz session response."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    score: int = 0
    completed: bool = False
    time_spent_seconds: Optional[int] = None
    current_question_index: int = 0
    created_at: datetime
    completed_at: Optional[datetime] = None


class QuizSessionWithQuestions(QuizSession):
    """Quiz session with full question list."""
    questions: List[QuizQuestionResponse] = []


class QuizSessionSummary(BaseModel):
    """Summary of a quiz session for history."""
    session_id: str
    created_at: datetime
    completed_at: Optional[datetime] = None
    score: int
    total_questions: int
    accuracy_percentage: float
    difficulty: DifficultyStr
    timeline_name: Optional[str] = None


# ============ Quiz Answer Schemas ============

class QuizAnswerBase(BaseModel):
    """Base schema for quiz answers."""
    session_id: UUID
    question_id: UUID
    user_answer: str
    is_correct: bool
    time_taken_seconds: Optional[int] = None


class QuizAnswerCreate(BaseModel):
    """Schema for creating a quiz answer."""
    question_id: str
    user_answer: str
    session_id: str
    time_taken_seconds: Optional[int] = None


class QuizAnswer(QuizAnswerBase):
    """Schema for quiz answer response."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    answered_at: datetime


# ============ Spaced Repetition Schemas ============

class SpacedRepetitionEntry(BaseModel):
    """Schema for spaced repetition queue entry."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    question_id: UUID
    last_answered_at: Optional[datetime] = None
    next_review_at: datetime
    ease_factor: float = 2.5
    interval_days: int = 1
    repetitions: int = 0
    created_at: datetime


# ============ Request/Response Schemas ============

class QuestionGenerationParams(BaseModel):
    """Parameters for generating a quiz question."""
    timeline_id: Optional[str] = None
    question_categories: List[QuestionCategoryStr] = ["birth_year", "quote", "connection"]
    difficulty: DifficultyStr = "medium"
    question_type: Literal["multiple_choice", "short_answer", "auto"] = "auto"
    exclude_question_ids: List[str] = []
    use_spaced_repetition: bool = False


class QuizGenerationParams(BaseModel):
    """Parameters for generating a full quiz."""
    timeline_id: Optional[str] = None
    question_categories: List[QuestionCategoryStr] = ["birth_year", "quote", "connection"]
    difficulty: DifficultyStr = "medium"
    question_count: int = 10
    multiple_choice_ratio: float = 0.7  # 0.0 to 1.0

    @field_validator('question_count')
    @classmethod
    def validate_question_count(cls, v):
        if v < 1 or v > 50:
            raise ValueError('Question count must be between 1 and 50')
        return v

    @field_validator('multiple_choice_ratio')
    @classmethod
    def validate_ratio(cls, v):
        if v < 0.0 or v > 1.0:
            raise ValueError('Multiple choice ratio must be between 0.0 and 1.0')
        return v


class AnswerValidationRequest(BaseModel):
    """Request to validate an answer."""
    question_id: str
    user_answer: str
    session_id: str
    time_taken_seconds: Optional[int] = None


class AnswerValidationResponse(BaseModel):
    """Response after validating an answer."""
    correct: bool
    explanation: str
    correct_answer: str
    additional_context: Optional[str] = None
    next_difficulty: Optional[DifficultyStr] = None
    next_review_at: Optional[datetime] = None


class CategoryBreakdown(BaseModel):
    """Statistics breakdown by category."""
    category: QuestionCategoryStr
    total: int
    correct: int
    accuracy: float


class DifficultyProgression(BaseModel):
    """Track difficulty changes during quiz."""
    question_index: int
    difficulty: DifficultyStr


class StreakData(BaseModel):
    """Track answer streaks."""
    longest_streak: int
    current_streak: int


class SessionStatistics(BaseModel):
    """Comprehensive statistics for a session."""
    total_questions: int
    correct_answers: int
    accuracy_percentage: float
    average_time_seconds: float
    category_breakdown: List[CategoryBreakdown]
    difficulty_progression: List[DifficultyProgression]
    streak_data: StreakData


class CategoryPerformance(BaseModel):
    """Performance for a specific category."""
    category: QuestionCategoryStr
    total_asked: int
    accuracy: float


class DifficultyDistribution(BaseModel):
    """Distribution of questions by difficulty."""
    easy: int
    medium: int
    hard: int


class QuizStatistics(BaseModel):
    """Overall quiz statistics."""
    total_sessions: int
    total_questions_answered: int
    overall_accuracy: float
    category_performance: List[CategoryPerformance]
    difficulty_distribution: DifficultyDistribution
    review_queue_size: int
    average_session_score: float
    improvement_trend: float  # Positive = improving


class QuizHistoryParams(BaseModel):
    """Parameters for quiz history query."""
    limit: int = 10
    offset: int = 0
    timeline_id: Optional[str] = None
