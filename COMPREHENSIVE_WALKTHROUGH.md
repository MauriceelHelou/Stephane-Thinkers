# Intellectual Genealogy Mapper - Comprehensive Walkthrough

> **Last Updated:** November 29, 2025
> **Purpose:** Complete reference for developers, users, and future coding sessions

## Purpose of This Document
1. **User Documentation** - End-user guide for all use cases
2. **Developer Onboarding** - Technical architecture understanding
3. **Gap Analysis** - Missing features identification
4. **Bug Documentation** - Known issues catalog with exact file locations and line numbers

## Design Decisions (Confirmed by User)
- **"All Thinkers" view**: Shows ALL thinkers regardless of timeline assignment
- **Living thinker positioning**: Halfway between birth year and current year (with manual override option in form)
- **Timeline fullscreen**: Timeline should ALWAYS fill the screen - cannot zoom out beyond the extent
- **Master timeline expansion**: When creating a timeline with dates outside the master range, "All Thinkers" should expand to include those dates

---

# PART 1: USER GUIDE

## Overview
The Intellectual Genealogy Mapper is a timeline-based knowledge graph for academic research. It visualizes relationships between thinkers across time, showing how ideas influenced, critiqued, built upon, or synthesized other ideas.

## Getting Started

### Starting the Application
```bash
# Backend (terminal 1, from backend/ directory)
venv\Scripts\activate       # Windows
source venv/bin/activate    # Unix
uvicorn app.main:app --reload --port 8001

# Frontend (terminal 2, from frontend/ directory)
npm run dev                  # Runs on port 3001
```

Access the app at: http://localhost:3001

---

## Core Concepts

### 1. Thinkers
People whose ideas you want to track (philosophers, scientists, authors, etc.)

**Properties:**
- Name (required)
- Birth Year / Death Year
- Active Period (text, e.g., "1950s-1980s")
- Field/Discipline
- Biography Notes
- Position (auto by years or manual)
- Timeline assignment (optional)

### 2. Connections
Intellectual relationships between thinkers

**4 Connection Types:**
| Type | Meaning |
|------|---------|
| `influenced` | Source shaped target's thinking |
| `critiqued` | Source challenged target's ideas |
| `built_upon` | Source extended target's work |
| `synthesized` | Source combined target's concepts with others |

**Connection Properties:**
- Name (optional label shown on canvas)
- Notes (detailed explanation)
- Bidirectional (mutual influence)
- Strength (1-5, affects line thickness)

### 3. Timelines
Containers for organizing thinkers into groups

**Properties:**
- Name
- Start Year / End Year (defines axis range)
- Description

### 4. Timeline Events
Historical markers on the timeline

**7 Event Types:**
| Symbol | Type |
|--------|------|
| △ | Council |
| ▢ | Publication |
| ◇ | War |
| ★ | Invention |
| ● | Cultural |
| ● | Political |
| ● | Other |

### 5. Publications & Quotes
Research materials attached to individual thinkers

### 6. Tags
Labels for categorizing thinkers (many-to-many)

---

## Views

### "All Thinkers" View
- Default view showing all thinkers
- Dynamic year range based on data
- Best for seeing the complete picture

### Individual Timeline Tabs
- Filtered view of one timeline
- Uses timeline's defined year range
- Shows timeline-specific events

### Combined Timeline Views (Blue Tabs)
- Multiple timelines stacked in lanes
- Each timeline in separate horizontal band
- Useful for comparing movements/schools

---

## User Interactions

### Canvas Controls
| Action | Result |
|--------|--------|
| **Drag** | Pan the view |
| **Scroll wheel / Touchpad pinch** | Zoom in/out |
| **Ctrl/Cmd + Click** | Add new thinker |
| **Click thinker** | Select & show details |
| **Click connection** | Edit connection |

### Toolbar
- **Add Thinker** - Modal form for new thinker
- **Add Connection** - Enter connection mode
- **Add Event** - Add timeline event
- **Export** - (Placeholder for future)

### Connection Mode
1. Click "Add Connection" button
2. Click first thinker (source)
3. Click second thinker (target)
4. Fill in connection details

