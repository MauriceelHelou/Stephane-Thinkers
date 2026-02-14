# Plan 6: Term Definitions & Filtered Analysis

## Goal

Implement filtered term definitions from collected excerpts with optional DeepSeek synthesis. When Stephanie clicks a critical term, she sees all excerpts where it appears, grouped by thinker and folder, with optional AI synthesis behind a button click.

**The source of truth is Stephanie's notes.** Definitions come EXCLUSIVELY from her writing. The "collected excerpts" view is the primary experience. AI synthesis is an OPTIONAL secondary feature (behind a button click, using DeepSeek API). The system never imports external definitions or knowledge.

---

## Dependencies

**Requires Plan 5** (Critical Terms System) to be fully implemented. Plan 5 provides:
- `CriticalTerm` model with CRUD routes at `/api/critical-terms`
- `TermOccurrence` model with `context_snippet`, `note_id`, `term_id`, `paragraph_index`, `char_offset`
- Term scanning logic that populates `TermOccurrence` records when notes are saved
- `CriticalTermsList` sidebar component on the notes page

**Also requires from earlier plans:**
- Plan 1: `CriticalTerm`, `TermOccurrence`, `Folder`, `ThinkerMention` database tables
- Plan 2: `Folder` CRUD and tree UI
- Plan 3: Notes page foundation at `/notes` with left sidebar and right panel layout
- Plan 4: `ThinkerMention` records (used for grouping excerpts by thinker)

---

## Audit Notes (2026-02-13)

1. `backend/app/schemas/critical_term.py` is shared with Plan 5 and must be extended, not recreated.
2. `/notes` right-panel integration must use the shared mode contract from earlier plans.
3. `CriticalTermsList` integration uses `onSelectTerm`, not `onTermClick`.

---

## File Summary

| Action | File | What changes |
|--------|------|-------------|
| **MODIFY** | `backend/app/routes/critical_terms.py` | Add `GET /{term_id}/definition` endpoint |
| **MODIFY** | `backend/app/utils/ai_service.py` | Add `synthesize_term_definition()` function |
| **MODIFY** | `backend/app/schemas/critical_term.py` | Extend shared schema file with `ExcerptGroup`, `TermDefinitionResponse` |
| **MODIFY** | `backend/app/schemas/__init__.py` | Import new critical term schemas |
| **CREATE** | `frontend/src/components/notes/TermDefinitionPanel.tsx` | Right-panel component for term definition view |
| **CREATE** | `frontend/src/components/notes/ExcerptCard.tsx` | Individual excerpt display card |
| **CREATE** | `frontend/src/components/notes/SynthesisView.tsx` | AI synthesis request and display |
| **MODIFY** | `frontend/src/types/index.ts` | Add `ExcerptGroup`, `TermDefinition` interfaces |
| **MODIFY** | `frontend/src/lib/api.ts` | Add `criticalTermsApi.getDefinition()` |
| **MODIFY** | `frontend/src/app/notes/page.tsx` | Wire term click to open TermDefinitionPanel in right panel |

**Total: 3 new files, 7 modified files.**

---

## Backend: Response Schema

### Modification: `backend/app/schemas/critical_term.py`

This file defines all Pydantic schemas for the critical terms feature. Some base schemas may already exist inline in the routes file from Plan 5; this plan consolidates them into a proper schema file following the project pattern.

```python
from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID


# ─── Base schemas (may already exist from Plan 5; keep or move here) ───

class CriticalTermBase(BaseModel):
    name: str
    description: Optional[str] = None
    is_active: Optional[bool] = True


class CriticalTermCreate(CriticalTermBase):
    pass


class CriticalTermUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class CriticalTerm(CriticalTermBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime


class TermOccurrenceBase(BaseModel):
    context_snippet: str
    paragraph_index: Optional[int] = None
    char_offset: Optional[int] = None


class TermOccurrenceResponse(TermOccurrenceBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    term_id: UUID
    note_id: UUID
    created_at: datetime
    # Joined fields (populated by the definition endpoint, not from ORM directly)
    note_title: Optional[str] = None
    note_folder_name: Optional[str] = None
    note_folder_id: Optional[UUID] = None
    associated_thinkers: Optional[List[dict]] = None  # [{"id": "...", "name": "..."}]


# ─── Plan 6: Definition / Analysis schemas ───

class ExcerptGroup(BaseModel):
    """A group of excerpts under a common label (thinker name or folder name)."""
    group_name: str  # thinker name or folder name
    group_id: Optional[UUID] = None  # thinker_id or folder_id
    excerpts: List[TermOccurrenceResponse]
    excerpt_count: int


class TermDefinitionResponse(BaseModel):
    """Full definition payload: the term, grouped excerpts, and optional AI synthesis."""
    term: CriticalTerm
    excerpts_by_thinker: List[ExcerptGroup]
    excerpts_by_folder: List[ExcerptGroup]
    total_occurrences: int
    synthesis: Optional[str] = None  # Only populated if synthesize=True
    filter_context: str  # Human-readable: "all notes", "Pragmatism folder", etc.
    available_folders: List[dict] = Field(default_factory=list)  # [{"id": "...", "name": "..."}]
    available_thinkers: List[dict] = Field(default_factory=list)  # [{"id": "...", "name": "..."}]
```

### Modification: `backend/app/schemas/__init__.py`

Add the critical term schema imports. Insert after the existing quiz imports block:

```python
from app.schemas.critical_term import (
    CriticalTermBase,
    CriticalTermCreate,
    CriticalTermUpdate,
    CriticalTerm as CriticalTermSchema,
    TermOccurrenceBase,
    TermOccurrenceResponse,
    ExcerptGroup,
    TermDefinitionResponse,
)
```

And add to `__all__`:

```python
    # CriticalTerm (Plan 5 + 6)
    "CriticalTermBase",
    "CriticalTermCreate",
    "CriticalTermUpdate",
    "CriticalTermSchema",
    "TermOccurrenceBase",
    "TermOccurrenceResponse",
    "ExcerptGroup",
    "TermDefinitionResponse",
```

---

## Backend: Definition Endpoint

### Modification: `backend/app/routes/critical_terms.py`

