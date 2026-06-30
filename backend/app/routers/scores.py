from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.crud import company_raw_impact_totals, weighted_portfolio_value
from app.database import get_db
from app.models import Company, Portfolio
from app.routers.portfolios import _portfolio_holdings
from app.schemas import Page, ScoreOut
from app.scoring import percentile_scores

router = APIRouter(prefix="/scores", tags=["scores"])


@router.get("", response_model=Page[ScoreOut])
def get_scores(
    entity_type: str,
    limit: int | None = Query(default=None, ge=0),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    if entity_type not in ("company", "portfolio"):
        raise HTTPException(status_code=400, detail="entity_type must be 'company' or 'portfolio'")

    social_totals, bio_totals = company_raw_impact_totals(db)
    companies = db.query(Company).all()
    all_tickers = {c.ticker for c in companies}
    names = {c.ticker: c.company_name for c in companies}
    # Companies with no impact rows must still appear in the percentile ranking
    # at 0.0 rather than being silently excluded, so force-include every ticker.
    social_totals = {t: social_totals.get(t, 0.0) for t in all_tickers}
    bio_totals = {t: bio_totals.get(t, 0.0) for t in all_tickers}

    company_social_scores = percentile_scores(social_totals)
    company_bio_scores = percentile_scores(bio_totals)

    if entity_type == "company":
        items = [
            ScoreOut(
                entity_id=ticker,
                name=names.get(ticker, ticker),
                social_score=company_social_scores[ticker],
                biodiversity_score=company_bio_scores[ticker],
                social_impact=social_totals[ticker],
                biodiversity_impact=bio_totals[ticker],
            )
            for ticker in all_tickers
        ]
    else:
        items = []
        for portfolio in db.query(Portfolio).all():
            holdings = _portfolio_holdings(db, portfolio.id)
            items.append(ScoreOut(
                entity_id=str(portfolio.id),
                name=portfolio.name,
                social_score=weighted_portfolio_value(holdings, company_social_scores),
                biodiversity_score=weighted_portfolio_value(holdings, company_bio_scores),
                social_impact=weighted_portfolio_value(holdings, social_totals),
                biodiversity_impact=weighted_portfolio_value(holdings, bio_totals),
            ))

    items.sort(key=lambda x: x.entity_id)
    total = len(items)
    if limit is not None:
        items = items[offset: offset + limit]
    return Page(items=items, total=total, limit=limit, offset=offset)
