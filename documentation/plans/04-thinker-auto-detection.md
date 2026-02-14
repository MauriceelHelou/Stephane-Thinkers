# Plan 4: Thinker Auto-Detection

## Goal

Auto-detect thinker names in note content, create inline mention chips in the TipTap editor, and prompt Stephanie when unknown names appear in `[[wiki-link]]` syntax. When she saves a note, the system scans the text for known thinker names (algorithmically -- no AI), highlights them as interactive chips showing birth/death years on hover, and flags any `[[Name]]` links that do not match a database thinker so she can add them.

After this plan is executed:
- Known thinker names in note content are automatically detected and stored as `thinker_mentions` records
- The TipTap editor supports a `[[` trigger that opens a thinker suggestion dropdown
- Selected thinkers render as styled inline chips with hover popovers
- `[[Unknown Name]]` links that match no thinker produce a banner prompting Stephanie to add the thinker

---

## Dependencies

| Dependency | What it provides | Status |
|---|---|---|
| **Plan 1** | `thinker_mentions` table in the database | Must be complete |
| **Plan 3** | `/notes` page with TipTap `RichTextEditor` component | Must be complete |

---

## Audit Notes (2026-02-13)

1. The detection endpoint must persist to `thinker_mentions` (authoritative store), not only `note_mentions`.
2. `note_mentions` sync is optional compatibility behavior.
3. `backend/app/schemas/analysis.py` is a shared schema file that later plans extend; do not recreate it.

---

## Files Changed

| Action | File | Description |
|---|---|---|
| **Create** | `backend/app/utils/thinker_detection.py` | Name variant generation + word-boundary matching engine |
| **Create/Modify** | `backend/app/schemas/analysis.py` | Detection schemas (shared analysis schema file) |
| **Modify** | `backend/app/routes/notes.py` | Add `POST /{note_id}/detect-thinkers` endpoint |
| **Modify** | `backend/app/schemas/__init__.py` | Export new analysis schemas |
| **Create** | `frontend/src/components/notes/tiptap-extensions/ThinkerMention.ts` | Custom TipTap mention extension with `[[` trigger |
| **Create** | `frontend/src/components/notes/ThinkerSuggestion.tsx` | Suggestion dropdown rendered below cursor |
| **Create** | `frontend/src/components/notes/ThinkerChip.tsx` | Inline chip component with hover popover |
| **Create** | `frontend/src/components/notes/UnknownThinkerBanner.tsx` | Banner prompting to add unrecognized names |
| **Modify** | `frontend/src/components/notes/RichTextEditor.tsx` | Integrate ThinkerMention extension + post-save detection |
| **Modify** | `frontend/src/types/index.ts` | Add `DetectedThinker` and `ThinkerDetectionResult` interfaces |
| **Modify** | `frontend/src/lib/api.ts` | Add `analysisApi.detectThinkers` method |

---

## Detection Strategy

The detection is **purely algorithmic** -- no LLM calls, no NLP libraries. The approach:

1. **Name variant generation**: For each thinker in the database, build a list of plausible textual forms from their `name` field.
2. **Word-boundary regex matching**: Search note content for each variant using `\b...\b` regex to avoid substring false positives.
3. **Longest-match priority**: When multiple variants match at the same position (e.g., both "James" and "William James"), keep only the longest match.
4. **Wiki-link handling for unknowns**: Names wrapped in `[[...]]` that do not match any thinker are returned separately as `unknown_names`. This is the only mechanism for detecting genuinely unknown thinkers -- free-text detection of arbitrary unknown names is out of scope (it would require NER/NLP).

### Name Variant Examples

| Thinker name in DB | Generated variants (longest first) |
|---|---|
| `William James` | `William James`, `W. James`, `James` |
| `Charles Sanders Peirce` | `Charles Sanders Peirce`, `Charles Peirce`, `C.S. Peirce`, `C. S. Peirce`, `Peirce` |
| `Aristotle` | `Aristotle` |
| `Martin Luther King Jr.` | `Martin Luther King Jr.`, `Martin Luther King`, `Martin King`, `M.L. King`, `M. L. King`, `King` |

Last names alone (e.g., "James", "King") are intentionally included because Stephanie's research notes typically use last-name-only references. The word-boundary matching prevents false positives like "Jamestown".

---

## Backend: Thinker Detection Utility

### File: `backend/app/utils/thinker_detection.py`

