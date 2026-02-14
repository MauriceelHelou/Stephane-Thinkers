import asyncio
import json
import os
import re
from datetime import date, datetime, timedelta
from typing import Any, List, Optional, Sequence, Set, Tuple

from sqlalchemy.orm import Session

from app.models.note import Note
from app.models.notes_ai import PlannerRun, WeeklyDigest
from app.models.research_question import ResearchQuestion
from app.schemas import analysis as schemas
from app.utils.ai_service import AIServiceError, _call_deepseek_api, is_ai_enabled

UUID_PATTERN = re.compile(
    r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
)


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _llm_planning_enabled() -> bool:
    default_enabled = os.getenv("ENVIRONMENT", "development") != "test"
    return _env_bool("NOTES_AI_USE_LLM_PLANNING", default_enabled) and is_ai_enabled()


def _normalize_text(value: Optional[str], max_chars: Optional[int] = 220) -> str:
    cleaned = " ".join((value or "").split())
    if not cleaned:
        return ""
    if max_chars is None or len(cleaned) <= max_chars:
        return cleaned
    if max_chars <= 3:
        return cleaned[:max_chars]
    return cleaned[: max_chars - 3].rstrip() + "..."


def _strip_markdown_fence(raw: str) -> str:
    stripped = (raw or "").strip()
    if stripped.startswith("```json"):
        stripped = stripped[7:]
    elif stripped.startswith("```"):
        stripped = stripped[3:]
    if stripped.endswith("```"):
        stripped = stripped[:-3]
    return stripped.strip()


def _extract_uuid(value: str) -> Optional[str]:
    match = UUID_PATTERN.search(value or "")
    if match:
        return match.group(0).lower()
    return None


def _coerce_evidence_refs(raw_refs: Any, valid_refs: Set[str], max_items: int = 5) -> List[str]:
    if not isinstance(raw_refs, list):
        return []

    refs: List[str] = []
    seen: Set[str] = set()
    for item in raw_refs:
        if not isinstance(item, str):
            continue
        candidate = _extract_uuid(item) or item.strip().lower()
        if not candidate or candidate not in valid_refs or candidate in seen:
            continue
        seen.add(candidate)
        refs.append(candidate)
        if len(refs) >= max_items:
            break
    return refs


def _coerce_string_list(
    raw_values: Any,
    max_items: int = 6,
    max_chars: Optional[int] = 1200,
) -> List[str]:
    if not isinstance(raw_values, list):
        return []
    items: List[str] = []
    for value in raw_values:
        if not isinstance(value, str):
            continue
        normalized = _normalize_text(value, max_chars=max_chars)
        if normalized:
            items.append(normalized)
        if len(items) >= max_items:
            break
    return items


def _run_llm_json(
    *,
    system_prompt: str,
    user_prompt: str,
    max_tokens: int = 1200,
    temperature: float = 0.3,
) -> Optional[dict]:
    if not _llm_planning_enabled():
        return None

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    try:
        asyncio.get_running_loop()
        return None
    except RuntimeError:
        pass

    try:
        raw = asyncio.run(
            _call_deepseek_api(messages=messages, temperature=temperature, max_tokens=max_tokens)
        )
    except AIServiceError:
        return None
    except Exception:
        return None

    if not raw:
        return None

    try:
        data = json.loads(_strip_markdown_fence(raw))
    except json.JSONDecodeError:
        return None

    if not isinstance(data, dict):
        return None
    return data


def _format_timestamp(value: Optional[datetime]) -> str:
    if value is None:
        return "unknown"
    try:
        return value.strftime("%Y-%m-%d")
    except Exception:
        return "unknown"


def _parse_window_start(date_window: str) -> datetime:
    now = datetime.utcnow()
    normalized = (date_window or "").strip().lower()
    if normalized in {"", "last 7 days", "7 days"}:
        return now - timedelta(days=7)
    if normalized in {"last week", "week"}:
        return now - timedelta(days=7)
    if normalized in {"last month", "month"}:
        return now - timedelta(days=30)

    match = re.search(r"last\s+(\d+)\s+day", normalized)
    if match:
        days = max(int(match.group(1)), 1)
        return now - timedelta(days=days)

    match = re.search(r"last\s+(\d+)\s+week", normalized)
    if match:
        weeks = max(int(match.group(1)), 1)
        return now - timedelta(days=7 * weeks)

    return now - timedelta(days=7)


