# Plan 1: Data Models & Migrations

## Goal

Create all new database models and a single Alembic migration so that every subsequent plan (Plans 2 through 8) has its tables ready. This plan touches only the backend; no frontend changes are needed.

After this plan is executed, the database will contain five new tables (`folders`, `critical_terms`, `term_occurrences`, `thinker_mentions`, `thinker_co_occurrences`) and the existing `notes` table will have a new `folder_id` column.

---

## Dependencies

**None.** This is Plan 1 -- the foundation that everything else depends on.

---

## Audit Notes (2026-02-13)

1. `Folder.notes` must not use `delete-orphan` if `Note.folder_id` uses `ondelete="SET NULL"`.
2. `ThinkerCoOccurrence` is created in this plan, but populated by Plan 8 logic called from Plan 4's detection flow.
3. Plan 7 primarily depends on `CriticalTerm` + `TermOccurrence` + `ThinkerMention`; it does not read `ThinkerCoOccurrence`.

---

## Existing Patterns to Follow

All new model files must match the conventions already established in the codebase:

| Convention | Example from existing code |
|---|---|
| UUID primary keys using `GUID` type | `id = Column(GUID, primary_key=True, default=uuid.uuid4)` |
| Timestamps with server defaults | `created_at = Column(TIMESTAMP, server_default=func.now())` |
| Updated-at with `onupdate` | `updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())` |
| Import `Base` from `app.database` | `from app.database import Base` |
| Import `GUID` from `app.db_types` | `from app.db_types import GUID` |
| `relationship()` with `back_populates` | `thinker = relationship("Thinker", back_populates="notes")` |
| Owned relationships with cascade | `cascade="all, delete-orphan"` |
| Self-referential FK with `remote_side` | See `ResearchQuestion.sub_questions` in `research_question.py` |
| `ondelete` on ForeignKey, not Column | `ForeignKey("thinkers.id", ondelete="CASCADE")` |

---

## New Model Files

### File 1: `backend/app/models/folder.py`

```python
from sqlalchemy import Column, String, Integer, TIMESTAMP, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.database import Base
from app.db_types import GUID


class Folder(Base):
    """Hierarchical folder structure for organizing research notes."""
    __tablename__ = "folders"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    parent_id = Column(GUID, ForeignKey("folders.id", ondelete="CASCADE"), nullable=True)
    sort_order = Column(Integer, default=0)
    color = Column(String, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    # Relationships
    children = relationship(
        "Folder",
        backref="parent",
        remote_side=[id],
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    notes = relationship(
        "Note",
        back_populates="folder",
    )
```

**Column reference:**

| Column | Type | Nullable | Default | FK / Constraint |
|---|---|---|---|---|
| `id` | GUID (PK) | No | `uuid.uuid4` | -- |
| `name` | String | No | -- | -- |
| `parent_id` | GUID | Yes | `None` | FK `folders.id` ON DELETE CASCADE |
| `sort_order` | Integer | Yes | `0` | -- |
| `color` | String | Yes | `None` | -- |
| `created_at` | TIMESTAMP | No | `func.now()` | -- |
| `updated_at` | TIMESTAMP | No | `func.now()` | onupdate `func.now()` |

**Relationships:**

| Name | Target | Type | Cascade | Notes |
|---|---|---|---|---|
| `children` | `Folder` | Self-referential 1:M | `all, delete-orphan` | Uses `backref="parent"` and `remote_side=[id]` |
| `notes` | `Note` | 1:M | none | Notes are preserved and become unfiled on folder delete |

**Design note on cascade:** Folder hierarchy cascades across `Folder.parent_id` only. Notes do not cascade-delete with folders. `Note.folder_id` uses `ondelete="SET NULL"` so deleting a folder preserves note data and moves notes into the unfiled state.

**Important note on self-referential relationship:** The `backref="parent"` on the `children` relationship automatically creates the reverse `parent` attribute on each `Folder` instance. Do NOT add a separate `parent = relationship(...)` line -- that would conflict with the backref. This matches the pattern used in `research_question.py` where `sub_questions` uses `backref="parent_question"`.

---

### File 2: `backend/app/models/critical_term.py`

