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
    social_impact: float
    biodiversity_impact: float


class CategoryValue(BaseModel):
    category: str
    value: float


class CategoryBreakdown(BaseModel):
    social: list[CategoryValue]
    biodiversity: list[CategoryValue]


class ScopeValue(BaseModel):
    scope: str
    value: float


class ScopeBreakdown(BaseModel):
    social: list[ScopeValue]
    biodiversity: list[ScopeValue]


class StakeholderValue(BaseModel):
    stakeholder: str
    value: float


class StakeholderBreakdown(BaseModel):
    social: list[StakeholderValue]


class ScopeStakeholderValue(BaseModel):
    scope: str
    value: float
    by_stakeholder: list[StakeholderValue] = []


class ScopedCategoryValue(BaseModel):
    category: str
    value: float
    by_scope: list[ScopeStakeholderValue]


class CategoryScopeBreakdown(BaseModel):
    social: list[ScopedCategoryValue]
    biodiversity: list[ScopedCategoryValue]


class CustomHoldingIn(BaseModel):
    isin: str
    weight: float


class CustomHoldingOut(BaseModel):
    isin: str
    ticker: str
    company_name: str
    pct_of_fund: float


class CustomPortfolioResult(BaseModel):
    n_companies: int
    total_weight_input: float
    matched_weight: float
    missing_isins: list[str]
    holdings: list[CustomHoldingOut]
    impact: ImpactSummary
    social_score: float
    biodiversity_score: float
