# Plan 8: Auto-Connection Suggestions

## Goal

Implement a co-occurrence analysis pipeline that detects when two thinkers are frequently mentioned together in Stephanie's notes, then surfaces connection suggestion cards in the notes page UI. These suggestions link directly to the existing `AddConnectionModal`, letting Stephanie confirm and create connections that appear on the timeline canvas. The system never auto-creates connections -- it only suggests.

**Key user requirement (from transcript):** "If I'm writing about William James, and then over here I'm writing about Charles Sanders Peirce, I want it to automatically make the jump that those two people are related."

**Depends on:**
- Plan 1 (ThinkerCoOccurrence model and migration)
- Plan 4 (ThinkerMention records from auto-detection, `detect_thinkers_in_note` endpoint)
- Plan 7 (analysis routes file exists at `backend/app/routes/analysis.py`)
- Plan 3 (for `/notes` right-panel integration)

**Produces:** 4 modified backend files, 1 new frontend file, 3 modified frontend files

---

## Audit Notes (2026-02-13)

1. `backend/app/schemas/analysis.py` is shared with Plans 4 and 7; extend it instead of creating a new file.
2. `analysisApi` in `frontend/src/lib/api.ts` is shared; add methods to the existing object.
3. Suggestions panel should not track "created" state in a local map unless it is explicitly updated by modal callbacks.

---

## 1. Backend: Co-occurrence Computation Utility

**File:** `backend/app/utils/thinker_detection.py` (MODIFY -- add function)

Add the following function after the existing `detect_thinker_names()` function. This is called from the `detect_thinkers_in_note` endpoint (Plan 4) after saving ThinkerMention records.

```python
from itertools import combinations
from typing import List, NamedTuple, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app.models.thinker_mention import ThinkerCoOccurrence


class DetectedMatch(NamedTuple):
    """Represents a single thinker detection in a note.
    This type is already defined in Plan 4's detect_thinker_names().
    """
    thinker_id: UUID
    thinker_name: str
    paragraph_index: Optional[int]
    char_offset: Optional[int]
    mention_text: str


def compute_co_occurrences(
    note_id: UUID,
    detected_thinkers: List[DetectedMatch],
    db: Session,
) -> int:
    """
    After detecting thinkers in a note, compute all pairwise co-occurrences.

    Logic:
    1. Clear existing co-occurrences for this note (idempotent on re-scan)
    2. Group detected thinkers by paragraph_index
    3. For each paragraph with 2+ unique thinkers: create same_paragraph co-occurrences
    4. For all unique thinker pairs in the entire note: create same_note co-occurrences
    5. Enforce thinker_a_id < thinker_b_id ordering (compare UUID hex strings)
    6. Use bulk insert for efficiency
    7. Return count of new co-occurrences

    Args:
        note_id: The UUID of the note that was scanned.
        detected_thinkers: List of DetectedMatch from detect_thinker_names().
        db: SQLAlchemy session.

    Returns:
        Number of co-occurrence records created.
    """
    # Step 1: Clear existing co-occurrences for this note
    db.query(ThinkerCoOccurrence).filter(
        ThinkerCoOccurrence.note_id == note_id
    ).delete(synchronize_session="fetch")

    if len(detected_thinkers) < 2:
        return 0

    new_records: list[ThinkerCoOccurrence] = []
    seen_pairs: set[tuple[str, str, Optional[int], str]] = set()

    def ordered_pair(id_a: UUID, id_b: UUID) -> tuple[UUID, UUID]:
        """Enforce thinker_a_id < thinker_b_id by comparing hex strings."""
        hex_a = id_a.hex if hasattr(id_a, 'hex') else str(id_a).replace('-', '')
        hex_b = id_b.hex if hasattr(id_b, 'hex') else str(id_b).replace('-', '')
        if hex_a < hex_b:
            return (id_a, id_b)
        return (id_b, id_a)

    def add_record(
        thinker_a_id: UUID,
        thinker_b_id: UUID,
        paragraph_index: Optional[int],
        co_occurrence_type: str,
    ) -> None:
        """Add a co-occurrence record if not already seen."""
        a_id, b_id = ordered_pair(thinker_a_id, thinker_b_id)
        a_hex = a_id.hex if hasattr(a_id, 'hex') else str(a_id).replace('-', '')
        b_hex = b_id.hex if hasattr(b_id, 'hex') else str(b_id).replace('-', '')
        key = (a_hex, b_hex, paragraph_index, co_occurrence_type)
        if key in seen_pairs:
            return
        seen_pairs.add(key)
        new_records.append(
            ThinkerCoOccurrence(
                thinker_a_id=a_id,
                thinker_b_id=b_id,
                note_id=note_id,
                paragraph_index=paragraph_index,
                co_occurrence_type=co_occurrence_type,
            )
        )

    # Step 2: Group by paragraph_index
    paragraphs: dict[Optional[int], set[UUID]] = {}
    all_thinker_ids: set[UUID] = set()

    for match in detected_thinkers:
        all_thinker_ids.add(match.thinker_id)
        para_idx = match.paragraph_index
        if para_idx is not None:
            if para_idx not in paragraphs:
                paragraphs[para_idx] = set()
            paragraphs[para_idx].add(match.thinker_id)

    # Step 3: Same-paragraph co-occurrences
    for para_idx, thinker_ids in paragraphs.items():
        if len(thinker_ids) >= 2:
            for id_a, id_b in combinations(sorted(thinker_ids, key=lambda x: x.hex if hasattr(x, 'hex') else str(x)), 2):
                add_record(id_a, id_b, para_idx, "same_paragraph")

    # Step 4: Same-note co-occurrences (paragraph_index = NULL)
    if len(all_thinker_ids) >= 2:
        for id_a, id_b in combinations(sorted(all_thinker_ids, key=lambda x: x.hex if hasattr(x, 'hex') else str(x)), 2):
            add_record(id_a, id_b, None, "same_note")

    # Step 5: Bulk insert
    if new_records:
        db.bulk_save_objects(new_records)

    return len(new_records)
```

**Integration point in Plan 4's endpoint:**

In the existing `detect_thinkers_in_note` route handler (created by Plan 4 in `backend/app/routes/notes.py` or a dedicated detection route), add the following call after saving ThinkerMention records:

```python
from app.utils.thinker_detection import compute_co_occurrences

# ... after saving ThinkerMention records ...

# Compute pairwise co-occurrences for this note
co_occurrence_count = compute_co_occurrences(
    note_id=note_id,
    detected_thinkers=detected_matches,  # List[DetectedMatch] from detect_thinker_names()
    db=db,
)
```

This is called automatically whenever thinker detection runs on a note (either on note save or via a manual "Scan for thinkers" action). The function is idempotent -- re-scanning a note clears old co-occurrences and recomputes from the current detections.

---

## 2. Backend: Pydantic Schemas for Analysis

**File:** `backend/app/schemas/analysis.py` (MODIFY -- extend shared analysis schemas)

```python
from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Literal
from uuid import UUID


class CoOccurrencePair(BaseModel):
    """A pair of thinkers that co-occur in notes, with frequency statistics."""
    model_config = ConfigDict(from_attributes=True)

    thinker_a_id: UUID
    thinker_a_name: str
    thinker_a_birth_year: Optional[int] = None
    thinker_a_death_year: Optional[int] = None
    thinker_b_id: UUID
    thinker_b_name: str
    thinker_b_birth_year: Optional[int] = None
    thinker_b_death_year: Optional[int] = None
    co_occurrence_count: int
    same_paragraph_count: int
    has_existing_connection: bool
    existing_connection_type: Optional[str] = None


class ConnectionSuggestionFromNotes(BaseModel):
    """A suggested connection between two thinkers, derived from co-occurrence analysis.

    This is surfaced to the user for manual confirmation. It never auto-creates
    connections -- Stephanie decides whether to accept or dismiss.
    """
    model_config = ConfigDict(from_attributes=True)

    thinker_a_id: UUID
    thinker_a_name: str
    thinker_a_birth_year: Optional[int] = None
    thinker_a_death_year: Optional[int] = None
    thinker_b_id: UUID
    thinker_b_name: str
    thinker_b_birth_year: Optional[int] = None
    thinker_b_death_year: Optional[int] = None
    co_occurrence_count: int
    same_paragraph_count: int
    sample_note_titles: List[str]
    sample_excerpts: List[str]  # ~200-char snippets showing both thinkers mentioned nearby
    confidence: Literal["high", "medium", "low"]
    # high: >10 co-occurrences
    # medium: 5-10 co-occurrences
    # low: 2-4 co-occurrences
```

---

## 3. Backend: Register Schemas

**File:** `backend/app/schemas/__init__.py` (MODIFY)

Append these schemas to the existing `from app.schemas.analysis import (...)` block introduced by earlier plans:

```python
from app.schemas.analysis import (
    CoOccurrencePair,
    ConnectionSuggestionFromNotes,
)
```

Add to the `__all__` list:

```python
    # Analysis (Plan 8)
    "CoOccurrencePair",
    "ConnectionSuggestionFromNotes",
```

**Diff:**

```diff
--- a/backend/app/schemas/__init__.py
+++ b/backend/app/schemas/__init__.py
@@ -116,6 +116,10 @@
     QuizHistoryParams,
 )
+from app.schemas.analysis import (
+    CoOccurrencePair,
+    ConnectionSuggestionFromNotes,
+)

 __all__ = [
@@ -226,4 +230,7 @@
     "QuizStatistics",
     "QuizHistoryParams",
+    # Analysis (Plan 8)
+    "CoOccurrencePair",
+    "ConnectionSuggestionFromNotes",
 ]
```

---

## 4. Backend: Analysis Endpoints

**File:** `backend/app/routes/analysis.py` (MODIFY -- add endpoints to existing router)

Plan 7 created this file with the `/api/analysis/` prefix and existing constellation endpoints. Add the following two endpoints to the existing `router`:

