# Plan 9: AI Notes System Full Implementation Plan (All Phases)

## Goal

Deliver an end-to-end AI layer for `/notes` that stays evidence-first, expands term synthesis into a multi-mode workflow, and adds writing, argumentation, discovery, planning, and collaboration capabilities without breaking existing Plans 1-8 contracts.

---

## Status

- **Date:** 2026-02-13
- **Type:** Execution roadmap (implementation-ready)
- **Priority:** Optional but strategic (run after core stability gates)

---

## Dependencies

1. **Required:** Plans 1-8 merged and stable.
2. **Critical existing components:** `critical_terms` routes, `analysis` routes, Thinker mentions, term occurrences, right panel in `/notes`.
3. **AI dependency:** `backend/app/utils/ai_service.py` with DeepSeek/OpenAI-compatible client remains the single gateway for LLM calls.

---

## Product Principles (Non-Negotiable)

1. Notes are the only knowledge source for generated outputs.
2. All synthesis features expose evidence and citation links.
3. Costly AI operations are opt-in user actions or explicit queued jobs.
4. Uncertainty must be visible, not hidden.
5. Graceful degradation is required when AI is disabled.

---

## Scope

### In Scope

1. Term evidence mapping and multi-mode synthesis.
2. Synthesis quality analysis and contradiction surfacing.
3. Thesis/draft copilot tools grounded in excerpts.
4. Argument-map generation and critique aids.
5. Semantic retrieval and related-excerpt discovery.
6. Strategic workflow features (planner, digest, briefing, viva prep).
7. Optional multimodal ingestion (audio transcript and PDF annotation pipelines).

### Out of Scope

1. External web retrieval for term definitions.
2. Autonomous background writing without user intent.
3. Replacing existing manual note-taking/editor flow.

---

## Cross-Phase Architecture

### Service Layer (New)

Create a dedicated backend service package:

- `backend/app/services/notes_ai/evidence.py`
- `backend/app/services/notes_ai/synthesis.py`
- `backend/app/services/notes_ai/quality.py`
- `backend/app/services/notes_ai/argumentation.py`
- `backend/app/services/notes_ai/discovery.py`
- `backend/app/services/notes_ai/planning.py`

### Shared API Extension Points

1. `backend/app/routes/critical_terms.py` for term evidence/synthesis/quality/thesis flows.
2. `backend/app/routes/analysis.py` for argument maps, discovery, and connection intelligence.
3. `frontend/src/lib/api.ts` as the single frontend API integration surface.

### Shared Frontend Extension Points

1. `frontend/src/app/notes/page.tsx` right panel mode expansion.
2. `frontend/src/components/notes/TermDefinitionPanel.tsx` as core host for term workflows.
3. New dedicated panels for evidence, quality, drafting, argument maps, and planning.

---

## Data Model Roadmap

### Phase A Migrations

1. `synthesis_runs`
2. `synthesis_run_citations`
3. `synthesis_snapshots`

### Phase B/C Migrations

1. `quality_reports`
2. `claim_candidates`
3. `argument_maps`
4. `argument_map_nodes`
5. `argument_map_edges`

### Phase D/E/F Migrations

1. `term_aliases`
2. `term_relationships`
3. `note_embeddings` (or excerpt embeddings)
4. `planner_runs`
5. `weekly_digests`
6. `ingestion_jobs`
7. `source_artifacts`

All migrations must keep SQLite-friendly dev behavior and Postgres-compatible production behavior.

---

## Phase Overview

| Phase | Objective | Primary Features | Est. Sprints | Release Gate |
|---|---|---|---|---|
| 0 | Foundation hardening | schema/service prep, telemetry, feature flags | 1 | Stable API contracts |
| A | Evidence + synthesis core | evidence map, citation-first synthesis, comparative mode, diff viewer | 2 | Trusted synthesis baseline |
| B | Research rigor | critical mode, quality report, uncertainty + contradiction signals | 2 | Verifiable outputs |
| C | Writing + argumentation | thesis candidates, draft from excerpts, argument map and premise gaps | 2 | Writing copilot usable |
| D | Discovery + connection intelligence | semantic search, related excerpts, confidence-scored connection rationale | 2 | Discovery quality acceptable |
| E | Strategic workflow | sprint planner, advisor briefing, weekly digest, viva practice | 1 | Workflow integration complete |
| F | Multimodal + scale hardening | transcript/pdf ingestion, async jobs, caching/cost controls | 2 | Production-grade operations |

