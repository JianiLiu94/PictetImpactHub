# Environmental Impact Dashboard MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack dashboard (FastAPI + PostgreSQL backend, React/TypeScript frontend) for viewing and comparing portfolio companies' social impact (WELLBYs) and biodiversity impact (PDF·yr), seeded from the CSVs in `assignmentInput/`.

**Architecture:** Backend is a stateless FastAPI app over PostgreSQL, seeded once via a standalone script, exposing paginated REST endpoints for portfolios/companies/scores. Frontend is a Vite + React + TypeScript SPA with four pages (selector, portfolio detail, comparison, company detail) built on three shared components (`ImpactGrid`, `ScoreToggle`, `PaginatedTable`). Both run locally via docker-compose and are individually containerized for later AWS deployment (ECS/Fargate + RDS + S3/CloudFront).

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.x, PostgreSQL 16, pytest; Node 20, React 18, TypeScript, Vite, Recharts (charts), React Router.

**Reference spec:** `docs/superpowers/specs/2026-06-28-impact-dashboard-design.md`

---

## File Structure

```
backend/
  app/
    __init__.py
    main.py              # FastAPI app, CORS, /health, router registration
    database.py          # SQLAlchemy engine/session, get_db dependency
    models.py            # ORM models: Company, Portfolio, Holding, SocialImpact, BiodiversityImpact
    schemas.py            # Pydantic response models
    crud.py               # query + aggregation functions (portfolio rollups, grid filling)
    scoring.py            # percentile-normalization scoring logic
    routers/
      __init__.py
      portfolios.py
      companies.py
      scores.py
  scripts/
    seed.py               # loads assignmentInput/*.csv into Postgres
  tests/
    conftest.py
    test_scoring.py
    test_crud.py
    test_api.py
  requirements.txt
  Dockerfile
frontend/
  src/
    api/client.ts
    types.ts
    components/ImpactGrid.tsx
    components/ImpactGrid.css
    components/ScoreToggle.tsx
    components/PaginatedTable.tsx
    pages/PortfolioSelector.tsx
    pages/PortfolioDetail.tsx
    pages/PortfolioCompare.tsx
    pages/CompanyDetail.tsx
    App.tsx
    main.tsx
  package.json
  tsconfig.json
  vite.config.ts
  Dockerfile
docker-compose.yml
README.md
```

---

### Task 1: Backend project scaffolding + docker-compose Postgres

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/app/__init__.py`
- Create: `backend/app/database.py`
- Create: `backend/app/main.py`
- Create: `docker-compose.yml`

- [ ] **Step 1: Create `backend/requirements.txt`**

```
fastapi==0.115.0
uvicorn[standard]==0.30.6
sqlalchemy==2.0.35
psycopg2-binary==2.9.9
pydantic==2.9.2
pandas==2.2.3
pytest==8.3.3
httpx==0.27.2
python-dotenv==1.0.1
```

- [ ] **Step 2: Create `backend/app/__init__.py`** (empty file)

- [ ] **Step 3: Create `backend/app/database.py`**

```python
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://impact:impact@localhost:5432/impact",
)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Step 4: Create `backend/app/main.py`**

```python
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Environmental Impact Dashboard API")

allowed_origins = os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 5: Create `docker-compose.yml`** at the project root

```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: impact
      POSTGRES_PASSWORD: impact
      POSTGRES_DB: impact
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgresql://impact:impact@db:5432/impact
      CORS_ORIGINS: http://localhost:5173
    ports:
      - "8000:8000"
    depends_on:
      - db

volumes:
  pgdata:
```

- [ ] **Step 6: Start Postgres and verify the API boots**

Run: `cd /Users/jiani/Projects/study/PictetImpactHub && docker compose up -d db && cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt && .venv/bin/uvicorn app.main:app --reload &`
Then: `curl http://localhost:8000/health`
Expected: `{"status":"ok"}`. Stop the server (`kill %1`) before continuing.

- [ ] **Step 7: Commit**

```bash
git init
git add backend/requirements.txt backend/app/__init__.py backend/app/database.py backend/app/main.py docker-compose.yml
git commit -m "feat: scaffold FastAPI backend with health check and Postgres compose service"
```

---

### Task 2: SQLAlchemy models

**Files:**
- Create: `backend/app/models.py`
- Test: `backend/tests/conftest.py`
- Test: `backend/tests/test_crud.py` (placeholder import check only in this task)

- [ ] **Step 1: Create `backend/app/models.py`**

```python
from sqlalchemy import Column, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class Company(Base):
    __tablename__ = "companies"

    ticker = Column(String, primary_key=True)
    company_name = Column(String, nullable=False)
    isin = Column(String, nullable=False, index=True)
    market_cap_usd_m = Column(Float)
    sales_usd_m = Column(Float)

    holdings = relationship("Holding", back_populates="company")
    social_impacts = relationship("SocialImpact", back_populates="company")
    biodiversity_impacts = relationship("BiodiversityImpact", back_populates="company")


class Portfolio(Base):
    __tablename__ = "portfolios"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False, unique=True)

    holdings = relationship("Holding", back_populates="portfolio")


class Holding(Base):
    __tablename__ = "holdings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id"), nullable=False, index=True)
    ticker = Column(String, ForeignKey("companies.ticker"), nullable=False, index=True)
    cusip = Column(String)
    sedol = Column(String)
    pct_of_fund = Column(Float, nullable=False)
    shares = Column(Integer)
    market_value = Column(Float)

    portfolio = relationship("Portfolio", back_populates="holdings")
    company = relationship("Company", back_populates="holdings")


class SocialImpact(Base):
    __tablename__ = "social_impact"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticker = Column(String, ForeignKey("companies.ticker"), nullable=False, index=True)
    scope = Column(String, nullable=False)
    category = Column(String, nullable=False)
    stakeholder = Column(String, nullable=False)
    wellby_per_dollar = Column(Float, nullable=False)
    wellby_abs = Column(Float, nullable=False)

    company = relationship("Company", back_populates="social_impacts")


class BiodiversityImpact(Base):
    __tablename__ = "biodiversity_impact"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticker = Column(String, ForeignKey("companies.ticker"), nullable=False, index=True)
    scope = Column(String, nullable=False)
    category = Column(String, nullable=False)
    value = Column(Float, nullable=False)

    company = relationship("Company", back_populates="biodiversity_impacts")
```

- [ ] **Step 2: Create `backend/tests/conftest.py`** — uses an in-memory SQLite engine for fast unit tests (schema is simple enough to be DB-agnostic; integration tests against real Postgres come in Task 8)

```python
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app import models  # noqa: F401  (ensures models are registered on Base)


@pytest.fixture()
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()
```

- [ ] **Step 3: Create `backend/tests/test_crud.py`** with a smoke test that models import and create tables cleanly

```python
from app.models import BiodiversityImpact, Company, Holding, Portfolio, SocialImpact


def test_models_create_tables(db_session):
    company = Company(ticker="ABC", company_name="ABC Corp", isin="US0000000000")
    db_session.add(company)
    db_session.commit()

    fetched = db_session.query(Company).filter_by(ticker="ABC").one()
    assert fetched.company_name == "ABC Corp"
```

- [ ] **Step 4: Run the test**

Run: `cd backend && .venv/bin/pytest tests/test_crud.py -v`
Expected: `test_models_create_tables PASSED`

- [ ] **Step 5: Commit**

```bash
git add backend/app/models.py backend/tests/conftest.py backend/tests/test_crud.py
git commit -m "feat: add SQLAlchemy models for companies, portfolios, holdings, and impact data"
```

---

### Task 3: Seed script — companies and portfolios/holdings

**Files:**
- Create: `backend/scripts/__init__.py`
- Create: `backend/scripts/seed.py`

- [ ] **Step 1: Create `backend/scripts/__init__.py`** (empty file)

- [ ] **Step 2: Create `backend/scripts/seed.py`**

