# Plan 5: Critical Terms System

## Goal

Implement term flagging, cross-note occurrence tracking, and in-editor highlighting of critical terms. Stephanie can flag any philosophical or domain-specific term (e.g., "habit", "Dasein", "praxis") as a critical term. The system then scans ALL notes for occurrences of that term, records each match with a context snippet, and highlights occurrences in the TipTap editor in real time.

---

## Dependencies

- **Plan 1** (Data Models & Migrations): Provides the `CriticalTerm` and `TermOccurrence` database models
- **Plan 3** (Notes Page Foundation): Provides the `/notes` page layout, `RichTextEditor` component, and `EditorToolbar` to integrate into
- **Plan 4** (optional but recommended): Enables thinker-based filtering in occurrences via `thinker_mentions`

---

## Audit Notes (2026-02-13)

1. `backend/app/schemas/critical_term.py` is the shared schema file for Plans 5 and 6.
2. Runtime TipTap extension updates must not use `.configure()` on existing extension instances.
3. Use explicit helper methods to update highlight terms and trigger decoration refresh.

---

## File Summary

| Action | File | What changes |
|--------|------|-------------|
| **CREATE** | `backend/app/utils/term_scanner.py` | Term scanning utility (regex matching + context extraction) |
| **CREATE** | `backend/app/schemas/critical_term.py` | Pydantic schemas for CriticalTerm and TermOccurrence (shared with Plan 6) |
| **CREATE** | `backend/app/routes/critical_terms.py` | Full CRUD routes + scan endpoints + occurrence listing |
| **MODIFY** | `backend/app/routes/notes.py` | Hook `scan_note_for_all_terms` into note create/update |
| **MODIFY** | `backend/app/schemas/__init__.py` | Register new schemas |
| **MODIFY** | `backend/app/main.py` | Register critical_terms router |
| **CREATE** | `frontend/src/components/notes/CriticalTermsList.tsx` | Sidebar component listing flagged terms with counts |
| **CREATE** | `frontend/src/components/notes/FlagTermDialog.tsx` | Modal dialog for flagging new critical terms |
| **CREATE** | `frontend/src/components/notes/tiptap-extensions/CriticalTermHighlight.ts` | TipTap decoration extension for visual highlighting |
| **MODIFY** | `frontend/src/types/index.ts` | Add CriticalTerm and TermOccurrence interfaces |
| **MODIFY** | `frontend/src/lib/api.ts` | Add criticalTermsApi client |
| **MODIFY** | `frontend/src/components/notes/EditorToolbar.tsx` | Add "Flag as Critical Term" button |
| **MODIFY** | `frontend/src/app/notes/page.tsx` | Integrate CriticalTermsList into sidebar layout |

**Total: 3 new backend files, 3 new frontend files, 3 modified backend files, 4 modified frontend files.**

---

## Backend: Term Scanner Utility

### File: `backend/app/utils/term_scanner.py`

```python
"""
Utility for scanning note content for critical term occurrences.

Uses regex word-boundary matching to find terms within note text.
Extracts ~200-character context snippets centered on each match.
"""

import re
from dataclasses import dataclass
from typing import List
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.critical_term import CriticalTerm, TermOccurrence
from app.models.note import Note


@dataclass
class TermMatch:
    """A single match of a critical term within note content."""
    term_id: UUID
    context_snippet: str
    paragraph_index: int
    char_offset: int


def _strip_html_tags(content: str) -> str:
    """Remove HTML tags from content, preserving text and whitespace.

    TipTap stores content as HTML. We need plain text for regex matching,
    but we preserve paragraph boundaries by converting block-level tags
    to newlines.
    """
    # Replace block-level closing tags with newlines to preserve paragraph boundaries
    text = re.sub(r'</(?:p|div|h[1-6]|li|blockquote|br)>', '\n', content, flags=re.IGNORECASE)
    # Replace <br> and <br/> tags with newlines
    text = re.sub(r'<br\s*/?>', '\n', text, flags=re.IGNORECASE)
    # Remove all remaining HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    # Decode common HTML entities
    text = text.replace('&amp;', '&')
    text = text.replace('&lt;', '<')
    text = text.replace('&gt;', '>')
    text = text.replace('&quot;', '"')
    text = text.replace('&#39;', "'")
    text = text.replace('&nbsp;', ' ')
    return text


def _extract_context_snippet(content: str, match_start: int, match_end: int, window: int = 100) -> str:
    """Extract a context snippet around a match position.

    Args:
        content: The full text content.
        match_start: Start index of the match.
        match_end: End index of the match.
        window: Number of characters to include before and after the match.

    Returns:
        A string of approximately (2 * window + match_length) characters,
        with ellipsis markers if truncated.
    """
    snippet_start = max(0, match_start - window)
    snippet_end = min(len(content), match_end + window)

    prefix = "..." if snippet_start > 0 else ""
    suffix = "..." if snippet_end < len(content) else ""

    snippet = content[snippet_start:snippet_end]
    return f"{prefix}{snippet}{suffix}"


def _compute_paragraph_index(content: str, char_offset: int) -> int:
    """Determine which paragraph (0-based) a character offset falls within.

    Paragraphs are delimited by newline characters.
    """
    text_before = content[:char_offset]
    return text_before.count('\n')


def scan_note_for_terms(content: str, terms: list) -> List[TermMatch]:
    """Scan note content for all active critical terms.

    For each term:
    1. Use regex word-boundary matching (case-insensitive)
    2. For each match, extract a ~200-char context snippet
    3. Determine paragraph_index by counting newlines before match
    4. Record the character offset

    Args:
        content: The note content (may contain HTML from TipTap).
        terms: List of CriticalTerm model instances to search for.

    Returns:
        List of TermMatch dataclass instances, one per occurrence found.
    """
    if not content or not terms:
        return []

    # Strip HTML to get plain text for matching
    plain_text = _strip_html_tags(content)

    if not plain_text.strip():
        return []

    matches: List[TermMatch] = []

    for term in terms:
        # Build regex pattern with word boundaries for whole-word matching.
        # re.escape handles any special regex characters in the term name.
        pattern = r'\b' + re.escape(term.name) + r'\b'

        for m in re.finditer(pattern, plain_text, re.IGNORECASE):
            context_snippet = _extract_context_snippet(
                plain_text,
                m.start(),
                m.end(),
                window=100,
            )
            paragraph_index = _compute_paragraph_index(plain_text, m.start())

            matches.append(TermMatch(
                term_id=term.id,
                context_snippet=context_snippet,
                paragraph_index=paragraph_index,
                char_offset=m.start(),
            ))

    return matches


def scan_all_notes_for_term(db: Session, term: CriticalTerm) -> int:
    """Scan every note for a specific critical term.

    Called when a new term is created or an existing term's name is changed.
    Clears all previous occurrences for this term, then re-scans every
    non-canvas note.

    Args:
        db: SQLAlchemy database session.
        term: The CriticalTerm model instance to scan for.

    Returns:
        The number of new TermOccurrence records created.
    """
    # Clear existing occurrences for this term
    db.query(TermOccurrence).filter(TermOccurrence.term_id == term.id).delete()

    # Query all notes (excluding canvas-only notes which have no meaningful text content)
    notes = db.query(Note).filter(
        Note.is_canvas_note == False  # noqa: E712 -- SQLAlchemy requires == for filter
    ).all()

    new_occurrences: list[TermOccurrence] = []

    for note in notes:
        content = note.content or ""
        if not content.strip():
            continue

        term_matches = scan_note_for_terms(content, [term])

        for match in term_matches:
            occurrence = TermOccurrence(
                term_id=match.term_id,
                note_id=note.id,
                context_snippet=match.context_snippet,
                paragraph_index=match.paragraph_index,
                char_offset=match.char_offset,
            )
            new_occurrences.append(occurrence)

    # Bulk insert all new occurrences
    if new_occurrences:
        db.bulk_save_objects(new_occurrences)

    db.flush()

    return len(new_occurrences)


def scan_note_for_all_terms(db: Session, note_id: UUID) -> int:
    """Scan a specific note for all active critical terms.

    Called on every note save (create or update) to keep term occurrences
    in sync with the latest note content.

    Args:
        db: SQLAlchemy database session.
        note_id: The UUID of the note to scan.

    Returns:
        The number of new TermOccurrence records created.
    """
    # Clear existing occurrences for this note
    db.query(TermOccurrence).filter(TermOccurrence.note_id == note_id).delete()

    # Get the note
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note or not note.content or not note.content.strip():
        return 0

    # Skip canvas-only notes
    if note.is_canvas_note:
        return 0

    # Query all active critical terms
    active_terms = db.query(CriticalTerm).filter(
        CriticalTerm.is_active == True  # noqa: E712
    ).all()

    if not active_terms:
        return 0

    term_matches = scan_note_for_terms(note.content, active_terms)

    new_occurrences: list[TermOccurrence] = []
    for match in term_matches:
        occurrence = TermOccurrence(
            term_id=match.term_id,
            note_id=note.id,
            context_snippet=match.context_snippet,
            paragraph_index=match.paragraph_index,
            char_offset=match.char_offset,
        )
        new_occurrences.append(occurrence)

    if new_occurrences:
        db.bulk_save_objects(new_occurrences)

    db.flush()

    return len(new_occurrences)
```