---

## Phase 0: Foundation Hardening

### Outcomes

1. Introduce stable schema and service boundaries before feature growth.
2. Add feature flags to launch each phase safely.
3. Establish observability for latency, token usage, and failure modes.

### Backend Work

1. Add service package scaffolding in `backend/app/services/notes_ai/`.
2. Add feature flag helpers in `backend/app/constants.py` or equivalent.
3. Extend `backend/app/utils/ai_service.py` with shared telemetry wrappers.
4. Add request/response timing and token accounting fields to AI call logs.

### Frontend Work

1. Add phase-aware capability flags in `frontend/src/lib/api.ts` and/or config.
2. Add optional UI affordance for unavailable features (disabled buttons with rationale).

### Tests

1. Unit tests for flag gating behavior.
2. Contract tests ensuring disabled features return stable 4xx/soft responses.

### Exit Criteria

1. No regressions in Plans 1-8.
2. Feature flags can toggle all new endpoints cleanly.

---

## Phase A: Evidence and Synthesis Core

### Outcomes

1. Deliver an AI-free evidence map endpoint.
2. Upgrade synthesis to multi-mode base (`definition`, `comparative`).
3. Persist synthesis runs and citations for reproducibility.
4. Add synthesis diff in UI.

### Backend Work

1. `backend/app/schemas/critical_term.py`:
   - Add `TermEvidenceMapResponse`, `EvidenceStats`, `SynthesisMode`, `SynthesisRunResponse`.
2. `backend/app/routes/critical_terms.py`:
   - Add `GET /api/critical-terms/{term_id}/evidence-map`.
   - Add `GET /api/critical-terms/{term_id}/synthesis?mode=definition|comparative`.
   - Add `GET /api/critical-terms/{term_id}/synthesis-runs`.
3. New service modules:
   - `notes_ai/evidence.py`: filter/group/statistics assembly.
   - `notes_ai/synthesis.py`: prompt builders per mode + citation mapping.
4. Migration files:
   - create `synthesis_runs`, `synthesis_run_citations`, `synthesis_snapshots`.

### Frontend Work

1. `frontend/src/lib/api.ts`:
   - Add `criticalTermsApi.getEvidenceMap()`.
   - Add synthesis mode parameter + run history fetch.
2. `frontend/src/types/index.ts`:
   - Add evidence and synthesis run interfaces.
3. New components:
   - `frontend/src/components/notes/EvidenceMapPanel.tsx`
   - `frontend/src/components/notes/SynthesisModeTabs.tsx`
   - `frontend/src/components/notes/SynthesisDiffView.tsx`
4. Modify:
   - `frontend/src/components/notes/TermDefinitionPanel.tsx`
   - `frontend/src/components/notes/SynthesisView.tsx`
   - `frontend/src/app/notes/page.tsx` right-panel mode integration.

### API Contracts

1. `GET /api/critical-terms/{term_id}/evidence-map`:
   - Query: `folder_id?`, `thinker_id?`, `date_from?`, `date_to?`.
   - Returns: grouped excerpts, counts, thinker/folder distribution, co-term list.
2. `GET /api/critical-terms/{term_id}/synthesis`:
   - Query: `mode`, `folder_id?`, `thinker_id?`, `snapshot?`.
   - Returns: synthesis markdown, citation list, coverage metadata.

### Tests

1. Backend route tests for filter combinations and empty corpus behavior.
2. Snapshot tests for synthesis payload shape.
3. Frontend tests for mode switching and diff rendering.

### Exit Criteria

1. Every synthesis sentence can be traced to citations.
2. Comparative mode shows deterministic structure and stable rendering.
3. End-to-end flow works with AI enabled and disabled.

---

## Phase B: Research Rigor and Trust

### Outcomes

1. Add `critical` synthesis mode (claim, objection, reply).
2. Introduce quality report endpoint with coverage and uncertainty metrics.
3. Detect contradictions and low-evidence claims.

### Backend Work

1. `backend/app/schemas/critical_term.py`:
   - Add `TermQualityReportResponse`, `ClaimAssessment`, `ContradictionSignal`.
2. `backend/app/routes/critical_terms.py`:
   - Extend synthesis mode to `critical`.
   - Add `GET /api/critical-terms/{term_id}/quality-report`.
