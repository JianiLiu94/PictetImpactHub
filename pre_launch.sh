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
TRIED=""

# Check one candidate; sets PYTHON and returns 0 on success.
_try_python() {
  local cmd="$1"
  [[ -x "$cmd" ]] || return 1
  if "$cmd" -c 'import sys; sys.exit(0 if sys.version_info >= (3,12) else 1)' 2>/dev/null; then
    local ver
    ver=$("$cmd" -c 'import sys; print(".".join(map(str,sys.version_info[:3])))')
    PYTHON="$cmd"
    ok "Using $cmd  ($ver)"
    return 0
  else
    local ver
    ver=$("$cmd" -c 'import sys; print(".".join(map(str,sys.version_info[:3])))' 2>/dev/null || echo "unknown")
    info "$cmd  →  $ver  (< 3.12, skipping)"
    TRIED="$TRIED  $cmd ($ver)\n"
    return 1
  fi
}

# 1a. pyenv: walk installed versions directly (avoids shim/PATH issues entirely)
if command -v pyenv &>/dev/null; then
  PYENV_ROOT="${PYENV_ROOT:-$(pyenv root 2>/dev/null || echo "$HOME/.pyenv")}"
  # Glob matches 3.12.x, 3.13.x, 3.14.x etc. — sort -rV puts newest first.
  for py in "$PYENV_ROOT/versions"/3.*/bin/python3 "$PYENV_ROOT/versions"/3.*/bin/python; do
    [[ -x "$py" ]] || continue
    _try_python "$py" && break
  done
fi

# 1b. Explicit version-named binaries on PATH
if [[ -z "$PYTHON" ]]; then
  for name in python3.14 python3.13 python3.12; do
    full="$(command -v "$name" 2>/dev/null || true)"
    [[ -n "$full" ]] && _try_python "$full" && break
  done
fi

# 1c. Generic python3 / python on PATH
if [[ -z "$PYTHON" ]]; then
  for name in python3 python; do
    full="$(command -v "$name" 2>/dev/null || true)"
    [[ -n "$full" ]] && _try_python "$full" && break
  done
fi

if [[ -z "$PYTHON" ]]; then
  echo
  echo "  Python 3.12+ not found."
  if [[ -n "$TRIED" ]]; then
    echo "  Versions tried (all < 3.12):"
    printf "%b" "$TRIED"
  fi
  echo
  echo "  Install options:"
  echo "    pyenv install 3.12.10 && pyenv global 3.12.10"
  echo "    brew install python@3.12"
  echo "    https://python.org/downloads"
  die "Python 3.12+ is required."
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
