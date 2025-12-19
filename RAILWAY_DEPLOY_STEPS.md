# Railway Deployment Steps

Follow these steps in order to deploy to Railway.

---

## What Gets Deployed (and What Doesn't)

### Deployed (via GitHub)
- All source code (`backend/`, `frontend/`)
- Dockerfiles and configuration
- Database migrations (`backend/alembic/versions/`)
- Static assets

### NOT Deployed (excluded by .gitignore & .dockerignore)
- `.env` files (secrets) - configure in Railway dashboard
- `node_modules/` - installed during Docker build
- `venv/` - created during Docker build
- `.next/` build cache - built fresh
- `__pycache__/` - Python cache
- `*.db` SQLite files - using PostgreSQL instead
- `data/chroma/` - local vector DB (not used in production)

### Database
- Local SQLite → Railway PostgreSQL (automatic migration)
- All tables created via Alembic migrations on first deploy
- Data starts empty - you'll add thinkers/timelines after deploy

---

## Step 1: Push Code to GitHub

Make sure all changes are committed and pushed to your GitHub repository.

```bash
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
5. Name your project (e.g., "intellectual-genealogy")

---

## Step 3: Add PostgreSQL Database

1. In your Railway project, click **"+ New"**
2. Select **"Database"**
3. Choose **"Add PostgreSQL"**
4. Wait for it to provision (takes ~30 seconds)

Railway automatically creates a `DATABASE_URL` variable.

---

## Step 4: Deploy Backend Service

1. Click **"+ New"** → **"GitHub Repo"**
2. Select your repository
3. Railway will ask which folder - select **`backend`** as the root directory
4. Wait for initial deployment to fail (expected - we need to add env vars)

### Add Backend Environment Variables

Go to the backend service → **Variables** tab → Add these:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `PORT` | `8001` |
| `ENVIRONMENT` | `production` |
| `FRONTEND_URL` | `https://placeholder.up.railway.app` (update later) |

Optional (for AI features):
| Variable | Value |
|----------|-------|
| `OPENAI_API_KEY` | Your OpenAI key |
| `DEEPSEEK_API_KEY` | Your DeepSeek key |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` |
| `DEEPSEEK_MODEL` | `deepseek-chat` |

### Generate Backend Domain

1. Go to backend service → **Settings** → **Networking**
2. Click **"Generate Domain"**
3. Copy the URL (e.g., `https://backend-production-xxxx.up.railway.app`)

---

## Step 5: Deploy Frontend Service

1. Click **"+ New"** → **"GitHub Repo"**
2. Select the **same repository** again
3. Select **`frontend`** as the root directory
4. Wait for initial deployment

### Add Frontend Environment Variables

Go to the frontend service → **Variables** tab → Add:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://backend-production-xxxx.up.railway.app` (your backend URL) |

**IMPORTANT:** Also add this as a Build Variable:
1. Go to **Settings** → **Build**
2. Find **"Build Variables"** or **"Build Arguments"**
3. Add: `NEXT_PUBLIC_API_URL` = `https://backend-production-xxxx.up.railway.app`

### Generate Frontend Domain

1. Go to frontend service → **Settings** → **Networking**
2. Click **"Generate Domain"**
3. Copy the URL (e.g., `https://frontend-production-xxxx.up.railway.app`)

---

## Step 6: Update Backend CORS

1. Go back to backend service → **Variables**
2. Update `FRONTEND_URL` to your actual frontend URL:
   ```
   FRONTEND_URL = https://frontend-production-xxxx.up.railway.app
   ```
3. Railway will auto-redeploy

---

## Step 7: Verify Deployment

### Test Backend

Open your browser or use curl:

```bash
# Health check
curl https://your-backend.up.railway.app/health
# Expected: {"status":"healthy"}

# API root
curl https://your-backend.up.railway.app/
# Expected: {"message":"Intellectual Genealogy API","version":"1.0.0"}

# List thinkers
curl https://your-backend.up.railway.app/api/thinkers/
# Expected: [] (empty array if no data)
```

### Test Frontend

1. Open `https://your-frontend.up.railway.app` in browser
2. Check browser console for errors (F12 → Console)
3. Try creating a timeline or thinker

---

## Troubleshooting

### Backend won't start
- Check **Deployments** → Click latest deployment → **View Logs**
- Verify `DATABASE_URL` is set correctly
- Ensure the service is linked to PostgreSQL

### Frontend shows "Failed to fetch" or CORS error
- Verify `FRONTEND_URL` in backend matches frontend URL exactly
- Include `https://` and no trailing slash
- Redeploy backend after changing FRONTEND_URL

### Frontend shows wrong API URL
- `NEXT_PUBLIC_API_URL` must be set as **Build Variable**
- Trigger a redeploy after adding it

### Database migration errors
- Check backend logs for Alembic output
- Migrations run automatically on startup

---

## Environment Variables Summary

### Backend Service (Required)
```
DATABASE_URL=${{Postgres.DATABASE_URL}}
PORT=8001
ENVIRONMENT=production
FRONTEND_URL=https://your-frontend.up.railway.app
```

### Backend Service (Optional - AI Features)
```
DEEPSEEK_API_KEY=sk-your-deepseek-key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
OPENAI_API_KEY=sk-your-openai-key
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

**Note:** AI features (suggestions, chat, summaries) only work if API keys are configured. The app works fine without them - AI features will just be disabled.

### Frontend Service
```
NEXT_PUBLIC_API_URL=https://your-backend.up.railway.app
```
(Also add as Build Variable)

---

## Optional: Custom Domain

1. Go to service → **Settings** → **Networking**
2. Click **"+ Custom Domain"**
3. Enter your domain (e.g., `app.yourdomain.com`)
4. Add the CNAME record to your DNS provider
5. Wait for SSL certificate (automatic)

---

## Costs

- **Hobby Plan**: $5/month (includes $5 credit)
- **Usage-based**: Pay for compute + database storage
- Typical small app: ~$5-15/month total
