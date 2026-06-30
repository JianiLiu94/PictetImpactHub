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


def test_compare_portfolios_invalid_ids(client_with_portfolio):
    response = client_with_portfolio.get("/portfolios/compare", params={"ids": "1,abc"})
    assert response.status_code == 422


def test_get_company_scores(client_with_portfolio):
    response = client_with_portfolio.get("/scores", params={"entity_type": "company"})
    assert response.status_code == 200
    body = response.json()
    tickers = {item["entity_id"] for item in body["items"]}
    assert tickers == {"ABC", "XYZ"}
    abc_score = next(item for item in body["items"] if item["entity_id"] == "ABC")
    assert abc_score["social_score"] == 100.0  # only ABC has social impact, so it ranks highest


def test_get_portfolio_categories(client_with_portfolio):
    response = client_with_portfolio.get("/portfolios/1/categories")
    assert response.status_code == 200
    body = response.json()

    assert len(body["social"]) == 12
    assert len(body["biodiversity"]) == 5

    # sorted high to low
    social_values = [c["value"] for c in body["social"]]
    assert social_values == sorted(social_values, reverse=True)
    bio_values = [c["value"] for c in body["biodiversity"]]
    assert bio_values == sorted(bio_values, reverse=True)

    health = next(c for c in body["social"] if c["category"] == "health")
    assert health["value"] == 0.6 * 5.0
    other_social = next(c for c in body["social"] if c["category"] != "health")
    assert other_social["value"] == 0.0

    climate = next(c for c in body["biodiversity"] if c["category"] == "climate_change")
    assert climate["value"] == 0.6 * -2.0


def test_get_portfolio_scopes(client_with_portfolio):
    response = client_with_portfolio.get("/portfolios/1/scopes")
    assert response.status_code == 200
    body = response.json()

    assert len(body["social"]) == 3
    assert len(body["biodiversity"]) == 3

    # fixed canonical order: upstream -> own operations/direct -> downstream,
    # not sorted by value, so the two models' scope positions stay aligned
    assert [s["scope"] for s in body["social"]] == ["upstream", "own_ops", "downstream"]
    assert [s["scope"] for s in body["biodiversity"]] == ["upstream", "direct", "downstream"]

    upstream = next(s for s in body["social"] if s["scope"] == "upstream")
    assert upstream["value"] == 0.6 * 5.0
    other_social = next(s for s in body["social"] if s["scope"] != "upstream")
    assert other_social["value"] == 0.0

    direct = next(s for s in body["biodiversity"] if s["scope"] == "direct")
    assert direct["value"] == 0.6 * -2.0


def test_get_portfolio_companies_sort_by_market_value(client_with_portfolio):
    asc = client_with_portfolio.get("/portfolios/1/companies", params={"sort_by": "market_value", "sort_dir": "asc"})
    assert asc.status_code == 200
    assert [h["ticker"] for h in asc.json()["items"]] == ["XYZ", "ABC"]

    desc = client_with_portfolio.get(
        "/portfolios/1/companies", params={"sort_by": "market_value", "sort_dir": "desc"}
    )
    assert [h["ticker"] for h in desc.json()["items"]] == ["ABC", "XYZ"]


def test_get_portfolio_companies_sort_by_company_name(client_with_portfolio):
    response = client_with_portfolio.get("/portfolios/1/companies", params={"sort_by": "company_name"})
    assert response.status_code == 200
    # "ABC Corp" sorts before "XYZ Inc" alphabetically
    assert [h["ticker"] for h in response.json()["items"]] == ["ABC", "XYZ"]


def test_get_portfolio_companies_sort_by_social_score(client_with_portfolio):
    # ABC has a social impact row (wellby_abs=5.0), XYZ has none (raw total 0.0),
    # so ABC ranks at the 100th percentile and XYZ at the 0th.
    desc = client_with_portfolio.get(
        "/portfolios/1/companies", params={"sort_by": "social_score", "sort_dir": "desc"}
    )
    assert [h["ticker"] for h in desc.json()["items"]] == ["ABC", "XYZ"]

    asc = client_with_portfolio.get("/portfolios/1/companies", params={"sort_by": "social_score", "sort_dir": "asc"})
    assert [h["ticker"] for h in asc.json()["items"]] == ["XYZ", "ABC"]


def test_get_portfolio_companies_sort_by_biodiversity_score(client_with_portfolio):
    # ABC's biodiversity value is -2.0 (a real loss), XYZ has none (raw total 0.0,
    # i.e. "less negative" than ABC), so XYZ ranks higher on this axis.
    desc = client_with_portfolio.get(
        "/portfolios/1/companies", params={"sort_by": "biodiversity_score", "sort_dir": "desc"}
    )
    assert [h["ticker"] for h in desc.json()["items"]] == ["XYZ", "ABC"]


def test_get_portfolio_companies_invalid_sort_by(client_with_portfolio):
    response = client_with_portfolio.get("/portfolios/1/companies", params={"sort_by": "not_a_field"})
    assert response.status_code == 400


def test_get_portfolio_companies_invalid_sort_dir(client_with_portfolio):
    response = client_with_portfolio.get(
        "/portfolios/1/companies", params={"sort_by": "market_value", "sort_dir": "sideways"}
    )
    assert response.status_code == 400


def test_build_custom_portfolio(client_with_portfolio):
    response = client_with_portfolio.post(
        "/portfolios/custom",
        json=[
            {"isin": "US0000000000", "weight": 60.0},
            {"isin": "US0000000001", "weight": 40.0},
        ],
    )
    assert response.status_code == 200
    body = response.json()
    assert body["n_companies"] == 2
    assert body["missing_isins"] == []
    assert body["total_weight_input"] == 100.0
    assert body["matched_weight"] == 100.0
    assert body["impact"]["social_total_wellby"] == 0.6 * 5.0
    assert body["impact"]["biodiversity_total_pdf_yr"] == 0.6 * -2.0
    assert body["social_score"] == 0.6 * 100.0  # ABC scores 100, XYZ 0, weighted 60/40


def test_build_custom_portfolio_handles_missing_isins(client_with_portfolio):
    response = client_with_portfolio.post(
        "/portfolios/custom",
        json=[
            {"isin": "US0000000000", "weight": 50.0},
            {"isin": "US-DOES-NOT-EXIST", "weight": 50.0},
        ],
    )
    assert response.status_code == 200
    body = response.json()
    assert body["n_companies"] == 1
    assert body["missing_isins"] == ["US-DOES-NOT-EXIST"]
    assert body["total_weight_input"] == 100.0
    assert body["matched_weight"] == 50.0
    # the single matched holding (ABC) is renormalized to 100% of the matched portfolio
    assert body["holdings"][0]["pct_of_fund"] == 100.0
    assert body["social_score"] == 100.0


def test_build_custom_portfolio_all_missing(client_with_portfolio):
    response = client_with_portfolio.post(
        "/portfolios/custom",
        json=[{"isin": "US-NOPE-1", "weight": 100.0}],
    )
    assert response.status_code == 400


def test_build_custom_portfolio_rejects_non_positive_weight(client_with_portfolio):
    response = client_with_portfolio.post(
        "/portfolios/custom",
        json=[{"isin": "US0000000000", "weight": 0}],
    )
    assert response.status_code == 422