```python
import os
import sys
from pathlib import Path

import pandas as pd
from sqlalchemy.orm import Session

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import Base, SessionLocal, engine
from app.models import BiodiversityImpact, Company, Holding, Portfolio, SocialImpact

DATA_DIR = Path(__file__).resolve().parents[2] / "assignmentInput"


def _read_csv(filename: str) -> pd.DataFrame:
    path = DATA_DIR / filename
    df = pd.read_csv(path)
    before = len(df)
    df = df.dropna(how="all")
    skipped = before - len(df)
    if skipped:
        print(f"{filename}: skipped {skipped} fully-empty rows")
    return df


def seed_companies(db: Session) -> None:
    fin = _read_csv("financial_data.csv")
    bad_rows = 0
    for _, row in fin.iterrows():
        if pd.isna(row.get("ticker")) or pd.isna(row.get("isin")):
            bad_rows += 1
            continue
        db.merge(
            Company(
                ticker=str(row["ticker"]),
                company_name=row.get("company_name", ""),
                isin=row["isin"],
                market_cap_usd_m=row.get("market_cap_usd_m"),
                sales_usd_m=row.get("sales_usd_m"),
            )
        )
    db.commit()
    print(f"companies: seeded {len(fin) - bad_rows}, skipped {bad_rows}")


def seed_portfolios_and_holdings(db: Session) -> None:
    holdings = _read_csv("port_holdings_combined_assumed.csv")
    portfolio_names = holdings["portfolio"].dropna().unique().tolist()
    name_to_id = {}
    for name in portfolio_names:
        portfolio = db.merge(Portfolio(name=name))
        db.flush()
        name_to_id[name] = portfolio.id
    db.commit()

    bad_rows = 0
    for _, row in holdings.iterrows():
        if pd.isna(row.get("ticker")) or pd.isna(row.get("portfolio")):
            bad_rows += 1
            continue
        db.add(
            Holding(
                portfolio_id=name_to_id[row["portfolio"]],
                ticker=str(row["ticker"]),
                cusip=row.get("cusip"),
                sedol=row.get("sedol"),
                pct_of_fund=row["pct_of_fund"],
                shares=row.get("shares"),
                market_value=row.get("market_value"),
            )
        )
    db.commit()
    print(f"holdings: seeded {len(holdings) - bad_rows}, skipped {bad_rows}")


def seed_social_impact(db: Session) -> None:
    social = _read_csv("social_impact_model_output_assumed.csv")
    bad_rows = 0
    for _, row in social.iterrows():
        if pd.isna(row.get("ticker")):
            bad_rows += 1
            continue
        db.add(
            SocialImpact(
                ticker=str(row["ticker"]),
                scope=row["scope"],
                category=row["category"],
                stakeholder=row["stakeholder"],
                wellby_per_dollar=row["wellby_per_dollar"],
                wellby_abs=row["wellby_abs"],
            )
        )
    db.commit()
    print(f"social_impact: seeded {len(social) - bad_rows}, skipped {bad_rows}")


def seed_biodiversity_impact(db: Session) -> None:
    bio = _read_csv("biodiversity_model_output.csv")
    bad_rows = 0
    for _, row in bio.iterrows():
        if pd.isna(row.get("ticker")):
            bad_rows += 1
            continue
        db.add(
            BiodiversityImpact(
                ticker=str(row["ticker"]),
                scope=row["scope"],
                category=row["category"],
                value=row["value"],
            )
        )
    db.commit()
    print(f"biodiversity_impact: seeded {len(bio) - bad_rows}, skipped {bad_rows}")


def main() -> None:
    Base.metadata.create_all(engine)
    db = SessionLocal()
    try:
        for table in [BiodiversityImpact, SocialImpact, Holding, Portfolio, Company]:
            db.query(table).delete()
        db.commit()

        seed_companies(db)
        seed_portfolios_and_holdings(db)
        seed_social_impact(db)
        seed_biodiversity_impact(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Run the seed script against the dockerized Postgres**

Run: `cd /Users/jiani/Projects/study/PictetImpactHub && docker compose up -d db && cd backend && DATABASE_URL=postgresql://impact:impact@localhost:5432/impact .venv/bin/python scripts/seed.py`
Expected output ends with four "seeded N, skipped 0 (or near-0)" lines, no tracebacks.

- [ ] **Step 4: Spot-check row counts**

Run: `docker compose exec db psql -U impact -d impact -c "select count(*) from companies; select count(*) from holdings; select count(*) from social_impact; select count(*) from biodiversity_impact;"`
Expected: 288 companies, 311 holdings, ~3171 social_impact rows, 4320 biodiversity_impact rows.

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/__init__.py backend/scripts/seed.py
git commit -m "feat: add CSV seed script for companies, holdings, and impact tables"
```

---

### Task 4: Scoring module (percentile normalization) with unit tests

**Files:**
- Create: `backend/app/scoring.py`
- Test: `backend/tests/test_scoring.py`

- [ ] **Step 1: Write the failing test in `backend/tests/test_scoring.py`**

```python
from app.scoring import percentile_scores


def test_percentile_scores_orders_low_to_high():
    raw = {"A": 10.0, "B": 30.0, "C": 20.0}
    scores = percentile_scores(raw)

    assert scores["A"] < scores["C"] < scores["B"]
    assert all(0.0 <= v <= 100.0 for v in scores.values())


def test_percentile_scores_handles_ties():
    raw = {"A": 5.0, "B": 5.0, "C": 10.0}
    scores = percentile_scores(raw)

    assert scores["A"] == scores["B"]
    assert scores["C"] > scores["A"]


def test_percentile_scores_single_entity_returns_100():
    raw = {"A": 42.0}
    scores = percentile_scores(raw)

    assert scores["A"] == 100.0
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && .venv/bin/pytest tests/test_scoring.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.scoring'`

- [ ] **Step 3: Implement `backend/app/scoring.py`**

```python
def percentile_scores(raw_values: dict[str, float]) -> dict[str, float]:
    """Map raw values to a 0-100 percentile rank within the given set.

    Ties receive the same score (average-rank percentile). A single-entity
    input returns 100.0 since there is nothing to rank it against.
    """
    if not raw_values:
        return {}

    keys = list(raw_values.keys())
    values = [raw_values[k] for k in keys]
    n = len(values)

    if n == 1:
        return {keys[0]: 100.0}

    sorted_values = sorted(values)

    def percentile_of(value: float) -> float:
        less = sum(1 for v in sorted_values if v < value)
        equal = sum(1 for v in sorted_values if v == value)
        # average-rank percentile: rank of ties is the midpoint of their span
        rank = less + (equal - 1) / 2
        return round(rank / (n - 1) * 100, 4)

    return {k: percentile_of(raw_values[k]) for k in keys}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd backend && .venv/bin/pytest tests/test_scoring.py -v`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/scoring.py backend/tests/test_scoring.py
git commit -m "feat: add percentile-rank scoring for social and biodiversity comparisons"
```

---

### Task 5: Aggregation + grid-filling logic in `crud.py` with unit tests

**Files:**
- Create: `backend/app/crud.py`
- Test: `backend/tests/test_crud.py` (extend)

- [ ] **Step 1: Write failing tests, appended to `backend/tests/test_crud.py`**

```python
from app.crud import (
    SOCIAL_CATEGORIES,
    SOCIAL_SCOPES,
    SOCIAL_STAKEHOLDERS,
    BIO_CATEGORIES,
    BIO_SCOPES,
    build_social_grid,
    build_biodiversity_grid,
    weighted_portfolio_value,
)