Add the following endpoint to the existing critical terms router. This is the core endpoint of Plan 6. It fetches all occurrences of a term, groups them by thinker and folder, optionally applies filters, and optionally calls DeepSeek for synthesis.

```python
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import Optional, List
from uuid import UUID
from collections import defaultdict

from app.database import get_db
from app.models.critical_term import CriticalTerm, TermOccurrence
from app.models.note import Note
from app.models.folder import Folder
from app.models.thinker_mention import ThinkerMention
from app.models.thinker import Thinker
from app.schemas.critical_term import (
    TermOccurrenceResponse,
    ExcerptGroup,
    TermDefinitionResponse,
    CriticalTerm as CriticalTermSchema,
)
from app.utils.ai_service import synthesize_term_definition, is_ai_enabled, AIServiceError


# This endpoint is added to the existing router from Plan 5.
# The router is assumed to be: router = APIRouter(prefix="/api/critical-terms", tags=["critical-terms"])


@router.get("/{term_id}/definition", response_model=TermDefinitionResponse)
async def get_term_definition(
    term_id: UUID,
    folder_id: Optional[UUID] = Query(None, description="Filter occurrences to a specific folder"),
    thinker_id: Optional[UUID] = Query(None, description="Filter occurrences to a specific thinker"),
    synthesize: bool = Query(False, description="If true, call DeepSeek to synthesize a definition"),
    db: Session = Depends(get_db),
):
    """
    Get a comprehensive definition view for a critical term.

    Returns all excerpts where the term appears, grouped by thinker and by folder.
    Optionally filters by folder_id or thinker_id.
    Optionally synthesizes a scholarly definition from the excerpts using DeepSeek.

    The source of truth is Stephanie's notes. This endpoint never imports
    external definitions -- it only collects and organizes what she has written.
    """

    # ── 1. Fetch the term ──
    term = db.query(CriticalTerm).filter(CriticalTerm.id == term_id).first()
    if not term:
        raise HTTPException(status_code=404, detail="Critical term not found")

    # ── 2. Query occurrences with joins ──
    query = (
        db.query(TermOccurrence)
        .join(Note, TermOccurrence.note_id == Note.id)
        .options(joinedload(TermOccurrence.note))
        .filter(TermOccurrence.term_id == term_id)
    )

    # ── 3. Apply folder filter ──
    if folder_id:
        query = query.filter(Note.folder_id == folder_id)

    # ── 4. Apply thinker filter ──
    # If filtering by thinker, we need notes that have a ThinkerMention for this thinker
    if thinker_id:
        query = query.join(
            ThinkerMention,
            ThinkerMention.note_id == TermOccurrence.note_id,
        ).filter(ThinkerMention.thinker_id == thinker_id)

    occurrences = query.order_by(TermOccurrence.created_at.desc()).all()

    # ── 5. Build enriched occurrence responses ──
    # Pre-fetch all related data to avoid N+1 queries
    note_ids = list({occ.note_id for occ in occurrences})

    # Get folder info for all relevant notes
    notes_with_folders = (
        db.query(Note.id, Note.title, Note.folder_id, Folder.name.label("folder_name"))
        .outerjoin(Folder, Note.folder_id == Folder.id)
        .filter(Note.id.in_(note_ids))
        .all()
    ) if note_ids else []

    note_info_map = {
        row.id: {
            "title": row.title,
            "folder_id": row.folder_id,
            "folder_name": row.folder_name,
        }
        for row in notes_with_folders
    }

    # Get thinker mentions for all relevant notes
    mentions = (
        db.query(ThinkerMention.note_id, Thinker.id.label("thinker_id"), Thinker.name.label("thinker_name"))
        .join(Thinker, ThinkerMention.thinker_id == Thinker.id)
        .filter(ThinkerMention.note_id.in_(note_ids))
        .all()
    ) if note_ids else []

    # Build note_id -> [{"id": ..., "name": ...}] mapping
    note_thinkers_map = defaultdict(list)
    seen_note_thinker = set()
    for m in mentions:
        key = (m.note_id, m.thinker_id)
        if key not in seen_note_thinker:
            seen_note_thinker.add(key)
            note_thinkers_map[m.note_id].append({
                "id": str(m.thinker_id),
                "name": m.thinker_name,
            })

    # Build enriched responses
    enriched_occurrences: List[TermOccurrenceResponse] = []
    for occ in occurrences:
        info = note_info_map.get(occ.note_id, {})
        enriched_occurrences.append(TermOccurrenceResponse(
            id=occ.id,
            term_id=occ.term_id,
            note_id=occ.note_id,
            context_snippet=occ.context_snippet,
            paragraph_index=occ.paragraph_index,
            char_offset=occ.char_offset,
            created_at=occ.created_at,
            note_title=info.get("title"),
            note_folder_name=info.get("folder_name"),
            note_folder_id=info.get("folder_id"),
            associated_thinkers=note_thinkers_map.get(occ.note_id, []),
        ))

    # ── 6. Group by thinker ──
    thinker_groups: dict = defaultdict(list)
    ungrouped_by_thinker: list = []

    for exc in enriched_occurrences:
        if exc.associated_thinkers:
            for thinker_info in exc.associated_thinkers:
                thinker_groups[thinker_info["id"]].append((thinker_info["name"], exc))
        else:
            ungrouped_by_thinker.append(exc)

    excerpts_by_thinker: List[ExcerptGroup] = []
    for tid, items in thinker_groups.items():
        thinker_name = items[0][0]  # All items share the same thinker name
        group_excerpts = [item[1] for item in items]
        excerpts_by_thinker.append(ExcerptGroup(
            group_name=thinker_name,
            group_id=UUID(tid),
            excerpts=group_excerpts,
            excerpt_count=len(group_excerpts),
        ))

    # Sort by excerpt count descending (most referenced thinker first)
    excerpts_by_thinker.sort(key=lambda g: g.excerpt_count, reverse=True)

    # Add "Unattributed" group if there are excerpts without thinker mentions
    if ungrouped_by_thinker:
        excerpts_by_thinker.append(ExcerptGroup(
            group_name="Unattributed",
            group_id=None,
            excerpts=ungrouped_by_thinker,
            excerpt_count=len(ungrouped_by_thinker),
        ))

    # ── 7. Group by folder ──
    folder_groups: dict = defaultdict(list)
    unfiled: list = []

    for exc in enriched_occurrences:
        if exc.note_folder_id and exc.note_folder_name:
            folder_groups[(str(exc.note_folder_id), exc.note_folder_name)].append(exc)
        else:
            unfiled.append(exc)

    excerpts_by_folder: List[ExcerptGroup] = []
    for (fid, fname), group_excerpts in folder_groups.items():
        excerpts_by_folder.append(ExcerptGroup(
            group_name=fname,
            group_id=UUID(fid),
            excerpts=group_excerpts,
            excerpt_count=len(group_excerpts),
        ))

    excerpts_by_folder.sort(key=lambda g: g.excerpt_count, reverse=True)

    if unfiled:
        excerpts_by_folder.append(ExcerptGroup(
            group_name="Unfiled",
            group_id=None,
            excerpts=unfiled,
            excerpt_count=len(unfiled),
        ))

    # ── 8. Build filter context string ──
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

    # ── 9. Build available filters (for dropdowns) ──
    # Get all folders that contain this term (unfiltered)
    all_folder_ids = (
        db.query(Folder.id, Folder.name)
        .join(Note, Note.folder_id == Folder.id)
        .join(TermOccurrence, TermOccurrence.note_id == Note.id)
        .filter(TermOccurrence.term_id == term_id)
        .distinct()
        .all()
    )
    available_folders = [{"id": str(f.id), "name": f.name} for f in all_folder_ids]

    # Get all thinkers associated with this term (unfiltered)
    all_thinker_ids = (
        db.query(Thinker.id, Thinker.name)
        .join(ThinkerMention, ThinkerMention.thinker_id == Thinker.id)
        .join(TermOccurrence, TermOccurrence.note_id == ThinkerMention.note_id)
        .filter(TermOccurrence.term_id == term_id)
        .distinct()
        .all()
    )
    available_thinkers = [{"id": str(t.id), "name": t.name} for t in all_thinker_ids]

    # ── 10. Optional DeepSeek synthesis ──
    synthesis = None
    if synthesize:
        if not is_ai_enabled():
            synthesis = "[Synthesis unavailable: AI is not enabled in this environment.]"
        else:
            # Build excerpt dicts for the synthesis function
            excerpt_dicts = []
            for exc in enriched_occurrences:
                excerpt_dicts.append({
                    "context_snippet": exc.context_snippet,
                    "note_title": exc.note_title or "Untitled note",
                    "folder_name": exc.note_folder_name or "Unfiled",
                    "associated_thinkers": [t["name"] for t in (exc.associated_thinkers or [])],
                })

            try:
                synthesis = await synthesize_term_definition(
                    term_name=term.name,
                    excerpts=excerpt_dicts,
                    filter_context=filter_context,
                )
            except AIServiceError as e:
                # Don't fail the whole request if synthesis fails -- return excerpts without it
                synthesis = f"[Synthesis unavailable: {e.message}]"

    # ── 11. Return structured response ──
    return TermDefinitionResponse(
        term=CriticalTermSchema.model_validate(term),
        excerpts_by_thinker=excerpts_by_thinker,
        excerpts_by_folder=excerpts_by_folder,
        total_occurrences=len(enriched_occurrences),
        synthesis=synthesis,
        filter_context=filter_context,
        available_folders=available_folders,
        available_thinkers=available_thinkers,
    )
```

