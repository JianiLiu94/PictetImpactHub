from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    limit: int | None = None
    offset: int = 0


class CompanySummary(BaseModel):
    ticker: str
    company_name: str
    isin: str
    market_cap_usd_m: float | None = None
    sales_usd_m: float | None = None


class HoldingOut(BaseModel):
    ticker: str
    company_name: str
    pct_of_fund: float
    shares: int | None = None
    market_value: float | None = None


class PortfolioSummary(BaseModel):
    id: int
    name: str
    n_companies: int
    total_market_value: float


class GridCell(BaseModel):
    scope: str
    category: str
    stakeholder: str | None = None
    value: float | None = None


class ImpactSummary(BaseModel):
    social_total_wellby: float
    biodiversity_total_pdf_yr: float


class PortfolioDetail(PortfolioSummary):
    impact: ImpactSummary


class CompanyDetail(CompanySummary):
    social_grid: list[GridCell]
    biodiversity_grid: list[GridCell]


class ScoreOut(BaseModel):
    entity_id: str
    name: str
    social_score: float
    biodiversity_score: float
