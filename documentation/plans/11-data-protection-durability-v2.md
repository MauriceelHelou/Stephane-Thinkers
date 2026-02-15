# Plan 11: Data Protection & Durability System V2

## Goal

Deliver a production-grade, defense-in-depth data protection system so research data loss is operationally improbable and recovery is testable, fast, and repeatable.

---

## Status

- **Date:** 2026-02-14
- **Type:** Implementation-ready delivery plan
- **Priority:** Critical

## Decision Lock (Overwrites V1 Sequencing)

1. **Durability-first order is mandatory:** automated backups, restore validation, and offsite immutability ship before Notion mirror.
2. **Notion is a secondary replica, not source of truth:** PostgreSQL + signed immutable backups remain recovery authority.
3. **Pre-migration backup is fail-closed by default:** deployment stops if safety backup fails (break-glass override only).
4. **No in-process primary scheduler in API workers:** scheduled backup jobs run in a dedicated worker/cron process with single-run safety.
5. **No phase close without restore proof:** each backup phase requires automated restore verification and measurable SLO reporting.

## Implementation Defaults (Recommended)

1. **Backup worker orchestration:** use existing `rq` + `redis` stack already in `backend/requirements.txt`, with a dedicated worker process. Use platform cron (or equivalent) only to enqueue jobs, not to run backup logic inline in the API process.
2. **Notion integration SDK:** `notion-client` (Python) for API calls and typed payload handling.
3. **R2 integration SDK:** `boto3` using S3-compatible API configuration.
4. **Backup manifest signing default:** for this single-user system, default to HMAC-signed manifests with key rotation and key IDs. Revisit asymmetric signing only if independent external verification/compliance requires separation of signing and verification keys.

---

## Why This Plan Exists

The system contains irreplaceable PhD research data across many relational entities (`notes`, `thinkers`, `connections`, publications, AI artifacts, quiz history, etc.). Current backup safety is manual export/import only, and restore flow is full destructive replace.

Current evidence in code:

1. Manual export/import endpoints are present in `backend/app/routes/backup.py:185` and `backend/app/routes/backup.py:300`.
2. Import performs full table wipe before insert in `backend/app/routes/backup.py:342`.
3. Deployment currently runs migrations with no pre-migration backup guard in `backend/start.sh:4`.
4. Runtime process model is web-only (`backend/Procfile`).

---

## Non-Negotiable Principles

1. Primary DB is system of record.
2. Every scheduled backup must be independently restorable.
3. Restore confidence is measured, not assumed.
4. At least one immutable offsite copy must exist.
5. Destructive operations require stronger authorization and audit trails.
6. External mirrors (Notion, Drive, OneDrive) are convenience/collaboration layers unless explicitly promoted after SLO evidence.

---

## Target Reliability Objectives

1. **RPO:** <= 15 minutes after Phase 2; <= 6 hours minimum in Phase 1.
2. **RTO:** <= 30 minutes for full restore in isolated environment.
3. **Restore Validation Pass Rate:** >= 99% on daily automated restore checks.
4. **Integrity:** 100% of backup artifacts include checksum + signature manifest before restore acceptance.

---

## Scope

### In Scope

1. Automated backup orchestration and retention.
2. Offsite cloud backup with immutability controls.
3. Restore verification workflows and operational status endpoints.
4. ChromaDB recovery from canonical SQL embeddings data.
5. Notion notes mirror with one-way, idempotent sync.
6. Local read-only resilience cache for notes.
7. CI/CD safety gates for backup and deploy risk.
8. Security hardening for backup/auth/sync surfaces.

### Out of Scope (for this plan)

1. Promoting Notion (or any third-party SaaS) to source-of-truth.
2. Full offline-first writable mode in browser.
3. Unbounded bidirectional sync before drift/conflict SLOs are proven.

---

## Architecture Summary

### Data Protection Layers

1. **Layer A:** PostgreSQL primary store.
2. **Layer B:** Automated signed local backup artifacts.
3. **Layer C:** Offsite object storage copy (R2) with retention lock/WORM controls.
4. **Layer D:** Restore test environment and verification artifacts.
5. **Layer E:** Notion one-way notes mirror (secondary replica).
6. **Layer F:** Browser IndexedDB read-only cache for emergency export.

