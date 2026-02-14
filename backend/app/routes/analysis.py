from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, case, distinct, func, or_
from sqlalchemy.orm import Session, aliased

from app.constants import notes_ai_phase_enabled
from app.database import get_db
from app.models.connection import Connection
from app.models.critical_term import CriticalTerm, TermOccurrence
from app.models.note import Note
from app.models.notes_ai import WeeklyDigest
from app.models.thinker import Thinker
from app.models.thinker_mention import ThinkerCoOccurrence, ThinkerMention
from app.services.notes_ai.argumentation import build_argument_map_from_notes
from app.services.notes_ai.discovery import (
    build_connection_explanations,
    related_excerpts_for_occurrence,
    semantic_search_notes,
)
from app.services.notes_ai.planning import (
    build_advisor_brief,
    build_research_sprint_plan,
    build_viva_practice,
    build_weekly_digest,
)
from app.utils.ai_service import get_ai_usage_status
from app.schemas.analysis import (
    AIUsageResponse,
    AdvisorBriefResponse,
    ArgumentMapRequest,
    ArgumentMapResponse,
    CoOccurrencePair,
    ConnectionSuggestionFromNotes,
    ConnectionExplanation,
    PremiseGap,
    PremiseGapCheckRequest,
    PremiseGapCheckResponse,
    RelatedExcerpt,
    ResearchSprintPlanResponse,
    SemanticSearchResult,
    TermThinkerBubble,
    TermThinkerMatrixResponse,
    VivaPracticeResponse,
    WeeklyDigestResponse,
)

router = APIRouter(prefix="/api/analysis", tags=["analysis"])


@router.get("/term-thinker-matrix", response_model=TermThinkerMatrixResponse)
def get_term_thinker_matrix(
    folder_id: Optional[UUID] = None,
    term_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
):
    query = (
        db.query(
            CriticalTerm.id.label("term_id"),
            CriticalTerm.name.label("term_name"),
            Thinker.id.label("thinker_id"),
            Thinker.name.label("thinker_name"),
            Thinker.birth_year.label("thinker_birth_year"),
            Thinker.death_year.label("thinker_death_year"),
            func.count(distinct(TermOccurrence.note_id)).label("frequency"),
        )
        .join(TermOccurrence, TermOccurrence.term_id == CriticalTerm.id)
        .join(ThinkerMention, ThinkerMention.note_id == TermOccurrence.note_id)
        .join(Thinker, Thinker.id == ThinkerMention.thinker_id)
        .filter(CriticalTerm.is_active == True)  # noqa: E712
    )

    if folder_id is not None:
        query = query.join(Note, Note.id == TermOccurrence.note_id)
        query = query.filter(Note.folder_id == folder_id)

    if term_id is not None:
        query = query.filter(CriticalTerm.id == term_id)

    rows = (
        query.group_by(
            CriticalTerm.id,
            CriticalTerm.name,
            Thinker.id,
            Thinker.name,
            Thinker.birth_year,
            Thinker.death_year,
        )
        .order_by(func.count(distinct(TermOccurrence.note_id)).desc())
        .all()
    )

    bubbles: List[TermThinkerBubble] = []
    unique_terms: set[str] = set()
    unique_thinkers: set[str] = set()
    max_frequency = 0

    for row in rows:
        snippet_query = (
            db.query(TermOccurrence.context_snippet)
            .join(ThinkerMention, ThinkerMention.note_id == TermOccurrence.note_id)
            .filter(
                TermOccurrence.term_id == row.term_id,
                ThinkerMention.thinker_id == row.thinker_id,
            )
        )

        if folder_id is not None:
            snippet_query = snippet_query.join(Note, Note.id == TermOccurrence.note_id)
            snippet_query = snippet_query.filter(Note.folder_id == folder_id)

        snippet_query = snippet_query.distinct().limit(3)

        snippets = [item[0] for item in snippet_query.all() if item[0]]

        bubbles.append(
            TermThinkerBubble(
                term_id=row.term_id,
                term_name=row.term_name,
                thinker_id=row.thinker_id,
                thinker_name=row.thinker_name,
                thinker_birth_year=row.thinker_birth_year,
                thinker_death_year=row.thinker_death_year,
                frequency=row.frequency,
                sample_snippets=snippets,
            )
        )

        unique_terms.add(row.term_name)
        unique_thinkers.add(row.thinker_name)
        max_frequency = max(max_frequency, int(row.frequency or 0))

    return TermThinkerMatrixResponse(
        bubbles=bubbles,
        terms=sorted(unique_terms),
        thinkers=sorted(unique_thinkers),
        total_bubbles=len(bubbles),
        max_frequency=max_frequency if max_frequency > 0 else 1,
    )


