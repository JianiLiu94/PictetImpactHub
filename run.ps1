# run.ps1 — launch the app on Windows (equivalent of run.sh).
#
# Usage:
#   .\run.ps1              # start backend (:8000) + frontend (:5173)
#   .\run.ps1 --seed       # re-seed DB then start
#   .\run.ps1 backend      # backend only
#   .\run.ps1 frontend     # frontend only

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

$DB_URL = if ($env:DATABASE_URL) { $env:DATABASE_URL } else { "postgresql://impact:impact@localhost:5432/impact" }
$PYTHON = "backend\.venv\Scripts\python.exe"
$UVICORN = "backend\.venv\Scripts\uvicorn.exe"

function Seed-DB {
    Write-Host "Seeding database..."
    Push-Location backend
    $env:DATABASE_URL = $DB_URL
    & ".\.venv\Scripts\python.exe" -m scripts.seed
    Pop-Location
    Write-Host "Seeding complete."
}

function Start-Backend {
    Write-Host "Starting backend on http://localhost:8000 ..."
    Push-Location backend
    $env:DATABASE_URL = $DB_URL
    & ".\.venv\Scripts\uvicorn.exe" app.main:app --reload --port 8000
    Pop-Location
}

function Start-Frontend {
    Write-Host "Starting frontend on http://localhost:5173 ..."
    Push-Location frontend
    npm run dev
    Pop-Location
}

# Parse arguments
$SEED = $false
$MODE = "all"

foreach ($arg in $args) {
    switch ($arg) {
        "--seed"    { $SEED = $true }
        "backend"   { $MODE = "backend" }
        "frontend"  { $MODE = "frontend" }
        "all"       { $MODE = "all" }
        default {
            Write-Host "Usage: .\run.ps1 [--seed] [backend|frontend|all]"
            exit 1
        }
    }
}

if ($SEED) { Seed-DB }

switch ($MODE) {
    "backend"  { Start-Backend }
    "frontend" { Start-Frontend }
    "all" {
        # Start backend and frontend in separate windows; Ctrl+C in either closes both.
        $backendJob  = Start-Job -ScriptBlock {
            Set-Location $using:Root\backend
            $env:DATABASE_URL = $using:DB_URL
            & ".\.venv\Scripts\uvicorn.exe" app.main:app --reload --port 8000
        }
        $frontendJob = Start-Job -ScriptBlock {
            Set-Location $using:Root\frontend
            npm run dev
        }

        Write-Host "Backend and frontend started. Press Ctrl+C to stop both."
        try {
            # Stream output from both jobs
            while ($true) {
                Receive-Job $backendJob  -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "[backend]  $_" }
                Receive-Job $frontendJob -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "[frontend] $_" }
                Start-Sleep -Milliseconds 200
            }
        } finally {
            Stop-Job  $backendJob, $frontendJob -ErrorAction SilentlyContinue
            Remove-Job $backendJob, $frontendJob -ErrorAction SilentlyContinue
        }
    }
}
