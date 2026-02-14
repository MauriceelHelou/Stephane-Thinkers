# Plan 7: Constellation Visualization

## Goal

Build a term-thinker constellation bubble chart that visualizes the relationship between critical terms and thinkers. Each bubble represents a (term, thinker) pair, with bubble size proportional to the frequency of their co-occurrence across Stephanie's notes. When Stephanie selects a term like "habit," she sees a constellation of thinkers: a massive bubble for James, a medium one for Augustine, a tiny one for Heidegger -- immediately revealing the intellectual landscape around that concept in her own research.

From the transcript: *"Here's your term habit, here's the constellation of thinkers... the bubbles get weighted based on how frequently habit is associated with that thinker. So for James, it's going to be massive. For Augustine, medium. For Heidegger, tiny."*

---

## Dependencies

| Dependency | What it provides | Why this plan needs it |
|---|---|---|
| **Plan 1** (Data Models & Migrations) | `CriticalTerm`, `TermOccurrence`, `ThinkerMention` tables | The database tables that store term and thinker data |
| **Plan 4** (Thinker Auto-Detection) | `ThinkerMention` records populated for each note | Provides the thinker side of the term-thinker matrix |
| **Plan 5** (Critical Terms System) | `CriticalTerm` + `TermOccurrence` records populated | Provides the term side of the term-thinker matrix |

---

## Audit Notes (2026-02-13)

1. `backend/app/schemas/analysis.py` is shared with Plan 4 and later Plan 8; extend it instead of recreating it.
2. `/notes` right panel should use one shared mode state (`rightPanelMode`), not a separate tab state object.
3. Bubble clicks should pass thinker UUID for filtering, not thinker name strings.

---

## How the Analysis Works

The constellation visualization answers the question: **"For a given critical term, which thinkers is it most frequently associated with?"**

A "co-occurrence" is defined as: a `TermOccurrence` and a `ThinkerMention` that both reference the **same note**. If the term "habit" appears in a note and that note also mentions "William James," that counts as one co-occurrence for the (habit, James) pair.

**Query logic:**
1. `JOIN` `term_occurrences` to `thinker_mentions` via their shared `note_id`
2. `GROUP BY` `(critical_term.id, thinker.id)`
3. `COUNT` the number of shared notes (not individual occurrences -- one note counts once per pair)
4. Optionally filter by `folder_id` (via `notes.folder_id`) or by a specific `term_id`

---

## File Summary

| Action | File | What changes |
|---|---|---|
| **CREATE** | `backend/app/routes/analysis.py` | New analysis router with `term-thinker-matrix` endpoint |
| **MODIFY** | `backend/app/schemas/analysis.py` | Extend shared analysis schemas with matrix response models |
| **MODIFY** | `backend/app/main.py` | Register analysis router |
| **MODIFY** | `backend/app/schemas/__init__.py` | Import and export analysis schemas |
| **CREATE** | `frontend/src/components/notes/ConstellationChart.tsx` | SVG bubble chart component |
| **CREATE** | `frontend/src/components/notes/ConstellationTooltip.tsx` | Hover tooltip component |
| **MODIFY** | `frontend/src/types/index.ts` | Add `TermThinkerBubble` and `TermThinkerMatrix` types |
| **MODIFY** | `frontend/src/lib/api.ts` | Add `analysisApi.getTermThinkerMatrix` |
| **MODIFY** | `frontend/src/app/notes/page.tsx` | Add "Constellation" tab to right panel |

**Total: 3 new files, 6 modified files.**

---

## Backend: Schemas (`backend/app/schemas/analysis.py`)

Extend the shared `backend/app/schemas/analysis.py` file with the following Pydantic schemas for matrix responses.

```python
from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from uuid import UUID


class TermThinkerBubble(BaseModel):
    """A single bubble in the constellation chart representing one (term, thinker) pair."""
    model_config = ConfigDict(from_attributes=True)

    term_id: UUID
    term_name: str
    thinker_id: UUID
    thinker_name: str
    thinker_birth_year: Optional[int] = None
    thinker_death_year: Optional[int] = None
    frequency: int  # Number of notes where both the term and thinker co-occur
    sample_snippets: List[str] = []  # Up to 3 context_snippets from TermOccurrence for tooltips


class TermThinkerMatrixResponse(BaseModel):
    """Response for the term-thinker matrix endpoint."""
    model_config = ConfigDict(from_attributes=True)

    bubbles: List[TermThinkerBubble]
    terms: List[str]  # Unique term names present in the result set
    thinkers: List[str]  # Unique thinker names present in the result set
    total_bubbles: int  # len(bubbles), convenience field
    max_frequency: int  # Highest frequency value, used for normalization on the frontend
```

**Schema reference:**

| Schema | Fields | Purpose |
|---|---|---|
| `TermThinkerBubble` | `term_id`, `term_name`, `thinker_id`, `thinker_name`, `thinker_birth_year`, `thinker_death_year`, `frequency`, `sample_snippets` | One bubble in the chart |
| `TermThinkerMatrixResponse` | `bubbles`, `terms`, `thinkers`, `total_bubbles`, `max_frequency` | Full response with metadata for rendering |

**Design note on `sample_snippets`:** These are pulled from `TermOccurrence.context_snippet` for the matching (term, note) pairs. The frontend uses these in the tooltip to show Stephanie actual excerpts from her notes, grounding the frequency number in real content.

---

## Backend: Analysis Routes (`backend/app/routes/analysis.py`)

Create this new file with the analysis router and term-thinker matrix endpoint.

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct
from typing import Optional, List
from uuid import UUID

from app.database import get_db
from app.models.critical_term import CriticalTerm, TermOccurrence
from app.models.thinker_mention import ThinkerMention
from app.models.thinker import Thinker
from app.models.note import Note
from app.schemas.analysis import TermThinkerBubble, TermThinkerMatrixResponse

router = APIRouter(prefix="/api/analysis", tags=["analysis"])