### Control-Plane Requirements

1. Centralized `backup_runs` + `backup_artifacts` metadata.
2. Deterministic retention policy execution.
3. Per-run integrity hash and signed manifest.
4. Alertable status API for UI/CI.
5. Explicit admin/operator boundaries for destructive routes.

---

## Execution Order (V2)

| Phase | Timeline | Outcome |
|---|---|---|
| 0 | 0-5 days | Emergency durability guardrails + deploy safety (staging-first) |
| 1 | Week 1 | Automated backups + verification + retention |
| 2 | Week 2 | Offsite immutable cloud copy + restore drills |
| 3 | Week 2-3 | Notion one-way mirror (notes only) |
| 4 | Week 3 | Local resilience UX (read-only cache/export) |
| 5 | Week 3-4 | CI/CD security and deployment hardening |
| 6 | Week 4+ | Auth/rate-limit/observability hardening |

---

## Phase 0: Immediate Safeguards (0-5 Days, Staging First)

### Outcomes

1. Remove fail-open deployment risk.
2. Add emergency backup runbook and one-click trigger.
3. Protect destructive backup/import paths with stricter auth and auditing.

### Implementation

1. Add pre-migration backup command invoked by `start.sh` before `alembic upgrade head`.
2. Make pre-migration backup failure block deploy by default.
3. Add break-glass env flag `ALLOW_MIGRATION_WITHOUT_BACKUP=false` override path for incident-only use.
4. Add audit logging for backup export/import/restore trigger routes.
5. Roll out fail-closed behavior in staging first:
   - run at least one migration-including staging deployment
   - validate normal deploy and backup-failure path behavior
   - promote to production only after staging sign-off.

### Files (initial target)

1. `backend/start.sh`
2. `backend/app/routes/backup.py`
3. `backend/app/main.py`
4. `backend/.env.example`

### Acceptance Gates

1. Deploy pipeline blocks when pre-migration backup fails (unless break-glass flag set).
2. Every manual import/export emits structured audit log event.
3. Staging validation checklist is completed before production enablement.

---

## Phase 1: Automated Backup Core (Week 1)

### Outcomes

1. Scheduled backup generation runs without manual UI action.
2. Backup artifacts have integrity metadata.
3. Daily automated restore smoke test is available.

### Design

1. Introduce a dedicated backup worker entrypoint (not API in-process scheduler).
2. Generate JSON logical backup artifacts using current export envelope, then add:
   - file checksum (SHA-256)
   - signed manifest (HMAC default for v1; asymmetric optional later)
   - backup run metadata in DB
3. Retention policy baseline:
   - last 7 daily
   - last 4 weekly
   - last 6 monthly
4. New endpoints:
   - `GET /api/backup/status`
   - `POST /api/backup/trigger`
   - `GET /api/backup/verify`
   - `POST /api/backup/reindex-chroma`

### Schema Additions

1. `backup_runs`
2. `backup_artifacts`
3. `restore_validation_runs`

### Files (target)

1. `backend/app/services/backup_jobs.py` (new)
2. `backend/app/services/backup_manifest.py` (new)
3. `backend/app/services/chroma_reindex.py` (new)
4. `backend/app/routes/backup.py` (modify)
5. `backend/app/models/backup.py` (new)
6. `backend/app/models/__init__.py` (modify)
7. `backend/alembic/versions/*_add_backup_tables.py` (new)
8. `backend/.env.example` (modify)
9. `backend/requirements.txt` (no new dependency required for queue if using existing `rq`/`redis`)

### Acceptance Gates

1. Scheduled jobs run from dedicated worker/cron without duplicate execution.
2. Verify endpoint fails when checksum/signature mismatch is introduced.
3. Restore smoke test succeeds on a fresh isolated database.
4. `reindex-chroma` rebuilds `./backend/data/chroma/` from canonical `note_embeddings` data.

---

## Phase 2: Offsite Immutable Copy + Recovery Drills (Week 2)

### Outcomes

1. Backups are copied off-machine to a separate trust boundary.
2. At least one immutable retention policy is active.
3. Recovery drills are automated and reported.

### Design

