#!/usr/bin/env bash
# pre_launch.sh — one-time setup for a fresh clone.
# Run this once before using run.sh.
# Safe to re-run: every step is idempotent.
set -euo pipefail
cd "$(dirname "$0")"

###############################################################################
# Helpers
###############################################################################
info()  { echo "  [info]  $*"; }
ok()    { echo "  [ ok ]  $*"; }
warn()  { echo "  [warn]  $*"; }
die()   { echo "  [FAIL]  $*" >&2; exit 1; }

###############################################################################
# 1. Find Python 3.12+
###############################################################################
echo
echo "==> Checking Python..."
PYTHON=""
for candidate in python3.12 python3 python; do
  if command -v "$candidate" &>/dev/null; then
    version=$("$candidate" -c 'import sys; print(sys.version_info[:2])')
    if "$candidate" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 12) else 1)' 2>/dev/null; then
      PYTHON="$candidate"
      ok "Using $PYTHON  ($version)"
      break
    else
      info "$candidate found but version $version < (3,12) — skipping"
    fi
  fi
done
if [[ -z "$PYTHON" ]]; then
  die "Python 3.12+ is required but was not found.\n       Install it from https://python.org or via your package manager."
fi

###############################################################################
# 2. Create backend virtual environment
###############################################################################
echo
echo "==> Setting up Python virtual environment..."
VENV="backend/.venv"
if [[ -d "$VENV" ]]; then
  ok "Virtual environment already exists at $VENV — skipping creation"
else
  "$PYTHON" -m venv "$VENV"
  ok "Created virtual environment at $VENV"
fi

###############################################################################
# 3. Install Python dependencies
###############################################################################
echo
echo "==> Installing Python dependencies..."
"$VENV/bin/pip" install --quiet --upgrade pip
"$VENV/bin/pip" install --quiet -r backend/requirements.txt
ok "Python dependencies installed"

###############################################################################
# 4. Check Node / npm
###############################################################################
echo
echo "==> Checking Node.js..."
if ! command -v node &>/dev/null; then
  die "Node.js is required but was not found.\n       Install it from https://nodejs.org (LTS recommended)."
fi
NODE_VERSION=$(node --version)
ok "node $NODE_VERSION"

if ! command -v npm &>/dev/null; then
  die "npm is required but was not found. It normally ships with Node.js."
fi
ok "npm $(npm --version)"

###############################################################################
# 5. Install frontend dependencies
###############################################################################
echo
echo "==> Installing frontend dependencies..."
(cd frontend && npm install --silent)
ok "Frontend dependencies installed"

###############################################################################
# 6. Check PostgreSQL / Docker
###############################################################################
echo
echo "==> Checking database..."
DB_URL="${DATABASE_URL:-postgresql://impact:impact@localhost:5432/impact}"

if "$VENV/bin/python" -c "
import sys
try:
    import psycopg2
    conn = psycopg2.connect('$DB_URL')
    conn.close()
    sys.exit(0)
except Exception:
    sys.exit(1)
" 2>/dev/null; then
  ok "PostgreSQL reachable at $DB_URL"
else
  warn "PostgreSQL not reachable at $DB_URL"
  echo
  echo "  Start it with Docker (recommended):"
  echo "    docker compose up -d db"
  echo
  echo "  Or set DATABASE_URL to point at an existing PostgreSQL instance before"
  echo "  running this script again, or before running run.sh."
  echo
  # Don't die — user may be about to start Docker separately.
fi

###############################################################################
# 7. Seed the database
###############################################################################
echo
echo "==> Seeding database..."
set +e
(cd backend && DATABASE_URL="$DB_URL" "../$VENV/bin/python" -m scripts.seed)
seed_exit=$?
set -e
if [[ $seed_exit -eq 0 ]]; then
  ok "Database seeded"
else
  warn "Seeding failed. Make sure PostgreSQL is running first:"
  warn "  docker compose up -d db"
  warn "Then re-run:  ./pre_launch.sh"
fi

###############################################################################
# Done
###############################################################################
echo
echo "====================================================="
echo "  Setup complete.  Launch the app with:"
echo "    ./run.sh"
echo "====================================================="
echo
