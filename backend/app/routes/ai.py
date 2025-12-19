from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from app.database import get_db
from app.models.thinker import Thinker
from app.models.connection import Connection
from app.models.publication import Publication
from app.models.quote import Quote
from app.models.research_question import ResearchQuestion
from app.utils.ai_service import (
    is_ai_enabled,
    suggest_connections,
    generate_thinker_summary,
    suggest_research_questions,
    validate_connection,
    chat_with_context,
    generate_summary,
    parse_natural_language_entry,
)

router = APIRouter(prefix="/api/ai", tags=["ai"])


class ConnectionSuggestionResponse(BaseModel):
    from_thinker_id: str
    from_thinker_name: str
    to_thinker_id: str
    to_thinker_name: str
    connection_type: str
    confidence: float
    reasoning: str


class ThinkerInsightResponse(BaseModel):
    summary: str
    key_contributions: List[str]
    intellectual_context: str
    related_concepts: List[str]


class ResearchSuggestionResponse(BaseModel):
    question: str
    category: str
    rationale: str
    related_thinkers: List[str]


class ValidationRequest(BaseModel):
    from_thinker_id: str
    to_thinker_id: str
    connection_type: str
    notes: Optional[str] = None


class ValidationResponse(BaseModel):
    is_plausible: bool
    confidence: float
    feedback: str
    suggested_type: Optional[str] = None


class AIStatusResponse(BaseModel):
    enabled: bool
    message: str


@router.get("/status", response_model=AIStatusResponse)
def get_ai_status():
    """Check if AI features are enabled."""
    enabled = is_ai_enabled()
    return AIStatusResponse(
        enabled=enabled,
        message="AI features are enabled (using DeepSeek)" if enabled else "AI features are disabled. Set DEEPSEEK_API_KEY environment variable to enable."
    )


