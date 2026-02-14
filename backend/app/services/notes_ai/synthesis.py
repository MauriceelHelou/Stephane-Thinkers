import hashlib
import json
import re
from collections import Counter, defaultdict
from typing import List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.notes_ai import SynthesisRun, SynthesisRunCitation, SynthesisSnapshot
from app.schemas import critical_term as schemas
from app.utils.ai_service import AIServiceError, is_ai_enabled, synthesize_term_definition

_WORD_RE = re.compile(r"[A-Za-z][A-Za-z'-]{2,}")
_CONTRAST_MARKERS = {
    "however",
    "but",
    "yet",
    "although",
    "whereas",
    "while",
    "tension",
    "contested",
    "ambiguous",
    "unclear",
}
_ASSERTIVE_MARKERS = {
    "therefore",
    "thus",
    "demonstrates",
    "shows",
    "establishes",
    "clearly",
    "definitive",
}
_STOPWORDS = {
    "about",
    "across",
    "after",
    "again",
    "against",
    "also",
    "among",
    "because",
    "before",
    "being",
    "between",
    "both",
    "could",
    "does",
    "each",
    "from",
    "have",
    "into",
    "just",
    "like",
    "many",
    "more",
    "most",
    "must",
    "only",
    "other",
    "over",
    "same",
    "some",
    "such",
    "than",
    "that",
    "their",
    "them",
    "then",
    "there",
    "these",
    "they",
    "this",
    "those",
    "through",
    "under",
    "using",
    "very",
    "what",
    "when",
    "where",
    "which",
    "while",
    "with",
    "within",
    "without",
    "your",
}


def _tokenize(text: str) -> List[str]:
    return [match.group(0).lower() for match in _WORD_RE.finditer(text or "")]


def _term_tokens(term_name: str) -> set[str]:
    return set(_tokenize(term_name))


def _citation_token(citation_key: str) -> str:
    return f"[{citation_key}]"


def _format_citations(citation_keys: List[str], limit: int = 3) -> str:
    seen: set[str] = set()
    ordered: List[str] = []
    for key in citation_keys:
        if key and key not in seen:
            seen.add(key)
            ordered.append(key)
    if not ordered:
        return ""
    return " ".join([_citation_token(key) for key in ordered[:limit]])


def _extract_thinker_names(excerpt: dict) -> List[str]:
    raw = excerpt.get("associated_thinkers", [])
    names: List[str] = []
    if not isinstance(raw, list):
        return names

    for item in raw:
        if isinstance(item, str):
            name = item.strip()
            if name:
                names.append(name)
        elif isinstance(item, dict):
            name = str(item.get("name", "")).strip()
            if name:
                names.append(name)
    return sorted(set(names))


def _prepare_excerpts(excerpts: List[dict]) -> List[dict]:
    prepared: List[dict] = []
    for index, excerpt in enumerate(excerpts, start=1):
        citation_key = str(excerpt.get("citation_key") or f"E{index}")
        snippet = str(excerpt.get("context_snippet") or "").strip()
        if not snippet:
            continue

        prepared.append(
            {
                "citation_key": citation_key,
                "context_snippet": snippet,
                "tokens": _tokenize(snippet),
                "note_title": str(excerpt.get("note_title") or "Untitled note"),
                "folder_name": str(excerpt.get("folder_name") or "Unfiled"),
                "thinkers": _extract_thinker_names(excerpt),
            }
        )
    return prepared


def _top_keywords(prepared: List[dict], term_name: str, limit: int = 5) -> List[str]:
    term_words = _term_tokens(term_name)
    counter: Counter = Counter()
    for excerpt in prepared:
        for token in excerpt["tokens"]:
            if token in _STOPWORDS:
                continue
            if token in term_words:
                continue
            counter[token] += 1
    return [word for word, _ in counter.most_common(limit)]


def _group_label(excerpt: dict) -> str:
    if excerpt["thinkers"]:
        return ", ".join(excerpt["thinkers"])
    return "Unattributed"


def _top_thinker_groups(prepared: List[dict]) -> List[tuple[str, int, List[str]]]:
    grouped: dict[str, dict] = defaultdict(lambda: {"count": 0, "citations": []})
    for excerpt in prepared:
        label = _group_label(excerpt)
        grouped[label]["count"] += 1
        grouped[label]["citations"].append(excerpt["citation_key"])
    items = [(label, payload["count"], payload["citations"]) for label, payload in grouped.items()]
    items.sort(key=lambda item: item[1], reverse=True)
    return items


def _dimension_lines(prepared: List[dict], keywords: List[str]) -> List[str]:
    lines: List[str] = []
    for keyword in keywords:
        citations = [excerpt["citation_key"] for excerpt in prepared if keyword in excerpt["tokens"]]
        if not citations:
            continue
        lines.append(
            f"- **{keyword.title()}** recurs as a framing dimension in the corpus {_format_citations(citations)}."
        )
    if lines:
        return lines[:4]

    fallback_citations = [excerpt["citation_key"] for excerpt in prepared[:3]]
    return [
        "- **Local framing** varies by note context rather than presenting a single fixed definition "
        f"{_format_citations(fallback_citations)}."
    ]