```python
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, aliased
from sqlalchemy import func, and_, or_, case, literal, text
from typing import List, Optional
from uuid import UUID

from app.database import get_db
from app.models.thinker_mention import ThinkerCoOccurrence
from app.models.thinker import Thinker
from app.models.connection import Connection
from app.models.note import Note
from app.schemas.analysis import CoOccurrencePair, ConnectionSuggestionFromNotes

# router = APIRouter(prefix="/api/analysis", tags=["analysis"])
# ^^^ Already exists from Plan 7. Add the endpoints below to it.


# ---------------------------------------------------------------------------
# GET /api/analysis/co-occurrences
# ---------------------------------------------------------------------------

@router.get("/co-occurrences", response_model=List[CoOccurrencePair])
def get_co_occurrences(
    min_count: int = Query(default=2, ge=1, description="Minimum co-occurrence count to include"),
    folder_id: Optional[UUID] = Query(default=None, description="Filter by folder ID"),
    db: Session = Depends(get_db),
):
    """
    Return all thinker pairs that co-occur in notes, with frequency counts.

    Joins with the connections table to mark which pairs already have connections.
    Ordered by total co-occurrence count descending.
    """
    ThinkerA = aliased(Thinker, name="thinker_a")
    ThinkerB = aliased(Thinker, name="thinker_b")

    # Base query: aggregate co-occurrences by thinker pair
    co_occ_query = db.query(
        ThinkerCoOccurrence.thinker_a_id,
        ThinkerCoOccurrence.thinker_b_id,
        func.count(ThinkerCoOccurrence.id).label("co_occurrence_count"),
        func.sum(
            case(
                (ThinkerCoOccurrence.co_occurrence_type == "same_paragraph", 1),
                else_=0,
            )
        ).label("same_paragraph_count"),
    )

    # Optional folder filter: join with notes table
    if folder_id is not None:
        co_occ_query = co_occ_query.join(
            Note, ThinkerCoOccurrence.note_id == Note.id
        ).filter(Note.folder_id == folder_id)

    co_occ_query = co_occ_query.group_by(
        ThinkerCoOccurrence.thinker_a_id,
        ThinkerCoOccurrence.thinker_b_id,
    ).having(
        func.count(ThinkerCoOccurrence.id) >= min_count
    )

    co_occ_subquery = co_occ_query.subquery("co_occ")

    # Main query: join with thinkers for names and connections for existing status
    # Check for existing connections in either direction
    existing_conn = db.query(
        Connection.from_thinker_id,
        Connection.to_thinker_id,
        Connection.connection_type,
    ).subquery("existing_conn")

    results = db.query(
        co_occ_subquery.c.thinker_a_id,
        ThinkerA.name.label("thinker_a_name"),
        ThinkerA.birth_year.label("thinker_a_birth_year"),
        ThinkerA.death_year.label("thinker_a_death_year"),
        co_occ_subquery.c.thinker_b_id,
        ThinkerB.name.label("thinker_b_name"),
        ThinkerB.birth_year.label("thinker_b_birth_year"),
        ThinkerB.death_year.label("thinker_b_death_year"),
        co_occ_subquery.c.co_occurrence_count,
        co_occ_subquery.c.same_paragraph_count,
    ).join(
        ThinkerA, co_occ_subquery.c.thinker_a_id == ThinkerA.id
    ).join(
        ThinkerB, co_occ_subquery.c.thinker_b_id == ThinkerB.id
    ).order_by(
        co_occ_subquery.c.co_occurrence_count.desc()
    ).all()

    # Check for existing connections for each pair
    response = []
    for row in results:
        # Check both directions: A->B or B->A
        existing = db.query(Connection).filter(
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
        ).first()

        response.append(CoOccurrencePair(
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
                existing.connection_type.value if existing else None
            ),
        ))

    return response


# ---------------------------------------------------------------------------
# GET /api/analysis/connection-suggestions
# ---------------------------------------------------------------------------

@router.get("/connection-suggestions", response_model=List[ConnectionSuggestionFromNotes])
def get_connection_suggestions(
    limit: int = Query(default=10, ge=1, le=50, description="Max suggestions to return"),
    folder_id: Optional[UUID] = Query(default=None, description="Filter by folder ID"),
    db: Session = Depends(get_db),
):
    """
    Return top thinker pairs that co-occur frequently but DON'T have existing connections.

    This is the primary endpoint consumed by the ConnectionSuggestionsPanel on the frontend.
    Results include sample note titles and excerpts for context, plus a confidence level.
    """
    ThinkerA = aliased(Thinker, name="thinker_a")
    ThinkerB = aliased(Thinker, name="thinker_b")

    # Step 1: Aggregate co-occurrences
    co_occ_query = db.query(
        ThinkerCoOccurrence.thinker_a_id,
        ThinkerCoOccurrence.thinker_b_id,
        func.count(ThinkerCoOccurrence.id).label("co_occurrence_count"),
        func.sum(
            case(
                (ThinkerCoOccurrence.co_occurrence_type == "same_paragraph", 1),
                else_=0,
            )
        ).label("same_paragraph_count"),
    )

    if folder_id is not None:
        co_occ_query = co_occ_query.join(
            Note, ThinkerCoOccurrence.note_id == Note.id
        ).filter(Note.folder_id == folder_id)

    co_occ_query = co_occ_query.group_by(
        ThinkerCoOccurrence.thinker_a_id,
        ThinkerCoOccurrence.thinker_b_id,
    ).having(
        func.count(ThinkerCoOccurrence.id) >= 2  # At least 2 co-occurrences
    )

    co_occ_subquery = co_occ_query.subquery("co_occ")

    # Step 2: Join with thinkers
    results = db.query(
        co_occ_subquery.c.thinker_a_id,
        ThinkerA.name.label("thinker_a_name"),
        ThinkerA.birth_year.label("thinker_a_birth_year"),
        ThinkerA.death_year.label("thinker_a_death_year"),
        co_occ_subquery.c.thinker_b_id,
        ThinkerB.name.label("thinker_b_name"),
        ThinkerB.birth_year.label("thinker_b_birth_year"),
        ThinkerB.death_year.label("thinker_b_death_year"),
        co_occ_subquery.c.co_occurrence_count,
        co_occ_subquery.c.same_paragraph_count,
    ).join(
        ThinkerA, co_occ_subquery.c.thinker_a_id == ThinkerA.id
    ).join(
        ThinkerB, co_occ_subquery.c.thinker_b_id == ThinkerB.id
    ).order_by(
        co_occ_subquery.c.co_occurrence_count.desc()
    ).all()

    # Step 3: Filter out pairs that already have connections, build response
    suggestions: list[ConnectionSuggestionFromNotes] = []

    for row in results:
        if len(suggestions) >= limit:
            break

        # Check if connection already exists (either direction)
        existing = db.query(Connection).filter(
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
        ).first()

        if existing is not None:
            continue  # Skip pairs that already have connections

        # Step 4: Fetch sample note titles where they co-occur
        sample_notes_query = db.query(
            Note.title,
            Note.content,
        ).join(
            ThinkerCoOccurrence, ThinkerCoOccurrence.note_id == Note.id
        ).filter(
            ThinkerCoOccurrence.thinker_a_id == row.thinker_a_id,
            ThinkerCoOccurrence.thinker_b_id == row.thinker_b_id,
        ).distinct().limit(5)

        sample_notes = sample_notes_query.all()

        sample_titles = []
        sample_excerpts = []

        for note in sample_notes:
            title = note.title or "Untitled Note"
            if title not in sample_titles:
                sample_titles.append(title)

            # Extract a ~200-char excerpt containing both thinker names
            excerpt = _extract_co_occurrence_excerpt(
                content=note.content,
                name_a=row.thinker_a_name,
                name_b=row.thinker_b_name,
                max_length=200,
            )
            if excerpt and excerpt not in sample_excerpts:
                sample_excerpts.append(excerpt)

        # Limit to 3 sample titles and excerpts
        sample_titles = sample_titles[:3]
        sample_excerpts = sample_excerpts[:3]

        # Step 5: Determine confidence level
        count = row.co_occurrence_count
        if count > 10:
            confidence = "high"
        elif count >= 5:
            confidence = "medium"
        else:
            confidence = "low"

        suggestions.append(ConnectionSuggestionFromNotes(
            thinker_a_id=row.thinker_a_id,
            thinker_a_name=row.thinker_a_name,
            thinker_a_birth_year=row.thinker_a_birth_year,
            thinker_a_death_year=row.thinker_a_death_year,
            thinker_b_id=row.thinker_b_id,
            thinker_b_name=row.thinker_b_name,
            thinker_b_birth_year=row.thinker_b_birth_year,
            thinker_b_death_year=row.thinker_b_death_year,
            co_occurrence_count=count,
            same_paragraph_count=row.same_paragraph_count,
            sample_note_titles=sample_titles,
            sample_excerpts=sample_excerpts,
            confidence=confidence,
        ))

    return suggestions


# ---------------------------------------------------------------------------
# Helper: extract excerpt showing both thinker names
# ---------------------------------------------------------------------------

def _extract_co_occurrence_excerpt(
    content: str,
    name_a: str,
    name_b: str,
    max_length: int = 200,
) -> Optional[str]:
    """
    Find the shortest window in `content` that contains both `name_a` and `name_b`,
    then return a ~max_length excerpt centered on that window.

    If both names are not found in the content, returns None.
    """
    if not content:
        return None

    content_lower = content.lower()
    name_a_lower = name_a.lower()
    name_b_lower = name_b.lower()

    # Find all positions of each name
    positions_a = []
    start = 0
    while True:
        idx = content_lower.find(name_a_lower, start)
        if idx == -1:
            break
        positions_a.append(idx)
        start = idx + 1

    positions_b = []
    start = 0
    while True:
        idx = content_lower.find(name_b_lower, start)
        if idx == -1:
            break
        positions_b.append(idx)
        start = idx + 1

    if not positions_a or not positions_b:
        return None

    # Find the pair of positions with the smallest distance
    best_start = 0
    best_end = len(content)
    best_span = best_end - best_start

    for pos_a in positions_a:
        for pos_b in positions_b:
            span_start = min(pos_a, pos_b)
            span_end = max(pos_a + len(name_a), pos_b + len(name_b))
            span = span_end - span_start
            if span < best_span:
                best_span = span
                best_start = span_start
                best_end = span_end

    # Expand to max_length, centered on the span
    padding = max(0, (max_length - best_span) // 2)
    excerpt_start = max(0, best_start - padding)
    excerpt_end = min(len(content), best_end + padding)

    # Adjust to not exceed max_length
    if excerpt_end - excerpt_start > max_length:
        excerpt_end = excerpt_start + max_length

    excerpt = content[excerpt_start:excerpt_end].strip()

    # Add ellipsis if truncated
    if excerpt_start > 0:
        excerpt = "..." + excerpt
    if excerpt_end < len(content):
        excerpt = excerpt + "..."

    # Clean up: collapse whitespace, remove partial words at boundaries
    import re
    excerpt = re.sub(r'\s+', ' ', excerpt)

    return excerpt
```