1. Add cloud storage abstraction:
   - `LocalFileBackend`
   - `R2Backend` (S3-compatible)
2. Push successful local artifacts to R2 and store cloud artifact metadata.
3. Enforce object lock/retention policy for backup prefix/bucket where supported.
4. Run scheduled restore drill to isolated DB and publish drill result.

### New/Updated Endpoints

1. `POST /api/backup/sync/push`
2. `GET /api/backup/sync/status`
3. `GET /api/backup/sync/list`
4. `POST /api/backup/restore/validate/{artifact_id}`

### Security Controls

1. Service credentials stored server-side only.
2. Separate operator auth for sync/restore endpoints.
3. Signed manifests required before restore acceptance.

### Files (target)

1. `backend/app/services/cloud_storage.py` (new)
2. `backend/app/services/restore_validator.py` (new)
3. `backend/app/routes/backup.py` (modify)
4. `backend/.env.example` (modify)
5. `backend/requirements.txt` (add `boto3`)

### Acceptance Gates

1. Offsite copy success rate >= 99% over 7 days.
2. Restore drill report includes elapsed time + row-count reconciliation.
3. Immutable retention policy verified in platform configuration.

---

## Phase 3: Notion One-Way Notes Mirror (Week 2-3)

### Outcomes

1. Research notes are mirrored to Notion for browsing/sharing.
2. Sync is idempotent, rate-limited, and drift-detectable.
3. Notion never becomes write-authoritative.

### Hard Constraints

1. One-way sync only (`Stephane-Thinkers -> Notion`) in v1.
2. No read-back writes from Notion into canonical tables.
3. Notion API constraints respected (3 req/s average + payload limits).

### Design

1. New service: `backend/app/services/notion_sync.py`.
2. Dedicated Notion root/data source for notes mirror.
3. Mapping tables:
   - `notion_sync_map` (`local_id`, `entity_type`, `notion_page_id`, `last_synced_at`)
   - `sync_jobs` (`job_id`, `entity_version`, `idempotency_key`, `status`, `error`)
4. Sync modes:
   - setup
   - full sync
   - incremental sync by update cursor
5. Drift control:
   - periodic reconciliation scan using checksum/version markers
   - repair queue for mismatches

### API Endpoints

1. `POST /api/notion/setup`
2. `POST /api/notion/sync`
3. `POST /api/notion/full-sync`
4. `GET /api/notion/status`

### Security Controls

1. Use integration token from env only (never browser storage).
2. Limit Notion capabilities to minimum needed.
3. Track and alert sync failures and backlog age.

### Files (target)

1. `backend/app/services/notion_sync.py` (new)
2. `backend/app/routes/notion.py` (new)
3. `backend/app/models/notion_sync.py` (new)
4. `backend/app/models/__init__.py` (modify)
5. `backend/app/main.py` (modify)
6. `backend/alembic/versions/*_add_notion_sync_tables.py` (new)
7. `backend/.env.example` (modify)
8. `backend/requirements.txt` (add `notion-client`)
9. `frontend/src/components/SettingsModal.tsx` (modify)
10. `frontend/src/lib/api.ts` (modify)
11. `frontend/src/types/index.ts` (modify)

### Acceptance Gates

1. Full sync creates/upserts notes without duplicates.
2. Incremental sync updates only changed notes.
3. Rate-limit handling validated against simulated 429 responses.
4. Drift reconciliation detects and repairs intentionally introduced mismatch.

---

## Phase 4: Local Resilience UX (Week 3)

### Outcomes

1. Users can export locally cached notes from IndexedDB for emergency access.
2. UI shows backup and sync health status clearly.

### Constraints

1. IndexedDB cache is read-only safety net.
2. Browser cache is never authoritative for canonical restore.

### Files (target)

1. `frontend/src/lib/noteCache.ts` (new)
2. `frontend/src/lib/api.ts` (modify)
3. `frontend/src/components/SettingsModal.tsx` (modify)
4. `frontend/src/types/index.ts` (modify)
5. `frontend/package.json` (modify)

### Acceptance Gates

1. Local cache export works during simulated backend outage.
2. UI surfaces backup staleness and last successful cloud sync.

---

## Phase 5: CI/CD Hardening (Week 3-4)

