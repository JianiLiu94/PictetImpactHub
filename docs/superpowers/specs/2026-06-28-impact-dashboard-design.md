# Environmental Impact Dashboard MVP — Design

## Overview

Full-stack web app for investment professionals to view and compare the social
impact (WELLBYs) and biodiversity impact (PDF·yr) profile of portfolio
companies. Users browse portfolios, drill into individual companies, and
compare impact across portfolios.

## Data

Four CSVs, joined via `isin`:

| File | Status | Rows | Notes |
|---|---|---|---|
| `financial_data.csv` | provided | 288 | market cap, revenue |
| `biodiversity_model_output.csv` | provided | 4,320 | dense: every company has all 15 scope×category combos |
| `social_impact_model_output_assumed.csv` | **generated** | 3,171 | original file was missing; synthesized to match the PDF's documented schema and row count, with sparse per-company category coverage and mixed positive/negative signs |
| `port_holdings_combined_assumed.csv` | **generated** | 311 | original file was missing; synthesized 3 ETF portfolios, 217 unique companies (some overlap across portfolios), weights normalized to 100% per portfolio |

Both `_assumed` files should be replaced with the real CSVs if/when found,
without any schema changes expected (column names match the PDF exactly).

Models:
1. **Social Impact** — WELLBYs, 3 scopes (upstream/own_ops/downstream) × 12
   categories × 5 stakeholders. Sparse — companies only have rows for
   relevant categories. Values can be positive or negative.
2. **Biodiversity Impact** — PDF·yr, 3 scopes (direct/upstream/downstream) ×
   5 categories. Dense — every company has all 15 combinations. All values
   negative.

## Architecture

**Stack**: FastAPI (Python) + React/TypeScript + PostgreSQL, via
docker-compose for local setup.

**Pagination**: all list-returning endpoints accept optional `limit`/`offset`
query params from day one, defaulting to "return all" at current data
volume (288 companies / 311 holdings), so the design scales to a production
dataset without a breaking API change. This principle applies to backend
queries and frontend list/table components alike — no component should
assume it received the full unpaginated set.

### Data model (PostgreSQL)

- **`companies`** — ticker (PK), company_name, isin, market_cap_usd_m, sales_usd_m
- **`portfolios`** — id, name
- **`holdings`** — portfolio_id (FK), ticker (FK), pct_of_fund, shares, market_value, cusip, sedol
- **`social_impact`** — ticker (FK), scope, category, stakeholder, wellby_per_dollar, wellby_abs
- **`biodiversity_impact`** — ticker (FK), scope, category, value

No migrations tool (Alembic) for MVP scope — plain `create_all()`.

### Seeding

`scripts/seed.py` — manual, run explicitly before first start
(`python -m scripts.seed`). Truncates and reloads all 5 tables from the 4
CSVs. Idempotent — safe to rerun. Skips and logs malformed rows rather than
failing the whole batch; prints a summary of skipped-row counts.

### API

```
GET /portfolios?limit=&offset=             list of {id, name, n_companies, total_market_value}
GET /portfolios/:id                        detail incl. aggregated social + biodiversity summary
GET /portfolios/:id/companies?limit=&offset=  holdings with weights + each company's impact summary
GET /portfolios/compare?ids=1,2,3          aggregated summaries for N portfolios side-by-side

GET /companies/:id                          company detail (financials + both impact summaries)
GET /companies/:id/social-impact            full 3x12x5 grid; missing cells returned as value=null
GET /companies/:id/biodiversity             full 3x5 grid (always dense)

GET /scores?entity_type=company|portfolio&limit=&offset=
                                             normalized 0-100 social_score + biodiversity_score
                                             per entity (percentile rank across the 288-company
                                             universe), used by both the score-bars and the
                                             quadrant-scatter frontend views
```

Design points:
- Portfolio-level impact aggregation (Σ weight × company impact) computed
  server-side, never duplicated in the frontend.
