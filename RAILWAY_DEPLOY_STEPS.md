# Railway Deployment Steps (Railpack)

Railpack is Railway's zero-config builder. It auto-detects your app and builds it.

---

## What Gets Deployed (and What Doesn't)

### Deployed (via GitHub)

- All source code (`backend/`, `frontend/`)
- Database migrations (`backend/alembic/versions/`)
- Static assets

### NOT Deployed (excluded by .gitignore & .railpackignore)

- `.env` files (secrets) - configure in Railway dashboard
- `node_modules/` - installed during build
- `venv/` - created during build
- `.next/` build cache - built fresh
- `__pycache__/` - Python cache
- `*.db` SQLite files - using PostgreSQL instead

### Database

- Local SQLite → Railway PostgreSQL (automatic)
- All tables created via Alembic migrations on first deploy
- Data starts empty - you'll add thinkers/timelines after deploy

---

## Step 1: Push Code to GitHub

Make sure all changes are committed and pushed:

```bash
cd /path/to/Stephane-Thinkers
git add .
git commit -m "Add Railway deployment configuration"
git push origin main
```

---

## Step 2: Create Railway Account & Project

1. Go to [railway.app](https://railway.app)
2. Sign in with GitHub
3. Click **"New Project"**
4. Select **"Empty Project"**

---

## Step 3: Add PostgreSQL Database

1. Click **"+ New"** → **"Database"** → **"Add PostgreSQL"**
2. Wait for it to provision (~30 seconds)

---

## Step 4: Deploy Backend Service

1. Click **"+ New"** → **"GitHub Repo"**
2. Select your repository
3. Set **Root Directory**: `backend`
4. Railway auto-detects Python/FastAPI via Railpack

### Add Backend Environment Variables

Go to **Variables** tab and add:

| Variable              | Value                                                                      |
| --------------------- | -------------------------------------------------------------------------- |
| `DATABASE_URL`        | `${{Postgres.DATABASE_URL}}`                                               |
| `PORT`                | `8001`                                                                     |
| `ENVIRONMENT`         | `production`                                                               |
| `FRONTEND_URL`        | `https://placeholder.up.railway.app` (update later)                        |
| `RAILWAY_RUN_COMMAND` | `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT` |

**Optional (AI features):**

| Variable            | Value                      |
| ------------------- | -------------------------- |
| `OPENAI_API_KEY`    | Your OpenAI key            |
| `DEEPSEEK_API_KEY`  | Your DeepSeek key          |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` |
| `DEEPSEEK_MODEL`    | `deepseek-chat`            |

### Generate Backend Domain

1. Go to **Settings** → **Networking** → **Generate Domain**
2. Copy the URL (e.g., `backend-production-a8bf.up.railway.app`)

---

## Step 5: Deploy Frontend Service

1. Click **"+ New"** → **"GitHub Repo"**
2. Select the **same repository**
3. Set **Root Directory**: `frontend`
4. Railway auto-detects Next.js via Railpack

### Add Frontend Environment Variables

| Variable              | Value                                                    |
| --------------------- | -------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL` | `https://backend-xxxx.up.railway.app` (your backend URL) |
| `PORT`                | `3000`                                                   |

### Generate Frontend Domain

1. Go to **Settings** → **Networking** → **Generate Domain**
2. Copy the URL (e.g., `https://frontend-xxxx.up.railway.app`)

---

## Step 6: Update Backend CORS

1. Go back to **backend service** → **Variables**
2. Update `FRONTEND_URL`:
   ```
   FRONTEND_URL = https://frontend-xxxx.up.railway.app
   ```
3. Railway auto-redeploys

---

## Step 7: Verify Deployment

### Test Backend

```bash
curl https://your-backend.up.railway.app/health
# Expected: {"status":"healthy"}

curl https://your-backend.up.railway.app/api/thinkers/
# Expected: []
```

### Test Frontend

Open `https://your-frontend.up.railway.app` in browser.

---

## Troubleshooting

### Build fails

- Check **Deployments** → **View Logs**
- Railpack auto-detects, but you can override with env vars

### Backend won't start

- Verify `DATABASE_URL` is set to `${{Postgres.DATABASE_URL}}`
- Check `RAILWAY_RUN_COMMAND` includes alembic migration

### CORS errors

- `FRONTEND_URL` must match exactly (include `https://`, no trailing slash)
- Redeploy backend after updating

### Frontend shows wrong API URL

- `NEXT_PUBLIC_API_URL` is baked into the build
- Trigger redeploy after changing it

---

## Environment Variables Summary

### Backend Service

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
PORT=8001
ENVIRONMENT=production
FRONTEND_URL=https://your-frontend.up.railway.app
RAILWAY_RUN_COMMAND=alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

### Frontend Service

```
NEXT_PUBLIC_API_URL=https://your-backend.up.railway.app
PORT=3000
```

---

## Optional: Custom Domain

1. Service → **Settings** → **Networking**
2. Click **"+ Custom Domain"**
3. Add CNAME record to your DNS
4. SSL is automatic

---

## Railpack vs Dockerfile

You're using **Railpack** (zero-config). Benefits:

- No Dockerfile to maintain
- Smaller images (38-77% smaller)
- Automatic language detection
- Better caching

If you ever need more control, you can add a `Dockerfile` and Railway will use that instead.