### Outcomes

1. Deploy path enforces backup freshness checks.
2. Supply-chain scanning and secret scanning are enabled.

### Work Items

1. Add `deploy-safety` workflow gate:
   - trigger pre-deploy backup run
   - verify latest successful backup age below threshold
2. Add dependency/security workflows:
   - Dependabot config
   - CodeQL
   - secret scanning workflow
3. Harden existing workflow permissions and pin actions by commit SHA.

### Files (target)

1. `.github/workflows/deploy-safety.yml` (new)
2. `.github/dependabot.yml` (new)
3. `.github/workflows/codeql.yml` (new)
4. `.github/workflows/secret-scan.yml` (new)
5. `.github/workflows/e2e-tests.yml` (modify)

### Acceptance Gates

1. Deploy job fails when backup freshness precondition is not met.
2. Workflows run with explicit least-privilege permissions.
3. Third-party actions pinned to full SHA.

---

## Phase 6: Security and Ops Hardening (Week 4+)

### Outcomes

1. Abuse resistance and observability for backup/sync/auth flows.
2. Faster incident detection and triage.

### Work Items

1. Add route-class rate limits (auth, backup, AI, CRUD).
2. Add structured JSON logging with correlation IDs.
3. Add Sentry integration with environment-based enablement.
4. Tighten CORS allow headers/expose headers to explicit lists.
5. Add admin-only authorization layer for destructive backup operations.

### Files (target)

1. `backend/app/main.py` (modify)
2. `backend/app/logging_config.py` (new)
3. `backend/app/routes/backup.py` (modify)
4. `backend/.env.example` (modify)

### Acceptance Gates

1. Rate limits enforced and tested for backup and auth routes.
2. Error telemetry received in staging with redaction checks.
3. CORS policy uses explicit lists, not wildcard headers.

---

## Vetting Checklist (Approval Gate Before Build)

1. RPO/RTO targets confirmed and signed off.
2. Backup authority model agreed: PostgreSQL + signed immutable artifacts.
3. Notion role confirmed as secondary mirror only.
4. Deployment fail-closed behavior approved for pre-migration backup.
5. Credential ownership and rotation model documented.
6. Restore drill cadence and alert ownership assigned.

---

## Test Strategy

### Automated Tests

1. Backup generation, manifest signing, checksum validation.
2. Retention and pruning correctness.
3. Restore validation into isolated DB.
4. Chroma reindex rebuild correctness from `note_embeddings`.
5. Cloud storage push/list/pull contract tests.
6. Notion sync idempotency, retry/backoff, and cursor behavior.
7. UI tests for backup status, Notion status, and local export.

### Manual Drills

1. Disaster simulation: restore from offsite artifact to clean DB.
2. Migration safety drill: ensure deployment blocks when backup step fails.
3. Notion mirror drift simulation and repair.

---

## Risks and Mitigations

1. **Risk:** Duplicate scheduler runs in scaled web deployments.
   - **Mitigation:** dedicated worker/cron process and distributed lock.
2. **Risk:** False confidence from untested backups.
   - **Mitigation:** daily restore validation + weekly timed drill.
3. **Risk:** Sync drift in external mirrors.
   - **Mitigation:** idempotency keys + periodic reconciliation scans.
4. **Risk:** Destructive restore misuse.
   - **Mitigation:** admin-only auth + dry-run validation + audit logs.

---

## Open Decisions (Blockers)

1. Final RPO and RTO numeric targets (minutes).
2. R2 retention mode selection (governance vs compliance lock).
3. Whether to require asymmetric manifest signing now, or accept recommended v1 default (HMAC + rotation + key IDs) and defer asymmetric to a later compliance phase.
4. Whether Notion full-sync endpoint remains operator-only or also exposed in UI.

---

## Definition of Done

Plan 11 is complete only when:

1. Automated backups run on schedule and are visible in status APIs.
2. Offsite immutable copy is active and verified.
3. Restore drill automation is green for at least 7 consecutive days.
4. Notion one-way mirror is live with low drift and idempotent upserts.
5. Pre-deploy and pre-migration backup safety gates are enforced.
6. Operational dashboarding/alerts exist for backup failure, restore failure, and sync backlog.