### Registration: `backend/app/utils/__init__.py`

Add to the existing imports:

```python
from app.utils.term_scanner import (
    scan_note_for_terms,
    scan_all_notes_for_term,
    scan_note_for_all_terms,
)

# Add to __all__:
    "scan_note_for_terms",
    "scan_all_notes_for_term",
    "scan_note_for_all_terms",
```

**Full updated file:**

```python
from app.utils.citation_formatter import (
    format_citation_chicago,
    format_citation_mla,
    format_citation_apa,
    add_formatted_citations
)
from app.utils.term_scanner import (
    scan_note_for_terms,
    scan_all_notes_for_term,
    scan_note_for_all_terms,
)

__all__ = [
    "format_citation_chicago",
    "format_citation_mla",
    "format_citation_apa",
    "add_formatted_citations",
    "scan_note_for_terms",
    "scan_all_notes_for_term",
    "scan_note_for_all_terms",
]
```

---

## Backend: Pydantic Schemas

### File: `backend/app/schemas/critical_term.py`

```python
from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class CriticalTermBase(BaseModel):
    name: str
    description: Optional[str] = None
    is_active: Optional[bool] = True

    @field_validator('name')
    @classmethod
    def validate_name(cls, v: str) -> str:
        """Normalize term name: strip whitespace, convert to lowercase, enforce min length."""
        v = v.strip().lower()
        if len(v) < 1:
            raise ValueError('Term name cannot be empty')
        return v


class CriticalTermCreate(CriticalTermBase):
    pass


class CriticalTermUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator('name')
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        """Normalize term name if provided."""
        if v is None:
            return v
        v = v.strip().lower()
        if len(v) < 1:
            raise ValueError('Term name cannot be empty')
        return v


class CriticalTerm(CriticalTermBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime


class CriticalTermWithCount(CriticalTerm):
    """CriticalTerm response that includes the total number of occurrences."""
    occurrence_count: int = 0


class TermOccurrenceResponse(BaseModel):
    """A single occurrence of a critical term within a note, with context."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    context_snippet: str
    paragraph_index: Optional[int] = None
    char_offset: Optional[int] = None
    note_id: UUID
    # Denormalized fields populated at query time for display convenience
    note_title: Optional[str] = None
    folder_name: Optional[str] = None
    thinker_names: List[str] = []
    created_at: datetime


class ScanResultResponse(BaseModel):
    """Response from a scan operation."""
    term_id: UUID
    term_name: str
    occurrence_count: int
    message: str
```

### Registration: `backend/app/schemas/__init__.py`

Add to the existing imports (after the `note` import block):

```python
from app.schemas.critical_term import (
    CriticalTermBase,
    CriticalTermCreate,
    CriticalTermUpdate,
    CriticalTerm as CriticalTermSchema,
    CriticalTermWithCount,
    TermOccurrenceResponse,
    ScanResultResponse,
)
```

Add to `__all__`:

```python
    # CriticalTerm
    "CriticalTermBase",
    "CriticalTermCreate",
    "CriticalTermUpdate",
    "CriticalTermSchema",
    "CriticalTermWithCount",
    "TermOccurrenceResponse",
    "ScanResultResponse",
```

**Full diff for `backend/app/schemas/__init__.py`:**

```diff
--- a/backend/app/schemas/__init__.py
+++ b/backend/app/schemas/__init__.py
@@ -67,6 +67,15 @@
     parse_wiki_links,
     convert_wiki_links_to_html
 )
+from app.schemas.critical_term import (
+    CriticalTermBase,
+    CriticalTermCreate,
+    CriticalTermUpdate,
+    CriticalTerm as CriticalTermSchema,
+    CriticalTermWithCount,
+    TermOccurrenceResponse,
+    ScanResultResponse,
+)
 from app.schemas.research_question import (
     ResearchQuestionBase,
     ResearchQuestionCreate,
@@ -117,6 +126,14 @@
     "NoteTypeStr",
     "parse_wiki_links",
     "convert_wiki_links_to_html",
+    # CriticalTerm
+    "CriticalTermBase",
+    "CriticalTermCreate",
+    "CriticalTermUpdate",
+    "CriticalTermSchema",
+    "CriticalTermWithCount",
+    "TermOccurrenceResponse",
+    "ScanResultResponse",
     # ResearchQuestion
     "ResearchQuestionBase",
     "ResearchQuestionCreate",
```

