from collections import defaultdict
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.constants import notes_ai_phase_enabled
from app.database import get_db
from app.models.critical_term import CriticalTerm, TermOccurrence
from app.models.folder import Folder
from app.models.note import Note
from app.models.notes_ai import SynthesisRun, SynthesisRunCitation, TermAlias
from app.models.thinker import Thinker
from app.models.thinker_mention import ThinkerMention
from app.services.notes_ai.argumentation import generate_thesis_candidates, persist_thesis_candidates
from app.services.notes_ai.evidence import build_term_evidence_map
from app.services.notes_ai.quality import build_quality_report_payload, persist_quality_report
from app.services.notes_ai.synthesis import generate_synthesis_text, persist_synthesis_run
from app.schemas import critical_term as schemas
from app.utils.ai_service import AIServiceError, is_ai_enabled, synthesize_term_definition
from app.utils.term_scanner import scan_all_notes_for_term

router = APIRouter(prefix="/api/critical-terms", tags=["critical-terms"])


@router.post("/", response_model=schemas.CriticalTermWithCount, status_code=201)
def create_critical_term(term_data: schemas.CriticalTermCreate, db: Session = Depends(get_db)):
    existing = db.query(CriticalTerm).filter(CriticalTerm.name == term_data.name).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"A critical term named '{term_data.name}' already exists",
        )

    db_term = CriticalTerm(**term_data.model_dump())
    db.add(db_term)
    db.flush()

    occurrence_count = scan_all_notes_for_term(db, db_term)

    db.commit()
    db.refresh(db_term)

    return schemas.CriticalTermWithCount(
        id=db_term.id,
        name=db_term.name,
        description=db_term.description,
        is_active=db_term.is_active,
        created_at=db_term.created_at,
        updated_at=db_term.updated_at,
        occurrence_count=occurrence_count,
    )


@router.get("/", response_model=List[schemas.CriticalTermWithCount])
def list_critical_terms(is_active: Optional[bool] = None, db: Session = Depends(get_db)):
    occurrence_count_subq = (
        db.query(TermOccurrence.term_id, func.count(TermOccurrence.id).label("occurrence_count"))
        .group_by(TermOccurrence.term_id)
        .subquery()
    )

    query = (
        db.query(
            CriticalTerm,
            func.coalesce(occurrence_count_subq.c.occurrence_count, 0).label("occurrence_count"),
        )
        .outerjoin(occurrence_count_subq, CriticalTerm.id == occurrence_count_subq.c.term_id)
        .order_by(CriticalTerm.name)
    )

    if is_active is not None:
        query = query.filter(CriticalTerm.is_active == is_active)

    rows = query.all()
    return [
        schemas.CriticalTermWithCount(
            id=term.id,
            name=term.name,
            description=term.description,
            is_active=term.is_active,
            created_at=term.created_at,
            updated_at=term.updated_at,
            occurrence_count=count,
        )
        for term, count in rows
    ]


@router.get("/{term_id}", response_model=schemas.CriticalTermWithCount)
def get_critical_term(term_id: UUID, db: Session = Depends(get_db)):
    db_term = db.query(CriticalTerm).filter(CriticalTerm.id == term_id).first()
    if db_term is None:
        raise HTTPException(status_code=404, detail="Critical term not found")

    occurrence_count = db.query(func.count(TermOccurrence.id)).filter(TermOccurrence.term_id == term_id).scalar() or 0

    return schemas.CriticalTermWithCount(
        id=db_term.id,
        name=db_term.name,
        description=db_term.description,
        is_active=db_term.is_active,
        created_at=db_term.created_at,
        updated_at=db_term.updated_at,
        occurrence_count=occurrence_count,
    )


