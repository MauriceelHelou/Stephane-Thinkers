# Design Spec — Range-aware timeline items + timeline.js-style tethers

Date: 2026-06-08
Status: Approved (brainstorming) — ready for implementation plan
Area: `frontend/src/components/Timeline.tsx` and `frontend/src/components/CombinedTimelineCanvas.tsx` (shared helpers), `backend` event schema + migration

## 1. Summary

Overhaul the main timeline canvas so that **thinkers and events can span a time
range** and are drawn as **horizontal bars** the width of that range, while
single-date items keep their current point markers. Replace the current dashed
leader line with a **timeline.js-style vertical tether ending in a dot at the
axis**, so every item has a clear, direct visual connection to its date(s).

This is a **forward-additive data migration** (no event row is rewritten), but
note the explicit rendering-behavior change in §2 below: every dated thinker now
renders as a bar rather than a point marker. Thinkers are already
horizontally locked to their years (manual drag moves them up/down only), so a
bar never fights a user-pinned x — manual position is purely the row (y).

The look follows the **vis-timeline / gantt** idiom (range bars with the label
inside) combined with the **Knight Lab TimelineJS** tether aesthetic (vertical
dropline + dot at the axis). It uses the project design system (Crimson Text,
Inter, JetBrains Mono; background `#FAFAF8`, accent `#8B4513`, primary `#1A1A1A`).

## 2. Goals / Non-goals

### Goals
- Events gain an optional end year; thinkers already have birth/death.
- Items with a real range render as rounded bars spanning their years.
- Single-date items and manually-positioned items render as today's markers.
- All items connect to the time axis with a clean vertical tether + dot.
- Reuse the existing collision/stacking engine; no second render mode.
- The bar/tether helpers are shared by `Timeline.tsx` and
  `CombinedTimelineCanvas.tsx` so the two canvases stay visually identical.

### Explicit rendering-behavior change (intended)
- A thinker with a `birth_year` renders as a **bar**:
  - **Dead** (`death_year` set): bar spans `birth_year → death_year`.
  - **Living** (`death_year` null): bar spans `birth_year → current year`, drawn
    with an **open-ended (ongoing) cap** so "still alive" reads differently from
    "died this year" (see §5/§6).
- Manual positioning of a thinker is **Y-only** (it sets the row / `position_y`);
  it never changes the bar's x, which is always data-driven from the years.
  `is_manually_positioned` therefore does **not** affect classification — it only
  preserves the chosen row. Existing manual layouts keep their vertical position.
- A thinker with no `birth_year` (only `death_year`, or no years) stays a
  **point** at its existing position (`anchor_year` / `position_x` fallback).
- Existing events are unchanged (all `end_year` are `NULL` = point) until a user
  opts in by setting an end year. Event ranges are opt-in going forward.

### Non-goals (explicitly deferred)
- Claude "summarize whole text / parse into timeline" feature (separate spec).
- Full axis overhaul: two-tier year ticks, vertical gridlines, era background bands.
- Strict per-item/per-field swimlanes.
- Any change that alters existing event row data (forward-only data migration).
- Horizontal drag of bars (bars are data-driven; see §7).

## 3. Definitions

- **Item**: a thinker or a timeline event drawn on the canvas.
- **start year**:
  - Thinker: `birth_year`.
  - Event: `year`.
- **end year**:
  - Thinker: `death_year` if set, else `current year` (living thinker).
  - Event: new nullable `end_year`.
- **Range item**: has a start year AND an end year with `end > start`.
  - Thinker: any thinker with a `birth_year` (dead → birth→death; living →
    birth→today). Manual positioning does not change this (it is Y-only).
  - Event: `end_year` set and `end_year > year`.
- **Point item**: anything else — an event with no/equal `end_year`, or a
  thinker with no `birth_year`.

Classification is **data-only and zoom-independent** (no pixel-span or
manual-position gating), so an item never flips between bar and point as the
user zooms or drags. Tiny spans are kept readable by the `MIN_BAR_WIDTH` floor
(§5), not by reclassification.

## 4. Data model

### Backend
- New column `timeline_events.end_year` — `Integer`, `nullable=True`.
- Alembic migration adds the column. **No backfill** (all existing rows stay
  `NULL` = point).