@router.get("/term-thinker-matrix", response_model=TermThinkerMatrixResponse)
def get_term_thinker_matrix(
    folder_id: Optional[UUID] = None,
    term_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
):
    """
    Returns frequency data for term-thinker associations.

    A co-occurrence is counted when a TermOccurrence and a ThinkerMention
    share the same note_id. Each note counts once per (term, thinker) pair
    regardless of how many times the term or thinker appears within that note.

    Optional filters:
    - folder_id: restrict to notes within a specific folder
    - term_id: restrict to a single critical term (single-term constellation view)
    """

    # ---------------------------------------------------------------
    # Step 1: Build the core co-occurrence query
    # ---------------------------------------------------------------
    # We join TermOccurrence and ThinkerMention on shared note_id,
    # then join CriticalTerm and Thinker for their metadata.
    # We use DISTINCT on note_id before counting to avoid double-counting
    # when a term appears multiple times in the same note.
    # ---------------------------------------------------------------
    query = (
        db.query(
            CriticalTerm.id.label("term_id"),
            CriticalTerm.name.label("term_name"),
            Thinker.id.label("thinker_id"),
            Thinker.name.label("thinker_name"),
            Thinker.birth_year.label("thinker_birth_year"),
            Thinker.death_year.label("thinker_death_year"),
            func.count(distinct(TermOccurrence.note_id)).label("frequency"),
        )
        .join(TermOccurrence, TermOccurrence.term_id == CriticalTerm.id)
        .join(ThinkerMention, ThinkerMention.note_id == TermOccurrence.note_id)
        .join(Thinker, Thinker.id == ThinkerMention.thinker_id)
    )

    # ---------------------------------------------------------------
    # Step 2: Apply optional filters
    # ---------------------------------------------------------------
    if folder_id is not None:
        # Join Note table to access folder_id
        query = query.join(Note, Note.id == TermOccurrence.note_id)
        query = query.filter(Note.folder_id == folder_id)

    if term_id is not None:
        query = query.filter(CriticalTerm.id == term_id)

    # Only include active terms
    query = query.filter(CriticalTerm.is_active == True)

    # ---------------------------------------------------------------
    # Step 3: Group and order
    # ---------------------------------------------------------------
    query = query.group_by(
        CriticalTerm.id,
        CriticalTerm.name,
        Thinker.id,
        Thinker.name,
        Thinker.birth_year,
        Thinker.death_year,
    )
    query = query.order_by(func.count(distinct(TermOccurrence.note_id)).desc())

    rows = query.all()

    # ---------------------------------------------------------------
    # Step 4: Fetch sample snippets for each (term, thinker) pair
    # ---------------------------------------------------------------
    bubbles: List[TermThinkerBubble] = []
    unique_terms: set = set()
    unique_thinkers: set = set()
    max_frequency = 0

    for row in rows:
        # Fetch up to 3 context_snippets for this (term, note) combination
        # where the note also has a mention of this thinker
        snippet_query = (
            db.query(TermOccurrence.context_snippet)
            .join(ThinkerMention, ThinkerMention.note_id == TermOccurrence.note_id)
            .filter(
                TermOccurrence.term_id == row.term_id,
                ThinkerMention.thinker_id == row.thinker_id,
            )
        )

        # Apply the same folder filter to snippets for consistency
        if folder_id is not None:
            snippet_query = snippet_query.join(
                Note, Note.id == TermOccurrence.note_id
            )
            snippet_query = snippet_query.filter(Note.folder_id == folder_id)

        # Deduplicate snippets and limit to 3
        snippet_query = snippet_query.distinct().limit(3)
        sample_snippets = [s[0] for s in snippet_query.all() if s[0]]

        bubble = TermThinkerBubble(
            term_id=row.term_id,
            term_name=row.term_name,
            thinker_id=row.thinker_id,
            thinker_name=row.thinker_name,
            thinker_birth_year=row.thinker_birth_year,
            thinker_death_year=row.thinker_death_year,
            frequency=row.frequency,
            sample_snippets=sample_snippets,
        )
        bubbles.append(bubble)

        unique_terms.add(row.term_name)
        unique_thinkers.add(row.thinker_name)

        if row.frequency > max_frequency:
            max_frequency = row.frequency

    return TermThinkerMatrixResponse(
        bubbles=bubbles,
        terms=sorted(unique_terms),
        thinkers=sorted(unique_thinkers),
        total_bubbles=len(bubbles),
        max_frequency=max_frequency if max_frequency > 0 else 1,
    )
```

**Endpoint reference:**

| Method | Path | Query Params | Response |
|---|---|---|---|
| `GET` | `/api/analysis/term-thinker-matrix` | `folder_id?`, `term_id?` | `TermThinkerMatrixResponse` |

**Query explanation (step by step):**

1. **Base join:** `CriticalTerm` -> `TermOccurrence` (via `term_id`) -> `ThinkerMention` (via shared `note_id`) -> `Thinker` (via `thinker_id`). This produces one row for every (term_occurrence, thinker_mention) pair that shares a note.

2. **Distinct count:** `COUNT(DISTINCT TermOccurrence.note_id)` ensures that if "habit" appears 3 times in a single note that also mentions "James," it still counts as frequency=1 for the (habit, James) pair.

3. **Folder filter:** When `folder_id` is provided, we additionally join `Note` and filter on `Note.folder_id`. This allows Stephanie to see the constellation for a specific course or research area.

4. **Term filter:** When `term_id` is provided, the result shows only bubbles for that single term's thinker associations -- the focused "constellation for habit" view.

5. **Snippet fetch:** For each bubble, we run a secondary query to grab up to 3 distinct `context_snippet` values. This is an N+1 query pattern, but N is bounded (typically 20-50 bubbles) and each secondary query is lightweight (indexed FKs, LIMIT 3). If performance becomes an issue with very large datasets, this can be refactored into a window function.

**Performance note:** The main query performs well with indexes on `term_occurrences.note_id`, `term_occurrences.term_id`, `thinker_mentions.note_id`, and `thinker_mentions.thinker_id`. All of these are foreign key columns that SQLAlchemy's `ForeignKey` constraint hints to index (and Alembic typically creates indexes for). If not, add explicit indexes in a migration.

---

## Backend: Registration

### Modification: `backend/app/main.py`

Add the analysis router import and registration.

**What to add** (import line):

```python
from app.routes import thinkers, connections, publications, quotes, tags, timelines, timeline_events, combined_timeline_views, institutions, notes, research_questions, ai, quiz, auth, analysis
```

**What to add** (router registration, after `auth.router`):

```python
app.include_router(analysis.router)
```

**Full diff:**

```diff
--- a/backend/app/main.py
+++ b/backend/app/main.py
@@ -10,7 +10,7 @@
 from fastapi.middleware.cors import CORSMiddleware

