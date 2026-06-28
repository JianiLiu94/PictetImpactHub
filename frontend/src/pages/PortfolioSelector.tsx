import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { CpuIcon, GlobeIcon, LeafIcon } from "../components/Icon";
import { formatAmount } from "../format";
import type { PortfolioSummary } from "../types";

function themeIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("planet") || lower.includes("clean")) return { icon: <LeafIcon />, bg: "#085041" };
  if (lower.includes("international") || lower.includes("global") || lower.includes("world"))
    return { icon: <GlobeIcon />, bg: "#534ab7" };
  return { icon: <CpuIcon />, bg: "#0c447c" };
}

export function PortfolioSelector() {
  const [portfolios, setPortfolios] = useState<PortfolioSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .listPortfolios()
      .then((page) => setPortfolios(page.items))
      .catch(() => setError("Failed to load portfolios"));
  }, []);

  if (error) return <div className="error-text">{error}</div>;

  return (
    <div>
      <h1 className="page-title">Portfolios</h1>
      <p className="page-sub">Browse portfolios, or head to Compare to compare two or more.</p>

      <div className="card-grid">
        {portfolios.map((p) => {
          const theme = themeIcon(p.name);
          return (
            <div key={p.id} className="card portfolio-card" onClick={() => navigate(`/portfolios/${p.id}`)}>
              <div className="portfolio-card__head">
                <div className="theme-icon" style={{ background: theme.bg }}>
                  {theme.icon}
                </div>
                <div>
                  <div className="portfolio-card__name">{p.name}</div>
                  <div className="portfolio-card__meta">
                    {p.n_companies} companies &middot; ${formatAmount(p.total_market_value)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
