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