def _parse_date_range(period_start: str, period_end: str) -> Tuple[Optional[datetime], Optional[datetime]]:
    try:
        start_date = date.fromisoformat(period_start)
        end_date = date.fromisoformat(period_end)
    except ValueError:
        return None, None

    if start_date > end_date:
        start_date, end_date = end_date, start_date

    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt_exclusive = datetime.combine(end_date + timedelta(days=1), datetime.min.time())
    return start_dt, end_dt_exclusive


def _load_notes(
    db: Session,
    *,
    limit: int = 12,
    start_at: Optional[datetime] = None,
    end_before: Optional[datetime] = None,
) -> List[Note]:
    query = db.query(Note).filter(Note.is_canvas_note == False)  # noqa: E712
    if start_at is not None:
        query = query.filter(Note.updated_at >= start_at)
    if end_before is not None:
        query = query.filter(Note.updated_at < end_before)
    return query.order_by(Note.updated_at.desc()).limit(limit).all()


def _load_questions(
    db: Session,
    *,
    limit: int = 8,
    start_at: Optional[datetime] = None,
    end_before: Optional[datetime] = None,
) -> List[ResearchQuestion]:
    query = db.query(ResearchQuestion)
    if start_at is not None:
        query = query.filter(ResearchQuestion.updated_at >= start_at)
    if end_before is not None:
        query = query.filter(ResearchQuestion.updated_at < end_before)
    return query.order_by(ResearchQuestion.updated_at.desc()).limit(limit).all()


def _serialize_note_context(notes: Sequence[Note]) -> str:
    if not notes:
        return "None."
    lines: List[str] = []
    for note in notes:
        note_id = str(note.id).lower()
        title = _normalize_text(note.title or "Untitled note", 90)
        snippet = _normalize_text(note.content or "", 200)
        tag_names = ", ".join(sorted({tag.name for tag in (note.tags or []) if tag.name})) or "none"
        lines.append(
            f"- {note_id} | {title} | type={note.note_type or 'general'} | "
            f"updated={_format_timestamp(note.updated_at)} | tags={tag_names} | excerpt={snippet or 'No content'}"
        )
    return "\n".join(lines)


def _serialize_question_context(questions: Sequence[ResearchQuestion]) -> str:
    if not questions:
        return "None."
    lines: List[str] = []
    for question in questions:
        question_id = str(question.id).lower()
        title = _normalize_text(question.title or "Untitled question", 100)
        details = _normalize_text(question.description or "", 180)
        lines.append(
            f"- {question_id} | {title} | status={question.status or 'open'} | "
            f"priority={question.priority or 3} | details={details or 'No description'}"
        )
    return "\n".join(lines)


def _planner_refs(notes: Sequence[Note], questions: Sequence[ResearchQuestion]) -> Set[str]:
    refs: Set[str] = {str(note.id).lower() for note in notes}
    refs.update(str(question.id).lower() for question in questions)
    return refs


def _note_refs(notes: Sequence[Note]) -> Set[str]:
    return {str(note.id).lower() for note in notes}


def _render_sprint_markdown(tasks: Sequence[schemas.PlanTask]) -> str:
    lines: List[str] = []
    for idx, task in enumerate(tasks, start=1):
        ref_text = f" (evidence: {', '.join(task.evidence_refs)})" if task.evidence_refs else ""
        lines.append(f"{idx}. {task.title}: {task.rationale}{ref_text}")
    return "\n".join(lines)


def _render_advisor_markdown(response: schemas.AdvisorBriefResponse) -> str:
    lines: List[str] = ["## Highlights"]
    lines.extend([f"- {entry}" for entry in response.highlights] or ["- No highlights available."])
    lines.append("")
    lines.append("## Decisions Needed")
    lines.extend([f"- {entry}" for entry in response.decisions_needed] or ["- No decisions identified."])
    lines.append("")
    lines.append("## Open Risks")
    lines.extend([f"- {entry}" for entry in response.open_risks] or ["- No risks identified."])
    return "\n".join(lines)