---

## Backend: Routes

### File: `backend/app/routes/critical_terms.py`

```python
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from uuid import UUID

from app.database import get_db
from app.models.critical_term import CriticalTerm, TermOccurrence
from app.models.note import Note
from app.models.thinker_mention import ThinkerMention
from app.schemas import critical_term as schemas
from app.utils.term_scanner import scan_all_notes_for_term

router = APIRouter(prefix="/api/critical-terms", tags=["critical-terms"])


# ---------------------------------------------------------------------------
# CREATE
# ---------------------------------------------------------------------------

@router.post("/", response_model=schemas.CriticalTermWithCount, status_code=201)
def create_critical_term(
    term_data: schemas.CriticalTermCreate,
    db: Session = Depends(get_db),
):
    """Create a new critical term and scan all existing notes for occurrences.

    The term name is normalized (stripped, lowercased) by the schema validator.
    After creation, every non-canvas note is scanned for this term.
    """
    # Check for duplicate name
    existing = db.query(CriticalTerm).filter(
        CriticalTerm.name == term_data.name
    ).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"A critical term named '{term_data.name}' already exists",
        )

    db_term = CriticalTerm(**term_data.model_dump())
    db.add(db_term)
    db.flush()  # Get the ID before scanning

    # Scan all notes for this new term
    occurrence_count = scan_all_notes_for_term(db, db_term)

    db.commit()
    db.refresh(db_term)

    # Return with occurrence count
    return schemas.CriticalTermWithCount(
        id=db_term.id,
        name=db_term.name,
        description=db_term.description,
        is_active=db_term.is_active,
        created_at=db_term.created_at,
        updated_at=db_term.updated_at,
        occurrence_count=occurrence_count,
    )


# ---------------------------------------------------------------------------
# READ (list)
# ---------------------------------------------------------------------------

@router.get("/", response_model=List[schemas.CriticalTermWithCount])
def list_critical_terms(
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
):
    """List all critical terms with their occurrence counts.

    Uses a subquery to count occurrences efficiently rather than
    loading all TermOccurrence rows.
    """
    # Subquery: count occurrences per term
    occurrence_count_subq = (
        db.query(
            TermOccurrence.term_id,
            func.count(TermOccurrence.id).label("occurrence_count"),
        )
        .group_by(TermOccurrence.term_id)
        .subquery()
    )

    query = (
        db.query(
            CriticalTerm,
            func.coalesce(occurrence_count_subq.c.occurrence_count, 0).label("occurrence_count"),
        )
        .outerjoin(
            occurrence_count_subq,
            CriticalTerm.id == occurrence_count_subq.c.term_id,
        )
    )

    if is_active is not None:
        query = query.filter(CriticalTerm.is_active == is_active)

    query = query.order_by(CriticalTerm.name)
    results = query.all()

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
        for term, count in results
    ]


# ---------------------------------------------------------------------------
# READ (single)
# ---------------------------------------------------------------------------

@router.get("/{term_id}", response_model=schemas.CriticalTermWithCount)
def get_critical_term(
    term_id: UUID,
    db: Session = Depends(get_db),
):
    """Get a single critical term with its occurrence count."""
    db_term = db.query(CriticalTerm).filter(CriticalTerm.id == term_id).first()
    if db_term is None:
        raise HTTPException(status_code=404, detail="Critical term not found")

    occurrence_count = (
        db.query(func.count(TermOccurrence.id))
        .filter(TermOccurrence.term_id == term_id)
        .scalar()
    )

    return schemas.CriticalTermWithCount(
        id=db_term.id,
        name=db_term.name,
        description=db_term.description,
        is_active=db_term.is_active,
        created_at=db_term.created_at,
        updated_at=db_term.updated_at,
        occurrence_count=occurrence_count or 0,
    )


# ---------------------------------------------------------------------------
# UPDATE
# ---------------------------------------------------------------------------

@router.put("/{term_id}", response_model=schemas.CriticalTermWithCount)
def update_critical_term(
    term_id: UUID,
    term_update: schemas.CriticalTermUpdate,
    db: Session = Depends(get_db),
):
    """Update a critical term. If the name changes, re-scan all notes."""
    db_term = db.query(CriticalTerm).filter(CriticalTerm.id == term_id).first()
    if db_term is None:
        raise HTTPException(status_code=404, detail="Critical term not found")

    update_data = term_update.model_dump(exclude_unset=True)
    name_changed = False

    if 'name' in update_data and update_data['name'] != db_term.name:
        # Check for name conflict
        existing = db.query(CriticalTerm).filter(
            CriticalTerm.name == update_data['name'],
            CriticalTerm.id != term_id,
        ).first()
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"A critical term named '{update_data['name']}' already exists",
            )
        name_changed = True

    for field, value in update_data.items():
        setattr(db_term, field, value)

    db.flush()

    # If name changed, re-scan all notes for the updated term
    if name_changed:
        scan_all_notes_for_term(db, db_term)

    db.commit()
    db.refresh(db_term)

    occurrence_count = (
        db.query(func.count(TermOccurrence.id))
        .filter(TermOccurrence.term_id == term_id)
        .scalar()
    )

    return schemas.CriticalTermWithCount(
        id=db_term.id,
        name=db_term.name,
        description=db_term.description,
        is_active=db_term.is_active,
        created_at=db_term.created_at,
        updated_at=db_term.updated_at,
        occurrence_count=occurrence_count or 0,
    )


# ---------------------------------------------------------------------------
# DELETE
# ---------------------------------------------------------------------------

@router.delete("/{term_id}", status_code=204)
def delete_critical_term(
    term_id: UUID,
    db: Session = Depends(get_db),
):
    """Delete a critical term. Cascade deletes all its occurrences."""
    db_term = db.query(CriticalTerm).filter(CriticalTerm.id == term_id).first()
    if db_term is None:
        raise HTTPException(status_code=404, detail="Critical term not found")

    db.delete(db_term)
    db.commit()
    return None


# ---------------------------------------------------------------------------
# SCAN (re-scan all notes for a specific term)
# ---------------------------------------------------------------------------

@router.post("/{term_id}/scan-all", response_model=schemas.ScanResultResponse)
def scan_all_notes_for_critical_term(
    term_id: UUID,
    db: Session = Depends(get_db),
):
    """Re-scan all notes for a specific critical term.

    Useful after bulk-importing notes or if occurrences are suspected
    to be out of sync.
    """
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


# ---------------------------------------------------------------------------
# OCCURRENCES (paginated listing with filters)
# ---------------------------------------------------------------------------

@router.get("/{term_id}/occurrences", response_model=List[schemas.TermOccurrenceResponse])
def get_term_occurrences(
    term_id: UUID,
    folder_id: Optional[UUID] = Query(None, description="Filter by folder"),
    thinker_id: Optional[UUID] = Query(None, description="Filter by notes mentioning this thinker"),
    limit: int = Query(50, ge=1, le=200, description="Max results per page"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    db: Session = Depends(get_db),
):
    """Get paginated occurrences of a critical term with optional filters.

    Each occurrence includes context snippet, note title, folder name,
    and the names of thinkers mentioned in that note (via thinker_mentions).

    Filters:
    - folder_id: Only show occurrences in notes within this folder.
    - thinker_id: Only show occurrences in notes that mention this thinker
      (via the thinker_mentions table from Plan 4).
    """
    # Verify term exists
    db_term = db.query(CriticalTerm).filter(CriticalTerm.id == term_id).first()
    if db_term is None:
        raise HTTPException(status_code=404, detail="Critical term not found")

    # Base query: occurrences for this term, joined with notes
    query = (
        db.query(TermOccurrence)
        .join(Note, TermOccurrence.note_id == Note.id)
        .filter(TermOccurrence.term_id == term_id)
    )

    # Filter by folder (requires Note.folder_id from Plan 1 migration)
    if folder_id is not None:
        query = query.filter(Note.folder_id == folder_id)

    # Filter by thinker: notes that have a ThinkerMention for this thinker
    if thinker_id is not None:
        query = query.filter(
            Note.id.in_(
                db.query(ThinkerMention.note_id).filter(
                    ThinkerMention.thinker_id == thinker_id
                )
            )
        )

    # Order by note updated_at descending (most recently edited notes first)
    query = query.order_by(Note.updated_at.desc())

    # Paginate
    occurrences = query.offset(offset).limit(limit).all()

    # Build response with denormalized note/folder/thinker info
    results: list[schemas.TermOccurrenceResponse] = []
    for occ in occurrences:
        note = occ.note

        # Get note title
        note_title = note.title or "Untitled Note"

        # Get folder name (if note is in a folder)
        folder_name = None
        if hasattr(note, 'folder') and note.folder is not None:
            folder_name = note.folder.name

        # Get thinker names from thinker_mention_records (backref from Plan 1)
        thinker_names: list[str] = []
        if hasattr(note, 'thinker_mention_records'):
            # Deduplicate thinker names
            seen_thinker_ids = set()
            for mention in note.thinker_mention_records:
                if mention.thinker_id not in seen_thinker_ids:
                    seen_thinker_ids.add(mention.thinker_id)
                    if hasattr(mention, 'thinker') and mention.thinker is not None:
                        thinker_names.append(mention.thinker.name)

        results.append(schemas.TermOccurrenceResponse(
            id=occ.id,
            context_snippet=occ.context_snippet,
            paragraph_index=occ.paragraph_index,
            char_offset=occ.char_offset,
            note_id=occ.note_id,
            note_title=note_title,
            folder_name=folder_name,
            thinker_names=thinker_names,
            created_at=occ.created_at,
        ))

    return results
```