- `/companies/:id/social-impact` always returns all 180 (3×12×5) keys —
  cells with no underlying row get `value: null`, distinguishing "no data"
  from a true measured zero. Biodiversity is always dense, no nulls expected.
- Scores normalized via percentile rank across the full universe (robust to
  outliers vs min-max). Portfolio score = weighted average of constituent
  company scores.
- Unknown ticker/portfolio id → 404 with JSON error body, never a 500.

## Frontend

Pages:
- **Portfolio selector** (`/`) — 3 portfolio cards (name, # holdings, total
  value); multi-select to enter comparison mode.
- **Portfolio detail** (`/portfolios/:id`) — paginated holdings table,
  aggregated social impact chart (12 categories × 3 scopes), aggregated
  biodiversity chart (5 categories × 3 scopes), composite score panel.
- **Portfolio comparison** (`/portfolios/compare?ids=1,2`) — same charts
  per selected portfolio, side-by-side columns, plus one combined quadrant
  scatter with all selected portfolios as distinct-colored dots.
- **Company detail** (`/companies/:ticker`) — full social impact grid (3×12×5,
  no-data cells greyed out, distinct from real zero-height bars), full
  biodiversity grid (3×5, always dense), financials, composite score panel.

Shared components:
- **`ImpactGrid`** — renders the always-show-full-structure grid for either
  model; greys out / labels `null` cells as "no data" vs rendering real
  zero values as actual zero-height bars.
- **`ScoreToggle`** — switches between two composite views of social vs
  biodiversity performance: (a) two normalized 0-100 score bars/gauges side
  by side, or (b) a 2D quadrant scatter (x = social score, y = biodiversity
  score). User-selectable, not a fixed default — both are first-class.
- **`PaginatedTable`** — generic table wrapper built against
  limit/offset-paginated API responses.

## Error handling

- Backend: malformed CSV rows skipped + logged during seeding, not fatal.
  404 (not 500) for unknown entity ids.
- Frontend: each chart/grid/table fetches and handles loading/error state
  independently, so one failed request doesn't blank the whole page.

## Testing

- **Backend (pytest)**: unit tests for aggregation logic (weighted portfolio
  rollups, percentile normalization) and grid no-data-filling logic;
  integration tests for main endpoints (happy path + 404s) against a test DB.
- **Frontend**: component tests for `ImpactGrid` and `ScoreToggle` (the
  trickiest UI logic); no exhaustive page-level test suite given MVP scope.
- **Seeding**: smoke test running `seed.py` against the real CSVs and the
  `_assumed` ones, asserting row counts land in the expected range.

## Deployment / AWS readiness

The project will be deployed to AWS in the future. Nothing in this MVP
requires AWS-specific code, but the local setup is structured so the move is
a packaging/config change, not a rewrite:

- **Stateless backend** — FastAPI holds no local file/session state beyond
  the one-time seed step, so it runs unmodified on ECS/Fargate (or behind
  API Gateway) with multiple replicas.
- **Config via environment variables** — DB connection string, CORS allowed
  origins, etc. are all read from env vars, never hardcoded. Locally these
  come from a `.env` / docker-compose; on AWS the same variables are
  supplied via ECS task definition env vars or SSM Parameter Store, no code
  change.
- **Containerized from day one** — backend ships with its own `Dockerfile`
  (not just a docker-compose service), so the exact image built locally is
  the one pushed to ECR and run on ECS/Fargate.
- **PostgreSQL, not embedded** — local Postgres (via docker-compose) swaps
  for RDS later by changing the connection string env var only.
- **Frontend as a static build** — React build output is plain static
  files with no app-server dependency, so it deploys to S3 + CloudFront
  later exactly as built locally; no server-side rendering to migrate.
- **`GET /health` endpoint** — added now for local smoke-checking, doubles
  as the ALB/ECS target group health check with no extra work later.
