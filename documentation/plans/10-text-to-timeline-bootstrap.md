# Plan 10: Text-to-Timeline Bootstrap (Preview, Validate, Commit)

## Goal

Deliver an end-to-end flow that lets a user paste or upload a long source text, generate a structured timeline preview (summary + thinkers + events + connections + related artifacts), validate/edit the output, and commit it into a brand-new timeline that persists across the application.

---

## Status

- **Date:** 2026-02-14
- **Type:** Implementation-ready delivery plan
- **Priority:** High (new timeline creation accelerator)

## Decision Lock (Resolved)

1. **Queue requirement enabled:** Timeline bootstrap preview/commit must run with queue-backed async processing in production-like environments.
2. **V2 commits all entity types:** V1 may phase in core commit paths, but V2 must commit thinkers, events, connections, publications, and quotes.
3. **Pagination enabled:** Candidate review payloads are paginated by entity type to avoid oversized responses.

---

## Why This Plan Exists

Current ingestion persists raw text artifacts but does not produce structured entities or create a timeline from source text. This plan adds a two-step pipeline:

1. **Preview:** AI extraction + synthesis into reviewable candidates (no canonical writes).
2. **Commit:** User-approved candidates are written to canonical tables in one controlled transaction.

This preserves quality and trust while enabling fast timeline bootstrapping.

---

## Dependencies

1. Plans 1-8 merged and stable.
2. Plan 9 Phase F baseline available (`ingestion_jobs`, `source_artifacts`, queue adapter, cost controls, usage meter).
3. Existing CRUD routes and schemas for:
   - `timelines`
   - `thinkers`
   - `timeline_events`
   - `connections`
   - `publications`
   - `quotes`
4. AI gateway remains centralized in `backend/app/utils/ai_service.py`.

## Execution Preconditions

1. `notes_ai_phase_enabled("F")` must be true.
2. `FEATURE_NOTES_AI_TIMELINE_BOOTSTRAP` (backend) and `NEXT_PUBLIC_FEATURE_NOTES_AI_TIMELINE_BOOTSTRAP` (frontend) must be true.
3. Queue mode:
   - Production/staging: `RQ_ENABLED=true` is required.
   - Local dev/test: inline fallback is allowed only for small payloads (strict size cap), otherwise return actionable 503/422.
   - Small payload cap for inline-dev mode: <= 100KB UTF-8 content.

---

## Product Principles (Non-Negotiable)

1. **No blind writes:** AI output never auto-commits to canonical graph without user validation.
2. **Evidence traceability:** Every candidate entity must carry source evidence spans.
3. **Deterministic commit:** The same validated preview should produce the same persisted result.
4. **Graceful failure:** Extraction and commit failures must be recoverable without data corruption.
5. **Cost-bounded execution:** Chunking and quotas must keep requests inside configured token limits.

---

## User Experience Contract

### Step 1: Input

User opens the ingestion panel and provides:

1. Source name (file or manual title).
2. Raw text content.
3. Optional timeline name hint.
4. Optional period hint (start/end years).

### Step 2: Generate Preview (Async)

System creates an extraction job and returns job id.

When complete, user sees:

1. AI summary of the corpus.
2. Candidate timeline metadata (name/period).
3. Candidate thinkers.
4. Candidate timeline events.
5. Candidate connections.
6. Candidate publications and quotes.
7. Confidence and warnings for low-certainty items.

### Step 3: Validate & Edit

User can:

1. Edit timeline title/description/period.
2. Include/exclude candidate rows.
3. Edit key fields for candidates (name, year, type, relationship type).
4. Resolve dependency conflicts flagged by system (for example excluded thinker invalidating linked edges).

### Step 4: Commit

User clicks **Commit to Timeline**.

Backend writes approved candidates to canonical tables and returns:

1. `timeline_id`
2. Created counts by entity type
3. Skipped count + reasons
4. Commit audit metadata

UI navigates user to the newly created timeline and refreshes relevant queries.

---

## Scope

### In Scope

1. New extraction preview flow for long text.
2. User validation and selective commit.
3. Canonical persistence into timeline-centric tables.
4. Queue-backed async processing.
5. Test coverage for extraction, validation, commit, and rollback paths.

