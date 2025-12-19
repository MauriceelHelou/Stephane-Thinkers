# Railway Deployment Plan

## Status: ✅ Ready for Deployment

All necessary files have been created and configured for Railway deployment.

---

## Files Created/Modified

| File | Status | Purpose |
|------|--------|---------|
| `backend/Dockerfile` | ✅ Created | Container build for FastAPI backend |
| `frontend/Dockerfile` | ✅ Created | Container build for Next.js frontend |
| `backend/railway.toml` | ✅ Created | Railway deployment configuration |
| `frontend/railway.toml` | ✅ Created | Railway deployment configuration |
| `backend/.dockerignore` | ✅ Created | Exclude unnecessary files from build |
| `frontend/.dockerignore` | ✅ Created | Exclude unnecessary files from build |
| `frontend/next.config.js` | ✅ Modified | Added `output: 'standalone'` for Docker |
| `frontend/package.json` | ✅ Modified | Dynamic PORT in start script |
| `backend/app/database.py` | ✅ Modified | PostgreSQL support + connection pooling |
| `backend/app/main.py` | ✅ Modified | Production CORS configuration |
| `backend/alembic/env.py` | ✅ Modified | Handle Railway postgres:// URL format |
| `backend/.env.example` | ✅ Updated | Railway deployment documentation |
| `frontend/.env.example` | ✅ Updated | Railway deployment documentation |

---

## Quick Start: Deploy to Railway

### Step 1: Create Railway Project