def test_build_social_grid_fills_missing_with_none(db_session):
    rows = [
        {"scope": "upstream", "category": "health", "stakeholder": "customers", "wellby_abs": 5.0},
    ]
    grid = build_social_grid(rows)

    assert len(grid) == len(SOCIAL_SCOPES) * len(SOCIAL_CATEGORIES) * len(SOCIAL_STAKEHOLDERS)
    present = [c for c in grid if c["scope"] == "upstream" and c["category"] == "health" and c["stakeholder"] == "customers"]
    assert present[0]["value"] == 5.0
    missing = [c for c in grid if c["scope"] == "downstream" and c["category"] == "health" and c["stakeholder"] == "customers"]
    assert missing[0]["value"] is None


def test_build_biodiversity_grid_is_always_dense(db_session):
    rows = [
        {"scope": s, "category": c, "value": -1.0} for s in BIO_SCOPES for c in BIO_CATEGORIES
    ]
    grid = build_biodiversity_grid(rows)

    assert len(grid) == len(BIO_SCOPES) * len(BIO_CATEGORIES)
    assert all(cell["value"] == -1.0 for cell in grid)


def test_weighted_portfolio_value():
    holdings = [{"ticker": "A", "pct_of_fund": 60.0}, {"ticker": "B", "pct_of_fund": 40.0}]
    impact_by_ticker = {"A": 10.0, "B": -5.0}

    result = weighted_portfolio_value(holdings, impact_by_ticker)

    assert result == (60.0 / 100 * 10.0) + (40.0 / 100 * -5.0)
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && .venv/bin/pytest tests/test_crud.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.crud'`

- [ ] **Step 3: Implement `backend/app/crud.py`**

```python
from itertools import product

SOCIAL_SCOPES = ["upstream", "own_ops", "downstream"]
SOCIAL_CATEGORIES = [
    "connectivity", "employment", "energy", "health", "housing", "income_wealth",
    "knowledge", "leisure", "mobility", "nutrition", "safety", "water",
]
SOCIAL_STAKEHOLDERS = ["customers", "employees", "gov_communities", "shareholders", "suppliers"]

BIO_SCOPES = ["direct", "upstream", "downstream"]
BIO_CATEGORIES = ["acidification", "climate_change", "eutrophication", "land_use", "water_stress"]


def build_social_grid(rows: list[dict]) -> list[dict]:
    """Always return all scope x category x stakeholder combinations.

    Cells with no matching row get value=None, distinguishing "no data"
    from a real measured zero.
    """
    lookup = {(r["scope"], r["category"], r["stakeholder"]): r["wellby_abs"] for r in rows}
    grid = []
    for scope, category, stakeholder in product(SOCIAL_SCOPES, SOCIAL_CATEGORIES, SOCIAL_STAKEHOLDERS):
        grid.append({
            "scope": scope,
            "category": category,
            "stakeholder": stakeholder,
            "value": lookup.get((scope, category, stakeholder)),
        })
    return grid


def build_biodiversity_grid(rows: list[dict]) -> list[dict]:
    """Always return all scope x category combinations (data is expected dense)."""
    lookup = {(r["scope"], r["category"]): r["value"] for r in rows}
    grid = []
    for scope, category in product(BIO_SCOPES, BIO_CATEGORIES):
        grid.append({
            "scope": scope,
            "category": category,
            "value": lookup.get((scope, category)),
        })
    return grid


def weighted_portfolio_value(holdings: list[dict], impact_by_ticker: dict[str, float]) -> float:
    """Sum of holding weight (as a fraction of 100) times each company's impact value.

    Holdings for companies with no entry in impact_by_ticker are skipped
    (treated as no contribution), not errored.
    """
    total = 0.0
    for holding in holdings:
        value = impact_by_ticker.get(holding["ticker"])
        if value is None:
            continue
        total += (holding["pct_of_fund"] / 100) * value
    return total
```

- [ ] **Step 4: Run to verify pass**

Run: `cd backend && .venv/bin/pytest tests/test_crud.py -v`
Expected: all tests passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/crud.py backend/tests/test_crud.py
git commit -m "feat: add portfolio aggregation and full-grid-filling logic"
```

---

### Task 6: Pydantic schemas + pagination helper

**Files:**
- Create: `backend/app/schemas.py`

- [ ] **Step 1: Create `backend/app/schemas.py`**

```python
from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    limit: int | None = None
    offset: int = 0


class CompanySummary(BaseModel):
    ticker: str
    company_name: str
    isin: str
    market_cap_usd_m: float | None = None
    sales_usd_m: float | None = None


class HoldingOut(BaseModel):
    ticker: str
    company_name: str
    pct_of_fund: float
    shares: int | None = None
    market_value: float | None = None


class PortfolioSummary(BaseModel):
    id: int
    name: str
    n_companies: int
    total_market_value: float


class GridCell(BaseModel):
    scope: str
    category: str
    stakeholder: str | None = None
    value: float | None = None


class ImpactSummary(BaseModel):
    social_total_wellby: float
    biodiversity_total_pdf_yr: float


class PortfolioDetail(PortfolioSummary):
    impact: ImpactSummary


class CompanyDetail(CompanySummary):
    social_grid: list[GridCell]
    biodiversity_grid: list[GridCell]


class ScoreOut(BaseModel):
    entity_id: str
    name: str
    social_score: float
    biodiversity_score: float
```

- [ ] **Step 2: Verify it imports cleanly**

Run: `cd backend && .venv/bin/python -c "from app import schemas; print('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add backend/app/schemas.py
git commit -m "feat: add Pydantic response schemas with generic pagination wrapper"
```

---

### Task 7: Companies router

**Files:**
- Create: `backend/app/routers/__init__.py`
- Create: `backend/app/routers/companies.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_api.py`

- [ ] **Step 1: Create `backend/app/routers/__init__.py`** (empty file)

- [ ] **Step 2: Create `backend/app/routers/companies.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.crud import build_biodiversity_grid, build_social_grid
from app.database import get_db
from app.models import BiodiversityImpact, Company, SocialImpact
from app.schemas import CompanyDetail, CompanySummary, Page

router = APIRouter(prefix="/companies", tags=["companies"])


@router.get("", response_model=Page[CompanySummary])
def list_companies(limit: int | None = None, offset: int = 0, db: Session = Depends(get_db)):
    query = db.query(Company).order_by(Company.ticker)
    total = query.count()
    if limit is not None:
        query = query.offset(offset).limit(limit)
    companies = query.all()
    return Page(items=companies, total=total, limit=limit, offset=offset)


@router.get("/{ticker}", response_model=CompanyDetail)
def get_company(ticker: str, db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.ticker == ticker).first()
    if company is None:
        raise HTTPException(status_code=404, detail=f"Company '{ticker}' not found")

    social_rows = [
        {"scope": r.scope, "category": r.category, "stakeholder": r.stakeholder, "wellby_abs": r.wellby_abs}
        for r in db.query(SocialImpact).filter(SocialImpact.ticker == ticker).all()
    ]
    bio_rows = [
        {"scope": r.scope, "category": r.category, "value": r.value}
        for r in db.query(BiodiversityImpact).filter(BiodiversityImpact.ticker == ticker).all()
    ]

    return CompanyDetail(
        ticker=company.ticker,
        company_name=company.company_name,
        isin=company.isin,
        market_cap_usd_m=company.market_cap_usd_m,
        sales_usd_m=company.sales_usd_m,
        social_grid=build_social_grid(social_rows),
        biodiversity_grid=build_biodiversity_grid(bio_rows),
    )
```

- [ ] **Step 3: Register the router in `backend/app/main.py`** — add import and include_router below the existing `/health` route

```python
from app.routers import companies

app.include_router(companies.router)
```

- [ ] **Step 4: Write `backend/tests/test_api.py`** — integration tests against an isolated in-memory SQLite override of `get_db`

```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app
from app.models import Company


@pytest.fixture()
def client():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine)

    def override_get_db():
        db = TestSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    seed_db = TestSession()
    seed_db.add(Company(ticker="ABC", company_name="ABC Corp", isin="US0000000000",
                         market_cap_usd_m=100.0, sales_usd_m=50.0))
    seed_db.commit()
    seed_db.close()

    yield TestClient(app)
    app.dependency_overrides.clear()


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_list_companies(client):
    response = client.get("/companies")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["ticker"] == "ABC"


