# Design Spec — Range-aware timeline items + timeline.js-style tethers

Date: 2026-06-08
Status: Approved (brainstorming) — ready for implementation plan
Area: `frontend/src/components/Timeline.tsx` (primary), `backend` event schema + migration

## 1. Summary

Overhaul the main timeline canvas so that **thinkers and events can span a time
range** and are drawn as **horizontal bars** the width of that range, while
single-date items keep their current point markers. Replace the current dashed
leader line with a **timeline.js-style vertical tether ending in a dot at the
axis**, so every item has a clear, direct visual connection to its date(s).

This is a **forward-additive migration**: every existing event remains a
point-in-time item. Ranges are opt-in going forward.

The look follows the **vis-timeline / gantt** idiom (range bars with the label
inside) combined with the **Knight Lab TimelineJS** tether aesthetic (vertical
dropline + dot at the axis). It uses the project design system (Crimson Text,
Inter, JetBrains Mono; background `#FAFAF8`, accent `#8B4513`, primary `#1A1A1A`).

## 2. Goals / Non-goals

### Goals
- Events gain an optional end year; thinkers already have birth/death.
- Items with a real range render as rounded bars spanning their years.
- Single-date items render as today's default markers (no visual regression).
- All items connect to the time axis with a clean vertical tether + dot.
- Reuse the existing collision/stacking engine; no second render mode.

### Non-goals (explicitly deferred)
- Claude "summarize whole text / parse into timeline" feature (separate spec).
- Full axis overhaul: two-tier year ticks, vertical gridlines, era background bands.
- Strict per-item/per-field swimlanes.
- Any change that alters existing event data (forward-only migration).

## 3. Definitions

- **Item**: a thinker or a timeline event drawn on the canvas.
- **start year**:
  - Thinker: `birth_year`.
  - Event: `year`.
- **end year**:
  - Thinker: `death_year`.
  - Event: new nullable `end_year`.
- **Range item**: has a start year AND an end year with `end > start`.
- **Point item**: anything else (only one usable year, or end == start).

## 4. Data model

### Backend
- New column `timeline_events.end_year` — `Integer`, `nullable=True`.
- Alembic migration adds the column. **No backfill** (all existing rows stay `NULL` = point).
- Pydantic:
  - `TimelineEventBase`: add `end_year: Optional[int] = None`.
  - `TimelineEventUpdate`: add `end_year: Optional[int] = None`.
  - Response schema inherits from Base (already returns all fields).
  - Validator: when `end_year is not None`, require `end_year >= year`
    (cross-field validator on the Base/Create model; on Update, validate only
    when both `year` and `end_year` are present in the payload).

### Frontend types (`frontend/src/types/index.ts`)
- `TimelineEvent`, `TimelineEventCreate`, `TimelineEventUpdate`: add
  `end_year?: number | null`.

### Migration safety
- Railway runs `start.sh` with a pre-migration backup; the new migration is a
  pure additive `ADD COLUMN ... NULL`, reversible via a `downgrade` that drops
  the column. Must be tested `upgrade` then `downgrade` locally.

## 5. Rendering model

A single pure classifier is introduced (unit-testable, no canvas dependency):

```
classifyItem({ startYear, endYear }) -> { kind: 'range' | 'point', startYear, endYear? }
```

And a pure label-fit helper that decides label placement given a bar pixel width:

```
resolveBarLabel(ctx, name, barWidthPx) -> { placement: 'inside' | 'beside', text }
```

These are extracted so they can be tested without a DOM/canvas.

### Range items → bars
- Geometry: `x0 = yearToX(start)`, `x1 = yearToX(end)`; `barWidth = max(MIN_BAR_WIDTH, x1 - x0)`.
- `MIN_BAR_WIDTH ≈ 12px` so a tiny span stays visible and clickable.
- Shape: filled rounded rectangle, `borderRadius ≈ 2px`, `border 1px`.
- Color:
  - Thinker bar: white fill, `#8B4513` (accent) 1px border; label in `#1A1A1A`, Crimson Text 14px.
  - Event bar: brown-family fill keyed to `event_type` (reuse existing event color `#8B4513` / `#6B3410`); label JetBrains Mono 10px.
- Label: **inside** the bar when `barWidth > textWidth + padding`; otherwise drawn **beside** the bar (to the right). Full title; ellipsis only when an inside-label cannot fit (consistent with the truncation-removal already shipped).