### Detail Panel (Right Sidebar)
When thinker selected:
- Edit biographical information
- Add/manage publications
- Add/manage quotes
- Delete thinker

---

# PART 2: DEVELOPER ARCHITECTURE

## Tech Stack
- **Frontend**: Next.js 14, React Query, TypeScript, Tailwind CSS
- **Backend**: FastAPI, SQLAlchemy, Pydantic
- **Database**: SQLite (dev) / PostgreSQL (prod)

## Directory Structure
```
backend/
├── app/
│   ├── main.py           # FastAPI app setup, CORS, routes
│   ├── database.py       # SQLAlchemy session factory
│   ├── models/           # ORM models (9 tables)
│   ├── schemas/          # Pydantic validation
│   └── routes/           # API endpoints
└── alembic/              # Database migrations

frontend/
├── src/
│   ├── app/
│   │   └── page.tsx      # Main page (all state management)
│   ├── components/       # React components
│   │   ├── Timeline.tsx              # Main canvas
│   │   ├── CombinedTimelineCanvas.tsx # Multi-timeline view
│   │   ├── AddThinkerModal.tsx
│   │   ├── AddConnectionModal.tsx
│   │   ├── AddTimelineModal.tsx
│   │   ├── AddTimelineEventModal.tsx
│   │   ├── CreateCombinedViewModal.tsx
│   │   └── YearPicker.tsx
│   ├── lib/
│   │   ├── api.ts        # Axios API client
│   │   ├── providers.tsx # React Query provider
│   │   └── constants.ts  # Canvas constants
│   └── types/
│       └── index.ts      # TypeScript interfaces
└── tests/                # Playwright E2E tests
```

## Data Flow
```
User Action → React State → Modal/Form →
React Query Mutation → Axios → FastAPI Route →
SQLAlchemy ORM → Database → Pydantic Response →
Cache Invalidation → Re-render
```

## Database Schema
```
thinkers (1) ←→ (M) publications
thinkers (1) ←→ (M) quotes
thinkers (M) ←→ (M) tags (via thinker_tags)
thinkers (1) ←→ (M) connections (as from/to)
timelines (1) ←→ (M) thinkers
timelines (1) ←→ (M) timeline_events
combined_timeline_views (1) ←→ (M) combined_view_members → timelines
```

## API Endpoints
| Resource | Prefix | Operations |
|----------|--------|------------|
| Thinkers | `/api/thinkers` | CRUD |
| Connections | `/api/connections` | CRUD |
| Publications | `/api/publications` | CRUD (filter by thinker) |
| Quotes | `/api/quotes` | CRUD (filter by thinker) |
| Tags | `/api/tags` | CRUD |
| Timelines | `/api/timelines` | CRUD |
| Timeline Events | `/api/timeline-events` | CRUD (filter by timeline) |
| Combined Views | `/api/combined-views` | Create, List, Get, Delete |

---

# PART 3: KNOWN GAPS & MISSING FEATURES

## Missing Features
1. **Search/Filter** - No way to search thinkers by name, field, or date range
2. **Export** - Button exists but not implemented (SVG/PNG export)
3. **Import** - No bulk data import capability
4. **Collaboration** - Single-user only, no sharing

---

# PART 4: BUG DOCUMENTATION

## CRITICAL BUGS (13 Total)

### BUG #1: Living Thinkers Positioned Incorrectly ⚠️ CRITICAL
- **File:** `frontend/src/components/Timeline.tsx` (lines 42-51)
- **Issue:** `getThinkerYear()` averages birth_year with current year (2025) instead of using birth_year directly
- **Impact:** Living thinkers (no death_year) appear at wrong position (e.g., born 1950 → positioned at ~1987)
- **INTENDED BEHAVIOR:** This is actually CORRECT per user - halfway between birth and now
- **Note:** User can override with manual positioning mode

### BUG #2: Year Range Calculation Uses Wrong Defaults ⚠️ HIGH
- **File:** `frontend/src/components/Timeline.tsx` (lines 54-71)
- **Issue:** `calculateAllThinkersRange()` initializes with DEFAULT_START_YEAR/END_YEAR (1800/2050), then only updates if thinker years are outside that range
- **Impact:** Timeline is always at least 1800-2050 even if all thinkers are 1900-1950
- **Fix:** Initialize with Infinity/-Infinity, only apply defaults when no data

