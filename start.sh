#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "=== تشغيل نظام إدارة تكنولوجيا المعلومات ==="

# Start backend
echo "[1/2] تشغيل الباكند (FastAPI) على المنفذ 8000..."
cd "$ROOT/backend"
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Start frontend
echo "[2/2] تشغيل الفرونتند (React) على المنفذ 5173..."
cd "$ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ البرنامج يعمل:"
echo "   الفرونتند:  http://localhost:5173"
echo "   API Docs:   http://localhost:8000/docs"
echo ""
echo "اضغط Ctrl+C للإيقاف"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
