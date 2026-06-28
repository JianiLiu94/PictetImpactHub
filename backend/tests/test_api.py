import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import BiodiversityImpact, Company, Holding, Portfolio, SocialImpact


@pytest.fixture()
def client():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
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


@pytest.fixture()
def client_with_portfolio():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
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
        SocialImpact(ticker="ABC", scope="upstream", category="health", stakeholder="customers",
                     wellby_per_dollar=0.1, wellby_abs=5.0),
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