```python
"""
Thinker name detection engine.

Scans note content for thinker names using algorithmic matching:
- Generates name variants (full name, first+last, initials+last, last only)
- Uses word-boundary regex for each variant
- Deduplicates overlapping matches by keeping the longest
- Returns known matches (with thinker_id) and unknown names (from [[wiki-links]])

No AI/LLM calls. No NLP libraries. Pure regex.
"""

import re
from dataclasses import dataclass, field
from typing import List, Tuple, Optional
from uuid import UUID


@dataclass
class DetectedMatch:
    """A single occurrence of a thinker name found in note content."""
    thinker_id: UUID
    thinker_name: str           # Canonical name from database
    matched_text: str           # The actual text that matched (may be a variant)
    paragraph_index: int        # Which paragraph (0-indexed)
    char_offset: int            # Character offset within the paragraph
    match_length: int           # Length of the matched text


@dataclass
class ThinkerVariants:
    """All searchable name variants for a single thinker."""
    thinker_id: UUID
    thinker_name: str
    birth_year: Optional[int]
    death_year: Optional[int]
    field: Optional[str]
    variants: List[str] = field(default_factory=list)  # Sorted longest-first


def generate_name_variants(full_name: str) -> List[str]:
    """
    Generate plausible name variants from a full name string.

    Examples:
        "William James"           -> ["William James", "W. James", "James"]
        "Charles Sanders Peirce"  -> ["Charles Sanders Peirce", "Charles Peirce",
                                      "C.S. Peirce", "C. S. Peirce", "Peirce"]
        "Aristotle"               -> ["Aristotle"]

    Returns variants sorted by length descending (longest first).
    """
    if not full_name or not full_name.strip():
        return []

    # Clean and split
    name = full_name.strip()
    # Remove common suffixes for variant generation, but keep full name as-is
    suffixes = ["Jr.", "Jr", "Sr.", "Sr", "III", "II", "IV"]
    name_without_suffix = name
    found_suffix = ""
    for suffix in suffixes:
        if name.endswith(suffix):
            name_without_suffix = name[: -len(suffix)].strip().rstrip(",")
            found_suffix = suffix
            break

    parts = name_without_suffix.split()
    variants = set()

    # Always include the full original name
    variants.add(name)

    if len(parts) == 1:
        # Single name like "Aristotle" -- no variants to generate
        return [name]

    # Full name without suffix (if suffix was removed)
    if found_suffix:
        variants.add(name_without_suffix)

    last_name = parts[-1]
    first_name = parts[0]

    # Last name only (e.g., "James", "Peirce")
    if len(last_name) > 2:  # Skip very short last names to reduce false positives
        variants.add(last_name)

    # First + Last (e.g., "Charles Peirce" from "Charles Sanders Peirce")
    if len(parts) > 2:
        variants.add(f"{first_name} {last_name}")

    # Initials + Last name
    # E.g., "W. James" from "William James"
    if len(first_name) > 1:
        variants.add(f"{first_name[0]}. {last_name}")

    # Multiple initials + Last (e.g., "C.S. Peirce", "C. S. Peirce")
    if len(parts) >= 3:
        # All-initials-dotted, no spaces: "C.S. Peirce"
        initials_no_space = "".join(f"{p[0]}." for p in parts[:-1])
        variants.add(f"{initials_no_space} {last_name}")

        # All-initials-dotted, with spaces: "C. S. Peirce"
        initials_with_space = " ".join(f"{p[0]}." for p in parts[:-1])
        variants.add(f"{initials_with_space} {last_name}")

    # First + Middle-initial + Last (e.g., "Charles S. Peirce")
    if len(parts) == 3:
        middle = parts[1]
        variants.add(f"{first_name} {middle[0]}. {last_name}")

    # Sort by length descending so longest variants are checked first
    sorted_variants = sorted(variants, key=len, reverse=True)
    return sorted_variants


def build_variant_index(thinkers: list) -> List[ThinkerVariants]:
    """
    Build a searchable index of name variants for all thinkers.

    Args:
        thinkers: List of Thinker ORM objects (must have .id, .name,
                  .birth_year, .death_year, .field attributes)

    Returns:
        List of ThinkerVariants, one per thinker, each containing
        all searchable name forms sorted longest-first.
    """
    result = []
    for thinker in thinkers:
        variants = generate_name_variants(thinker.name)
        result.append(ThinkerVariants(
            thinker_id=thinker.id,
            thinker_name=thinker.name,
            birth_year=thinker.birth_year,
            death_year=thinker.death_year,
            field=thinker.field,
            variants=variants,
        ))
    return result


def detect_thinker_names(
    content: str,
    thinkers: list,
) -> Tuple[List[DetectedMatch], List[str]]:
    """
    Scan note content for thinker names.

    Returns:
        (known_matches, unknown_names)
        - known_matches: list of DetectedMatch for thinkers found in content
        - unknown_names: list of names from [[wiki-links]] that don't match
          any thinker in the database

    Detection strategy:
        1. Split content into paragraphs (by newline)
        2. Build name variant index from all thinkers
        3. For each paragraph, search for every variant with word-boundary regex
        4. Deduplicate overlapping matches by keeping only the longest at each position
        5. Extract [[wiki-link]] names and flag those that don't match any thinker
    """
    if not content or not content.strip():
        return [], []

    # Build variant index
    variant_index = build_variant_index(thinkers)

    # Split into paragraphs
    paragraphs = content.split("\n")

    # Phase 1: Find all matches across all paragraphs
    # Key: (paragraph_index, char_offset) -> list of DetectedMatch
    all_matches: dict = {}

    for para_idx, paragraph in enumerate(paragraphs):
        if not paragraph.strip():
            continue

        for tv in variant_index:
            for variant in tv.variants:
                # Build regex pattern with word boundaries
                # re.escape handles special chars in names (e.g., periods in "Jr.")
                pattern = r"\b" + re.escape(variant) + r"\b"
                try:
                    for match in re.finditer(pattern, paragraph, re.IGNORECASE):
                        offset = match.start()
                        length = len(variant)
                        key = (para_idx, offset)

                        detected = DetectedMatch(
                            thinker_id=tv.thinker_id,
                            thinker_name=tv.thinker_name,
                            matched_text=match.group(),
                            paragraph_index=para_idx,
                            char_offset=offset,
                            match_length=length,
                        )

                        if key not in all_matches:
                            all_matches[key] = detected
                        else:
                            # Keep the longest match at this position
                            existing = all_matches[key]
                            if length > existing.match_length:
                                all_matches[key] = detected
                except re.error:
                    # Skip variants that produce invalid regex
                    continue

    # Phase 2: Remove overlapping matches
    # Sort by (paragraph_index, char_offset)
    sorted_matches = sorted(
        all_matches.values(),
        key=lambda m: (m.paragraph_index, m.char_offset),
    )

    # Sweep: keep a match only if it doesn't overlap with the previous kept match
    deduplicated: List[DetectedMatch] = []
    for match in sorted_matches:
        if not deduplicated:
            deduplicated.append(match)
            continue
        prev = deduplicated[-1]
        if match.paragraph_index != prev.paragraph_index:
            # Different paragraph, no overlap possible
            deduplicated.append(match)
        elif match.char_offset >= prev.char_offset + prev.match_length:
            # No overlap within the same paragraph
            deduplicated.append(match)
        # else: overlapping with previous match, skip it

    # Phase 3: Extract unknown names from [[wiki-links]]
    wiki_link_pattern = r"\[\[([^\]]+)\]\]"
    wiki_names = re.findall(wiki_link_pattern, content)

    # Build a set of known thinker names (case-insensitive) for lookup
    known_names_lower = {t.name.lower() for t in thinkers}
    # Also include all generated variants
    for tv in variant_index:
        for v in tv.variants:
            known_names_lower.add(v.lower())

    unknown_names = []
    seen_unknown = set()
    for name in wiki_names:
        name_stripped = name.strip()
        if name_stripped.lower() not in known_names_lower and name_stripped.lower() not in seen_unknown:
            unknown_names.append(name_stripped)
            seen_unknown.add(name_stripped.lower())

    return deduplicated, unknown_names


def aggregate_matches(
    matches: List[DetectedMatch],
) -> dict:
    """
    Aggregate per-occurrence matches into per-thinker summaries.

    Returns a dict keyed by thinker_id with:
        {
            thinker_id: {
                "thinker_id": UUID,
                "thinker_name": str,
                "mention_count": int,
                "paragraph_indices": [int, ...],
            }
        }
    """
    agg: dict = {}
    for match in matches:
        tid = match.thinker_id
        if tid not in agg:
            agg[tid] = {
                "thinker_id": tid,
                "thinker_name": match.thinker_name,
                "mention_count": 0,
                "paragraph_indices": [],
            }
        agg[tid]["mention_count"] += 1
        if match.paragraph_index not in agg[tid]["paragraph_indices"]:
            agg[tid]["paragraph_indices"].append(match.paragraph_index)
    return agg
```

