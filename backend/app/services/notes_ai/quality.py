import json
import re
from typing import List

from sqlalchemy.orm import Session

from app.models.notes_ai import QualityReport, SynthesisRun
from app.schemas import critical_term as schemas


_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+")
_WORD_RE = re.compile(r"[A-Za-z][A-Za-z'-]{2,}")
_NEGATION_MARKERS = {"not", "never", "no", "none", "without", "cannot", "can't", "lacks", "lack"}
_ASSERTIVE_MARKERS = {"is", "are", "shows", "demonstrates", "therefore", "thus", "establishes", "confirms"}
_TOPIC_STOPWORDS = {
    "that",
    "this",
    "these",
    "those",
    "with",
    "from",
    "into",
    "about",
    "across",
    "there",
    "their",
    "them",
    "have",
    "has",
    "had",
    "will",
    "would",
    "could",
    "should",
    "while",
    "because",
    "where",
    "which",
    "when",
    "what",
    "only",
    "very",
}


def _extract_sentences(text: str) -> List[str]:
    raw = [s.strip() for s in _SENTENCE_SPLIT_RE.split(text or "") if s.strip()]
    return [re.sub(r"\s+", " ", sentence).strip() for sentence in raw]


def _sentence_has_citation(sentence: str, citation_keys: List[str]) -> bool:
    return any(key in sentence for key in citation_keys)


def _estimate_supported_sentences(sentences: List[str], citation_keys: List[str]) -> tuple[int, int, List[int]]:
    if not sentences:
        return 0, 0, []

    supported = 0
    unsupported_indices: List[int] = []
    for index, sentence in enumerate(sentences):
        if _sentence_has_citation(sentence, citation_keys):
            supported += 1
        else:
            unsupported_indices.append(index)
    return supported, len(sentences), unsupported_indices


def _topic_token(sentence: str) -> str:
    tokens = [match.group(0).lower() for match in _WORD_RE.finditer(sentence)]
    for token in tokens:
        if token not in _TOPIC_STOPWORDS:
            return token
    return ""


def _sentence_polarity(sentence: str) -> int:
    tokens = [match.group(0).lower() for match in _WORD_RE.finditer(sentence)]
    neg_count = sum(1 for token in tokens if token in _NEGATION_MARKERS)
    pos_count = sum(1 for token in tokens if token in _ASSERTIVE_MARKERS)
    if neg_count > pos_count:
        return -1
    if pos_count > neg_count:
        return 1
    return 0


def _detect_topic_polarity_conflicts(sentences: List[str]) -> List[schemas.ContradictionSignal]:
    topic_map: dict[str, dict[str, str]] = {}
    for sentence in sentences:
        topic = _topic_token(sentence)
        if not topic:
            continue
        polarity = _sentence_polarity(sentence)
        if polarity == 0:
            continue

        if topic not in topic_map:
            topic_map[topic] = {}
        if polarity > 0 and "positive" not in topic_map[topic]:
            topic_map[topic]["positive"] = sentence
        if polarity < 0 and "negative" not in topic_map[topic]:
            topic_map[topic]["negative"] = sentence

    contradictions: List[schemas.ContradictionSignal] = []
    for topic, evidence in topic_map.items():
        if "positive" in evidence and "negative" in evidence:
            contradictions.append(
                schemas.ContradictionSignal(
                    summary=f'Potential contradiction around "{topic}" based on opposing sentence polarity.',
                    evidence_a=evidence["positive"][:220],
                    evidence_b=evidence["negative"][:220],
                )
            )
    return contradictions


def build_quality_report_payload(
    synthesis_text: str,
    citations: List[schemas.SynthesisCitation],
) -> schemas.TermQualityReportResponse:
    citation_keys = [c.citation_key for c in citations]
    sentences = _extract_sentences(synthesis_text)
    supported, total, unsupported_indices = _estimate_supported_sentences(sentences, citation_keys)
    coverage_rate = (supported / total) if total > 0 else 0.0

    unsupported_claims: List[str] = []
    if total > 0 and unsupported_indices:
        unsupported_claims.append(
            f"{len(unsupported_indices)} sentence(s) did not include explicit citation keys."
        )
        for sentence_index in unsupported_indices[:4]:
            unsupported_claims.append(f'Unsupported sentence: "{sentences[sentence_index][:200]}"')

    contradictions = _detect_topic_polarity_conflicts(sentences)
    lower = synthesis_text.lower()
    if "however" in lower and "therefore" in lower:
        contradictions.append(
            schemas.ContradictionSignal(
                summary="Potential internal tension detected via contrasting discourse markers.",
                evidence_a="however",
                evidence_b="therefore",
            )
        )

    if coverage_rate >= 0.85 and len(contradictions) == 0:
        uncertainty = "low"
    elif coverage_rate >= 0.5:
        uncertainty = "medium"
    else:
        uncertainty = "high"

    if len(unsupported_indices) >= 3 and uncertainty == "low":
        uncertainty = "medium"
    if len(contradictions) >= 2 and coverage_rate < 0.75:
        uncertainty = "high"

    return schemas.TermQualityReportResponse(
        coverage_rate=coverage_rate,
        unsupported_claims=unsupported_claims,
        contradiction_signals=contradictions,
        uncertainty_label=uncertainty,
    )


def persist_quality_report(
    db: Session,
    run: SynthesisRun,
    payload: schemas.TermQualityReportResponse,
) -> QualityReport:
    report = QualityReport(
        run_id=run.id,
        coverage_rate=payload.coverage_rate,
        unsupported_claim_count=len(payload.unsupported_claims),
        contradiction_count=len(payload.contradiction_signals),
        uncertainty_label=payload.uncertainty_label,
        details_json=json.dumps(payload.model_dump(), sort_keys=True),
    )
    db.add(report)
    return report