### BUG #3: Zoom Limits Too Extreme / No Minimum Fullscreen ⚠️ CRITICAL
- **File:** `frontend/src/components/Timeline.tsx` (line 608)
- **Issue:** Zoom range 0.01 to 20 allows unusable states. User can zoom OUT beyond the timeline extent, showing empty canvas
- **INTENDED BEHAVIOR:** Timeline should ALWAYS fill the screen at minimum - cannot zoom out beyond fullscreen
- **Fix:** Calculate dynamic minimum scale: `minScale = canvas.width / timelinePixelWidth`
- **Also:** Touchpad pinch zoom IS supported (wheel events fire with ctrlKey), but limits need fixing

### BUG #4: Inconsistent Zoom Multipliers 🔵 LOW
- **File:** `frontend/src/components/Timeline.tsx` (lines 607, 769, 775)
- **Issue:** Wheel uses 10% zoom, buttons use 20%
- **Fix:** Standardize to same multiplier

### BUG #5: Timeline Filtering May Orphan Thinkers ⚠️ HIGH
- **File:** `frontend/src/components/Timeline.tsx` (lines 99-101)
- **Issue:** Thinkers with `timeline_id = null` appear everywhere; thinkers with timeline_id only appear in that timeline
- **Impact:** Confusing behavior - "All Thinkers" shows everything including timeline-specific thinkers

### BUG #6: AddThinkerModal Timeline ID Race Condition ⚠️ MEDIUM
- **File:** `frontend/src/components/AddThinkerModal.tsx` (lines 79-111)
- **Issue:** Two useEffects compete - one resets form on close, other sets timeline_id on open
- **Impact:** Timeline may not pre-select correctly when opening modal from timeline tab

### BUG #7: Query Cache Doesn't Include Timeline Filter ⚠️ HIGH
- **File:** `frontend/src/components/Timeline.tsx` (lines 26-29)
- **Issue:** Query key is just `['thinkers']` without filterByTimelineId
- **Impact:** Switching tabs may show stale/wrong data from cache

### BUG #8: No Backend Timeline Filtering ⚠️ MEDIUM
- **File:** `frontend/src/lib/api.ts` and `backend/app/routes/thinkers.py`
- **Issue:** API always fetches ALL thinkers, filtering happens client-side only
- **Impact:** Inefficient, doesn't scale

### BUG #9: Timeline Year Props Not Explicit 🔵 LOW
- **File:** `frontend/src/app/page.tsx` (lines 289-296)
- **Issue:** Timelines without start_year/end_year fall back to 1800-2050 silently

### BUG #10: AddThinkerModal useEffect Overrides Manual Selection ⚠️ MEDIUM
- **File:** `frontend/src/components/AddThinkerModal.tsx` (lines 104-111)
- **Issue:** If user manually changes timeline dropdown, closing/reopening modal resets to defaultTimelineId
- **Impact:** Users must re-select timeline each time

### BUG #11: Connection Form Type Inconsistency 🔵 LOW
- **File:** `frontend/src/components/AddConnectionModal.tsx` (lines 24-32)
- **Issue:** Form uses empty strings for UUIDs instead of null/undefined
- **Impact:** Works but semantically incorrect

### BUG #12: Missing Search/Filter Feature 🆕 FEATURE GAP
- **Impact:** No way to find thinkers by name, field, or date range

### BUG #13: Master Timeline Doesn't Expand When Creating Timelines ⚠️ HIGH
- **File:** `frontend/src/components/Timeline.tsx` (lines 54-71)
- **Issue:** `calculateAllThinkersRange()` only considers thinker birth/death years, NOT timeline start/end years
- **INTENDED BEHAVIOR:** When creating a timeline with dates outside the current "All Thinkers" range (e.g., adding "Ancient Greece" 500 BCE - 300 BCE), the master "All Thinkers" view should automatically expand to include those dates
- **Fix:** `calculateAllThinkersRange()` should also iterate through all timelines and include their start_year/end_year in the min/max calculation

---

# PART 5: DEEP DIVES

## Connection System (How It Works)

