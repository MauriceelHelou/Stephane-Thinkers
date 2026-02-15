# Security Best Practices Report

Date: 2026-02-14
Project: Stephane-Thinkers
Scope: Data-loss prevention, CI/CD hardening, backup and recovery, external storage integrations (Google Drive / OneDrive), local data storage strategy.

## Executive Summary
You currently have strong foundations (auth dependency applied across routers, explicit backup export/import endpoints, migration-based startup), but the system is not yet designed for zero-data-loss operations. The highest-risk gaps are: (1) no automated immutable backup pipeline with tested restore SLAs, (2) destructive data paths without safety rails, and (3) CI/CD supply-chain controls that are not hardened to modern standards. If an operator error, account compromise, or ransomware-style event occurs, recovery success depends too heavily on manual steps.

This report gives a defense-in-depth architecture aimed at practical "cannot lose data" operations, including RPO/RTO targets, immutable multi-copy backups, cryptographic backup integrity, CI/CD hardening, and reliable sync patterns for OneDrive/Google Drive.

## Evidence-Based System Inventory

### Runtime and data surfaces
- FastAPI backend with auth dependency on protected routers: `backend/app/main.py:78`, `backend/app/main.py:100`
- Token-based auth (HMAC-signed custom token): `backend/app/security.py:73`, `backend/app/security.py:103`
- Backup endpoints support full export/import and full replacement on import: `backend/app/routes/backup.py:185`, `backend/app/routes/backup.py:299`, `backend/app/routes/backup.py:342`
- Manual backup/restore UI in settings tab (human-triggered): `frontend/src/components/SettingsModal.tsx:323`, `frontend/src/components/SettingsModal.tsx:339`, `frontend/src/components/SettingsModal.tsx:413`
- Database connection supports SQLite and PostgreSQL via `DATABASE_URL`: `backend/app/database.py:10`, `backend/app/database.py:24`
- Deployment startup always runs migrations before app boot: `backend/start.sh:4`
- Railway deployment docs expect Postgres in production: `RAILWAY_DEPLOY_STEPS.md:54`, `RAILWAY_DEPLOY_STEPS.md:74`

### CI/CD surfaces
- Single main workflow with many third-party actions and no explicit workflow/job `permissions`: `.github/workflows/e2e-tests.yml:1`
- Actions pinned by major tags (`@v4`, `@v5`) not commit SHAs: `.github/workflows/e2e-tests.yml:31`, `.github/workflows/e2e-tests.yml:63`, `.github/workflows/e2e-tests.yml:115`
- GitHub Pages publish step uses `GITHUB_TOKEN`: `.github/workflows/e2e-tests.yml:308`, `.github/workflows/e2e-tests.yml:312`

### Destructive data operations in app paths
- Hard delete note endpoint: `backend/app/routes/notes.py:388`
- Hard delete thinker endpoint: `backend/app/routes/thinkers.py:84`
- Hard delete timeline endpoint: `backend/app/routes/timelines.py:78`
- Folder delete with reassignment behavior (still destructive for folder object): `backend/app/routes/folders.py:330`

## Critical Findings

### CR-001: No automated, immutable, independently verifiable backup pipeline
Impact: Catastrophic data loss risk from operator error, compromise, ransomware, or cloud account failure.

What exists:
- Manual JSON export/import endpoint and UI (`backup.py`, `SettingsModal`).
- No evidence of scheduled backup jobs, immutable retention, cross-account copy, or restore drills.

Why this is critical:
- Manual backup systems fail under pressure and are easy to forget.
- Current design does not guarantee point-in-time recovery (PITR) or provable backup freshness.
- "Cannot lose data" requires automated and testable controls, not only ad hoc export.

### CR-002: Restore path is full destructive replace and backup authenticity is not cryptographically enforced
Impact: Malicious or corrupted backup files can replace all data; operator can perform irreversible destructive import.

Evidence:
- Import deletes all data then inserts backup (`backend/app/routes/backup.py:342`, `backend/app/routes/backup.py:347`).
- Backup format/version checks exist but no signature/MAC check (`backend/app/routes/backup.py:326`, `backend/app/routes/backup.py:332`).

Why this is critical:
- Version checks protect compatibility, not integrity/authenticity.
- A tampered JSON backup can poison or erase trusted state.

### CR-003: Core entities use hard delete without safety net for accidental deletion
Impact: Human or attacker with valid auth can permanently remove core records.

Evidence:
- Hard delete endpoints for notes/thinkers/timelines (`notes.py:388`, `thinkers.py:84`, `timelines.py:78`).
- Thinker model cascades related records (`backend/app/models/thinker.py:28`, `backend/app/models/thinker.py:34`).

Why this is critical:
- No recycle bin / soft-delete window means some incidents require full restore instead of surgical rollback.
- Increases blast radius and operational downtime.