### Out of Scope (Initial)

1. Fully automatic cross-entity merge for non-thinker entities (connections/publications/quotes) into pre-existing global records.
2. Multi-source corpus composition in one preview (single source per run in v1).
3. OCR/PDF parsing inside this feature (assumes text already provided).
4. Fully autonomous commit without user confirmation.

---

## Commit Scope by Version

### V1 (Stabilization)

1. Commit required core entities: timeline, thinkers, events, connections.
2. Thinker commit uses canonical reuse flow:
   - attempt match against existing thinkers
   - reuse canonical thinker + metadata when confidence is high
   - create new thinker only when no safe match exists
3. User can override matcher decisions in review (reuse existing vs create new).
4. Publications and quotes are extracted and reviewable; commit remains disabled until V2.

### V2 (Full Commit Target)

1. Commit all supported entities in one validated transaction:
   - timeline
   - thinkers
   - events
   - connections
   - publications
   - quotes
2. V2 completion is required before this feature is considered functionally complete.

### Tag Handling (Deliberate Scope Decision)

1. Tag extraction is out of scope for V1 and V2 commit flows.
2. Extracted field/discipline strings remain on thinker candidates and can be mapped to `tags` in a future phase.
3. Future phase may add `tags[]` candidate review and `thinker_tags` persistence, but this is not a launch blocker for timeline bootstrap.

---

## Architecture Overview

### Pipeline

1. Create bootstrap session + source artifact.
2. Chunk text with overlap under token caps.
3. Run chunk-level extraction prompts.
4. Merge and deduplicate chunk outputs.
5. Generate global summary + review payload.
6. Persist preview payload (draft graph).
7. Accept user edits/approvals.
8. Commit approved graph to canonical tables.
9. Mark session committed and link to `timeline_id`.

### Core Separation

1. **Extraction layer:** AI + parsing + confidence + evidence.
2. **Review layer:** user-facing normalized candidate graph.
3. **Commit layer:** transactional persistence to canonical models.

### Thinker Canonicalization and Reuse

1. Add a dedicated thinker matcher stage before commit.
2. Matcher inputs:
   - normalized name
   - birth/death years
   - field
   - known aliases (if available)
3. Matcher outputs per thinker candidate:
   - `match_status` (`reuse_high_confidence|review_needed|create_new`)
   - `matched_thinker_id` (nullable)
   - `match_score`
   - `match_reasons[]`
4. Default policy:
   - high-confidence match -> reuse existing thinker record and existing metadata by default
   - ambiguous match -> require user decision in review
   - low/no match -> create new thinker
5. User override is authoritative at commit time.
6. Metadata merge policy for reused thinkers:
   - preserve canonical metadata as source of truth by default
   - store extracted deltas as review notes/warnings
   - apply metadata updates only with explicit user approval in review
7. Safety rule:
   - never auto-reuse by name match alone when disambiguating signals are missing
   - ambiguous same-name candidates must be `review_needed`

### Queue, Retry, and Cancel Contract

1. Add explicit job type: `text_to_timeline_preview`.
2. Replace file-type inference retry logic with job-type dispatch map:
   - `transcript -> transcript worker flow`
   - `pdf_highlights -> pdf worker flow`
   - `text_to_timeline_preview -> bootstrap worker flow`
3. Do not overload the existing basic ingestion worker signature (`job_id, file_name, file_type, content`) for bootstrap logic.
4. Introduce dedicated bootstrap worker entrypoint:
   - `process_timeline_bootstrap(job_id: str, payload: dict) -> dict`
5. Route-level enqueue for preview must call bootstrap worker directly.
6. Worker checkpoints for cancellation:
   - before chunk extraction loop
   - every `N` chunks
   - before summary/merge finalize
7. Retry must re-run the same job type with original payload; never coerce to transcript/pdf fallback paths.
8. Job status transitions are strict:
   - `queued -> running -> ready_for_review|ready_for_review_partial|failed`
   - `ready_for_review|ready_for_review_partial -> committing -> committed|ready_for_review|ready_for_review_partial` (on commit failure rollback)

---

## Data Model Changes

Add new tables in `backend/app/models/notes_ai.py` (new migration file):

