#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

usage() {
  echo "Usage: $0 [--seed] [backend|frontend|all]"
  echo "  --seed    re-seed the database before starting (can appear anywhere)"
  echo "  backend   start the FastAPI backend on :8000"
  echo "  frontend  start the Vite dev server on :5173"
  echo "  all       start both (default)"
  exit 1
}

SEED=false
MODE=""

for arg in "$@"; do
  case "$arg" in
    --seed) SEED=true ;;
    backend|frontend|all) MODE="$arg" ;;
    *) usage ;;
  esac
done

MODE="${MODE:-all}"

seed_db() {
  echo "Seeding database..."
  (
    cd backend
    DATABASE_URL="${DATABASE_URL:-postgresql://impact:impact@localhost:5432/impact}" \
      .venv/bin/python -m scripts.seed
  )
  echo "Seeding complete."
}

start_backend() {
  echo "Starting backend on http://localhost:8000 ..."
  (
    cd backend
    DATABASE_URL="${DATABASE_URL:-postgresql://impact:impact@localhost:5432/impact}" \
      .venv/bin/uvicorn app.main:app --reload --port 8000
  )
}

start_frontend() {
  echo "Starting frontend on http://localhost:5173 ..."
  (
    cd frontend
    npm run dev
  )
}

if $SEED; then
  seed_db
fi

case "$MODE" in
  backend)
    start_backend
    ;;
  frontend)
    start_frontend
    ;;
  all)
    start_backend &
    BACKEND_PID=$!
    start_frontend &
    FRONTEND_PID=$!
    trap 'kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null' EXIT INT TERM
    wait
    ;;
  *)
    usage
    ;;
esac
