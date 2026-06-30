from itertools import product

from sqlalchemy.orm import Session

from app.models import BiodiversityImpact, SocialImpact

SOCIAL_SCOPES = ["upstream", "own_ops", "downstream"]
SOCIAL_CATEGORIES = [
    "connectivity", "employment", "energy", "health", "housing", "income_wealth",
    "knowledge", "leisure", "mobility", "nutrition", "safety", "water",
]
SOCIAL_STAKEHOLDERS = ["customers", "employees", "gov_communities", "shareholders", "suppliers"]

BIO_SCOPES = ["upstream", "direct", "downstream"]
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


def company_raw_impact_totals(db: Session) -> tuple[dict[str, float], dict[str, float]]:
    """Sum of wellby_abs and value per ticker, across every company in the database."""
    social_totals: dict[str, float] = {}
    for row in db.query(SocialImpact).all():
        social_totals[row.ticker] = social_totals.get(row.ticker, 0.0) + row.wellby_abs

    bio_totals: dict[str, float] = {}
    for row in db.query(BiodiversityImpact).all():
        bio_totals[row.ticker] = bio_totals.get(row.ticker, 0.0) + row.value

    return social_totals, bio_totals