**Key design decisions:**

| Decision | Rationale |
|---|---|
| No NLP/NER for unknown name detection | Keeps the system zero-dependency and deterministic. `[[wiki-link]]` syntax is sufficient for unknown names. |
| Last-name-only variants are included | Stephanie's research notes commonly refer to thinkers by last name alone. Word boundaries prevent false positives. |
| Variants sorted longest-first | When "William James" and "James" both match at position 0, the longest-match deduplication keeps "William James". |
| Overlapping-match sweep | A linear scan removes shorter matches that overlap longer ones, running in O(n log n) total. |
| Paragraph-level tracking | `paragraph_index` enables future features like "scroll to mention" or paragraph-level highlighting. |

---

## Backend: Schemas

### File: `backend/app/schemas/analysis.py`

```python
"""
Pydantic schemas for thinker detection and analysis results.
"""

from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from uuid import UUID


class DetectedThinker(BaseModel):
    """A thinker detected in note content, with aggregated mention info."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    birth_year: Optional[int] = None
    death_year: Optional[int] = None
    field: Optional[str] = None
    mention_count: int
    paragraph_indices: List[int]


class ThinkerDetectionResult(BaseModel):
    """Full result of scanning a note for thinker references."""
    known_thinkers: List[DetectedThinker]
    unknown_names: List[str]  # Names from [[WikiLink]] that don't match any thinker
    total_mentions: int


class DetectedMention(BaseModel):
    """A single mention occurrence (for detailed per-occurrence results)."""
    model_config = ConfigDict(from_attributes=True)

    thinker_id: UUID
    thinker_name: str
    matched_text: str
    paragraph_index: int
    char_offset: int
```

### Modify: `backend/app/schemas/__init__.py`

Add these imports and exports:

```python
# At the top, add the import block:
from app.schemas.analysis import (
    DetectedThinker,
    ThinkerDetectionResult,
    DetectedMention,
)

# In the __all__ list, add:
    # Analysis
    "DetectedThinker",
    "ThinkerDetectionResult",
    "DetectedMention",
```

---

## Backend: Detection Endpoint

### Modify: `backend/app/routes/notes.py`

Add the following endpoint after the existing `get_backlinks` endpoint:

```python
from app.utils.thinker_detection import detect_thinker_names, aggregate_matches
from app.schemas.analysis import ThinkerDetectionResult, DetectedThinker
from app.models.thinker_mention import ThinkerMention


@router.post("/{note_id}/detect-thinkers", response_model=ThinkerDetectionResult)
def detect_thinkers_in_note(note_id: UUID, db: Session = Depends(get_db)):
    """
    Scan a note's content for thinker names.

    1. Fetches the note
    2. Fetches all thinkers from the database
    3. Runs algorithmic name detection (no AI)
    4. Rebuilds `thinker_mentions` rows for this note
       (optionally syncing `note_mentions` for compatibility)
    5. Returns detected thinkers + unknown names from [[wiki-links]]
    """
    # 1. Fetch note
    db_note = db.query(Note).filter(Note.id == note_id).first()
    if db_note is None:
        raise HTTPException(status_code=404, detail="Note not found")

    # 2. Fetch all thinkers
    all_thinkers = db.query(Thinker).all()

    # 3. Run detection
    matches, unknown_names = detect_thinker_names(db_note.content, all_thinkers)

    # 4a. Rebuild thinker_mentions rows (authoritative detection table)
    db.query(ThinkerMention).filter(
        ThinkerMention.note_id == note_id
    ).delete(synchronize_session="fetch")

    for match in matches:
        db.add(ThinkerMention(
            note_id=note_id,
            thinker_id=match.thinker_id,
            paragraph_index=match.paragraph_index,
            char_offset=match.char_offset,
            mention_text=match.matched_text,
            is_auto_detected=True,
        ))

    # 4b. Optional compatibility sync to note_mentions
    # Keep if legacy UI still depends on db_note.mentioned_thinkers.
    mentioned_ids = {m.thinker_id for m in matches}
    db_note.mentioned_thinkers = []
    for tid in mentioned_ids:
        thinker = db.query(Thinker).filter(Thinker.id == tid).first()
        if thinker:
            db_note.mentioned_thinkers.append(thinker)

    db.commit()

    # 5. Build response
    aggregated = aggregate_matches(matches)

    # Enrich with birth_year, death_year, field from thinker objects
    thinker_map = {t.id: t for t in all_thinkers}
    known_thinkers = []
    for tid, agg in aggregated.items():
        thinker = thinker_map.get(tid)
        if thinker:
            known_thinkers.append(DetectedThinker(
                id=thinker.id,
                name=thinker.name,
                birth_year=thinker.birth_year,
                death_year=thinker.death_year,
                field=thinker.field,
                mention_count=agg["mention_count"],
                paragraph_indices=agg["paragraph_indices"],
            ))

    total_mentions = sum(t.mention_count for t in known_thinkers)

    return ThinkerDetectionResult(
        known_thinkers=known_thinkers,
        unknown_names=unknown_names,
        total_mentions=total_mentions,
    )
```

**Endpoint summary:**

| Method | Path | Request | Response |
|---|---|---|---|
| `POST` | `/api/notes/{note_id}/detect-thinkers` | Empty body (reads note from DB) | `ThinkerDetectionResult` |

The endpoint is `POST` rather than `GET` because it has side effects: it rewrites `thinker_mentions` rows (and optionally syncs `note_mentions`).

---

## Frontend: Types

### Modify: `frontend/src/types/index.ts`

Add after the existing `NoteVersion` interface (around line 442):

```typescript
// Thinker auto-detection types

export interface DetectedThinker {
  id: string
  name: string
  birth_year?: number | null
  death_year?: number | null
  field?: string | null
  mention_count: number
  paragraph_indices: number[]
}

export interface ThinkerDetectionResult {
  known_thinkers: DetectedThinker[]
  unknown_names: string[]
  total_mentions: number
}
```

