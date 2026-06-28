from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.crud import BIO_CATEGORIES, BIO_SCOPES, SOCIAL_CATEGORIES, SOCIAL_SCOPES, weighted_portfolio_value
from app.database import get_db
from app.models import BiodiversityImpact, Company, Holding, Portfolio, SocialImpact
from app.schemas import (
    CategoryBreakdown,
    CategoryValue,
    HoldingOut,
    ImpactSummary,
    Page,
    PortfolioDetail,
    PortfolioSummary,
    ScopeBreakdown,
    ScopeValue,
)

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


def _category_breakdown(db: Session, holdings: list[dict]) -> CategoryBreakdown:
    """Weighted sum per category, across all scopes/stakeholders, sorted high to low.

    Categories with no contributing rows among the portfolio's holdings still
    appear, with a value of 0.0, so the full category universe is always shown.
    """
    tickers = [h["ticker"] for h in holdings]

    social_by_category: dict[str, dict[str, float]] = {cat: {} for cat in SOCIAL_CATEGORIES}
    for row in db.query(SocialImpact).filter(SocialImpact.ticker.in_(tickers)).all():
        totals = social_by_category.setdefault(row.category, {})
        totals[row.ticker] = totals.get(row.ticker, 0.0) + row.wellby_abs

    bio_by_category: dict[str, dict[str, float]] = {cat: {} for cat in BIO_CATEGORIES}
    for row in db.query(BiodiversityImpact).filter(BiodiversityImpact.ticker.in_(tickers)).all():
        totals = bio_by_category.setdefault(row.category, {})
        totals[row.ticker] = totals.get(row.ticker, 0.0) + row.value

    social_values = [
        CategoryValue(category=cat, value=weighted_portfolio_value(holdings, totals))
        for cat, totals in social_by_category.items()
    ]
    bio_values = [
        CategoryValue(category=cat, value=weighted_portfolio_value(holdings, totals))
        for cat, totals in bio_by_category.items()
    ]
    social_values.sort(key=lambda c: c.value, reverse=True)
    bio_values.sort(key=lambda c: c.value, reverse=True)

    return CategoryBreakdown(social=social_values, biodiversity=bio_values)


def _scope_breakdown(db: Session, holdings: list[dict]) -> ScopeBreakdown:
    """Weighted sum per scope, across all categories/stakeholders.

    Returned in canonical upstream -> own operations -> downstream order
    (matching SOCIAL_SCOPES/BIO_SCOPES), not sorted by value -- "own
    operations" (social) and "direct" (biodiversity) are the same scope
    position across the two models, so a fixed order keeps them aligned
    rather than letting independent value-sorts shuffle them apart.
    """
    tickers = [h["ticker"] for h in holdings]

    social_by_scope: dict[str, dict[str, float]] = {scope: {} for scope in SOCIAL_SCOPES}
    for row in db.query(SocialImpact).filter(SocialImpact.ticker.in_(tickers)).all():
        totals = social_by_scope.setdefault(row.scope, {})
        totals[row.ticker] = totals.get(row.ticker, 0.0) + row.wellby_abs

    bio_by_scope: dict[str, dict[str, float]] = {scope: {} for scope in BIO_SCOPES}
    for row in db.query(BiodiversityImpact).filter(BiodiversityImpact.ticker.in_(tickers)).all():
        totals = bio_by_scope.setdefault(row.scope, {})
        totals[row.ticker] = totals.get(row.ticker, 0.0) + row.value

    social_values = [
        ScopeValue(scope=scope, value=weighted_portfolio_value(holdings, totals))
        for scope, totals in social_by_scope.items()
    ]
    bio_values = [
        ScopeValue(scope=scope, value=weighted_portfolio_value(holdings, totals))
        for scope, totals in bio_by_scope.items()
    ]

    return ScopeBreakdown(social=social_values, biodiversity=bio_values)


def _get_portfolio_or_404(db: Session, portfolio_id: int) -> Portfolio:
    portfolio = db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
    if portfolio is None:
        raise HTTPException(status_code=404, detail=f"Portfolio {portfolio_id} not found")
    return portfolio


def _build_portfolio_detail(db: Session, portfolio: Portfolio, holdings: list[dict]) -> PortfolioDetail:
    return PortfolioDetail(
        id=portfolio.id,
        name=portfolio.name,
        n_companies=len(holdings),
        total_market_value=sum(h["market_value"] or 0.0 for h in holdings),
        impact=_portfolio_impact(db, holdings),
    )


@router.get("", response_model=Page[PortfolioSummary])
def list_portfolios(
    limit: int | None = Query(default=None, ge=0),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
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


@router.get("/compare", response_model=list[PortfolioDetail])
def compare_portfolios(ids: str, db: Session = Depends(get_db)):
    try:
        portfolio_ids = [int(x) for x in ids.split(",") if x.strip()]
    except ValueError:
        raise HTTPException(status_code=422, detail="ids must be a comma-separated list of integers")
    results = []
    for portfolio_id in portfolio_ids:
        portfolio = _get_portfolio_or_404(db, portfolio_id)
        holdings = _portfolio_holdings(db, portfolio_id)
        results.append(_build_portfolio_detail(db, portfolio, holdings))
    return results


@router.get("/{portfolio_id}", response_model=PortfolioDetail)
def get_portfolio(portfolio_id: int, db: Session = Depends(get_db)):
    portfolio = _get_portfolio_or_404(db, portfolio_id)
    holdings = _portfolio_holdings(db, portfolio_id)
    return _build_portfolio_detail(db, portfolio, holdings)


@router.get("/{portfolio_id}/categories", response_model=CategoryBreakdown)
def get_portfolio_categories(portfolio_id: int, db: Session = Depends(get_db)):
    _get_portfolio_or_404(db, portfolio_id)
    holdings = _portfolio_holdings(db, portfolio_id)
    return _category_breakdown(db, holdings)


@router.get("/{portfolio_id}/scopes", response_model=ScopeBreakdown)
def get_portfolio_scopes(portfolio_id: int, db: Session = Depends(get_db)):
    _get_portfolio_or_404(db, portfolio_id)
    holdings = _portfolio_holdings(db, portfolio_id)
    return _scope_breakdown(db, holdings)


@router.get("/{portfolio_id}/companies", response_model=Page[HoldingOut])
def get_portfolio_companies(
    portfolio_id: int,
    limit: int | None = Query(default=None, ge=0),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    _get_portfolio_or_404(db, portfolio_id)
    holdings = _portfolio_holdings(db, portfolio_id)
    total = len(holdings)
    if limit is not None:
        holdings = holdings[offset: offset + limit]
    return Page(items=holdings, total=total, limit=limit, offset=offset)