**Key design decisions:**

1. **Single endpoint, multiple groupings.** Rather than separate endpoints for "by thinker" and "by folder," we return both in one response. The frontend toggles between tabs client-side. This avoids duplicate network requests.

2. **Filters are query params, not path params.** `folder_id` and `thinker_id` are optional filters. When both are provided, they are ANDed together.

3. **Available filters returned in response.** The `available_folders` and `available_thinkers` fields give the frontend what it needs for the filter dropdowns without a separate request.

4. **Synthesis is opt-in via `synthesize=true`.** The default is `false`. This ensures that the primary experience (collected excerpts) always loads instantly, and AI synthesis only fires when Stephanie explicitly requests it.

5. **Graceful synthesis failure.** If DeepSeek fails, the endpoint still returns the excerpts with a bracketed error message in the `synthesis` field rather than a 500 error.

---

## Backend: DeepSeek Synthesis Function

### Modification: `backend/app/utils/ai_service.py`

Add the following function after the existing `generate_summary` function:

```python
async def synthesize_term_definition(
    term_name: str,
    excerpts: List[Dict[str, Any]],
    filter_context: str = "all notes",
) -> str:
    """
    Synthesize a coherent scholarly definition from collected excerpts.

    The definition is based EXCLUSIVELY on the provided excerpts from the
    student's own notes. No external knowledge is added.

    Args:
        term_name: The critical term being defined (e.g., "Dasein", "habit")
        excerpts: List of dicts, each containing:
            - context_snippet: ~200-char text around the term
            - note_title: Title of the source note
            - folder_name: Name of the folder containing the note
            - associated_thinkers: List of thinker names mentioned in the note
        filter_context: Human-readable description of active filters
            (e.g., "all notes", "Pragmatism folder", "notes mentioning James")

    Returns:
        Synthesized definition text (markdown-formatted).

    Raises:
        AIServiceError: If the API call fails.
    """
    if not is_ai_enabled():
        raise AIServiceError(
            "AI features not enabled",
            "DEEPSEEK_API_KEY environment variable is not set",
        )

    if not excerpts:
        return f"No excerpts found for \"{term_name}\" in {filter_context}. Add more notes containing this term to enable synthesis."

    # ── Build the excerpt context ──
    formatted_excerpts = []
    for i, exc in enumerate(excerpts[:30], 1):  # Limit to 30 excerpts to stay within context window
        thinkers_str = ", ".join(exc.get("associated_thinkers", [])) or "no specific thinker"
        formatted_excerpts.append(
            f"Excerpt {i} (from \"{exc['note_title']}\" in {exc['folder_name']}, "
            f"associated with {thinkers_str}):\n"
            f"\"{exc['context_snippet']}\""
        )

    excerpts_text = "\n\n".join(formatted_excerpts)

    system_prompt = (
        "You are a scholarly research assistant helping a PhD student organize their notes "
        "on intellectual history. Your task is to synthesize a definition of a critical term "
        "based ONLY on the provided excerpts from the student's own notes.\n\n"
        "Rules:\n"
        "1. Do NOT add external knowledge, definitions, or interpretations beyond what the excerpts contain.\n"
        "2. Attribute ideas to specific thinkers when the excerpts mention them.\n"
        "3. Note any tensions or contradictions between different uses of the term.\n"
        "4. Use scholarly but accessible language.\n"
        "5. Structure the synthesis as: (a) a concise definition, (b) key nuances across thinkers, "
        "(c) any unresolved questions or tensions.\n"
        "6. Format your response in markdown with clear sections.\n"
        "7. If the excerpts are too sparse to form a coherent definition, say so honestly."
    )

    user_prompt = (
        f"Synthesize a scholarly definition of the term \"{term_name}\" based on the following "
        f"{len(excerpts)} excerpts from my research notes (filtered to: {filter_context}).\n\n"
        f"{excerpts_text}\n\n"
        f"Please synthesize these excerpts into a coherent understanding of \"{term_name}\" "
        f"as it appears in my notes. Remember: use ONLY what the excerpts say."
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    response = await _call_deepseek_api(
        messages,
        temperature=0.5,  # Deterministic but not robotic
        max_tokens=1000,
    )

    if not response:
        raise AIServiceError(
            "Empty response from AI",
            "The DeepSeek API returned an empty response for term synthesis.",
        )

    return response
```