-from app.routes import thinkers, connections, publications, quotes, tags, timelines, timeline_events, combined_timeline_views, institutions, notes, research_questions, ai, quiz, auth
+from app.routes import thinkers, connections, publications, quotes, tags, timelines, timeline_events, combined_timeline_views, institutions, notes, research_questions, ai, quiz, auth, analysis
 from app.routes import test as test_routes

@@ -66,6 +66,7 @@
 app.include_router(quiz.router)
 app.include_router(auth.router)
+app.include_router(analysis.router)

 # Only include test routes in development
```

### Modification: `backend/app/schemas/__init__.py`

Add imports for analysis schemas.

**What to add** (after the quiz imports):

```python
from app.schemas.analysis import (
    TermThinkerBubble,
    TermThinkerMatrixResponse,
)
```

**What to add** (in `__all__` list, at the end):

```python
    # Analysis (Plan 7)
    "TermThinkerBubble",
    "TermThinkerMatrixResponse",
```

**Full diff:**

```diff
--- a/backend/app/schemas/__init__.py
+++ b/backend/app/schemas/__init__.py
@@ -117,6 +117,10 @@
     QuizHistoryParams,
 )
+from app.schemas.analysis import (
+    TermThinkerBubble,
+    TermThinkerMatrixResponse,
+)

 __all__ = [
@@ -226,4 +230,7 @@
     "QuizStatistics",
     "QuizHistoryParams",
+    # Analysis (Plan 7)
+    "TermThinkerBubble",
+    "TermThinkerMatrixResponse",
 ]
```

---

## Frontend: Types (`frontend/src/types/index.ts` additions)

Add these interfaces at the end of the file, before or after the Quiz types section.

```typescript
// ============ Constellation / Analysis Types (Plan 7) ============

export interface TermThinkerBubble {
  term_id: string
  term_name: string
  thinker_id: string
  thinker_name: string
  thinker_birth_year?: number | null
  thinker_death_year?: number | null
  frequency: number
  sample_snippets: string[]
}

export interface TermThinkerMatrix {
  bubbles: TermThinkerBubble[]
  terms: string[]
  thinkers: string[]
  total_bubbles: number
  max_frequency: number
}
```

**Diff:**

```diff
--- a/frontend/src/types/index.ts
+++ b/frontend/src/types/index.ts
@@ -673,3 +673,22 @@
   improvement_trend: number
 }
+
+// ============ Constellation / Analysis Types (Plan 7) ============
+
+export interface TermThinkerBubble {
+  term_id: string
+  term_name: string
+  thinker_id: string
+  thinker_name: string
+  thinker_birth_year?: number | null
+  thinker_death_year?: number | null
+  frequency: number
+  sample_snippets: string[]
+}
+
+export interface TermThinkerMatrix {
+  bubbles: TermThinkerBubble[]
+  terms: string[]
+  thinkers: string[]
+  total_bubbles: number
+  max_frequency: number
+}
```

---

## Frontend: API Client (`frontend/src/lib/api.ts` additions)

Extend the existing `analysisApi` object (introduced in Plan 4) with a matrix method.

**What to add** (inside the existing `analysisApi` object):

```typescript
// Analysis API (Plan 7 - Constellation Visualization)
export const analysisApi = {
  // Existing Plan 4 methods should remain:
  // detectThinkers(...)
  // searchThinkers(...)

  getTermThinkerMatrix: async (filters?: {
    folder_id?: string
    term_id?: string
  }): Promise<TermThinkerMatrix> => {
    const response = await api.get('/api/analysis/term-thinker-matrix', { params: filters })
    return response.data
  },
}
```

**What to add** (in the import block at the top of the file, add to the existing type imports):

```typescript
import type {
  // ... existing imports ...
  TermThinkerMatrix,
} from '@/types'
```

Do not create a second `analysisApi` export.

---

## Frontend: ConstellationChart (`frontend/src/components/notes/ConstellationChart.tsx`)

This is the main SVG bubble chart component. It takes the term-thinker matrix data and renders an interactive constellation.

### Layout Algorithm

The chart uses a **spiral circle-packing** algorithm:

1. **Normalize** each bubble's frequency to a radius between `MIN_RADIUS` (20px) and `MAX_RADIUS` (80px) using linear interpolation against `max_frequency`.
2. **Sort** bubbles by frequency descending (largest first -- they get placed first and dominate the center).
3. **Place** the first bubble at the center of the SVG viewBox (400, 300).
4. **For each subsequent bubble**, spiral outward from the center in small angle increments. At each candidate position, check for overlap with all previously placed bubbles using collision detection: `distance(center_a, center_b) > radius_a + radius_b + PADDING`.
5. Accept the first non-overlapping position found.

This produces a natural, organic layout that fills from the center outward, with the largest (most frequent) bubbles at the core.

### Color Scheme

Two modes, toggleable:

| Mode | How colors are assigned | Use case |
|---|---|---|
| **Color by Thinker** | Each unique thinker gets a color from the palette | See which thinkers dominate across terms |
| **Color by Term** | Each unique term gets a color from the palette | See which terms cluster around which thinkers |

The palette extends the existing connection colors:

```typescript
const CONSTELLATION_PALETTE = [
  '#2563EB', // Blue (from connection colors)
  '#DC2626', // Red
  '#16A34A', // Green
  '#9333EA', // Purple
  '#EA580C', // Orange
  '#0D9488', // Teal
  '#DB2777', // Pink
  '#CA8A04', // Amber
  '#4F46E5', // Indigo
  '#059669', // Emerald
]
```

### Full Code

```tsx
'use client'

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { analysisApi } from '@/lib/api'
import type { TermThinkerBubble, TermThinkerMatrix } from '@/types'
import ConstellationTooltip from './ConstellationTooltip'

