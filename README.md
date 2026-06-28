# Environmental Impact Dashboard MVP

Full-stack dashboard for viewing and comparing portfolio companies' social
impact (WELLBYs) and biodiversity impact (PDF·yr).

## Data

Source CSVs live in `assignmentInput/`. The original assignment was missing
`port_holdings_combined.csv` and `social_impact_model_output.csv`; both were
reconstructed as `*_assumed.csv` files matching the documented schema and row
counts. Swap in the real files (same names, drop the `_assumed` suffix and
update `backend/scripts/seed.py`'s filenames) if/when available.

## Running locally

1. Start Postgres: `docker compose up -d db`
2. Seed the database:
   ```bash
   cd backend
   python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
   DATABASE_URL=postgresql://impact:impact@localhost:5432/impact .venv/bin/python scripts/seed.py
   ```
3. Start the backend: `docker compose up -d backend` (or run `uvicorn app.main:app --reload` locally)
4. Start the frontend:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
5. Open `http://localhost:5173`

## Running tests

- Backend: `cd backend && .venv/bin/pytest tests/ -v`
- Frontend: `cd frontend && npx vitest run`

## Deployment (AWS)

- Backend: containerized (`backend/Dockerfile`), stateless, configured via
  `DATABASE_URL` and `CORS_ORIGINS` env vars — runs on ECS/Fargate behind an
  ALB (use `GET /health` as the target group health check) against RDS
  PostgreSQL.
- Frontend: static Vite build (`frontend/Dockerfile` builds it; for AWS,
  deploy the `dist/` output to S3 + CloudFront instead of running the
  container).