```python
from sqlalchemy import Column, String, Integer, Boolean, Text, TIMESTAMP, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.database import Base
from app.db_types import GUID


class CriticalTerm(Base):
    """A philosophical or domain-specific term that Stephanie wants to track across notes."""
    __tablename__ = "critical_terms"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False, unique=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    # Relationships
    occurrences = relationship(
        "TermOccurrence",
        back_populates="term",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class TermOccurrence(Base):
    """A single occurrence of a critical term within a specific note."""
    __tablename__ = "term_occurrences"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    term_id = Column(GUID, ForeignKey("critical_terms.id", ondelete="CASCADE"), nullable=False)
    note_id = Column(GUID, ForeignKey("notes.id", ondelete="CASCADE"), nullable=False)
    context_snippet = Column(Text, nullable=False)  # ~200-char window around the match
    paragraph_index = Column(Integer, nullable=True)  # 0-based index of the paragraph
    char_offset = Column(Integer, nullable=True)  # Character offset within the note content
    created_at = Column(TIMESTAMP, server_default=func.now())

    # Relationships
    term = relationship("CriticalTerm", back_populates="occurrences")
    note = relationship("Note", backref="term_occurrences")
```

**CriticalTerm column reference:**

| Column | Type | Nullable | Default | FK / Constraint |
|---|---|---|---|---|
| `id` | GUID (PK) | No | `uuid.uuid4` | -- |
| `name` | String | No | -- | UNIQUE |
| `description` | Text | Yes | `None` | -- |
| `is_active` | Boolean | No | `True` | -- |
| `created_at` | TIMESTAMP | No | `func.now()` | -- |
| `updated_at` | TIMESTAMP | No | `func.now()` | onupdate `func.now()` |

**TermOccurrence column reference:**

| Column | Type | Nullable | Default | FK / Constraint |
|---|---|---|---|---|
| `id` | GUID (PK) | No | `uuid.uuid4` | -- |
| `term_id` | GUID | No | -- | FK `critical_terms.id` ON DELETE CASCADE |
| `note_id` | GUID | No | -- | FK `notes.id` ON DELETE CASCADE |
| `context_snippet` | Text | No | -- | ~200-char window around the match |
| `paragraph_index` | Integer | Yes | `None` | 0-based paragraph index |
| `char_offset` | Integer | Yes | `None` | Character offset in note content |
| `created_at` | TIMESTAMP | No | `func.now()` | -- |

**Relationships:**

| Model | Name | Target | Type | Cascade |
|---|---|---|---|---|
| `CriticalTerm` | `occurrences` | `TermOccurrence` | 1:M | `all, delete-orphan` |
| `TermOccurrence` | `term` | `CriticalTerm` | M:1 | -- |
| `TermOccurrence` | `note` | `Note` | M:1 | -- (uses `backref="term_occurrences"`) |

**Design note on `context_snippet`:** This stores approximately 200 characters of surrounding text centered on the term match. This allows the UI to show context without re-scanning the full note content every time. The snippet is generated at scan time by Plan 5 (Critical Terms System).

---

### File 3: `backend/app/models/thinker_mention.py`