---

## Backend: Hook into Note Save

### Modification: `backend/app/routes/notes.py`

Add the term scanning import and hook it into both `create_note` and `update_note`.

**Diff:**

```diff
--- a/backend/app/routes/notes.py
+++ b/backend/app/routes/notes.py
@@ -6,6 +6,7 @@
 from app.database import get_db
 from app.models.note import Note, NoteVersion, note_mentions
 from app.models.thinker import Thinker
+from app.utils.term_scanner import scan_note_for_all_terms
 from app.schemas import note as schemas
 from app.schemas.note import parse_wiki_links, convert_wiki_links_to_html

@@ -43,10 +44,14 @@
 def create_note(note_data: schemas.NoteCreate, db: Session = Depends(get_db)):
     if note_data.thinker_id:
         validate_thinker_exists(db, note_data.thinker_id)

     db_note = Note(**note_data.model_dump())
     db.add(db_note)
     db.flush()  # Get the ID before processing mentions

     # Process wiki links
     process_wiki_links(db, db_note, note_data.content)

+    # Scan for critical terms
+    scan_note_for_all_terms(db, db_note.id)
+
     db.commit()
     db.refresh(db_note)

@@ -95,12 +100,16 @@
     update_data = note_update.model_dump(exclude_unset=True)
     for field, value in update_data.items():
         setattr(db_note, field, value)

     # Re-process wiki links if content changed
     if 'content' in update_data:
         process_wiki_links(db, db_note, update_data['content'])

+    # Re-scan for critical terms if content changed
+    if 'content' in update_data:
+        scan_note_for_all_terms(db, note_id)
+
     db.commit()
     db.refresh(db_note)
     return db_note
```

**Full updated `create_note` function:**

```python
@router.post("/", response_model=schemas.NoteWithMentions, status_code=201)
def create_note(note_data: schemas.NoteCreate, db: Session = Depends(get_db)):
    if note_data.thinker_id:
        validate_thinker_exists(db, note_data.thinker_id)

    db_note = Note(**note_data.model_dump())
    db.add(db_note)
    db.flush()  # Get the ID before processing mentions

    # Process wiki links
    process_wiki_links(db, db_note, note_data.content)

    # Scan for critical terms
    scan_note_for_all_terms(db, db_note.id)

    db.commit()
    db.refresh(db_note)

    return db_note
```

**Full updated `update_note` function:**

```python
@router.put("/{note_id}", response_model=schemas.NoteWithMentions)
def update_note(note_id: UUID, note_update: schemas.NoteUpdate, db: Session = Depends(get_db)):
    db_note = db.query(Note).filter(Note.id == note_id).first()

    if db_note is None:
        raise HTTPException(status_code=404, detail="Note not found")

    # Save version before updating
    version_count = db.query(NoteVersion).filter(NoteVersion.note_id == note_id).count()
    version = NoteVersion(
        note_id=note_id,
        content=db_note.content,
        version_number=version_count + 1
    )
    db.add(version)

    update_data = note_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_note, field, value)

    # Re-process wiki links if content changed
    if 'content' in update_data:
        process_wiki_links(db, db_note, update_data['content'])

    # Re-scan for critical terms if content changed
    if 'content' in update_data:
        scan_note_for_all_terms(db, note_id)

    db.commit()
    db.refresh(db_note)
    return db_note
```

---

## Backend: Registration in `main.py`

### Modification: `backend/app/main.py`

**Diff:**