@router.get("/co-occurrences", response_model=List[CoOccurrencePair])
def get_co_occurrences(
    min_count: int = Query(default=2, ge=1),
    folder_id: Optional[UUID] = Query(default=None),
    db: Session = Depends(get_db),
):
    thinker_a = aliased(Thinker, name="thinker_a")
    thinker_b = aliased(Thinker, name="thinker_b")

    co_occ_query = db.query(
        ThinkerCoOccurrence.thinker_a_id,
        ThinkerCoOccurrence.thinker_b_id,
        func.count(ThinkerCoOccurrence.id).label("co_occurrence_count"),
        func.sum(
            case((ThinkerCoOccurrence.co_occurrence_type == "same_paragraph", 1), else_=0)
        ).label("same_paragraph_count"),
    )

    if folder_id is not None:
        co_occ_query = co_occ_query.join(Note, ThinkerCoOccurrence.note_id == Note.id).filter(
            Note.folder_id == folder_id
        )

    co_occ_subquery = (
        co_occ_query.group_by(ThinkerCoOccurrence.thinker_a_id, ThinkerCoOccurrence.thinker_b_id)
        .having(func.count(ThinkerCoOccurrence.id) >= min_count)
        .subquery("co_occ")
    )

    rows = (
        db.query(
            co_occ_subquery.c.thinker_a_id,
            thinker_a.name.label("thinker_a_name"),
            thinker_a.birth_year.label("thinker_a_birth_year"),
            thinker_a.death_year.label("thinker_a_death_year"),
            co_occ_subquery.c.thinker_b_id,
            thinker_b.name.label("thinker_b_name"),
            thinker_b.birth_year.label("thinker_b_birth_year"),
            thinker_b.death_year.label("thinker_b_death_year"),
            co_occ_subquery.c.co_occurrence_count,
            co_occ_subquery.c.same_paragraph_count,
        )
        .join(thinker_a, co_occ_subquery.c.thinker_a_id == thinker_a.id)
        .join(thinker_b, co_occ_subquery.c.thinker_b_id == thinker_b.id)
        .order_by(co_occ_subquery.c.co_occurrence_count.desc())
        .all()
    )

    response: List[CoOccurrencePair] = []
    for row in rows:
        existing = (
            db.query(Connection)
            .filter(
                or_(
                    and_(
                        Connection.from_thinker_id == row.thinker_a_id,
                        Connection.to_thinker_id == row.thinker_b_id,
                    ),
                    and_(
                        Connection.from_thinker_id == row.thinker_b_id,
                        Connection.to_thinker_id == row.thinker_a_id,
                    ),
                )
            )
            .first()
        )

        response.append(
            CoOccurrencePair(
                thinker_a_id=row.thinker_a_id,
                thinker_a_name=row.thinker_a_name,
                thinker_a_birth_year=row.thinker_a_birth_year,
                thinker_a_death_year=row.thinker_a_death_year,
                thinker_b_id=row.thinker_b_id,
                thinker_b_name=row.thinker_b_name,
                thinker_b_birth_year=row.thinker_b_birth_year,
                thinker_b_death_year=row.thinker_b_death_year,
                co_occurrence_count=row.co_occurrence_count,
                same_paragraph_count=row.same_paragraph_count,
                has_existing_connection=existing is not None,
                existing_connection_type=(
                    getattr(existing.connection_type, "value", existing.connection_type)
                    if existing
                    else None
                ),
            )
        )

    return response