```python
from sqlalchemy import Column, String, Integer, Boolean, Text, TIMESTAMP, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.database import Base
from app.db_types import GUID


class ThinkerMention(Base):
    """A detected or manual mention of a thinker within a specific note.

    Unlike the existing note_mentions junction table (which is a simple M:M),
    this model stores positional metadata about WHERE in the note the mention
    occurs, enabling paragraph-level co-occurrence analysis.
    """
    __tablename__ = "thinker_mentions"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    note_id = Column(GUID, ForeignKey("notes.id", ondelete="CASCADE"), nullable=False)
    thinker_id = Column(GUID, ForeignKey("thinkers.id", ondelete="CASCADE"), nullable=False)
    paragraph_index = Column(Integer, nullable=True)  # 0-based index of the paragraph
    char_offset = Column(Integer, nullable=True)  # Character offset within the note content
    mention_text = Column(String, nullable=False)  # The exact text that was matched (e.g., "Heidegger")
    is_auto_detected = Column(Boolean, default=False)  # True if detected by auto-scan, False if manual
    created_at = Column(TIMESTAMP, server_default=func.now())

    # Relationships
    note = relationship("Note", backref="thinker_mention_records")
    thinker = relationship("Thinker", backref="mention_records")


class ThinkerCoOccurrence(Base):
    """Records that two thinkers are mentioned together in the same note or paragraph.

    Convention: thinker_a_id < thinker_b_id (lexicographically by UUID hex).
    This is enforced in application code, not at the database level, to avoid
    duplicate pairs like (A,B) and (B,A).
    """
    __tablename__ = "thinker_co_occurrences"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    thinker_a_id = Column(GUID, ForeignKey("thinkers.id", ondelete="CASCADE"), nullable=False)
    thinker_b_id = Column(GUID, ForeignKey("thinkers.id", ondelete="CASCADE"), nullable=False)
    note_id = Column(GUID, ForeignKey("notes.id", ondelete="CASCADE"), nullable=False)
    paragraph_index = Column(Integer, nullable=True)  # NULL means note-level co-occurrence
    co_occurrence_type = Column(String, default="same_note")  # "same_note" | "same_paragraph"
    created_at = Column(TIMESTAMP, server_default=func.now())

    # Unique constraint: no duplicate co-occurrence records for the same pair in the same context
    __table_args__ = (
        UniqueConstraint(
            "thinker_a_id", "thinker_b_id", "note_id", "paragraph_index",
            name="uq_co_occurrence_pair_note_paragraph"
        ),
    )

    # Relationships
    thinker_a = relationship("Thinker", foreign_keys=[thinker_a_id], backref="co_occurrences_as_a")
    thinker_b = relationship("Thinker", foreign_keys=[thinker_b_id], backref="co_occurrences_as_b")
    note = relationship("Note", backref="thinker_co_occurrences")
```

**ThinkerMention column reference:**

| Column | Type | Nullable | Default | FK / Constraint |
|---|---|---|---|---|
| `id` | GUID (PK) | No | `uuid.uuid4` | -- |
| `note_id` | GUID | No | -- | FK `notes.id` ON DELETE CASCADE |
| `thinker_id` | GUID | No | -- | FK `thinkers.id` ON DELETE CASCADE |
| `paragraph_index` | Integer | Yes | `None` | 0-based paragraph index |
| `char_offset` | Integer | Yes | `None` | Character offset in note content |
| `mention_text` | String | No | -- | The exact matched text |
| `is_auto_detected` | Boolean | No | `False` | True = auto-scan, False = manual |
| `created_at` | TIMESTAMP | No | `func.now()` | -- |

**ThinkerCoOccurrence column reference:**

| Column | Type | Nullable | Default | FK / Constraint |
|---|---|---|---|---|
| `id` | GUID (PK) | No | `uuid.uuid4` | -- |
| `thinker_a_id` | GUID | No | -- | FK `thinkers.id` ON DELETE CASCADE |
| `thinker_b_id` | GUID | No | -- | FK `thinkers.id` ON DELETE CASCADE |
| `note_id` | GUID | No | -- | FK `notes.id` ON DELETE CASCADE |
| `paragraph_index` | Integer | Yes | `None` | NULL = note-level |
| `co_occurrence_type` | String | No | `"same_note"` | `same_note` or `same_paragraph` |
| `created_at` | TIMESTAMP | No | `func.now()` | -- |

**Constraints:**

| Constraint | Type | Columns | Name |
|---|---|---|---|
| Unique | `UniqueConstraint` | `thinker_a_id`, `thinker_b_id`, `note_id`, `paragraph_index` | `uq_co_occurrence_pair_note_paragraph` |

**Relationships:**

| Model | Name | Target | Type | Notes |
|---|---|---|---|---|
| `ThinkerMention` | `note` | `Note` | M:1 | backref `thinker_mention_records` on Note |
| `ThinkerMention` | `thinker` | `Thinker` | M:1 | backref `mention_records` on Thinker |
| `ThinkerCoOccurrence` | `thinker_a` | `Thinker` | M:1 | Uses `foreign_keys=[thinker_a_id]` |
| `ThinkerCoOccurrence` | `thinker_b` | `Thinker` | M:1 | Uses `foreign_keys=[thinker_b_id]` |
| `ThinkerCoOccurrence` | `note` | `Note` | M:1 | backref `thinker_co_occurrences` on Note |