**Imports to add at the top of the existing `analysis.py` file:**

```python
from sqlalchemy.orm import aliased
from sqlalchemy import func, and_, or_, case
from app.models.thinker_mention import ThinkerCoOccurrence
from app.models.thinker import Thinker
from app.models.connection import Connection
from app.models.note import Note
from app.schemas.analysis import CoOccurrencePair, ConnectionSuggestionFromNotes
```

---

## 5. Frontend: TypeScript Interfaces

**File:** `frontend/src/types/index.ts` (MODIFY -- add after the ResearchQuestion types section, before the Quiz Types section)

```typescript
// Co-occurrence and connection suggestion types (Plan 8)

export interface CoOccurrencePair {
  thinker_a_id: string
  thinker_a_name: string
  thinker_a_birth_year?: number | null
  thinker_a_death_year?: number | null
  thinker_b_id: string
  thinker_b_name: string
  thinker_b_birth_year?: number | null
  thinker_b_death_year?: number | null
  co_occurrence_count: number
  same_paragraph_count: number
  has_existing_connection: boolean
  existing_connection_type?: string | null
}

export interface ConnectionSuggestionFromNotes {
  thinker_a_id: string
  thinker_a_name: string
  thinker_a_birth_year?: number | null
  thinker_a_death_year?: number | null
  thinker_b_id: string
  thinker_b_name: string
  thinker_b_birth_year?: number | null
  thinker_b_death_year?: number | null
  co_occurrence_count: number
  same_paragraph_count: number
  sample_note_titles: string[]
  sample_excerpts: string[]
  confidence: 'high' | 'medium' | 'low'
}
```

**Diff:**

```diff
--- a/frontend/src/types/index.ts
+++ b/frontend/src/types/index.ts
@@ -516,6 +516,38 @@
   high_priority: number
   medium_priority: number
 }

+// Co-occurrence and connection suggestion types (Plan 8)
+
+export interface CoOccurrencePair {
+  thinker_a_id: string
+  thinker_a_name: string
+  thinker_a_birth_year?: number | null
+  thinker_a_death_year?: number | null
+  thinker_b_id: string
+  thinker_b_name: string
+  thinker_b_birth_year?: number | null
+  thinker_b_death_year?: number | null
+  co_occurrence_count: number
+  same_paragraph_count: number
+  has_existing_connection: boolean
+  existing_connection_type?: string | null
+}
+
+export interface ConnectionSuggestionFromNotes {
+  thinker_a_id: string
+  thinker_a_name: string
+  thinker_a_birth_year?: number | null
+  thinker_a_death_year?: number | null
+  thinker_b_id: string
+  thinker_b_name: string
+  thinker_b_birth_year?: number | null
+  thinker_b_death_year?: number | null
+  co_occurrence_count: number
+  same_paragraph_count: number
+  sample_note_titles: string[]
+  sample_excerpts: string[]
+  confidence: 'high' | 'medium' | 'low'
+}
+
 // ============ Quiz Types ============
```

---

## 6. Frontend: API Client

**File:** `frontend/src/lib/api.ts` (MODIFY)

### 6a. Add type imports

In the type import block at the top of the file, add:

```typescript
import type {
  // ... existing imports ...
  CoOccurrencePair,
  ConnectionSuggestionFromNotes,
} from '@/types'
```

### 6b. Extend existing analysisApi

If Plan 7 already added `analysisApi`, extend that same object with the methods below. Do not create a second `analysisApi` export.

```typescript
// Analysis API (co-occurrence and connection suggestions)
export const analysisApi = {
  // Existing Plan 7 method should remain:
  // getTermThinkerMatrix(...)

  getCoOccurrences: async (filters?: {
    min_count?: number
    folder_id?: string
  }): Promise<CoOccurrencePair[]> => {
    const response = await api.get('/api/analysis/co-occurrences', { params: filters })
    return response.data
  },

  getConnectionSuggestions: async (filters?: {
    limit?: number
    folder_id?: string
  }): Promise<ConnectionSuggestionFromNotes[]> => {
    const response = await api.get('/api/analysis/connection-suggestions', { params: filters })
    return response.data
  },
}
```

Keep all analysis methods consolidated in one exported object.

---

## 7. Frontend: ConnectionSuggestionsPanel Component

**File:** `frontend/src/components/notes/ConnectionSuggestionsPanel.tsx` (NEW)

This is the primary UI component for Plan 8. It renders in the right panel of the `/notes` page as a "Connections" tab.

