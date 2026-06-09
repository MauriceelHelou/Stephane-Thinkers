# Railway Deployment Steps (Railpack)

This version includes the backup/queue/ops requirements in addition to basic app deploy.

For a full environment matrix, see `documentation/ops/BACKUP_ENV_AND_RAILWAY_AUDIT.md`.

---

## Step 1: Create Railway Project + Data Services

1. Create an empty Railway project.
2. Add PostgreSQL.
3. Add Redis (required if you enable `RQ_ENABLED=true`).

---

## Step 2: Deploy `backend-web` Service

1. Add service from GitHub repo.
2. Set **Root Directory** to `backend`.
3. Start command should be:

```bash
bash start.sh
```

Important:

- Do not bypass `start.sh`; it contains pre-migration safety backup logic.
- Do not set `RAILWAY_RUN_COMMAND` to a direct `alembic && uvicorn` command unless you intentionally want to skip `start.sh`.

### Backend Variables (minimum production)

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
PORT=8010
ENVIRONMENT=production
FRONTEND_URL=https://<frontend-domain>
AUTH_REQUIRED=true
SITE_PASSWORD=<strong-password>
AUTH_TOKEN_SECRET=<strong-secret>
```

### Backend Variables (backup + durability)

```env
ALLOW_MIGRATION_WITHOUT_BACKUP=false
PRE_MIGRATION_BACKUP_DIR=/data/backups/pre-migration
BACKUP_DIR=/data/backups
BACKUP_SIGNING_SECRET=<strong-signing-secret>
BACKUP_SIGNING_KEY_ID=v1
BACKUP_RETENTION_DAILY=7
BACKUP_RETENTION_WEEKLY=4
BACKUP_RETENTION_MONTHLY=6
BACKUP_OPERATOR_TOKEN=<optional-extra-operator-token>
```

### Backend Volume

Attach a persistent volume and point backup paths to it (example above uses `/data/backups`).

---

## Step 3: Deploy `frontend-web` Service

1. Add second service from same repo.
2. Set **Root Directory** to `frontend`.

Set:

```env
NEXT_PUBLIC_API_URL=https://<backend-domain>
PORT=3000
```

If backend URL changes, redeploy frontend (`NEXT_PUBLIC_API_URL` is build-time).

---

## Step 4: Deploy `backend-worker` Service (for queue mode)

Create a third service from same repo (`backend` root) with command:

```bash
python -m rq worker --url $REDIS_URL backup_jobs notion_jobs notes_ai
```

Set on both `backend-web` and `backend-worker`:

```env
REDIS_URL=${{Redis.REDIS_URL}}
RQ_ENABLED=true
RQ_QUEUE_NAME=notes_ai
RQ_BACKUP_QUEUE_NAME=backup_jobs
RQ_NOTION_QUEUE_NAME=notion_jobs
```

---

## Step 5: Optional API Integrations

### AI

```env
DEEPSEEK_API_KEY=<key>
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
OPENAI_API_KEY=<key>
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

### Offsite backup to Cloudflare R2

```env
BACKUP_CLOUD_BACKEND=r2
R2_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<key>
R2_SECRET_ACCESS_KEY=<secret>
R2_BUCKET_NAME=<bucket-name>
```

### Notion mirror

```env
NOTION_INTEGRATION_TOKEN=<token>
NOTION_PARENT_PAGE_ID=<page-id>        # for setup
NOTION_NOTES_DATABASE_ID=<database-id> # after setup
NOTION_AUTO_SYNC_ENABLED=false
NOTION_AUTO_SYNC_INTERVAL_MINUTES=5
NOTION_AUTO_SYNC_STALE_JOB_MINUTES=30
NOTION_OPERATOR_TOKEN=<optional-extra-operator-token>
```

---

## Step 6: Scheduler Strategy

Current backup artifacts are file-path based. That means scheduler placement matters.

Recommendation:

- Schedule backup triggers against the backend API service that owns backup storage.
- If using separate scheduled services, ensure artifact storage remains accessible to API verification/sync routes.

`run_scheduled_backup.py` and `run_scheduled_notion_sync.py` exist, but verify storage locality before using them in separate services.

---

## Step 7: Verification

Backend health:

```bash
curl https://<backend-domain>/health
curl https://<backend-domain>/api/health
```

Auth check:

```bash
curl https://<backend-domain>/api/auth/check
```

Backup status (requires auth token):

```bash
curl -H "Authorization: Bearer <token>" \
  https://<backend-domain>/api/backup/status
```

---

## Troubleshooting

### Backend fails at startup

- Confirm `DATABASE_URL` is set from PostgreSQL plugin.
- Confirm start command is `bash start.sh`.
- Check logs for pre-migration backup failures and missing `BACKUP_SIGNING_SECRET`.

### CORS errors

- `FRONTEND_URL` must exactly match frontend domain (`https://...`, no trailing slash).

### Queue jobs not running

- Confirm `RQ_ENABLED=true` and valid `REDIS_URL`.
- Confirm `backend-worker` service is running.

### Backup verify/sync says file missing

- Usually a storage-locality mismatch (artifact created on different filesystem than API service).
- Align scheduler/worker placement with backup storage strategy.