**Design note on ordering convention:** `thinker_a_id < thinker_b_id` is enforced at the application layer in the co-occurrence computation utility (Plan 8), which is called from Plan 4's detection flow. Before inserting, compare UUID hex strings and swap if needed so the unique constraint catches true duplicates.

**Design note on `paragraph_index` in the unique constraint:** When `paragraph_index` is `NULL`, this represents a note-level co-occurrence. SQLite treats each `NULL` as distinct in unique constraints, so two note-level records for the same thinker pair in the same note would NOT be caught by the constraint. The Plan 8 co-occurrence writer must deduplicate note-level pairs in application code before insert.

---

## Existing Model Modifications

### Modification 1: `backend/app/models/note.py`

Add the `folder_id` column and `folder` relationship to the `Note` model.

**What to add** (insert after the `is_canvas_note` column, before `created_at`):

```python
    # Folder organization
    folder_id = Column(GUID, ForeignKey("folders.id", ondelete="SET NULL"), nullable=True)
```

**What to add** (insert after the `thinker` relationship, before `mentioned_thinkers`):

```python
    folder = relationship("Folder", back_populates="notes")
```

**Full diff for `note.py`:**

```diff
--- a/backend/app/models/note.py
+++ b/backend/app/models/note.py
@@ -32,6 +32,9 @@
     color = Column(String, default="yellow")  # Sticky note color: yellow, pink, blue, green
     is_canvas_note = Column(Boolean, default=False)  # True for canvas notes, False for panel-only

+    # Folder organization
+    folder_id = Column(GUID, ForeignKey("folders.id", ondelete="SET NULL"), nullable=True)
+
     created_at = Column(TIMESTAMP, server_default=func.now())
     updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

@@ -39,6 +42,7 @@
     thinker = relationship("Thinker", back_populates="notes")
+    folder = relationship("Folder", back_populates="notes")
     mentioned_thinkers = relationship(
         "Thinker",
         secondary=note_mentions,
```

**Why `ondelete="SET NULL"` here instead of CASCADE:** If a folder is deleted, we do not want to lose notes inside it. They become unfiled (`folder_id = NULL`) and still appear in all-notes views. This is safer for research data retention.

**Important reconciliation:** The `Folder.notes` relationship must remain non-owning (no `delete-orphan`) to stay consistent with `ondelete="SET NULL"`.

```python
    notes = relationship(
        "Note",
        back_populates="folder",
    )
```

This way:
- Deleting a folder via the ORM leaves notes intact (they become unfiled, `folder_id` set to NULL by the database).
- No SQLAlchemy orphan errors when a note's folder is deleted.

**Revised `backend/app/models/folder.py`** (reflecting this correction):

```python
from sqlalchemy import Column, String, Integer, TIMESTAMP, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.database import Base
from app.db_types import GUID


class Folder(Base):
    """Hierarchical folder structure for organizing research notes."""
    __tablename__ = "folders"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    parent_id = Column(GUID, ForeignKey("folders.id", ondelete="CASCADE"), nullable=True)
    sort_order = Column(Integer, default=0)
    color = Column(String, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    # Relationships
    children = relationship(
        "Folder",
        backref="parent",
        remote_side=[id],
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    notes = relationship(
        "Note",
        back_populates="folder",
    )
```

---

### Modification 2: `backend/app/models/__init__.py`

Add imports for all new models and include them in `__all__`.

**Full updated file:**