@router.put("/{term_id}", response_model=schemas.CriticalTermWithCount)
def update_critical_term(term_id: UUID, term_update: schemas.CriticalTermUpdate, db: Session = Depends(get_db)):
    db_term = db.query(CriticalTerm).filter(CriticalTerm.id == term_id).first()
    if db_term is None:
        raise HTTPException(status_code=404, detail="Critical term not found")

    update_data = term_update.model_dump(exclude_unset=True)
    name_changed = False

    if "name" in update_data and update_data["name"] != db_term.name:
        existing = (
            db.query(CriticalTerm)
            .filter(CriticalTerm.name == update_data["name"], CriticalTerm.id != term_id)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"A critical term named '{update_data['name']}' already exists",
            )
        name_changed = True

    for field, value in update_data.items():
        setattr(db_term, field, value)

    db.flush()

    if name_changed:
        scan_all_notes_for_term(db, db_term)

    db.commit()
    db.refresh(db_term)

    occurrence_count = db.query(func.count(TermOccurrence.id)).filter(TermOccurrence.term_id == term_id).scalar() or 0

    return schemas.CriticalTermWithCount(
        id=db_term.id,
        name=db_term.name,
        description=db_term.description,
        is_active=db_term.is_active,
        created_at=db_term.created_at,
        updated_at=db_term.updated_at,
        occurrence_count=occurrence_count,
    )


@router.delete("/{term_id}", status_code=204)
def delete_critical_term(term_id: UUID, db: Session = Depends(get_db)):
    db_term = db.query(CriticalTerm).filter(CriticalTerm.id == term_id).first()
    if db_term is None:
        raise HTTPException(status_code=404, detail="Critical term not found")

    db.delete(db_term)
    db.commit()
    return None


@router.post("/{term_id}/scan-all", response_model=schemas.ScanResultResponse)
def scan_all_notes_for_critical_term(term_id: UUID, db: Session = Depends(get_db)):
    db_term = db.query(CriticalTerm).filter(CriticalTerm.id == term_id).first()
    if db_term is None:
        raise HTTPException(status_code=404, detail="Critical term not found")

    occurrence_count = scan_all_notes_for_term(db, db_term)
    db.commit()

    return schemas.ScanResultResponse(
        term_id=db_term.id,
        term_name=db_term.name,
        occurrence_count=occurrence_count,
        message=f"Found {occurrence_count} occurrences of '{db_term.name}' across all notes.",
    )