**Design decisions for the synthesis function:**

1. **Temperature 0.5.** Lower than the default 0.7 to keep synthesis more grounded in the excerpts. Not as low as 0.3 (which would be too rigid for natural-sounding scholarly prose).

2. **Max 30 excerpts.** DeepSeek's context window is large, but we cap at 30 excerpts to keep token usage reasonable and responses fast. If Stephanie has 100 occurrences of "habit," the 30 most recent are used.

3. **Max 1000 tokens.** A definition should be concise -- a few paragraphs at most. This prevents the AI from rambling.

4. **Explicit "no external knowledge" instruction.** The system prompt is firm about this. The AI may still hallucinate (all LLMs can), but the instruction + the explicit excerpt format makes hallucination unlikely.

5. **Markdown output.** The frontend renders the synthesis as markdown, so the AI is instructed to use markdown formatting.

---

## Frontend: Types

### Modification: `frontend/src/types/index.ts`

Add the following interfaces at the end of the file, before the closing of the quiz types section or at the very end:

```typescript
// ============ Critical Terms & Definition Types (Plans 5 + 6) ============

export interface CriticalTerm {
  id: string
  name: string
  description?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
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
  term_id: string
  note_id: string
  context_snippet: string
  paragraph_index?: number | null
  char_offset?: number | null
  created_at: string
  // Joined fields from definition endpoint
  note_title?: string | null
  note_folder_name?: string | null
  note_folder_id?: string | null
  associated_thinkers?: { id: string; name: string }[] | null
}

export interface ExcerptGroup {
  group_name: string
  group_id?: string | null
  excerpts: TermOccurrence[]
  excerpt_count: number
}

export interface TermDefinition {
  term: CriticalTerm
  excerpts_by_thinker: ExcerptGroup[]
  excerpts_by_folder: ExcerptGroup[]
  total_occurrences: number
  synthesis?: string | null
  filter_context: string
  available_folders: { id: string; name: string }[]
  available_thinkers: { id: string; name: string }[]
}

export interface TermDefinitionFilters {
  folder_id?: string
  thinker_id?: string
  synthesize?: boolean
}
```

---

## Frontend: API Client Addition

### Modification: `frontend/src/lib/api.ts`

Add the import for the new types at the top of the file, in the existing type import block:

```typescript
import type {
  // ... existing imports ...
  CriticalTerm,
  CriticalTermCreate,
  CriticalTermUpdate,
  TermOccurrence,
  TermDefinition,
  TermDefinitionFilters,
} from '@/types'
```

Add the following API client after the existing `notesApi` object (or wherever the critical terms API from Plan 5 lives):

```typescript
// Critical Terms API (Plan 5 base CRUD + Plan 6 definition)
export const criticalTermsApi = {
  getAll: async (isActive?: boolean): Promise<CriticalTerm[]> => {
    const params: Record<string, unknown> = {}
    if (isActive !== undefined) params.is_active = isActive
    const response = await api.get('/api/critical-terms/', { params })
    return response.data
  },
  getOne: async (id: string): Promise<CriticalTerm> => {
    const response = await api.get(`/api/critical-terms/${id}`)
    return response.data
  },
  create: async (data: CriticalTermCreate): Promise<CriticalTerm> => {
    const response = await api.post('/api/critical-terms/', data)
    return response.data
  },
  update: async (id: string, data: CriticalTermUpdate): Promise<CriticalTerm> => {
    const response = await api.put(`/api/critical-terms/${id}`, data)
    return response.data
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/critical-terms/${id}`)
  },

  // Plan 6: Definition endpoint
  getDefinition: async (
    termId: string,
    filters?: TermDefinitionFilters,
  ): Promise<TermDefinition> => {
    const params: Record<string, unknown> = {}
    if (filters?.folder_id) params.folder_id = filters.folder_id
    if (filters?.thinker_id) params.thinker_id = filters.thinker_id
    if (filters?.synthesize) params.synthesize = filters.synthesize
    const response = await api.get(`/api/critical-terms/${termId}/definition`, { params })
    return response.data
  },
}
```

**Note:** The base CRUD methods (`getAll`, `getOne`, `create`, `update`, `delete`) may already exist from Plan 5. If so, only add the `getDefinition` method to the existing object.

---

## Frontend: TermDefinitionPanel

### New File: `frontend/src/components/notes/TermDefinitionPanel.tsx`

This is the main right-panel component. It fetches the term definition, provides filter controls, and renders grouped excerpts in tabs.

```tsx
'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { criticalTermsApi } from '@/lib/api'
import type { TermDefinition, TermDefinitionFilters, ExcerptGroup } from '@/types'
import ExcerptCard from './ExcerptCard'
import SynthesisView from './SynthesisView'

