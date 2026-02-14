# Plan 9 Notes AI API Reference

Reference for the Plan 9 Notes AI endpoints (phases 0-F).

## Base URLs

- General API: `http://localhost:8010/api`
- Critical terms routes: `http://localhost:8010/api/critical-terms`
- Notes routes: `http://localhost:8010/api/notes`
- Analysis routes: `http://localhost:8010/api/analysis`
- Ingestion routes: `http://localhost:8010/api/ingestion`
- Jobs routes: `http://localhost:8010/api/jobs`

## Critical Terms

- `GET /api/critical-terms/{term_id}/evidence-map`
- `GET /api/critical-terms/{term_id}/synthesis?mode=definition|comparative|critical`
- `GET /api/critical-terms/{term_id}/synthesis-runs`
- `GET /api/critical-terms/{term_id}/quality-report`
- `POST /api/critical-terms/{term_id}/thesis-candidates`
- `POST /api/critical-terms/{term_id}/aliases/propose`
- `POST /api/critical-terms/{term_id}/aliases/{alias_id}/approve`

## Notes

- `POST /api/notes/draft-from-excerpts`

## Analysis

- `POST /api/analysis/argument-map`
- `POST /api/analysis/premise-gap-check`
- `GET /api/analysis/semantic-search`
- `GET /api/analysis/related-excerpts`
- `GET /api/analysis/connection-explanations`
- `POST /api/analysis/research-sprint-plan`
- `POST /api/analysis/advisor-brief`
- `POST /api/analysis/viva-practice`
- `POST /api/analysis/weekly-digest`
- `GET /api/analysis/weekly-digest/latest`
- `GET /api/analysis/ai-usage`

## Ingestion and Jobs

- `POST /api/ingestion/transcript`
- `POST /api/ingestion/pdf-highlights`
- `GET /api/jobs/{job_id}`
- `POST /api/jobs/{job_id}/cancel`
- `POST /api/jobs/{job_id}/retry`

## Feature Flags

- `FEATURE_NOTES_AI_PHASE_A`
- `FEATURE_NOTES_AI_PHASE_B`
- `FEATURE_NOTES_AI_PHASE_C`
- `FEATURE_NOTES_AI_PHASE_D`
- `FEATURE_NOTES_AI_PHASE_E`
- `FEATURE_NOTES_AI_PHASE_F`

## Notes

- Synthesis remains explicit-action only (not auto-triggered on panel open).
- Evidence-first flows remain available when AI is disabled.
- Heavy workloads can run asynchronously through the queue-backed job path.
