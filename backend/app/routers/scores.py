from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.crud import weighted_portfolio_value
from app.database import get_db
from app.models import BiodiversityImpact, Company, Holding, Portfolio, SocialImpact
from app.schemas import Page, ScoreOut
from app.scoring import percentile_scores

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
    entity_type: str,
    limit: int | None = Query(default=None, ge=0),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    if entity_type not in ("company", "portfolio"):
        raise HTTPException(status_code=400, detail="entity_type must be 'company' or 'portfolio'")

    social_totals, bio_totals = _company_raw_totals(db)
    all_tickers = {c.ticker for c in db.query(Company).all()}
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
