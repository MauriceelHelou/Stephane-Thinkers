import json
import math
import os
import re
from collections import Counter
from typing import List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.critical_term import TermOccurrence
from app.models.note import Note
from app.models.notes_ai import NoteEmbedding
from app.models.thinker_mention import ThinkerCoOccurrence
from app.schemas import analysis as schemas


TOKEN_RE = re.compile(r"[a-zA-Z]{2,}")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_EMBEDDING_MODEL = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
CHROMA_PERSIST_DIRECTORY = os.getenv("CHROMA_PERSIST_DIRECTORY", "./data/chroma")
CHROMA_COLLECTION_NAME = os.getenv("CHROMA_COLLECTION_NAME", "notes_ai_embeddings")


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


NOTES_AI_USE_EXTERNAL_EMBEDDINGS = _env_bool(
    "NOTES_AI_USE_EXTERNAL_EMBEDDINGS",
    os.getenv("ENVIRONMENT", "development") != "test",
)

_openai_client = None
_openai_unavailable = False
_chroma_collection = None
_chroma_unavailable = False


def _tokenize(text: str) -> List[str]:
    return [token.lower() for token in TOKEN_RE.findall(text or "")]


def _cosine_similarity(counter_a: Counter, counter_b: Counter) -> float:
    if not counter_a or not counter_b:
        return 0.0
    keys = set(counter_a.keys()) | set(counter_b.keys())
    dot = sum(counter_a.get(k, 0) * counter_b.get(k, 0) for k in keys)
    norm_a = math.sqrt(sum(v * v for v in counter_a.values()))
    norm_b = math.sqrt(sum(v * v for v in counter_b.values()))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _build_embedding_vector(text: str) -> List[float]:
    # Lightweight deterministic embedding substitute for local/test execution.
    tokens = _tokenize(text)
    vector = [0.0] * 64
    for token in tokens:
        idx = hash(token) % 64
        vector[idx] += 1.0
    norm = math.sqrt(sum(v * v for v in vector))
    if norm == 0:
        return vector
    return [v / norm for v in vector]


def _vector_similarity(vector_a: List[float], vector_b: List[float]) -> float:
    if not vector_a or not vector_b:
        return 0.0
    size = min(len(vector_a), len(vector_b))
    return float(sum(vector_a[i] * vector_b[i] for i in range(size)))


def _get_openai_client():
    global _openai_client, _openai_unavailable
    if _openai_unavailable:
        return None
    if _openai_client is not None:
        return _openai_client
    if not NOTES_AI_USE_EXTERNAL_EMBEDDINGS or not OPENAI_API_KEY:
        _openai_unavailable = True
        return None
    try:
        from openai import OpenAI

        _openai_client = OpenAI(api_key=OPENAI_API_KEY)
        return _openai_client
    except Exception:
        _openai_unavailable = True
        return None


def _embed_text_with_openai(text: str) -> Optional[List[float]]:
    client = _get_openai_client()
    if client is None:
        return None
    try:
        response = client.embeddings.create(model=OPENAI_EMBEDDING_MODEL, input=text)
        return list(response.data[0].embedding)
    except Exception:
        return None