// ---------------------------------------------------------------
// Constants
// ---------------------------------------------------------------

const SVG_WIDTH = 800
const SVG_HEIGHT = 600
const MIN_RADIUS = 20
const MAX_RADIUS = 80
const BUBBLE_PADDING = 6 // px between bubbles
const SPIRAL_STEP_ANGLE = 0.3 // radians per step
const SPIRAL_STEP_RADIUS = 2 // px outward per step
const MAX_SPIRAL_STEPS = 2000

const CONSTELLATION_PALETTE = [
  '#2563EB', // Blue
  '#DC2626', // Red
  '#16A34A', // Green
  '#9333EA', // Purple
  '#EA580C', // Orange
  '#0D9488', // Teal
  '#DB2777', // Pink
  '#CA8A04', // Amber
  '#4F46E5', // Indigo
  '#059669', // Emerald
]

type ColorMode = 'thinker' | 'term'

interface PlacedBubble {
  bubble: TermThinkerBubble
  x: number
  y: number
  radius: number
}

// ---------------------------------------------------------------
// Layout: spiral circle packing
// ---------------------------------------------------------------

function computeRadius(frequency: number, maxFrequency: number): number {
  if (maxFrequency <= 1) return MIN_RADIUS
  const t = frequency / maxFrequency
  return MIN_RADIUS + t * (MAX_RADIUS - MIN_RADIUS)
}

function placeBubbles(
  bubbles: TermThinkerBubble[],
  maxFrequency: number
): PlacedBubble[] {
  // Sort largest first
  const sorted = [...bubbles].sort((a, b) => b.frequency - a.frequency)
  const placed: PlacedBubble[] = []
  const centerX = SVG_WIDTH / 2
  const centerY = SVG_HEIGHT / 2

  for (const bubble of sorted) {
    const radius = computeRadius(bubble.frequency, maxFrequency)

    if (placed.length === 0) {
      // First bubble goes to center
      placed.push({ bubble, x: centerX, y: centerY, radius })
      continue
    }

    // Spiral outward until we find a non-overlapping position
    let angle = 0
    let spiralRadius = 0
    let foundPosition = false

    for (let step = 0; step < MAX_SPIRAL_STEPS; step++) {
      const candidateX = centerX + spiralRadius * Math.cos(angle)
      const candidateY = centerY + spiralRadius * Math.sin(angle)

      // Check for overlap with all placed bubbles
      const hasOverlap = placed.some((p) => {
        const dx = candidateX - p.x
        const dy = candidateY - p.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        return dist < radius + p.radius + BUBBLE_PADDING
      })

      // Also check bounds (keep bubble fully inside viewBox with some margin)
      const inBounds =
        candidateX - radius >= 10 &&
        candidateX + radius <= SVG_WIDTH - 10 &&
        candidateY - radius >= 10 &&
        candidateY + radius <= SVG_HEIGHT - 10

      if (!hasOverlap && inBounds) {
        placed.push({ bubble, x: candidateX, y: candidateY, radius })
        foundPosition = true
        break
      }

      angle += SPIRAL_STEP_ANGLE
      spiralRadius += SPIRAL_STEP_RADIUS
    }

    // If we couldn't find a position (very crowded), place at last spiral position
    if (!foundPosition) {
      const fallbackX = centerX + spiralRadius * Math.cos(angle)
      const fallbackY = centerY + spiralRadius * Math.sin(angle)
      placed.push({ bubble, x: fallbackX, y: fallbackY, radius })
    }
  }

  return placed
}

// ---------------------------------------------------------------
// Component Props
// ---------------------------------------------------------------

interface ConstellationChartProps {
  /** When set, shows constellation for a single term only */
  selectedTermId?: string | null
  /** When set, filters to notes in a specific folder */
  folderId?: string | null
  /** Callback when a bubble is clicked -- navigates to definition view */
  onBubbleClick?: (termId: string, thinkerId: string, thinkerName: string) => void
}

// ---------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------