@router.get("/{term_id}/occurrences", response_model=List[schemas.TermOccurrenceResponse])
def get_term_occurrences(
    term_id: UUID,
    folder_id: Optional[UUID] = Query(None, description="Filter by folder"),
    thinker_id: Optional[UUID] = Query(None, description="Filter by thinker mention"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    db_term = db.query(CriticalTerm).filter(CriticalTerm.id == term_id).first()
    if db_term is None:
        raise HTTPException(status_code=404, detail="Critical term not found")

    query = (
        db.query(TermOccurrence)
        .join(Note, TermOccurrence.note_id == Note.id)
        .options(joinedload(TermOccurrence.note))
        .filter(TermOccurrence.term_id == term_id)
        .order_by(Note.updated_at.desc())
    )

    if folder_id is not None:
        query = query.filter(Note.folder_id == folder_id)

    if thinker_id is not None:
        query = query.filter(
            Note.id.in_(db.query(ThinkerMention.note_id).filter(ThinkerMention.thinker_id == thinker_id))
        )

    occurrences = query.offset(offset).limit(limit).all()

    results: List[schemas.TermOccurrenceResponse] = []
    for occurrence in occurrences:
        note = occurrence.note
        thinker_names: List[str] = []
        if hasattr(note, "thinker_mention_records") and note.thinker_mention_records:
            seen_thinker_ids = set()
            for mention in note.thinker_mention_records:
                if mention.thinker_id in seen_thinker_ids:
                    continue
                seen_thinker_ids.add(mention.thinker_id)
                if mention.thinker is not None:
                    thinker_names.append(mention.thinker.name)

        results.append(
            schemas.TermOccurrenceResponse(
                id=occurrence.id,
                term_id=occurrence.term_id,
                note_id=occurrence.note_id,
                context_snippet=occurrence.context_snippet,
                paragraph_index=occurrence.paragraph_index,
                char_offset=occurrence.char_offset,
                created_at=occurrence.created_at,
                note_title=note.title or "Untitled Note",
                folder_name=note.folder.name if note.folder is not None else None,
                thinker_names=thinker_names,
                note_folder_name=note.folder.name if note.folder is not None else None,
                note_folder_id=note.folder_id,
                associated_thinkers=[
                    {"id": str(mention.thinker_id), "name": mention.thinker.name}
                    for mention in (note.thinker_mention_records or [])
                    if mention.thinker is not None
                ]
                if hasattr(note, "thinker_mention_records")
                else [],
            )
        )

    return results


@router.get("/{term_id}/definition", response_model=schemas.TermDefinitionResponse)
async def get_term_definition(
    term_id: UUID,
    folder_id: Optional[UUID] = Query(None, description="Filter occurrences to a specific folder"),
    thinker_id: Optional[UUID] = Query(None, description="Filter occurrences to a specific thinker"),
    synthesize: bool = Query(False, description="If true, synthesize a definition using AI"),
    db: Session = Depends(get_db),
):
    term = db.query(CriticalTerm).filter(CriticalTerm.id == term_id).first()
    if term is None:
        raise HTTPException(status_code=404, detail="Critical term not found")

    query = (
        db.query(TermOccurrence)
        .join(Note, TermOccurrence.note_id == Note.id)
        .options(joinedload(TermOccurrence.note))
        .filter(TermOccurrence.term_id == term_id)
    )

    if folder_id:
        query = query.filter(Note.folder_id == folder_id)

    if thinker_id:
        query = query.join(ThinkerMention, ThinkerMention.note_id == TermOccurrence.note_id).filter(
            ThinkerMention.thinker_id == thinker_id
        )

    occurrences = query.order_by(TermOccurrence.created_at.desc()).all()
    note_ids = list({occ.note_id for occ in occurrences})

    notes_with_folders = (
        db.query(Note.id, Note.title, Note.folder_id, Folder.name.label("folder_name"))
        .outerjoin(Folder, Note.folder_id == Folder.id)
        .filter(Note.id.in_(note_ids))
        .all()
        if note_ids
        else []
    )
    note_info_map = {
        row.id: {"title": row.title, "folder_id": row.folder_id, "folder_name": row.folder_name}
        for row in notes_with_folders
    }

    mentions = (
        db.query(
            ThinkerMention.note_id,
            Thinker.id.label("thinker_id"),
            Thinker.name.label("thinker_name"),
        )
        .join(Thinker, ThinkerMention.thinker_id == Thinker.id)
        .filter(ThinkerMention.note_id.in_(note_ids))
        .all()
        if note_ids
        else []
    )

    note_thinkers_map: defaultdict = defaultdict(list)
    seen_note_thinker = set()
    for mention in mentions:
        key = (mention.note_id, mention.thinker_id)
        if key in seen_note_thinker:
            continue
        seen_note_thinker.add(key)
        note_thinkers_map[mention.note_id].append({"id": str(mention.thinker_id), "name": mention.thinker_name})

    enriched_occurrences: List[schemas.TermOccurrenceResponse] = []
    for occurrence in occurrences:
        info = note_info_map.get(occurrence.note_id, {})
        enriched_occurrences.append(
            schemas.TermOccurrenceResponse(
                id=occurrence.id,
                term_id=occurrence.term_id,
                note_id=occurrence.note_id,
                context_snippet=occurrence.context_snippet,
                paragraph_index=occurrence.paragraph_index,
                char_offset=occurrence.char_offset,
                created_at=occurrence.created_at,
                note_title=info.get("title") or "Untitled note",
                note_folder_name=info.get("folder_name"),
                note_folder_id=info.get("folder_id"),
                associated_thinkers=note_thinkers_map.get(occurrence.note_id, []),
                thinker_names=[item["name"] for item in note_thinkers_map.get(occurrence.note_id, [])],
            )
        )

    thinker_groups: defaultdict = defaultdict(list)
    ungrouped_thinker: list = []
    for excerpt in enriched_occurrences:
        if excerpt.associated_thinkers:
            for thinker in excerpt.associated_thinkers:
                thinker_groups[(thinker["id"], thinker["name"])].append(excerpt)
        else:
            ungrouped_thinker.append(excerpt)

    excerpts_by_thinker: List[schemas.ExcerptGroup] = []
    for (thinker_id_str, thinker_name), group_excerpts in thinker_groups.items():
        excerpts_by_thinker.append(
            schemas.ExcerptGroup(
                group_name=thinker_name,
                group_id=UUID(thinker_id_str),
                excerpts=group_excerpts,
                excerpt_count=len(group_excerpts),
            )
        )
    excerpts_by_thinker.sort(key=lambda group: group.excerpt_count, reverse=True)

    if ungrouped_thinker:
        excerpts_by_thinker.append(
            schemas.ExcerptGroup(
                group_name="Unattributed",
                group_id=None,
                excerpts=ungrouped_thinker,
                excerpt_count=len(ungrouped_thinker),
            )
        )

    folder_groups: defaultdict = defaultdict(list)
    unfiled: list = []
    for excerpt in enriched_occurrences:
        if excerpt.note_folder_id and excerpt.note_folder_name:
            folder_groups[(str(excerpt.note_folder_id), excerpt.note_folder_name)].append(excerpt)
        else:
            unfiled.append(excerpt)

    excerpts_by_folder: List[schemas.ExcerptGroup] = []
    for (folder_id_str, folder_name), group_excerpts in folder_groups.items():
        excerpts_by_folder.append(
            schemas.ExcerptGroup(
                group_name=folder_name,
                group_id=UUID(folder_id_str),
                excerpts=group_excerpts,
                excerpt_count=len(group_excerpts),
            )
        )
    excerpts_by_folder.sort(key=lambda group: group.excerpt_count, reverse=True)

    if unfiled:
        excerpts_by_folder.append(
            schemas.ExcerptGroup(
                group_name="Unfiled",
                group_id=None,
                excerpts=unfiled,
                excerpt_count=len(unfiled),
            )
        )

    filter_parts = []
    if folder_id:
        folder = db.query(Folder).filter(Folder.id == folder_id).first()
        if folder:
            filter_parts.append(f"{folder.name} folder")
    if thinker_id:
        thinker = db.query(Thinker).filter(Thinker.id == thinker_id).first()
        if thinker:
            filter_parts.append(f"notes mentioning {thinker.name}")
    filter_context = " in ".join(filter_parts) if filter_parts else "all notes"

    all_folder_ids = (
        db.query(Folder.id, Folder.name)
        .join(Note, Note.folder_id == Folder.id)
        .join(TermOccurrence, TermOccurrence.note_id == Note.id)
        .filter(TermOccurrence.term_id == term_id)
        .distinct()
        .all()
    )
    available_folders = [{"id": str(row.id), "name": row.name} for row in all_folder_ids]

    all_thinker_ids = (
        db.query(Thinker.id, Thinker.name)
        .join(ThinkerMention, ThinkerMention.thinker_id == Thinker.id)
        .join(TermOccurrence, TermOccurrence.note_id == ThinkerMention.note_id)
        .filter(TermOccurrence.term_id == term_id)
        .distinct()
        .all()
    )
    available_thinkers = [{"id": str(row.id), "name": row.name} for row in all_thinker_ids]

    synthesis_source_excerpts = enriched_occurrences[:30]
    synthesis_citations = [
        schemas.SynthesisCitation(
            citation_key=f"E{index}",
            note_id=excerpt.note_id,
            note_title=excerpt.note_title or "Untitled note",
            folder_name=excerpt.note_folder_name or "Unfiled",
            context_snippet=excerpt.context_snippet,
        )
        for index, excerpt in enumerate(synthesis_source_excerpts, start=1)
    ]

    synthesis_text: Optional[str] = None
    if synthesize:
        if not is_ai_enabled():
            synthesis_text = "[Synthesis unavailable: AI is not enabled in this environment.]"
        else:
            excerpt_dicts = [
                {
                    "citation_key": f"E{index}",
                    "context_snippet": excerpt.context_snippet,
                    "note_title": excerpt.note_title or "Untitled note",
                    "folder_name": excerpt.note_folder_name or "Unfiled",
                    "associated_thinkers": [t["name"] for t in (excerpt.associated_thinkers or [])],
                }
                for index, excerpt in enumerate(synthesis_source_excerpts, start=1)
            ]
            try:
                synthesis_text = await synthesize_term_definition(
                    term_name=term.name,
                    excerpts=excerpt_dicts,
                    filter_context=filter_context,
                )
            except AIServiceError as error:
                synthesis_text = f"[Synthesis unavailable: {error.message}]"

    return schemas.TermDefinitionResponse(
        term=schemas.CriticalTerm.model_validate(term),
        excerpts_by_thinker=excerpts_by_thinker,
        excerpts_by_folder=excerpts_by_folder,
        total_occurrences=len(enriched_occurrences),
        synthesis=synthesis_text,
        synthesis_citations=synthesis_citations,
        filter_context=filter_context,
        available_folders=available_folders,
        available_thinkers=available_thinkers,
    )


@router.get("/{term_id}/evidence-map", response_model=schemas.TermEvidenceMapResponse)
def get_term_evidence_map(
    term_id: UUID,
    folder_id: Optional[UUID] = Query(None),
    thinker_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
):
    if not notes_ai_phase_enabled("A"):
        raise HTTPException(status_code=503, detail="Notes AI phase A is disabled")

    try:
        return build_term_evidence_map(db=db, term_id=term_id, folder_id=folder_id, thinker_id=thinker_id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.get("/{term_id}/synthesis", response_model=schemas.SynthesisRunResponse)
async def synthesize_term(
    term_id: UUID,
    mode: schemas.SynthesisMode = Query("definition"),
    folder_id: Optional[UUID] = Query(None),
    thinker_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
):
    if not notes_ai_phase_enabled("A"):
        raise HTTPException(status_code=503, detail="Notes AI phase A is disabled")

    evidence_map = build_term_evidence_map(db=db, term_id=term_id, folder_id=folder_id, thinker_id=thinker_id)
    excerpts = evidence_map.excerpts[:30]
    filter_context = "all notes"
    if folder_id:
        folder = db.query(Folder).filter(Folder.id == folder_id).first()
        if folder:
            filter_context = f"{folder.name} folder"
    if thinker_id:
        thinker = db.query(Thinker).filter(Thinker.id == thinker_id).first()
        if thinker:
            filter_context = f"{filter_context} in notes mentioning {thinker.name}"

    citations = [
        schemas.SynthesisCitation(
            citation_key=f"E{index}",
            note_id=excerpt.note_id,
            note_title=excerpt.note_title or "Untitled note",
            folder_name=excerpt.note_folder_name,
            context_snippet=excerpt.context_snippet,
        )
        for index, excerpt in enumerate(excerpts, start=1)
    ]
    excerpt_dicts = [
        {
            "citation_key": f"E{index}",
            "context_snippet": excerpt.context_snippet,
            "note_title": excerpt.note_title or "Untitled note",
            "folder_name": excerpt.note_folder_name or "Unfiled",
            "associated_thinkers": [t["name"] for t in (excerpt.associated_thinkers or [])],
        }
        for index, excerpt in enumerate(excerpts, start=1)
    ]

    synthesis_text = await generate_synthesis_text(
        mode=mode,
        term_name=evidence_map.term.name,
        excerpts=excerpt_dicts,
        filter_context=filter_context,
    )
    coverage_rate = (len(citations) / max(len(excerpts), 1)) if excerpts else 0.0
    run = persist_synthesis_run(
        db=db,
        term_id=term_id,
        mode=mode,
        filter_context=filter_context,
        synthesis_text=synthesis_text,
        citations=citations,
        folder_id=folder_id,
        thinker_id=thinker_id,
        coverage_rate=coverage_rate,
    )
    db.commit()
    db.refresh(run)

    return schemas.SynthesisRunResponse(
        run=schemas.SynthesisRunSummary(
            id=run.id,
            term_id=run.term_id,
            mode=run.mode,
            filter_context=run.filter_context,
            synthesis_text=run.synthesis_text,
            coverage_rate=run.coverage_rate,
            created_at=run.created_at,
        ),
        citations=citations,
    )


@router.get("/{term_id}/synthesis-runs", response_model=List[schemas.SynthesisRunSummary])
def get_term_synthesis_runs(
    term_id: UUID,
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    if not notes_ai_phase_enabled("A"):
        raise HTTPException(status_code=503, detail="Notes AI phase A is disabled")

    runs = (
        db.query(SynthesisRun)
        .filter(SynthesisRun.term_id == term_id)
        .order_by(SynthesisRun.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        schemas.SynthesisRunSummary(
            id=run.id,
            term_id=run.term_id,
            mode=run.mode,
            filter_context=run.filter_context,
            synthesis_text=run.synthesis_text,
            coverage_rate=run.coverage_rate,
            created_at=run.created_at,
        )
        for run in runs
    ]


@router.get("/{term_id}/quality-report", response_model=schemas.TermQualityReportResponse)
def get_term_quality_report(
    term_id: UUID,
    run_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
):
    if not notes_ai_phase_enabled("B"):
        raise HTTPException(status_code=503, detail="Notes AI phase B is disabled")

    run_query = db.query(SynthesisRun).filter(SynthesisRun.term_id == term_id)
    if run_id is not None:
        run_query = run_query.filter(SynthesisRun.id == run_id)
    run = run_query.order_by(SynthesisRun.created_at.desc()).first()
    if run is None:
        raise HTTPException(status_code=404, detail="No synthesis run found for this term")

    citation_rows = (
        db.query(SynthesisRunCitation)
        .filter(SynthesisRunCitation.run_id == run.id)
        .order_by(SynthesisRunCitation.citation_key.asc())
        .all()
    )
    citations = [
        schemas.SynthesisCitation(
            citation_key=row.citation_key,
            note_id=row.note_id,
            note_title=row.note_title,
            folder_name=row.folder_name,
            context_snippet=row.context_snippet,
        )
        for row in citation_rows
    ]

    payload = build_quality_report_payload(synthesis_text=run.synthesis_text, citations=citations)
    persist_quality_report(db=db, run=run, payload=payload)
    db.commit()
    return payload


@router.post("/{term_id}/thesis-candidates", response_model=schemas.ThesisCandidateResponse)
def create_thesis_candidates(term_id: UUID, db: Session = Depends(get_db)):
    if not notes_ai_phase_enabled("C"):
        raise HTTPException(status_code=503, detail="Notes AI phase C is disabled")

    evidence_map = build_term_evidence_map(db=db, term_id=term_id)
    candidates = generate_thesis_candidates(
        term_id=term_id,
        term_name=evidence_map.term.name,
        excerpts=evidence_map.excerpts,
    )
    persist_thesis_candidates(db=db, term_id=term_id, candidates=candidates)
    db.commit()
    return schemas.ThesisCandidateResponse(term_id=term_id, candidates=candidates)


@router.post("/{term_id}/aliases/propose", response_model=schemas.TermAliasResponse, status_code=201)
def propose_term_alias(term_id: UUID, payload: schemas.TermAliasCreate, db: Session = Depends(get_db)):
    if not notes_ai_phase_enabled("D"):
        raise HTTPException(status_code=503, detail="Notes AI phase D is disabled")

    term = db.query(CriticalTerm).filter(CriticalTerm.id == term_id).first()
    if term is None:
        raise HTTPException(status_code=404, detail="Critical term not found")

    existing = (
        db.query(TermAlias)
        .filter(TermAlias.term_id == term_id, TermAlias.alias_name == payload.alias_name)
        .first()
    )
    if existing is not None:
        return schemas.TermAliasResponse.model_validate(existing)

    alias = TermAlias(term_id=term_id, alias_name=payload.alias_name, status="proposed")
    db.add(alias)
    db.commit()
    db.refresh(alias)
    return schemas.TermAliasResponse.model_validate(alias)


@router.post("/{term_id}/aliases/{alias_id}/approve", response_model=schemas.TermAliasResponse)
def approve_term_alias(term_id: UUID, alias_id: UUID, db: Session = Depends(get_db)):
    if not notes_ai_phase_enabled("D"):
        raise HTTPException(status_code=503, detail="Notes AI phase D is disabled")

    alias = (
        db.query(TermAlias)
        .filter(TermAlias.id == alias_id, TermAlias.term_id == term_id)
        .first()
    )
    if alias is None:
        raise HTTPException(status_code=404, detail="Alias not found")

    alias.status = "approved"
    db.commit()
    db.refresh(alias)
    return schemas.TermAliasResponse.model_validate(alias)