```python
from app.models.timeline import Timeline
from app.models.timeline_event import TimelineEvent
from app.models.combined_timeline_view import CombinedTimelineView
from app.models.combined_view_member import CombinedViewMember
from app.models.thinker import Thinker
from app.models.publication import Publication, PublicationType, ContributorRole, publication_contributors
from app.models.quote import Quote
from app.models.tag import Tag, thinker_tags
from app.models.connection import Connection, ConnectionType
from app.models.institution import Institution, ThinkerInstitution
from app.models.note import Note, NoteVersion, note_mentions
from app.models.research_question import ResearchQuestion, research_question_thinkers
from app.models.quiz import (
    QuizQuestion,
    QuizSession,
    QuizAnswer,
    SpacedRepetitionQueue,
    QuestionCategory,
    QuestionType,
    Difficulty,
)
from app.models.folder import Folder
from app.models.critical_term import CriticalTerm, TermOccurrence
from app.models.thinker_mention import ThinkerMention, ThinkerCoOccurrence

__all__ = [
    "Timeline",
    "TimelineEvent",
    "CombinedTimelineView",
    "CombinedViewMember",
    "Thinker",
    "Publication",
    "PublicationType",
    "ContributorRole",
    "publication_contributors",
    "Quote",
    "Tag",
    "thinker_tags",
    "Connection",
    "ConnectionType",
    "Institution",
    "ThinkerInstitution",
    "Note",
    "NoteVersion",
    "note_mentions",
    "ResearchQuestion",
    "research_question_thinkers",
    # Quiz
    "QuizQuestion",
    "QuizSession",
    "QuizAnswer",
    "SpacedRepetitionQueue",
    "QuestionCategory",
    "QuestionType",
    "Difficulty",
    # Research Notes System (Plan 1)
    "Folder",
    "CriticalTerm",
    "TermOccurrence",
    "ThinkerMention",
    "ThinkerCoOccurrence",
]
```

**Diff:**

```diff
--- a/backend/app/models/__init__.py
+++ b/backend/app/models/__init__.py
@@ -18,6 +18,9 @@
     QuestionType,
     Difficulty,
 )
+from app.models.folder import Folder
+from app.models.critical_term import CriticalTerm, TermOccurrence
+from app.models.thinker_mention import ThinkerMention, ThinkerCoOccurrence

 __all__ = [
     "Timeline",
@@ -50,4 +53,10 @@
     "QuestionType",
     "Difficulty",
+    # Research Notes System (Plan 1)
+    "Folder",
+    "CriticalTerm",
+    "TermOccurrence",
+    "ThinkerMention",
+    "ThinkerCoOccurrence",
 ]
```

---

## Migration

### Generate

After creating all three new model files and modifying `note.py` and `__init__.py`, generate the migration:

```bash
cd backend
alembic revision --autogenerate -m "add_research_notes_models"
```

### What Alembic should auto-detect

The autogenerated migration should contain:

1. **`CREATE TABLE folders`** -- with all columns including self-referential FK `parent_id`
2. **`CREATE TABLE critical_terms`** -- with unique constraint on `name`
3. **`CREATE TABLE term_occurrences`** -- with FKs to `critical_terms` and `notes`
4. **`CREATE TABLE thinker_mentions`** -- with FKs to `notes` and `thinkers`
5. **`CREATE TABLE thinker_co_occurrences`** -- with FKs to `thinkers` (x2) and `notes`, plus the named unique constraint
6. **`ALTER TABLE notes ADD COLUMN folder_id`** -- nullable FK to `folders`

### Review the migration before applying

Open the generated file in `backend/alembic/versions/` and verify:

- All five tables are created
- The `folder_id` column is added to `notes`
- The `UniqueConstraint` on `thinker_co_occurrences` has the correct name `uq_co_occurrence_pair_note_paragraph`
- The `unique=True` on `critical_terms.name` is present
- All `ondelete` clauses match the model definitions (CASCADE for most, SET NULL for `notes.folder_id`)
- The `downgrade()` function drops the tables in reverse order and removes the `folder_id` column

### Apply

```bash
cd backend
alembic upgrade head
```

---

## Verification Steps

After running `alembic upgrade head`, verify the migration succeeded:

### 1. Check that all tables exist

```bash
cd backend
sqlite3 intellectual_graph.db ".tables"
```

Expected output should include (among existing tables):
```
folders
critical_terms
term_occurrences
thinker_mentions
thinker_co_occurrences
```

### 2. Inspect table schemas

```bash
sqlite3 intellectual_graph.db ".schema folders"
sqlite3 intellectual_graph.db ".schema critical_terms"
sqlite3 intellectual_graph.db ".schema term_occurrences"
sqlite3 intellectual_graph.db ".schema thinker_mentions"
sqlite3 intellectual_graph.db ".schema thinker_co_occurrences"
```