interface TermDefinitionPanelProps {
  termId: string
  /** Pre-selected folder filter (e.g., from current folder context) */
  folderId?: string
  /** Callback to close the panel */
  onClose: () => void
  /** Callback when user clicks an excerpt to navigate to the source note */
  onNavigateToNote?: (noteId: string) => void
}

type TabKey = 'by_thinker' | 'by_folder' | 'all'

export default function TermDefinitionPanel({
  termId,
  folderId: initialFolderId,
  onClose,
  onNavigateToNote,
}: TermDefinitionPanelProps) {
  // ── State ──
  const [activeTab, setActiveTab] = useState<TabKey>('by_thinker')
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(initialFolderId)
  const [selectedThinkerId, setSelectedThinkerId] = useState<string | undefined>(undefined)

  // ── Build filters ──
  const filters: TermDefinitionFilters = useMemo(
    () => ({
      folder_id: selectedFolderId,
      thinker_id: selectedThinkerId,
    }),
    [selectedFolderId, selectedThinkerId],
  )

  // ── Fetch definition ──
  const {
    data: definition,
    isLoading,
    error,
  } = useQuery<TermDefinition>({
    queryKey: ['term-definition', termId, filters],
    queryFn: () => criticalTermsApi.getDefinition(termId, filters),
    enabled: !!termId,
  })

  // ── Flat "All" list ──
  const allExcerpts = useMemo(() => {
    if (!definition) return []
    // Deduplicate: excerpts appear in both by_thinker and by_folder groupings.
    // Use the by_thinker groups as the canonical source, then add ungrouped.
    const seen = new Set<string>()
    const result: typeof definition.excerpts_by_thinker[0]['excerpts'] = []
    for (const group of definition.excerpts_by_thinker) {
      for (const exc of group.excerpts) {
        if (!seen.has(exc.id)) {
          seen.add(exc.id)
          result.push(exc)
        }
      }
    }
    return result
  }, [definition])

  // ── Tab rendering helper ──
  const renderGroups = (groups: ExcerptGroup[]) => {
    if (groups.length === 0) {
      return (
        <p className="text-sm text-gray-500 italic py-4 text-center">
          No excerpts found with current filters.
        </p>
      )
    }
    return groups.map((group) => (
      <div key={group.group_id || group.group_name} className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold text-primary text-sm uppercase tracking-wide">
            {group.group_name}
          </h4>
          <span className="text-xs text-gray-400">
            {group.excerpt_count} excerpt{group.excerpt_count !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="space-y-2">
          {group.excerpts.map((excerpt) => (
            <ExcerptCard
              key={excerpt.id}
              excerpt={excerpt}
              termName={definition?.term.name || ''}
              onClick={() => onNavigateToNote?.(excerpt.note_id)}
            />
          ))}
        </div>
      </div>
    ))
  }

  // ── Clear filters ──
  const hasActiveFilters = !!selectedFolderId || !!selectedThinkerId
  const clearFilters = () => {
    setSelectedFolderId(undefined)
    setSelectedThinkerId(undefined)
  }

  // ── Render ──
  return (
    <div className="flex flex-col h-full bg-background">
      {/* ── Header ── */}
      <div className="flex-shrink-0 border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-serif text-lg font-bold text-primary truncate">
            {definition?.term.name || 'Loading...'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            aria-label="Close definition panel"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {definition && (
          <p className="text-xs text-gray-500">
            {definition.total_occurrences} occurrence{definition.total_occurrences !== 1 ? 's' : ''} across{' '}
            {definition.filter_context}
          </p>
        )}

        {/* ── Filter controls ── */}
        {definition && (
          <div className="mt-3 space-y-2">
            <div className="flex gap-2">
              {/* Folder filter */}
              <select
                value={selectedFolderId || ''}
                onChange={(e) => setSelectedFolderId(e.target.value || undefined)}
                className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 bg-white text-primary focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="">All folders</option>
                {definition.available_folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>

              {/* Thinker filter */}
              <select
                value={selectedThinkerId || ''}
                onChange={(e) => setSelectedThinkerId(e.target.value || undefined)}
                className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 bg-white text-primary focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="">All thinkers</option>
                {definition.available_thinkers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-accent hover:text-accent/80 underline transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex-shrink-0 border-b border-gray-200">
        <div className="flex">
          {([
            { key: 'by_thinker' as TabKey, label: 'By Thinker' },
            { key: 'by_folder' as TabKey, label: 'By Folder' },
            { key: 'all' as TabKey, label: 'All' },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                activeTab === tab.key
                  ? 'text-accent border-b-2 border-accent'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-gray-500 font-serif italic">Gathering excerpts...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
            Failed to load term definition. {(error as Error).message}
          </div>
        )}

        {definition && !isLoading && (
          <>
            {activeTab === 'by_thinker' && renderGroups(definition.excerpts_by_thinker)}
            {activeTab === 'by_folder' && renderGroups(definition.excerpts_by_folder)}
            {activeTab === 'all' && (
              <div className="space-y-2">
                {allExcerpts.length === 0 ? (
                  <p className="text-sm text-gray-500 italic py-4 text-center">
                    No excerpts found with current filters.
                  </p>
                ) : (
                  allExcerpts.map((excerpt) => (
                    <ExcerptCard
                      key={excerpt.id}
                      excerpt={excerpt}
                      termName={definition.term.name}
                      onClick={() => onNavigateToNote?.(excerpt.note_id)}
                    />
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Synthesis section (always at bottom) ── */}
      {definition && !isLoading && (
        <div className="flex-shrink-0 border-t border-gray-200">
          <SynthesisView
            termId={termId}
            termName={definition.term.name}
            folderId={selectedFolderId}
            thinkerId={selectedThinkerId}
            totalExcerpts={definition.total_occurrences}
          />
        </div>
      )}
    </div>
  )
}
```

---

## Frontend: ExcerptCard

### New File: `frontend/src/components/notes/ExcerptCard.tsx`

Displays a single excerpt with the critical term highlighted, source metadata, and click-to-navigate behavior.

```tsx
'use client'

import { useMemo } from 'react'
import type { TermOccurrence } from '@/types'

interface ExcerptCardProps {
  excerpt: TermOccurrence
  /** The critical term name, used for highlighting within the snippet */
  termName: string
  /** Click handler to navigate to the source note */
  onClick?: () => void
}

export default function ExcerptCard({ excerpt, termName, onClick }: ExcerptCardProps) {
  // ── Highlight the term within the context snippet ──
  const highlightedSnippet = useMemo(() => {
    if (!termName || !excerpt.context_snippet) return excerpt.context_snippet

    // Escape regex special chars in the term name
    const escaped = termName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Case-insensitive match with word boundary awareness
    const regex = new RegExp(`(${escaped})`, 'gi')
    const parts = excerpt.context_snippet.split(regex)

    return parts.map((part, i) => {
      if (part.toLowerCase() === termName.toLowerCase()) {
        return (
          <span key={i} className="font-bold text-accent bg-accent/10 px-0.5 rounded">
            {part}
          </span>
        )
      }
      return <span key={i}>{part}</span>
    })
  }, [excerpt.context_snippet, termName])

  // ── Thinker tags ──
  const thinkers = excerpt.associated_thinkers || []

  return (
    <button
      onClick={onClick}
      className="w-full text-left group block bg-white border border-gray-100 rounded-lg p-3
                 hover:border-accent/30 hover:shadow-sm transition-all cursor-pointer"
      title="Click to open source note"
    >
      {/* Snippet text with serif font for scholarly feel */}
      <blockquote className="font-serif text-sm text-primary/90 leading-relaxed border-l-2 border-accent/30 pl-3 mb-2">
        {highlightedSnippet}
      </blockquote>

      {/* Metadata row */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-1.5 truncate">
          {/* Note title */}
          <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="truncate">
            {excerpt.note_title || 'Untitled note'}
          </span>

          {/* Folder breadcrumb */}
          {excerpt.note_folder_name && (
            <>
              <span className="text-gray-300 mx-0.5">/</span>
              <span className="truncate text-gray-400">
                {excerpt.note_folder_name}
              </span>
            </>
          )}
        </div>

        {/* Navigate arrow (visible on hover) */}
        <svg
          className="w-3.5 h-3.5 text-gray-300 group-hover:text-accent transition-colors flex-shrink-0 ml-2"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>

      {/* Associated thinkers */}
      {thinkers.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {thinkers.map((t) => (
            <span
              key={t.id}
              className="inline-block text-xs bg-accent/10 text-accent px-1.5 py-0.5 rounded"
            >
              {t.name}
            </span>
          ))}
        </div>
      )}
    </button>
  )
}
```

**Design decisions:**

1. **The entire card is a button.** Clicking navigates to the source note. This matches the "click excerpt, go to note" UX requirement.

2. **Term highlighting.** The term name is bolded with the accent color (#8B4513) and a subtle background. Uses regex splitting for case-insensitive matching.

3. **Scholarly blockquote styling.** The `font-serif` (Crimson Text) with a left border gives the excerpt a quotation feel, reinforcing that this is from Stephanie's own writing.

4. **Thinker tags.** Small accent-colored pills show which thinkers are associated with this excerpt's source note.

---

## Frontend: SynthesisView

### New File: `frontend/src/components/notes/SynthesisView.tsx`

Handles the optional AI synthesis: button to trigger, loading state, and rendered result.

```tsx
'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { criticalTermsApi } from '@/lib/api'
import type { TermDefinition } from '@/types'

interface SynthesisViewProps {
  termId: string
  termName: string
  folderId?: string
  thinkerId?: string
  totalExcerpts: number
}

export default function SynthesisView({
  termId,
  termName,
  folderId,
  thinkerId,
  totalExcerpts,
}: SynthesisViewProps) {
  const [synthesisRequested, setSynthesisRequested] = useState(false)

  // ── Fetch with synthesis=true (only when requested) ──
  const {
    data: synthesisData,
    isLoading: isSynthesizing,
    error: synthesisError,
    refetch,
  } = useQuery<TermDefinition>({
    queryKey: ['term-synthesis', termId, folderId, thinkerId],
    queryFn: () =>
      criticalTermsApi.getDefinition(termId, {
        folder_id: folderId,
        thinker_id: thinkerId,
        synthesize: true,
      }),
    enabled: synthesisRequested,
    staleTime: 0, // Always re-fetch when re-synthesize is clicked
  })

  const synthesis = synthesisData?.synthesis

  // ── Handle re-synthesize ──
  const handleReSynthesize = () => {
    setSynthesisRequested(true)
    refetch()
  }

  // ── Render simple markdown (basic: bold, italic, headers, lists) ──
  const renderMarkdown = (text: string) => {
    // Split into lines and process
    const lines = text.split('\n')
    const elements: JSX.Element[] = []

    lines.forEach((line, i) => {
      // Headers
      if (line.startsWith('### ')) {
        elements.push(
          <h5 key={i} className="font-semibold text-sm text-primary mt-3 mb-1">
            {line.slice(4)}
          </h5>
        )
      } else if (line.startsWith('## ')) {
        elements.push(
          <h4 key={i} className="font-semibold text-sm text-primary mt-3 mb-1">
            {line.slice(3)}
          </h4>
        )
      } else if (line.startsWith('# ')) {
        elements.push(
          <h3 key={i} className="font-bold text-base text-primary mt-3 mb-1">
            {line.slice(2)}
          </h3>
        )
      }
      // List items
      else if (line.startsWith('- ') || line.startsWith('* ')) {
        elements.push(
          <li key={i} className="text-sm text-primary/80 ml-4 list-disc">
            {processInlineMarkdown(line.slice(2))}
          </li>
        )
      }
      // Numbered list items
      else if (/^\d+\.\s/.test(line)) {
        const content = line.replace(/^\d+\.\s/, '')
        elements.push(
          <li key={i} className="text-sm text-primary/80 ml-4 list-decimal">
            {processInlineMarkdown(content)}
          </li>
        )
      }
      // Empty line = paragraph break
      else if (line.trim() === '') {
        elements.push(<div key={i} className="h-2" />)
      }
      // Normal paragraph
      else {
        elements.push(
          <p key={i} className="text-sm text-primary/80 leading-relaxed">
            {processInlineMarkdown(line)}
          </p>
        )
      }
    })

    return elements
  }

  // Process inline markdown (**bold**, *italic*)
  const processInlineMarkdown = (text: string): (string | JSX.Element)[] => {
    const parts: (string | JSX.Element)[] = []
    // Match **bold** and *italic*
    const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g
    let lastIndex = 0
    let match

    while ((match = regex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index))
      }

      if (match[2]) {
        // **bold**
        parts.push(
          <strong key={match.index} className="font-semibold">
            {match[2]}
          </strong>
        )
      } else if (match[3]) {
        // *italic*
        parts.push(
          <em key={match.index} className="italic">
            {match[3]}
          </em>
        )
      }

      lastIndex = match.index + match[0].length
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex))
    }

    return parts.length > 0 ? parts : [text]
  }

  return (
    <div className="px-4 py-3">
      {/* Not yet requested */}
      {!synthesisRequested && !synthesis && (
        <div className="text-center">
          {totalExcerpts < 3 && (
            <p className="text-xs text-amber-600 mb-2">
              Only {totalExcerpts} excerpt{totalExcerpts !== 1 ? 's' : ''} found.
              Synthesis works best with more data.
            </p>
          )}
          <button
            onClick={() => setSynthesisRequested(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium
                       bg-accent/10 text-accent rounded-lg hover:bg-accent/20
                       transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Synthesize with AI
          </button>
        </div>
      )}

      {/* Loading state */}
      {isSynthesizing && (
        <div className="flex items-center justify-center py-6">
          <div className="text-center">
            <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm text-gray-500 font-serif italic">
              Synthesizing from your notes...
            </p>
          </div>
        </div>
      )}

      {/* Error state */}
      {synthesisError && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700 mb-2">
          Failed to synthesize. {(synthesisError as Error).message}
          <button
            onClick={handleReSynthesize}
            className="block mt-1 text-xs text-red-600 underline hover:text-red-800"
          >
            Try again
          </button>
        </div>
      )}

      {/* Synthesis result */}
      {synthesis && !isSynthesizing && (
        <div>
          {/* Label */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 italic">
              AI Synthesis (based on your notes)
            </span>
            <button
              onClick={handleReSynthesize}
              className="text-xs text-accent hover:text-accent/80 underline transition-colors"
            >
              Re-synthesize
            </button>
          </div>

          {/* Rendered markdown */}
          <div className="bg-accent/5 border border-accent/10 rounded-lg p-3 font-serif">
            {renderMarkdown(synthesis)}
          </div>

          {/* Transparency notice */}
          <p className="text-xs text-gray-400 mt-2 italic">
            This synthesis was generated by AI from {totalExcerpts} excerpt{totalExcerpts !== 1 ? 's' : ''} in your notes.
            It may not perfectly capture every nuance. Always refer to the original excerpts above.
          </p>
        </div>
      )}
    </div>
  )
}
```

**Design decisions:**

1. **Synthesis is behind a button click.** The panel loads with excerpts only. Stephanie must explicitly click "Synthesize with AI" to trigger the DeepSeek call. This reinforces that her notes are the primary source.

2. **Transparent labeling.** The synthesis result is labeled "AI Synthesis (based on your notes)" to make clear that this is machine-generated, not Stephanie's own words.

3. **Warning for sparse data.** If fewer than 3 excerpts exist, a warning appears: "Only N excerpts found. Synthesis works best with more data." This manages expectations.

4. **Re-synthesize button.** Allows regeneration if the result is unsatisfactory. Uses `staleTime: 0` to always re-fetch.

5. **Inline markdown rendering.** A lightweight markdown renderer handles headers, bold, italic, and lists without pulling in a full markdown library. This keeps the bundle small.

6. **Scholarly styling.** The synthesis is rendered in a container with `font-serif` (Crimson Text), a warm accent-tinted background, and a subtle border -- visually distinct from the raw excerpts.

---

## Frontend: Integration with Notes Page

### Modification: `frontend/src/app/notes/page.tsx`

The notes page from Plan 3 has a three-column layout: left sidebar (folder tree + critical terms list), center (note editor), right panel (contextual content). Plan 6 adds a new right-panel mode for the term definition view.

**Add to the page state:**

```tsx
// Existing state from Plans 3 + 5
const [rightPanelMode, setRightPanelMode] = useState<
  'none' | 'definition' | 'constellation' | 'connections'
>('none')
const [selectedTermId, setSelectedTermId] = useState<string | null>(null)
const [selectedDefinitionThinkerId, setSelectedDefinitionThinkerId] = useState<string | null>(null)
```

**Add the term click handler** (passed to the CriticalTermsList component from Plan 5):

```tsx
const handleSelectTerm = (termId: string) => {
  setSelectedTermId(termId)
  setSelectedDefinitionThinkerId(null)
  setRightPanelMode('definition')
}
```

**In the CriticalTermsList component** (from Plan 5), pass the click handler:

```tsx
<CriticalTermsList
  onSelectTerm={handleSelectTerm}
  selectedTermId={selectedTermId}
/>
```

**In the right panel rendering section**, add the definition panel case:

```tsx
{/* Right panel */}
{rightPanelMode !== 'none' && (
  <div className="w-96 border-l border-gray-200 flex-shrink-0 overflow-hidden">
    {rightPanelMode === 'definition' && selectedTermId && (
      <TermDefinitionPanel
        termId={selectedTermId}
        folderId={selectedFolderId}  // From current folder context, if any
        onClose={() => {
          setRightPanelMode('none')
          setSelectedTermId(null)
          setSelectedDefinitionThinkerId(null)
        }}
        onNavigateToNote={(noteId) => {
          // Select the note in the editor
          setSelectedNoteId(noteId)
          // Optionally close the definition panel, or keep it open
        }}
      />
    )}
    {/* ... other right panel modes from Plans 3, 4, etc. ... */}
  </div>
)}
```

**Import the component** at the top of the file:

```tsx
import TermDefinitionPanel from '@/components/notes/TermDefinitionPanel'
```

---

## Verification Steps

These steps validate the complete Plan 6 implementation end-to-end.

### Prerequisites
Ensure the following are in place from earlier plans:
- Database has `critical_terms`, `term_occurrences`, `folders`, `thinker_mentions` tables (Plan 1)
- At least one critical term exists (e.g., "habit") (Plan 5)
- Multiple notes mention "habit" in different contexts and folders (Plan 3 + 5)
- Notes have associated thinker mentions (Plan 4)

### Step-by-step verification

1. **Flag "habit" as a critical term** (via Plan 5 UI or API call):
   ```bash
   curl -X POST http://localhost:8010/api/critical-terms/ \
     -H "Content-Type: application/json" \
     -d '{"name": "habit", "description": "A key concept in pragmatist philosophy"}'
   ```

2. **Ensure multiple notes mention "habit"** in different folders and thinker contexts. After saving notes that contain "habit," Plan 5's scanner should have created `TermOccurrence` records.

3. **Test the definition endpoint directly:**
   ```bash
   # Get term ID first
   curl http://localhost:8010/api/critical-terms/

   # Get definition (replace TERM_ID)
   curl "http://localhost:8010/api/critical-terms/TERM_ID/definition"

   # With folder filter
   curl "http://localhost:8010/api/critical-terms/TERM_ID/definition?folder_id=FOLDER_ID"

   # With thinker filter
   curl "http://localhost:8010/api/critical-terms/TERM_ID/definition?thinker_id=THINKER_ID"

   # With synthesis
   curl "http://localhost:8010/api/critical-terms/TERM_ID/definition?synthesize=true"
   ```

4. **Verify response structure:**
   - `term` field contains the CriticalTerm object
   - `excerpts_by_thinker` groups excerpts under thinker names
   - `excerpts_by_folder` groups excerpts under folder names
   - `total_occurrences` matches expected count
   - `available_folders` and `available_thinkers` are populated for dropdowns
   - `filter_context` reads "all notes" with no filters
   - `synthesis` is `null` when `synthesize=false`

5. **Open the Notes page** at `http://localhost:3010/notes`

6. **Click "habit"** in the Critical Terms sidebar section

7. **Right panel opens** showing the TermDefinitionPanel:
   - Header displays "habit" with occurrence count
   - Filter dropdowns are populated with relevant folders and thinkers
   - "By Thinker" tab is active by default

8. **"By Thinker" tab:** Excerpts are grouped under each thinker who discussed habit (e.g., "William James" group, "John Dewey" group). Each group shows excerpt count.

9. **"By Folder" tab:** Same excerpts grouped by folder name (e.g., "Pragmatism" folder, "American Philosophy" folder).

10. **"All" tab:** Flat list of all excerpts, deduplicated.

11. **Filter to a specific folder:** Select a folder from the dropdown. The excerpts update to show only those from that folder. `filter_context` updates accordingly.

12. **Filter to a specific thinker:** Select a thinker from the dropdown. Only excerpts from notes mentioning that thinker appear.

13. **Clear filters:** Click "Clear filters" link. All excerpts reappear.

14. **Click "Synthesize with AI":**
    - Loading spinner appears with "Synthesizing from your notes..."
    - After a few seconds, DeepSeek response appears in a styled container
    - Label reads "AI Synthesis (based on your notes)"
    - Synthesis attributes ideas to specific thinkers from the excerpts
    - Transparency notice appears below

15. **Click "Re-synthesize":** A new synthesis is generated.

16. **Verify sparse data warning:** If a term has fewer than 3 occurrences, the synthesis button area shows "Only N excerpts found. Synthesis works best with more data."

17. **Click an excerpt card:** The source note opens in the editor (center panel). The note content is displayed where the excerpt was found.

18. **Test with AI disabled:** Unset `DEEPSEEK_API_KEY`. Clicking "Synthesize with AI" should show a graceful error (not crash the panel). The excerpts view (primary experience) continues to work perfectly.

---

## Error Handling Summary

| Scenario | Behavior |
|----------|----------|
| Term not found (invalid term_id) | 404 response |
| No occurrences exist for the term | Empty groups, `total_occurrences: 0` |
| Folder/thinker filter returns no results | Empty groups |
| DeepSeek API key not set + synthesize=true | Excerpts still return; `synthesis` contains a clear unavailable message |
| DeepSeek API call fails | Synthesis field contains `[Synthesis unavailable: ...]` instead of crashing |
| DeepSeek returns empty response | AIServiceError raised, caught gracefully |
| Fewer than 3 excerpts + synthesis requested | Synthesis proceeds but frontend shows warning |

---

## Performance Considerations

1. **Single query for all occurrences.** The endpoint uses SQLAlchemy joins to fetch occurrences with note and folder info in one pass, avoiding N+1 queries.

2. **Pre-fetched thinker mentions.** All thinker mentions for relevant notes are fetched in a single query, then mapped in Python.

3. **Available filters are computed once.** The `available_folders` and `available_thinkers` are fetched with unfiltered queries so the dropdowns always show all options, even when a filter is active.

4. **Client-side tab switching.** All three groupings (by thinker, by folder, all) come from the same API response. Tab switching is instant -- no additional network requests.

5. **Synthesis is lazy.** The DeepSeek call only fires when Stephanie clicks the button, not on initial load.

6. **Excerpt limit for synthesis.** The AI function caps at 30 excerpts to keep the context window manageable and response times fast.

---

## Execution Checklist

- [ ] Update `backend/app/schemas/critical_term.py` with Plan 6 schemas (`ExcerptGroup`, `TermDefinitionResponse`)
- [ ] Modify `backend/app/schemas/__init__.py` to import new schemas
- [ ] Add `get_term_definition` endpoint to `backend/app/routes/critical_terms.py`
- [ ] Add `synthesize_term_definition` function to `backend/app/utils/ai_service.py`
- [ ] Add TypeScript interfaces to `frontend/src/types/index.ts`
- [ ] Add `criticalTermsApi.getDefinition()` to `frontend/src/lib/api.ts`
- [ ] Create `frontend/src/components/notes/ExcerptCard.tsx`
- [ ] Create `frontend/src/components/notes/SynthesisView.tsx`
- [ ] Create `frontend/src/components/notes/TermDefinitionPanel.tsx`
- [ ] Modify `frontend/src/app/notes/page.tsx` to wire term click to definition panel
- [ ] Test definition endpoint with curl (no filters, with filters, with synthesis)
- [ ] Test frontend: click term, view excerpts, switch tabs, apply filters, synthesize
- [ ] Test graceful degradation with AI disabled
- [ ] Verify no regressions in existing Plan 5 critical terms functionality