---

## Frontend: API Client

### Modify: `frontend/src/lib/api.ts`

Add a new `import` for the types at the top of the file (in the existing type import block):

```typescript
import type {
  // ... existing imports ...
  DetectedThinker,
  ThinkerDetectionResult,
} from '@/types'
```

Add the `analysisApi` object after the existing `notesApi`:

```typescript
// Analysis API (thinker detection in notes)
export const analysisApi = {
  detectThinkers: async (noteId: string): Promise<ThinkerDetectionResult> => {
    const response = await api.post(`/api/notes/${noteId}/detect-thinkers`)
    return response.data
  },

  searchThinkers: async (query: string): Promise<Thinker[]> => {
    const response = await api.get('/api/thinkers/', {
      params: { search: query, limit: 10 },
    })
    return response.data
  },
}
```

> **Note:** `searchThinkers` calls the existing `/api/thinkers/` endpoint. If a `search` query parameter is not yet supported, this plan adds one -- see the "Thinker Search Endpoint" section below.

---

## Backend: Thinker Search Support

The TipTap mention dropdown needs to search thinkers by partial name as the user types. The existing `GET /api/thinkers/` endpoint does not support text search. Add a `search` query parameter.

### Modify: `backend/app/routes/thinkers.py`

Update the `get_thinkers` function signature and query:

```python
@router.get("/", response_model=List[schemas.Thinker])
def get_thinkers(
    skip: int = 0,
    limit: int = 100,
    timeline_id: Optional[UUID] = Query(None, description="Filter by timeline ID"),
    search: Optional[str] = Query(None, description="Search thinkers by name (case-insensitive partial match)"),
    db: Session = Depends(get_db)
):
    query = db.query(Thinker)
    if timeline_id:
        query = query.filter(Thinker.timeline_id == timeline_id)
    if search:
        query = query.filter(Thinker.name.ilike(f"%{search}%"))
    thinkers = query.offset(skip).limit(limit).all()
    return thinkers
```

This is a backward-compatible change -- existing callers that omit `search` get the same behavior.

---

## Frontend: TipTap Mention Extension

### File: `frontend/src/components/notes/tiptap-extensions/ThinkerMention.ts`

This file creates a custom TipTap Mention extension that:
- Triggers on `[[` (matching the existing wiki-link syntax)
- Queries the backend for matching thinkers as the user types
- Inserts a mention node containing the thinker's id, name, and metadata
- Automatically appends `]]` after the mention for visual consistency