3. `backend/app/services/notes_ai/quality.py`:
   - Implement citation coverage scoring.
   - Implement uncertainty label assignment.
   - Implement contradiction candidate detection.
4. Migrations:
   - create `quality_reports`.

### Frontend Work

1. New components:
   - `frontend/src/components/notes/QualityReportPanel.tsx`
   - `frontend/src/components/notes/ContradictionList.tsx`
   - `frontend/src/components/notes/ConfidenceBadge.tsx`
2. Modify:
   - `frontend/src/components/notes/SynthesisView.tsx` to display uncertainty per section.
   - `frontend/src/components/notes/TermDefinitionPanel.tsx` to link quality panel.

### API Contracts

1. `GET /api/critical-terms/{term_id}/quality-report`:
   - Inputs: term + optional filters + synthesis run ID.
   - Outputs: coverage rate, unsupported claim flags, contradiction snippets, uncertainty tags.

### Tests

1. Unit tests for coverage math and uncertainty thresholds.
2. Regression tests for contradiction detection false-positive control.
3. Frontend tests for quality report states (healthy, warning, low-evidence).

### Exit Criteria

1. Quality report exists for every synthesis run.
2. Unsupported claim flags are visible in UI before export/copy.

---

## Phase C: Writing Copilot and Argumentation

### Outcomes

1. Generate thesis candidates grounded in selected evidence.
2. Draft note prose from user-selected excerpts.
3. Build argument maps and detect premise gaps.

### Backend Work

1. `backend/app/schemas/critical_term.py`:
   - Add `ThesisCandidate`, `ThesisCandidateResponse`.
2. `backend/app/schemas/analysis.py`:
   - Add `ArgumentMapResponse`, `ArgumentNode`, `ArgumentEdge`, `PremiseGap`.
3. `backend/app/routes/critical_terms.py`:
   - Add `POST /api/critical-terms/{term_id}/thesis-candidates`.
4. `backend/app/routes/analysis.py`:
   - Add `POST /api/analysis/argument-map`.
   - Add `POST /api/analysis/premise-gap-check`.
5. `backend/app/routes/notes.py`:
   - Add `POST /api/notes/draft-from-excerpts`.
6. `backend/app/services/notes_ai/argumentation.py`:
   - Implement claim extraction, support linkage, counterclaim generation.
7. Migrations:
   - create `claim_candidates`, `argument_maps`, `argument_map_nodes`, `argument_map_edges`.

### Frontend Work

1. New components:
   - `frontend/src/components/notes/ThesisCandidatesPanel.tsx`
   - `frontend/src/components/notes/DraftFromExcerptsModal.tsx`
   - `frontend/src/components/notes/ArgumentMapPanel.tsx`
2. Modify:
   - `frontend/src/components/notes/EditorToolbar.tsx` to trigger draft-from-excerpts.
   - `frontend/src/app/notes/page.tsx` for new panel modes.
   - `frontend/src/lib/api.ts` with writing/argument endpoints.

### API Contracts

1. `POST /api/notes/draft-from-excerpts`:
   - Body: excerpt IDs, desired tone/style, max length.
   - Returns: draft text + supporting citations.
2. `POST /api/analysis/argument-map`:
   - Body: note IDs or term ID + filters.
   - Returns: nodes/edges + confidence + gap list.

### Tests

1. API tests for deterministic JSON structure in argument graphs.
2. UI tests for inserting generated draft into editor.
3. Guardrail tests ensuring generated draft carries citations.

### Exit Criteria

1. Users can generate and insert grounded drafts in one flow.
2. Argument map view is stable and actionable for at least medium-sized corpora.

---

## Phase D: Discovery and Connection Intelligence

### Outcomes

1. Semantic retrieval across notes/excerpts.
2. Related-excerpt suggestions from current context.
3. Explanation and confidence scoring for connection suggestions.
4. Alias/variant clustering for terms.

### Backend Work

1. `backend/app/services/notes_ai/discovery.py`:
   - embedding generation and similarity scoring.
   - fallback lexical ranking when embeddings unavailable.
2. `backend/app/routes/analysis.py`:
   - add `GET /api/analysis/semantic-search`.
   - add `GET /api/analysis/related-excerpts`.
   - add `GET /api/analysis/connection-explanations`.
3. `backend/app/routes/critical_terms.py`:
   - add term alias proposal and approval endpoints.
