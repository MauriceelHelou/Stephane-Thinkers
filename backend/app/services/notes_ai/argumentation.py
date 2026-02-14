from typing import List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.note import Note
from app.models.notes_ai import ArgumentMap, ArgumentMapEdge, ArgumentMapNode, ClaimCandidate
from app.schemas import analysis as analysis_schemas
from app.schemas import critical_term as term_schemas


def generate_thesis_candidates(
    term_id: UUID,
    term_name: str,
    excerpts: List[term_schemas.TermOccurrenceResponse],
) -> List[term_schemas.ThesisCandidate]:
    if not excerpts:
        return []

    grouped = excerpts[:5]
    candidates: List[term_schemas.ThesisCandidate] = []
    for index, excerpt in enumerate(grouped, start=1):
        claim = (
            f"{term_name.title()} appears as a structuring concept in note evidence set #{index}, "
            "with meaning shaped by local argumentative context."
        )
        support = excerpt.context_snippet[:240]
        confidence = 0.7 if excerpt.associated_thinkers else 0.55
        candidates.append(
            term_schemas.ThesisCandidate(
                claim=claim,
                support=support,
                confidence=confidence,
                citation_note_id=excerpt.note_id,
            )
        )
    return candidates


def persist_thesis_candidates(
    db: Session,
    term_id: UUID,
    candidates: List[term_schemas.ThesisCandidate],
    run_id: Optional[UUID] = None,
) -> None:
    for candidate in candidates:
        db.add(
            ClaimCandidate(
                term_id=term_id,
                run_id=run_id,
                claim_text=candidate.claim,
                support_summary=candidate.support,
                confidence=candidate.confidence,
            )
        )


def build_argument_map_from_notes(
    db: Session,
    note_ids: List[UUID],
    title: str = "Argument map",
) -> analysis_schemas.ArgumentMapResponse:
    notes = db.query(Note).filter(Note.id.in_(note_ids)).all() if note_ids else []

    arg_map = ArgumentMap(title=title, source_type="notes", source_id=",".join([str(n.id) for n in notes]))
    db.add(arg_map)
    db.flush()

    nodes: List[analysis_schemas.ArgumentNode] = []
    edges: List[analysis_schemas.ArgumentEdge] = []

    previous_claim_node_id: Optional[UUID] = None
    for note in notes:
        content = (note.content or "").strip()
        if not content:
            continue

        claim_label = content.split(".")[0][:220] or "Claim from note"
        claim_node = ArgumentMapNode(
            map_id=arg_map.id,
            node_type="claim",
            label=claim_label,
            confidence=0.65,
            metadata_json="{}",
        )
        db.add(claim_node)
        db.flush()

        nodes.append(
            analysis_schemas.ArgumentNode(
                id=claim_node.id,
                node_type="claim",
                label=claim_label,
                confidence=0.65,
            )
        )

        evidence_label = content[:260]
        evidence_node = ArgumentMapNode(
            map_id=arg_map.id,
            node_type="evidence",
            label=evidence_label,
            confidence=0.8,
            metadata_json="{}",
        )
        db.add(evidence_node)
        db.flush()

        nodes.append(
            analysis_schemas.ArgumentNode(
                id=evidence_node.id,
                node_type="evidence",
                label=evidence_label,
                confidence=0.8,
            )
        )

        support_edge = ArgumentMapEdge(
            map_id=arg_map.id,
            from_node_id=evidence_node.id,
            to_node_id=claim_node.id,
            edge_type="supports",
            weight=1.0,
        )
        db.add(support_edge)
        db.flush()

        edges.append(
            analysis_schemas.ArgumentEdge(
                id=support_edge.id,
                from_node_id=evidence_node.id,
                to_node_id=claim_node.id,
                edge_type="supports",
                weight=1.0,
            )
        )

        if previous_claim_node_id is not None:
            relation_edge = ArgumentMapEdge(
                map_id=arg_map.id,
                from_node_id=previous_claim_node_id,
                to_node_id=claim_node.id,
                edge_type="relates_to",
                weight=0.5,
            )
            db.add(relation_edge)
            db.flush()

            edges.append(
                analysis_schemas.ArgumentEdge(
                    id=relation_edge.id,
                    from_node_id=previous_claim_node_id,
                    to_node_id=claim_node.id,
                    edge_type="relates_to",
                    weight=0.5,
                )
            )

        previous_claim_node_id = claim_node.id

    premise_gaps: List[analysis_schemas.PremiseGap] = []
    if not nodes:
        premise_gaps.append(
            analysis_schemas.PremiseGap(
                message="No argument nodes could be extracted from selected notes.",
                severity="high",
            )
        )
    elif len([n for n in nodes if n.node_type == "claim"]) > len([n for n in nodes if n.node_type == "evidence"]):
        premise_gaps.append(
            analysis_schemas.PremiseGap(
                message="Claim count exceeds evidence count; consider adding supporting excerpts.",
                severity="medium",
            )
        )

    return analysis_schemas.ArgumentMapResponse(
        map_id=arg_map.id,
        title=title,
        nodes=nodes,
        edges=edges,
        premise_gaps=premise_gaps,
    )