Verify each table has the expected columns, types, and constraints.

### 3. Verify `folder_id` was added to `notes`

```bash
sqlite3 intellectual_graph.db "PRAGMA table_info(notes);"
```

Look for a `folder_id` column of type `CHAR(32)` (the GUID type on SQLite) that is nullable.

### 4. Verify foreign key constraints work

```bash
sqlite3 intellectual_graph.db "PRAGMA foreign_keys = ON;"
```

Then test:

```sql
-- Create a test folder
INSERT INTO folders (id, name, sort_order) VALUES ('a' || substr(hex(randomblob(15)),1,31), 'Test Folder', 0);

-- Verify it exists
SELECT * FROM folders;

-- Create a child folder referencing the parent
INSERT INTO folders (id, name, parent_id, sort_order) VALUES ('b' || substr(hex(randomblob(15)),1,31), 'Child', (SELECT id FROM folders LIMIT 1), 0);

-- Verify cascade: delete parent, child should be gone too
DELETE FROM folders WHERE name = 'Test Folder';
SELECT * FROM folders;  -- Should be empty
```

### 5. Verify unique constraint on `critical_terms.name`

```sql
INSERT INTO critical_terms (id, name, is_active) VALUES ('c' || substr(hex(randomblob(15)),1,31), 'Dasein', 1);
INSERT INTO critical_terms (id, name, is_active) VALUES ('d' || substr(hex(randomblob(15)),1,31), 'Dasein', 1);
-- Second insert should fail with UNIQUE constraint error
```

### 6. Verify unique constraint on `thinker_co_occurrences`

```sql
-- Insert a co-occurrence record (use real thinker and note IDs from existing data)
-- Then try to insert a duplicate with the same (thinker_a_id, thinker_b_id, note_id, paragraph_index)
-- The second insert should fail with UNIQUE constraint error
```

---

## File Summary

| Action | File | What changes |
|---|---|---|
| **CREATE** | `backend/app/models/folder.py` | `Folder` model (7 columns, 2 relationships) |
| **CREATE** | `backend/app/models/critical_term.py` | `CriticalTerm` model (6 columns, 1 relationship) + `TermOccurrence` model (6 columns, 2 relationships) |
| **CREATE** | `backend/app/models/thinker_mention.py` | `ThinkerMention` model (7 columns, 2 relationships) + `ThinkerCoOccurrence` model (6 columns, 3 relationships, 1 unique constraint) |
| **MODIFY** | `backend/app/models/note.py` | Add `folder_id` column + `folder` relationship |
| **MODIFY** | `backend/app/models/__init__.py` | Import and export 5 new symbols |
| **GENERATE** | `backend/alembic/versions/<hash>_add_research_notes_models.py` | Alembic migration (auto-generated) |

**Total: 3 new files, 2 modified files, 1 auto-generated migration file.**

---

## Entity Relationship Diagram (Text)