1. `timeline_bootstrap_sessions`
   - `id`
   - `ingestion_job_id`
   - `source_artifact_id`
   - `status` (`queued|running|ready_for_review|ready_for_review_partial|committing|committed|failed|expired`)
   - `timeline_name_suggested`
   - `summary_markdown`
   - `preview_json` (lightweight graph summary + counts only, not full candidate payloads)
   - `validation_json` (user edits and inclusion flags)
   - `committed_timeline_id` (nullable)
   - `error_message`
   - `expires_at`
   - `created_at`
   - `updated_at` (`onupdate=func.now()` required)
2. `timeline_bootstrap_candidates`
   - `id`
   - `session_id`
   - `entity_type`
   - `candidate_id` (stable hash, indexed)
   - `payload_json` (normalized candidate fields + include/confidence)
   - `dependency_keys_json` (for cross-entity integrity checks)
   - `sort_key`
   - `created_at`
   - `updated_at` (`onupdate=func.now()` required)
3. `timeline_bootstrap_candidate_evidence`
   - `id`
   - `candidate_row_id`
   - `source_artifact_id`
   - `chunk_index`
   - `char_start`
   - `char_end`
   - `excerpt` (truncated for review, fixed max length)
   - `created_at`
4. `timeline_bootstrap_commit_audits`
   - `id`
   - `session_id`
   - `created_counts_json`
   - `skipped_counts_json`
   - `warnings_json`
   - `id_mappings_json` (candidate_id -> canonical UUID)
   - `committed_by` (nullable for current auth model)
   - `created_at`

JSON column strategy:

1. SQLite/dev compatibility: store JSON payload fields as `Text`.
2. Postgres production target: use `JSONB` for:
   - `preview_json`
   - `validation_json`
   - `payload_json`
   - `dependency_keys_json`
   - `created_counts_json`
   - `skipped_counts_json`
   - `warnings_json`
   - `id_mappings_json`
3. If dual-type migration is deferred, implement on `Text` first and schedule `Text -> JSONB` migration before production scale rollout.

Existing table hardening:

1. `ingestion_jobs.job_type` is currently a plain string (enforced by convention).
2. Add DB-level `CheckConstraint` for allowed job types:
   - `transcript`
   - `pdf_highlights`
   - `text_to_timeline_preview`
3. If constraint migration is deferred, route-level validation must reject unknown job types and the plan must treat model enforcement as convention-only until migrated.

### Rationale

1. Keep extraction previews durable and editable.
2. Avoid overloading `ingestion_jobs.result_json` and oversized one-row JSON payloads.
3. Enable paginated review reads without loading full preview payload.
4. Support idempotent commit and auditability.
5. Provide lifecycle cleanup via `expires_at`.

---

## API Contracts

### 1) Start Preview Job

`POST /api/ingestion/text-to-timeline/preview`

Request:

1. `file_name: str`
2. `content: str`
3. `timeline_name_hint?: str`
4. `start_year_hint?: int`
5. `end_year_hint?: int`

Response:

1. `job_id`
2. `session_id`
3. `status`
4. `execution_mode` (`queued|inline_dev`)

### 2) Get Session Metadata and Summary

`GET /api/ingestion/text-to-timeline/sessions/{session_id}`

Response:

1. session metadata
2. summary markdown
3. candidate counts per entity type
4. warnings summary
5. ready/failed/committed state

### 3) Get Session Candidates (Paginated)

`GET /api/ingestion/text-to-timeline/sessions/{session_id}/candidates`

Query:

1. `entity_type` (`thinkers|events|connections|publications|quotes`)
2. `limit` (default 50, max 200)
3. `cursor` (opaque)
4. `include_evidence` (default false)

Response:

1. `items[]` candidate rows
2. `next_cursor`
3. `has_more`
4. `total`

### 4) Save Validation Edits

`PUT /api/ingestion/text-to-timeline/sessions/{session_id}/validation`

Request:

1. timeline edits (`name`, `description`, `start_year`, `end_year`)
2. per-candidate inclusion flags
3. per-candidate field edits
4. thinker match overrides (`reuse existing thinker id` vs `create new`)

Response:

1. updated validation payload
2. validation diagnostics (blocking/non-blocking)

### 5) Commit Validated Session

`POST /api/ingestion/text-to-timeline/sessions/{session_id}/commit`

Request:

1. optional `commit_message`
2. optional `force_skip_invalid` (default true)

Response:

1. `timeline_id`
2. created/skipped counts
3. warnings
4. audit id

### 6) Get Commit Audit

`GET /api/ingestion/text-to-timeline/sessions/{session_id}/audit`

Response:

1. commit counts
2. warning details
3. entity id mappings (candidate -> canonical id)

---

## Candidate Graph Schema (Preview JSON)

Top-level:

1. `timeline_candidate`
2. `summary`
3. `thinkers[]`
4. `events[]`
5. `connections[]`
6. `publications[]`
7. `quotes[]`
8. `warnings[]`

Graph-reference contract:

1. Every row uses `candidate_id` as stable identifier.
2. Cross-entity references use `*_candidate_id` (not mutable display names).
3. UI edits can change display fields but cannot mutate `candidate_id`.
4. If a referenced node is excluded, dependent rows are auto-marked invalid with explicit warnings.

Each candidate record includes:

1. `candidate_id` (stable hash)
2. `confidence` (0-1)
3. `include` (default true if above threshold)
4. `fields` (entity payload)
5. `evidence[]`
6. `dependency_keys[]`

Thinker candidate additional fields:

1. `match_status` (`reuse_high_confidence|review_needed|create_new`)
2. `matched_thinker_id` (nullable)
3. `match_score`
4. `match_reasons[]`
5. `metadata_delta` (fields extracted from source that differ from canonical thinker metadata)

Evidence entry includes:

1. `source_artifact_id`
2. `chunk_index`
3. `char_start`
4. `char_end`
5. `excerpt`

Evidence limits:

1. `excerpt` max length (for example 280 chars).
2. max evidence items per candidate in review payload (for example 3 by default, expand-on-demand endpoint optional).

---

## LLM and Chunking Strategy

### Input and Token Guardrails

1. `content` hard cap for preview endpoint:
   - 500KB UTF-8 payload max
   - 250,000 characters max
   - both limits enforced; first exceeded limit fails request
2. Max chunk count cap (for example 120 chunks) to prevent runaway cost.
3. Per-chunk prompt budget must remain below runtime token cap from `AI_MAX_PROMPT_TOKENS`.
4. If text exceeds caps:
   - return `422` with precise limits and guidance to split source text
   - do not start extraction job
5. Session-level soft budget:
   - abort remaining chunks when projected token usage exceeds quota
   - mark partial preview with warning and completion status `ready_for_review_partial`

### Chunking

1. Normalize line breaks and whitespace.
2. Split by paragraph boundaries.
3. Pack to target chunk size (for example 2,000-3,000 estimated tokens).
4. Add overlap by paragraph boundaries (not raw chars/tokens):
   - carry trailing paragraphs from chunk `n` into chunk `n+1` until overlap target (10-15% of chunk token estimate) is met
   - preserve original absolute char offsets for each paragraph occurrence
5. Track absolute offsets for evidence mapping.
6. Record chunk token estimates and cumulative token budget telemetry.

### Extraction Pass (Per Chunk)

Prompt returns strict JSON with:

1. thinkers
2. events (name/year/type/description)
3. connections (source thinker, target thinker, type, rationale)
4. publications
5. quotes
6. uncertainty flags

### Merge Pass

1. Name normalization (case, punctuation, whitespace).
2. Deduplicate thinkers by normalized name + year compatibility.
3. Deduplicate events by normalized title + year proximity.
4. Deduplicate connections by endpoint pair only (`from_candidate_id`, `to_candidate_id`) to match canonical uniqueness constraints.
5. If multiple connection types exist for one pair, keep one resolved type using confidence + evidence support and record alternate types as warnings.
6. Aggregate confidence from evidence count + model score.
7. Deduplicate overlapping evidence spans by `(source_artifact_id, char_start, char_end, excerpt_hash)` before persistence.

### Type Normalization (Required for Commit Safety)