```typescript
import { Mention } from '@tiptap/extension-mention'
import { mergeAttributes } from '@tiptap/core'
import type { SuggestionOptions } from '@tiptap/suggestion'

/**
 * Thinker mention data stored in the ProseMirror node attributes.
 */
export interface ThinkerMentionAttrs {
  id: string
  name: string
  birthYear?: number | null
  deathYear?: number | null
  field?: string | null
}

/**
 * Custom Mention extension configured for thinker references.
 *
 * - Trigger character: `[[` (matches existing wiki-link syntax)
 * - Node type: `thinkerMention`
 * - Renders as an inline span with data attributes for React to hydrate
 */
export const ThinkerMention = Mention.extend({
  name: 'thinkerMention',

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-thinker-id'),
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-thinker-id': attributes.id,
        }),
      },
      name: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-thinker-name'),
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-thinker-name': attributes.name,
        }),
      },
      birthYear: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const val = element.getAttribute('data-birth-year')
          return val ? parseInt(val, 10) : null
        },
        renderHTML: (attributes: Record<string, unknown>) => {
          if (attributes.birthYear == null) return {}
          return { 'data-birth-year': String(attributes.birthYear) }
        },
      },
      deathYear: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const val = element.getAttribute('data-death-year')
          return val ? parseInt(val, 10) : null
        },
        renderHTML: (attributes: Record<string, unknown>) => {
          if (attributes.deathYear == null) return {}
          return { 'data-death-year': String(attributes.deathYear) }
        },
      },
      field: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-field'),
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.field) return {}
          return { 'data-field': attributes.field }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="thinker-mention"]',
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(
        { 'data-type': 'thinker-mention', class: 'thinker-mention' },
        HTMLAttributes,
      ),
      `${node.attrs.name}`,
    ]
  },
})

/**
 * Factory function to create the suggestion configuration.
 * The actual rendering is handled by the ThinkerSuggestion React component.
 *
 * @param fetchThinkers - Async function that searches thinkers by query string
 * @param onAddNewThinker - Callback when user selects "Add new thinker"
 */
export function createThinkerSuggestion(
  fetchThinkers: (query: string) => Promise<ThinkerMentionAttrs[]>,
  onAddNewThinker: (name: string) => void,
): Partial<SuggestionOptions> {
  return {
    char: '[[',
    // Allow spaces in the query so users can type full names
    allowSpaces: true,
    // Items function: called on every keystroke after the trigger
    items: async ({ query }: { query: string }) => {
      if (!query || query.length < 1) {
        // Return recent/all thinkers when no query yet
        return fetchThinkers('')
      }
      return fetchThinkers(query)
    },
    // The render function is provided externally by ThinkerSuggestion.tsx
    // via tippy.js or a React portal -- see that file for implementation
  }
}
```

---

## Frontend: Thinker Suggestion Dropdown

### File: `frontend/src/components/notes/ThinkerSuggestion.tsx`

```tsx
'use client'

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  forwardRef,
  useImperativeHandle,
} from 'react'
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion'
import type { ThinkerMentionAttrs } from './tiptap-extensions/ThinkerMention'

export interface ThinkerSuggestionRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean
}

interface ThinkerSuggestionProps extends SuggestionProps<ThinkerMentionAttrs> {
  onAddNewThinker?: (name: string) => void
}

/**
 * Dropdown suggestion list rendered when the user types `[[` in the editor.
 *
 * Features:
 * - Shows matching thinkers with birth-death years and field
 * - Keyboard navigation: ArrowUp/Down to move, Enter to select, Escape to close
 * - Last item: "Add new thinker: [query]" if no exact match
 * - Positioned below the cursor via the TipTap suggestion utility
 */
export const ThinkerSuggestionList = forwardRef<
  ThinkerSuggestionRef,
  ThinkerSuggestionProps
>((props, ref) => {
  const { items, command, query } = props
  const [selectedIndex, setSelectedIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  // Determine if we should show the "Add new" option
  const hasExactMatch = items.some(
    (item) => item.name.toLowerCase() === query.toLowerCase()
  )
  const showAddNew = query.length > 0 && !hasExactMatch
  const totalItems = items.length + (showAddNew ? 1 : 0)

  // Reset selection when items change
  useEffect(() => {
    setSelectedIndex(0)
  }, [items])

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const selected = list.children[selectedIndex] as HTMLElement
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  const selectItem = useCallback(
    (index: number) => {
      if (index < items.length) {
        const item = items[index]
        command(item)
      } else if (showAddNew && props.onAddNewThinker) {
        // "Add new thinker" was selected
        props.onAddNewThinker(query)
      }
    },
    [items, command, query, showAddNew, props]
  )

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: SuggestionKeyDownProps) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems)
        return true
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((prev) => (prev + 1) % totalItems)
        return true
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex)
        return true
      }
      if (event.key === 'Escape') {
        return true
      }
      return false
    },
  }))

  if (totalItems === 0) {
    return (
      <div className="bg-white border border-timeline rounded-lg shadow-lg p-3 text-sm text-secondary font-sans">
        No thinkers found
      </div>
    )
  }

  /**
   * Format the year range display string.
   */
  const formatYears = (birth?: number | null, death?: number | null): string => {
    if (birth && death) return `(${birth}\u2013${death})`
    if (birth) return `(b. ${birth})`
    if (death) return `(d. ${death})`
    return ''
  }

  return (
    <div
      ref={listRef}
      className="bg-white border border-timeline rounded-lg shadow-lg max-h-64 overflow-y-auto py-1"
    >
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          onClick={() => selectItem(index)}
          className={`w-full text-left px-3 py-2 flex items-center gap-2 text-sm font-sans transition-colors ${
            index === selectedIndex
              ? 'bg-accent/10 text-accent'
              : 'text-primary hover:bg-gray-50'
          }`}
        >
          <span className="font-medium font-serif">{item.name}</span>
          <span className="text-secondary text-xs">
            {formatYears(item.birthYear, item.deathYear)}
          </span>
          {item.field && (
            <span className="text-xs text-gray-400 ml-auto truncate max-w-[120px]">
              {item.field}
            </span>
          )}
        </button>
      ))}

      {showAddNew && (
        <button
          type="button"
          onClick={() => selectItem(items.length)}
          className={`w-full text-left px-3 py-2 flex items-center gap-2 text-sm font-sans border-t border-timeline transition-colors ${
            selectedIndex === items.length
              ? 'bg-accent/10 text-accent'
              : 'text-secondary hover:bg-gray-50'
          }`}
        >
          <span className="text-accent">+</span>
          <span>
            Add new thinker: <strong className="font-serif">{query}</strong>
          </span>
        </button>
      )}
    </div>
  )
})

ThinkerSuggestionList.displayName = 'ThinkerSuggestionList'
```

### Suggestion Rendering with tippy.js

The TipTap suggestion plugin requires a `render()` function that returns `{ onStart, onUpdate, onKeyDown, onExit }`. This glue code creates a tippy.js popup containing the React `ThinkerSuggestionList`:

```tsx
// This function is added to the same file or a companion file:
// frontend/src/components/notes/thinkerSuggestionRenderer.tsx

import { ReactRenderer } from '@tiptap/react'
import tippy, { type Instance as TippyInstance } from 'tippy.js'
import {
  ThinkerSuggestionList,
  type ThinkerSuggestionRef,
} from './ThinkerSuggestion'

/**
 * Create the render config object that TipTap's Suggestion plugin expects.
 *
 * @param onAddNewThinker - Callback for "Add new thinker" action
 */
export function createSuggestionRenderer(
  onAddNewThinker: (name: string) => void,
) {
  return {
    onStart: (props: Record<string, unknown>) => {
      const component = new ReactRenderer(ThinkerSuggestionList, {
        props: { ...props, onAddNewThinker },
        editor: props.editor as never,
      })

      const popup = tippy('body', {
        getReferenceClientRect: props.clientRect as () => DOMRect,
        appendTo: () => document.body,
        content: component.element,
        showOnCreate: true,
        interactive: true,
        trigger: 'manual',
        placement: 'bottom-start',
      })

      return { component, popup: popup[0] }
    },

    onUpdate: (
      props: Record<string, unknown>,
      state: { component: ReactRenderer; popup: TippyInstance },
    ) => {
      state.component.updateProps({ ...props, onAddNewThinker })
      state.popup.setProps({
        getReferenceClientRect: props.clientRect as () => DOMRect,
      })
    },

    onKeyDown: (
      props: { event: KeyboardEvent },
      state: { component: ReactRenderer },
    ) => {
      if (props.event.key === 'Escape') {
        return true
      }
      const ref = state.component.ref as ThinkerSuggestionRef | null
      return ref?.onKeyDown({ event: props.event }) ?? false
    },

    onExit: (state: { component: ReactRenderer; popup: TippyInstance }) => {
      state.popup.destroy()
      state.component.destroy()
    },
  }
}
```

**Required npm packages** (should already be installed if Plan 3 set up TipTap):

```
@tiptap/extension-mention
@tiptap/suggestion
tippy.js
```

If not yet present, add to `frontend/package.json`:
```bash
npm install @tiptap/extension-mention tippy.js
```

> **Note:** `@tiptap/suggestion` is a peer dependency of `@tiptap/extension-mention` and should be installed automatically.

---

## Frontend: ThinkerChip

### File: `frontend/src/components/notes/ThinkerChip.tsx`

```tsx
'use client'

import { useState, useRef, useEffect } from 'react'

interface ThinkerChipProps {
  name: string
  thinkerId: string
  birthYear?: number | null
  deathYear?: number | null
  field?: string | null
  onClick?: (thinkerId: string) => void
}

/**
 * Inline chip component for displaying a thinker mention in the editor.
 *
 * Renders as a styled inline element with:
 * - Accent background at 10% opacity
 * - Rounded corners
 * - Hover popover showing birth/death years and field
 * - Click handler for future "navigate to thinker" functionality
 */
export function ThinkerChip({
  name,
  thinkerId,
  birthYear,
  deathYear,
  field,
  onClick,
}: ThinkerChipProps) {
  const [showPopover, setShowPopover] = useState(false)
  const chipRef = useRef<HTMLSpanElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Format year range
  const yearDisplay = (() => {
    if (birthYear && deathYear) return `${birthYear}\u2013${deathYear}`
    if (birthYear) return `b. ${birthYear}`
    if (deathYear) return `d. ${deathYear}`
    return null
  })()

  const handleMouseEnter = () => {
    hoverTimerRef.current = setTimeout(() => {
      setShowPopover(true)
    }, 300) // 300ms delay to avoid flickering
  }

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
    setShowPopover(false)
  }

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current)
      }
    }
  }, [])

  // Position popover above the chip
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({})
  useEffect(() => {
    if (showPopover && chipRef.current) {
      const rect = chipRef.current.getBoundingClientRect()
      setPopoverStyle({
        position: 'fixed',
        left: rect.left,
        top: rect.top - 8, // 8px above the chip
        transform: 'translateY(-100%)',
        zIndex: 60,
      })
    }
  }, [showPopover])

  return (
    <>
      <span
        ref={chipRef}
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-serif text-sm cursor-pointer transition-colors"
        style={{
          backgroundColor: 'rgba(139, 69, 19, 0.10)', // #8B4513 at 10%
          color: '#8B4513',
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onClick?.(thinkerId)
        }}
        data-thinker-id={thinkerId}
        contentEditable={false}
      >
        {name}
      </span>

      {/* Hover popover */}
      {showPopover && (yearDisplay || field) && (
        <div
          ref={popoverRef}
          style={popoverStyle}
          className="bg-white border border-timeline rounded-lg shadow-lg px-3 py-2 pointer-events-none"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <p className="font-serif font-medium text-primary text-sm">{name}</p>
          {yearDisplay && (
            <p className="text-xs text-secondary font-mono">{yearDisplay}</p>
          )}
          {field && (
            <p className="text-xs text-gray-500 font-sans mt-0.5">{field}</p>
          )}
        </div>
      )}
    </>
  )
}
```

### CSS for mention nodes

Add to the global CSS file (e.g., `frontend/src/app/globals.css`) or the editor's scoped styles:

```css
/* Thinker mention chip styles in the TipTap editor */
.thinker-mention {
  background-color: rgba(139, 69, 19, 0.10);
  color: #8B4513;
  padding: 1px 6px;
  border-radius: 4px;
  font-family: 'Crimson Text', serif;
  font-size: 0.9em;
  cursor: pointer;
  white-space: nowrap;
}

.thinker-mention:hover {
  background-color: rgba(139, 69, 19, 0.20);
}
```

---

## Frontend: Unknown Thinker Banner

### File: `frontend/src/components/notes/UnknownThinkerBanner.tsx`

```tsx
'use client'

import { useState } from 'react'

interface UnknownThinkerBannerProps {
  unknownNames: string[]
  onAddThinker: (name: string) => void
  onDismiss: (name: string) => void
  onDismissAll: () => void
}

/**
 * Notification banner shown above the editor when unknown names
 * are detected in [[wiki-link]] syntax.
 *
 * For each unknown name:
 * - Displays the name
 * - "Add" button opens AddThinkerModal with name pre-filled
 * - "Dismiss" button hides that particular name
 * - "Dismiss All" clears all unknown name alerts
 */
export function UnknownThinkerBanner({
  unknownNames,
  onAddThinker,
  onDismiss,
  onDismissAll,
}: UnknownThinkerBannerProps) {
  const [dismissedNames, setDismissedNames] = useState<Set<string>>(new Set())

  const visibleNames = unknownNames.filter(
    (name) => !dismissedNames.has(name.toLowerCase())
  )

  if (visibleNames.length === 0) return null

  const handleDismiss = (name: string) => {
    setDismissedNames((prev) => new Set(prev).add(name.toLowerCase()))
    onDismiss(name)
  }

  const handleDismissAll = () => {
    const allLower = new Set(unknownNames.map((n) => n.toLowerCase()))
    setDismissedNames(allLower)
    onDismissAll()
  }

  return (
    <div className="border border-amber-200 bg-amber-50 rounded-lg px-4 py-3 mb-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-sans font-medium text-amber-800">
          Unknown thinker{visibleNames.length > 1 ? 's' : ''} detected
        </h4>
        {visibleNames.length > 1 && (
          <button
            type="button"
            onClick={handleDismissAll}
            className="text-xs text-amber-600 hover:text-amber-800 font-sans"
          >
            Dismiss all
          </button>
        )}
      </div>

      <div className="space-y-2">
        {visibleNames.map((name) => (
          <div
            key={name}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="font-serif text-primary">
              <span className="text-amber-600 font-mono text-xs mr-1">[[</span>
              {name}
              <span className="text-amber-600 font-mono text-xs ml-1">]]</span>
              <span className="text-secondary ml-2">is not in the database</span>
            </span>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => onAddThinker(name)}
                className="px-2 py-1 text-xs font-sans bg-accent text-white rounded hover:bg-opacity-90 transition-colors"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => handleDismiss(name)}
                className="px-2 py-1 text-xs font-sans text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

## Frontend: Integration with RichTextEditor

### Modify: `frontend/src/components/notes/RichTextEditor.tsx`

This file is created by Plan 3 as a TipTap-based rich text editor. The modifications below add thinker detection capabilities.

**Imports to add:**

```tsx
import { useMutation, useQuery } from '@tanstack/react-query'
import { analysisApi, thinkersApi } from '@/lib/api'
import { ThinkerMention, createThinkerSuggestion } from './tiptap-extensions/ThinkerMention'
import { createSuggestionRenderer } from './thinkerSuggestionRenderer'
import { UnknownThinkerBanner } from './UnknownThinkerBanner'
import type { ThinkerDetectionResult, ThinkerMentionAttrs } from '@/types'
```

**State additions inside the component:**

```tsx
const [detectionResult, setDetectionResult] = useState<ThinkerDetectionResult | null>(null)
const [showAddThinkerModal, setShowAddThinkerModal] = useState(false)
const [prefillThinkerName, setPrefillThinkerName] = useState('')

// Mutation for running thinker detection after save
const detectMutation = useMutation({
  mutationFn: (noteId: string) => analysisApi.detectThinkers(noteId),
  onSuccess: (result) => {
    setDetectionResult(result)
  },
})

// Callback for fetching thinkers (used by suggestion dropdown)
const fetchThinkerSuggestions = async (query: string): Promise<ThinkerMentionAttrs[]> => {
  const thinkers = await thinkersApi.getAll()
  const filtered = query
    ? thinkers.filter((t) =>
        t.name.toLowerCase().includes(query.toLowerCase())
      )
    : thinkers.slice(0, 20) // Show first 20 when no query
  return filtered.map((t) => ({
    id: t.id,
    name: t.name,
    birthYear: t.birth_year,
    deathYear: t.death_year,
    field: t.field,
  }))
}

// Callback for "Add new thinker" from suggestion dropdown
const handleAddNewThinker = (name: string) => {
  setPrefillThinkerName(name)
  setShowAddThinkerModal(true)
}
```

**TipTap editor extensions configuration (add ThinkerMention):**

```tsx
const editor = useEditor({
  extensions: [
    StarterKit,
    // ... other extensions from Plan 3 ...
    ThinkerMention.configure({
      HTMLAttributes: {
        class: 'thinker-mention',
      },
      suggestion: {
        ...createThinkerSuggestion(fetchThinkerSuggestions, handleAddNewThinker),
        render: () => createSuggestionRenderer(handleAddNewThinker),
      },
    }),
  ],
  content: initialContent,
  onUpdate: ({ editor }) => {
    onChange?.(editor.getHTML())
  },
})
```

**Post-save detection (call when note is saved):**

```tsx
// In the save handler (e.g., onBlur or explicit save button):
const handleSave = async () => {
  if (!noteId || !editor) return
  const content = editor.getHTML()
  await onSave(content)
  // After saving, run thinker detection
  detectMutation.mutate(noteId)
}
```

**Render the UnknownThinkerBanner above the editor:**

```tsx
return (
  <div>
    {/* Unknown thinker banner */}
    {detectionResult && detectionResult.unknown_names.length > 0 && (
      <UnknownThinkerBanner
        unknownNames={detectionResult.unknown_names}
        onAddThinker={(name) => {
          setPrefillThinkerName(name)
          setShowAddThinkerModal(true)
        }}
        onDismiss={(name) => {
          // Optionally track dismissed names
          console.log(`Dismissed unknown thinker: ${name}`)
        }}
        onDismissAll={() => {
          setDetectionResult(null)
        }}
      />
    )}

    {/* Detection summary (optional, shown below banner) */}
    {detectionResult && detectionResult.total_mentions > 0 && (
      <div className="text-xs text-secondary font-sans mb-2">
        Detected {detectionResult.total_mentions} mention{detectionResult.total_mentions !== 1 ? 's' : ''} of{' '}
        {detectionResult.known_thinkers.length} thinker{detectionResult.known_thinkers.length !== 1 ? 's' : ''}
      </div>
    )}

    {/* TipTap editor */}
    <EditorContent editor={editor} />

    {/* AddThinkerModal for unknown names */}
    {showAddThinkerModal && (
      <AddThinkerModal
        isOpen={showAddThinkerModal}
        onClose={() => {
          setShowAddThinkerModal(false)
          setPrefillThinkerName('')
          // Re-run detection after adding a new thinker
          if (noteId) {
            detectMutation.mutate(noteId)
          }
        }}
        defaultName={prefillThinkerName}
      />
    )}
  </div>
)
```

> **Note on `AddThinkerModal`:** The existing `AddThinkerModal` component accepts `isOpen`, `onClose`, `clickPosition`, and `defaultTimelineId` props. This integration requires adding an optional `defaultName` prop to pre-fill the name field. Add this to the existing component:

### Small modification to `frontend/src/components/AddThinkerModal.tsx`

Add a `defaultName` prop:

```tsx
interface AddThinkerModalProps {
  isOpen: boolean
  onClose: () => void
  clickPosition?: { x: number; y: number } | null
  defaultTimelineId?: string | null
  defaultName?: string  // NEW: Pre-fill name from auto-detection
}

export function AddThinkerModal({
  isOpen,
  onClose,
  clickPosition,
  defaultTimelineId,
  defaultName,  // NEW
}: AddThinkerModalProps) {
  // In the resetForm function and initial state, use defaultName:
  const [formData, setFormData] = useState<ThinkerCreate>({
    name: defaultName || '',
    // ... rest stays the same
  })

  // Also update the useEffect that fires on open:
  useEffect(() => {
    const wasJustOpened = isOpen && !prevIsOpen.current
    if (wasJustOpened) {
      if (defaultName) {
        setFormData(prev => ({ ...prev, name: defaultName }))
      }
      // ... existing timeline logic
    }
    // ...
  }, [isOpen, defaultTimelineId, defaultName])
```

---

## Data Flow Summary

```
User types note content
    |
    v
User saves note (onBlur or save button)
    |
    v
Frontend calls PUT /api/notes/{id} (existing)
    |
    v
Frontend calls POST /api/notes/{id}/detect-thinkers (new)
    |
    v
Backend: detect_thinker_names(content, all_thinkers)
    |
    +---> builds name variant index
    +---> regex scans each paragraph
    +---> deduplicates overlapping matches
    +---> extracts [[wiki-link]] unknowns
    |
    v
Backend: rewrites thinker_mentions rows for this note
    |
    v
Backend: returns ThinkerDetectionResult
    |
    v
Frontend: updates detectionResult state
    |
    +---> Known thinkers: count shown below editor
    +---> Unknown names: UnknownThinkerBanner shown above editor
                |
                +---> "Add" -> opens AddThinkerModal(name pre-filled)
                +---> "Dismiss" -> hides that name
```

Separately, while editing:

```
User types [[ in the editor
    |
    v
TipTap Mention extension triggers suggestion
    |
    v
fetchThinkerSuggestions(query) called
    |
    v
GET /api/thinkers/?search=query (with new search param)
    |
    v
ThinkerSuggestionList renders dropdown
    |
    v
User selects thinker -> mention node inserted
    OR
User selects "Add new" -> AddThinkerModal opens
```

---

## Verification Steps

Execute these steps in order to confirm the implementation is working:

### Step 1: Add test thinkers

Add these thinkers to the database (via the existing Add Thinker UI or API):
- **William James** -- birth_year=1842, death_year=1910, field="Psychology/Philosophy"
- **Charles Sanders Peirce** -- birth_year=1839, death_year=1914, field="Philosophy/Logic"
- **John Dewey** -- birth_year=1859, death_year=1952, field="Philosophy/Education"

### Step 2: Test auto-detection on save

1. Create a note with content:
   ```
   William James discussed the concept of habit extensively in his Principles of Psychology.
   His friend Peirce developed a complementary theory of signs. James and Dewey both
   contributed to the pragmatist tradition.
   ```
2. Save the note.
3. The `detect-thinkers` endpoint should return:
   - `known_thinkers`: William James (2 mentions: "William James", "James"), Peirce (1), Dewey (1)
   - `unknown_names`: [] (empty)
   - `total_mentions`: 4

### Step 3: Test wiki-link unknown detection

1. Edit the note to include: `[[Henri Bergson]] influenced James's thinking.`
2. Save the note.
3. The `detect-thinkers` endpoint should return:
   - `unknown_names`: ["Henri Bergson"]
4. The `UnknownThinkerBanner` should appear above the editor:
   - `[[Henri Bergson]] is not in the database` with "Add" and "Dismiss" buttons

### Step 4: Test Add flow from banner

1. Click "Add" on the Henri Bergson banner.
2. The `AddThinkerModal` should open with "Henri Bergson" pre-filled in the name field.
3. Fill in birth_year=1859, death_year=1941, field="Philosophy".
4. Submit.
5. The modal closes, detection re-runs, and "Henri Bergson" now appears in `known_thinkers`.
6. The banner for Henri Bergson disappears.

### Step 5: Test `[[` suggestion dropdown

1. Open a note in the editor.
2. Type `[[`.
3. The suggestion dropdown should appear showing all thinkers.
4. Type `Pei`.
5. The dropdown filters to show "Charles Sanders Peirce (1839-1914)".
6. Press Enter or click.
7. A mention node is inserted: styled chip showing "Charles Sanders Peirce".

### Step 6: Test hover popover

1. Hover over the "Charles Sanders Peirce" mention chip in the editor.
2. After 300ms, a popover appears showing:
   - **Charles Sanders Peirce**
   - 1839-1914
   - Philosophy/Logic

### Step 7: Test word-boundary matching

1. Create a note with: `The Jamestown settlement predates William James by two centuries.`
2. Save and detect.
3. "William James" should be detected, but "Jamestown" should NOT produce a "James" match (word boundary prevents it).

### Step 8: Test longest-match priority

1. Create a note with: `William James was a pioneer.`
2. Save and detect.
3. The result should contain ONE match for "William James" at offset 0, NOT two matches ("William James" at 0 AND "James" at 8).

### Step 9: Test name variants

1. Create a note with: `According to C.S. Peirce, signs are triadic.`
2. Save and detect.
3. "C.S. Peirce" should match Charles Sanders Peirce.

### Step 10: Test dismissal

1. Trigger an unknown name detection (e.g., `[[Nonexistent Person]]`).
2. Click "Dismiss" on the banner.
3. The individual name disappears.
4. If multiple unknowns, click "Dismiss all".
5. The entire banner disappears.

---

## Edge Cases and Design Notes

| Edge Case | Handling |
|---|---|
| Thinker name is a common word (e.g., "Mill") | Word-boundary matching prevents matching inside "Millionaire". Single-word last names shorter than 3 characters are excluded from last-name-only variants. |
| Same thinker mentioned via full name AND last name in same paragraph | Both matches are detected but collapsed into one thinker in the aggregated result. In the overlap sweep, if they are at different positions, both are kept. |
| Note content contains HTML (from TipTap) | The detection runs on `note.content` (the raw text/markdown content), not on `content_html`. TipTap stores structured JSON; the endpoint operates on the plain-text extraction. |
| Thinker has no birth/death year | Chip and popover gracefully omit the year display. The `formatYears` function returns an empty string. |
| Very large number of thinkers (>1000) | The regex-per-variant approach may slow down. Acceptable for Stephanie's use case (~50-200 thinkers). If performance becomes an issue, a trie-based approach (Aho-Corasick) can replace the regex loop in a future optimization pass. |
| Content is empty or whitespace-only | `detect_thinker_names` returns `([], [])` immediately. |
| [[Wiki-link]] that matches a known thinker | Not included in `unknown_names`. The thinker is added to `mentioned_thinkers` via both the variant matching and the wiki-link matching code paths, but deduplicated in the junction table. |
| Same `[[Name]]` appears multiple times | Deduplicated in `unknown_names` list (appears only once). |

---

## Performance Considerations

| Concern | Analysis |
|---|---|
| Scanning all thinkers for every save | With ~200 thinkers and ~5 variants each, that is ~1000 regex searches per paragraph. For a typical note with ~10-20 paragraphs, this is ~10,000-20,000 regex operations. Each regex is simple (literal string with word boundaries), so total time is well under 100ms on modern hardware. |
| Fetching all thinkers for suggestion dropdown | The `searchThinkers` function uses the existing `GET /api/thinkers/` with a `search` parameter, returning at most 10 results. This is a simple `ILIKE` query. |
| `thinker_mentions` table writes | Clearing and re-inserting mention rows per note is simpler than diffing. For a note with ~10 mentions, this is negligible. |

---

## Files Summary

| # | File | Lines (approx) | Action |
|---|---|---|---|
| 1 | `backend/app/utils/thinker_detection.py` | ~180 | Create |
| 2 | `backend/app/schemas/analysis.py` | ~40 | Create |
| 3 | `backend/app/routes/notes.py` | ~60 added | Modify |
| 4 | `backend/app/routes/thinkers.py` | ~5 changed | Modify |
| 5 | `backend/app/schemas/__init__.py` | ~8 added | Modify |
| 6 | `frontend/src/components/notes/tiptap-extensions/ThinkerMention.ts` | ~120 | Create |
| 7 | `frontend/src/components/notes/thinkerSuggestionRenderer.tsx` | ~60 | Create |
| 8 | `frontend/src/components/notes/ThinkerSuggestion.tsx` | ~170 | Create |
| 9 | `frontend/src/components/notes/ThinkerChip.tsx` | ~130 | Create |
| 10 | `frontend/src/components/notes/UnknownThinkerBanner.tsx` | ~95 | Create |
| 11 | `frontend/src/components/notes/RichTextEditor.tsx` | ~60 added | Modify |
| 12 | `frontend/src/components/AddThinkerModal.tsx` | ~10 changed | Modify |
| 13 | `frontend/src/types/index.ts` | ~15 added | Modify |
| 14 | `frontend/src/lib/api.ts` | ~15 added | Modify |
| 15 | `frontend/src/app/globals.css` | ~12 added | Modify |