def test_get_company_full_grid(client):
    response = client.get("/companies/ABC")
    assert response.status_code == 200
    body = response.json()
    assert len(body["social_grid"]) == 3 * 12 * 5
    assert len(body["biodiversity_grid"]) == 3 * 5
    assert all(cell["value"] is None for cell in body["social_grid"])


def test_get_company_404(client):
    response = client.get("/companies/NOPE")
    assert response.status_code == 404
```

- [ ] **Step 5: Run tests**

Run: `cd backend && .venv/bin/pytest tests/test_api.py -v`
Expected: 4 passed

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/__init__.py backend/app/routers/companies.py backend/app/main.py backend/tests/test_api.py
git commit -m "feat: add companies API router with paginated list and full-grid detail endpoint"
```

---

### Task 8: Portfolios router (detail, companies, compare)

**Files:**
- Create: `backend/app/routers/portfolios.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_api.py` (extend)

- [ ] **Step 1: Create `backend/app/routers/portfolios.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.crud import weighted_portfolio_value
from app.database import get_db
from app.models import BiodiversityImpact, Company, Holding, Portfolio, SocialImpact
from app.schemas import HoldingOut, ImpactSummary, Page, PortfolioDetail, PortfolioSummary

router = APIRouter(prefix="/portfolios", tags=["portfolios"])


def _portfolio_holdings(db: Session, portfolio_id: int) -> list[dict]:
    rows = (
        db.query(Holding, Company)
        .join(Company, Holding.ticker == Company.ticker)
        .filter(Holding.portfolio_id == portfolio_id)
        .all()
    )
    return [
        {
            "ticker": h.ticker,
            "company_name": c.company_name,
            "pct_of_fund": h.pct_of_fund,
            "shares": h.shares,
            "market_value": h.market_value,
        }
        for h, c in rows
    ]


def _portfolio_impact(db: Session, holdings: list[dict]) -> ImpactSummary:
    tickers = [h["ticker"] for h in holdings]

    social_total_by_ticker: dict[str, float] = {}
    for row in db.query(SocialImpact).filter(SocialImpact.ticker.in_(tickers)).all():
        social_total_by_ticker[row.ticker] = social_total_by_ticker.get(row.ticker, 0.0) + row.wellby_abs

    bio_total_by_ticker: dict[str, float] = {}
    for row in db.query(BiodiversityImpact).filter(BiodiversityImpact.ticker.in_(tickers)).all():
        bio_total_by_ticker[row.ticker] = bio_total_by_ticker.get(row.ticker, 0.0) + row.value

    return ImpactSummary(
        social_total_wellby=weighted_portfolio_value(holdings, social_total_by_ticker),
        biodiversity_total_pdf_yr=weighted_portfolio_value(holdings, bio_total_by_ticker),
    )


def _get_portfolio_or_404(db: Session, portfolio_id: int) -> Portfolio:
    portfolio = db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
    if portfolio is None:
        raise HTTPException(status_code=404, detail=f"Portfolio {portfolio_id} not found")
    return portfolio


@router.get("", response_model=Page[PortfolioSummary])
def list_portfolios(limit: int | None = None, offset: int = 0, db: Session = Depends(get_db)):
    query = db.query(Portfolio).order_by(Portfolio.id)
    total = query.count()
    if limit is not None:
        query = query.offset(offset).limit(limit)
    portfolios = query.all()

    summaries = []
    for p in portfolios:
        holdings = _portfolio_holdings(db, p.id)
        summaries.append(PortfolioSummary(
            id=p.id,
            name=p.name,
            n_companies=len(holdings),
            total_market_value=sum(h["market_value"] or 0.0 for h in holdings),
        ))
    return Page(items=summaries, total=total, limit=limit, offset=offset)


@router.get("/{portfolio_id}", response_model=PortfolioDetail)
def get_portfolio(portfolio_id: int, db: Session = Depends(get_db)):
    portfolio = _get_portfolio_or_404(db, portfolio_id)
    holdings = _portfolio_holdings(db, portfolio_id)
    return PortfolioDetail(
        id=portfolio.id,
        name=portfolio.name,
        n_companies=len(holdings),
        total_market_value=sum(h["market_value"] or 0.0 for h in holdings),
        impact=_portfolio_impact(db, holdings),
    )


@router.get("/{portfolio_id}/companies", response_model=Page[HoldingOut])
def get_portfolio_companies(
    portfolio_id: int, limit: int | None = None, offset: int = 0, db: Session = Depends(get_db)
):
    _get_portfolio_or_404(db, portfolio_id)
    holdings = _portfolio_holdings(db, portfolio_id)
    total = len(holdings)
    if limit is not None:
        holdings = holdings[offset: offset + limit]
    return Page(items=holdings, total=total, limit=limit, offset=offset)


@router.get("/compare", response_model=list[PortfolioDetail])
def compare_portfolios(ids: str, db: Session = Depends(get_db)):
    portfolio_ids = [int(x) for x in ids.split(",") if x.strip()]
    results = []
    for portfolio_id in portfolio_ids:
        portfolio = _get_portfolio_or_404(db, portfolio_id)
        holdings = _portfolio_holdings(db, portfolio_id)
        results.append(PortfolioDetail(
            id=portfolio.id,
            name=portfolio.name,
            n_companies=len(holdings),
            total_market_value=sum(h["market_value"] or 0.0 for h in holdings),
            impact=_portfolio_impact(db, holdings),
        ))
    return results
```

**Note on route ordering:** `/compare` must be registered before `/{portfolio_id}` would otherwise shadow it — but since `/compare` is not a valid integer path param, FastAPI's path matching still resolves correctly because `{portfolio_id}` has no type constraint at the route level here (string). To avoid ambiguity, the route order above already declares `/{portfolio_id}` before `/compare` in code — **this is wrong and must be fixed**: define `/compare` ABOVE `/{portfolio_id}` in the file so it's matched first.

- [ ] **Step 2: Reorder routes** — move the `compare_portfolios` function (and its `@router.get("/compare", ...)` decorator) so it appears immediately after `list_portfolios` and before `get_portfolio` in `backend/app/routers/portfolios.py`.

- [ ] **Step 3: Register the router in `backend/app/main.py`**

```python
from app.routers import companies, portfolios

app.include_router(companies.router)
app.include_router(portfolios.router)
```

- [ ] **Step 4: Append tests to `backend/tests/test_api.py`**

```python
from app.models import Holding, Portfolio


@pytest.fixture()
def client_with_portfolio():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine)

    def override_get_db():
        db = TestSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    seed_db = TestSession()
    seed_db.add_all([
        Company(ticker="ABC", company_name="ABC Corp", isin="US0000000000", sales_usd_m=50.0),
        Company(ticker="XYZ", company_name="XYZ Inc", isin="US0000000001", sales_usd_m=20.0),
        Portfolio(id=1, name="Test Fund"),
        Holding(portfolio_id=1, ticker="ABC", pct_of_fund=60.0, shares=10, market_value=1000.0),
        Holding(portfolio_id=1, ticker="XYZ", pct_of_fund=40.0, shares=5, market_value=500.0),
        SocialImpact(ticker="ABC", scope="upstream", category="health", stakeholder="customers", wellby_per_dollar=0.1, wellby_abs=5.0),
        BiodiversityImpact(ticker="ABC", scope="direct", category="climate_change", value=-2.0),
    ])
    seed_db.commit()
    seed_db.close()

    yield TestClient(app)
    app.dependency_overrides.clear()


def test_get_portfolio_detail(client_with_portfolio):
    response = client_with_portfolio.get("/portfolios/1")
    assert response.status_code == 200
    body = response.json()
    assert body["n_companies"] == 2
    assert body["total_market_value"] == 1500.0
    assert body["impact"]["social_total_wellby"] == 0.6 * 5.0
    assert body["impact"]["biodiversity_total_pdf_yr"] == 0.6 * -2.0


def test_get_portfolio_404(client_with_portfolio):
    response = client_with_portfolio.get("/portfolios/999")
    assert response.status_code == 404


def test_compare_portfolios(client_with_portfolio):
    response = client_with_portfolio.get("/portfolios/compare", params={"ids": "1"})
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["id"] == 1
```