1. Build explicit mapping tables before commit:
   - connection aliases -> `influenced|critiqued|built_upon|synthesized`
   - event aliases -> `council|publication|war|invention|cultural|political|other`
   - publication aliases -> `book|article|chapter|thesis|conference|report|other`
2. Unmapped values resolve to:
   - `other` only when semantically safe
   - otherwise flagged as blocking validation error
3. Persist normalization warnings in session diagnostics and commit audit.

### Summary Pass

Generate review summary from merged graph:

1. corpus synopsis
2. key periods
3. major thinkers
4. central relationships
5. uncertainty and gap notes

### Provider Strategy

1. Default provider: existing DeepSeek gateway.
2. Keep provider abstraction in `ai_service`; do not hard-wire route logic to one model.
3. Enforce cost controls before each call.
4. Fall back with actionable error when limits are exceeded.

---

## Commit Semantics

Commit executes in one DB transaction:

1. Create new `timeline`.
2. Resolve thinker candidates through matcher output and user overrides:
   - reuse existing thinker records when approved
   - create new thinkers only for unmatched/explicit-create candidates
3. Resolve candidate thinker ids to canonical thinker ids (reused or newly created).
4. Create included `timeline_events` mapped to new timeline.
5. Create included `connections` using mapped thinker ids.
6. Create included `publications` and `quotes` mapped to thinker ids.
7. Optionally trigger repopulation for thinker layout after commit.
8. Persist commit audit and mark session `committed`.

### Validation Rules Before Commit

1. Timeline schema validation:
   - non-empty name
   - year range validity (`start_year <= end_year` when both provided)
2. Thinker schema validation:
   - non-empty name
   - valid year bounds
   - `birth_year <= death_year` when both present
   - matcher decision exists (`reuse` or `create`) for each included thinker candidate
3. Connection validation:
   - both endpoints resolve to included thinker canonical ids
   - no self-loop
   - duplicate pair detection on (`from_thinker_id`, `to_thinker_id`)
   - enforce one canonical connection per directional pair (DB unique constraint compatibility)
   - type normalized to allowed enum
4. Timeline event validation:
   - valid integer year
   - type normalized to allowed enum
5. Publication/quote validation:
   - linked thinker id exists in created thinker mapping
   - publication type normalized to allowed literals
6. Cross-entity integrity:
   - excluding a thinker invalidates dependent rows unless user repairs references
7. Duplicate canonical key collisions are either merged or skipped with warning.

### Idempotency

1. If session already committed, return existing `timeline_id` and audit.
2. Use optimistic compare-and-set status transition (`ready_for_review|ready_for_review_partial -> committing`) with affected-row check.
3. If CAS transition fails:
   - if state is `committing`, return conflict/retryable response
   - if state is `committed`, return committed result
4. This approach is required for SQLite-friendly development and Postgres production compatibility.

---

## Frontend Implementation Plan

### New/Updated Components

1. Extend `frontend/src/components/notes/AiIngestionPanel.tsx` into a stepper:
   - input
   - processing
   - review
   - commit
2. New `TimelineBootstrapReviewPanel.tsx`:
   - summary section
   - candidate tables with include toggles
   - inline edit controls
   - warnings list
3. New `TimelineBootstrapCommitResult.tsx`:
   - created counts
   - warnings
   - open timeline CTA
4. Reuse `AiJobStatus` visual pattern only; do not rely on `/api/jobs/{id}` as the primary preview polling source.

### Polling Behavior Contract

1. Poll `GET /api/ingestion/text-to-timeline/sessions/{session_id}` as the source of truth.
2. Poll interval:
   - `queued|running`: every 2s
   - `ready_for_review|ready_for_review_partial|failed|committed`: stop polling
3. Use job endpoint only for secondary diagnostics (optional), because preview payload and review state live on session endpoints.
4. After status becomes review-ready, fetch paginated candidates via `/candidates` endpoints.

### Frontend API Extensions

Add methods in `frontend/src/lib/api.ts`:

1. `ingestionApi.createTimelinePreview(...)`
2. `ingestionApi.getTimelinePreviewSession(...)`
3. `ingestionApi.getTimelinePreviewCandidates(entityType, limit, cursor, includeEvidence)`
4. `ingestionApi.updateTimelinePreviewValidation(...)`
5. `ingestionApi.commitTimelinePreview(...)`
6. `ingestionApi.getTimelinePreviewAudit(...)`

