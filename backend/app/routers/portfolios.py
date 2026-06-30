from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.crud import (
    BIO_CATEGORIES,
    BIO_SCOPES,
    SOCIAL_CATEGORIES,
    SOCIAL_SCOPES,
    company_raw_impact_totals,
    weighted_portfolio_value,
)
from app.database import get_db
from app.models import BiodiversityImpact, Company, Holding, Portfolio, SocialImpact
from app.schemas import (
    CategoryBreakdown,
    CategoryScopeBreakdown,
    CategoryValue,
    CustomHoldingIn,
    CustomHoldingOut,
    CustomPortfolioResult,
    HoldingOut,
    ImpactSummary,
    Page,
    PortfolioDetail,
    PortfolioSummary,
    ScopeBreakdown,
    ScopedCategoryValue,
    ScopeValue,
)
from app.scoring import percentile_scores

router = APIRouter(prefix="/portfolios", tags=["portfolios"])

HOLDING_SORT_FIELDS = {"company_name", "pct_of_fund", "market_value", "social_score", "biodiversity_score"}


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


def _category_scope_breakdown(db: Session, holdings: list[dict]) -> CategoryScopeBreakdown:
    """Weighted sum per (category, scope) pair — for category drill-down in the Compare view."""
    tickers = [h["ticker"] for h in holdings]

    social_data: dict[str, dict[str, dict[str, float]]] = {
        cat: {scope: {} for scope in SOCIAL_SCOPES} for cat in SOCIAL_CATEGORIES
    }
    for row in db.query(SocialImpact).filter(SocialImpact.ticker.in_(tickers)).all():
        cat_map = social_data.setdefault(row.category, {scope: {} for scope in SOCIAL_SCOPES})
        ticker_map = cat_map.setdefault(row.scope, {})
        ticker_map[row.ticker] = ticker_map.get(row.ticker, 0.0) + row.wellby_abs

    bio_data: dict[str, dict[str, dict[str, float]]] = {
        cat: {scope: {} for scope in BIO_SCOPES} for cat in BIO_CATEGORIES
    }
    for row in db.query(BiodiversityImpact).filter(BiodiversityImpact.ticker.in_(tickers)).all():
        cat_map = bio_data.setdefault(row.category, {scope: {} for scope in BIO_SCOPES})
        ticker_map = cat_map.setdefault(row.scope, {})
        ticker_map[row.ticker] = ticker_map.get(row.ticker, 0.0) + row.value

    def build(data: dict[str, dict[str, dict[str, float]]]) -> list[ScopedCategoryValue]:
        result = []
        for cat, scope_map in data.items():
            by_scope = [
                ScopeValue(scope=scope, value=weighted_portfolio_value(holdings, ticker_map))
                for scope, ticker_map in scope_map.items()
            ]
            total = sum(sv.value for sv in by_scope)
            result.append(ScopedCategoryValue(category=cat, value=total, by_scope=by_scope))
        result.sort(key=lambda x: x.value, reverse=True)
        return result

    return CategoryScopeBreakdown(social=build(social_data), biodiversity=build(bio_data))


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