```tsx
'use client'

import { useState, useCallback, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { analysisApi } from '@/lib/api'
import { AddConnectionModal } from '@/components/AddConnectionModal'
import type { ConnectionSuggestionFromNotes } from '@/types'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ConnectionSuggestionsPanelProps {
  folderId?: string | null  // Optional folder filter
}

// ---------------------------------------------------------------------------
// Confidence badge colors
// ---------------------------------------------------------------------------

const CONFIDENCE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  high: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    label: 'High',
  },
  medium: {
    bg: 'bg-amber-100',
    text: 'text-amber-800',
    label: 'Medium',
  },
  low: {
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    label: 'Low',
  },
}

// ---------------------------------------------------------------------------
// Local storage key for dismissed suggestions
// ---------------------------------------------------------------------------

const DISMISSED_KEY = 'connection-suggestions-dismissed'

function getDismissedPairs(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const stored = localStorage.getItem(DISMISSED_KEY)
    if (stored) {
      return new Set(JSON.parse(stored) as string[])
    }
  } catch {
    // Ignore parse errors
  }
  return new Set()
}

function dismissPair(pairKey: string): void {
  const dismissed = getDismissedPairs()
  dismissed.add(pairKey)
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed]))
}

function undismissAll(): void {
  localStorage.removeItem(DISMISSED_KEY)
}

function pairKey(a_id: string, b_id: string): string {
  // Consistent ordering so (A,B) and (B,A) produce the same key
  return [a_id, b_id].sort().join('::')
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ConnectionSuggestionsPanel({ folderId }: ConnectionSuggestionsPanelProps) {
  const queryClient = useQueryClient()

  // Local state
  const [dismissedPairs, setDismissedPairs] = useState<Set<string>>(new Set())
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  // Modal state for creating connections
  const [connectionModal, setConnectionModal] = useState<{
    isOpen: boolean
    fromThinkerId: string | null
    toThinkerId: string | null
  }>({
    isOpen: false,
    fromThinkerId: null,
    toThinkerId: null,
  })

  // Load dismissed pairs from localStorage on mount
  useEffect(() => {
    setDismissedPairs(getDismissedPairs())
  }, [])

  // Fetch suggestions
  const {
    data: suggestions = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['connection-suggestions', folderId],
    queryFn: () =>
      analysisApi.getConnectionSuggestions({
        limit: 20,
        folder_id: folderId || undefined,
      }),
    refetchOnWindowFocus: false,
    staleTime: 30_000, // 30 seconds
  })

  // Filter out dismissed suggestions
  const visibleSuggestions = suggestions.filter(
    (s) => !dismissedPairs.has(pairKey(s.thinker_a_id, s.thinker_b_id))
  )

  // Handlers
  const handleDismiss = useCallback((suggestion: ConnectionSuggestionFromNotes) => {
    const key = pairKey(suggestion.thinker_a_id, suggestion.thinker_b_id)
    dismissPair(key)
    setDismissedPairs((prev) => new Set([...prev, key]))
  }, [])

  const handleCreateConnection = useCallback((suggestion: ConnectionSuggestionFromNotes) => {
    setConnectionModal({
      isOpen: true,
      fromThinkerId: suggestion.thinker_a_id,
      toThinkerId: suggestion.thinker_b_id,
    })
  }, [])

  const handleConnectionModalClose = useCallback(() => {
    setConnectionModal({ isOpen: false, fromThinkerId: null, toThinkerId: null })

    // Invalidate queries so suggestions refresh (newly connected pairs disappear)
    queryClient.invalidateQueries({ queryKey: ['connection-suggestions'] })
    queryClient.invalidateQueries({ queryKey: ['connections'] })
  }, [queryClient])

  const handleUndismissAll = useCallback(() => {
    undismissAll()
    setDismissedPairs(new Set())
  }, [])

  // Thinker year display helper
  const yearRange = (birthYear?: number | null, deathYear?: number | null): string => {
    if (!birthYear && !deathYear) return ''
    if (birthYear && deathYear) return `(${birthYear}-${deathYear})`
    if (birthYear) return `(b. ${birthYear})`
    return `(d. ${deathYear})`
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-timeline">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-sans font-semibold text-primary uppercase tracking-wide">
              Connection Suggestions
            </h3>
            {visibleSuggestions.length > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-mono font-medium text-white bg-accent rounded-full">
                {visibleSuggestions.length}
              </span>
            )}
          </div>
          {dismissedPairs.size > 0 && (
            <button
              onClick={handleUndismissAll}
              className="text-xs font-sans text-gray-400 hover:text-accent transition-colors"
              title="Show dismissed suggestions"
            >
              Reset dismissed
            </button>
          )}
        </div>
        <p className="text-xs font-sans text-secondary mt-1">
          Based on thinkers mentioned together in your notes
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Loading state */}
        {isLoading && (
          <div className="px-4 py-8 text-center">
            <div className="inline-block w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-sans text-secondary mt-2">Analyzing co-occurrences...</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="px-4 py-6 text-center">
            <p className="text-sm font-sans text-red-600">
              Failed to load suggestions. Please try again.
            </p>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && visibleSuggestions.length === 0 && (
          <div className="px-4 py-8 text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-10 w-10 mx-auto text-gray-300 mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
            <p className="text-sm font-sans text-secondary">
              No connection suggestions yet.
            </p>
            <p className="text-xs font-sans text-gray-400 mt-1">
              Write more notes mentioning multiple thinkers to see suggestions here.
            </p>
          </div>
        )}

        {/* Suggestion cards */}
        {visibleSuggestions.map((suggestion, index) => {
          const key = pairKey(suggestion.thinker_a_id, suggestion.thinker_b_id)
          const isExpanded = expandedIndex === index
          const confidenceStyle = CONFIDENCE_STYLES[suggestion.confidence]

          return (
            <div
              key={key}
              className="border-b border-timeline px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              {/* Thinker pair header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-serif text-sm font-semibold text-primary truncate">
                      {suggestion.thinker_a_name}
                    </span>
                    <span className="text-xs font-mono text-gray-400">
                      {yearRange(suggestion.thinker_a_birth_year, suggestion.thinker_a_death_year)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 my-0.5">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-3 w-3 text-accent"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                      />
                    </svg>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-serif text-sm font-semibold text-primary truncate">
                      {suggestion.thinker_b_name}
                    </span>
                    <span className="text-xs font-mono text-gray-400">
                      {yearRange(suggestion.thinker_b_birth_year, suggestion.thinker_b_death_year)}
                    </span>
                  </div>
                </div>

                {/* Confidence badge */}
                <span
                  className={`flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-sans font-medium ${confidenceStyle.bg} ${confidenceStyle.text}`}
                >
                  {confidenceStyle.label}
                </span>
              </div>

              {/* Stats line */}
              <div className="mt-2 flex items-center gap-3 text-xs font-sans text-secondary">
                <span>
                  Mentioned together{' '}
                  <strong className="text-primary">{suggestion.co_occurrence_count}</strong>{' '}
                  time{suggestion.co_occurrence_count !== 1 ? 's' : ''}
                  {' '}in{' '}
                  <strong className="text-primary">{suggestion.sample_note_titles.length}</strong>{' '}
                  note{suggestion.sample_note_titles.length !== 1 ? 's' : ''}
                </span>
                {suggestion.same_paragraph_count > 0 && (
                  <span className="text-accent">
                    ({suggestion.same_paragraph_count} in same paragraph)
                  </span>
                )}
              </div>

              {/* Expandable excerpts */}
              {suggestion.sample_excerpts.length > 0 && (
                <button
                  onClick={() => setExpandedIndex(isExpanded ? null : index)}
                  className="mt-1.5 text-xs font-sans text-accent hover:text-accent/80 transition-colors flex items-center gap-1"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {isExpanded ? 'Hide excerpts' : 'Show excerpts'}
                </button>
              )}

              {isExpanded && suggestion.sample_excerpts.length > 0 && (
                <div className="mt-2 space-y-2">
                  {suggestion.sample_excerpts.map((excerpt, i) => (
                    <div
                      key={i}
                      className="bg-gray-50 border border-timeline rounded p-2 text-xs font-serif text-secondary italic leading-relaxed"
                    >
                      {excerpt}
                    </div>
                  ))}
                  {suggestion.sample_note_titles.length > 0 && (
                    <div className="text-xs font-sans text-gray-400">
                      From: {suggestion.sample_note_titles.join(', ')}
                    </div>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => handleCreateConnection(suggestion)}
                  className="inline-flex items-center gap-1 text-xs font-sans font-medium text-white bg-accent hover:bg-accent/90 px-3 py-1.5 rounded transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3.5 w-3.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Create Connection
                </button>
                <button
                  onClick={() => handleDismiss(suggestion)}
                  className="inline-flex items-center text-xs font-sans text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded transition-colors"
                  title="Dismiss this suggestion"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* AddConnectionModal -- reused from existing codebase */}
      <AddConnectionModal
        isOpen={connectionModal.isOpen}
        onClose={handleConnectionModalClose}
        fromThinkerId={connectionModal.fromThinkerId}
        toThinkerId={connectionModal.toThinkerId}
      />
    </div>
  )
}
```