- Pydantic (`backend/app/schemas/timeline_event.py`):
  - `TimelineEventBase`: add `end_year: Optional[int] = None`.
  - `TimelineEventUpdate`: add `end_year: Optional[int] = None`.
  - Response schema (`TimelineEvent`) inherits from Base — already returns it.
  - **Bounds**: `end_year`, like `year`, is constrained to `[-10000, 10000]`
    (matches the frontend zod bound) via a field constraint/validator.
  - **Cross-field rule (Create/Base)**: use `@model_validator(mode="after")`:
    when `end_year is not None`, require `end_year >= year`. (A `field_validator`
    on `end_year` is order-fragile; a model validator is unambiguous.)
  - **Cross-field rule (Update / partial PATCH)**: the validator alone is
    insufficient because a PATCH may carry only `end_year` while the persisted
    `year` stays e.g. `1600`. The **route handler** for update must load the
    existing event and validate the *effective* pair
    (`year = payload.year ?? existing.year`,
    `end_year = payload.end_year ?? existing.end_year`), rejecting
    `end_year < year` with HTTP 422. This closes the partial-update hole.

### Frontend types (`frontend/src/types/index.ts`)
- `TimelineEvent`, `TimelineEventCreate`, `TimelineEventUpdate`: add
  `end_year?: number | null` (already present — verify all three).

### Migration safety
- Railway runs `start.sh` with a pre-migration backup; the new migration is a
  pure additive `ADD COLUMN ... NULL`, reversible via a `downgrade` that drops
  the column. Must be tested `upgrade` then `downgrade` locally.
- **Destructive downgrade warning**: `downgrade` drops the column and therefore
  permanently discards any user-entered `end_year` values. This is acceptable
  for a rollback but must be called out in the migration docstring.

## 5. Rendering model

Two pure helpers are introduced in `frontend/src/lib/timelineItems.ts`,
unit-testable with **no DOM/canvas dependency**:

```
classifyItem({ startYear, endYear })
  -> { kind: 'range' | 'point', startYear, endYear? }
```

Callers resolve `endYear` before calling: for a living thinker the caller passes
`endYear = currentYear` (injected, not read from the clock inside the helper, so
tests are deterministic). The helper is pure — `kind = 'range'` iff both years
are present and `endYear > startYear`. No canvas, zoom, or position input.

```
resolveBarLabel({ measureText, name, barWidthPx, padding })
  -> { placement: 'inside' | 'beside', text, labelWidthPx }
```

`measureText: (text: string) => number` is **injected** (the caller passes a
closure over the live `ctx.measureText`), keeping the helper canvas-free and
testable with a stub. It returns `labelWidthPx` so the stacking engine can
reserve the right width (see §7).

### Range items → bars
- Geometry: `x0 = yearToX(start)`, `x1 = yearToX(end)`;
  `barWidth = max(MIN_BAR_WIDTH, x1 - x0)`.
- `MIN_BAR_WIDTH ≈ 12px` so a tiny span stays visible and clickable even at full
  zoom-out (no reclassification to a point — see §3).
- Shape: filled rounded rectangle drawn with `ctx.roundRect` (supported in all
  target browsers), `borderRadius ≈ 2px`, `border 1px`.
- **Living thinker (ongoing) cap**: when `end == currentYear` because the thinker
  has no `death_year`, the bar's right end is drawn open-ended — a soft fade /
  no hard right edge (and no right-end tether dot, §6) — to signal "ongoing"
  rather than "died this year." Dead thinkers and bounded event ranges keep a
  closed right edge with a right-end dot.
- Color:
  - Thinker bar (default): white fill, `#8B4513` (accent) 1px border; inside
    label `#1A1A1A`, Crimson Text 14px.
  - Thinker bar (selected): `#8B4513` fill, `#6B3410` 2px border, inside label
    **`#FFFFFF`** (contrast on brown).
  - Thinker bar (bulk-selected): `#E0F2FE` fill, `#0284C7` 2px border, label
    `#1A1A1A` (mirrors the existing point name-box states).
  - Event bar: filled per the **event-type color map** below, `#6B3410` 1px
    border; label JetBrains Mono 10px, `#333333` (or `#FFFFFF` if the fill is
    dark). Because bars lose the per-type *shape* encoding, type is carried by
    fill **and** a 1-character type glyph at the bar's left edge
    (e.g. `△ ▭ ◆ ★ ●` mapped from the existing shapes) so `war` vs `council`
    stay distinguishable as bars.
- Event-type color map (fills; all within the brown family, ordered light→dark
  to stay calm):
  - `council` `#A8662F` · `publication` `#8B4513` · `war` `#6B3410` ·
    `invention` `#9C5A28` · `cultural` `#B07A3D` · `political` `#7A4012` ·
    `other` `#8B5A2B`.
  - These are tunable during implementation; the requirement is 7 distinct,
    design-system-consistent fills, not these exact hexes.
