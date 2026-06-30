export interface CompanySummary {
  ticker: string;
  company_name: string;
  isin: string;
  market_cap_usd_m: number | null;
  sales_usd_m: number | null;
}

export interface GridCell {
  scope: string;
  category: string;
  stakeholder: string | null;
  value: number | null;
}

export interface CompanyDetail extends CompanySummary {
  social_grid: GridCell[];
  biodiversity_grid: GridCell[];
}

export interface ImpactSummary {
  social_total_wellby: number;
  biodiversity_total_pdf_yr: number;
}

export interface PortfolioSummary {
  id: number;
  name: string;
  n_companies: number;
  total_market_value: number;
}

export interface PortfolioDetail extends PortfolioSummary {
  impact: ImpactSummary;
}

export interface HoldingOut {
  ticker: string;
  company_name: string;
  pct_of_fund: number;
  shares: number | null;
  market_value: number | null;
}

export interface ScoreOut {
  entity_id: string;
  name: string;
  social_score: number;
  biodiversity_score: number;
  social_impact: number;
  biodiversity_impact: number;
}

export interface CategoryValue {
  category: string;
  value: number;
}

export interface CategoryBreakdown {
  social: CategoryValue[];
  biodiversity: CategoryValue[];
}

export interface ScopeValue {
  scope: string;
  value: number;
}

export interface ScopeBreakdown {
  social: ScopeValue[];
  biodiversity: ScopeValue[];
}

export interface CustomHoldingIn {
  isin: string;
  weight: number;
}

export interface CustomHoldingOut {
  isin: string;
  ticker: string;
  company_name: string;
  pct_of_fund: number;
}

export interface CustomPortfolioResult {
  n_companies: number;
  total_weight_input: number;
  matched_weight: number;
  missing_isins: string[];
  holdings: CustomHoldingOut[];
  impact: ImpactSummary;
  social_score: number;
  biodiversity_score: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number | null;
  offset: number;
}
