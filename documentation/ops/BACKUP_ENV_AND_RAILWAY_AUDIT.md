# Backup + Env + Railway Audit

Last audited: 2026-02-15

## 1) What Is Already Wired

The repo already has a substantial backup/durability implementation:

- Pre-migration fail-closed safety backup in `backend/start.sh` + `backend/pre_migration_backup.py`.
- Manual full export/import endpoints in `backend/app/routes/backup.py`.
- Automated backup runs with metadata tables (`backup_runs`, `backup_artifacts`, `restore_validation_runs`) in:
  - `backend/app/models/backup.py`
  - `backend/alembic/versions/a1b2c3d4e5f7_add_backup_tables.py`
- Signed manifests and checksum verification in:
  - `backend/app/services/backup_manifest.py`
  - `backend/app/routes/backup.py` (`/api/backup/verify`)
- Retention policy enforcement in `backend/app/services/backup_jobs.py`.
- Offsite sync abstraction (`local` and Cloudflare R2) in `backend/app/services/cloud_storage.py`.
- Restore drill endpoint in `backend/app/services/restore_validator.py` and `/api/backup/restore/validate/{artifact_id}`.
- Scheduled entrypoints:
  - `backend/run_scheduled_backup.py`
  - `backend/run_scheduled_notion_sync.py`
- Queue wiring (Redis + RQ) in `backend/app/utils/queue.py` and `backend/Procfile`.

## 2) Minimum Env Sets

## 2.1 Backend: minimum to boot

Required:

- `DATABASE_URL`
- `FRONTEND_URL`
- `SITE_PASSWORD` (unless `AUTH_REQUIRED=false`)

Strongly recommended:

- `ENVIRONMENT=production` in production
- `AUTH_TOKEN_SECRET`
- `AUTH_TOKEN_TTL_SECONDS`

## 2.2 Backend: minimum for automated backups

Required for signed automated backups:

- `BACKUP_SIGNING_SECRET`
- `BACKUP_SIGNING_KEY_ID` (default `v1` is fine)

Recommended:

- `BACKUP_DIR`
- `PRE_MIGRATION_BACKUP_DIR`
- `BACKUP_RETENTION_DAILY`
- `BACKUP_RETENTION_WEEKLY`
- `BACKUP_RETENTION_MONTHLY`
- `BACKUP_OPERATOR_TOKEN` (extra protection for sensitive backup routes)

For key rotation support:

- `BACKUP_SIGNING_SECRETS` (key ring, e.g. `v1:...,v2:...`)

## 2.3 Backend: offsite cloud backup (R2)

Set:

- `BACKUP_CLOUD_BACKEND=r2`
- `R2_ENDPOINT_URL`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`

## 2.4 Backend: queue + async jobs (recommended for prod, required for timeline bootstrap routes)

- `RQ_ENABLED=true`
- `REDIS_URL`
- `RQ_QUEUE_NAME=notes_ai`
- `RQ_BACKUP_QUEUE_NAME=backup_jobs`
- `RQ_NOTION_QUEUE_NAME=notion_jobs`

Note: `/api/ingestion/text-to-timeline/*` enforces queue mode outside dev/test.

## 2.5 Backend: optional APIs

AI:

- `DEEPSEEK_API_KEY`
- `DEEPSEEK_BASE_URL` (default works)
- `DEEPSEEK_MODEL` (default works)
- `OPENAI_API_KEY` (for embeddings stack)
- `OPENAI_EMBEDDING_MODEL`
- `NOTES_AI_USE_EXTERNAL_EMBEDDINGS`

Notion mirror:

- `NOTION_INTEGRATION_TOKEN`
- `NOTION_NOTES_DATABASE_ID` (or set via `/api/notion/setup` with `NOTION_PARENT_PAGE_ID`)
- `NOTION_PARENT_PAGE_ID` (for setup flow)
- `NOTION_RATE_LIMIT_RPS`
- `NOTION_AUTO_SYNC_ENABLED`
- `NOTION_AUTO_SYNC_INTERVAL_MINUTES`
- `NOTION_AUTO_SYNC_STALE_JOB_MINUTES`
- `NOTION_OPERATOR_TOKEN` (recommended)

Ops hardening:

- `RATE_LIMIT_AUTH`
- `RATE_LIMIT_BACKUP`
- `RATE_LIMIT_AI`
- `RATE_LIMIT_NOTION`
- `RATE_LIMIT_DEFAULT`
- `RATE_LIMIT_ENABLED` (to force enable in dev)
- `SENTRY_DSN`
- `SENTRY_TRACES_SAMPLE_RATE`
- `LOG_LEVEL`

## 2.6 Frontend env

Required:

- `NEXT_PUBLIC_API_URL`

Notes AI flags (optional, default `true`):

- `NEXT_PUBLIC_FEATURE_NOTES_AI_PHASE_A`
- `NEXT_PUBLIC_FEATURE_NOTES_AI_PHASE_B`
- `NEXT_PUBLIC_FEATURE_NOTES_AI_PHASE_C`
- `NEXT_PUBLIC_FEATURE_NOTES_AI_PHASE_D`
- `NEXT_PUBLIC_FEATURE_NOTES_AI_PHASE_E`
- `NEXT_PUBLIC_FEATURE_NOTES_AI_PHASE_F`
- `NEXT_PUBLIC_FEATURE_NOTES_AI_TIMELINE_BOOTSTRAP`

## 3) Railway Production Topology

Recommended services:

1. `backend-web` (root `backend`, start command `bash start.sh`)
2. `frontend-web` (root `frontend`)
3. `redis` service
4. `postgres` service
5. `backend-worker` (root `backend`, command: `python -m rq worker --url $REDIS_URL backup_jobs notion_jobs notes_ai`) when `RQ_ENABLED=true`

Important:

- Do not override backend start to bypass `start.sh`; `start.sh` contains the pre-migration backup gate.
- Attach a persistent volume to backend backup/chroma paths; default local paths are ephemeral on container restart.

## 4) Scheduler Caveat (Important)

Backup artifacts are written to local file paths and stored in DB metadata.

If scheduled backups run in a different service filesystem than the API service, API verification/sync endpoints may report missing local files.

Safe options:

- Trigger scheduled backups through the API on the same backend service that owns backup storage.
- Or ensure your storage model keeps artifacts accessible to the API service (for example, cloud-first flow plus compatible retrieval strategy).

## 5) Local Setup Profiles

## 5.1 Local minimal (core app)

- `DATABASE_URL=sqlite:///./intellectual_graph.db`
- `FRONTEND_URL=http://localhost:3010`
- `SITE_PASSWORD=...`

## 5.2 Local full backup testing

Add:

- `BACKUP_SIGNING_SECRET=...`
- `BACKUP_SIGNING_KEY_ID=v1`
- `BACKUP_DIR=./data/backups`
- `PRE_MIGRATION_BACKUP_DIR=./data/backups/pre-migration`
- `BACKUP_CLOUD_BACKEND=local`
- `BACKUP_CLOUD_LOCAL_DIR=./data/backups/offsite`

## 5.3 Local async/queue testing

Add:

- `RQ_ENABLED=true`
- `REDIS_URL=redis://localhost:6379/0`

Run worker:

```bash
cd backend
python -m rq worker --url "$REDIS_URL" backup_jobs notion_jobs notes_ai
```

## 5.4 Local Notion testing

Add:

- `NOTION_INTEGRATION_TOKEN=...`
- `NOTION_PARENT_PAGE_ID=...`

Then run setup once:

- `POST /api/notion/setup`

After setup, persist `NOTION_NOTES_DATABASE_ID`.

## 6) Immediate Production Checklist

- Set backend start to `bash start.sh` (or leave Railpack default from `backend/railpack.json`).
- Add and mount persistent storage for backup/chroma paths.
- Configure `BACKUP_SIGNING_SECRET` and rotation policy (`BACKUP_SIGNING_KEY_ID`, optional `BACKUP_SIGNING_SECRETS`).
- Configure offsite backend (`r2`) and credentials if you want durable off-service copies.
- Enable Redis + RQ for production async features.
- Add operator tokens (`BACKUP_OPERATOR_TOKEN`, `NOTION_OPERATOR_TOKEN`) for sensitive routes.
- Add scheduler strategy that does not break backup artifact locality.