Add corresponding types in `frontend/src/types/index.ts`.

### Query/Cache Behavior

On successful commit invalidate:

1. `['timelines']`
2. `['thinkers']`
3. `['timeline-events']`
4. `['connections']`
5. `['publications']`
6. `['quotes']`

Then navigate to the new timeline context.

---

## Backend Implementation Plan

### Routes

1. Extend `backend/app/routes/ingestion.py` with preview/session/candidates/validation/commit/audit endpoints.
2. Keep heavy operations async via `enqueue_or_run`.
3. Add preflight gating:
   - require Phase F + bootstrap feature flag
   - require `RQ_ENABLED=true` in non-dev environments
4. Add explicit max-content validation at route boundary.
5. Validate requested `job_type` against allowed set at route boundary (defense-in-depth even with DB check constraint).

### Services

Create new modules under `backend/app/services/notes_ai/`:

1. `timeline_bootstrap_chunking.py`
2. `timeline_bootstrap_extract.py`
3. `timeline_bootstrap_merge.py`
4. `timeline_bootstrap_summary.py`
5. `timeline_bootstrap_thinker_matcher.py`
6. `timeline_bootstrap_commit.py`
7. `timeline_bootstrap_validation.py`

### AI Utility Layer

Extend `backend/app/utils/ai_service.py` with:

1. strict JSON extractor call helper
2. preview summary helper
3. shared response cleaning/validation utilities

### Job Worker

Worker structure:

1. Keep `process_ingestion_job(...)` for transcript/pdf artifact persistence only.
2. Add dedicated bootstrap worker function:
   - `process_timeline_bootstrap(job_id, payload)`
3. Add dispatcher helper used by routes/retry:
   - `dispatch_ingestion_job(job_type, job_id, payload)`
4. Bootstrap worker responsibilities:
   - create source artifact
   - run chunk extraction/merge/summary
   - persist candidates/evidence/session status
   - emit diagnostics and warnings
5. implement cancellation checkpoints and partial-review status for quota aborts
6. guarantee retry uses original job type payload dispatch

---

## Feature Flags

Add dedicated flags:

1. Backend: `FEATURE_NOTES_AI_TIMELINE_BOOTSTRAP`
2. Frontend: `NEXT_PUBLIC_FEATURE_NOTES_AI_TIMELINE_BOOTSTRAP`

Effective enablement rule:

1. Backend route availability = `notes_ai_phase_enabled("F") && FEATURE_NOTES_AI_TIMELINE_BOOTSTRAP`.
2. Frontend panel visibility = `notesAiFlags.phaseF && timelineBootstrapFlag`.
3. Production/staging also requires `RQ_ENABLED=true` for preview/commit operations.

Reason: isolate rollout from broader Phase F ingestion behavior while preventing unsafe blocking execution.

---

## Error Handling and Recovery

1. Extraction parse failure in one chunk:
   - retry chunk with lower temperature once
   - if still failing, continue with warning and partial coverage
2. Job failure:
   - session status `failed` with actionable `error_message`
   - user can retry from same source artifact
3. Commit failure:
   - full transaction rollback
   - session returns to `ready_for_review` with commit error details

---

## Observability and SLOs

Track per session:

1. chunk count
2. extraction latency per chunk
3. estimated prompt/completion tokens
4. merge duration
5. preview generation duration
6. commit duration
7. created/skipped counts

Initial SLO targets:

1. Preview generation P95 under 60s for medium-size source text.
2. Commit P95 under 5s.
3. Hard failure rate under 3% excluding provider outages.

---

## Testing Strategy

### Backend Unit Tests

1. chunking preserves offsets and overlap contract
2. merge dedup rules for thinkers/events/connections
3. thinker matcher scoring and decision buckets (`reuse|review|create`)
4. validation rejects malformed commit payloads
5. commit mapping logic (candidate ids -> canonical ids)

### Backend Route/Integration Tests