def _tension_lines(prepared: List[dict]) -> List[str]:
    contrastive: List[dict] = []
    assertive: List[dict] = []
    for excerpt in prepared:
        token_set = set(excerpt["tokens"])
        if token_set.intersection(_CONTRAST_MARKERS):
            contrastive.append(excerpt)
        if token_set.intersection(_ASSERTIVE_MARKERS):
            assertive.append(excerpt)

    lines: List[str] = []
    if contrastive and assertive:
        lines.append(
            "- The evidence mixes contrastive framing and assertive conclusions, indicating unresolved interpretive tension "
            f"{_format_citations([contrastive[0]['citation_key'], assertive[0]['citation_key']])}."
        )
    if len(prepared) >= 2:
        lines.append(
            "- Cross-note wording suggests scope drift: the term may be doing different conceptual work in different argumentative settings "
            f"{_format_citations([prepared[0]['citation_key'], prepared[1]['citation_key']])}."
        )
    if lines:
        return lines[:2]

    return [
        "- No explicit contradiction markers dominate the corpus; additional excerpts are needed to test competing interpretations "
        f"{_format_citations([excerpt['citation_key'] for excerpt in prepared[:2]])}."
    ]


def _definition_fallback(term_name: str, prepared: List[dict], filter_context: str) -> str:
    keywords = _top_keywords(prepared, term_name=term_name, limit=5)
    thinker_groups = _top_thinker_groups(prepared)
    lead_citations = [excerpt["citation_key"] for excerpt in prepared[:3]]
    primary_group = thinker_groups[0][0] if thinker_groups else "multiple contexts"
    keyword_phrase = ", ".join(keywords[:3]) if keywords else "context, argument, and interpretation"

    working_definition = (
        f"`{term_name}` is treated as a working concept anchored in {keyword_phrase}, "
        f"with usage clustered around {primary_group.lower()} {_format_citations(lead_citations)}."
    )
    nuance = (
        "The excerpts indicate contextual rather than universal usage, so any stable definition should remain provisional "
        f"{_format_citations([excerpt['citation_key'] for excerpt in prepared[:4]])}."
    )
    dimensions = _dimension_lines(prepared, keywords)
    tensions = _tension_lines(prepared)

    return (
        f"## Definition synthesis for `{term_name}`\n\n"
        f"Filter context: {filter_context}\n\n"
        "### Working definition\n"
        f"{working_definition}\n"
        f"{nuance}\n\n"
        "### Key dimensions in the evidence\n"
        + "\n".join(dimensions)
        + "\n\n### Tensions and open questions\n"
        + "\n".join(tensions)
    )


def _comparative_fallback(term_name: str, prepared: List[dict], filter_context: str) -> str:
    thinker_groups = _top_thinker_groups(prepared)
    if not thinker_groups:
        return _definition_fallback(term_name=term_name, prepared=prepared, filter_context=filter_context)

    lines: List[str] = []
    for thinker_label, count, citations in thinker_groups[:5]:
        scoped_excerpts = [excerpt for excerpt in prepared if _group_label(excerpt) == thinker_label]
        scoped_keywords = _top_keywords(scoped_excerpts, term_name=term_name, limit=2)
        emphasis = ", ".join(scoped_keywords) if scoped_keywords else "contextual variation"
        lines.append(
            f"- **{thinker_label}** appears in {count} excerpt(s), emphasizing {emphasis} {_format_citations(citations)}."
        )

    top_two = thinker_groups[:2]
    if len(top_two) == 2:
        assessment = (
            f"Across the two strongest groups ({top_two[0][0]} vs {top_two[1][0]}), the term is used for partially different argumentative jobs "
            f"{_format_citations(top_two[0][2] + top_two[1][2], limit=4)}."
        )
    else:
        assessment = (
            "The current corpus is dominated by one thinker context, so comparative confidence is limited "
            f"{_format_citations(top_two[0][2] if top_two else [prepared[0]['citation_key']])}."
        )

    return (
        f"## Comparative synthesis for `{term_name}`\n\n"
        f"Filter context: {filter_context}\n\n"
        "### Thinker-context comparison\n"
        + "\n".join(lines)
        + "\n\n### Comparative assessment\n"
        + assessment
    )