def _render_viva_markdown(questions: Sequence[schemas.VivaQuestion]) -> str:
    lines: List[str] = []
    for idx, question in enumerate(questions, start=1):
        ref_text = f" (evidence: {', '.join(question.evidence_refs)})" if question.evidence_refs else ""
        lines.append(f"{idx}. Q: {question.question}{ref_text}")
        lines.append(f"   Rubric: {question.expected_answer_rubric}")
    return "\n".join(lines)


def _fallback_research_sprint(
    *,
    focus: str,
    notes: Sequence[Note],
    questions: Sequence[ResearchQuestion],
) -> schemas.ResearchSprintPlanResponse:
    tasks: List[schemas.PlanTask] = []

    for question in questions[:4]:
        question_title = _normalize_text(question.title or "Untitled question", 90)
        tasks.append(
            schemas.PlanTask(
                title=f"Advance question: {question_title}",
                rationale="Define one concrete evidence-gathering or writing step for this research question.",
                evidence_refs=[],
            )
        )

    for note in notes[:3]:
        note_title = _normalize_text(note.title or "Untitled note", 90)
        tasks.append(
            schemas.PlanTask(
                title=f"Synthesize note: {note_title}",
                rationale="Extract a claim, one supporting excerpt, and one counterpoint for your draft.",
                evidence_refs=[str(note.id).lower()],
            )
        )

    if not tasks:
        tasks.append(
            schemas.PlanTask(
                title="Create your first sprint task",
                rationale="No source notes or research questions found yet. Add evidence notes first.",
                evidence_refs=[],
            )
        )

    return schemas.ResearchSprintPlanResponse(focus=focus, tasks=tasks)


def _generate_research_sprint_with_llm(
    *,
    focus: str,
    notes: Sequence[Note],
    questions: Sequence[ResearchQuestion],
) -> Optional[schemas.ResearchSprintPlanResponse]:
    valid_refs = _note_refs(notes=notes)
    payload = _run_llm_json(
        system_prompt=(
            "You are a PhD research planning assistant. Produce practical one-week sprint tasks grounded only "
            "in provided evidence IDs. Respond in strict JSON."
        ),
        user_prompt=(
            "Create a research sprint plan.\n\n"
            f"Focus: {focus}\n\n"
            "Recent research questions:\n"
            f"{_serialize_question_context(questions)}\n\n"
            "Recent notes:\n"
            f"{_serialize_note_context(notes)}\n\n"
            "Valid note evidence IDs (use only these IDs in evidence_refs):\n"
            f"{', '.join(sorted(valid_refs)) if valid_refs else 'none'}\n\n"
            "Return JSON only:\n"
            "{\n"
            '  "tasks": [\n'
            "    {\n"
            '      "title": "string",\n'
            '      "rationale": "string",\n'
            '      "evidence_refs": ["uuid"]\n'
            "    }\n"
            "  ]\n"
            "}\n\n"
            "Rules:\n"
            "- Output 4 to 7 tasks when evidence exists.\n"
            "- Keep tasks actionable and specific.\n"
            "- If evidence is sparse, output fewer tasks instead of inventing evidence."
        ),
        max_tokens=1200,
        temperature=0.2,
    )
    if payload is None:
        return None

    tasks_payload = payload.get("tasks")
    if not isinstance(tasks_payload, list):
        return None

    tasks: List[schemas.PlanTask] = []
    for item in tasks_payload[:8]:
        if not isinstance(item, dict):
            continue
        title = _normalize_text(item.get("title"), None)
        rationale = _normalize_text(item.get("rationale"), None)
        if not title:
            continue
        refs = _coerce_evidence_refs(item.get("evidence_refs"), valid_refs)
        tasks.append(
            schemas.PlanTask(
                title=title,
                rationale=rationale or "Ground this task in one cited note before execution.",
                evidence_refs=refs,
            )
        )

    if not tasks:
        return None
    return schemas.ResearchSprintPlanResponse(focus=focus, tasks=tasks)