4. Migrations:
   - create `term_aliases`, `term_relationships`, `note_embeddings`.

### Frontend Work

1. New components:
   - `frontend/src/components/notes/SemanticSearchPanel.tsx`
   - `frontend/src/components/notes/RelatedExcerptsRail.tsx`
   - `frontend/src/components/notes/ConnectionRationaleCard.tsx`
   - `frontend/src/components/notes/TermAliasReviewDialog.tsx`
2. Modify:
   - `frontend/src/components/notes/ConnectionSuggestionsPanel.tsx` to include rationale + confidence rubric.
   - `frontend/src/components/notes/CriticalTermsList.tsx` to expose alias actions.

### API Contracts

1. Semantic search returns ranked excerpts with similarity score and provenance.
2. Connection explanation returns explicit evidence snippets and confidence factors.
3. Alias endpoints require user approval before merge behavior changes.

### Tests

1. Retrieval quality tests on seed fixtures.
2. Confidence scoring tests for deterministic rubric.
3. UI tests for alias review/approval flows.

### Exit Criteria

1. Semantic search improves discovery beyond keyword search in fixture benchmarks.
2. Connection explanations are evidence-backed and traceable.

---

## Phase E: Strategic Workflow and Collaboration

### Outcomes

1. Research sprint planning from open questions and term gaps.
2. Advisor briefing generation for selected time windows.
3. Weekly digest and viva practice flows.

### Backend Work

1. `backend/app/services/notes_ai/planning.py`:
   - planner generation
   - digest synthesis
   - viva Q/A generation
2. `backend/app/routes/analysis.py`:
   - add `POST /api/analysis/research-sprint-plan`.
   - add `POST /api/analysis/advisor-brief`.
   - add `POST /api/analysis/viva-practice`.
3. Scheduled jobs:
   - weekly digest generation with opt-in settings.
4. Migrations:
   - create `planner_runs`, `weekly_digests`.

### Frontend Work

1. New components:
   - `frontend/src/components/notes/ResearchSprintPlanner.tsx`
   - `frontend/src/components/notes/AdvisorBriefPanel.tsx`
   - `frontend/src/components/notes/VivaPracticePanel.tsx`
   - `frontend/src/components/notes/WeeklyDigestPanel.tsx`
2. Add export actions (markdown/text) for briefing and planner artifacts.

### API Contracts

1. Planner output includes tasks, rationale, and evidence references.
2. Briefing output includes "decisions needed" and "open risks".
3. Viva output includes question, expected answer rubric, and supporting notes.

### Tests

1. End-to-end tests for planner -> task acceptance flow.
2. Snapshot tests for advisor briefing sections.
3. Permission tests for scheduled digest generation.

### Exit Criteria

1. Weekly digest can be generated and viewed reliably.
2. Planner and briefing outputs cite relevant source notes.

---

## Phase F: Multimodal and Production Hardening

### Outcomes

1. Ingest audio transcript segments into notes evidence graph.
2. Ingest PDF highlights and attach provenance.
3. Introduce async job orchestration for heavy AI tasks.
4. Enforce token/cost guardrails and caching.

### Backend Work

1. Add ingestion APIs and adapters:
   - transcript import
   - PDF highlight import
2. Add async orchestration pattern (FastAPI background + queue adapter if needed).
3. Add cost controls:
   - per-request token caps
   - per-user/day soft quota
   - response caching for repeated synthesis requests
4. Migrations:
   - create `ingestion_jobs`, `source_artifacts`.

### Frontend Work

1. New ingestion UIs for transcript/PDF imports.
2. Job status and retry UI for asynchronous tasks.
3. Cost/usage meter in AI panels.

### Tests

1. Integration tests for import pipelines.
2. Failure/retry tests for queued tasks.
3. Performance tests on large note sets.

### Exit Criteria

1. Heavy AI flows no longer block user edits.
2. Cost and latency remain within defined SLOs.

---

## Detailed File Change Matrix

