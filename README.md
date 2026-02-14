# Intellectual Genealogy Mapper

A minimalist timeline-based knowledge graph for Harvard PhD research.

## Tech Stack

**Frontend:**
- Next.js 14 App Router with TypeScript
- TailwindCSS for styling
- React Query for data fetching
- Port: 3010

**Backend:**
- FastAPI (Python)
- PostgreSQL database
- SQLAlchemy ORM
- Alembic for migrations
- Port: 8010

## Project Structure

```
├── frontend/          # Next.js application
│   ├── src/
│   │   ├── app/      # App router pages
│   │   ├── components/
│   │   ├── lib/      # Utilities and API client
│   │   └── types/    # TypeScript types
│   ├── public/
│   └── package.json
│
├── backend/          # FastAPI application
│   ├── app/
│   │   ├── models/   # SQLAlchemy models
│   │   ├── routes/   # API endpoints
│   │   ├── schemas/  # Pydantic schemas
│   │   └── main.py   # FastAPI app
│   ├── alembic/      # Database migrations
│   └── requirements.txt
│
└── README.md
```

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- Python 3.11+
- PostgreSQL 15+

### Database Setup

1. Create PostgreSQL database:
```bash
createdb intellectual_graph
```

2. Update backend/.env with your database credentials

### Backend Setup

1. Create virtual environment:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Run migrations (after models are created):
```bash
alembic upgrade head
```

4. Start the backend server:
```bash
uvicorn app.main:app --reload --port 8010
```

### Frontend Setup

1. Install dependencies:
```bash
cd frontend
npm install
```

2. Start the development server:
```bash
npm run dev
```

The frontend will be available at http://localhost:3010
The backend API will be available at http://localhost:8010

## Environment Variables

### Backend (.env)
```
DATABASE_URL=postgresql://username:password@localhost:5432/intellectual_graph
PORT=8010
FRONTEND_URL=http://localhost:3010
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:8010
```

## Features

### Core Functionality ✅
- **Thinker Management**: Add, edit, and delete thinkers with full biographical information
- **Timeline Visualization**: Interactive canvas with pan and zoom controls
- **Connections**: Create and visualize relationships between thinkers with Bezier curves
- **Publications & Quotes**: Add publications and quotes to each thinker
- **Detail Panel**: Comprehensive side panel for viewing and editing thinker details

### User Interface
- **Add Thinker**: Click anywhere on the timeline or use the header button
- **View Details**: Click any thinker node to open the detail panel
- **Create Connections**: Use "Add Connection" button, then select two thinkers
- **Navigate**: Pan (drag canvas) and zoom (mouse wheel) the timeline
- **Edit**: Inline editing in the detail panel for all thinker fields

## Usage Guide

### Adding a Thinker
1. Click "Add Thinker" button in header, OR click empty space on the timeline
2. Fill in thinker details (name is required)
3. Position is auto-set based on birth year or click location
4. Click "Add Thinker" to save

### Creating Connections
1. Click "Add Connection" button
2. Click the first thinker (source of influence)
3. Click the second thinker (influenced by the first)
4. In the modal, select connection type and add notes
5. Click "Add Connection" to save

### Adding Publications & Quotes
1. Click a thinker to open the detail panel
2. Scroll to Publications or Quotes section
3. Click "+ Add Publication" or "+ Add Quote"
4. Fill in the inline form
5. Click "Add" to save

## Development Status

- [x] Phase 1: Project Setup
- [x] Phase 2: Database & Backend API
- [x] Phase 3: Frontend Foundation
- [x] Phase 4: Thinker Management
- [x] Phase 5: Connection System
- [x] Phase 6: Publications & Quotes
- [ ] Phase 7: Filtering & Search (Future enhancement)
- [ ] Phase 8: Export Functionality (Future enhancement)
- [ ] Phase 9: Polish & Refinement (Future enhancement)
- [x] Phase 10: Documentation & MVP Complete

## Database Schema

The application uses SQLite for local development (PostgreSQL ready for production):

- **thinkers**: Main thinker entities with biographical data
- **publications**: Publications linked to thinkers
- **quotes**: Quotes linked to thinkers
- **tags**: Tags for categorization
- **connections**: Relationships between thinkers
- **thinker_tags**: Many-to-many relationship table

## API Endpoints

All endpoints are available at `http://localhost:8010`:

- `GET /api/thinkers` - List all thinkers
- `POST /api/thinkers` - Create a thinker
- `GET /api/thinkers/{id}` - Get thinker details with relations
- `PUT /api/thinkers/{id}` - Update a thinker
- `DELETE /api/thinkers/{id}` - Delete a thinker
- `GET /api/connections` - List all connections
- `POST /api/connections` - Create a connection
- `PUT /api/connections/{id}` - Update a connection
- `DELETE /api/connections/{id}` - Delete a connection
- `GET /api/publications` - List publications
- `POST /api/publications` - Create a publication
- `GET /api/quotes` - List quotes
- `POST /api/quotes` - Create a quote
- `GET /api/tags` - List tags
- `POST /api/tags` - Create a tag

## Technology Decisions

**SQLite vs PostgreSQL**: Currently using SQLite for simplicity. To switch to PostgreSQL:
1. Install PostgreSQL
2. Create database
3. Update `backend/.env` with PostgreSQL connection string
4. Run migrations: `alembic upgrade head`

**Port Configuration**: Uses ports 3010 (frontend) and 8010 (backend) to avoid conflicts with standard ports.

**Design System**: Academic minimalism with Crimson Text serif font, Harvard crimson accents, and generous white space.

## Known Limitations

- No filtering or search functionality yet
- No export to SVG/PNG yet
- Thinker positions are manual (not auto-calculated from dates)
- No tags implementation in UI yet
- No undo/redo functionality

## Future Enhancements

- Search and filter by name, field, time period
- Export timeline as SVG or PNG
- Tag management and filtering
- Bibliography generation in Harvard citation style
- Keyboard shortcuts (Cmd+N for new thinker, etc.)
- Collaborative editing
- Mobile responsive design
