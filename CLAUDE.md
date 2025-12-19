# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Intellectual Genealogy Mapper - A minimalist timeline-based knowledge graph for Harvard PhD research. Next.js 14 frontend + FastAPI backend + SQLite/PostgreSQL database.

## Commands

### Backend (from `backend/` directory)
```bash
# Setup
python -m venv venv
venv\Scripts\activate        # Windows
source venv/bin/activate     # Unix
pip install -r requirements.txt

# Run dev server (port 8001)
uvicorn app.main:app --reload --port 8001

# Database migrations
alembic upgrade head                          # Apply migrations
alembic revision --autogenerate -m "message"  # Generate migration
```

### Frontend (from `frontend/` directory)
```bash
npm install                  # Install dependencies
npm run dev                  # Dev server on port 3001
npm run build                # Production build
npm run type-check           # TypeScript check
npx playwright test          # E2E tests (requires dev server running)
```

## Architecture

### Backend (`backend/app/`)
- **main.py**: FastAPI app with CORS middleware and route registration
- **database.py**: SQLAlchemy engine and session factory
- **models/**: SQLAlchemy ORM models (Thinker, Connection, Publication, Quote, Tag, Timeline, TimelineEvent, CombinedTimelineView)
- **schemas/**: Pydantic request/response validation (Create, Update, WithRelations patterns)
- **routes/**: API endpoints following `/api/resource` pattern with standard CRUD

### Frontend (`frontend/src/`)
- **app/page.tsx**: Main page containing all canvas logic, modals, and state management
- **components/Timeline.tsx**: Canvas renderer with pan/zoom functionality
- **components/CombinedTimelineCanvas.tsx**: Multi-timeline composite view
- **lib/api.ts**: Centralized Axios API client for all endpoints
- **lib/providers.tsx**: React Query provider setup
- **types/index.ts**: TypeScript interfaces

### Data Flow
Frontend React component → React Query mutation → Axios (lib/api.ts) → FastAPI route → SQLAlchemy ORM → Database → Pydantic response → React Query cache update

### Database Models
- **thinkers**: Core entity with birth_year, death_year, field, position_x/y
- **connections**: Directional relationships (influenced/critiqued/built_upon/synthesized) between thinkers
- **publications/quotes**: 1:M from thinker
- **tags**: M:M with thinkers via thinker_tags
- **timelines**: Container for grouping thinkers
- **combined_timeline_views**: Multi-timeline compositions

## Environment Variables

Backend `.env`:
```
DATABASE_URL=sqlite:///./intellectual_graph.db
PORT=8001
FRONTEND_URL=http://localhost:3001
```

Frontend `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8001
```

## Code Patterns

### Backend Route Pattern
```python
router = APIRouter(prefix="/api/resource", tags=["resource"])

@router.get("/{id}", response_model=schemas.ResourceWithRelations)
def get_resource(id: UUID, db: Session = Depends(get_db)):
    resource = db.query(Model).options(joinedload(Model.relation)).filter(Model.id == id).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Not found")
    return resource
```

### Frontend API Pattern
```typescript
export const resourceApi = {
  getAll: async (): Promise<Resource[]> => (await api.get('/api/resource')).data,
  create: async (data: ResourceCreate): Promise<Resource> => (await api.post('/api/resource', data)).data,
}
```

## Design System

- **Fonts**: Crimson Text (headers), Inter (body), JetBrains Mono (code)
- **Colors**: Background #FAFAF8, Accent #8B4513 (Harvard crimson), Primary #1A1A1A
- **Canvas**: HTML5 Canvas with wheel zoom and drag pan

## Claude Code Skills

This project includes specialized skills in `.claude/skills/` that enhance development workflows:

### Testing Skills

- **unit-test.md**: Generate pytest unit tests for backend endpoints
- **integration-test.md**: Create multi-step workflow integration tests
- **e2e-test.md**: Build Playwright E2E tests for UI interactions
- **test-runner.md**: Execute tests, analyze failures, generate reports

### Development Skills

- **api-generator.md**: Generate complete API endpoints (model → schema → route → frontend)
- **migration-helper.md**: Manage database migrations with Alembic
- **code-review.md**: Comprehensive code review for quality and security

### Usage Examples

```text
"Use unit-test to create tests for the thinkers API"
"Generate a new comments endpoint with api-generator"
"Run all tests with test-runner and show me the coverage"
"Use migration-helper to add institution field to thinkers"
"Review my code with code-review before I commit"
```

See `.claude/skills/README.md` for detailed documentation and workflow patterns.