**Data Model:**
```
Connection {
  id: UUID
  from_thinker_id: UUID  → Source of influence
  to_thinker_id: UUID    → Recipient of influence
  connection_type: enum  → influenced|critiqued|built_upon|synthesized
  name: string           → Label shown on canvas curve
  notes: text            → Detailed explanation
  bidirectional: bool    → Mutual influence
  strength: 1-5          → Affects line thickness/opacity
}
```

**Creation Flow:**
1. User clicks "Add Connection" → enters connection mode
2. Banner shows: "Click first thinker (source)"
3. User clicks thinker A → `connectionFrom` set
4. Banner shows: "Click second thinker (influenced by first)"
5. User clicks thinker B → modal opens with both IDs
6. User fills type, strength, notes → submits
7. API creates connection, cache invalidated, canvas re-renders

**Rendering:**
- Bezier curves drawn between thinker positions
- Arrow at end indicates direction
- Line width: 1.8px (weak) to 3.0px (strong)
- Opacity: 0.7 (weak) to 0.9 (strong)
- Connection name floats above midpoint

---

## Timeline Composition (Combined Views)

**Data Model:**
```
CombinedTimelineView {
  id: UUID
  name: string
  description: string
  members: CombinedViewMember[]
}

CombinedViewMember {
  timeline_id: UUID
  display_order: int
  y_offset: int (pixels)
  timeline: Timeline (nested)
}
```

**How It Works:**
1. User clicks "+ Combined View" button
2. Modal shows checkbox list of all timelines
3. User selects 2+ timelines, names the view
4. Backend creates view with members (200px spacing)
5. CombinedTimelineCanvas renders each timeline in a horizontal lane

**Lane Layout:**
- Each timeline: 200px height
- Spacing: 50px between lanes
- Total height = (num_timelines × 250) - 50
- Each lane has its own year axis, thinkers, events

---

## Canvas Interactions (DETAILED)

### Pan (Horizontal Scrolling)
**How it works:**
- Left-click + drag anywhere on canvas triggers panning
- `isPanning` state tracks when user is dragging
- `offsetX` and `offsetY` store the translation offset
- Canvas drawing applies `ctx.translate(offsetX, offsetY)` before rendering

**Current boundary detection (lines 679-704):**
```typescript
// Calculate timeline positions
const timelineStartX = yearToX(startYear, canvas.width, scale)
const timelineEndX = yearToX(endYear, canvas.width, scale)

// Boundary limits
const maxOffsetX = canvas.width * 0.1 - timelineStartX  // 10% padding on left
const minOffsetX = canvas.width * 0.9 - timelineEndX    // 10% padding on right

// If timeline wider than viewport, apply strict boundaries
if (timelineWidth > canvas.width) {
  setOffsetX(prev => Math.min(maxOffsetX, Math.max(minOffsetX, prev + dx)))
} else {
  // If smaller, allow ±20% movement
  setOffsetX(prev => Math.min(canvas.width * 0.2, Math.max(-canvas.width * 0.2, prev + dx)))
}
```

**Intended Behavior:** Timeline should ALWAYS fill the screen - no zooming out beyond the extent

### Zoom (Mouse Wheel & Touchpad)
**How it works:**
- `handleWheel` captures wheel events (line 597-646)
- Touchpad pinch gestures also fire wheel events with `e.ctrlKey` true
- Current prevents browser zoom with `preventZoom` useEffect (lines 109-123)

**Current implementation (lines 607-608):**
```typescript
const delta = e.deltaY > 0 ? 0.9 : 1.1  // 10% zoom per scroll
const newScale = Math.max(0.01, Math.min(20, oldScale * delta))  // Range: 0.01x to 20x
```

**Zoom toward cursor (lines 625-627):**
```typescript
const worldX = (mouseX - offsetX) / oldScale
let newOffsetX = mouseX - worldX * newScale
```
This keeps the point under the mouse cursor fixed while scaling around it.

**Zoom Buttons (lines 768-779):**
```typescript
onClick={() => setScale(prev => Math.min(20, prev * 1.2))}   // +20% zoom
onClick={() => setScale(prev => Math.max(0.01, prev * 0.8))} // -20% zoom
```