def _fallback_advisor_brief(
    *,
    date_window: str,
    notes: Sequence[Note],
    questions: Sequence[ResearchQuestion],
) -> schemas.AdvisorBriefResponse:
    highlights = [
        f"{_normalize_text(note.title or 'Untitled note', 90)}: {_normalize_text(note.content or '', 130)} "
        f"(evidence: {str(note.id).lower()})"
        for note in notes[:5]
    ]

    decisions: List[str] = []
    if questions:
        decisions.append(
            f"Prioritize next-step methodology for: {_normalize_text(questions[0].title, 95)}."
        )
    if len(questions) > 1:
        decisions.append(
            f"Decide whether to merge or split overlapping questions around: "
            f"{_normalize_text(questions[1].title, 95)}."
        )
    if notes:
        decisions.append(
            f"Choose which note cluster should become the next draft section "
            f"(evidence: {str(notes[0].id).lower()})"
        )
    if not decisions:
        decisions.append("Define the next advisor-facing milestone for this week.")

    risks: List[str] = []
    if len(notes) < 3:
        risks.append("Low evidence volume in the selected window may weaken advisor-ready claims.")
    thin_notes = [note for note in notes[:6] if len((note.content or "").strip()) < 120]
    if thin_notes:
        risks.append("Several recent notes are short; argument chains may be under-supported.")
    if questions and all((question.status or "").lower() == "open" for question in questions[:4]):
        risks.append("Most top research questions remain open, risking scope drift before the next meeting.")
    if not risks:
        risks.append("Cross-note terminology may be inconsistent; verify term alignment before advisor review.")

    return schemas.AdvisorBriefResponse(
        date_window=date_window,
        highlights=highlights,
        decisions_needed=decisions,
        open_risks=risks,
    )


def _generate_advisor_brief_with_llm(
    *,
    date_window: str,
    notes: Sequence[Note],
    questions: Sequence[ResearchQuestion],
) -> Optional[schemas.AdvisorBriefResponse]:
    valid_refs = _note_refs(notes=notes)
    payload = _run_llm_json(
        system_prompt=(
            "You are an advisor briefing assistant for doctoral research. Ground every point in provided evidence. "
            "Respond in strict JSON."
        ),
        user_prompt=(
            f"Create an advisor brief for the window: {date_window}.\n\n"
            "Notes in scope:\n"
            f"{_serialize_note_context(notes)}\n\n"
            "Research questions in scope:\n"
            f"{_serialize_question_context(questions)}\n\n"
            "Valid note evidence IDs (use only these IDs in text when cited):\n"
            f"{', '.join(sorted(valid_refs)) if valid_refs else 'none'}\n\n"
            "Return JSON only:\n"
            "{\n"
            '  "highlights": ["string"],\n'
            '  "decisions_needed": ["string"],\n'
            '  "open_risks": ["string"]\n'
            "}\n\n"
            "Rules:\n"
            "- Use 3 to 6 bullets per section when possible.\n"
            "- Keep each bullet concise and decision-oriented.\n"
            "- Include evidence IDs inline when available, e.g. '(evidence: <uuid>)'.\n"
            "- Do not invent evidence IDs."
        ),
        max_tokens=1300,
        temperature=0.2,
    )
    if payload is None:
        return None

    highlights = _coerce_string_list(payload.get("highlights"), max_items=8, max_chars=None)
    decisions = _coerce_string_list(payload.get("decisions_needed"), max_items=8, max_chars=None)
    risks = _coerce_string_list(payload.get("open_risks"), max_items=8, max_chars=None)
    if not highlights and not decisions and not risks:
        return None

    return schemas.AdvisorBriefResponse(
        date_window=date_window,
        highlights=highlights,
        decisions_needed=decisions,
        open_risks=risks,
    )


def _fallback_viva_practice(
    *,
    topic: str,
    notes: Sequence[Note],
    questions: Sequence[ResearchQuestion],
) -> schemas.VivaPracticeResponse:
    qa_pairs: List[schemas.VivaQuestion] = []
    for note in notes[:4]:
        note_title = _normalize_text(note.title or "this note", 90)
        qa_pairs.append(
            schemas.VivaQuestion(
                question=f"How does {note_title} strengthen your argument in {topic}?",
                expected_answer_rubric=(
                    "State your claim, cite at least one excerpt from the note, and explain one limitation or "
                    "counter-reading."
                ),
                evidence_refs=[str(note.id).lower()],
            )
        )

    if questions:
        qa_pairs.append(
            schemas.VivaQuestion(
                question=f"What is your current answer to: {_normalize_text(questions[0].title, 100)}?",
                expected_answer_rubric=(
                    "Give the working answer, identify the strongest evidence, and describe what evidence is still "
                    "missing."
                ),
                evidence_refs=[],
            )
        )

    if not qa_pairs:
        qa_pairs.append(
            schemas.VivaQuestion(
                question="What is your central argumentative contribution?",
                expected_answer_rubric="Define scope, contribution, and one evidentiary boundary.",
                evidence_refs=[],
            )
        )

    return schemas.VivaPracticeResponse(topic=topic, questions=qa_pairs)