### CR-004: CI/CD workflow lacks modern supply-chain hardening controls
Impact: Compromise in action dependency or workflow permissions can lead to secret leakage, repo tampering, or malicious release artifact.

Evidence:
- No explicit `permissions:` scope in workflow file.
- Third-party actions not pinned to full commit SHA.

Why this is critical:
- GitHub explicitly states major risk from compromised third-party actions and recommends pinning to full SHA and least-privileged token permissions.

## High Findings

### HI-005: Auth model is shared password based, with no visible login rate limiting or lockout
Evidence:
- Shared site password login (`backend/app/routes/auth.py:24`, `backend/app/routes/auth.py:37`).
- No route-level rate-limit enforcement observed around login.

Risk:
- Brute force and credential sharing risks.
- Compromised password enables destructive API operations.

### HI-006: External local AI storage can become a backup scope gap if relied on
Evidence:
- Chroma persistent path: `backend/app/services/notes_ai/discovery.py:21`.
- `.gitignore` excludes local data paths: `.gitignore:54`.

Risk:
- If semantics become business-critical, data may be missed by DB-only backup designs.

### HI-007: Browser-stored auth token is accessible to script context
Evidence:
- Auth token in sessionStorage: `frontend/src/components/LoginScreen.tsx:23`, `frontend/src/lib/api.ts:166`.

Risk:
- XSS anywhere in frontend could exfiltrate active token.

### HI-008: Railway volume operations have caveats relevant to DR assumptions
Evidence from provider docs:
- Wiping a volume deletes all backups; restores are same project+environment only.

Risk:
- Must not treat single-platform volume snapshots as sole DR strategy.

## Threat and Data-Loss Abuse Paths

1. CI action compromise -> token/secrets misuse -> destructive API call or malicious migration -> data corruption.
2. Operator imports wrong/corrupt backup -> full table wipe -> integrity loss.
3. Ransomware/credential theft in cloud account -> volume wipe plus backup wipe in same trust boundary.
4. Hard-delete of key records (or cascade) -> no soft-delete recovery path -> restore whole database required.
5. Browser compromise/XSS -> token theft -> attacker deletes timelines/notes.
6. Sync integration bug (Drive/OneDrive) without delta/idempotency -> duplicate or missing updates -> silent drift.
7. Local-first notes in browser storage only -> storage eviction or user clear-data -> permanent note loss.
8. Notion webhook/order semantics misunderstood -> stale or conflicting writes -> silent data divergence.

## Target Security Architecture for "Cannot Lose Data"

### 1) Database resilience baseline
- Production DB: PostgreSQL only (no SQLite for prod writes).
- RPO target: <= 5 minutes.
- RTO target: <= 30 minutes for full service, <= 10 minutes for read-only recovery mode.
- Use WAL archiving + regular base backups for PITR.
- Keep regular logical backups (`pg_dump`) for portability and schema-audit use.

### 2) Backup strategy: 3-2-1 + immutability
- 3 copies: primary DB + backup account A + backup account B.
- 2 media/locations: managed DB snapshots + object storage archives.
- 1 offline/immutable: object lock / WORM retention bucket.
- Encrypt all backups with KMS-managed keys.
- Store backup manifests with hash chain + detached signatures.

### 3) Restore strategy (must be tested, not assumed)
- Daily automated restore validation to isolated environment.
- Weekly PITR drill to random timestamp.
- Monthly "disaster day" simulation with documented timer against RTO.
- Produce machine-readable restore report (success/failure + elapsed + row-count reconciliation).

### 4) Application data safety rails
- Introduce soft-delete for high-value entities (`notes`, `thinkers`, `timelines`) with retention window (e.g., 30 days).
- Add "two-step destructive operations" for admin-level bulk operations.
- Add backup import safety:
  - signature verification required
  - schema hash and table count sanity checks
  - dry-run mode with diff summary before commit
  - role-restricted import endpoint

### 5) CI/CD hardening
- Set explicit least-privilege `permissions` at workflow and job level.
- Pin all actions to full commit SHA.
- Restrict workflow triggers for untrusted contexts.
- Use OIDC federation for cloud access instead of long-lived cloud secrets.
- Add artifact attestations/provenance verification on release path.
- Add dependency and secret scanning gates.

### 6) External holders (Google Drive / OneDrive) secure integration pattern
- Use least privilege scopes only.
  - Google: prefer `drive.file` and `drive.appdata` where possible.
  - Microsoft: prefer app-folder/user-scoped permissions over tenant-wide scopes unless required.
