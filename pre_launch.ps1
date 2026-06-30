# pre_launch.ps1 — one-time setup for a fresh clone on Windows.
# Run this once before using run.ps1.
# Safe to re-run: every step is idempotent.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File pre_launch.ps1
#
# If you see "running scripts is disabled", run once as Administrator:
#   Set-ExecutionPolicy RemoteSigned -Scope CurrentUser

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

function Info  { param($msg) Write-Host "  [info]  $msg" -ForegroundColor Cyan }
function Ok    { param($msg) Write-Host "  [ ok ]  $msg" -ForegroundColor Green }
function Warn  { param($msg) Write-Host "  [warn]  $msg" -ForegroundColor Yellow }
function Die   { param($msg) Write-Host "  [FAIL]  $msg" -ForegroundColor Red; exit 1 }

###############################################################################
# 1. Find Python 3.12+
###############################################################################
Write-Host ""
Write-Host "==> Checking Python..."

$PYTHON = $null
foreach ($candidate in @("python3.12", "python3", "python")) {
    $found = Get-Command $candidate -ErrorAction SilentlyContinue
    if ($found) {
        $ok = & $candidate -c "import sys; sys.exit(0 if sys.version_info >= (3,12) else 1)" 2>$null
        if ($LASTEXITCODE -eq 0) {
            $version = & $candidate -c "import sys; print(sys.version.split()[0])"
            $PYTHON = $candidate
            Ok "Using $PYTHON  ($version)"
            break
        } else {
            $version = & $candidate -c "import sys; print(sys.version.split()[0])" 2>$null
            Info "$candidate found but version $version < 3.12 — skipping"
        }
    }
}
if (-not $PYTHON) {
    Die "Python 3.12+ is required but was not found.`n       Install it from https://python.org"
}

###############################################################################
# 2. Create backend virtual environment
###############################################################################
Write-Host ""
Write-Host "==> Setting up Python virtual environment..."

$VENV = "backend\.venv"
if (Test-Path $VENV) {
    Ok "Virtual environment already exists at $VENV — skipping creation"
} else {
    & $PYTHON -m venv $VENV
    Ok "Created virtual environment at $VENV"
}

$PIP    = "$VENV\Scripts\pip.exe"
$PYTHON_VENV = "$VENV\Scripts\python.exe"

###############################################################################
# 3. Install Python dependencies
###############################################################################
Write-Host ""
Write-Host "==> Installing Python dependencies..."
& $PIP install --quiet --upgrade pip
& $PIP install --quiet -r backend\requirements.txt
Ok "Python dependencies installed"

###############################################################################
# 4. Check Node / npm
###############################################################################
Write-Host ""
Write-Host "==> Checking Node.js..."
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Die "Node.js is required but was not found.`n       Install it from https://nodejs.org (LTS recommended)."
}
Ok "node $(node --version)"

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Die "npm is required but was not found. It normally ships with Node.js."
}
Ok "npm $(npm --version)"

###############################################################################
# 5. Install frontend dependencies
###############################################################################
Write-Host ""
Write-Host "==> Installing frontend dependencies..."
Push-Location frontend
npm install --silent
Pop-Location
Ok "Frontend dependencies installed"

###############################################################################
# 6. Check PostgreSQL / Docker
###############################################################################
Write-Host ""
Write-Host "==> Checking database..."
$DB_URL = if ($env:DATABASE_URL) { $env:DATABASE_URL } else { "postgresql://impact:impact@localhost:5432/impact" }

$probe = & $PYTHON_VENV -c @"
import sys
try:
    import psycopg2
    conn = psycopg2.connect('$DB_URL')
    conn.close()
    sys.exit(0)
except Exception:
    sys.exit(1)
"@ 2>$null
if ($LASTEXITCODE -eq 0) {
    Ok "PostgreSQL reachable at $DB_URL"
} else {
    Warn "PostgreSQL not reachable at $DB_URL"
    Write-Host ""
    Write-Host "  Start it with Docker (recommended):"
    Write-Host "    docker compose up -d db"
    Write-Host ""
    Write-Host "  Or set the DATABASE_URL environment variable to point at an existing instance."
    Write-Host ""
}

###############################################################################
# 7. Seed the database
###############################################################################
Write-Host ""
Write-Host "==> Seeding database..."
Push-Location backend
$env:DATABASE_URL = $DB_URL
& ".\.venv\Scripts\python.exe" -m scripts.seed
$seed_exit = $LASTEXITCODE
Pop-Location

if ($seed_exit -eq 0) {
    Ok "Database seeded"
} else {
    Warn "Seeding failed. Make sure PostgreSQL is running first:"
    Warn "  docker compose up -d db"
    Warn "Then re-run:  .\pre_launch.ps1"
}

###############################################################################
# Done
###############################################################################
Write-Host ""
Write-Host "=====================================================" -ForegroundColor Green
Write-Host "  Setup complete.  Launch the app with:" -ForegroundColor Green
Write-Host "    .\run.ps1" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
Write-Host ""