1. Go to [railway.app](https://railway.app) and log in
2. Click **"New Project"** → **"Empty Project"**

### Step 2: Add PostgreSQL Database

1. In your project, click **"+ New"** → **"Database"** → **"Add PostgreSQL"**
2. Railway automatically creates `DATABASE_URL` variable

### Step 3: Deploy Backend

1. Click **"+ New"** → **"GitHub Repo"**
2. Select your repository
3. In service settings:
   - **Root Directory**: `backend`
   - Railway will auto-detect the Dockerfile

4. Add environment variables (Settings → Variables):
   ```
   DATABASE_URL      = ${{Postgres.DATABASE_URL}}
   PORT              = 8001
   ENVIRONMENT       = production
   FRONTEND_URL      = (set after frontend deploys)
   ```

5. Optional AI variables:
   ```
   OPENAI_API_KEY    = sk-...
   DEEPSEEK_API_KEY  = sk-...
   DEEPSEEK_BASE_URL = https://api.deepseek.com
   DEEPSEEK_MODEL    = deepseek-chat
   ```

6. Generate domain: **Settings** → **Networking** → **Generate Domain**
7. Note the backend URL (e.g., `https://backend-xxx.up.railway.app`)

### Step 4: Deploy Frontend

1. Click **"+ New"** → **"GitHub Repo"**
2. Select the **same repository**
3. In service settings:
   - **Root Directory**: `frontend`

4. Add environment variables:
   ```
   NEXT_PUBLIC_API_URL = https://backend-xxx.up.railway.app
   ```

5. **IMPORTANT**: Also add as build argument:
   - Go to **Settings** → **Build** → **Build Arguments**
   - Add: `NEXT_PUBLIC_API_URL=https://backend-xxx.up.railway.app`

6. Generate domain: **Settings** → **Networking** → **Generate Domain**
7. Note the frontend URL (e.g., `https://frontend-xxx.up.railway.app`)

### Step 5: Update Backend CORS

1. Go back to backend service
2. Update `FRONTEND_URL` variable:
   ```
   FRONTEND_URL = https://frontend-xxx.up.railway.app
   ```
3. Redeploy backend (Settings → Redeploy)

### Step 6: Verify Deployment

```bash
# Test backend health
curl https://backend-xxx.up.railway.app/health
# Expected: {"status":"healthy"}

# Test API root
curl https://backend-xxx.up.railway.app/
# Expected: {"message":"Intellectual Genealogy API","version":"1.0.0"}

# Test thinkers endpoint
curl https://backend-xxx.up.railway.app/api/thinkers/
# Expected: [] or list of thinkers
```

Then visit your frontend URL in a browser.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Railway Project                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Frontend   │───▶│   Backend    │───▶│  PostgreSQL  │  │
│  │   (Next.js)  │    │   (FastAPI)  │    │  (Database)  │  │
│  │   Port 3000  │    │   Port 8001  │    │   Port 5432  │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                   │                    │          │
│         ▼                   ▼                    ▼          │
│  NEXT_PUBLIC_API_URL  FRONTEND_URL         DATABASE_URL    │
│                       DATABASE_URL                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Environment Variables Reference

### Backend Service

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (use `${{Postgres.DATABASE_URL}}`) |
| `PORT` | Yes | Server port (default: 8001) |
| `ENVIRONMENT` | Yes | Set to `production` |
| `FRONTEND_URL` | Yes | Frontend URL for CORS (e.g., `https://frontend.up.railway.app`) |
| `OPENAI_API_KEY` | No | For AI features (embeddings) |
| `DEEPSEEK_API_KEY` | No | For AI features (chat/analysis) |
| `DEEPSEEK_BASE_URL` | No | DeepSeek API endpoint |
| `DEEPSEEK_MODEL` | No | DeepSeek model name |
| `CHROMA_PERSIST_DIRECTORY` | No | Vector DB storage path |

### Frontend Service

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | Backend API URL (must also be set as build argument!) |

---

## Key Configuration Details

### Database (PostgreSQL)

- **URL Format**: Railway uses `postgres://` but SQLAlchemy needs `postgresql://`
- **Solution**: `database.py` and `alembic/env.py` automatically convert the URL
- **Connection Pooling**: Enabled for production with:
  - Pool size: 5 connections
  - Max overflow: 10 connections
  - Connection recycling: 30 minutes
  - Pre-ping: Enabled for reliability

### Migrations

- Migrations run automatically on container start (`alembic upgrade head`)
- All 14 existing migrations are PostgreSQL-compatible

### CORS

- Production: Only allows `FRONTEND_URL`
- Development: Also allows localhost variants
- API docs disabled in production for security

### Next.js Standalone Build

- Uses `output: 'standalone'` for minimal Docker image
- Environment variables baked in at build time
- Runs as non-root user for security

---

## Troubleshooting

### Build Failures

**Backend:**
```bash
# Check logs for pip install errors
# Ensure requirements.txt has all dependencies
# psycopg2-binary is already included
```

**Frontend:**
```bash
# Check for TypeScript errors
npm run type-check

# Ensure package-lock.json exists
# The Dockerfile uses npm ci which requires it
```

### Database Connection Errors

1. Verify `DATABASE_URL` is set correctly
2. Check Railway logs for connection errors
3. Ensure PostgreSQL service is running
4. Verify service is linked to database

### CORS Errors in Browser

1. Check `FRONTEND_URL` matches exactly (including `https://`)
2. No trailing slash in URL
3. Redeploy backend after changing `FRONTEND_URL`

### Frontend Can't Reach Backend

1. `NEXT_PUBLIC_API_URL` must be set at BUILD time
2. Add it as both environment variable AND build argument
3. Redeploy frontend after any changes
4. Check browser Network tab for actual URL being used

### Health Check Failures

- Backend health endpoint: `/health`
- Frontend health endpoint: `/`
- Increase `healthcheckTimeout` if slow startup

---

## Production Optimizations (Optional)

### Custom Domains

1. Railway Settings → Domains → Add Custom Domain
2. Configure DNS CNAME to Railway-provided target
3. SSL certificates are automatic

### Monitoring

- Railway provides built-in metrics dashboard
- View logs in real-time from service page
- Add Sentry for error tracking:
  ```
  SENTRY_DSN=https://...@sentry.io/...
  ```

### Database Backups

- Railway PostgreSQL includes automatic backups
- Enable point-in-time recovery in database settings
- Consider periodic pg_dump exports for extra safety

### Persistent Storage (ChromaDB)

If using ChromaDB vector database:
1. Backend service → Settings → Volumes
2. Add volume mounted at `/app/data/chroma`
3. Set `CHROMA_PERSIST_DIRECTORY=/app/data/chroma`

---

## Estimated Costs

| Plan | Cost | Resources |
|------|------|-----------|
| Hobby | $5/month | 512MB RAM, shared CPU |
| Pro | $20/month base | 8GB RAM, dedicated resources |

Usage-based pricing applies for compute and database storage.

---

## Next Steps After Deployment

1. ✅ Verify all endpoints work
2. ✅ Test creating/editing thinkers
3. ✅ Test timeline functionality
4. ⬜ Set up custom domain (optional)
5. ⬜ Configure monitoring/alerts
6. ⬜ Set up database backups
7. ⬜ Add AI API keys for full functionality
