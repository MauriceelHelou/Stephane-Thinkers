#!/bin/bash

set -e

echo "🚀 Starting Stephane-Thinkers devcontainer setup..."

# Backend setup
echo "📦 Setting up Python backend..."
cd /workspace/backend

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python -m venv venv
fi

# Activate virtual environment and install dependencies
source venv/bin/activate
echo "Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Run database migrations
echo "Running database migrations..."
alembic upgrade head

# Frontend setup
echo "📦 Setting up Next.js frontend..."
cd /workspace/frontend

# Install Node.js dependencies
if [ ! -d "node_modules" ]; then
    echo "Installing Node.js dependencies..."
    npm install
else
    echo "Node modules already installed, skipping..."
fi

echo "✅ Devcontainer setup complete!"
echo ""
echo "🎯 Next steps:"
echo "  1. Start backend: cd backend && source venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8010 --reload"
echo "  2. Start frontend: cd frontend && npm run dev"
echo "  3. Access frontend at http://localhost:3010"
echo "  4. Access backend API at http://localhost:8010"