**INTENDED BEHAVIOR (NEW REQUIREMENT):**
- Timeline should NEVER zoom out beyond filling the viewport
- Minimum scale should be dynamically calculated so timeline fills screen
- Formula: `minScale = canvas.width / (yearToX(endYear) - yearToX(startYear))`

### Click Detection
**Coordinate conversion (lines 505-514):**
```typescript
const getCanvasCoordinates = (e: React.MouseEvent) => {
  const rect = canvas.getBoundingClientRect()
  const x = e.clientX - rect.left - offsetX  // Account for pan
  const y = e.clientY - rect.top - offsetY
  return { x, y }
}
```

**Thinker hit detection (lines 517-538):**
- Iterates through all visible thinkers
- Calculates position using `yearToX()` with scale
- Uses 16px radius hit zone around center
- Returns first thinker within distance

**Connection hit detection (lines 540-595):**
- Iterates through all visible connections
- Samples 50 points along Bezier curve (t from 0 to 1, step 0.02)
- Uses 10px threshold from curve
- Returns connection if click near any sample point

**Click handlers:**
| Event | Handler | Behavior |
|-------|---------|----------|
| `onMouseDown` | `handleMouseDown` | Check thinker/connection click, start pan |
| `onClick` | `handleClick` | Ctrl/Cmd+Click → add thinker |
| `onDoubleClick` | `handleDoubleClick` | Select thinker |
| `onWheel` | `handleWheel` | Zoom (mouse wheel or touchpad) |

### Positioning Logic

**Year-to-X conversion (lines 73-93):**
```typescript
const yearToX = (year: number, canvasWidth: number, horizontalScale: number = 1): number => {
  // Get year range from timeline or calculate from all thinkers
  const yearSpan = endYear - startYear
  const pixelsPerYear = (canvasWidth * 0.8) / yearSpan  // 80% of width for content
  const baseX = TIMELINE_PADDING + (year - startYear) * pixelsPerYear
  return baseX * horizontalScale  // Apply zoom
}
```

**Constants (from lib/constants.ts):**
- `REFERENCE_CANVAS_WIDTH = 1200`
- `DEFAULT_START_YEAR = 1800`
- `DEFAULT_END_YEAR = 2050`
- `TIMELINE_PADDING = 100` (left/right margin)
- `TIMELINE_CONTENT_WIDTH_PERCENT = 0.8` (80% of canvas for content)

**Thinker year determination (lines 42-51):**
```typescript
const getThinkerYear = (thinker: Thinker): number | null => {
  if (thinker.death_year) return thinker.death_year
  if (thinker.birth_year) {
    const currentYear = new Date().getFullYear()
    return Math.floor((thinker.birth_year + currentYear) / 2)  // Halfway to now
  }
  return null  // Falls back to position_x or canvas center
}
```

**Year range calculation for "All Thinkers" (lines 54-71):**
```typescript
const calculateAllThinkersRange = () => {
  if (thinkers.length === 0) return { startYear: 1800, endYear: 2050 }

  let minYear = 1800, maxYear = 2050  // BUG: Should be Infinity/-Infinity

  thinkers.forEach(t => {
    if (t.birth_year) minYear = Math.min(minYear, t.birth_year)
    if (t.death_year) maxYear = Math.max(maxYear, t.death_year)
  })

  const padding = Math.max(50, Math.floor((maxYear - minYear) * 0.1))
  return {
    startYear: Math.floor((minYear - padding) / 10) * 10,
    endYear: Math.ceil((maxYear + padding) / 10) * 10
  }
}
```

**INTENDED BEHAVIOR (NEW REQUIREMENT):**
When a timeline is created with dates outside the master range, the "All Thinkers" view should EXPAND to include those dates. Currently it only considers thinker birth/death years, NOT timeline start/end years.

---

## Data Model (Complete ERD)

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Timeline   │────<│   Thinker    │>────│ Publication │
│             │     │              │     └─────────────┘
│ id          │     │ id           │
│ name        │     │ name         │     ┌─────────────┐
│ start_year  │     │ birth_year   │>────│   Quote     │
│ end_year    │     │ death_year   │     └─────────────┘
│ description │     │ field        │
└─────────────┘     │ timeline_id  │     ┌─────────────┐
      │             │ position_x/y │>───<│    Tag      │
      │             └──────────────┘     └─────────────┘
      │                    │
      v                    v