@router.get("/connection-suggestions", response_model=List[ConnectionSuggestionFromNotes])
def get_connection_suggestions(
    limit: int = Query(default=10, ge=1, le=50),
    folder_id: Optional[UUID] = Query(default=None),
    db: Session = Depends(get_db),
):
    thinker_a = aliased(Thinker, name="thinker_a")
    thinker_b = aliased(Thinker, name="thinker_b")

    co_occ_query = db.query(
        ThinkerCoOccurrence.thinker_a_id,
        ThinkerCoOccurrence.thinker_b_id,
        func.count(ThinkerCoOccurrence.id).label("co_occurrence_count"),
        func.sum(
            case((ThinkerCoOccurrence.co_occurrence_type == "same_paragraph", 1), else_=0)
        ).label("same_paragraph_count"),
    )

    if folder_id is not None:
        co_occ_query = co_occ_query.join(Note, ThinkerCoOccurrence.note_id == Note.id).filter(
            Note.folder_id == folder_id
        )

    co_occ_subquery = (
        co_occ_query.group_by(ThinkerCoOccurrence.thinker_a_id, ThinkerCoOccurrence.thinker_b_id)
        .having(func.count(ThinkerCoOccurrence.id) >= 2)
        .subquery("co_occ")
    )

    rows = (
        db.query(
            co_occ_subquery.c.thinker_a_id,
            thinker_a.name.label("thinker_a_name"),
            thinker_a.birth_year.label("thinker_a_birth_year"),
            thinker_a.death_year.label("thinker_a_death_year"),
            co_occ_subquery.c.thinker_b_id,
            thinker_b.name.label("thinker_b_name"),
            thinker_b.birth_year.label("thinker_b_birth_year"),
            thinker_b.death_year.label("thinker_b_death_year"),
            co_occ_subquery.c.co_occurrence_count,
            co_occ_subquery.c.same_paragraph_count,
        )
        .join(thinker_a, co_occ_subquery.c.thinker_a_id == thinker_a.id)
        .join(thinker_b, co_occ_subquery.c.thinker_b_id == thinker_b.id)
        .order_by(co_occ_subquery.c.co_occurrence_count.desc())
        .all()
    )

    suggestions: List[ConnectionSuggestionFromNotes] = []
    for row in rows:
        if len(suggestions) >= limit:
            break

        existing = (
            db.query(Connection)
            .filter(
                or_(
                    and_(
                        Connection.from_thinker_id == row.thinker_a_id,
                        Connection.to_thinker_id == row.thinker_b_id,
                    ),
                    and_(
                        Connection.from_thinker_id == row.thinker_b_id,
                        Connection.to_thinker_id == row.thinker_a_id,
                    ),
                )
            )
            .first()
        )
        if existing is not None:
            continue

        sample_notes_query = (
            db.query(Note.title, Note.content)
            .join(ThinkerCoOccurrence, ThinkerCoOccurrence.note_id == Note.id)
            .filter(
                ThinkerCoOccurrence.thinker_a_id == row.thinker_a_id,
                ThinkerCoOccurrence.thinker_b_id == row.thinker_b_id,
            )
        )

        if folder_id is not None:
            sample_notes_query = sample_notes_query.filter(Note.folder_id == folder_id)

        sample_notes_query = sample_notes_query.distinct().limit(5)

        sample_notes = sample_notes_query.all()

        sample_titles: List[str] = []
        sample_excerpts: List[str] = []
        for note in sample_notes:
            title = note.title or "Untitled Note"
            if title not in sample_titles:
                sample_titles.append(title)

            excerpt = _extract_co_occurrence_excerpt(
                content=note.content or "",
                name_a=row.thinker_a_name,
                name_b=row.thinker_b_name,
                max_length=200,
            )
            if excerpt and excerpt not in sample_excerpts:
                sample_excerpts.append(excerpt)

        count = int(row.co_occurrence_count or 0)
        if count > 10:
            confidence = "high"
        elif count >= 5:
            confidence = "medium"
        else:
            confidence = "low"

        suggestions.append(
            ConnectionSuggestionFromNotes(
                thinker_a_id=row.thinker_a_id,
                thinker_a_name=row.thinker_a_name,
                thinker_a_birth_year=row.thinker_a_birth_year,
                thinker_a_death_year=row.thinker_a_death_year,
                thinker_b_id=row.thinker_b_id,
                thinker_b_name=row.thinker_b_name,
                thinker_b_birth_year=row.thinker_b_birth_year,
                thinker_b_death_year=row.thinker_b_death_year,
                co_occurrence_count=count,
                same_paragraph_count=int(row.same_paragraph_count or 0),
                sample_note_titles=sample_titles[:3],
                sample_excerpts=sample_excerpts[:3],
                confidence=confidence,
            )
        )

    return suggestions


