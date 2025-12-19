# Stephane-Thinkers Devcontainer Setup

This devcontainer provides a fully isolated development environment for the Stephane-Thinkers project with Claude Code integration and security safeguards.

## What's Included

- **Python 3.11** - Backend development
- **Node.js 20** - Frontend development
- **Git** - Version control
- **VS Code Extensions** - Python, TypeScript, ESLint, Prettier, Tailwind CSS
- **Isolated Environment** - Complete filesystem and network isolation
- **Claude Code Integration** - Safe bypass permissions within container only

## Quick Start

### 1. Open in Devcontainer

**Using VS Code:**
1. Open the `Stephane-Thinkers` folder in VS Code
2. When prompted, click "Reopen in Container"
   - OR use Command Palette: `Dev Containers: Reopen in Container`

**First-time build:** The container will take 3-5 minutes to build and initialize.

### 2. Verify Setup

After the container starts, the setup script automatically:
- Creates Python virtual environment
- Installs backend dependencies
- Installs frontend dependencies
- Runs database migrations

### 3. Start Development Servers

**Option A: Manual start (recommended for development)**

Terminal 1 - Backend:
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

Terminal 2 - Frontend:
```bash
cd frontend
npm run dev
```

**Option B: Start both services together**
```bash
bash .devcontainer/start-services.sh
```

### 4. Access the Application

- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:8001
- **API Documentation**: http://localhost:8001/docs

## Using Claude Code Inside the Container

You have three options to use Claude Code with your devcontainer:

### Option 1: VS Code with Claude Code Extension (Recommended)

1. Open project in VS Code
2. Click "Reopen in Container" when prompted
3. Claude Code extension works automatically inside the container
4. Full IDE integration with AI assistance

### Option 2: Claude Code CLI Inside Container

**Quick access from host:**
```bash
./claude-container.sh claude chat      # Start Claude chat
./claude-container.sh claude --help    # Show help
./claude-container.sh shell            # Open container shell
```

**Or manually:**
```bash
# From host machine
docker-compose -f .devcontainer/docker-compose.yml exec app claude chat

# Or enter container first
docker-compose -f .devcontainer/docker-compose.yml exec app bash
# Then inside container:
cd /workspace
claude chat
```

### Option 3: Use Claude Code from Host

Continue using Claude Code on your host machine - it can execute commands inside the container when needed using docker-compose exec.

## Claude Code Permissions

This devcontainer includes a `.claude/settings.json` configuration that provides:

### Security Features

✅ **Bypass Mode Inside Container**
- Claude Code can freely edit files and run commands within the container
- No permission prompts for operations inside `/workspace`

✅ **Backup Protection**
- Backup folder (`Stephane-Thinkers-BACKUP-*`) is completely inaccessible
- Explicit deny rules prevent reading or writing

✅ **Parent Directory Protection**
- Cannot navigate to parent directories (`../**`, `../../**`)
- Container workspace is the boundary

✅ **Sandbox Enforcement**
- OS-level sandboxing enabled (bubblewrap/Seatbelt)
- No escape hatch via `dangerouslyDisableSandbox`
- Network filtering through proxy

### How It Works

The security model uses multiple layers:

1. **Docker Isolation**: Container only has access to mounted `/workspace` volume
2. **Claude Code IAM**: Permission rules deny access outside project directory
3. **OS Sandboxing**: Built-in macOS Seatbelt or Linux bubblewrap restrictions

This means even with bypass mode, Claude Code cannot:
- Access the backup folder
- Modify files outside the container
- Access sensitive host system files
- Navigate to parent directories

## Container Management

### Rebuild Container

If you modify `.devcontainer/` configuration files:

1. Command Palette: `Dev Containers: Rebuild Container`
2. Wait for rebuild to complete

### Stop Container

- Close VS Code window, OR
- Command Palette: `Dev Containers: Close Remote Connection`

### Delete Container & Volumes

To completely remove and start fresh:

```bash
docker-compose -f .devcontainer/docker-compose.yml down -v
```

Then reopen in container to rebuild from scratch.

## Development Workflow

### Running Tests

**Backend:**
```bash
cd backend
source venv/bin/activate
pytest
```

**Frontend:**
```bash
cd frontend
npm test
```

### Database Management

**Create a new migration:**
```bash
cd backend
source venv/bin/activate
alembic revision --autogenerate -m "Description of changes"
```

**Apply migrations:**
```bash
alembic upgrade head
```

**Rollback migration:**
```bash
alembic downgrade -1
```

### Installing New Dependencies

**Backend:**
```bash
cd backend
source venv/bin/activate
pip install package-name
pip freeze > requirements.txt
```

**Frontend:**
```bash
cd frontend
npm install package-name
```

## Troubleshooting

### OneDrive Sync Issues (IMPORTANT)

If your project is in OneDrive, you MUST pause syncing during development:

1. Click OneDrive icon in menu bar
2. Click gear icon → "Pause syncing"
3. Choose 24 hours

**Why:** OneDrive locks files, causing:

- SQLite "disk I/O error"
- Next.js can't write files (error -35)
- Development server crashes

**Alternative:** Move project outside OneDrive to `~/Projects/`

### Container won't start

1. Ensure Docker Desktop is running
2. Check Docker has enough resources (4GB+ RAM recommended)
3. Try rebuilding: `Dev Containers: Rebuild Container`

### Ports already in use

If ports 3001 or 8001 are already in use:

1. Stop services using those ports on your host machine
2. Or modify port mappings in `.devcontainer/devcontainer.json`

### Dependencies not installing

If setup fails:

1. Rebuild container: `Dev Containers: Rebuild Container`
2. Manually run setup: `bash .devcontainer/setup.sh`

### Database issues

Reset the database:

```bash
cd backend
rm stephane_thinkers.db
source venv/bin/activate
alembic upgrade head
```

### Claude Code permissions issues

If Claude Code cannot perform an action:

1. Check `.claude/settings.json` rules
2. Verify you're working within `/workspace` directory
3. Check that the operation matches allowed patterns

## File Structure

```
Stephane-Thinkers/
├── .devcontainer/
│   ├── devcontainer.json      # Main devcontainer config
│   ├── docker-compose.yml     # Service definitions
│   ├── Dockerfile             # Container image
│   ├── setup.sh               # Post-create initialization
│   ├── start-services.sh      # Start both services
│   └── README.md              # This file
├── .claude/
│   └── settings.json          # Claude Code permissions
├── backend/                   # FastAPI application
├── frontend/                  # Next.js application
└── .gitignore
```

## Benefits of This Setup

1. **Reproducible Environment** - Same setup across all machines
2. **Isolated Dependencies** - No conflicts with host system
3. **Safe Experimentation** - Changes contained in container
4. **Easy Cleanup** - Delete container to reset completely
5. **Claude Code Integration** - AI assistance with safety guardrails
6. **No Host Pollution** - Host system stays clean

## Additional Resources

- [VS Code Devcontainers Documentation](https://code.visualstudio.com/docs/devcontainers/containers)
- [Claude Code Documentation](https://code.claude.com/docs)
- [Docker Documentation](https://docs.docker.com/)
- [Project README](../README.md)

## Support

For issues specific to:
- **Devcontainer**: Check Docker Desktop logs and container logs
- **Claude Code**: Review `.claude/settings.json` and sandbox settings
- **Application**: See main project README.md
