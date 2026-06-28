import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { ScoreToggle } from "../components/ScoreToggle";
import type { PortfolioDetail, ScoreOut } from "../types";

export function PortfolioCompare() {
  const [searchParams] = useSearchParams();
  const ids = (searchParams.get("ids") || "")
    .split(",")
    .filter(Boolean)
    .map(Number);

  const [portfolios, setPortfolios] = useState<PortfolioDetail[]>([]);
  const [allScores, setAllScores] = useState<ScoreOut[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ids.length === 0) return;
    api.comparePortfolios(ids).then(setPortfolios).catch(() => setError("Failed to load comparison"));
    api.getScores("portfolio").then((page) => setAllScores(page.items)).catch(() => setError("Failed to load scores"));
  }, [ids.join(",")]);

  if (ids.length === 0) return <div>No portfolios selected. Go back and select at least two.</div>;
  if (error) return <div>{error}</div>;

  const selectedScores = allScores.filter((s) => ids.includes(Number(s.entity_id)));

  return (
    <div>
      <h1>Portfolio comparison</h1>
      <div style={{ display: "flex", gap: "2rem" }}>
        {portfolios.map((p) => (
          <div key={p.id}>
            <h2>{p.name}</h2>
            <p>{p.n_companies} companies, ${p.total_market_value.toLocaleString()}</p>
            <p>Social: {p.impact.social_total_wellby.toFixed(4)} WELLBYs</p>
            <p>Biodiversity: {p.impact.biodiversity_total_pdf_yr.toFixed(6)} PDF·yr</p>
          </div>
        ))}
      </div>

      <h2>Composite scores</h2>
      <ScoreToggle scores={selectedScores} />
    </div>
  );
}