---

## 8. Frontend: Integration with Notes Page

**File:** `frontend/src/app/notes/page.tsx` (MODIFY -- Plan 3 creates this page)

Plan 3 creates the `/notes` page with a right panel that has tab navigation. This modification adds a "Connections" tab alongside existing tabs (e.g., "Definition", "Constellation").

### 8a. Add import

```typescript
import { ConnectionSuggestionsPanel } from '@/components/notes/ConnectionSuggestionsPanel'
import { useQuery } from '@tanstack/react-query'
import { analysisApi } from '@/lib/api'
```

### 8b. Add state for the tab

In the component's state declarations, use the shared right-panel mode state:

```typescript
const [rightPanelMode, setRightPanelMode] = useState<
  'none' | 'definition' | 'constellation' | 'connections'
>('none')
```

### 8c. Fetch suggestion count for badge

Add a query to get the suggestion count for the badge:

```typescript
const { data: connectionSuggestions = [] } = useQuery({
  queryKey: ['connection-suggestions', selectedFolderId],
  queryFn: () =>
    analysisApi.getConnectionSuggestions({
      limit: 20,
      folder_id: selectedFolderId && selectedFolderId !== 'unfiled'
        ? selectedFolderId
        : undefined,
    }),
  staleTime: 30_000,
})
```

### 8d. Add tab button in the right panel tab bar

In the right panel tab bar JSX, add:

```tsx
<button
  onClick={() => setRightPanelMode('connections')}
  className={`relative px-3 py-2 text-sm font-sans transition-colors ${
    rightPanelMode === 'connections'
      ? 'text-accent border-b-2 border-accent font-medium'
      : 'text-secondary hover:text-primary'
  }`}
>
  Connections
  {connectionSuggestions.length > 0 && (
    <span className="absolute -top-1 -right-1 inline-flex items-center justify-center w-4 h-4 text-[10px] font-mono font-medium text-white bg-accent rounded-full">
      {connectionSuggestions.length}
    </span>
  )}
</button>
```

### 8e. Render the panel content

In the right panel content area, add the conditional render:

```tsx
{rightPanelMode === 'connections' && (
  <ConnectionSuggestionsPanel
    folderId={
      selectedFolderId && selectedFolderId !== 'unfiled'
        ? selectedFolderId
        : undefined
    }
  />
)}
```

**Full diff sketch for the right panel area:**

```diff
--- a/frontend/src/app/notes/page.tsx
+++ b/frontend/src/app/notes/page.tsx
@@ imports
+import { ConnectionSuggestionsPanel } from '@/components/notes/ConnectionSuggestionsPanel'
+import { analysisApi } from '@/lib/api'

@@ state declarations
+const [rightPanelMode, setRightPanelMode] = useState<'none' | 'definition' | 'constellation' | 'connections'>('none')

@@ after other queries
+  const { data: connectionSuggestions = [] } = useQuery({
+    queryKey: ['connection-suggestions', selectedFolderId],
+    queryFn: () =>
+      analysisApi.getConnectionSuggestions({
+        limit: 20,
+        folder_id: selectedFolderId && selectedFolderId !== 'unfiled'
+          ? selectedFolderId
+          : undefined,
+      }),
+    staleTime: 30_000,
+  })

@@ right panel tab bar
+          <button
+            onClick={() => setRightPanelMode('connections')}
+            className={`relative px-3 py-2 text-sm font-sans transition-colors ${
+              rightPanelMode === 'connections'
+                ? 'text-accent border-b-2 border-accent font-medium'
+                : 'text-secondary hover:text-primary'
+            }`}
+          >
+            Connections
+            {connectionSuggestions.length > 0 && (
+              <span className="absolute -top-1 -right-1 inline-flex items-center justify-center w-4 h-4 text-[10px] font-mono font-medium text-white bg-accent rounded-full">
+                {connectionSuggestions.length}
+              </span>
+            )}
+          </button>

@@ right panel content
+          {rightPanelMode === 'connections' && (
+            <ConnectionSuggestionsPanel
+              folderId={
+                selectedFolderId && selectedFolderId !== 'unfiled'
+                  ? selectedFolderId
+                  : undefined
+              }
+            />
+          )}
```