Add `from app.models import BiodiversityImpact, Company, Holding, Portfolio, SocialImpact` to the top imports of `test_api.py` if not already present from Task 7.

- [ ] **Step 5: Run tests**

Run: `cd backend && .venv/bin/pytest tests/test_api.py -v`
Expected: 7 passed

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/portfolios.py backend/app/main.py backend/tests/test_api.py
git commit -m "feat: add portfolios API router with detail, holdings, and compare endpoints"
```

---

### Task 9: Scores router (percentile scores for score-bars and quadrant-scatter)

**Files:**
- Create: `backend/app/routers/scores.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_api.py` (extend)

- [ ] **Step 1: Create `backend/app/routers/scores.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.crud import weighted_portfolio_value
from app.database import get_db
from app.models import BiodiversityImpact, Company, Holding, SocialImpact
from app.scoring import percentile_scores
from app.schemas import Page, ScoreOut

router = APIRouter(prefix="/scores", tags=["scores"])


def _company_raw_totals(db: Session) -> tuple[dict[str, float], dict[str, float]]:
    social_totals: dict[str, float] = {}
    for row in db.query(SocialImpact).all():
        social_totals[row.ticker] = social_totals.get(row.ticker, 0.0) + row.wellby_abs

    bio_totals: dict[str, float] = {}
    for row in db.query(BiodiversityImpact).all():
        bio_totals[row.ticker] = bio_totals.get(row.ticker, 0.0) + row.value

    return social_totals, bio_totals


@router.get("", response_model=Page[ScoreOut])
def get_scores(
    entity_type: str, limit: int | None = None, offset: int = 0, db: Session = Depends(get_db)
):
    if entity_type not in ("company", "portfolio"):
        raise HTTPException(status_code=400, detail="entity_type must be 'company' or 'portfolio'")

    social_totals, bio_totals = _company_raw_totals(db)
    all_tickers = set(social_totals) | set(bio_totals) | {c.ticker for c in db.query(Company).all()}
    social_totals = {t: social_totals.get(t, 0.0) for t in all_tickers}
    bio_totals = {t: bio_totals.get(t, 0.0) for t in all_tickers}

    company_social_scores = percentile_scores(social_totals)
    company_bio_scores = percentile_scores(bio_totals)

    names = {c.ticker: c.company_name for c in db.query(Company).all()}

    if entity_type == "company":
        items = [
            ScoreOut(
                entity_id=ticker,
                name=names.get(ticker, ticker),
                social_score=company_social_scores[ticker],
                biodiversity_score=company_bio_scores[ticker],
            )
            for ticker in all_tickers
        ]
    else:
        from app.models import Portfolio

        items = []
        for portfolio in db.query(Portfolio).all():
            holdings = [
                {"ticker": h.ticker, "pct_of_fund": h.pct_of_fund}
                for h in db.query(Holding).filter(Holding.portfolio_id == portfolio.id).all()
            ]
            items.append(ScoreOut(
                entity_id=str(portfolio.id),
                name=portfolio.name,
                social_score=weighted_portfolio_value(holdings, company_social_scores),
                biodiversity_score=weighted_portfolio_value(holdings, company_bio_scores),
            ))

    items.sort(key=lambda x: x.entity_id)
    total = len(items)
    if limit is not None:
        items = items[offset: offset + limit]
    return Page(items=items, total=total, limit=limit, offset=offset)
```

- [ ] **Step 2: Register the router in `backend/app/main.py`**

```python
from app.routers import companies, portfolios, scores

app.include_router(companies.router)
app.include_router(portfolios.router)
app.include_router(scores.router)
```

- [ ] **Step 3: Append a test to `backend/tests/test_api.py`**

```python
def test_get_company_scores(client_with_portfolio):
    response = client_with_portfolio.get("/scores", params={"entity_type": "company"})
    assert response.status_code == 200
    body = response.json()
    tickers = {item["entity_id"] for item in body["items"]}
    assert tickers == {"ABC", "XYZ"}
    abc_score = next(item for item in body["items"] if item["entity_id"] == "ABC")
    assert abc_score["social_score"] == 100.0  # only ABC has social impact, so it ranks highest
```

- [ ] **Step 4: Run tests**

Run: `cd backend && .venv/bin/pytest tests/test_api.py -v`
Expected: 8 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/scores.py backend/app/main.py backend/tests/test_api.py
git commit -m "feat: add scores API router with percentile-normalized company and portfolio scores"
```

---

### Task 10: Backend Dockerfile + full pytest run + seeding smoke test

**Files:**
- Create: `backend/Dockerfile`
- Test: `backend/tests/test_seed_smoke.py`

- [ ] **Step 1: Create `backend/Dockerfile`**

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 2: Create `backend/tests/test_seed_smoke.py`**

```python
import subprocess
import sys
from pathlib import Path

import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import BiodiversityImpact, Company, Holding, SocialImpact

BACKEND_DIR = Path(__file__).resolve().parents[1]


@pytest.mark.skipif(
    "DATABASE_URL" not in __import__("os").environ,
    reason="requires a live Postgres instance via DATABASE_URL (integration smoke test)",
)
def test_seed_script_loads_expected_row_counts():
    subprocess.run([sys.executable, str(BACKEND_DIR / "scripts" / "seed.py")], check=True)

    from app.database import engine as live_engine

    Session = sessionmaker(bind=live_engine)
    db = Session()
    try:
        assert db.query(Company).count() == 288
        assert db.query(Holding).count() == 311
        assert 3000 <= db.query(SocialImpact).count() <= 3300
        assert db.query(BiodiversityImpact).count() == 4320
    finally:
        db.close()
```

- [ ] **Step 3: Run the full backend test suite (unit tests; smoke test auto-skips without `DATABASE_URL`)**

Run: `cd backend && .venv/bin/pytest tests/ -v`
Expected: all tests pass; `test_seed_script_loads_expected_row_counts` shows `SKIPPED` if `DATABASE_URL` is unset.

- [ ] **Step 4: Run the smoke test for real against the dockerized Postgres**

Run: `docker compose up -d db && DATABASE_URL=postgresql://impact:impact@localhost:5432/impact .venv/bin/pytest tests/test_seed_smoke.py -v`
Expected: 1 passed

- [ ] **Step 5: Build the backend image and verify it boots**

Run: `cd /Users/jiani/Projects/study/PictetImpactHub && docker compose build backend && docker compose up -d && curl http://localhost:8000/health`
Expected: `{"status":"ok"}`

- [ ] **Step 6: Commit**

```bash
git add backend/Dockerfile backend/tests/test_seed_smoke.py
git commit -m "feat: containerize backend and add seeding smoke test"
```

---

### Task 11: Frontend scaffold (Vite + React + TS) + API client + types

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/types.ts`
- Create: `frontend/src/api/client.ts`

- [ ] **Step 1: Scaffold via Vite CLI**

Run: `cd /Users/jiani/Projects/study/PictetImpactHub && npm create vite@latest frontend -- --template react-ts`
Then: `cd frontend && npm install && npm install react-router-dom recharts`

- [ ] **Step 2: Create `frontend/src/types.ts`**

```typescript
export interface CompanySummary {
  ticker: string;
  company_name: string;
  isin: string;
  market_cap_usd_m: number | null;
  sales_usd_m: number | null;
}

export interface GridCell {
  scope: string;
  category: string;
  stakeholder: string | null;
  value: number | null;
}

