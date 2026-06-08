"""
ChromaDB reindex service.

Rebuilds the ChromaDB collection from canonical note_embeddings data in PostgreSQL/SQLite.
This ensures ChromaDB can be fully reconstructed from the primary database after a restore.
"""
import json
import logging
import os
from typing import Optional

from sqlalchemy.orm import Session

from app.database import SessionLocal

logger = logging.getLogger(__name__)

CHROMA_PERSIST_DIRECTORY = os.getenv("CHROMA_PERSIST_DIRECTORY", "./data/chroma")
CHROMA_COLLECTION_NAME = os.getenv("CHROMA_COLLECTION_NAME", "thinkers")


def reindex_chroma(db: Optional[Session] = None) -> dict:
    """Rebuild ChromaDB collection from note_embeddings table.

    Returns summary with count of indexed embeddings.
    """
    own_session = db is None
    if own_session:
        db = SessionLocal()

    try:
        import chromadb

        # Load all embeddings from canonical SQL store
        from app.models.notes_ai import NoteEmbedding
        embeddings = db.query(NoteEmbedding).all()

        if not embeddings:
            logger.info("No embeddings found in note_embeddings table. Nothing to reindex.")
            return {"status": "completed", "indexed_count": 0}

        # Initialize ChromaDB client
        client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIRECTORY)

        # Delete and recreate collection for a clean rebuild
        try:
            client.delete_collection(CHROMA_COLLECTION_NAME)
        except Exception:
            pass  # Collection may not exist yet

        collection = client.get_or_create_collection(
            name=CHROMA_COLLECTION_NAME,
            metadata={"hnsw:space": os.getenv("CHROMA_DISTANCE_FUNCTION", "cosine")},
        )

        # Batch add embeddings
        ids = []
        vectors = []
        metadatas = []

        for emb in embeddings:
            try:
                vector = json.loads(emb.vector_json)
            except (json.JSONDecodeError, TypeError):
                logger.warning("Skipping embedding %s: invalid vector_json", emb.id)
                continue

            ids.append(str(emb.note_id))
            vectors.append(vector)
            metadatas.append({
                "embedding_model": emb.embedding_model or "",
                "note_id": str(emb.note_id),
            })

        if ids:
            # ChromaDB has a batch size limit; chunk in groups of 5000
            batch_size = 5000
            for i in range(0, len(ids), batch_size):
                collection.add(
                    ids=ids[i:i + batch_size],
                    embeddings=vectors[i:i + batch_size],
                    metadatas=metadatas[i:i + batch_size],
                )

        logger.info("ChromaDB reindex completed: %d embeddings indexed", len(ids))
        return {"status": "completed", "indexed_count": len(ids)}

    except ImportError:
        logger.error("chromadb is not installed. Cannot reindex.")
        return {"status": "failed", "error": "chromadb not installed"}
    except Exception as exc:
        logger.exception("ChromaDB reindex failed")
        return {"status": "failed", "error": str(exc)[:500]}
    finally:
        if own_session:
            db.close()