| Area | Files (Expected) |
|---|---|
| Backend routes | `backend/app/routes/critical_terms.py`, `backend/app/routes/analysis.py`, `backend/app/routes/notes.py` |
| Backend schemas | `backend/app/schemas/critical_term.py`, `backend/app/schemas/analysis.py` |
| Backend services | `backend/app/services/notes_ai/*.py` |
| Backend migrations | `backend/alembic/versions/*_ai_notes_phase_*.py` |
| Frontend API/types | `frontend/src/lib/api.ts`, `frontend/src/types/index.ts` |
| Frontend notes UI | `frontend/src/app/notes/page.tsx`, `frontend/src/components/notes/*.tsx` |
| Tests backend | `backend/tests/test_critical_terms.py`, `backend/tests/test_analysis.py`, `backend/tests/test_notes_ai.py` |
| Tests frontend | `frontend/src/components/__tests__/*.test.tsx`, `frontend/tests/journeys/ai/*.spec.ts` |

---

## API Contract Baseline

### Critical Terms

1. `GET /api/critical-terms/{term_id}/evidence-map`
2. `GET /api/critical-terms/{term_id}/synthesis?mode=definition|comparative|critical`
3. `GET /api/critical-terms/{term_id}/quality-report`
4. `POST /api/critical-terms/{term_id}/thesis-candidates`
5. `POST /api/critical-terms/{term_id}/aliases/propose`
6. `POST /api/critical-terms/{term_id}/aliases/{alias_id}/approve`

### Notes and Analysis

1. `POST /api/notes/draft-from-excerpts`
2. `POST /api/analysis/argument-map`
3. `POST /api/analysis/premise-gap-check`
4. `GET /api/analysis/semantic-search`
5. `GET /api/analysis/related-excerpts`
6. `GET /api/analysis/connection-explanations`
7. `POST /api/analysis/research-sprint-plan`
8. `POST /api/analysis/advisor-brief`
9. `POST /api/analysis/viva-practice`

---

## Test Strategy (Global)

1. Unit tests for service logic in each module.
2. Route tests for all new endpoints with success/error/AI-disabled paths.
3. Contract tests to lock response shapes.
4. Frontend component tests for each new panel/modal.
5. End-to-end flows:
   - term click -> evidence -> synthesis -> quality report
   - evidence selection -> draft insertion
   - argument map generation and review
   - planner/brief/viva workflows
6. Performance tests on representative corpus sizes (500, 2k, 5k notes).

---

## Rollout Strategy

1. Release each phase behind feature flags.
2. Run internal dogfooding on historical notes first.
3. Track metrics before promoting to default-on.
4. Keep fallback behavior: evidence-only view remains always available.

---

## Success Metrics

1. Citation coverage rate per synthesis run.
2. User correction rate of generated drafts.
3. Median time-to-insight from term selection.
4. Claim support ratio in critical mode.
5. Discovery click-through on semantic results.
6. Weekly active usage of planner/briefing panels.
7. P95 latency and token cost per endpoint.

---

## Risks and Mitigations

1. Risk: Hallucinated claims.
   - Mitigation: minimum citation threshold + unsupported claim flags.
2. Risk: UI complexity overload.
   - Mitigation: progressive disclosure and defaults to evidence-first mode.
3. Risk: Cost spikes with large prompts.
   - Mitigation: excerpt caps, caching, async queue for heavy tasks.
4. Risk: Model downtime.
   - Mitigation: AI-disabled graceful responses + retained evidence workflows.
5. Risk: Low retrieval quality in discovery phase.
   - Mitigation: lexical fallback and benchmark-based threshold tuning.

---

## Execution Checklist

### Before Phase A

1. Confirm Plans 1-8 acceptance gates pass on `main`.
2. Confirm AI keys and env var handling are documented.
3. Confirm schema extension approach for `critical_term.py` and `analysis.py`.

### Before Each Phase

1. Create migration(s) first.
2. Add schema models second.
3. Add service logic third.
4. Add routes fourth.
5. Add frontend API/types fifth.
6. Add UI components sixth.
7. Add tests and docs last.

### Completion Criteria (Final)

1. All phase exit criteria met.
2. All new endpoints visible in `/docs`.
3. Frontend type-check and tests pass.
4. Backend tests pass.
5. Documentation reflects final API and feature flags.

---

## Capability Coverage Map

| Capability Theme | Covered In |
|---|---|
| Term intelligence and synthesis | Phases A, B |
| Thinker analysis and contradictions | Phases A, B |
| Writing copilot and thesis generation | Phase C |
| Argumentation and premise checks | Phase C |
| Discovery and related excerpts | Phase D |
| Connection rationale and confidence | Phase D |
| Planning, digest, advisor, viva | Phase E |
| Multimodal ingestion and scale hardening | Phase F |