- Label placement:
  - **inside** the bar when `barWidth >= labelWidthPx + 2*padding`;
  - otherwise **beside** the bar (to the right), full title. The stacking engine
    reserves `barWidth + labelWidthPx + gap` for beside-labels (§7) so a beside
    label never overlaps a neighbor.
  - **Truncation** only occurs when even the beside placement would run past the
    canvas right edge; in that single case the beside text is ellipsized. There
    is no inside-bar ellipsis (consistent with the truncation-removal shipped
    for point events).

### Point items → markers (unchanged defaults)
- Thinker: existing white name-box — only for thinkers with **no `birth_year`**
  (positioned via `anchor_year` / `position_x`). All thinkers with a birth year
  are bars (§3), regardless of manual row position.
- Event: existing per-type shape (triangle/rect/diamond/star/circle).
- "Singular point ⇒ default size."

## 6. Tether (timeline.js style)

Replaces the current dashed `#D8D2C8` leader in `drawThinkers` and adds tethers
to events (which currently have none).

- **Style**: strictly **vertical**, **1px solid**, low-contrast neutral
  (design-system neutral, e.g. `#C9C2B6`), ending in a **3–4px filled dot** at
  the axis intersection (accent `#8B4513`). Vertical only — never diagonal.
- **Point item**: one tether from the marker's axis-facing edge to `axisY`,
  dot at the item's x.
- **Range item**: thin vertical droplines down to `axisY` at the bar's **left
  and right edges** (i.e. anchored to the drawn bar, including the MIN_BAR_WIDTH
  floor — not the raw `yearToX` values — so dot and bar edge always coincide),
  each capped with a dot.
- **Living thinker (ongoing)**: draw only the **left** (birth) dropline + dot.
  The right end is open-ended (§5), so it gets no right dropline or dot — the bar
  visibly trails off toward "now" instead of asserting a death date.
- **Dot de-duplication / density**: dots are rendered after all items are
  placed, deduplicated to one dot per integer x (rounded), so coincident
  start/end dates and same-year items don't pile multiple dots into a blob.
  Beyond a density threshold (many items in view) or at far zoom-out, tethers
  fade to a lighter neutral and full tethers are drawn only for the hovered /
  selected item; this keeps the §9 "calm/minimal" goal at high item counts.
- **Honesty note**: a tether asserts a date. For point thinkers with no
  `birth_year` (positioned via `anchor_year` / `position_x`, which may not equal
  a real year) the dot is drawn at the marker x as today, with no implied date
  precision — unchanged from current behavior.
- **State**: dashed line + slightly stronger color reserved for hover/selected.

## 7. Stacking & interaction (reuse existing engine)

- The collision/stacking spiral in `calculateThinkerPositions` /
  `calculateEventPositions` is retained.
- **Bounding-box width for a range item** is the full drawn footprint:
  `barWidth` when the label is inside, or `barWidth + gap + labelWidthPx` when
  the label is beside (from `resolveBarLabel`). It is **never** just `barWidth`
  when a beside-label exists — otherwise beside-labels overlap neighbors (the
  exact bug the event full-text-width stacking fix already solved). This
  reconciles §5 and §7.
- **Events as obstacles to thinkers**: the obstacle pushed into
  `calculateThinkerPositions` must use each event's **actual footprint width**
  (bar width or measured point bbox), not the hardcoded `EVENT_BBOX_WIDTH`, so
  thinkers correctly avoid wide ranged-event bars.
- **Layout cache key**: the memoized position cache key (currently
  `…${e.id}:${e.year}…` for events and `birth_year:death_year:anchor_year:…`
  for thinkers) **must include `end_year`** for events (and is already covered
  for thinkers via `death_year`). Without this, editing an end year does not
  invalidate the layout and the canvas goes stale. Also include the current
  `scale` already present.
- Hit-testing (click + drag selection) uses the **bar rect** for ranges; the
  event hit-test (currently a fixed `±size*2` box) and the thinker hit-test must
  both branch on range vs point.
- **Horizontal position** of a range bar is **data-driven** (fixed to its
  years); horizontal drag does not apply to ranges.
- **Vertical drag**:
  - Thinker bars: vertical drag still adjusts the row / `position_y` (same as
    point thinkers; only the x is locked).
  - Event bars: events have **no persisted position** and are not draggable
    today; they remain auto-stacked and non-draggable. The spec does **not**
    introduce event dragging. (Earlier drafts implied event `position_y` — there
    is no such field; do not add one here.)
- Point items keep current behavior: thinkers keep anchor-year drag; events
  remain click-only.

## 8. Forms & detail panels