@router.get("/suggest-connections", response_model=List[ConnectionSuggestionResponse])
async def get_connection_suggestions(
    limit: int = 5,
    timeline_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get AI-suggested connections between thinkers."""
    if not is_ai_enabled():
        raise HTTPException(status_code=503, detail="AI features are not enabled. Set DEEPSEEK_API_KEY environment variable.")

    # Get thinkers
    query = db.query(Thinker)
    if timeline_id:
        query = query.filter(Thinker.timeline_id == timeline_id)
    thinkers = query.all()

    # Get existing connections
    connections = db.query(Connection).all()

    # Convert to dicts for AI service
    thinker_dicts = [
        {
            "id": str(t.id),
            "name": t.name,
            "birth_year": t.birth_year,
            "death_year": t.death_year,
            "field": t.field,
            "biography_notes": t.biography_notes,
        }
        for t in thinkers
    ]

    connection_dicts = [
        {
            "from_thinker_id": str(c.from_thinker_id),
            "to_thinker_id": str(c.to_thinker_id),
            "bidirectional": c.bidirectional,
        }
        for c in connections
    ]

    suggestions = await suggest_connections(thinker_dicts, connection_dicts, limit)

    return [
        ConnectionSuggestionResponse(
            from_thinker_id=s.from_thinker_id,
            from_thinker_name=s.from_thinker_name,
            to_thinker_id=s.to_thinker_id,
            to_thinker_name=s.to_thinker_name,
            connection_type=s.connection_type,
            confidence=s.confidence,
            reasoning=s.reasoning,
        )
        for s in suggestions
    ]


@router.get("/thinker-insight/{thinker_id}", response_model=ThinkerInsightResponse)
async def get_thinker_insight(thinker_id: str, db: Session = Depends(get_db)):
    """Get AI-generated insights about a thinker."""
    if not is_ai_enabled():
        raise HTTPException(status_code=503, detail="AI features are not enabled. Set DEEPSEEK_API_KEY environment variable.")

    thinker = db.query(Thinker).filter(Thinker.id == thinker_id).first()
    if not thinker:
        raise HTTPException(status_code=404, detail="Thinker not found")

    publications = db.query(Publication).filter(Publication.thinker_id == thinker_id).all()
    quotes = db.query(Quote).filter(Quote.thinker_id == thinker_id).all()

    thinker_dict = {
        "id": str(thinker.id),
        "name": thinker.name,
        "birth_year": thinker.birth_year,
        "death_year": thinker.death_year,
        "field": thinker.field,
        "biography_notes": thinker.biography_notes,
    }

    pub_dicts = [{"title": p.title, "year": p.year} for p in publications]
    quote_dicts = [{"text": q.text, "source": q.source} for q in quotes]

    insight = await generate_thinker_summary(thinker_dict, pub_dicts, quote_dicts)

    if not insight:
        raise HTTPException(status_code=500, detail="Failed to generate insight")

    return ThinkerInsightResponse(
        summary=insight.summary,
        key_contributions=insight.key_contributions,
        intellectual_context=insight.intellectual_context,
        related_concepts=insight.related_concepts,
    )


@router.get("/suggest-research", response_model=List[ResearchSuggestionResponse])
async def get_research_suggestions(
    limit: int = 3,
    thinker_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get AI-suggested research questions."""
    if not is_ai_enabled():
        raise HTTPException(status_code=503, detail="AI features are not enabled. Set DEEPSEEK_API_KEY environment variable.")

    thinkers = db.query(Thinker).all()
    questions = db.query(ResearchQuestion).all()

    thinker_dicts = [
        {
            "id": str(t.id),
            "name": t.name,
            "field": t.field,
        }
        for t in thinkers
    ]

    question_dicts = [{"title": q.title} for q in questions]

    suggestions = await suggest_research_questions(
        thinker_dicts,
        question_dicts,
        focus_thinker_id=thinker_id,
        limit=limit,
    )

    return [
        ResearchSuggestionResponse(
            question=s.question,
            category=s.category,
            rationale=s.rationale,
            related_thinkers=s.related_thinkers,
        )
        for s in suggestions
    ]


@router.post("/validate-connection", response_model=ValidationResponse)
async def validate_connection_endpoint(
    request: ValidationRequest,
    db: Session = Depends(get_db)
):
    """Validate a proposed connection using AI."""
    if not is_ai_enabled():
        raise HTTPException(status_code=503, detail="AI features are not enabled. Set DEEPSEEK_API_KEY environment variable.")

    from_thinker = db.query(Thinker).filter(Thinker.id == request.from_thinker_id).first()
    to_thinker = db.query(Thinker).filter(Thinker.id == request.to_thinker_id).first()

    if not from_thinker or not to_thinker:
        raise HTTPException(status_code=404, detail="One or both thinkers not found")

    from_dict = {
        "name": from_thinker.name,
        "birth_year": from_thinker.birth_year,
        "death_year": from_thinker.death_year,
        "field": from_thinker.field,
    }

    to_dict = {
        "name": to_thinker.name,
        "birth_year": to_thinker.birth_year,
        "death_year": to_thinker.death_year,
        "field": to_thinker.field,
    }

    result = await validate_connection(
        from_dict,
        to_dict,
        request.connection_type,
        request.notes,
    )

    return ValidationResponse(
        is_plausible=result.get("is_plausible", True),
        confidence=result.get("confidence", 0.5),
        feedback=result.get("feedback", ""),
        suggested_type=result.get("suggested_type"),
    )


# New Chat, Summary, and NL Parsing endpoints

class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    question: str
    conversation_history: Optional[List[ChatMessage]] = None


class CitationResponse(BaseModel):
    type: str
    id: str
    name: str


class ChatResponse(BaseModel):
    answer: str
    citations: List[CitationResponse]
    follow_up_questions: List[str]


class SummaryRequest(BaseModel):
    summary_type: str  # "timeline", "thinker", "field", "period", "overview"
    target_id: Optional[str] = None
    target_name: Optional[str] = None
    length: str = "medium"  # "short", "medium", "detailed"


class SummaryResponse(BaseModel):
    summary: str
    key_points: List[str]
    key_figures: List[str]
    themes: List[str]
    length: str


class ParseRequest(BaseModel):
    text: str


class ParseResponse(BaseModel):
    entity_type: str
    data: dict
    confidence: float
    needs_clarification: List[str]


@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest, db: Session = Depends(get_db)):
    """
    RAG-powered chat endpoint for asking questions about the research database.

    Examples:
    - "Who influenced Rawls?"
    - "What are the main themes in 20th century analytic philosophy?"
    - "How are Kant and Hegel connected?"
    """
    if not is_ai_enabled():
        raise HTTPException(status_code=503, detail="AI features are not enabled. Set DEEPSEEK_API_KEY environment variable.")

    # Get all data from database
    thinkers = db.query(Thinker).all()
    connections = db.query(Connection).all()
    publications = db.query(Publication).all()
    quotes = db.query(Quote).all()

    # Convert to dicts
    thinker_dicts = [
        {
            "id": str(t.id),
            "name": t.name,
            "birth_year": t.birth_year,
            "death_year": t.death_year,
            "field": t.field,
            "biography_notes": t.biography_notes,
        }
        for t in thinkers
    ]

    connection_dicts = [
        {
            "from_thinker_id": str(c.from_thinker_id),
            "to_thinker_id": str(c.to_thinker_id),
            "connection_type": c.connection_type,
            "notes": c.notes,
        }
        for c in connections
    ]

    pub_dicts = [
        {
            "thinker_id": str(p.thinker_id),
            "title": p.title,
            "year": p.year,
        }
        for p in publications
    ]

    quote_dicts = [
        {
            "thinker_id": str(q.thinker_id),
            "text": q.text,
            "source": q.source,
        }
        for q in quotes
    ]

    # Convert conversation history
    history = None
    if request.conversation_history:
        history = [{"role": m.role, "content": m.content} for m in request.conversation_history]

    result = await chat_with_context(
        request.question,
        thinker_dicts,
        connection_dicts,
        pub_dicts,
        quote_dicts,
        history,
    )

    if not result:
        raise HTTPException(status_code=500, detail="Failed to generate response")

    return ChatResponse(
        answer=result.answer,
        citations=[CitationResponse(type=c["type"], id=c["id"], name=c["name"]) for c in result.citations],
        follow_up_questions=result.follow_up_questions,
    )