```diff
--- a/backend/app/main.py
+++ b/backend/app/main.py
@@ -8,7 +8,7 @@
 from fastapi.middleware.cors import CORSMiddleware

-from app.routes import thinkers, connections, publications, quotes, tags, timelines, timeline_events, combined_timeline_views, institutions, notes, research_questions, ai, quiz, auth
+from app.routes import thinkers, connections, publications, quotes, tags, timelines, timeline_events, combined_timeline_views, institutions, notes, research_questions, ai, quiz, auth, critical_terms
 from app.routes import test as test_routes

@@ -60,6 +60,7 @@
 app.include_router(notes.router)
 app.include_router(research_questions.router)
+app.include_router(critical_terms.router)
 app.include_router(ai.router)
 app.include_router(quiz.router)
 app.include_router(auth.router)
```

---

## Frontend: Types

### Modification: `frontend/src/types/index.ts`

Add the following interfaces after the existing `NoteVersion` interface (around line 442):

```typescript
// ============ Critical Terms Types ============

export interface CriticalTerm {
  id: string
  name: string
  description?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CriticalTermWithCount extends CriticalTerm {
  occurrence_count: number
}

export interface CriticalTermCreate {
  name: string
  description?: string | null
  is_active?: boolean
}

export interface CriticalTermUpdate {
  name?: string
  description?: string | null
  is_active?: boolean
}

export interface TermOccurrence {
  id: string
  context_snippet: string
  paragraph_index?: number | null
  char_offset?: number | null
  note_id: string
  note_title?: string | null
  folder_name?: string | null
  thinker_names: string[]
  created_at: string
}

export interface ScanResult {
  term_id: string
  term_name: string
  occurrence_count: number
  message: string
}
```

---

## Frontend: API Client

### Modification: `frontend/src/lib/api.ts`

Add the following type imports to the existing import block at the top of the file:

```typescript
import type {
  // ... existing imports ...
  CriticalTermWithCount,
  CriticalTermCreate,
  CriticalTermUpdate,
  TermOccurrence,
  ScanResult,
} from '@/types'
```

Add the following API client after the `notesApi` definition (around line 303):

```typescript
// Critical Terms API
export const criticalTermsApi = {
  getAll: async (isActive?: boolean): Promise<CriticalTermWithCount[]> => {
    const params: Record<string, unknown> = {}
    if (isActive !== undefined) params.is_active = isActive
    const response = await api.get('/api/critical-terms/', { params })
    return response.data
  },
  getOne: async (id: string): Promise<CriticalTermWithCount> => {
    const response = await api.get(`/api/critical-terms/${id}`)
    return response.data
  },
  create: async (data: CriticalTermCreate): Promise<CriticalTermWithCount> => {
    const response = await api.post('/api/critical-terms/', data)
    return response.data
  },
  update: async (id: string, data: CriticalTermUpdate): Promise<CriticalTermWithCount> => {
    const response = await api.put(`/api/critical-terms/${id}`, data)
    return response.data
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/critical-terms/${id}`)
  },
  scanAll: async (termId: string): Promise<ScanResult> => {
    const response = await api.post(`/api/critical-terms/${termId}/scan-all`)
    return response.data
  },
  getOccurrences: async (
    termId: string,
    filters?: {
      folder_id?: string
      thinker_id?: string
      limit?: number
      offset?: number
    }
  ): Promise<TermOccurrence[]> => {
    const response = await api.get(`/api/critical-terms/${termId}/occurrences`, {
      params: filters,
    })
    return response.data
  },
}
```

---

## Frontend: CriticalTermsList Component

### File: `frontend/src/components/notes/CriticalTermsList.tsx`

```tsx
'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { criticalTermsApi } from '@/lib/api'
import type { CriticalTermWithCount } from '@/types'

interface CriticalTermsListProps {
  /** Callback when a term is selected (for right-panel definition view in Plan 6) */
  onSelectTerm?: (termId: string) => void
  /** Currently selected term ID */
  selectedTermId?: string | null
  /** Callback to open the FlagTermDialog */
  onFlagNewTerm: () => void
}

type SortMode = 'name' | 'count'