export interface CompanyDetail extends CompanySummary {
  social_grid: GridCell[];
  biodiversity_grid: GridCell[];
}

export interface ImpactSummary {
  social_total_wellby: number;
  biodiversity_total_pdf_yr: number;
}

export interface PortfolioSummary {
  id: number;
  name: string;
  n_companies: number;
  total_market_value: number;
}

export interface PortfolioDetail extends PortfolioSummary {
  impact: ImpactSummary;
}

export interface HoldingOut {
  ticker: string;
  company_name: string;
  pct_of_fund: number;
  shares: number | null;
  market_value: number | null;
}

export interface ScoreOut {
  entity_id: string;
  name: string;
  social_score: number;
  biodiversity_score: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number | null;
  offset: number;
}
```

- [ ] **Step 3: Create `frontend/src/api/client.ts`**

```typescript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`Request to ${path} failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

import type {
  CompanyDetail,
  CompanySummary,
  HoldingOut,
  Page,
  PortfolioDetail,
  PortfolioSummary,
  ScoreOut,
} from "../types";

export const api = {
  listPortfolios: (limit?: number, offset = 0) =>
    request<Page<PortfolioSummary>>(`/portfolios?${limit ? `limit=${limit}&` : ""}offset=${offset}`),
  getPortfolio: (id: number) => request<PortfolioDetail>(`/portfolios/${id}`),
  getPortfolioCompanies: (id: number, limit?: number, offset = 0) =>
    request<Page<HoldingOut>>(`/portfolios/${id}/companies?${limit ? `limit=${limit}&` : ""}offset=${offset}`),
  comparePortfolios: (ids: number[]) =>
    request<PortfolioDetail[]>(`/portfolios/compare?ids=${ids.join(",")}`),
  listCompanies: (limit?: number, offset = 0) =>
    request<Page<CompanySummary>>(`/companies?${limit ? `limit=${limit}&` : ""}offset=${offset}`),
  getCompany: (ticker: string) => request<CompanyDetail>(`/companies/${ticker}`),
  getScores: (entityType: "company" | "portfolio") =>
    request<Page<ScoreOut>>(`/scores?entity_type=${entityType}`),
};
```

- [ ] **Step 4: Replace `frontend/src/App.tsx`** with a router shell (pages are added in later tasks; this task wires a placeholder for each route)

```tsx
import { BrowserRouter, Route, Routes, Link } from "react-router-dom";

function Placeholder({ label }: { label: string }) {
  return <div>{label} (coming soon)</div>;
}

function App() {
  return (
    <BrowserRouter>
      <nav>
        <Link to="/">Portfolios</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Placeholder label="Portfolio selector" />} />
        <Route path="/portfolios/:id" element={<Placeholder label="Portfolio detail" />} />
        <Route path="/portfolios/compare" element={<Placeholder label="Portfolio comparison" />} />
        <Route path="/companies/:ticker" element={<Placeholder label="Company detail" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

- [ ] **Step 5: Create `frontend/.env`** with the local API URL

```
VITE_API_BASE_URL=http://localhost:8000
```

- [ ] **Step 6: Run the dev server and verify it loads**

Run: `cd frontend && npm run dev` (then open `http://localhost:5173` in a browser)
Expected: page renders "Portfolio selector (coming soon)" with a "Portfolios" nav link. Stop the dev server before continuing.

- [ ] **Step 7: Commit**

```bash
cd /Users/jiani/Projects/study/PictetImpactHub
git add frontend/package.json frontend/package-lock.json frontend/tsconfig.json frontend/tsconfig.app.json frontend/tsconfig.node.json frontend/vite.config.ts frontend/index.html frontend/src/main.tsx frontend/src/App.tsx frontend/src/types.ts frontend/src/api/client.ts frontend/.gitignore
git commit -m "feat: scaffold React/TypeScript frontend with router shell and typed API client"
```

---

### Task 12: `PaginatedTable` component

**Files:**
- Create: `frontend/src/components/PaginatedTable.tsx`

- [ ] **Step 1: Create `frontend/src/components/PaginatedTable.tsx`**

```tsx
import { useState } from "react";

interface Column<T> {
  header: string;
  render: (row: T) => React.ReactNode;
}

interface PaginatedTableProps<T> {
  rows: T[];
  total: number;
  pageSize: number;
  columns: Column<T>[];
  onPageChange: (offset: number) => void;
  rowKey: (row: T) => string;
}

export function PaginatedTable<T>({
  rows,
  total,
  pageSize,
  columns,
  onPageChange,
  rowKey,
}: PaginatedTableProps<T>) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const goTo = (nextPage: number) => {
    const clamped = Math.min(Math.max(0, nextPage), pageCount - 1);
    setPage(clamped);
    onPageChange(clamped * pageSize);
  };

  return (
    <div>
      <table>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.header}>{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((col) => (
                <td key={col.header}>{col.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div>
        <button onClick={() => goTo(page - 1)} disabled={page === 0}>
          Previous
        </button>
        <span>
          {" "}Page {page + 1} of {pageCount}{" "}
        </span>
        <button onClick={() => goTo(page + 1)} disabled={page >= pageCount - 1}>
          Next
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/PaginatedTable.tsx
git commit -m "feat: add generic PaginatedTable component for limit/offset API data"
```

---

### Task 13: `ImpactGrid` component

**Files:**
- Create: `frontend/src/components/ImpactGrid.tsx`
- Create: `frontend/src/components/ImpactGrid.css`

- [ ] **Step 1: Create `frontend/src/components/ImpactGrid.css`**

```css
.impact-grid {
  display: grid;
  gap: 4px;
}

.impact-grid__cell {
  padding: 6px;
  text-align: center;
  border-radius: 4px;
  font-size: 0.8rem;
}

.impact-grid__cell--no-data {
  background-color: #e0e0e0;
  color: #888;
}

.impact-grid__cell--positive {
  background-color: #cdeccd;
}

.impact-grid__cell--negative {
  background-color: #f5cccc;
}

.impact-grid__cell--zero {
  background-color: #f0f0f0;
}
```

- [ ] **Step 2: Create `frontend/src/components/ImpactGrid.tsx`**

```tsx
import type { GridCell } from "../types";
import "./ImpactGrid.css";

interface ImpactGridProps {
  cells: GridCell[];
  rowKeyField: "scope" | "category";
  colKeyField: "scope" | "category" | "stakeholder";
}

function cellClass(value: number | null): string {
  if (value === null) return "impact-grid__cell--no-data";
  if (value > 0) return "impact-grid__cell--positive";
  if (value < 0) return "impact-grid__cell--negative";
  return "impact-grid__cell--zero";
}

function cellLabel(value: number | null): string {
  if (value === null) return "no data";
  return value.toExponential(2);
}

export function ImpactGrid({ cells, rowKeyField, colKeyField }: ImpactGridProps) {
  const rowKeys = Array.from(new Set(cells.map((c) => c[rowKeyField] as string)));
  const colKeys = Array.from(new Set(cells.map((c) => c[colKeyField] as string)));

  const lookup = new Map<string, number | null>();
  for (const cell of cells) {
    lookup.set(`${cell[rowKeyField]}|${cell[colKeyField]}`, cell.value);
  }

  return (
    <div
      className="impact-grid"
      style={{ gridTemplateColumns: `120px repeat(${colKeys.length}, 1fr)` }}
    >
      <div />
      {colKeys.map((col) => (
        <div key={col} className="impact-grid__cell">
          {col}
        </div>
      ))}
      {rowKeys.map((row) => (
        <>
          <div key={`${row}-label`} className="impact-grid__cell">
            {row}
          </div>
          {colKeys.map((col) => {
            const value = lookup.get(`${row}|${col}`) ?? null;
            return (
              <div key={`${row}-${col}`} className={`impact-grid__cell ${cellClass(value)}`}>
                {cellLabel(value)}
              </div>
            );
          })}
        </>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Add a component test — create `frontend/src/components/ImpactGrid.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ImpactGrid } from "./ImpactGrid";

