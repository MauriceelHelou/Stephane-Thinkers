#!/bin/bash

# Start both frontend and backend services in the background

echo "🚀 Starting Stephane-Thinkers services..."

# Start backend
echo "Starting FastAPI backend on port 8001..."
cd /workspace/backend
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload &
BACKEND_PID=$!

# Start frontend
echo "Starting Next.js frontend on port 3001..."
cd /workspace/frontend
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ Services started!"
echo "   Backend PID: $BACKEND_PID"
echo "   Frontend PID: $FRONTEND_PID"
echo ""
echo "🌐 Access the application:"
echo "   Frontend: http://localhost:3001"
echo "   Backend API: http://localhost:8001"
echo "   API Docs: http://localhost:8001/docs"
echo ""
echo "⏹️  To stop services: kill $BACKEND_PID $FRONTEND_PID"

# Wait for both processes
wait