def _critical_fallback(term_name: str, prepared: List[dict], filter_context: str) -> str:
    keywords = _top_keywords(prepared, term_name=term_name, limit=4)
    thinker_groups = _top_thinker_groups(prepared)
    lead_group = thinker_groups[0][0] if thinker_groups else "the current excerpts"
    lead_citations = thinker_groups[0][2] if thinker_groups else [prepared[0]["citation_key"]]
    contrastive_citations = [
        excerpt["citation_key"]
        for excerpt in prepared
        if set(excerpt["tokens"]).intersection(_CONTRAST_MARKERS)
    ]
    if not contrastive_citations and len(prepared) > 1:
        contrastive_citations = [prepared[1]["citation_key"]]

    keyword_phrase = ", ".join(keywords[:2]) if keywords else "contextual interpretation"
    claim = (
        f"`{term_name}` functions as a structuring concept around {keyword_phrase} in {lead_group.lower()} "
        f"{_format_citations(lead_citations)}."
    )
    objection = (
        "The evidence may over-represent one interpretive register and under-specify competing uses in other notes "
        f"{_format_citations(contrastive_citations or lead_citations)}."
    )
    reply = (
        "Treat the current conclusion as provisional and extend sampling across additional folders or thinker contexts before fixing a stable claim "
        f"{_format_citations([excerpt['citation_key'] for excerpt in prepared[:3]])}."
    )

    return (
        f"## Critical synthesis for `{term_name}`\n\n"
        f"Filter context: {filter_context}\n\n"
        "### Claim\n"
        f"{claim}\n\n"
        "### Objection\n"
        f"{objection}\n\n"
        "### Reply\n"
        f"{reply}"
    )


def _fallback_synthesis(mode: str, term_name: str, excerpts: List[dict], filter_context: str) -> str:
    prepared = _prepare_excerpts(excerpts)
    if not prepared:
        return f'No excerpts found for "{term_name}" in {filter_context}.'

    if mode == "comparative":
        return _comparative_fallback(term_name=term_name, prepared=prepared, filter_context=filter_context)

    if mode == "critical":
        return _critical_fallback(term_name=term_name, prepared=prepared, filter_context=filter_context)

    return _definition_fallback(term_name=term_name, prepared=prepared, filter_context=filter_context)


def _is_response_grounded(response: str) -> bool:
    if not response or not response.strip():
        return False
    return bool(re.search(r"\[E\d+\]", response))


async def generate_synthesis_text(
    mode: str,
    term_name: str,
    excerpts: List[dict],
    filter_context: str,
) -> str:
    if not is_ai_enabled():
        return _fallback_synthesis(mode=mode, term_name=term_name, excerpts=excerpts, filter_context=filter_context)

    mode_prefix = {
        "definition": "Provide a concise grounded definition.",
        "comparative": "Compare thinkers and highlight agreements/disagreements.",
        "critical": "Structure response as claim, objection, and reply.",
    }.get(mode, "Provide a concise grounded definition.")

    decorated_excerpts = []
    for excerpt in excerpts:
        snippet = excerpt.get("context_snippet", "")
        decorated_excerpts.append(
            {
                **excerpt,
                "context_snippet": f"{mode_prefix} {snippet}".strip(),
            }
        )

    try:
        response = await synthesize_term_definition(
            term_name=term_name,
            excerpts=decorated_excerpts,
            filter_context=filter_context,
        )
        if not _is_response_grounded(response):
            return _fallback_synthesis(mode=mode, term_name=term_name, excerpts=excerpts, filter_context=filter_context)
        return response
    except AIServiceError:
        return _fallback_synthesis(mode=mode, term_name=term_name, excerpts=excerpts, filter_context=filter_context)


def persist_synthesis_run(
    db: Session,
    term_id: UUID,
    mode: str,
    filter_context: str,
    synthesis_text: str,
    citations: List[schemas.SynthesisCitation],
    folder_id: Optional[UUID] = None,
    thinker_id: Optional[UUID] = None,
    coverage_rate: Optional[float] = None,
) -> SynthesisRun:
    run = SynthesisRun(
        term_id=term_id,
        mode=mode,
        folder_id=folder_id,
        thinker_id=thinker_id,
        filter_context=filter_context,
        synthesis_text=synthesis_text,
        coverage_rate=coverage_rate,
    )
    db.add(run)
    db.flush()

    for citation in citations:
        db.add(
            SynthesisRunCitation(
                run_id=run.id,
                citation_key=citation.citation_key,
                note_id=UUID(str(citation.note_id)),
                note_title=citation.note_title,
                folder_name=citation.folder_name,
                context_snippet=citation.context_snippet,
            )
        )

    snapshot_payload = {
        "term_id": str(term_id),
        "mode": mode,
        "filter_context": filter_context,
        "synthesis_text": synthesis_text,
        "citations": [c.model_dump(mode="json") for c in citations],
    }
    payload_str = json.dumps(snapshot_payload, sort_keys=True)
    snapshot_hash = hashlib.sha256(payload_str.encode("utf-8")).hexdigest()
    db.add(
        SynthesisSnapshot(
            run_id=run.id,
            snapshot_hash=snapshot_hash,
            payload_json=payload_str,
        )
    )

    return run
