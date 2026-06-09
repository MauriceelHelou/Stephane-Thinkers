# Implementation Prompt — Combined Timeline Fixes

Paste everything below the line into a fresh Claude Code session at the repo root
(`/Users/mauriceelhelou/Projects/Stephane-Thinkers`). It is self-contained.

---

## Task

Fix a set of UI/UX and correctness bugs in the **Combined Timeline** feature, then
verify every fix in the running app. The combined timeline lets a user overlay
multiple timelines as colored swim lanes on one shared year axis.

Primary files:
- `frontend/src/components/CombinedTimelineCanvas.tsx` (the canvas — main subject)
- `frontend/src/components/Timeline.tsx` (the single-timeline canvas — source of the
  good collision/layout logic to reuse)
- `frontend/src/components/CreateCombinedViewModal.tsx`
- `backend/app/routes/combined_timeline_views.py`
- `frontend/src/app/page.tsx` (wires the canvas in)

**Guiding principle (from the maintainer):** the main timeline's collision logic is
solid. Do not write a third variant — extract the main timeline's layout engine into a
shared module and have BOTH canvases use it. The combined canvas currently contains a
~95% copy-pasted, then diverged, version of that logic.

Use TDD where practical, keep diffs minimal and match existing patterns, and verify
behavior before claiming done.

---

## Bugs to fix (in priority order)

### 1. Same-era thinkers overlap and clicks select the wrong (hidden) thinker — CRITICAL
Three contemporaries in one timeline (e.g. Socrates/Plato/Aristotle) collapse onto
nearly the same X within one 120px lane, so their label boxes overlap. Clicking the
visible box selects whatever box is underneath, because
`getThinkerAtPosition` (`CombinedTimelineCanvas.tsx`) returns the first array match,
not the top-rendered box.

Root cause: `calculateThinkerPositions` in `CombinedTimelineCanvas.tsx` clamps the
vertical collision search to a single 120px lane
(`thinker.baseY ± LANE_HEIGHT/2`, ~lines 478-482). The equivalent routine in
`Timeline.tsx` (~lines 632-635) clamps to the full canvas height, which gives the
stacking algorithm room to separate boxes. A 120px lane fits ~3 label rows, so a tight
cluster cannot be de-overlapped.

Fix:
- Extract `getThinkerYear`, `calculateThinkerPositions`, and `calculateEventPositions`
  from `Timeline.tsx` into a shared module, e.g. `frontend/src/lib/timelineLayout.ts`.
  Parameterize vertical bounds: `({ baseY, verticalMin, verticalMax, laneCenterY? })`.
  Main timeline passes full-canvas bounds; combined passes per-lane bounds.
- Make the combined lane height **adaptive** instead of a fixed 120px: size each lane to
  its busiest cluster, OR allow controlled overflow past the lane with a soft collision
  penalty, so contemporaries actually separate. Lanes must not visually collide with
  neighbors after this.
- Fix hit-testing to return the **top-most rendered** box (iterate in reverse draw
  order, or pick the closest center) so a click always selects what the user sees.
  Apply the same fix to `getConnectionAtPosition` ordering if relevant.

### 2. Duplicated layout code — MAJOR (do this as part of #1)
`calculateThinkerPositions`, `getThinkerYear`, `calculateEventPositions` are duplicated
between the two canvases with the same constants
(`MIN_HORIZONTAL_GAP_BASE`, `HORIZONTAL_COMPRESSION_FACTORS`, ring expansion, collision
penalty). After extraction, both canvases import the one implementation. Confirm no
behavior change in the single timeline (it is the reference).

### 3. No position cache in the combined canvas — MAJOR
`Timeline.tsx` memoizes positions with a `posKey` and skips recompute during drag
(~lines 366-382). The combined canvas runs the full O(n²) collision pass inside the draw
`useEffect` on every `offsetX/offsetY/scale` change, and again per click. Move the cache
into the shared module so both views get it. Verify panning stays smooth.

### 4. Cannot manually de-cluster in combined view — MAJOR
`Timeline.tsx` supports `onThinkerDrag`; the combined canvas always starts a pan on
mousedown (`handleMouseDown`). Add thinker drag-to-reposition to the combined canvas,
consistent with the main timeline (respect `is_manually_positioned` / `position_y` /
`anchor_year`), so users can fix any residual overlap. Keep panning for empty-space drags.

### 5. Vertical pan has no bounds — MODERATE
`handleMouseMove` and the wheel handler do `setOffsetY(prev => prev + dy)` with no clamp,
unlike `clampOffsetX` for horizontal. Content can be scrolled fully off-screen with only
Reset to recover. Add a vertical clamp derived from total lane height + canvas height.

### 6. Edit replaces all members, destroying per-member state — MODERATE
`update_combined_view` in `backend/app/routes/combined_timeline_views.py` deletes and
recreates every `CombinedViewMember` on any edit, regenerating IDs and resetting
`y_offset`. Change it to diff: keep existing members, add new, remove dropped, preserve
order/state. Add/extend a backend test.

### 7. Dead / contradictory paths — MINOR (clean up)
- `handleClick` only allows quick-add when `combinedView.members.length === 1`, but the
  create/edit schema enforces a **minimum of 2** timelines, so that branch is
  unreachable. Either remove it or intentionally allow 1-timeline views (pick one and
  state why).