@router.post("/summary", response_model=SummaryResponse)
async def summary_endpoint(request: SummaryRequest, db: Session = Depends(get_db)):
    """
    Generate summaries of various aspects of the database.

    Types:
    - "overview": Overview of the entire database
    - "thinker": Summary of a specific thinker (requires target_id)
    - "field": Summary of a field (requires target_name, e.g., "Philosophy")
    - "period": Summary of a time period (requires target_name, e.g., "1700-1800")
    """
    if not is_ai_enabled():
        raise HTTPException(status_code=503, detail="AI features are not enabled. Set DEEPSEEK_API_KEY environment variable.")

    # Get data from database
    thinkers = db.query(Thinker).all()
    connections = db.query(Connection).all()
    publications = db.query(Publication).all()

    thinker_dicts = [
        {
            "id": str(t.id),
            "name": t.name,
            "birth_year": t.birth_year,
            "death_year": t.death_year,
            "field": t.field,
            "biography_notes": t.biography_notes,
        }
        for t in thinkers
    ]

    connection_dicts = [
        {
            "from_thinker_id": str(c.from_thinker_id),
            "to_thinker_id": str(c.to_thinker_id),
            "connection_type": c.connection_type,
        }
        for c in connections
    ]

    pub_dicts = [
        {
            "thinker_id": str(p.thinker_id),
            "title": p.title,
            "year": p.year,
        }
        for p in publications
    ]

    result = await generate_summary(
        request.summary_type,
        request.target_id,
        request.target_name,
        thinker_dicts,
        connection_dicts,
        pub_dicts,
        request.length,
    )

    if not result:
        raise HTTPException(status_code=500, detail="Failed to generate summary")

    return SummaryResponse(
        summary=result.summary,
        key_points=result.key_points,
        key_figures=result.key_figures,
        themes=result.themes,
        length=result.length,
    )


@router.post("/parse", response_model=ParseResponse)
async def parse_natural_language(request: ParseRequest, db: Session = Depends(get_db)):
    """
    Parse natural language input into structured database entries.

    Examples:
    - "Add Immanuel Kant, born 1724, died 1804, philosopher"
    - "Kant influenced Hegel's dialectical method"
    - "Quote from Spinoza: 'All things excellent are as difficult as they are rare'"
    - "Kant wrote Critique of Pure Reason in 1781"
    """
    if not is_ai_enabled():
        raise HTTPException(status_code=503, detail="AI features are not enabled. Set DEEPSEEK_API_KEY environment variable.")

    thinkers = db.query(Thinker).all()
    thinker_dicts = [
        {
            "id": str(t.id),
            "name": t.name,
        }
        for t in thinkers
    ]

    result = await parse_natural_language_entry(request.text, thinker_dicts)

    if not result:
        raise HTTPException(status_code=500, detail="Failed to parse input")

    return ParseResponse(
        entity_type=result.entity_type,
        data=result.data,
        confidence=result.confidence,
        needs_clarification=result.needs_clarification,
    )