- `AddTimelineEventModal`: add an optional **"End year"** numeric input
  (placeholder/help: "leave blank for a single date"). Bounds `[-10000, 10000]`
  matching `year`. Client validates `end_year >= year`; server validates the
  effective pair on both create and update (§4).
- Event detail / edit view: surface the range (e.g. "1545–1563"); show a single
  year when `end_year` is null.
- Thinker forms already capture birth/death — no change.

## 9. Design-system adherence

- Fonts: Crimson Text (thinker labels), JetBrains Mono (event labels), Inter (UI).
- Colors: background `#FAFAF8`, accent/crimson `#8B4513`, primary `#1A1A1A`,
  neutral tether `#C9C2B6` (or nearest existing neutral token), event-type fills
  per §5.
- Bars and tethers must read as calm/minimal, matching the existing aesthetic;
  the density/fade rules in §6 are what keep this true at high item counts.

## 10. Testing strategy

### Backend
- Create event with `end_year` → persisted and returned.
- Update event to set/clear `end_year`.
- Validator rejects `end_year < year` on create.
- **Partial-update hole**: PATCH only `end_year` below the persisted `year` →
  rejected 422 (the route-level effective-pair check).
- `end_year` out of `[-10000, 10000]` → rejected.
- Migration `upgrade`/`downgrade` round-trip.

### Frontend
- Unit-test `classifyItem`: missing end, `end==start`, `end>start`, `end<start`
  boundaries (data-only; no manual/zoom inputs to test).
- Unit-test the caller's end-year resolution: dead thinker → `death_year`;
  living thinker → injected `currentYear`; no `birth_year` → point.
- Unit-test `resolveBarLabel` with a stub `measureText`: inside vs beside
  thresholds and returned `labelWidthPx`.
- Extend `Timeline.test.tsx`: dead thinker renders a closed bar; living thinker
  renders an open-ended bar (left dot only, no right dot); event point renders a
  marker; a manually-positioned thinker keeps its row (y) but still renders as a
  bar (x data-driven); tether + dot present; dot de-duplication collapses
  coincident dates; bar-aware stacking pushes overlapping ranges (including
  beside-labelled ones) to separate rows; editing `end_year` invalidates the
  layout cache (no stale positions).
- Apply the same render assertions to `CombinedTimelineCanvas` via the shared
  helper so the two canvases don't diverge.

## 11. Affected files (anticipated)

- `backend/app/models/timeline_event.py` — add column.
- `backend/app/schemas/timeline_event.py` — add field + bounds + model validator.
- `backend/app/routes/…` (timeline events update route) — effective-pair check.
- `backend/alembic/versions/*` — new migration (with destructive-downgrade note).
- `backend/tests/` — event range + partial-update tests.
- `frontend/src/types/index.ts` — verify `end_year` on all three event types.
- `frontend/src/lib/timelineItems.ts` — `classifyItem`, `resolveBarLabel`, the
  event-type color/glyph map (pure, shared, DOM-free).
- `frontend/src/components/Timeline.tsx` — bar/point draw, tether + dot dedup,
  stacking width (incl. beside-labels), event-obstacle width, **cache key
  `end_year`**, range-aware hit-testing.
- `frontend/src/components/CombinedTimelineCanvas.tsx` — adopt the same shared
  helpers so bars/tethers match the main canvas.
- `frontend/src/components/AddTimelineEventModal.tsx` — End year input + bounds.
- `frontend/src/components/__tests__/Timeline.test.tsx` — render/stacking/cache tests.

## 12. Open risks / notes

- **Sweeping visual change for thinkers**: every thinker with a `birth_year`
  becomes a bar on deploy (manual layouts keep their row but switch point→bar).
  This is intended, but it is the largest user-visible change — confirm with
  stakeholders before merge and consider a one-line release note.
- **Living thinkers depend on `currentYear`**: a living thinker's bar grows by
  one pixel-band per year as time passes; the right end is open (no death date
  asserted). Inject `currentYear` rather than reading the clock in pure helpers
  so layout/tests stay deterministic.
- **Drag semantics**: thinkers are already horizontally locked to their years
  (drag is Y-only), so range bars introduce no new horizontal-drag conflict —
  vertical row reposition still works for both bars and point thinkers. Events
  remain non-draggable.
- **Very long spans** (a thinker active 80+ years) produce wide bars that may
  dominate at high zoom-out; acceptable for now (label stays inside; tether dots
  mark both ends).
- **Many overlapping ranges** increase vertical stacking height — same
  trade-off accepted for the event-label stacking change already shipped; the
  §6 density/fade rules mitigate tether clutter.