---

## 9. Data Flow Summary

This diagram shows how data flows from note authoring to connection suggestions:

```
                    Stephanie writes a note
                            |
                            v
              Note saved (POST /api/notes/)
                            |
                            v
          Plan 4: detect_thinkers_in_note()
                  |                    |
                  v                    v
         ThinkerMention          ThinkerMention
         (James, para 2)        (Peirce, para 2)
                  |                    |
                  +--------+-----------+
                           |
                           v
              Plan 8: compute_co_occurrences()
                           |
                  +--------+-----------+
                  |                    |
                  v                    v
         ThinkerCoOccurrence    ThinkerCoOccurrence
         (James-Peirce,        (James-Peirce,
          para 2,               NULL,
          same_paragraph)       same_note)

     ===== Later, when Stephanie opens the Connections tab =====

          GET /api/analysis/connection-suggestions
                           |
                           v
              Aggregate co-occurrences per pair
              Filter out pairs with existing connections
              Rank by count, add excerpts + confidence
                           |
                           v
              ConnectionSuggestionsPanel renders cards
                           |
           +---------------+---------------+
           |                               |
           v                               v
    "Create Connection"              "Dismiss"
           |                         (localStorage)
           v
    AddConnectionModal (pre-filled)
           |
           v
    POST /api/connections/
           |
           v
    Connection appears on timeline canvas
    Suggestion disappears from list
```

---

## 10. Verification Steps

### 10.1 Backend Verification

**Prerequisites:** Plans 1, 4, and 7 must be complete. The database must have the `thinker_co_occurrences` table.

**Step 1 -- Create test data:**

```bash
# Ensure thinkers exist
curl -s http://localhost:8010/api/thinkers/ | python3 -m json.tool | grep -A2 '"name"'
# Should include "William James" and "Charles Sanders Peirce" (or create them)
```

**Step 2 -- Create notes that mention both thinkers:**

```bash
# Note 1: James and Peirce in same paragraph
curl -X POST http://localhost:8010/api/notes/ \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Pragmatism Lecture Notes",
    "content": "William James developed his theory of pragmatism building on the foundations laid by Charles Sanders Peirce. Both were members of the Metaphysical Club at Harvard.\n\nThis separate paragraph discusses other topics."
  }'

# Note 2: James and Peirce in different paragraphs
curl -X POST http://localhost:8010/api/notes/ \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Harvard Philosophy History",
    "content": "William James was one of the most influential American philosophers.\n\nCharles Sanders Peirce is considered the founder of pragmatism.\n\nAugustine had no direct connection to pragmatism."
  }'

# Note 3: James and Augustine in same note
curl -X POST http://localhost:8010/api/notes/ \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Free Will Across Eras",
    "content": "Augustine wrote extensively about free will in his Confessions.\n\nWilliam James also addressed free will in The Principles of Psychology."
  }'
```

**Step 3 -- Run thinker detection on each note (Plan 4 endpoint):**

```bash
# These endpoints are from Plan 4. After detection, co-occurrences are computed.
curl -X POST http://localhost:8010/api/notes/<NOTE1_ID>/detect-thinkers
curl -X POST http://localhost:8010/api/notes/<NOTE2_ID>/detect-thinkers
curl -X POST http://localhost:8010/api/notes/<NOTE3_ID>/detect-thinkers
```

**Step 4 -- Verify co-occurrences:**

```bash
curl -s http://localhost:8010/api/analysis/co-occurrences?min_count=1 | python3 -m json.tool
```

Expected output: James-Peirce pair with `co_occurrence_count >= 3` and `same_paragraph_count >= 1`. James-Augustine pair with lower count.

**Step 5 -- Verify connection suggestions:**

```bash
curl -s http://localhost:8010/api/analysis/connection-suggestions?limit=10 | python3 -m json.tool
```

Expected: James-Peirce ranked highest (more co-occurrences), James-Augustine lower. Neither should have `has_existing_connection: true`. Should include `sample_note_titles` and `sample_excerpts`.

**Step 6 -- Create a connection and verify it disappears from suggestions:**

```bash
# Create connection James -> Peirce
curl -X POST http://localhost:8010/api/connections/ \
  -H "Content-Type: application/json" \
  -d '{
    "from_thinker_id": "<JAMES_ID>",
    "to_thinker_id": "<PEIRCE_ID>",
    "connection_type": "influenced"
  }'

# Verify suggestion is gone
curl -s http://localhost:8010/api/analysis/connection-suggestions?limit=10 | python3 -m json.tool
# James-Peirce should no longer appear
```

### 10.2 Frontend Verification

1. Navigate to `/notes` in the browser.
2. Click the "Connections" tab in the right panel.
3. See the badge count on the tab showing number of suggestions.
4. See "William James" and "Charles Sanders Peirce" as the top suggestion card with "High" confidence badge.
5. See "Mentioned together N times in M notes" stats.
6. See "(K in same paragraph)" sub-stat in accent color.
7. Click "Show excerpts" to expand the card and see context snippets.
8. See "William James" and "Augustine" as a lower-ranked suggestion with "Medium" or "Low" confidence.
9. Click "Create Connection" on the James-Peirce card.
10. AddConnectionModal opens with "William James" as from-thinker and "Charles Sanders Peirce" as to-thinker, both pre-filled and shown in the accent banner.
11. Select "influenced" as connection type, optionally add notes, click "Add Connection".
12. Modal closes. The suggestion card updates to show "Connected! (influenced)" in green.
13. Navigate to the timeline canvas (home page) and verify the James-Peirce connection line is visible.
14. Return to `/notes` Connections tab: the James-Peirce pair no longer appears in suggestions.
15. Click "Dismiss" on the James-Augustine suggestion. It disappears from the list.
16. Click "Reset dismissed" link in the header. The James-Augustine card reappears.

