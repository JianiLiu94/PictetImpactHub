# Environmental Impact Dashboard

Full-stack dashboard for viewing and comparing portfolio companies' social
impact (WELLBYs) and biodiversity impact (PDF·yr).

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Python | 3.12+ | https://python.org |
| Node.js | 18+ (LTS) | https://nodejs.org |
| Docker | any recent | https://docs.docker.com/get-docker/ |

Docker is used only to run PostgreSQL. If you already have a PostgreSQL 16
instance you can skip it and set `DATABASE_URL` instead (see below).

## Quick start

**macOS / Linux**
```bash
# 1. Start the database
docker compose up -d db

# 2. Install everything and seed the database (run once per clone)
./pre_launch.sh

# 3. Launch the app
./run.sh
```

**Windows** (PowerShell)
```powershell
# 1. Start the database
docker compose up -d db

# 2. Install everything and seed the database (run once per clone)
powershell -ExecutionPolicy Bypass -File pre_launch.ps1

# 3. Launch the app
.\run.ps1
```

Open **http://localhost:5173**.

## Run options

macOS / Linux:
```bash
./run.sh              # start backend (:8000) + frontend (:5173)
./run.sh --seed       # re-seed DB then start (use after data files change)
./run.sh backend      # backend only
./run.sh frontend     # frontend only
```

Windows:
```powershell
.\run.ps1             # start both
.\run.ps1 --seed      # re-seed then start
.\run.ps1 backend     # backend only
.\run.ps1 frontend    # frontend only
```

## Environment variables

All settings have sensible defaults. Override by exporting them or placing them
in a `.env` file before running.

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://impact:impact@localhost:5432/impact` | Postgres connection string |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed origins |
| `SEED_DATA_DIR` | `<repo>/assignmentInput` | Folder containing the four CSV files |
| `SEED_FILE_FINANCIAL` | `financial_data.csv` | Company master data |
| `SEED_FILE_HOLDINGS` | `port_holdings_combined.csv` | Portfolio holdings |
| `SEED_FILE_SOCIAL` | `social_impact_model_output.csv` | Social WELLBY rows |
| `SEED_FILE_BIODIVERSITY` | `biodiversity_model_output.csv` | Biodiversity PDF·yr rows |

## Running tests

```bash
# Backend
cd backend && .venv/bin/python -m pytest -v

# Frontend
cd frontend && npx vitest run
```

## Docker Compose (all services)

To run everything in containers (no local Python/Node needed):

```bash
docker compose up --build
```

## Deployment (AWS)

- **Backend**: containerized (`backend/Dockerfile`), stateless, configured via
  `DATABASE_URL` and `CORS_ORIGINS` env vars. Runs on ECS/Fargate behind an
  ALB; use `GET /health` as the target group health check against RDS
  PostgreSQL.
- **Frontend**: static Vite build. Deploy the `dist/` output to S3 +
  CloudFront; set `VITE_API_BASE_URL` at build time to point at the ALB.