### Point items → markers (unchanged defaults)
- Thinker: existing white name-box.
- Event: existing per-type shape (triangle/rect/diamond/star/circle).
- "Singular point ⇒ default size."

## 6. Tether (timeline.js style)

Replaces the current dashed `#D8D2C8` leader in `drawThinkers` and adds tethers
to events.

- **Style**: strictly **vertical**, **1px solid**, low-contrast neutral
  (design-system neutral, e.g. `#C9C2B6`), ending in a **3–4px filled dot** at
  the axis intersection (accent `#8B4513`). Vertical only — never diagonal.
- **Point item**: one tether from the marker's axis-facing edge to `axisY`,
  dot at the item's year x.
- **Range item**: thin vertical droplines at **both** `yearToX(start)` and
  `yearToX(end)` down to `axisY`, each capped with a dot — the span is
  explicitly tethered to both dates.
- **State**: dashed line + slightly stronger color reserved for hover/selected.

## 7. Stacking & interaction (reuse existing engine)

- The collision/stacking spiral in `calculateThinkerPositions` /
  `calculateEventPositions` is retained.
- Change: a range item's bounding-box **width** becomes its **bar pixel width**
  (`yearToX(end) − yearToX(start)`, floored at `MIN_BAR_WIDTH`), not its text
  width — so overlapping spans push onto separate rows correctly.
- Hit-testing (click + drag selection) uses the **bar rect** for ranges.
- **Horizontal position** of a range bar is **data-driven** (fixed to its
  years); horizontal drag does not apply to ranges. **Vertical** drag still
  adjusts the row / `position_y`. Point items keep current anchor-year drag
  behavior. (Reconcile with the recently shipped "lock thinker drag to the
  timeline" behavior — for ranges, horizontal is already locked by definition.)

## 8. Forms & detail panels

- `AddTimelineEventModal`: add an optional **"End year"** numeric input
  (placeholder/help: "leave blank for a single date"). Client + server validate
  `end_year >= year`.
- Event detail / edit view: surface the range (e.g. "1545–1563").
- Thinker forms already capture birth/death — no change.

## 9. Design-system adherence

- Fonts: Crimson Text (thinker labels), JetBrains Mono (event labels), Inter (UI).
- Colors: background `#FAFAF8`, accent/crimson `#8B4513`, primary `#1A1A1A`,
  neutral tether `#C9C2B6` (or nearest existing neutral token).
- Bars and tethers must read as calm/minimal, matching the existing aesthetic.

## 10. Testing strategy

### Backend
- Create event with `end_year` → persisted and returned.
- Update event to set/clear `end_year`.
- Validator rejects `end_year < year`.
- Migration `upgrade`/`downgrade` round-trip.

### Frontend
- Unit-test `classifyItem` (range vs point boundaries: missing end, end==start, end>start, end<start).
- Unit-test `resolveBarLabel` (inside vs beside thresholds).
- Extend `Timeline.test.tsx`: range renders a bar; point renders a marker;
  tether + dot present; bar-aware stacking pushes overlapping ranges to rows.

## 11. Affected files (anticipated)

- `backend/app/models/timeline_event.py` — add column.
- `backend/app/schemas/timeline_event.py` — add field + validator.
- `backend/alembic/versions/*` — new migration.
- `backend/tests/` — event range tests.
- `frontend/src/types/index.ts` — add `end_year`.
- `frontend/src/components/Timeline.tsx` — classifier, bar/point draw, tether, stacking width, hit-testing.
- `frontend/src/components/AddTimelineEventModal.tsx` — End year input.
- `frontend/src/components/__tests__/Timeline.test.tsx` — render/stacking tests.
- (Possibly) a small `frontend/src/lib/timelineItems.ts` for the pure helpers.

## 12. Open risks / notes

- **Drag semantics for ranges**: horizontal drag is disabled for range bars
  (position is data-driven). Confirm this is acceptable UX during implementation;
  vertical reposition remains.
- **Very long spans** (e.g. a thinker active 80+ years) will produce wide bars
  that may visually dominate at high zoom-out; acceptable for now.
- **Many overlapping ranges** will increase vertical stacking height — same
  trade-off accepted for the event-label stacking change already shipped.