def _generate_viva_practice_with_llm(
    *,
    topic: str,
    notes: Sequence[Note],
    questions: Sequence[ResearchQuestion],
) -> Optional[schemas.VivaPracticeResponse]:
    valid_refs = _note_refs(notes=notes)
    payload = _run_llm_json(
        system_prompt=(
            "You are a viva examination coach for a humanities PhD. Generate rigorous practice questions grounded "
            "only in provided evidence IDs. Respond in strict JSON."
        ),
        user_prompt=(
            f"Generate viva practice for topic: {topic}.\n\n"
            "Recent notes:\n"
            f"{_serialize_note_context(notes)}\n\n"
            "Recent research questions:\n"
            f"{_serialize_question_context(questions)}\n\n"
            "Valid note evidence IDs:\n"
            f"{', '.join(sorted(valid_refs)) if valid_refs else 'none'}\n\n"
            "Return JSON only:\n"
            "{\n"
            '  "questions": [\n'
            "    {\n"
            '      "question": "string",\n'
            '      "expected_answer_rubric": "string",\n'
            '      "evidence_refs": ["uuid"]\n'
            "    }\n"
            "  ]\n"
            "}\n\n"
            "Rules:\n"
            "- Output 4 to 7 questions when evidence exists.\n"
            "- Questions should probe argument quality, evidence use, and methodological clarity.\n"
            "- Do not invent evidence IDs."
        ),
        max_tokens=1400,
        temperature=0.25,
    )
    if payload is None:
        return None

    questions_payload = payload.get("questions")
    if not isinstance(questions_payload, list):
        return None

    viva_questions: List[schemas.VivaQuestion] = []
    for item in questions_payload[:8]:
        if not isinstance(item, dict):
            continue
        question = _normalize_text(item.get("question"), None)
        rubric = _normalize_text(item.get("expected_answer_rubric"), None)
        if not question:
            continue
        refs = _coerce_evidence_refs(item.get("evidence_refs"), valid_refs)
        viva_questions.append(
            schemas.VivaQuestion(
                question=question,
                expected_answer_rubric=(
                    rubric or "State a clear claim, support it with evidence, and identify at least one limitation."
                ),
                evidence_refs=refs,
            )
        )

    if not viva_questions:
        return None
    return schemas.VivaPracticeResponse(topic=topic, questions=viva_questions)


def _fallback_weekly_digest(
    *,
    period_start: str,
    period_end: str,
    notes: Sequence[Note],
    questions: Sequence[ResearchQuestion],
) -> str:
    lines: List[str] = [f"## Weekly Digest ({period_start} to {period_end})", ""]

    if not notes and not questions:
        lines.append("- No note or research-question updates captured for this period.")
        return "\n".join(lines)

    lines.append("### Wins")
    if notes:
        for note in notes[:3]:
            lines.append(
                f"- Advanced note: {_normalize_text(note.title or 'Untitled note', 90)} "
                f"(evidence: {str(note.id).lower()})"
            )
    else:
        lines.append("- No new notes captured.")

    lines.append("")
    lines.append("### Decisions Needed")
    if questions:
        for question in questions[:2]:
            lines.append(
                f"- Confirm next evidence step for: {_normalize_text(question.title, 95)}."
            )
    else:
        lines.append("- Prioritize one draft section for the coming week.")

    lines.append("")
    lines.append("### Open Risks")
    if len(notes) < 2:
        lines.append("- Limited evidence intake this week may slow chapter-level progress.")
    if questions and all((question.status or "").lower() == "open" for question in questions[:3]):
        lines.append("- Core research questions remain unresolved; refine scope before expanding sources.")
    if lines[-1].startswith("### Open Risks"):
        lines.append("- Cross-note argument consistency should be checked before advisor review.")

    return "\n".join(lines)