- `y_offset = index * 200` is written by the backend but the frontend ignores it (uses a
  hardcoded `LANE_HEIGHT`). Remove the dead field or actually use it.
- `animationYear` is accepted and filtered on by the combined canvas but `page.tsx` never
  passes it and there are no animation controls in combined mode. Either wire it up or
  remove the prop.

### 8. Polish — MINOR
- Reserve a gutter for the bottom-lane year labels so they don't sit under thinker boxes
  (the "2000" label currently overlaps a thinker box).
- Render BCE years as `500 BCE` rather than `-500` (shared formatter; the main timeline
  likely needs the same — apply consistently).
- Reset should zoom-to-fit content rather than just `scale=1, offset=0`, given disparate
  eras leave the default view mostly empty.
- (Optional, larger) Consider an opt-in "compress empty gaps" axis mode for views whose
  member timelines span very different eras (e.g. BCE Greek + 20th century), where ~60%
  of the axis is empty. Propose before building.

---

## How to run and seed the app for testing

Backend (creates a fresh SQLite DB; `.env` points DATABASE_URL at
`/tmp/claude/intellectual_graph.db`):

```bash
cd backend
mkdir -p /tmp/claude
./venv/bin/alembic upgrade head
./venv/bin/uvicorn app.main:app --port 8010   # run in background
```

Frontend:

```bash
cd frontend
npm run dev                                    # http://localhost:3010, run in background
```

Auth: login password is the local dev value in `SITE_PASSWORD` (backend `.env`, not committed;
ask the team), with backend `AUTH_REQUIRED=false`. In a browser you can
skip the screen by POSTing `/api/auth/login` and setting `sessionStorage`
`auth_token` + `authenticated=true`, then reloading.

Seed reproduction data (3 timelines across very different eras + a clustered group of
contemporaries — this is what triggers bug #1). All POST routes need trailing slashes;
`timeline_events` `event_type` must be one of
`council, publication, war, invention, cultural, political, other`:

```python
# ./venv/bin/python - <<'PY'  (hit http://localhost:8010)
# Timelines: "Ancient Greek" (-600..-300), "German Idealism" (1700..1900), "20th Century" (1850..2000)
# Thinkers: Socrates(-470,-399), Plato(-428,-348), Aristotle(-384,-322)  [Ancient Greek]
#           Kant(1724,1804), Hegel(1770,1831), Fichte(1762,1814)         [German Idealism]
#           Heidegger(1889,1976), Arendt(1906,1975)                       [20th Century]
# Connections: Socrates->Plato, Plato->Aristotle, Aristotle->Kant, Kant->Hegel(built_upon),
#              Kant->Fichte, Hegel->Heidegger(critiqued), Heidegger->Arendt
# Events: "Academy founded"(-387,cultural)[Greek], "Critique of Pure Reason"(1781,publication)[Idealism],
#         "Being and Time"(1927,publication)[20thC]
# Combined view: "Genealogy of Reason" with all 3 timeline_ids  (POST /api/combined-views/)
PY
```

---

## Verification (must do before claiming done)

Reproduce the original failure first, then prove it is fixed. Use Playwright/Chrome
DevTools MCP to drive the browser.

1. **Wrong-click regression (bug #1):** open the "Genealogy of Reason" combined view.
   Dispatch a click at the *rendered* center of the "Socrates" box and assert the detail
   panel shows **Socrates** (pre-fix it shows Aristotle). Repeat for Kant vs Hegel.
2. **No overlap:** screenshot the combined view; confirm no two thinker boxes overlap and
   no box crosses into a neighboring lane. Confirm the bottom year labels don't sit under
   any box.
3. **Drag (bug #4):** drag a thinker to a new Y and confirm it sticks and that
   empty-space drag still pans.
4. **Vertical pan clamp (bug #5):** pan down/up hard; confirm content stays partially
   visible (cannot be fully lost). Note: a single synthetic mousemove won't trigger
   panning because React's `isPanning` state hasn't flushed — use a real Playwright
   `mouse.move` sequence across multiple steps, or test the clamp function in a unit test.
5. **Perf (bug #3):** with the cache in place, panning should not re-run collision; verify
   via a counter/log or a perf trace that collision isn't recomputed every frame.
6. **Edit preserves members (bug #6):** edit the view (e.g. reorder/keep members), confirm
   member rows are diffed not wiped (check IDs/`y_offset` survive). Add a backend test.
7. **Single timeline regression:** open a normal (non-combined) timeline and confirm its
   layout is byte-for-byte unchanged after the shared-module extraction. Run existing
   tests: `cd frontend && npm run type-check && npx vitest run` (or the project's unit
   runner) and `cd backend && ./venv/bin/pytest`.
8. **Build:** `cd frontend && npm run build` passes.

## Deliverable
- Minimal, reviewable commits grouped by concern (shared-module extraction first, then
  combined-canvas behavior, then backend edit, then polish).
- A short report: files changed, what was verified (with the before/after of the
  wrong-click bug), test output, and any residual risks or items deferred (e.g. the
  optional compress-gaps axis mode).
- Do not commit or push unless asked; if you branch, branch off the current branch.