```
┌─────────────┐         ┌─────────────┐
│   Folder    │ 1:M     │    Note     │
│─────────────│────────►│─────────────│
│ id (PK)     │         │ id (PK)     │
│ name        │         │ folder_id   │◄── NEW COLUMN
│ parent_id   │◄─┐      │ thinker_id  │
│ sort_order  │  │      │ title       │
│ color       │  │      │ content     │
│ created_at  │  │ self  │ ...         │
│ updated_at  │  │ ref   └──────┬──────┘
└─────────────┘  │             │
       ▲         │             │ 1:M          1:M
       └─────────┘             │              │
                               ▼              ▼
                    ┌──────────────────┐  ┌──────────────────┐
                    │ ThinkerMention   │  │ TermOccurrence   │
                    │──────────────────│  │──────────────────│
                    │ id (PK)          │  │ id (PK)          │
                    │ note_id (FK)     │  │ term_id (FK)     │
                    │ thinker_id (FK)  │  │ note_id (FK)     │
                    │ paragraph_index  │  │ context_snippet  │
                    │ char_offset      │  │ paragraph_index  │
                    │ mention_text     │  │ char_offset      │
                    │ is_auto_detected │  │ created_at       │
                    │ created_at       │  └────────┬─────────┘
                    └────────┬─────────┘           │
                             │                     │ M:1
                             │                     ▼
                             │           ┌──────────────────┐
                             │           │  CriticalTerm    │
                             │           │──────────────────│
                             │           │ id (PK)          │
                             │           │ name (UNIQUE)    │
                             │           │ description      │
                             │           │ is_active        │
                             │           │ created_at       │
                             │           │ updated_at       │
                             │           └──────────────────┘
                             │
                             │ M:1
                             ▼
                    ┌──────────────────────────┐
                    │      Thinker             │
                    │──────────────────────────│
                    │ id (PK)                  │
                    │ name                     │
                    │ ...                      │
                    └──────────┬───────────────┘
                               │
                               │ (both thinker_a and thinker_b FK)
                               ▼
                    ┌──────────────────────────┐
                    │ ThinkerCoOccurrence      │
                    │──────────────────────────│
                    │ id (PK)                  │
                    │ thinker_a_id (FK)        │
                    │ thinker_b_id (FK)        │
                    │ note_id (FK)             │
                    │ paragraph_index          │
                    │ co_occurrence_type       │
                    │ created_at               │
                    │──────────────────────────│
                    │ UQ: (a_id, b_id,         │
                    │      note_id, para_idx)  │
                    └──────────────────────────┘
```

---

## Relationship to Existing `note_mentions` Table

The existing `note_mentions` junction table (in `note.py`) provides a simple many-to-many link between notes and thinkers for the wiki-style `[[Thinker Name]]` mention feature. It has no positional metadata.

The new `ThinkerMention` model is NOT a replacement for `note_mentions`. They serve different purposes:

| | `note_mentions` (existing) | `ThinkerMention` (new) |
|---|---|---|
| **Purpose** | Wiki-link rendering in the note editor | Positional analysis and co-occurrence tracking |
| **Granularity** | Note-level (just "this note mentions this thinker") | Paragraph/character-level (WHERE in the note) |
| **Source** | Manual wiki-link insertion by user | Auto-detection scan (Plan 4) or manual |
| **Used by** | TipTap mention extension rendering | Constellation visualization (Plan 7), auto-connections (Plan 8) |

Both can coexist. Plan 4 will create `ThinkerMention` records from auto-detection and will also optionally sync to `note_mentions` for backward compatibility.

---

## Downstream Plan Dependencies

This table shows which models each subsequent plan needs:

| Plan | Needs from Plan 1 |
|---|---|
| **Plan 2: Folder System** | `Folder` model, `Note.folder_id` column |
| **Plan 3: Notes Page Foundation** | `Note.folder_id` (for folder-filtered views) |
| **Plan 4: Thinker Auto-Detection** | `ThinkerMention`, `ThinkerCoOccurrence` |
| **Plan 5: Critical Terms System** | `CriticalTerm`, `TermOccurrence` |
| **Plan 6: Term Definitions & Analysis** | `CriticalTerm`, `TermOccurrence` (reads only) |
| **Plan 7: Constellation Visualization** | `CriticalTerm`, `TermOccurrence`, `ThinkerMention` (reads only) |
| **Plan 8: Auto-Connection Suggestions** | `ThinkerCoOccurrence` (reads only) |

---

## Execution Checklist

- [ ] Create `backend/app/models/folder.py` with the `Folder` model
- [ ] Create `backend/app/models/critical_term.py` with `CriticalTerm` and `TermOccurrence` models
- [ ] Create `backend/app/models/thinker_mention.py` with `ThinkerMention` and `ThinkerCoOccurrence` models
- [ ] Modify `backend/app/models/note.py`: add `folder_id` column and `folder` relationship
- [ ] Ensure `Folder.notes` does **not** include `delete-orphan` cascade
- [ ] Modify `backend/app/models/__init__.py`: add imports and `__all__` entries
- [ ] Run `cd backend && alembic revision --autogenerate -m "add_research_notes_models"`
- [ ] Review the generated migration file for correctness
- [ ] Run `cd backend && alembic upgrade head`
- [ ] Run verification steps (tables exist, schemas correct, FKs work, constraints enforced)
- [ ] Run existing tests to confirm no regressions: `cd backend && pytest`