describe("ImpactGrid", () => {
  it("renders 'no data' for null cells and a formatted value for present cells", () => {
    render(
      <ImpactGrid
        cells={[
          { scope: "direct", category: "climate_change", stakeholder: null, value: -1.5 },
          { scope: "direct", category: "water_stress", stakeholder: null, value: null },
        ]}
        rowKeyField="scope"
        colKeyField="category"
      />
    );

    expect(screen.getByText("no data")).toBeInTheDocument();
    expect(screen.getByText("-1.50e+0")).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Install test dependencies and run**

Run: `cd frontend && npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom`
Add to `frontend/vite.config.ts` test config:

```typescript
/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
  },
});
```

Run: `npx vitest run`
Expected: 1 passed

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ImpactGrid.tsx frontend/src/components/ImpactGrid.css frontend/src/components/ImpactGrid.test.tsx frontend/vite.config.ts frontend/package.json frontend/package-lock.json
git commit -m "feat: add ImpactGrid component distinguishing no-data cells from real zero values"
```

---

### Task 14: `ScoreToggle` component

**Files:**
- Create: `frontend/src/components/ScoreToggle.tsx`
- Create: `frontend/src/components/ScoreToggle.test.tsx`

- [ ] **Step 1: Write the failing test in `frontend/src/components/ScoreToggle.test.tsx`**

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScoreToggle } from "./ScoreToggle";

const scores = [
  { entity_id: "A", name: "Company A", social_score: 80, biodiversity_score: 30 },
  { entity_id: "B", name: "Company B", social_score: 40, biodiversity_score: 90 },
];

describe("ScoreToggle", () => {
  it("defaults to bar view and shows both scores per entity", () => {
    render(<ScoreToggle scores={scores} />);
    expect(screen.getByText("Company A")).toBeInTheDocument();
    expect(screen.getByText("Social: 80")).toBeInTheDocument();
    expect(screen.getByText("Biodiversity: 30")).toBeInTheDocument();
  });

  it("switches to scatter view on toggle click", () => {
    render(<ScoreToggle scores={scores} />);
    fireEvent.click(screen.getByText("Quadrant scatter"));
    expect(screen.getByTestId("score-scatter")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && npx vitest run`
Expected: FAIL — `Cannot find module './ScoreToggle'`

- [ ] **Step 3: Implement `frontend/src/components/ScoreToggle.tsx`**

```tsx
import { useState } from "react";
import { ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import type { ScoreOut } from "../types";

interface ScoreToggleProps {
  scores: ScoreOut[];
}

export function ScoreToggle({ scores }: ScoreToggleProps) {
  const [view, setView] = useState<"bars" | "scatter">("bars");

  return (
    <div>
      <div>
        <button onClick={() => setView("bars")} aria-pressed={view === "bars"}>
          Score bars
        </button>
        <button onClick={() => setView("scatter")} aria-pressed={view === "scatter"}>
          Quadrant scatter
        </button>
      </div>

      {view === "bars" ? (
        <ul>
          {scores.map((s) => (
            <li key={s.entity_id}>
              {s.name}
              <div>Social: {s.social_score}</div>
              <div>Biodiversity: {s.biodiversity_score}</div>
            </li>
          ))}
        </ul>
      ) : (
        <div data-testid="score-scatter">
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart>
              <XAxis dataKey="social_score" name="Social score" domain={[0, 100]} />
              <YAxis dataKey="biodiversity_score" name="Biodiversity score" domain={[0, 100]} />
              <Tooltip />
              <Scatter data={scores} fill="#4a90d9" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd frontend && npx vitest run`
Expected: 3 passed (1 from ImpactGrid + 2 from ScoreToggle)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ScoreToggle.tsx frontend/src/components/ScoreToggle.test.tsx frontend/package.json frontend/package-lock.json
git commit -m "feat: add ScoreToggle component switching between score bars and quadrant scatter"
```

---

### Task 15: `PortfolioSelector` page

**Files:**
- Create: `frontend/src/pages/PortfolioSelector.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create `frontend/src/pages/PortfolioSelector.tsx`**

```tsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { PortfolioSummary } from "../types";

export function PortfolioSelector() {
  const [portfolios, setPortfolios] = useState<PortfolioSummary[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .listPortfolios()
      .then((page) => setPortfolios(page.items))
      .catch(() => setError("Failed to load portfolios"));
  }, []);

  const toggleSelected = (id: number) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  if (error) return <div>{error}</div>;

  return (
    <div>
      <h1>Portfolios</h1>
      <ul>
        {portfolios.map((p) => (
          <li key={p.id}>
            <input
              type="checkbox"
              checked={selected.includes(p.id)}
              onChange={() => toggleSelected(p.id)}
            />
            <Link to={`/portfolios/${p.id}`}>{p.name}</Link>
            <span> — {p.n_companies} companies, ${p.total_market_value.toLocaleString()}</span>
          </li>
        ))}
      </ul>
      <button
        disabled={selected.length < 2}
        onClick={() => navigate(`/portfolios/compare?ids=${selected.join(",")}`)}
      >
        Compare selected
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into `frontend/src/App.tsx`** — replace the `/` route's placeholder

```tsx
import { PortfolioSelector } from "./pages/PortfolioSelector";

// inside <Routes>:
<Route path="/" element={<PortfolioSelector />} />
```

- [ ] **Step 3: Manual check** — start backend (`docker compose up -d`) and frontend (`cd frontend && npm run dev`), open `http://localhost:5173`
Expected: list of 3 portfolios with checkboxes; selecting 2+ enables "Compare selected".

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/PortfolioSelector.tsx frontend/src/App.tsx
git commit -m "feat: add portfolio selector page with multi-select comparison entry point"
```

---

### Task 16: `PortfolioDetail` page

**Files:**
- Create: `frontend/src/pages/PortfolioDetail.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create `frontend/src/pages/PortfolioDetail.tsx`**

```tsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { PaginatedTable } from "../components/PaginatedTable";
import { ScoreToggle } from "../components/ScoreToggle";
import type { HoldingOut, PortfolioDetail as PortfolioDetailType, ScoreOut } from "../types";

const PAGE_SIZE = 20;

export function PortfolioDetail() {
  const { id } = useParams<{ id: string }>();
  const portfolioId = Number(id);

  const [detail, setDetail] = useState<PortfolioDetailType | null>(null);
  const [holdings, setHoldings] = useState<HoldingOut[]>([]);
  const [holdingsTotal, setHoldingsTotal] = useState(0);
  const [scores, setScores] = useState<ScoreOut[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getPortfolio(portfolioId).then(setDetail).catch(() => setError("Failed to load portfolio"));
    api.getScores("portfolio").then((page) => setScores(page.items)).catch(() => setError("Failed to load scores"));
  }, [portfolioId]);

  const loadHoldingsPage = (offset: number) => {
    api
      .getPortfolioCompanies(portfolioId, PAGE_SIZE, offset)
      .then((page) => {
        setHoldings(page.items);
        setHoldingsTotal(page.total);
      })
      .catch(() => setError("Failed to load holdings"));
  };

  useEffect(() => {
    loadHoldingsPage(0);
  }, [portfolioId]);

  if (error) return <div>{error}</div>;
  if (!detail) return <div>Loading...</div>;

  return (
    <div>
      <h1>{detail.name}</h1>
      <p>{detail.n_companies} companies, ${detail.total_market_value.toLocaleString()} total value</p>
      <p>Social impact: {detail.impact.social_total_wellby.toFixed(4)} WELLBYs (weighted)</p>
      <p>Biodiversity impact: {detail.impact.biodiversity_total_pdf_yr.toFixed(6)} PDF·yr (weighted)</p>

      <h2>Holdings</h2>
      <PaginatedTable
        rows={holdings}
        total={holdingsTotal}
        pageSize={PAGE_SIZE}
        onPageChange={loadHoldingsPage}
        rowKey={(h) => h.ticker}
        columns={[
          { header: "Company", render: (h) => h.company_name },
          { header: "Weight %", render: (h) => h.pct_of_fund.toFixed(2) },
          { header: "Market value", render: (h) => h.market_value?.toLocaleString() ?? "-" },
        ]}
      />

      <h2>Composite score</h2>
      <ScoreToggle scores={scores} />
    </div>
  );
}
```

- [ ] **Step 2: Wire it into `frontend/src/App.tsx`**

```tsx
import { PortfolioDetail } from "./pages/PortfolioDetail";

<Route path="/portfolios/:id" element={<PortfolioDetail />} />
```

- [ ] **Step 3: Manual check** — click a portfolio name from the selector page
Expected: portfolio name, totals, weighted impact numbers, paginated holdings table, score toggle with all portfolios listed.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/PortfolioDetail.tsx frontend/src/App.tsx
git commit -m "feat: add portfolio detail page with paginated holdings and composite score panel"
```

---

### Task 17: `PortfolioCompare` page

**Files:**
- Create: `frontend/src/pages/PortfolioCompare.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create `frontend/src/pages/PortfolioCompare.tsx`**

```tsx
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { ScoreToggle } from "../components/ScoreToggle";
import type { PortfolioDetail, ScoreOut } from "../types";

export function PortfolioCompare() {
  const [searchParams] = useSearchParams();
  const ids = (searchParams.get("ids") || "")
    .split(",")
    .filter(Boolean)
    .map(Number);

  const [portfolios, setPortfolios] = useState<PortfolioDetail[]>([]);
  const [allScores, setAllScores] = useState<ScoreOut[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ids.length === 0) return;
    api.comparePortfolios(ids).then(setPortfolios).catch(() => setError("Failed to load comparison"));
    api.getScores("portfolio").then((page) => setAllScores(page.items)).catch(() => setError("Failed to load scores"));
  }, [ids.join(",")]);

  if (ids.length === 0) return <div>No portfolios selected. Go back and select at least two.</div>;
  if (error) return <div>{error}</div>;

  const selectedScores = allScores.filter((s) => ids.includes(Number(s.entity_id)));

  return (
    <div>
      <h1>Portfolio comparison</h1>
      <div style={{ display: "flex", gap: "2rem" }}>
        {portfolios.map((p) => (
          <div key={p.id}>
            <h2>{p.name}</h2>
            <p>{p.n_companies} companies, ${p.total_market_value.toLocaleString()}</p>
            <p>Social: {p.impact.social_total_wellby.toFixed(4)} WELLBYs</p>
            <p>Biodiversity: {p.impact.biodiversity_total_pdf_yr.toFixed(6)} PDF·yr</p>
          </div>
        ))}
      </div>

      <h2>Composite scores</h2>
      <ScoreToggle scores={selectedScores} />
    </div>
  );
}
```

- [ ] **Step 2: Wire it into `frontend/src/App.tsx`**

```tsx
import { PortfolioCompare } from "./pages/PortfolioCompare";

<Route path="/portfolios/compare" element={<PortfolioCompare />} />
```

- [ ] **Step 3: Manual check** — from the selector page, select 2+ portfolios and click "Compare selected"
Expected: side-by-side columns for each selected portfolio plus a combined score toggle (bars or scatter) limited to the selected portfolios.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/PortfolioCompare.tsx frontend/src/App.tsx
git commit -m "feat: add portfolio comparison page with side-by-side impact and combined scores"
```

---

### Task 18: `CompanyDetail` page

**Files:**
- Create: `frontend/src/pages/CompanyDetail.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/PortfolioDetail.tsx` (add company links from holdings table)

- [ ] **Step 1: Create `frontend/src/pages/CompanyDetail.tsx`**

```tsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { ImpactGrid } from "../components/ImpactGrid";
import { ScoreToggle } from "../components/ScoreToggle";
import type { CompanyDetail as CompanyDetailType, ScoreOut } from "../types";

export function CompanyDetail() {
  const { ticker } = useParams<{ ticker: string }>();

  const [company, setCompany] = useState<CompanyDetailType | null>(null);
  const [scores, setScores] = useState<ScoreOut[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ticker) return;
    api.getCompany(ticker).then(setCompany).catch(() => setError("Company not found"));
    api.getScores("company").then((page) => setScores(page.items)).catch(() => setError("Failed to load scores"));
  }, [ticker]);

  if (error) return <div>{error}</div>;
  if (!company) return <div>Loading...</div>;

  const ownScore = scores.filter((s) => s.entity_id === ticker);

  return (
    <div>
      <h1>{company.company_name}</h1>
      <p>ISIN: {company.isin}</p>
      <p>Market cap: ${company.market_cap_usd_m?.toLocaleString() ?? "-"}M</p>
      <p>Revenue: ${company.sales_usd_m?.toLocaleString() ?? "-"}M</p>

      <h2>Social impact (scope x category)</h2>
      <ImpactGrid cells={company.social_grid} rowKeyField="scope" colKeyField="category" />

      <h2>Biodiversity impact (scope x category)</h2>
      <ImpactGrid cells={company.biodiversity_grid} rowKeyField="scope" colKeyField="category" />

      <h2>Composite score</h2>
      <ScoreToggle scores={ownScore.length > 0 ? scores : []} />
    </div>
  );
}
```

- [ ] **Step 2: Wire it into `frontend/src/App.tsx`**

```tsx
import { CompanyDetail } from "./pages/CompanyDetail";

<Route path="/companies/:ticker" element={<CompanyDetail />} />
```

- [ ] **Step 3: Add company links from the holdings table in `frontend/src/pages/PortfolioDetail.tsx`** — change the "Company" column render

```tsx
import { Link } from "react-router-dom";

// replace the existing "Company" column definition with:
{ header: "Company", render: (h) => <Link to={`/companies/${h.ticker}`}>{h.company_name}</Link> },
```

- [ ] **Step 4: Manual check** — from a portfolio detail page, click a company name
Expected: company page shows financials, full social grid (180 cells, greyed no-data cells visible), full biodiversity grid (15 cells, all dense), and a score toggle.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/CompanyDetail.tsx frontend/src/App.tsx frontend/src/pages/PortfolioDetail.tsx
git commit -m "feat: add company detail page with full impact grids and company links from holdings"
```

---

### Task 19: Frontend Dockerfile, README, and end-to-end smoke check

**Files:**
- Create: `frontend/Dockerfile`
- Create: `README.md`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Create `frontend/Dockerfile`** (static build served via a lightweight server, matching the "static artifact" deployment story for S3/CloudFront later)

```dockerfile
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-slim
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/dist ./dist
EXPOSE 5173
CMD ["serve", "-s", "dist", "-l", "5173"]
```

- [ ] **Step 2: Add the frontend service to `docker-compose.yml`**

```yaml
  frontend:
    build: ./frontend
    environment:
      VITE_API_BASE_URL: http://localhost:8000
    ports:
      - "5173:5173"
    depends_on:
      - backend
```

- [ ] **Step 3: Create `README.md`** at the project root

```markdown
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
```

- [ ] **Step 4: Full end-to-end smoke check**

Run:
```bash
cd /Users/jiani/Projects/study/PictetImpactHub
docker compose up -d --build
DATABASE_URL=postgresql://impact:impact@localhost:5432/impact backend/.venv/bin/python backend/scripts/seed.py
curl http://localhost:8000/health
curl http://localhost:8000/portfolios
```
Expected: health check returns `{"status":"ok"}`; `/portfolios` returns 3 portfolios. Open `http://localhost:5173` in a browser and click through selector → portfolio detail → company detail → comparison to confirm no console errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/Dockerfile docker-compose.yml README.md
git commit -m "docs: add README and containerize frontend for local + future AWS deployment"
```
