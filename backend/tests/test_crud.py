from app.models import BiodiversityImpact, Company, Holding, Portfolio, SocialImpact
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


def test_models_create_tables(db_session):
    company = Company(ticker="ABC", company_name="ABC Corp", isin="US0000000000")
    db_session.add(company)
    db_session.commit()

    fetched = db_session.query(Company).filter_by(ticker="ABC").one()
    assert fetched.company_name == "ABC Corp"


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