---

## 11. Connection to Existing App

This plan is the capstone of the 8-plan suite. It bridges the notes world back to the timeline canvas:

| Existing Component | How Plan 8 Interacts |
|---|---|
| **AddConnectionModal** (`frontend/src/components/AddConnectionModal.tsx`) | Reused directly. Opened with pre-filled `fromThinkerId` and `toThinkerId` props. No modifications needed. |
| **Connection model** (`backend/app/models/connection.py`) | Connections created via suggestions are standard Connection records. They appear on the canvas like any manually created connection. |
| **Timeline canvas** (`frontend/src/components/TimelineSVG.tsx`) | React Query cache invalidation ensures the canvas re-fetches connections after a suggestion is accepted. |
| **ThinkerCoOccurrence model** (`backend/app/models/thinker_mention.py`) | Created in Plan 1, populated by the `compute_co_occurrences` utility in this plan. |
| **Analysis routes** (`backend/app/routes/analysis.py`) | Created in Plan 7 with constellation endpoints. This plan adds co-occurrence and suggestion endpoints to the same router. |
| **React Query** | Queries use keys `['connection-suggestions']` and `['connections']`. Invalidation after creating a connection ensures both the suggestions panel and the canvas stay in sync. |

---

## 12. File Summary

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `backend/app/utils/thinker_detection.py` | Add `compute_co_occurrences()` function |
| MODIFY | `backend/app/schemas/analysis.py` | Extend shared analysis schemas with Plan 8 models |
| MODIFY | `backend/app/schemas/__init__.py` | Register analysis schemas |
| MODIFY | `backend/app/routes/analysis.py` | Add `/co-occurrences` and `/connection-suggestions` endpoints |
| MODIFY | `frontend/src/types/index.ts` | Add `CoOccurrencePair` and `ConnectionSuggestionFromNotes` interfaces |
| MODIFY | `frontend/src/lib/api.ts` | Extend existing `analysisApi` with two methods |
| CREATE | `frontend/src/components/notes/ConnectionSuggestionsPanel.tsx` | Full suggestion panel UI component |
| MODIFY | `frontend/src/app/notes/page.tsx` | Add "Connections" tab to right panel |

**Total: 0 new backend files, 1 new frontend file, 4 modified backend files, 3 modified frontend files.**

---

## 13. Dependencies

### Direct Dependencies (must be complete)

| Dependency | What it provides | Why we need it |
|---|---|---|
| **Plan 1** | `ThinkerCoOccurrence` model, `thinker_co_occurrences` table | Data storage for co-occurrence records |
| **Plan 4** | `ThinkerMention` records, `detect_thinkers_in_note` endpoint | Source data: detected thinker names and positions in notes |
| **Plan 7** | `backend/app/routes/analysis.py` with `/api/analysis/` prefix | Router to add new endpoints to |

### Indirect Dependencies (transitively required)

| Dependency | Via | Why |
|---|---|---|
| **Plan 3** | Plan 4, Plan 7 | Notes page exists at `/notes` for the right panel integration |

### No Dependency On

- Plan 2 (Folder system) -- though folder filtering is supported, it is optional
- Plan 5 (Critical terms) -- no interaction
- Plan 6 (Term definitions) -- no interaction

---

## 14. Design Decisions

### Why co-occurrence counts, not AI-powered suggestions?

The co-occurrence approach matches Stephanie's stated need: "If I'm writing about William James, and then over here I'm writing about Charles Sanders Peirce, I want it to automatically make the jump that those two people are related." The signal comes directly from her writing patterns, not from external knowledge. This means:

- Zero LLM cost for suggestions
- Results are explainable (she can see the excerpts where they co-occur)
- No risk of hallucinated connections
- Suggestions improve organically as she writes more notes

The existing AI-powered `aiApi.suggestConnections()` (in `lib/api.ts`) uses DeepSeek for LLM-based suggestions. Plan 8's co-occurrence suggestions are complementary, not a replacement. They could eventually be shown side-by-side in the UI.

### Why `thinker_a_id < thinker_b_id` ordering?

Without a canonical ordering, the pair (James, Peirce) and (Peirce, James) would be stored as separate rows, making aggregation queries more complex and the unique constraint ineffective. By always storing the smaller UUID first, we guarantee:
- One row per pair per note per paragraph
- Simple `GROUP BY` aggregation
- The unique constraint catches true duplicates

### Why dismiss to localStorage instead of the database?

Dismissed suggestions are a UI preference, not research data. Storing them in localStorage:
- Avoids adding a database table for user preferences
- Works immediately without an API call
- Can be cleared with one click ("Reset dismissed")
- Persists across page navigations but is device-specific

If multi-device support is needed in the future, this can be migrated to a `dismissed_suggestions` table.

### Why separate `same_paragraph` and `same_note` co-occurrence types?

Same-paragraph co-occurrence is a much stronger signal than same-note co-occurrence. If Stephanie mentions James and Peirce in the same paragraph, they are almost certainly discussed in relation to each other. If they appear in the same note but different paragraphs, the connection is weaker. The UI displays both counts so Stephanie can judge the strength herself.

---

## 15. Execution Checklist

- [ ] Add `compute_co_occurrences()` to `backend/app/utils/thinker_detection.py`
- [ ] Extend `backend/app/schemas/analysis.py` with both Plan 8 schemas
- [ ] Modify `backend/app/schemas/__init__.py` to register analysis schemas
- [ ] Add co-occurrence and suggestion endpoints to `backend/app/routes/analysis.py`
- [ ] Add imports to `analysis.py` for new models and schemas
- [ ] Integrate `compute_co_occurrences()` call into Plan 4's thinker detection endpoint
- [ ] Add `CoOccurrencePair` and `ConnectionSuggestionFromNotes` to `frontend/src/types/index.ts`
- [ ] Extend existing `analysisApi` in `frontend/src/lib/api.ts`
- [ ] Create `frontend/src/components/notes/ConnectionSuggestionsPanel.tsx`
- [ ] Modify `frontend/src/app/notes/page.tsx` to add Connections tab
- [ ] Run backend: `cd backend && uvicorn app.main:app --reload --port 8010`
- [ ] Run frontend: `cd frontend && npm run dev`
- [ ] Run verification steps (sections 10.1 and 10.2)
- [ ] Run existing tests to confirm no regressions: `cd backend && pytest`
- [ ] Run frontend type check: `cd frontend && npm run type-check`