def _generate_weekly_digest_with_llm(
    *,
    period_start: str,
    period_end: str,
    notes: Sequence[Note],
    questions: Sequence[ResearchQuestion],
) -> Optional[str]:
    valid_refs = _note_refs(notes=notes)
    payload = _run_llm_json(
        system_prompt=(
            "You are a weekly research-progress summarizer for a PhD workflow. Produce concise, evidence-grounded "
            "markdown using only supplied evidence IDs. Respond in strict JSON."
        ),
        user_prompt=(
            f"Generate a weekly digest for {period_start} to {period_end}.\n\n"
            "Updated notes:\n"
            f"{_serialize_note_context(notes)}\n\n"
            "Updated research questions:\n"
            f"{_serialize_question_context(questions)}\n\n"
            "Valid note evidence IDs:\n"
            f"{', '.join(sorted(valid_refs)) if valid_refs else 'none'}\n\n"
            "Return JSON only:\n"
            "{\n"
            '  "digest_markdown": "markdown string"\n'
            "}\n\n"
            "Rules for digest_markdown:\n"
            "- Include heading: '## Weekly Digest (<period_start> to <period_end>)'.\n"
            "- Include sections: '### Wins', '### Decisions Needed', '### Open Risks'.\n"
            "- Include evidence IDs inline when evidence exists, e.g. '(evidence: <uuid>)'.\n"
            "- Do not invent evidence IDs."
        ),
        max_tokens=1500,
        temperature=0.2,
    )
    if payload is None:
        return None

    digest_markdown = payload.get("digest_markdown")
    if not isinstance(digest_markdown, str):
        return None
    digest_markdown = digest_markdown.strip()
    if not digest_markdown:
        return None
    if len(digest_markdown) > 5000:
        return digest_markdown[:5000].rstrip()
    return digest_markdown


def build_research_sprint_plan(db: Session, focus: str = "all notes") -> schemas.ResearchSprintPlanResponse:
    questions = _load_questions(db, limit=8)
    notes = _load_notes(db, limit=12)

    output = _generate_research_sprint_with_llm(focus=focus, notes=notes, questions=questions)
    if output is None:
        output = _fallback_research_sprint(focus=focus, notes=notes, questions=questions)

    db.add(
        PlannerRun(
            run_type="sprint",
            input_context=focus,
            output_markdown=_render_sprint_markdown(output.tasks),
        )
    )
    return output


def build_advisor_brief(db: Session, date_window: str = "last 7 days") -> schemas.AdvisorBriefResponse:
    start_at = _parse_window_start(date_window)
    notes = _load_notes(db, limit=12, start_at=start_at)
    questions = _load_questions(db, limit=8, start_at=start_at)

    output = _generate_advisor_brief_with_llm(date_window=date_window, notes=notes, questions=questions)
    if output is None:
        output = _fallback_advisor_brief(date_window=date_window, notes=notes, questions=questions)

    db.add(
        PlannerRun(
            run_type="brief",
            input_context=date_window,
            output_markdown=_render_advisor_markdown(output),
        )
    )
    return output


def build_viva_practice(db: Session, topic: str = "general") -> schemas.VivaPracticeResponse:
    notes = _load_notes(db, limit=10)
    questions = _load_questions(db, limit=6)

    output = _generate_viva_practice_with_llm(topic=topic, notes=notes, questions=questions)
    if output is None:
        output = _fallback_viva_practice(topic=topic, notes=notes, questions=questions)

    db.add(
        PlannerRun(
            run_type="viva",
            input_context=topic,
            output_markdown=_render_viva_markdown(output.questions),
        )
    )
    return output


def build_weekly_digest(db: Session, period_start: str, period_end: str) -> schemas.WeeklyDigestResponse:
    start_at, end_before = _parse_date_range(period_start, period_end)
    notes = _load_notes(db, limit=20, start_at=start_at, end_before=end_before)
    questions = _load_questions(db, limit=10, start_at=start_at, end_before=end_before)

    markdown = _generate_weekly_digest_with_llm(
        period_start=period_start,
        period_end=period_end,
        notes=notes,
        questions=questions,
    )
    if markdown is None:
        markdown = _fallback_weekly_digest(
            period_start=period_start,
            period_end=period_end,
            notes=notes,
            questions=questions,
        )

    digest = WeeklyDigest(period_start=period_start, period_end=period_end, digest_markdown=markdown)
    db.add(digest)
    db.flush()

    return schemas.WeeklyDigestResponse(
        id=digest.id,
        period_start=period_start,
        period_end=period_end,
        digest_markdown=markdown,
    )
