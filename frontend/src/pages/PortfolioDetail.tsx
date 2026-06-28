import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { PaginatedTable } from "../components/PaginatedTable";
import { ScoreToggle } from "../components/ScoreToggle";
import type { HoldingOut, PortfolioDetail as PortfolioDetailType, ScoreOut } from "../types";

const PAGE_SIZE = 20;

export function PortfolioDetail() {
  const { id } = useParams<{ id: string }>();
  const portfolioId = Number(id);

  const [detail, setDetail] = useState<PortfolioDetailType | null>(null);
  const [holdings, setHoldings] = useState<HoldingOut[]>([]);
  const [holdingsTotal, setHoldingsTotal] = useState(0);
  const [scores, setScores] = useState<ScoreOut[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getPortfolio(portfolioId).then(setDetail).catch(() => setError("Failed to load portfolio"));
    api.getScores("portfolio").then((page) => setScores(page.items)).catch(() => setError("Failed to load scores"));
  }, [portfolioId]);

  const loadHoldingsPage = (offset: number) => {
    api
      .getPortfolioCompanies(portfolioId, PAGE_SIZE, offset)
      .then((page) => {
        setHoldings(page.items);
        setHoldingsTotal(page.total);
      })
      .catch(() => setError("Failed to load holdings"));
  };

  useEffect(() => {
    loadHoldingsPage(0);
  }, [portfolioId]);

  if (error) return <div>{error}</div>;
  if (!detail) return <div>Loading...</div>;

  return (
    <div>
      <h1>{detail.name}</h1>
      <p>{detail.n_companies} companies, ${detail.total_market_value.toLocaleString()} total value</p>
      <p>Social impact: {detail.impact.social_total_wellby.toFixed(4)} WELLBYs (weighted)</p>
      <p>Biodiversity impact: {detail.impact.biodiversity_total_pdf_yr.toFixed(6)} PDF·yr (weighted)</p>

      <h2>Holdings</h2>
      <PaginatedTable
        rows={holdings}
        total={holdingsTotal}
        pageSize={PAGE_SIZE}
        onPageChange={loadHoldingsPage}
        rowKey={(h) => h.ticker}
        columns={[
          { header: "Company", render: (h) => <Link to={`/companies/${h.ticker}`}>{h.company_name}</Link> },
          { header: "Weight %", render: (h) => h.pct_of_fund.toFixed(2) },
          { header: "Market value", render: (h) => h.market_value?.toLocaleString() ?? "-" },
        ]}
      />

      <h2>Composite score</h2>
      <ScoreToggle scores={scores} />
    </div>
  );
}