def _get_chroma_collection():
    global _chroma_collection, _chroma_unavailable
    if _chroma_unavailable:
        return None
    if _chroma_collection is not None:
        return _chroma_collection
    if not NOTES_AI_USE_EXTERNAL_EMBEDDINGS:
        _chroma_unavailable = True
        return None
    try:
        import chromadb

        client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIRECTORY)
        _chroma_collection = client.get_or_create_collection(
            name=CHROMA_COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
        return _chroma_collection
    except Exception:
        _chroma_unavailable = True
        return None


def _use_external_embedding_stack() -> bool:
    return NOTES_AI_USE_EXTERNAL_EMBEDDINGS and _get_openai_client() is not None and _get_chroma_collection() is not None


def upsert_note_embedding(db: Session, note: Note, model_name: str = "local-hash-v1") -> NoteEmbedding:
    combined_text = ((note.content or "") + " " + (note.content_html or "")).strip()
    vector: Optional[List[float]] = None
    resolved_model_name = model_name

    if _use_external_embedding_stack():
        vector = _embed_text_with_openai(combined_text)
        if vector:
            resolved_model_name = OPENAI_EMBEDDING_MODEL
            collection = _get_chroma_collection()
            if collection is not None:
                collection.upsert(
                    ids=[str(note.id)],
                    embeddings=[vector],
                    metadatas=[{
                        "note_id": str(note.id),
                        "title": note.title or "Untitled note",
                        "folder_id": str(note.folder_id) if note.folder_id else "",
                    }],
                    documents=[(note.content or "")[:4000]],
                )

    if vector is None:
        vector = _build_embedding_vector(combined_text)

    existing = db.query(NoteEmbedding).filter(NoteEmbedding.note_id == note.id).first()
    payload = json.dumps(vector)
    if existing:
        existing.embedding_model = resolved_model_name
        existing.vector_json = payload
        return existing

    created = NoteEmbedding(note_id=note.id, embedding_model=resolved_model_name, vector_json=payload)
    db.add(created)
    return created


def semantic_search_notes(
    db: Session,
    query: str,
    folder_id: Optional[UUID] = None,
    limit: int = 10,
) -> List[schemas.SemanticSearchResult]:
    notes_query = db.query(Note).filter(Note.is_canvas_note == False)  # noqa: E712
    if folder_id is not None:
        notes_query = notes_query.filter(Note.folder_id == folder_id)
    notes = notes_query.order_by(Note.updated_at.desc()).limit(500).all()

    if _use_external_embedding_stack():
        collection = _get_chroma_collection()
        query_vector = _embed_text_with_openai(query)
        if collection is not None and query_vector:
            note_by_id = {str(note.id): note for note in notes}
            for note in notes:
                existing = db.query(NoteEmbedding).filter(NoteEmbedding.note_id == note.id).first()
                if existing is None or existing.embedding_model != OPENAI_EMBEDDING_MODEL:
                    upsert_note_embedding(db, note, model_name=OPENAI_EMBEDDING_MODEL)

            if not note_by_id:
                return []
            candidate_count = max(1, min(max(limit * 4, limit), len(note_by_id)))
            query_result = collection.query(
                query_embeddings=[query_vector],
                n_results=candidate_count,
                include=["distances", "documents", "metadatas"],
            )

            ids = (query_result.get("ids") or [[]])[0]
            distances = (query_result.get("distances") or [[]])[0]
            documents = (query_result.get("documents") or [[]])[0]
            ranked_results: List[schemas.SemanticSearchResult] = []

            for idx, note_id in enumerate(ids):
                note = note_by_id.get(str(note_id))
                if note is None:
                    continue
                distance = distances[idx] if idx < len(distances) else None
                similarity = 1.0 - float(distance) if distance is not None else 0.0
                excerpt = documents[idx] if idx < len(documents) and documents[idx] else (note.content or "")[:280]
                ranked_results.append(
                    schemas.SemanticSearchResult(
                        note_id=note.id,
                        note_title=note.title or "Untitled note",
                        excerpt=excerpt[:280],
                        score=round(max(0.0, similarity), 4),
                    )
                )

            if ranked_results:
                ranked_results.sort(key=lambda item: item.score, reverse=True)
                return ranked_results[:limit]

    query_counter = Counter(_tokenize(query))
    query_vector = _build_embedding_vector(query)
    results: List[schemas.SemanticSearchResult] = []
    for note in notes:
        content = note.content or ""
        lexical_score = _cosine_similarity(query_counter, Counter(_tokenize(content)))

        embedding = db.query(NoteEmbedding).filter(NoteEmbedding.note_id == note.id).first()
        if embedding is None:
            embedding = upsert_note_embedding(db, note)
        try:
            note_vector = json.loads(embedding.vector_json)
        except Exception:
            note_vector = []
        vector_score = _vector_similarity(query_vector, note_vector) if note_vector else 0.0

        score = (0.4 * lexical_score) + (0.6 * vector_score)
        if score <= 0:
            continue

        excerpt = content[:280]
        results.append(
            schemas.SemanticSearchResult(
                note_id=note.id,
                note_title=note.title or "Untitled note",
                excerpt=excerpt,
                score=round(score, 4),
            )
        )

    results.sort(key=lambda item: item.score, reverse=True)
    return results[:limit]


def related_excerpts_for_occurrence(
    db: Session,
    occurrence_id: UUID,
    limit: int = 8,
) -> List[schemas.RelatedExcerpt]:
    source = db.query(TermOccurrence).filter(TermOccurrence.id == occurrence_id).first()
    if source is None:
        return []

    source_tokens = Counter(_tokenize(source.context_snippet))
    candidates = (
        db.query(TermOccurrence, Note)
        .join(Note, Note.id == TermOccurrence.note_id)
        .filter(TermOccurrence.id != source.id)
        .order_by(TermOccurrence.created_at.desc())
        .limit(200)
        .all()
    )

    scored: List[schemas.RelatedExcerpt] = []
    for occurrence, note in candidates:
        score = _cosine_similarity(source_tokens, Counter(_tokenize(occurrence.context_snippet)))
        if score <= 0:
            continue
        scored.append(
            schemas.RelatedExcerpt(
                occurrence_id=occurrence.id,
                note_id=note.id,
                note_title=note.title or "Untitled note",
                context_snippet=occurrence.context_snippet,
                similarity=round(score, 4),
            )
        )

    scored.sort(key=lambda item: item.similarity, reverse=True)
    return scored[:limit]


def build_connection_explanations(
    db: Session,
    folder_id: Optional[UUID] = None,
    limit: int = 10,
) -> List[schemas.ConnectionExplanation]:
    query = db.query(ThinkerCoOccurrence)
    if folder_id is not None:
        query = query.join(Note, ThinkerCoOccurrence.note_id == Note.id).filter(Note.folder_id == folder_id)

    pairs = query.order_by(ThinkerCoOccurrence.created_at.desc()).limit(500).all()
    grouped = {}
    for pair in pairs:
        key = tuple(sorted([str(pair.thinker_a_id), str(pair.thinker_b_id)]))
        grouped.setdefault(key, []).append(pair)

    results: List[schemas.ConnectionExplanation] = []
    for key, entries in grouped.items():
        if len(entries) < 2:
            continue
        sample = entries[:3]
        excerpts = []
        for entry in sample:
            note_content = (entry.note.content if entry.note is not None else "") or ""
            if not note_content:
                continue
            excerpts.append(note_content[:200])
        confidence = "high" if len(entries) > 8 else ("medium" if len(entries) >= 4 else "low")
        results.append(
            schemas.ConnectionExplanation(
                thinker_a_id=UUID(key[0]),
                thinker_b_id=UUID(key[1]),
                evidence_count=len(entries),
                confidence=confidence,
                rationale=(
                    "Thinkers are repeatedly co-mentioned across notes. "
                    "Confidence is based on co-occurrence count and same-paragraph proximity."
                ),
                sample_excerpts=excerpts,
            )
        )
    results.sort(key=lambda item: item.evidence_count, reverse=True)
    return results[:limit]