1. preview endpoint creates job/session
2. session endpoint returns summary metadata and counts
3. paginated candidates endpoint returns cursor-safe pages
4. validation endpoint persists edits
5. commit endpoint creates timeline + related entities
6. idempotent second commit returns same timeline
7. rollback on mid-commit failure
8. AI-disabled and feature-flag-disabled behavior
9. queue gating behavior (`RQ_ENABLED=false` in prod-like env returns expected failure)
10. retry dispatch for `text_to_timeline_preview` uses correct worker path
11. cancellation during extraction loop exits cleanly and preserves partial diagnostics
12. optimistic commit race: concurrent commits resolve to one winner and one non-destructive retry/conflict response
13. thinker reuse path reuses existing canonical thinker metadata
14. thinker override path forces create-new or explicit reuse as selected by user
15. unknown job type is rejected at route boundary and (if enabled) DB check constraint layer

### Frontend Tests

1. stepper transitions: input -> processing -> review -> committed
2. include/exclude and inline edit behavior
3. commit disabled until blocking issues resolved
4. candidate pagination interactions (load more/switch entity tabs)
5. session polling behavior (intervals and stop conditions by session status)
6. successful commit invalidates caches and navigates correctly

### End-to-End Journey

1. Paste long text.
2. Wait for preview.
3. Modify 2-3 candidate rows.
4. Commit.
5. Verify new timeline and entities are visible in normal app views.

---

## Security and Data Integrity

1. Treat AI output as untrusted input; validate all fields server-side.
2. Enforce max content size per request.
3. Escape/strip unsafe markup in generated text fields.
4. Keep commit operation transactional and audited.
5. Avoid exposing provider internals in API error responses.

---

## Lifecycle and Retention

1. Draft sessions expire after a fixed TTL (for example 30 days) if not committed.
2. Expired sessions move to `expired` status and are hidden from default review queries.
3. Scheduled cleanup job removes expired candidate/evidence rows in batches.
4. Committed session audit rows are retained for reproducibility unless manually purged.

---

## Delivery Phases

### Phase 1: Backend Preview Foundation

1. schema migration for bootstrap session/audit tables
2. preview endpoint + job scaffolding
3. chunk extraction + merge + summary
4. thinker matcher service + match diagnostics
5. session retrieval API

Exit: preview payload retrievable for real text input.

### Phase 2: Review UI + Validation Persistence

1. ingestion panel stepper
2. review tables + warnings
3. thinker match override controls (`reuse` vs `create`) in review UI
4. validation save endpoint integration

Exit: user can edit and persist validation state.

### Phase 3: Commit and Canonical Persistence

1. transactional commit service
2. commit endpoint + idempotency
3. post-commit navigation and cache invalidation
4. V1 commit scope enforced (timeline + thinkers + events + connections)

Exit: user can create a core timeline graph and see committed data across app views.

### Phase 4: V2 Full Entity Commit

1. enable commit path for publications and quotes
2. finalize cross-entity validation for all committed types
3. extend audit payload and UI summaries for all entity categories

Exit: V2 commit writes all supported entities in a single validated transaction.

### Phase 5: Hardening

1. retry/error UX polish
2. observability and metrics
3. performance and quota tuning
4. e2e reliability sweep

Exit: production-ready behavior under expected workload.

---

## Definition of Done

1. User can generate preview from long text.
2. Preview includes summary and structured candidates with evidence.
3. User can validate/edit before commit.
4. V2 commit creates a new timeline plus linked thinkers/events/connections/publications/quotes.
5. New data appears throughout existing application flows without manual backfill.
6. Test suite covers success, failure, and rollback paths.
7. Feature can be safely toggled via flag.

---

## Locked Defaults

1. Numeric limits:
   - max `content` = 500KB UTF-8 and 250,000 chars
   - max chunks = 120
   - evidence snippet length = 280 chars
2. Default auto-inclusion thresholds:
   - thinkers/events/connections >= 0.65
   - publications/quotes >= 0.70
3. V1 publication/quote behavior:
   - extract + review enabled
   - commit disabled (hard review-only) until Phase 4 (V2 full commit)
4. Thinker matcher defaults:
   - `match_score >= 0.90` => auto-select reuse (user can override)
   - `0.70 <= match_score < 0.90` => review-required
   - `< 0.70` => default create-new
