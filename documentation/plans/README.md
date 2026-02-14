# Stephanie's Research Notes System — Implementation Plans

## Overview

This directory contains 8 implementation plans plus 2 optional roadmap plans for advanced AI functionality in Stephanie's PhD Research Notes system.

The plans are designed to be executed in order with controlled overlap. They are not fully independent: each later plan assumes specific outputs from earlier plans.

## Dependency Graph

```
Plan 1: Data Models & Migrations ─────────────────────────────────┐
  │                                                                │
  ├──► Plan 2: Folder System (Backend CRUD + Frontend tree)        │
  │                                                                │
  ├──► Plan 3: Notes Page Foundation (/notes + TipTap editor)      │
  │      │                                                          │
  │      ├──► Plan 4: Thinker Auto-Detection                        │
  │      │      │                                                   │
  │      ├──► Plan 5: Critical Terms System                         │
  │      │      │                                                   │
  │      │      └──► Plan 6: Term Definitions & Filtered Analysis   │
  │      │                                                          │
  │      └──► Plan 7: Constellation Visualization ◄── Plan 4 + 5    │
  │                                                                │
  └──► Plan 8: Auto-Connection Suggestions ◄── Plan 4 + 7           │
```

## Execution Phases

| Phase | Plans | Can Parallelize? | Description |
|---|---|---|---|
| **A: Foundation** | 1 | No | Database models and migration baseline |
| **A: Foundation** | 2 + 3 | Yes (after Plan 1) | Folder system + `/notes` page foundation |
| **B: Intelligence** | 4 + 5 | Yes (after Plan 3) | Thinker detection + critical terms |
| **C: Analysis** | 6 + 7 | Yes (after Plan 5; Plan 7 also needs Plan 4) | Definitions + constellation |
| **D: Connections** | 8 | No (after Plan 4 + 7) | Co-occurrence-driven connection suggestions |

## Plan Index

| # | Plan | Backend Files | Frontend Files | Key Deliverable |
|---|---|---|---|---|
| 1 | [Data Models & Migrations](01-data-models-migrations.md) | 3 create, 2 modify | — | All database tables ready |
| 2 | [Folder System](02-folder-system.md) | 2 create, 2 modify | 2 create, 2 modify | Nested folder CRUD + tree UI |
| 3 | [Notes Page Foundation](03-notes-page-foundation.md) | 2 modify | 5 create, 4 modify | `/notes` page with TipTap editor |
| 4 | [Thinker Auto-Detection](04-thinker-auto-detection.md) | 2 create, 2 modify | 5 create, 4 modify | Thinker detection + mentions + unknown-name flow |
| 5 | [Critical Terms System](05-critical-terms-system.md) | 3 create, 3 modify | 3 create, 4 modify | Term flagging + scanning + highlighting |
| 6 | [Term Definitions & Analysis](06-term-definitions-analysis.md) | 2 modify | 3 create, 3 modify | Filtered excerpts + optional synthesis |
| 7 | [Constellation Visualization](07-constellation-visualization.md) | 1 create, 2 modify | 2 create, 3 modify | Term-thinker constellation view |
| 8 | [Auto-Connection Suggestions](08-auto-connection-suggestions.md) | 2 modify | 1 create, 3 modify | Co-occurrence-based connection suggestions |
| 9 (Optional) | [AI Notes System Full Implementation Plan](09-ai-notes-functionality-ideation.md) | phased | phased | End-to-end AI roadmap (term synthesis, writing, discovery, planning) |
| 10 (Optional) | [Text-to-Timeline Bootstrap](10-text-to-timeline-bootstrap.md) | phased | phased | Long-text extraction preview + user validation + commit to new timeline |

## Cross-Plan Contracts (Critical)

These contracts eliminate conflicts between plans. Treat them as required.

1. `backend/app/schemas/analysis.py` is a shared file across Plans 4, 7, and 8.
2. `backend/app/schemas/critical_term.py` is a shared file across Plans 5 and 6.
3. `analysisApi` in `frontend/src/lib/api.ts` is a single shared API object extended by Plans 4, 7, and 8.
4. `selectedFolderId === "unfiled"` is a frontend-only sentinel and must never be sent to backend UUID query params.
5. Folder deletion must preserve notes (`Note.folder_id -> NULL`), not delete notes.
6. `thinker_mentions` is the authoritative detection table. `note_mentions` can be optionally synchronized for compatibility.
7. Right-panel state on `/notes` should stay unified across plans:
   - `rightPanelMode`: `'none' | 'definition' | 'constellation' | 'connections'`
   - `selectedTermId`: `string | null`
   - Optional definition filter: `selectedThinkerId` (UUID), not thinker name.

## Global Acceptance Gates

Before marking any plan complete:

1. Backend routes compile and start (`uvicorn app.main:app --reload --port 8010`).
2. Frontend compiles (`npm run dev` and `npm run type-check`).
3. New API paths are visible in `/docs` and return typed responses.
4. Existing behavior from earlier plans still works (no regressions).
5. The plan checklist is completed with any deviations documented.

## Tech Stack for New Features

- Editor: TipTap (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-mention`)
- Visualization: SVG in React
- Term scanning: regex with word boundaries
- AI synthesis: DeepSeek API (`backend/app/utils/ai_service.py`)
- Core app: Next.js 14, FastAPI, SQLAlchemy, React Query, Tailwind

## Source of Truth

Stephanie's notes are the sole source of truth for analysis. The system does not import external definitions. DeepSeek is optional and only synthesizes Stephanie's own excerpts.