- Store refresh tokens encrypted server-side only (KMS/HSM-backed); never in browser storage.
- Use resumable upload APIs with checksum/etag preconditions.
- Use change tracking (Google `changes` tokens; Graph `delta` tokens) for reliable sync.
- Maintain idempotency key + operation log to recover from partial failures.
- Keep conflict policy explicit (`fail` default, or controlled `rename/replace`), never implicit overwrite.

### 6b) Notion API integration pattern (recommended as replica/collaboration layer, not primary durability layer)
- Treat Notion as a searchable/collaborative secondary copy, not system-of-record for critical recovery.
- Keep PostgreSQL + immutable object-storage backups as recovery authority.
- Design one-way sync first (`Stephane-Thinkers` -> Notion) before considering bidirectional edits.
- Build an outbox + sync ledger:
  - `sync_jobs` table with idempotency key, source entity/version, target page ID, checksum, status, retry count.
  - deterministic payload hashing to prevent duplicate upserts.
- Respect API limits by construction:
  - global integration rate limiter under Notion's average 3 req/s guidance
  - request chunking for 500KB payload cap and block/rich_text limits.
- Use dedicated Notion root page/data source; never let integration roam full workspace.
- Enforce capability minimization:
  - start with `read content`, `insert content`, `update content` only
  - avoid extra capabilities unless explicitly required.
- Webhook handling hardening:
  - verify `X-Notion-Signature` HMAC using the webhook `verification_token`
  - treat delivery as at-least-once and potentially out-of-order
  - support retries (Notion retries failed deliveries up to 8 times) and duplicate suppression.
  - store processed webhook event IDs + timestamps to prevent replay/duplicate side effects.
- Reconciliation control loop:
  - periodic full consistency scan (e.g., every 6-12 hours)
  - compare checksum/version markers between local and Notion copies
  - queue repair jobs for drift.
- Backup posture note:
  - Notion documentation mentions internal backups and backup export, but published recovery characteristics should not replace your own immutable backup SLOs for "cannot lose data".

### 7) Local-first notes architecture (if you choose to support it)
- Do not use `localStorage` as source-of-truth for critical notes.
- Use IndexedDB + `navigator.storage.persist()` for offline cache only.
- Keep server as source of truth with append-only operation log.
- Encrypt local cache at rest (device keychain-bound key where possible).
- Run periodic background sync and explicit reconciliation checks.
- Provide user-visible "sync health" and "last durable backup timestamp" indicators.

## Prioritized Roadmap

### Phase 0 (0-72 hours)
1. Freeze high-risk destructive operations behind admin flag.
2. Add emergency manual full backup runbook and execute immediate full backup.
3. Lock CI token permissions to read-only baseline and disable unnecessary write scopes.
4. Rotate credentials/secrets if any uncertainty about exposure.

### Phase 1 (Week 1)
1. Implement scheduled Postgres backup jobs (logical + base/WAL architecture).
2. Add immutable object storage retention policy for backup archives.
3. Add automated restore smoke test (daily).
4. Enforce action SHA pinning in workflows.

### Phase 2 (Weeks 2-4)
1. Implement signed backup manifests and verify-on-restore.
2. Add soft-delete and restore endpoints for critical entities.
3. Add login rate limiting + suspicious auth telemetry.
4. Add CI supply-chain controls (attestation, dependency scanning, secret scanning).
5. Build Notion one-way sync pilot with outbox, idempotency, and drift monitoring.

### Phase 3 (Month 2+)
1. Implement full PITR drills and game-day exercises.
2. Integrate OneDrive/Google Drive via delta-based sync and resumable uploads.
3. Add Notion bidirectional sync only if conflict policy + reconciliation metrics are proven.
4. Add local-first cache safely (IndexedDB + durable sync), if required.
5. Add compliance-grade audit trail for all data-destructive actions.

## Operational Controls and SLOs
- Backup freshness SLO: latest successful backup <= 15 minutes old.
- Restore confidence SLO: >= 99% daily restore validation pass rate.
- Recovery SLO: quarterly full-failure drill within target RTO.
- Integrity SLO: 100% backup artifacts signed and verified before restore.
- Alerting:
  - backup job failure
  - restore drill failure
  - abnormal delete volume
  - auth brute-force pattern
  - sync drift between primary and external holders
  - Notion sync lag backlog and repeated webhook signature failures

## Source-Mapped Recommendations (Primary Sources)

### GitHub Actions / CI security
- Secure use reference (pin action SHAs, third-party action risk):
  - https://docs.github.com/en/actions/reference/security/secure-use
- Least-privilege `GITHUB_TOKEN` permissions:
  - https://docs.github.com/en/actions/tutorials/authenticate-with-github_token
- OIDC for short-lived credentials (no long-lived cloud secrets):
  - https://docs.github.com/en/actions/concepts/security/about-security-hardening-with-openid-connect
  - https://docs.github.com/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-cloud-providers

