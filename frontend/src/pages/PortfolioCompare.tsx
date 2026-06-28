import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { ScoreToggle } from "../components/ScoreToggle";
import { ArrowLeftIcon } from "../components/Icon";
import { formatAmount } from "../format";
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

  if (ids.length === 0)
    return (
      <div>
        <p className="muted">No portfolios selected. Go back and select at least two.</p>
        <Link to="/" className="breadcrumb">
          <ArrowLeftIcon /> Portfolios
        </Link>
      </div>
    );
  if (error) return <div className="error-text">{error}</div>;

  const selectedScores = allScores.filter((s) => ids.includes(Number(s.entity_id)));

  return (
    <div className="content--narrow">
      <Link to="/" className="breadcrumb">
        <ArrowLeftIcon /> Portfolios
      </Link>
      <h1 className="page-title">Portfolio comparison</h1>

      <div className="card-grid" style={{ marginTop: 16, marginBottom: 24 }}>
        {portfolios.map((p) => (
          <div key={p.id} className="card">
            <div className="portfolio-card__name" style={{ marginBottom: 4 }}>
              {p.name}
            </div>
            <div className="portfolio-card__meta" style={{ marginBottom: 10 }}>
              {p.n_companies} companies &middot; ${formatAmount(p.total_market_value)}
            </div>
            <div className="split-ledger">
              <div className="split-ledger__panel">
                <div className="split-ledger__label tone-social">SOCIAL</div>
                <div className="split-ledger__value" style={{ fontSize: 15 }}>
                  {p.impact.social_total_wellby.toExponential(2)}
                </div>
              </div>
              <div className="split-ledger__panel">
                <div className="split-ledger__label tone-bio">BIODIVERSITY</div>
                <div className="split-ledger__value" style={{ fontSize: 15 }}>
                  {p.impact.biodiversity_total_pdf_yr.toExponential(2)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <section>
        <h2>Composite scores</h2>
        <ScoreToggle scores={selectedScores} />
      </section>
    </div>
  );
}
