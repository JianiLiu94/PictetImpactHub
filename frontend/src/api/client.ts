import type {
  CompanyDetail,
  CompanySummary,
  HoldingOut,
  Page,
  PortfolioDetail,
  PortfolioSummary,
  ScoreOut,
} from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`Request to ${path} failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  listPortfolios: (limit?: number, offset = 0) =>
    request<Page<PortfolioSummary>>(`/portfolios?${limit ? `limit=${limit}&` : ""}offset=${offset}`),
  getPortfolio: (id: number) => request<PortfolioDetail>(`/portfolios/${id}`),
  getPortfolioCompanies: (id: number, limit?: number, offset = 0) =>
    request<Page<HoldingOut>>(`/portfolios/${id}/companies?${limit ? `limit=${limit}&` : ""}offset=${offset}`),
  comparePortfolios: (ids: number[]) =>
    request<PortfolioDetail[]>(`/portfolios/compare?ids=${ids.join(",")}`),
  listCompanies: (limit?: number, offset = 0) =>
    request<Page<CompanySummary>>(`/companies?${limit ? `limit=${limit}&` : ""}offset=${offset}`),
  getCompany: (ticker: string) => request<CompanyDetail>(`/companies/${ticker}`),
  getScores: (entityType: "company" | "portfolio") =>
    request<Page<ScoreOut>>(`/scores?entity_type=${entityType}`),
};