export function CriticalTermsList({
  onSelectTerm,
  selectedTermId,
  onFlagNewTerm,
}: CriticalTermsListProps) {
  const queryClient = useQueryClient()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [sortMode, setSortMode] = useState<SortMode>('name')

  const { data: terms = [], isLoading } = useQuery({
    queryKey: ['critical-terms'],
    queryFn: () => criticalTermsApi.getAll(),
  })

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      criticalTermsApi.update(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['critical-terms'] })
    },
  })

  // Sort terms based on current mode
  const sortedTerms = [...terms].sort((a, b) => {
    if (sortMode === 'count') {
      return b.occurrence_count - a.occurrence_count
    }
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="border-t border-timeline">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-1 text-xs font-sans font-medium text-secondary uppercase tracking-wide hover:text-primary"
        >
          <span
            className="inline-block transition-transform"
            style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
          >
            &#9662;
          </span>
          Critical Terms
          {terms.length > 0 && (
            <span className="ml-1 text-gray-400">({terms.length})</span>
          )}
        </button>
        <div className="flex items-center gap-1">
          {/* Sort toggle */}
          <button
            onClick={() => setSortMode(sortMode === 'name' ? 'count' : 'name')}
            className="text-xs text-gray-400 hover:text-gray-600 px-1"
            title={`Sort by ${sortMode === 'name' ? 'occurrence count' : 'name'}`}
          >
            {sortMode === 'name' ? 'A-Z' : '#'}
          </button>
        </div>
      </div>

      {/* Terms list (collapsible) */}
      {!isCollapsed && (
        <div className="px-2 py-1">
          {isLoading ? (
            <p className="text-xs text-gray-400 px-1 py-2">Loading terms...</p>
          ) : sortedTerms.length === 0 ? (
            <p className="text-xs text-gray-400 italic px-1 py-2">
              No critical terms flagged yet
            </p>
          ) : (
            <div className="space-y-0.5 max-h-48 overflow-y-auto">
              {sortedTerms.map((term: CriticalTermWithCount) => (
                <div
                  key={term.id}
                  className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer group transition-colors ${
                    selectedTermId === term.id
                      ? 'bg-amber-50 border border-amber-200'
                      : 'hover:bg-gray-50'
                  } ${!term.is_active ? 'opacity-50' : ''}`}
                  onClick={() => onSelectTerm?.(term.id)}
                >
                  <span
                    className="text-sm font-mono truncate flex-1"
                    title={term.name}
                  >
                    {term.name}
                  </span>
                  <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                    {/* Occurrence count badge */}
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full font-sans ${
                        term.is_active
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {term.occurrence_count}
                    </span>
                    {/* Active/inactive toggle (appears on hover) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleActiveMutation.mutate({
                          id: term.id,
                          is_active: !term.is_active,
                        })
                      }}
                      className="opacity-0 group-hover:opacity-100 text-xs text-gray-400 hover:text-gray-600 transition-opacity"
                      title={term.is_active ? 'Deactivate term' : 'Activate term'}
                    >
                      {term.is_active ? (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Flag New Term button */}
          <button
            onClick={onFlagNewTerm}
            className="w-full mt-2 mb-1 px-2 py-1.5 text-xs font-sans text-accent hover:bg-amber-50 rounded border border-dashed border-amber-300 transition-colors flex items-center justify-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
            </svg>
            Flag New Term
          </button>
        </div>
      )}
    </div>
  )
}
```

---

## Frontend: FlagTermDialog Component

### File: `frontend/src/components/notes/FlagTermDialog.tsx`

```tsx
'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { criticalTermsApi } from '@/lib/api'
import { Modal, ModalFooter, ModalButton, ModalError } from '@/components/Modal'
import type { CriticalTermCreate } from '@/types'

interface FlagTermDialogProps {
  isOpen: boolean
  onClose: () => void
  /** Pre-filled term name (e.g., from editor text selection) */
  initialTerm?: string
}

export function FlagTermDialog({ isOpen, onClose, initialTerm }: FlagTermDialogProps) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState<CriticalTermCreate>({
    name: '',
    description: '',
  })
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Reset form when dialog opens/closes or initialTerm changes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: initialTerm?.trim().toLowerCase() || '',
        description: '',
      })
      setSuccessMessage(null)
      setError(null)
    }
  }, [isOpen, initialTerm])

  const createMutation = useMutation({
    mutationFn: (data: CriticalTermCreate) => criticalTermsApi.create(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['critical-terms'] })
      setSuccessMessage(
        `Flagged '${result.name}'. Found ${result.occurrence_count} occurrence${
          result.occurrence_count === 1 ? '' : 's'
        } across your notes.`
      )
      setError(null)
    },
    onError: (err: Error) => {
      setError(err.message)
      setSuccessMessage(null)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)

    if (!formData.name.trim()) {
      setError('Term name is required')
      return
    }

    createMutation.mutate(formData)
  }

  const handleClose = () => {
    setSuccessMessage(null)
    setError(null)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Flag Critical Term" maxWidth="md">
      <div className="p-6">
        {successMessage ? (
          // Success state
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded text-sm text-green-800">
              {successMessage}
            </div>
            <p className="text-sm text-gray-600">
              This term will now be highlighted in all your notes and tracked across
              your research. You can view all occurrences by clicking the term in the
              sidebar.
            </p>
            <ModalFooter>
              <ModalButton variant="primary" onClick={handleClose}>
                Done
              </ModalButton>
            </ModalFooter>
          </div>
        ) : (
          // Form state
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Term Name */}
            <div>
              <label className="block text-sm font-sans font-medium text-primary mb-1">
                Term
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full px-3 py-2 border border-timeline rounded font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder='e.g., "habit", "Dasein", "praxis"'
                autoFocus
              />
              <p className="mt-1 text-xs text-gray-400">
                Will be normalized to lowercase. Matches whole words only.
              </p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-sans font-medium text-primary mb-1">
                Description{' '}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={formData.description || ''}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
                className="w-full px-3 py-2 border border-timeline rounded font-serif text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-y"
                placeholder="Brief note on why this term matters to your research..."
              />
            </div>

            {error && <ModalError message={error} />}

            {/* Loading state during scan */}
            {createMutation.isPending && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800 flex items-center gap-2">
                <svg
                  className="w-4 h-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Scanning all notes for this term...
              </div>
            )}

            <ModalFooter>
              <ModalButton onClick={handleClose}>Cancel</ModalButton>
              <ModalButton
                type="submit"
                variant="primary"
                disabled={createMutation.isPending || !formData.name.trim()}
              >
                {createMutation.isPending ? 'Scanning...' : 'Flag Term'}
              </ModalButton>
            </ModalFooter>
          </form>
        )}
      </div>
    </Modal>
  )
}
```

---

## Frontend: CriticalTermHighlight TipTap Extension

### File: `frontend/src/components/notes/tiptap-extensions/CriticalTermHighlight.ts`

This extension uses TipTap's Plugin system to create decorations (visual-only highlights) that do NOT modify the document content. Terms are highlighted with a soft yellow background.

```typescript
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

/**
 * CriticalTermHighlight Extension for TipTap
 *
 * Adds visual decorations (background highlights) for critical terms
 * without modifying the document content. Uses ProseMirror's decoration
 * system for a purely visual overlay.
 *
 * Usage:
 *   CriticalTermHighlight.configure({
 *     terms: ['habit', 'dasein', 'praxis'],
 *     highlightClass: 'critical-term-highlight',
 *   })
 *
 * The extension watches for document changes and re-computes decorations
 * on each transaction, debounced to avoid performance issues.
 */

export interface CriticalTermHighlightOptions {
  /**
   * List of term strings to highlight (should be lowercase).
   * Updated dynamically via editor.extensionManager or by reconfiguring.
   */
  terms: string[]
  /**
   * CSS class applied to the highlight decoration.
   * Default: 'critical-term-highlight'
   */
  highlightClass: string
}

const criticalTermPluginKey = new PluginKey('criticalTermHighlight')

/**
 * Build a DecorationSet by scanning the document text for all terms.
 */
function buildDecorations(
  doc: Parameters<typeof DecorationSet.create>[0],
  terms: string[],
  highlightClass: string,
): DecorationSet {
  if (!terms.length) {
    return DecorationSet.empty
  }

  const decorations: Decoration[] = []

  // Escape regex special chars and build a combined pattern
  const escapedTerms = terms
    .filter((t) => t.length > 0)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

  if (escapedTerms.length === 0) {
    return DecorationSet.empty
  }

  // Single regex matching any of the terms (case-insensitive, whole-word)
  const pattern = new RegExp(
    '\\b(' + escapedTerms.join('|') + ')\\b',
    'gi',
  )

  // Walk through all text nodes in the document
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) {
      return
    }

    let match: RegExpExecArray | null
    pattern.lastIndex = 0

    while ((match = pattern.exec(node.text)) !== null) {
      const from = pos + match.index
      const to = from + match[0].length

      decorations.push(
        Decoration.inline(from, to, {
          class: highlightClass,
          'data-critical-term': match[0].toLowerCase(),
        }),
      )
    }
  })

  return DecorationSet.create(doc, decorations)
}

export const CriticalTermHighlight = Extension.create<CriticalTermHighlightOptions>({
  name: 'criticalTermHighlight',

  addOptions() {
    return {
      terms: [],
      highlightClass: 'critical-term-highlight',
    }
  },

  addProseMirrorPlugins() {
    const extensionOptions = this.options

    return [
      new Plugin({
        key: criticalTermPluginKey,

        state: {
          init(_, { doc }) {
            return buildDecorations(
              doc,
              extensionOptions.terms,
              extensionOptions.highlightClass,
            )
          },
          apply(tr, oldDecorations) {
            // Only rebuild decorations when the document changes
            // or when the meta flag is set (terms list updated)
            if (tr.docChanged || tr.getMeta(criticalTermPluginKey)) {
              return buildDecorations(
                tr.doc,
                extensionOptions.terms,
                extensionOptions.highlightClass,
              )
            }
            // Map existing decorations through the transaction
            return oldDecorations.map(tr.mapping, tr.doc)
          },
        },

        props: {
          decorations(state) {
            return this.getState(state)
          },
        },
      }),
    ]
  },
})

/**
 * Helper: update the active terms list and force decoration recalculation.
 * Call this when terms change externally (create/update/deactivate).
 *
 * Usage:
 *   import { setCriticalTermHighlights } from './CriticalTermHighlight'
 *   setCriticalTermHighlights(editor, ['habit', 'praxis'])
 */
export function setCriticalTermHighlights(
  editor: {
    extensionManager: { extensions: Array<{ name: string; options?: Record<string, unknown> }> }
    view: { dispatch: (tr: unknown) => void; state: { tr: { setMeta: (key: PluginKey, value: boolean) => unknown } } }
  },
  terms: string[],
) {
  const extension = editor.extensionManager.extensions.find(
    (ext) => ext.name === 'criticalTermHighlight'
  )
  if (extension && extension.options) {
    extension.options.terms = terms
  }
  const tr = editor.view.state.tr.setMeta(criticalTermPluginKey, true)
  editor.view.dispatch(tr)
}
```

### Required CSS

Add the following to the notes page global styles or Tailwind CSS (in the notes page layout or a dedicated stylesheet):

```css
/* Critical term highlighting in TipTap editor */
.critical-term-highlight {
  background-color: #FEF3C7; /* Tailwind yellow-100 */
  border-radius: 2px;
  padding: 0 1px;
  /* Subtle bottom border for extra visibility */
  box-shadow: inset 0 -2px 0 0 #FCD34D; /* Tailwind yellow-300 */
}
```

Alternatively, if using Tailwind's `@apply` in a CSS module or global styles:

```css
.critical-term-highlight {
  @apply bg-yellow-100 rounded-sm;
  box-shadow: inset 0 -2px 0 0 theme('colors.yellow.300');
}
```

---

## Frontend: Toolbar Integration

### Modification: `frontend/src/components/notes/EditorToolbar.tsx`

Add a "Flag as Critical Term" button that appears when text is selected in the editor.

**What to add** (as a new button in the toolbar, after the existing formatting buttons):

```tsx
{/* Flag as Critical Term button - shows when text is selected */}
{selectedText && (
  <button
    type="button"
    onClick={() => onFlagTerm?.(selectedText)}
    className="px-2 py-1 text-xs font-sans text-amber-700 hover:bg-amber-50 rounded border border-amber-200 flex items-center gap-1 transition-colors"
    title={`Flag "${selectedText}" as a critical term`}
  >
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
    </svg>
    Flag Term
  </button>
)}
```

**New props needed on EditorToolbar:**

```typescript
interface EditorToolbarProps {
  // ... existing props ...
  /** The currently selected text in the editor (empty string if no selection) */
  selectedText?: string
  /** Callback to open FlagTermDialog with the selected text */
  onFlagTerm?: (term: string) => void
}
```

**How to obtain `selectedText`:** In the parent component that holds the TipTap editor, listen for selection changes:

```typescript
// In the component that renders <EditorToolbar> and the TipTap editor:
const [selectedText, setSelectedText] = useState('')

// On editor selection update:
editor.on('selectionUpdate', ({ editor }) => {
  const { from, to } = editor.state.selection
  if (from !== to) {
    setSelectedText(editor.state.doc.textBetween(from, to, ' '))
  } else {
    setSelectedText('')
  }
})
```

---

## Frontend: Integration into Notes Page

### Modification: `frontend/src/app/notes/page.tsx`

Add the CriticalTermsList component to the left sidebar and manage state for the FlagTermDialog.

**New state variables:**

```typescript
const [selectedTermId, setSelectedTermId] = useState<string | null>(null)
const [isFlagTermDialogOpen, setIsFlagTermDialogOpen] = useState(false)
const [flagTermInitialText, setFlagTermInitialText] = useState<string | undefined>(undefined)
```

**In the left sidebar, below the FolderTree component:**

```tsx
{/* Critical Terms Section */}
<CriticalTermsList
  selectedTermId={selectedTermId}
  onSelectTerm={(termId) => {
    setSelectedTermId(termId)
    // Plan 6 will switch right panel to definition mode here
  }}
  onFlagNewTerm={() => {
    setFlagTermInitialText(undefined)
    setIsFlagTermDialogOpen(true)
  }}
/>
```

**The FlagTermDialog, rendered alongside other modals:**

```tsx
<FlagTermDialog
  isOpen={isFlagTermDialogOpen}
  onClose={() => setIsFlagTermDialogOpen(false)}
  initialTerm={flagTermInitialText}
/>
```

**Connect the toolbar "Flag Term" button:**

When the EditorToolbar's `onFlagTerm` callback fires:

```typescript
const handleFlagTerm = (term: string) => {
  setFlagTermInitialText(term)
  setIsFlagTermDialogOpen(true)
}
```

**Integrate CriticalTermHighlight into the TipTap editor configuration:**

```typescript
import { CriticalTermHighlight, setCriticalTermHighlights } from '@/components/notes/tiptap-extensions/CriticalTermHighlight'

// In the editor setup, include the extension with current active terms:
const { data: criticalTerms = [] } = useQuery({
  queryKey: ['critical-terms', { is_active: true }],
  queryFn: () => criticalTermsApi.getAll(true),
})

const activeTermNames = criticalTerms
  .filter((t) => t.is_active)
  .map((t) => t.name)

// Pass to TipTap editor configuration:
const editor = useEditor({
  extensions: [
    // ... existing extensions ...
    CriticalTermHighlight.configure({
      terms: activeTermNames,
    }),
  ],
  // ... content, etc. ...
})

// When the critical terms list changes, refresh the highlights:
useEffect(() => {
  if (editor) {
    setCriticalTermHighlights(editor, activeTermNames)
  }
}, [activeTermNames, editor])
```

**Alternative simpler approach for updating terms:** Recreate the editor when terms change. This is easier but causes focus/selection loss and is not recommended.

---

## Verification Steps

Follow these steps after implementing all files to verify the system works end-to-end.

### 1. Backend verification

```bash
cd backend
# Ensure the server starts without import errors
uvicorn app.main:app --reload --port 8010
```

### 2. API verification (using curl or the Swagger docs at /docs)

```bash
# Create a test note first
curl -X POST http://localhost:8010/api/notes/ \
  -H "Content-Type: application/json" \
  -d '{"content": "Aristotle discusses habit in the Nicomachean Ethics. The concept of habit is central to his virtue theory. Habit formation requires repeated action.", "title": "Notes on Aristotle"}'

# Create a critical term
curl -X POST http://localhost:8010/api/critical-terms/ \
  -H "Content-Type: application/json" \
  -d '{"name": "habit", "description": "Key concept in Aristotelian virtue ethics"}'
# Expected: 201 with occurrence_count: 3 (three instances of "habit")

# List all terms with counts
curl http://localhost:8010/api/critical-terms/
# Expected: Array with "habit" showing occurrence_count: 3

# Get occurrences for the term
curl http://localhost:8010/api/critical-terms/{term_id}/occurrences
# Expected: 3 occurrences, each with context_snippet showing surrounding text

# Create another note with "habit"
curl -X POST http://localhost:8010/api/notes/ \
  -H "Content-Type: application/json" \
  -d '{"content": "The habit of philosophical inquiry requires discipline.", "title": "Research Method Notes"}'

# Check that occurrence count increased
curl http://localhost:8010/api/critical-terms/
# Expected: "habit" now has occurrence_count: 4

# Update the term to inactive
curl -X PUT http://localhost:8010/api/critical-terms/{term_id} \
  -H "Content-Type: application/json" \
  -d '{"is_active": false}'
# Expected: term with is_active: false

# Delete the term
curl -X DELETE http://localhost:8010/api/critical-terms/{term_id}
# Expected: 204 No Content, occurrences cascade deleted
```

### 3. Frontend verification (manual)

1. Open `/notes` page, see "Critical Terms" section in the left sidebar (empty initially)
2. Type a note with "habit" appearing multiple times in the TipTap editor
3. Save the note
4. Select the word "habit" in the editor
5. Click "Flag Term" button in the toolbar
6. FlagTermDialog opens with "habit" pre-filled in the name field
7. Click "Flag Term" to submit
8. Loading spinner shows "Scanning all notes for this term..."
9. Success message: "Flagged 'habit'. Found N occurrences across your notes."
10. Close the dialog
11. Sidebar "Critical Terms" section now shows `habit` with an occurrence count badge
12. In the editor, all instances of "habit" are highlighted with a yellow background
13. Create a second note containing "habit", save it
14. The occurrence count in the sidebar increases
15. Hover over the "habit" row in the sidebar, click the eye icon to toggle inactive
16. The term row becomes dimmed, highlighting disappears from the editor
17. Toggle it back to active, highlighting reappears
18. Click the "Flag New Term" button at the bottom of the sidebar
19. FlagTermDialog opens with an empty name field (no pre-fill)
20. Type "praxis" and submit, verify scanning works

### 4. Edge cases to test

- **Empty term name:** Submit with blank name -- should show validation error
- **Duplicate term:** Try to create "habit" twice -- should show 409 error
- **Term with special regex chars:** Flag a term like "being-in-the-world" (hyphens) -- should match correctly
- **HTML content:** Ensure HTML tags are stripped before scanning, so `<strong>habit</strong>` still matches "habit"
- **No notes exist:** Flag a term when there are zero notes -- should succeed with 0 occurrences
- **Canvas notes excluded:** Create a canvas note with "habit" -- it should NOT appear in occurrences
- **Term rename:** Rename "habit" to "habitus" via PUT -- occurrences should be re-scanned with the new name

---

## Performance Considerations

### Scanning cost

- `scan_all_notes_for_term` iterates through ALL non-canvas notes. For a PhD research project with ~500 notes, this is fast (< 1 second). For 5000+ notes, consider background task processing.
- `scan_note_for_all_terms` runs on every note save but only scans one note against all terms. With ~50 active terms, this adds negligible latency.

### Frontend decoration performance

- The TipTap decoration plugin rebuilds decorations on every document change. For a single note with ~50 terms, this involves ~50 regex matches on the visible text -- fast enough for real-time editing.
- The combined regex pattern (`term1|term2|...|termN`) is compiled once per rebuild and is efficient for up to ~100 terms.
- If performance becomes an issue with many terms, add debouncing (250ms) to the decoration rebuild.

### Database indexing

The Plan 1 migration creates the `term_occurrences` table. Consider adding an index on `(term_id, note_id)` if occurrence queries become slow:

```sql
CREATE INDEX ix_term_occurrences_term_note ON term_occurrences (term_id, note_id);
```

This can be added as a follow-up migration if needed.

---

## Execution Checklist

- [ ] Create `backend/app/utils/term_scanner.py` with `scan_note_for_terms`, `scan_all_notes_for_term`, `scan_note_for_all_terms`
- [ ] Update `backend/app/utils/__init__.py` with new imports
- [ ] Create `backend/app/schemas/critical_term.py` with all Pydantic schemas
- [ ] Update `backend/app/schemas/__init__.py` with new imports
- [ ] Create `backend/app/routes/critical_terms.py` with full CRUD + scan + occurrences routes
- [ ] Update `backend/app/main.py` to import and register `critical_terms.router`
- [ ] Update `backend/app/routes/notes.py` to call `scan_note_for_all_terms` on create/update
- [ ] Add `CriticalTerm` and `TermOccurrence` interfaces to `frontend/src/types/index.ts`
- [ ] Add `criticalTermsApi` to `frontend/src/lib/api.ts`
- [ ] Create `frontend/src/components/notes/CriticalTermsList.tsx`
- [ ] Create `frontend/src/components/notes/FlagTermDialog.tsx`
- [ ] Create `frontend/src/components/notes/tiptap-extensions/CriticalTermHighlight.ts`
- [ ] Add `.critical-term-highlight` CSS class to notes page styles
- [ ] Add "Flag Term" button to `EditorToolbar.tsx`
- [ ] Integrate `CriticalTermsList` and `FlagTermDialog` into `frontend/src/app/notes/page.tsx`
- [ ] Configure `CriticalTermHighlight` extension in the TipTap editor setup
- [ ] Run backend: `cd backend && uvicorn app.main:app --reload --port 8010` and verify no import errors
- [ ] Run frontend: `cd frontend && npm run dev` and verify no build errors
- [ ] Run through all verification steps above
- [ ] Run existing tests to confirm no regressions: `cd backend && pytest`
- [ ] Run TypeScript check: `cd frontend && npm run type-check`
