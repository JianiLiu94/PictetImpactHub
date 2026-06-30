# CLAUDE.md

Guidance for Claude Code when working in this repo.

## What this is

PictetImpactHub — a full-stack dashboard for exploring portfolio/company environmental & social
impact data. Two impact dimensions throughout the app:

- **Social impact** — measured in WELLBY (wellbeing-adjusted life years), from `social_impact`
- **Biodiversity impact** — measured in PDF·yr (potentially disappeared fraction of species per year), from `biodiversity_impact`

These two are **never averaged into a single "composite" score** — they're different units and
that concept was explicitly removed from the app (companies/portfolios pages show them side by
side, not blended).

## Stack

- Backend: FastAPI + SQLAlchemy 2.x + PostgreSQL 16
- Frontend: React 18 + TypeScript + Vite, react-router-dom v6
- Tests: pytest (backend), Vitest + @testing-library/react (frontend)

## Common commands

```bash
# First-time setup (creates backend/.venv, npm install, seeds DB)
./pre_launch.sh

# Start everything (backend :8000, frontend :5173)
./run.sh

# Reseed the database before starting (re-run after data files change)
./run.sh --seed

# Start just one side
./run.sh backend
./run.sh frontend

# Seed only, no servers (Mac/Linux)
cd backend && DATABASE_URL=postgresql://impact:impact@localhost:5432/impact .venv/bin/python -m scripts.seed
# Seed only, no servers (Windows PowerShell)
# cd backend; $env:DATABASE_URL="postgresql://impact:impact@localhost:5432/impact"; .\.venv\Scripts\python.exe -m scripts.seed

# Backend tests (Mac/Linux)
cd backend && .venv/bin/python -m pytest -v
# Backend tests (Windows)
# cd backend; .\.venv\Scripts\python.exe -m pytest -v

# Frontend tests
cd frontend && npx vitest run
```

## Architecture

### Backend (`backend/app/`)

- `config.py` — **single source of truth for all env-backed settings**: `DATABASE_URL`,
  `SEED_DATA_DIR`, and the four seed CSV filenames (`SEED_FILE_FINANCIAL`, `SEED_FILE_HOLDINGS`,
  `SEED_FILE_SOCIAL`, `SEED_FILE_BIODIVERSITY`). Don't hardcode paths elsewhere — add new
  env-tunable values here.
- `database.py` — SQLAlchemy engine/session, imports `DATABASE_URL` from `config.py`
- `models.py` — `Company`, `Portfolio`, `Holding`, `SocialImpact`, `BiodiversityImpact`
- `crud.py` — shared query helpers, including `company_raw_impact_totals` (lives here, not in
  `scores.py`, to avoid a circular import between `scores.py` and `portfolios.py`)
- `scoring.py` — `percentile_scores()`: ranks raw per-company totals into a 0–100 percentile
  within the current dataset. A single-entity input always scores 100 (nothing to rank against).
  Scores are **relative to the seeded dataset**, not absolute — if data changes, scores shift.
- `routers/` — `companies.py`, `portfolios.py` (includes server-side sort: `HOLDING_SORT_FIELDS`,
  `_sort_holdings`), `scores.py`
- `scripts/seed.py` — drops and re-seeds all tables from the four CSVs in `SEED_DATA_DIR`. Uses
  `pd.read_csv(path, thousands=",")` because the real `market_value` column has comma-formatted
  numbers (e.g. `"956,233"`) that fail Postgres float casts otherwise.

### Frontend (`frontend/src/`)

Pages (`pages/`): PortfolioSelector, PortfolioDetail, Compare, CompaniesList, CompanyDetail,
Methodology, DevPortal (embeds FastAPI's `/docs` in an iframe), Contact (mailto: form, no SMTP).

Key shared bits:
- `App.tsx` — sidebar nav with a collapse toggle (`sidebarOpen` state); sidebar is sticky
  (`height: 100vh; overflow-y: auto`), only `.content` scrolls.
- `components/PaginatedTable.tsx` — server-side pagination (`limit`/`offset`) + optional
  server-side sort (`sortKey`/`sortBy`/`sortDir`/`onSort`) on columns. Pagination is server-side
  everywhere by design (production-readiness), so sorting must be too where it interacts with
  paginated lists (see `HOLDING_SORT_FIELDS` above).
- `components/Autocomplete.tsx` — floating dropdown w/ keyboard nav, used on Companies list search.
- `components/EntityPicker.tsx` — filtered checklist w/ keyboard nav (ArrowUp/Down/Enter/Escape),
  used in Compare tab to pick portfolios or companies.
- `format.ts` — `humanizeLabel`, `scopeLabel` (maps `direct`→"Own Ops" so social's `own_ops` and
  biodiversity's `direct` scope line up positionally as Upstream/Own Ops/Downstream).
- `categoryIcons.tsx` / `components/Icon.tsx` — icon per impact category.
- Design tokens live in `index.css` `:root` / `[data-theme="dark"]` — light mode is intentionally
  bright/modern (white surfaces, blue brand accent `--brand: #2563eb`, soft shadows via
  `--shadow-sm`/`--shadow-md`); keep new components theme-aware via CSS vars, not hardcoded colors.

### Data flow

`assignmentInput/*.csv` → `scripts/seed.py` → Postgres → FastAPI routers → React pages.

CSV files actually used in seeding (set via `config.py` / env vars, defaults shown):
| File | Used for |
|---|---|
| `financial_data.csv` | Company master data (ticker, isin, market cap, sales) |
| `port_holdings_combined.csv` | Portfolio holdings |
| `social_impact_model_output.csv` | WELLBY social impact rows |
| `biodiversity_model_output.csv` | PDF·yr biodiversity impact rows |

`*_assumed.csv` variants also exist in `assignmentInput/` — these were synthetic stand-ins
generated early in the project when the real files were briefly missing. The real files are now
present and are the defaults; only point `SEED_FILE_*` env vars at the `_assumed` versions if you
specifically need synthetic data.

## Known decisions worth not re-litigating

- No "composite score" averaging social + biodiversity — removed on purpose, different units.
- No quadrant scatter chart for scores — removed, didn't make sense as a visualization; see
  `TODO.md` for remaining polish on `ScoreToggle`'s bar view.
- Pagination is always server-side, even for small lists — explicit production-readiness choice.
- Contact form uses a `mailto:` link rather than real email sending (no SMTP creds available).