@router.post("/custom", response_model=CustomPortfolioResult)
def build_custom_portfolio(holdings_in: list[CustomHoldingIn], db: Session = Depends(get_db)):
    if not holdings_in:
        raise HTTPException(status_code=422, detail="Provide at least one holding")
    for h in holdings_in:
        if h.weight <= 0:
            raise HTTPException(status_code=422, detail=f"Weight for ISIN {h.isin} must be positive")

    isins = [h.isin.strip() for h in holdings_in]
    company_by_isin = {c.isin: c for c in db.query(Company).filter(Company.isin.in_(isins)).all()}

    matched_holdings: list[dict] = []
    missing_isins: list[str] = []
    total_weight_input = sum(h.weight for h in holdings_in)
    matched_weight = 0.0
    for h in holdings_in:
        isin = h.isin.strip()
        company = company_by_isin.get(isin)
        if company is None:
            missing_isins.append(isin)
            continue
        matched_weight += h.weight
        matched_holdings.append({
            "isin": isin,
            "ticker": company.ticker,
            "company_name": company.company_name,
            "weight": h.weight,
        })

    if not matched_holdings:
        raise HTTPException(status_code=400, detail="None of the provided ISINs matched a known company")

    # Renormalize matched holdings' weights to sum to 100, so a CSV with missing
    # ISINs (or weights that don't already sum to 100) still produces a valid
    # holdings-weighted impact/score across the companies that were found.
    for h in matched_holdings:
        h["pct_of_fund"] = h["weight"] / matched_weight * 100

    impact = _portfolio_impact(db, matched_holdings)

    social_totals, bio_totals = company_raw_impact_totals(db)
    all_tickers = {c.ticker for c in db.query(Company).all()}
    social_totals = {t: social_totals.get(t, 0.0) for t in all_tickers}
    bio_totals = {t: bio_totals.get(t, 0.0) for t in all_tickers}
    social_scores = percentile_scores(social_totals)
    bio_scores = percentile_scores(bio_totals)

    return CustomPortfolioResult(
        n_companies=len(matched_holdings),
        total_weight_input=total_weight_input,
        matched_weight=matched_weight,
        missing_isins=missing_isins,
        holdings=[
            CustomHoldingOut(
                isin=h["isin"],
                ticker=h["ticker"],
                company_name=h["company_name"],
                pct_of_fund=h["pct_of_fund"],
            )
            for h in matched_holdings
        ],
        impact=impact,
        social_score=weighted_portfolio_value(matched_holdings, social_scores),
        biodiversity_score=weighted_portfolio_value(matched_holdings, bio_scores),
    )


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


@router.get("/{portfolio_id}/category-scope-breakdown", response_model=CategoryScopeBreakdown)
def get_portfolio_category_scope_breakdown(portfolio_id: int, db: Session = Depends(get_db)):
    _get_portfolio_or_404(db, portfolio_id)
    holdings = _portfolio_holdings(db, portfolio_id)
    return _category_scope_breakdown(db, holdings)


def _sort_holdings(db: Session, holdings: list[dict], sort_by: str, sort_dir: str) -> list[dict]:
    """Sorts a portfolio's holdings in place-equivalent (returns a new list).

    social_score/biodiversity_score aren't columns on Holding/Company -- they're
    the same per-company percentile scores GET /scores computes, so they're
    attached to each holding dict here just for sorting (not returned in the
    response; HoldingOut has no score fields, matching the existing contract).
    None values (e.g. a holding with no market_value) always sort last,
    regardless of direction.
    """
    if sort_by in ("social_score", "biodiversity_score"):
        social_totals, bio_totals = company_raw_impact_totals(db)
        all_tickers = {h["ticker"] for h in holdings}
        social_totals = {t: social_totals.get(t, 0.0) for t in all_tickers}
        bio_totals = {t: bio_totals.get(t, 0.0) for t in all_tickers}
        score_map = percentile_scores(social_totals if sort_by == "social_score" else bio_totals)
        for h in holdings:
            h[sort_by] = score_map.get(h["ticker"], 0.0)

    def sort_key(h: dict):
        value = h.get(sort_by)
        if value is None:
            return float("-inf") if sort_dir == "desc" else float("inf")
        if sort_by == "company_name":
            return value.lower()
        return value

    return sorted(holdings, key=sort_key, reverse=(sort_dir == "desc"))


@router.get("/{portfolio_id}/companies", response_model=Page[HoldingOut])
def get_portfolio_companies(
    portfolio_id: int,
    limit: int | None = Query(default=None, ge=0),
    offset: int = Query(default=0, ge=0),
    sort_by: str | None = Query(default=None),
    sort_dir: str = Query(default="asc"),
    db: Session = Depends(get_db),
):
    _get_portfolio_or_404(db, portfolio_id)
    if sort_by is not None and sort_by not in HOLDING_SORT_FIELDS:
        raise HTTPException(status_code=400, detail=f"sort_by must be one of {sorted(HOLDING_SORT_FIELDS)}")
    if sort_dir not in ("asc", "desc"):
        raise HTTPException(status_code=400, detail="sort_dir must be 'asc' or 'desc'")

    holdings = _portfolio_holdings(db, portfolio_id)
    total = len(holdings)

    if sort_by is not None:
        holdings = _sort_holdings(db, holdings, sort_by, sort_dir)

    if limit is not None:
        holdings = holdings[offset: offset + limit]
    return Page(items=holdings, total=total, limit=limit, offset=offset)