export default function ConstellationChart({
  selectedTermId,
  folderId,
  onBubbleClick,
}: ConstellationChartProps) {
  // ---- State ----
  const [colorMode, setColorMode] = useState<ColorMode>('thinker')
  const [hoveredBubble, setHoveredBubble] = useState<PlacedBubble | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  })
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: SVG_WIDTH, h: SVG_HEIGHT })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null)

  const svgRef = useRef<SVGSVGElement>(null)

  // ---- Data Fetching ----
  const { data: matrix, isLoading, error } = useQuery<TermThinkerMatrix>({
    queryKey: ['term-thinker-matrix', folderId, selectedTermId],
    queryFn: () =>
      analysisApi.getTermThinkerMatrix({
        folder_id: folderId || undefined,
        term_id: selectedTermId || undefined,
      }),
  })

  // ---- Layout Computation ----
  const placedBubbles = useMemo(() => {
    if (!matrix || matrix.bubbles.length === 0) return []
    return placeBubbles(matrix.bubbles, matrix.max_frequency)
  }, [matrix])

  // ---- Color Assignment ----
  const colorMap = useMemo(() => {
    if (!matrix) return new Map<string, string>()
    const map = new Map<string, string>()
    const keys = colorMode === 'thinker' ? matrix.thinkers : matrix.terms
    keys.forEach((key, index) => {
      map.set(key, CONSTELLATION_PALETTE[index % CONSTELLATION_PALETTE.length])
    })
    return map
  }, [matrix, colorMode])

  const getBubbleColor = useCallback(
    (bubble: TermThinkerBubble): string => {
      const key = colorMode === 'thinker' ? bubble.thinker_name : bubble.term_name
      return colorMap.get(key) || CONSTELLATION_PALETTE[0]
    },
    [colorMode, colorMap]
  )

  // ---- Font Size Based on Radius ----
  const getFontSize = (radius: number): number => {
    if (radius >= 60) return 14
    if (radius >= 40) return 12
    if (radius >= 30) return 10
    return 9
  }

  const getSmallFontSize = (radius: number): number => {
    if (radius >= 60) return 11
    if (radius >= 40) return 9
    if (radius >= 30) return 8
    return 7
  }

  // ---- Truncate Text to Fit Circle ----
  const truncateText = (text: string, radius: number): string => {
    // Approximate: each character is about 7px wide at font size 12
    const fontSize = getFontSize(radius)
    const charWidth = fontSize * 0.55
    const maxChars = Math.floor((radius * 1.6) / charWidth)
    if (text.length <= maxChars) return text
    return text.slice(0, maxChars - 1) + '\u2026'
  }

  // ---- Mouse Handlers for Tooltips ----
  const handleMouseEnter = useCallback(
    (placed: PlacedBubble, event: React.MouseEvent) => {
      setHoveredBubble(placed)
      setTooltipPosition({ x: event.clientX, y: event.clientY })
    },
    []
  )

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (hoveredBubble) {
        setTooltipPosition({ x: event.clientX, y: event.clientY })
      }
    },
    [hoveredBubble]
  )

  const handleMouseLeave = useCallback(() => {
    setHoveredBubble(null)
  }, [])

  // ---- Zoom (mouse wheel on SVG viewBox) ----
  const handleWheel = useCallback(
    (event: React.WheelEvent<SVGSVGElement>) => {
      event.preventDefault()
      const zoomFactor = event.deltaY > 0 ? 1.1 : 0.9
      const newW = viewBox.w * zoomFactor
      const newH = viewBox.h * zoomFactor

      // Zoom toward mouse position
      const svg = svgRef.current
      if (!svg) return
      const rect = svg.getBoundingClientRect()
      const mouseXRatio = (event.clientX - rect.left) / rect.width
      const mouseYRatio = (event.clientY - rect.top) / rect.height

      const newX = viewBox.x + (viewBox.w - newW) * mouseXRatio
      const newY = viewBox.y + (viewBox.h - newH) * mouseYRatio

      setViewBox({ x: newX, y: newY, w: newW, h: newH })
    },
    [viewBox]
  )

  // ---- Pan (drag to move) ----
  const handlePanStart = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      // Only pan on middle-click or when holding shift
      if (event.button === 1 || event.shiftKey) {
        event.preventDefault()
        setIsPanning(true)
        setPanStart({ x: event.clientX, y: event.clientY })
      }
    },
    []
  )

  const handlePanMove = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      if (!isPanning || !panStart || !svgRef.current) return
      const rect = svgRef.current.getBoundingClientRect()
      const scaleX = viewBox.w / rect.width
      const scaleY = viewBox.h / rect.height
      const dx = (event.clientX - panStart.x) * scaleX
      const dy = (event.clientY - panStart.y) * scaleY
      setViewBox((prev) => ({ ...prev, x: prev.x - dx, y: prev.y - dy }))
      setPanStart({ x: event.clientX, y: event.clientY })
    },
    [isPanning, panStart, viewBox.w, viewBox.h]
  )

  const handlePanEnd = useCallback(() => {
    setIsPanning(false)
    setPanStart(null)
  }, [])

  // Reset zoom on double-click
  const handleDoubleClick = useCallback(() => {
    setViewBox({ x: 0, y: 0, w: SVG_WIDTH, h: SVG_HEIGHT })
  }, [])

  // ---- Bubble Click ----
  const handleBubbleClick = useCallback(
    (placed: PlacedBubble) => {
      if (onBubbleClick) {
        onBubbleClick(
          String(placed.bubble.term_id),
          String(placed.bubble.thinker_id),
          placed.bubble.thinker_name
        )
      }
    },
    [onBubbleClick]
  )

  // ---- Render States ----
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-[#1A1A1A]/50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8B4513] mx-auto mb-3" />
          <p className="font-['Inter'] text-sm">Loading constellation data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-600">
        <p className="font-['Inter'] text-sm">
          Failed to load constellation data. Make sure notes have thinker mentions and critical terms.
        </p>
      </div>
    )
  }

  if (!matrix || matrix.bubbles.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[#1A1A1A]/50">
        <div className="text-center max-w-xs">
          <p className="font-['Crimson_Text'] text-lg mb-2">No constellation data yet</p>
          <p className="font-['Inter'] text-sm">
            The constellation appears when notes contain both critical terms and thinker mentions.
            Flag some terms (Plan 5) and detect thinkers (Plan 4) to populate this view.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* ---- Controls Bar ---- */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#1A1A1A]/10 bg-[#FAFAF8]">
        {/* Color mode toggle */}
        <div className="flex items-center gap-2">
          <span className="font-['Inter'] text-xs text-[#1A1A1A]/60">Color by:</span>
          <button
            onClick={() => setColorMode('thinker')}
            className={`px-2 py-1 text-xs font-['Inter'] rounded transition-colors ${
              colorMode === 'thinker'
                ? 'bg-[#8B4513] text-white'
                : 'bg-[#1A1A1A]/5 text-[#1A1A1A]/70 hover:bg-[#1A1A1A]/10'
            }`}
          >
            Thinker
          </button>
          <button
            onClick={() => setColorMode('term')}
            className={`px-2 py-1 text-xs font-['Inter'] rounded transition-colors ${
              colorMode === 'term'
                ? 'bg-[#8B4513] text-white'
                : 'bg-[#1A1A1A]/5 text-[#1A1A1A]/70 hover:bg-[#1A1A1A]/10'
            }`}
          >
            Term
          </button>
        </div>

        {/* Size legend */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <svg width="12" height="12">
              <circle cx="6" cy="6" r="4" fill="#1A1A1A" opacity="0.2" />
            </svg>
            <span className="font-['Inter'] text-[10px] text-[#1A1A1A]/50">1-2</span>
          </div>
          <div className="flex items-center gap-1">
            <svg width="16" height="16">
              <circle cx="8" cy="8" r="6" fill="#1A1A1A" opacity="0.2" />
            </svg>
            <span className="font-['Inter'] text-[10px] text-[#1A1A1A]/50">3-10</span>
          </div>
          <div className="flex items-center gap-1">
            <svg width="22" height="22">
              <circle cx="11" cy="11" r="9" fill="#1A1A1A" opacity="0.2" />
            </svg>
            <span className="font-['Inter'] text-[10px] text-[#1A1A1A]/50">10+</span>
          </div>
        </div>

        {/* Bubble count */}
        <span className="font-['Inter'] text-xs text-[#1A1A1A]/40">
          {matrix.total_bubbles} pair{matrix.total_bubbles !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ---- SVG Chart ---- */}
      <div className="flex-1 overflow-hidden">
        <svg
          ref={svgRef}
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
          className="w-full h-full"
          style={{ cursor: isPanning ? 'grabbing' : 'default' }}
          onWheel={handleWheel}
          onMouseDown={handlePanStart}
          onMouseMove={(e) => {
            handlePanMove(e)
            handleMouseMove(e)
          }}
          onMouseUp={handlePanEnd}
          onMouseLeave={() => {
            handlePanEnd()
            handleMouseLeave()
          }}
          onDoubleClick={handleDoubleClick}
        >
          {/* Background */}
          <rect
            x={viewBox.x}
            y={viewBox.y}
            width={viewBox.w}
            height={viewBox.h}
            fill="#FAFAF8"
          />

          {/* Bubbles */}
          {placedBubbles.map((placed) => {
            const color = getBubbleColor(placed.bubble)
            const isHovered =
              hoveredBubble &&
              hoveredBubble.bubble.term_id === placed.bubble.term_id &&
              hoveredBubble.bubble.thinker_id === placed.bubble.thinker_id
            const fontSize = getFontSize(placed.radius)
            const smallFontSize = getSmallFontSize(placed.radius)

            return (
              <g
                key={`${placed.bubble.term_id}-${placed.bubble.thinker_id}`}
                transform={`translate(${placed.x}, ${placed.y})`}
                onMouseEnter={(e) => handleMouseEnter(placed, e)}
                onMouseLeave={handleMouseLeave}
                onClick={() => handleBubbleClick(placed)}
                style={{ cursor: 'pointer' }}
              >
                {/* Bubble circle */}
                <circle
                  r={placed.radius}
                  fill={color}
                  opacity={isHovered ? 0.9 : 0.65}
                  stroke={isHovered ? '#1A1A1A' : color}
                  strokeWidth={isHovered ? 2 : 1}
                  strokeOpacity={isHovered ? 0.8 : 0.3}
                />

                {/* Thinker name (primary label) */}
                <text
                  textAnchor="middle"
                  dy="-0.2em"
                  fontSize={fontSize}
                  fontFamily="'Crimson Text', serif"
                  fontWeight="600"
                  fill="white"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {truncateText(placed.bubble.thinker_name, placed.radius)}
                </text>

                {/* Term name + frequency (secondary label) */}
                {placed.radius >= 30 && (
                  <text
                    textAnchor="middle"
                    dy="1.2em"
                    fontSize={smallFontSize}
                    fontFamily="'Inter', sans-serif"
                    fill="white"
                    opacity={0.85}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {truncateText(placed.bubble.term_name, placed.radius)} ({placed.bubble.frequency})
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* ---- Tooltip (portal) ---- */}
      {hoveredBubble && (
        <ConstellationTooltip
          bubble={hoveredBubble.bubble}
          position={tooltipPosition}
        />
      )}
    </div>
  )
}
```

**Component reference:**

| Prop | Type | Required | Description |
|---|---|---|---|
| `selectedTermId` | `string \| null` | No | When set, fetches matrix for a single term only |
| `folderId` | `string \| null` | No | When set, filters to notes in a specific folder |
| `onBubbleClick` | `(termId, thinkerId, thinkerName) => void` | No | Called when user clicks a bubble; used to navigate to definition view |

---

## Frontend: ConstellationTooltip (`frontend/src/components/notes/ConstellationTooltip.tsx`)

The tooltip appears near the mouse cursor when hovering a bubble. It uses `ReactDOM.createPortal` to render outside the SVG and avoid clipping.

### Full Code

```tsx
'use client'

import React from 'react'
import { createPortal } from 'react-dom'
import type { TermThinkerBubble } from '@/types'

interface ConstellationTooltipProps {
  bubble: TermThinkerBubble
  position: { x: number; y: number }
}

export default function ConstellationTooltip({
  bubble,
  position,
}: ConstellationTooltipProps) {
  // Format the thinker's life dates
  const lifeDates = (() => {
    if (bubble.thinker_birth_year && bubble.thinker_death_year) {
      return `${bubble.thinker_birth_year}\u2013${bubble.thinker_death_year}`
    }
    if (bubble.thinker_birth_year) {
      return `b. ${bubble.thinker_birth_year}`
    }
    return null
  })()

  // Position the tooltip near the cursor but offset to avoid covering it.
  // Flip if too close to the right or bottom edge.
  const OFFSET_X = 16
  const OFFSET_Y = 16
  const TOOLTIP_WIDTH = 280

  const left =
    position.x + OFFSET_X + TOOLTIP_WIDTH > window.innerWidth
      ? position.x - OFFSET_X - TOOLTIP_WIDTH
      : position.x + OFFSET_X

  const top =
    position.y + OFFSET_Y + 200 > window.innerHeight
      ? position.y - OFFSET_Y - 100
      : position.y + OFFSET_Y

  const tooltipContent = (
    <div
      className="fixed z-[9999] pointer-events-none"
      style={{ left, top }}
    >
      <div
        className="rounded-lg shadow-lg border border-[#1A1A1A]/10 p-3 max-w-[280px]"
        style={{ backgroundColor: '#FAFAF8' }}
      >
        {/* Header: Thinker name + dates */}
        <div className="mb-2">
          <span className="font-['Crimson_Text'] text-base font-semibold text-[#1A1A1A]">
            {bubble.thinker_name}
          </span>
          {lifeDates && (
            <span className="font-['Inter'] text-xs text-[#1A1A1A]/50 ml-2">
              ({lifeDates})
            </span>
          )}
        </div>

        {/* Term + frequency */}
        <div className="flex items-center gap-2 mb-2">
          <span className="font-['Inter'] text-xs px-2 py-0.5 rounded bg-[#8B4513]/10 text-[#8B4513] font-medium">
            {bubble.term_name}
          </span>
          <span className="font-['Inter'] text-xs text-[#1A1A1A]/60">
            {bubble.frequency} co-occurrence{bubble.frequency !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Sample snippets */}
        {bubble.sample_snippets.length > 0 && (
          <div className="border-t border-[#1A1A1A]/10 pt-2 mt-2">
            <p className="font-['Inter'] text-[10px] text-[#1A1A1A]/40 uppercase tracking-wide mb-1">
              From your notes
            </p>
            {bubble.sample_snippets.map((snippet, i) => (
              <p
                key={i}
                className="font-['Crimson_Text'] text-xs text-[#1A1A1A]/70 italic mb-1 leading-relaxed"
              >
                &ldquo;{snippet.length > 120 ? snippet.slice(0, 120) + '\u2026' : snippet}&rdquo;
              </p>
            ))}
          </div>
        )}

        {/* Click hint */}
        <p className="font-['Inter'] text-[10px] text-[#1A1A1A]/30 mt-2">
          Click to view definition
        </p>
      </div>
    </div>
  )

  // Portal to document.body so it's not clipped by SVG or overflow:hidden parents
  if (typeof window === 'undefined') return null
  return createPortal(tooltipContent, document.body)
}
```

**Component reference:**

| Prop | Type | Required | Description |
|---|---|---|---|
| `bubble` | `TermThinkerBubble` | Yes | The bubble data to display in the tooltip |
| `position` | `{ x: number; y: number }` | Yes | Mouse cursor position for tooltip placement |

**Styling notes:**
- Uses `Crimson Text` (serif) for the thinker name and quote snippets, matching the design system's header/literary convention
- Uses `Inter` (sans) for labels and metadata
- The term badge uses a soft `#8B4513` (Harvard crimson) tint for visual consistency
- `pointer-events: none` on the tooltip container prevents it from interfering with mouse events on the chart
- `z-index: 9999` ensures the tooltip renders above everything else
- Snippets are truncated at 120 characters to keep the tooltip compact

---

## Frontend: Integration with Notes Page

### Modification: `frontend/src/app/notes/page.tsx`

The notes page (built in Plan 3) has a three-panel layout:
- **Left panel:** folder tree + note list
- **Center panel:** TipTap editor
- **Right panel:** tabbed area for analysis views

Plan 6 adds a "Definition" tab to the right panel. Plan 7 adds a "Constellation" tab alongside it.

**What to add:**

1. Import `ConstellationChart`:

```typescript
import ConstellationChart from '@/components/notes/ConstellationChart'
```

2. Ensure the shared right-panel mode supports `'constellation'`:

```typescript
const [rightPanelMode, setRightPanelMode] = useState<
  'none' | 'definition' | 'constellation' | 'connections'
>('none')
```

3. Add the tab button in the right panel header:

```tsx
{/* Right Panel Tab Bar */}
<div className="flex border-b border-[#1A1A1A]/10">
  <button
    onClick={() => setRightPanelMode('definition')}
    className={`flex-1 px-4 py-2 text-xs font-['Inter'] transition-colors ${
      rightPanelMode === 'definition'
        ? 'border-b-2 border-[#8B4513] text-[#8B4513] font-medium'
        : 'text-[#1A1A1A]/50 hover:text-[#1A1A1A]/70'
    }`}
  >
    Definition
  </button>
  <button
    onClick={() => setRightPanelMode('constellation')}
    className={`flex-1 px-4 py-2 text-xs font-['Inter'] transition-colors ${
      rightPanelMode === 'constellation'
        ? 'border-b-2 border-[#8B4513] text-[#8B4513] font-medium'
        : 'text-[#1A1A1A]/50 hover:text-[#1A1A1A]/70'
    }`}
  >
    Constellation
  </button>
</div>
```

4. Render `ConstellationChart` when the tab is active:

```tsx
{/* Right Panel Content */}
{rightPanelMode === 'constellation' && (
  <ConstellationChart
    selectedTermId={selectedTermId}
    folderId={selectedFolderId}
    onBubbleClick={(termId, thinkerId) => {
      // Switch to definition tab, filtered by this thinker
      setRightPanelMode('definition')
      setSelectedTermId(termId)
      setSelectedDefinitionThinkerId(thinkerId)
    }}
  />
)}
```

**Integration behavior:**

| User action | What happens |
|---|---|
| Selects a term in sidebar | `selectedTermId` updates, constellation refetches showing only that term's thinker bubbles |
| No term selected | Constellation shows all terms and all thinkers (full matrix view) |
| Selects a folder | `selectedFolderId` updates, constellation filters to notes in that folder |
| Clicks a bubble | Right panel switches to "Definition" tab with the term filtered by the clicked thinker (connects to Plan 6) |
| Hovers a bubble | Tooltip shows thinker name, life dates, term name, frequency, and up to 3 note excerpts |
| Mouse wheel on chart | Zooms in/out on the SVG |
| Shift+drag on chart | Pans the view |
| Double-click chart | Resets zoom to default |

---

## Verification Steps

After implementing all files, verify the constellation works end-to-end:

### Prerequisites
Ensure the database is populated with test data:
- Several notes exist in at least two different folders
- Each note has been scanned for thinker mentions (Plan 4 executed, so `thinker_mentions` table has records)
- Several critical terms exist and have been scanned across notes (Plan 5 executed, so `term_occurrences` table has records)
- At least some notes contain both a critical term AND a thinker mention (creating co-occurrences)

### Test Cases

1. **API returns data:** `GET /api/analysis/term-thinker-matrix` returns a `TermThinkerMatrixResponse` with non-empty `bubbles` array, correct `terms` and `thinkers` lists, and `max_frequency` > 0.

2. **Frequency is correct:** For a known (term, thinker) pair where the term "habit" appears in 5 notes that also mention "William James," the frequency should be 5. Verify by checking the API response.

3. **Folder filter works:** `GET /api/analysis/term-thinker-matrix?folder_id=<id>` returns only bubbles from notes in that folder. Compare against the unfiltered result to confirm fewer/different bubbles.

4. **Term filter works:** `GET /api/analysis/term-thinker-matrix?term_id=<id>` returns only bubbles for that single term. The `terms` list should have exactly one entry.

5. **Navigate to /notes, click "Constellation" tab** in the right panel. The SVG bubble chart renders with bubbles of varying sizes.

6. **Largest bubble is correct:** The bubble with the highest frequency is the largest and placed near the center. Visual inspection confirms it matches the expected (term, thinker) pair.

7. **Hover a bubble:** A tooltip appears near the cursor showing thinker name, life dates (if available), term name, frequency count, and up to 3 sample snippets from notes.

8. **Toggle "Color by Thinker" vs "Color by Term":** Click the toggle buttons above the chart. Bubble colors change. In "Thinker" mode, all bubbles for the same thinker share a color. In "Term" mode, all bubbles for the same term share a color.

9. **Filter to single folder:** Select a folder in the left sidebar. The constellation reloads with data scoped to that folder's notes. Bubble sizes may change as some (term, thinker) pairs have fewer co-occurrences in the subset.

10. **Filter to single term:** Select a critical term in the sidebar. The constellation switches to showing only that term's thinker associations -- a focused view with one color if "Color by Term" is active.

11. **Click a bubble:** The right panel switches from "Constellation" tab to "Definition" tab, filtered by the clicked thinker. This confirms the integration with Plan 6.

12. **Zoom works:** Use mouse wheel on the chart. The SVG viewBox adjusts, zooming in or out around the cursor position.

13. **Pan works:** Hold Shift and drag on the chart. The viewBox shifts, panning the view.

14. **Double-click resets:** Double-click the chart. The zoom resets to the default viewBox (0, 0, 800, 600).

15. **Empty state:** If no co-occurrence data exists (no notes have both terms and thinkers), the chart shows the empty state message explaining what's needed.

16. **Loading state:** While the API request is in flight, a loading spinner appears.

17. **Error state:** If the API returns an error (e.g., server down), an error message is displayed.

---

## Edge Cases and Design Decisions

### Bubble Overlap with Many Pairs

When there are 50+ bubbles, the spiral algorithm may struggle to find non-overlapping positions. The fallback behavior is to place the bubble at the last spiral position, which may overlap. For a PhD research tool with 20-50 thinkers and 10-30 terms, the typical bubble count is 30-80, which the algorithm handles well within the 800x600 viewBox.

If Stephanie's dataset grows very large, consider:
- Adding a `min_frequency` filter to exclude very rare co-occurrences
- Expanding the SVG viewBox dynamically based on bubble count
- Using a proper force-directed layout (e.g., d3-force) as a future enhancement

### Single vs. Multiple Occurrences in Same Note

The frequency counts distinct notes, not individual occurrences. If "habit" appears 10 times in a single note that also mentions "James," the (habit, James) frequency is 1. This is intentional: the constellation measures *how widely* a term-thinker association appears across Stephanie's research corpus, not how densely it appears in a single document.

### Inactive Terms

The query filters on `CriticalTerm.is_active == True`. If Stephanie deactivates a term, it disappears from the constellation. This prevents clutter from terms she's no longer tracking.

### No External Libraries

The bubble chart uses pure SVG rendered in React. No d3, recharts, or other charting library is needed. This keeps the bundle size minimal and avoids dependency conflicts. The spiral packing algorithm is ~50 lines of code and produces visually appealing results for the expected data scale.

---

## Execution Checklist

- [ ] Extend `backend/app/schemas/analysis.py` with `TermThinkerBubble` and `TermThinkerMatrixResponse`
- [ ] Create `backend/app/routes/analysis.py` with `get_term_thinker_matrix` endpoint
- [ ] Modify `backend/app/main.py`: add `analysis` to imports and `app.include_router(analysis.router)`
- [ ] Modify `backend/app/schemas/__init__.py`: import and export analysis schemas
- [ ] Add `TermThinkerBubble` and `TermThinkerMatrix` interfaces to `frontend/src/types/index.ts`
- [ ] Add `analysisApi.getTermThinkerMatrix` to `frontend/src/lib/api.ts`
- [ ] Create `frontend/src/components/notes/ConstellationChart.tsx` with SVG bubble chart
- [ ] Create `frontend/src/components/notes/ConstellationTooltip.tsx` with hover tooltip
- [ ] Modify `frontend/src/app/notes/page.tsx`: add "Constellation" tab to right panel
- [ ] Test: API returns correct co-occurrence data with and without filters
- [ ] Test: Chart renders bubbles with correct relative sizes
- [ ] Test: Tooltip shows correct data on hover
- [ ] Test: Color toggle, zoom, pan, and bubble click all work
- [ ] Test: Empty state, loading state, and error state render correctly
- [ ] Run `npm run type-check` to confirm no TypeScript errors
- [ ] Run existing backend tests to confirm no regressions: `cd backend && pytest`