### PostgreSQL and SQLite backup/recovery
- PostgreSQL SQL dumps (`pg_dump`) snapshot consistency and restore:
  - https://www.postgresql.org/docs/current/backup-dump.html
- PostgreSQL PITR and WAL archiving:
  - https://www.postgresql.org/docs/current/continuous-archiving.html
- PostgreSQL `pg_basebackup` for base backup + replication workflows:
  - https://www.postgresql.org/docs/current/app-pgbasebackup.html
- SQLite online backup/WAL behavior:
  - https://www.sqlite.org/backup.html
  - https://www.sqlite.org/wal.html

### Railway data/backup behavior
- Railway volume backups, schedule and caveats:
  - https://docs.railway.com/volumes/backups
- Railway volume persistence caveats:
  - https://docs.railway.com/volumes/reference
- Railway Postgres guide:
  - https://docs.railway.com/guides/postgresql

### Google Drive integration security and reliability
- Scope minimization and `drive.file` guidance:
  - https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- App-specific hidden storage (`appDataFolder`) constraints:
  - https://developers.google.com/workspace/drive/api/guides/appdata
- Incremental change tracking with start page token:
  - https://developers.google.com/workspace/drive/api/guides/manage-changes

### OneDrive/Microsoft Graph integration security and reliability
- Graph permissions (scope minimization, app-folder vs broad scopes):
  - https://learn.microsoft.com/en-us/graph/permissions-reference
- Large-file resumable uploads, sequential ranges, conflict behavior, preconditions:
  - https://learn.microsoft.com/en-us/graph/api/driveitem-createuploadsession?view=graph-rest-1.0
- Small-file upload limits:
  - https://learn.microsoft.com/en-us/graph/api/driveitem-put-content?view=graph-rest-1.0
- Identity app registration hardening (prefer certificates/managed identity over secrets):
  - https://learn.microsoft.com/en-us/entra/identity-platform/security-best-practices-for-app-registration
- Delta query for change tracking sync:
  - https://learn.microsoft.com/en-us/graph/delta-query-overview

### Notion integration security and reliability
- Notion API capabilities (least-privilege model):
  - https://developers.notion.com/reference/capabilities
- Public OAuth flow and token refresh (`expires_in`, refresh token exchange):
  - https://developers.notion.com/docs/authorization
- Request limits (average 3 req/s), payload and object size limits:
  - https://developers.notion.com/reference/request-limits
- Webhook verification and delivery behavior:
  - https://developers.notion.com/reference/webhooks
  - https://developers.notion.com/reference/webhook-event-types-and-delivery
- Integration setup and sharing boundaries:
  - https://developers.notion.com/docs/create-a-notion-integration
  - https://developers.notion.com/docs/create-a-notion-integration#share-a-page-with-your-integration
- Versioning/deprecation risk (database -> data source migration notice):
  - https://developers.notion.com/docs/working-with-databases
  - https://developers.notion.com/docs/upgrade-guide-to-2025-09-03
- Backup/export and recovery expectations:
  - https://www.notion.com/help/back-up-your-data
  - https://www.notion.com/help/security-and-privacy

### Immutable backup storage patterns
- AWS S3 Object Lock (WORM, compliance/governance):
  - https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html
- Google Cloud Object Retention Lock / Bucket lock:
  - https://cloud.google.com/storage/docs/object-lock
  - https://cloud.google.com/storage/docs/using-bucket-lock
- Azure immutable blob storage (WORM):
  - https://learn.microsoft.com/en-us/azure/storage/blobs/immutable-storage-overview

### Recovery and resilience guidance
- NIST contingency planning:
  - https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final
- NIST CSF 2.0:
  - https://www.nist.gov/publications/nist-cybersecurity-framework-csf-20
- CISA ransomware guidance and backup best practices:
  - https://www.cisa.gov/stopransomware/ransomware-guide
  - https://www.cisa.gov/back-business-data

### Browser local storage persistence/eviction limits
- localStorage persistence and private browsing behavior:
  - https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
- Storage quotas, best-effort eviction, persistent storage API:
  - https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria

## Open Questions That Materially Affect Design
1. Is production today on Railway Postgres only, or any active SQLite write path in production-like environments?
2. What are your mandatory RPO/RTO targets (in minutes) for this system?
3. Do you require tenant-level integration for Google Drive/OneDrive, or only user-consented per-file/app-folder access?
4. Are you willing to adopt immutable object storage with retention lock that even admins cannot shorten?
5. Should Notion be one-way publish only, or true bidirectional sync with end-user edits in Notion?

## Final Assessment
You can reach a practical "cannot lose data" posture, but only if backup, restore, and CI/CD are treated as production product features with testable SLOs. The current codebase is close enough architecturally to implement this in phases without large rewrites.