def _extract_co_occurrence_excerpt(content: str, name_a: str, name_b: str, max_length: int = 200) -> Optional[str]:
    if not content:
        return None

    content_lower = content.lower()
    name_a_lower = name_a.lower()
    name_b_lower = name_b.lower()

    positions_a: List[int] = []
    start = 0
    while True:
        index = content_lower.find(name_a_lower, start)
        if index == -1:
            break
        positions_a.append(index)
        start = index + 1

    positions_b: List[int] = []
    start = 0
    while True:
        index = content_lower.find(name_b_lower, start)
        if index == -1:
            break
        positions_b.append(index)
        start = index + 1

    if not positions_a or not positions_b:
        return None

    best_start = 0
    best_end = len(content)
    best_span = best_end - best_start

    for pos_a in positions_a:
        for pos_b in positions_b:
            span_start = min(pos_a, pos_b)
            span_end = max(pos_a + len(name_a), pos_b + len(name_b))
            span_size = span_end - span_start
            if span_size < best_span:
                best_span = span_size
                best_start = span_start
                best_end = span_end

    padding = max(0, (max_length - best_span) // 2)
    excerpt_start = max(0, best_start - padding)
    excerpt_end = min(len(content), best_end + padding)

    if excerpt_end - excerpt_start > max_length:
        excerpt_end = excerpt_start + max_length

    excerpt = content[excerpt_start:excerpt_end].strip()
    if excerpt_start > 0:
        excerpt = "..." + excerpt
    if excerpt_end < len(content):
        excerpt = excerpt + "..."

    return " ".join(excerpt.split())


@router.post("/argument-map", response_model=ArgumentMapResponse)
def create_argument_map(payload: ArgumentMapRequest, db: Session = Depends(get_db)):
    if not notes_ai_phase_enabled("C"):
        raise HTTPException(status_code=503, detail="Notes AI phase C is disabled")

    response = build_argument_map_from_notes(
        db=db,
        note_ids=payload.note_ids,
        title=payload.title or "Argument map",
    )
    db.commit()
    return response


@router.post("/premise-gap-check", response_model=PremiseGapCheckResponse)
def premise_gap_check(payload: PremiseGapCheckRequest, db: Session = Depends(get_db)):
    if not notes_ai_phase_enabled("C"):
        raise HTTPException(status_code=503, detail="Notes AI phase C is disabled")

    arg_map = build_argument_map_from_notes(db=db, note_ids=payload.note_ids, title="Premise gap check")
    db.commit()
    return PremiseGapCheckResponse(gaps=arg_map.premise_gaps)


@router.get("/semantic-search", response_model=List[SemanticSearchResult])
def semantic_search(
    q: str = Query(..., min_length=2),
    folder_id: Optional[UUID] = Query(None),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    if not notes_ai_phase_enabled("D"):
        raise HTTPException(status_code=503, detail="Notes AI phase D is disabled")
    results = semantic_search_notes(db=db, query=q, folder_id=folder_id, limit=limit)
    db.commit()
    return results


@router.get("/related-excerpts", response_model=List[RelatedExcerpt])
def related_excerpts(
    occurrence_id: UUID = Query(...),
    limit: int = Query(8, ge=1, le=30),
    db: Session = Depends(get_db),
):
    if not notes_ai_phase_enabled("D"):
        raise HTTPException(status_code=503, detail="Notes AI phase D is disabled")
    return related_excerpts_for_occurrence(db=db, occurrence_id=occurrence_id, limit=limit)


@router.get("/connection-explanations", response_model=List[ConnectionExplanation])
def connection_explanations(
    folder_id: Optional[UUID] = Query(None),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    if not notes_ai_phase_enabled("D"):
        raise HTTPException(status_code=503, detail="Notes AI phase D is disabled")
    return build_connection_explanations(db=db, folder_id=folder_id, limit=limit)


@router.post("/research-sprint-plan", response_model=ResearchSprintPlanResponse)
def research_sprint_plan(
    focus: str = Query("all notes"),
    db: Session = Depends(get_db),
):
    if not notes_ai_phase_enabled("E"):
        raise HTTPException(status_code=503, detail="Notes AI phase E is disabled")
    response = build_research_sprint_plan(db=db, focus=focus)
    db.commit()
    return response


@router.post("/advisor-brief", response_model=AdvisorBriefResponse)
def advisor_brief(
    date_window: str = Query("last 7 days"),
    db: Session = Depends(get_db),
):
    if not notes_ai_phase_enabled("E"):
        raise HTTPException(status_code=503, detail="Notes AI phase E is disabled")
    response = build_advisor_brief(db=db, date_window=date_window)
    db.commit()
    return response


@router.post("/viva-practice", response_model=VivaPracticeResponse)
def viva_practice(
    topic: str = Query("general"),
    db: Session = Depends(get_db),
):
    if not notes_ai_phase_enabled("E"):
        raise HTTPException(status_code=503, detail="Notes AI phase E is disabled")
    response = build_viva_practice(db=db, topic=topic)
    db.commit()
    return response


@router.post("/weekly-digest", response_model=WeeklyDigestResponse)
def weekly_digest(
    period_start: str = Query(..., description="YYYY-MM-DD"),
    period_end: str = Query(..., description="YYYY-MM-DD"),
    db: Session = Depends(get_db),
):
    if not notes_ai_phase_enabled("E"):
        raise HTTPException(status_code=503, detail="Notes AI phase E is disabled")
    response = build_weekly_digest(db=db, period_start=period_start, period_end=period_end)
    db.commit()
    return response


@router.get("/weekly-digest/latest", response_model=WeeklyDigestResponse)
def latest_weekly_digest(db: Session = Depends(get_db)):
    if not notes_ai_phase_enabled("E"):
        raise HTTPException(status_code=503, detail="Notes AI phase E is disabled")

    digest = db.query(WeeklyDigest).order_by(WeeklyDigest.created_at.desc()).first()
    if digest is None:
        raise HTTPException(status_code=404, detail="No weekly digest found")
    return WeeklyDigestResponse(
        id=digest.id,
        period_start=digest.period_start,
        period_end=digest.period_end,
        digest_markdown=digest.digest_markdown,
    )


@router.get("/ai-usage", response_model=AIUsageResponse)
def ai_usage():
    usage = get_ai_usage_status()
    return AIUsageResponse(
        day=usage["day"],
        used_tokens=int(usage["used_tokens"]),
        daily_quota_tokens=int(usage["daily_quota_tokens"]),
        cost_controls_enabled=bool(usage["cost_controls_enabled"]),
    )
