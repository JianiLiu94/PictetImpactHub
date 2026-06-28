from fastapi import APIRouter, Depends, HTTPException, Query
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