┌─────────────┐     ┌──────────────┐
│TimelineEvent│     │  Connection  │
│             │     │              │
│ year        │     │ from_thinker │
│ event_type  │     │ to_thinker   │
│ name        │     │ type         │
│ symbol      │     │ strength     │
└─────────────┘     └──────────────┘

┌─────────────────────┐     ┌─────────────────────┐
│CombinedTimelineView │────<│ CombinedViewMember  │
│                     │     │                     │
│ id                  │     │ timeline_id ────────┼──> Timeline
│ name                │     │ display_order       │
│ description         │     │ y_offset            │
└─────────────────────┘     └─────────────────────┘
```

---

# PART 6: RECOMMENDED FIX PRIORITY

## Priority 1 - Critical (Blocking Usage)
1. **BUG #3** - Zoom limits / no minimum fullscreen
2. **BUG #13** - Master timeline doesn't expand for new timelines
3. **BUG #2** - Year range calculation wrong

## Priority 2 - High (Significant UX Issues)
4. **BUG #7** - Query cache doesn't include timeline
5. **BUG #5** - Timeline filtering semantics confusing
6. **BUG #6** - Timeline ID race condition in modal

## Priority 3 - Medium (Improvements)
7. **BUG #8** - No backend timeline filtering
8. **BUG #10** - useEffect overrides manual selection
9. **BUG #12** - Add search/filter feature

## Priority 4 - Low (Polish)
10. **BUG #4** - Inconsistent zoom multipliers
11. **BUG #9** - Timeline year props not explicit
12. **BUG #11** - Connection form type inconsistency

---

# FILES TO MODIFY (For Bug Fixes)

| File | Changes |
|------|---------|
| `frontend/src/components/Timeline.tsx` | Fix calculateAllThinkersRange(), zoom limits, query key |
| `frontend/src/components/AddThinkerModal.tsx` | Fix useEffect race condition, timeline selection |
| `frontend/src/app/page.tsx` | Clarify timeline filtering semantics |
| `frontend/src/lib/api.ts` | Add timeline filter param to getAll |
| `backend/app/routes/thinkers.py` | Add timeline_id query parameter |

---

# PART 7: COMPLETE USE CASES

## UC-1: Creating a New Timeline
**Goal:** Organize thinkers into a specific time period or theme

**Steps:**
1. Click "+ New Timeline" tab button
2. Fill in modal:
   - **Name** (required): e.g., "French Enlightenment"
   - **Start Year**: e.g., 1650
   - **End Year**: e.g., 1800
   - **Description**: Optional notes
3. Click "Create Timeline"

**Result:** New tab appears, canvas shows the specified year range

**Known Bug:** If start/end years are omitted, defaults to 1800-2050 (BUG #9)

---

## UC-2: Adding a Thinker (Auto-Positioning)
**Goal:** Add a historical figure to the knowledge graph

**Steps:**
1. Click "Add Thinker" button (or Ctrl/Cmd+Click on canvas)
2. Fill in modal:
   - **Name** (required): e.g., "Voltaire"
   - **Birth Year**: 1694
   - **Death Year**: 1778
   - **Active Period**: "1718-1778"
   - **Field**: "Philosophy, Literature"
   - **Timeline**: Select from dropdown or "None"
   - **Positioning Mode**: "Auto" (default)
3. Click "Create Thinker"

**Result:** Thinker appears on canvas positioned by death year (or midpoint if living)

**Known Bugs:**
- Timeline selection may reset on modal reopen (BUG #6, #10)

---

## UC-3: Adding a Thinker (Manual Positioning)
**Goal:** Place a thinker at a specific year on the timeline

**Steps:**
1. Click "Add Thinker" button
2. Fill in name and other details
3. Select "Manual" positioning mode
4. YearPicker appears - click on timeline to select year
5. Click "Create Thinker"

**Result:** Thinker appears at the manually selected year position

---

## UC-4: Creating a Connection Between Thinkers
**Goal:** Map an intellectual relationship

**Steps:**
1. Click "Add Connection" button
2. Banner appears: "1. Click the first thinker (source of influence)"
3. Click on thinker A (e.g., Locke)
4. Banner changes: "2. Click the second thinker (influenced by the first)"
5. Click on thinker B (e.g., Voltaire)
6. Modal opens - fill in:
   - **Connection Type**: influenced / critiqued / built_upon / synthesized
   - **Name**: Optional label (e.g., "Social Contract ideas")
   - **Strength**: 1-5 (affects visual thickness)
   - **Bidirectional**: Check if mutual influence
   - **Notes**: Detailed explanation
7. Click "Create Connection"

**Result:** Curved line with arrow appears between thinkers

**Tip:** Click on an existing connection line to edit it

---

## UC-5: Adding a Timeline Event
**Goal:** Mark a historical event on the timeline

**Steps:**
1. Switch to specific timeline tab (events require a timeline)
2. Click "Add Event" button
3. Fill in modal:
   - **Timeline**: Pre-selected if on timeline tab
   - **Event Name**: e.g., "Publication of Candide"
   - **Year**: 1759
   - **Event Type**: publication / council / war / invention / cultural / political / other
   - **Description**: Optional notes
4. Click "Create Event"

**Result:** Symbol appears on timeline axis at specified year

**Symbols:**
- △ Council
- ▢ Publication
- ◇ War
- ★ Invention
- ● Cultural / Political / Other

---

## UC-6: Viewing & Editing Thinker Details
**Goal:** See full information about a thinker, add publications/quotes

**Steps:**
1. Click on a thinker's name on the canvas
2. Detail Panel slides in from right
3. View biographical info
4. To edit: Click "Edit" button, modify fields, click "Save"
5. To add publication: Expand "Publications" section, fill form, click "Add"
6. To add quote: Expand "Quotes" section, fill form, click "Add"
7. To delete: Click "Delete" button (with confirmation)

**Result:** Changes saved to database, canvas updates

---

## UC-7: Navigating the Canvas (Pan & Zoom)
**Goal:** Explore different areas and time periods

**Pan:**
- Click and drag anywhere on canvas
- Timeline scrolls horizontally

**Zoom:**
- Mouse wheel up/down
- Touchpad pinch gestures
- Or use Zoom In / Zoom Out buttons
- Or use Reset button to return to default view

**Known Bug:** Zoom range too extreme (0.01x to 20x) - can reach unusable states (BUG #3)

---

## UC-8: Switching Between Timelines
**Goal:** View thinkers in a specific timeline context

**Steps:**
1. Click on timeline tab at bottom
2. Canvas updates to show only thinkers assigned to that timeline
3. Year range adjusts to timeline's start/end years

**"All Thinkers" tab:** Shows ALL thinkers across all timelines

**Known Bug:** Query cache doesn't refresh properly when switching tabs (BUG #7)

---

## UC-9: Creating a Combined Timeline View
**Goal:** Compare multiple timelines side-by-side

**Steps:**
1. Click "+ Combined View" button (blue)
2. Fill in modal:
   - **View Name**: e.g., "Enlightenment vs Romanticism"
   - **Description**: Optional
   - **Select Timelines**: Check at least 2 timelines
3. Click "Create Combined View"

**Result:** New blue tab appears, CombinedTimelineCanvas shows each timeline in horizontal lanes (200px each)

---

## UC-10: Deleting a Timeline
**Goal:** Remove a timeline and its associated data

**Steps:**
1. Hover over timeline tab
2. Click "×" button
3. Confirm deletion in dialog

**Warning:** This may orphan thinkers assigned to this timeline (they'll still appear in "All Thinkers")

---

## UC-11: Editing a Connection
**Goal:** Modify connection type, strength, or notes

**Steps:**
1. Click on a connection curve on the canvas
2. Modal opens with existing values
3. Modify fields as needed
4. Click "Update Connection"

**Alternative:** Delete and recreate

---

## UC-12: Quick-Add Thinker from Canvas
**Goal:** Quickly add a thinker at a specific position

**Steps:**
1. Hold Ctrl (Windows) or Cmd (Mac)
2. Click on canvas at desired position
3. Modal opens with position pre-calculated

**Note:** Position is converted to a year based on click location

---

## UC-13: Managing Tags (Future Feature)
**Status:** Backend supports tags, but no UI for managing them yet

**Intended Use:**
- Categorize thinkers by school of thought, nationality, etc.
- Filter/group by tags
- Tags have colors for visual distinction

---

## UC-14: Exporting the Graph (Not Implemented)
**Status:** Export button exists but functionality not implemented

**Intended Features:**
- SVG export for vector graphics
- PNG export for sharing
- JSON export for data backup

---

# PART 8: WORKFLOW EXAMPLES

## Example Workflow: Mapping the French Enlightenment

1. **Create Timeline:**
   - Name: "French Enlightenment"
   - Start: 1700, End: 1800

2. **Add Key Thinkers:**
   - Voltaire (1694-1778, Field: Philosophy)
   - Rousseau (1712-1778, Field: Philosophy)
   - Montesquieu (1689-1755, Field: Political Theory)
   - Diderot (1713-1784, Field: Philosophy)

3. **Add Connections:**
   - Montesquieu → Voltaire (influenced, strength 3)
   - Voltaire → Rousseau (critiqued, strength 4, bidirectional)
   - Diderot → Rousseau (built_upon, strength 2)

4. **Add Events:**
   - 1721: Publication of Persian Letters (Montesquieu)
   - 1734: Publication of Philosophical Letters (Voltaire)
   - 1762: Publication of Social Contract (Rousseau)

5. **Add Publications to Thinkers:**
   - Select Voltaire → Add "Candide" (1759)
   - Select Rousseau → Add "Emile" (1762)

6. **Create Combined View:**
   - Compare with "British Empiricism" timeline

## Example Workflow: Living Philosopher Research

1. **Add Living Thinker:**
   - Name: "Noam Chomsky"
   - Birth Year: 1928
   - Death Year: (leave empty)
   - Positioning: Auto → will position at ~1976 (halfway to 2025)
   - Or use Manual mode to position at specific year

2. **Override Position:**
   - Use manual positioning mode
   - Select year that best represents their peak influence period

---

# SUMMARY

This document provides:
- ✅ Complete user guide with all 14 use cases
- ✅ Developer architecture overview (tech stack, directory structure, data flow)
- ✅ **13 documented bugs** with exact file locations, line numbers, and impacts
- ✅ Deep dives into:
  - Connection system (data model, creation flow, rendering)
  - Timeline composition (combined views, lane layout)
  - Canvas interactions (pan, zoom, click detection, positioning logic) - **WITH CODE SNIPPETS**
  - Data model (complete ERD)
- ✅ Workflow examples for common research scenarios
- ✅ Design decisions confirmed with user:
  - "All Thinkers" shows ALL thinkers
  - Living thinker positioning: halfway between birth and now (with manual override)
  - Timeline should always fill screen (no zoom out beyond extent)
  - Master timeline expands when child timelines have broader date ranges

---

# APPENDIX: BUG PRIORITY MATRIX

| Bug | Severity | Category | User Impact |
|-----|----------|----------|-------------|
| #3 | ⚠️ CRITICAL | Zoom | Can zoom to unusable state, timeline doesn't fill screen |
| #13 | ⚠️ HIGH | Dates | Master timeline doesn't expand for new timelines |
| #1 | ⚠️ HIGH | Positioning | Living thinkers positioned at midpoint (INTENDED per user) |
| #2 | ⚠️ HIGH | Dates | Year range calculation always includes 1800-2050 |
| #5 | ⚠️ HIGH | Filtering | Confusing "All Thinkers" vs timeline assignment |
| #7 | ⚠️ HIGH | Cache | Wrong data when switching tabs |
| #6 | ⚠️ MEDIUM | Modal | Timeline doesn't pre-select in modal |
| #8 | ⚠️ MEDIUM | Performance | No backend timeline filtering |
| #10 | ⚠️ MEDIUM | Modal | useEffect overrides manual timeline selection |
| #4 | 🔵 LOW | UX | Inconsistent zoom multipliers |
| #9 | 🔵 LOW | UX | Silent fallback to default years |
| #11 | 🔵 LOW | Code | UUID type inconsistency |
| #12 | 🆕 FEATURE | Missing | No search/filter capability |
