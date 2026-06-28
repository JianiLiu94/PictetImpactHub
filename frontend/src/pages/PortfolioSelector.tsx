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
  const [selected, setSelected] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .listPortfolios()
      .then((page) => setPortfolios(page.items))
      .catch(() => setError("Failed to load portfolios"));
  }, []);

  const toggleSelected = (id: number) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  if (error) return <div className="error-text">{error}</div>;

  return (
    <div>
      <h1 className="page-title">Portfolios</h1>
      <p className="page-sub">Select two or more to compare their impact profiles.</p>

      <div className="card-grid">
        {portfolios.map((p) => {
          const theme = themeIcon(p.name);
          const isSelected = selected.includes(p.id);
          return (
            <div
              key={p.id}
              className="card portfolio-card"
              onClick={() => navigate(`/portfolios/${p.id}`)}
              style={isSelected ? { borderColor: "var(--brand)" } : undefined}
            >
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
              <label
                style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}
                onClick={(e) => e.stopPropagation()}
              >
                <input type="checkbox" checked={isSelected} onChange={() => toggleSelected(p.id)} />
                Select for comparison
              </label>
            </div>
          );
        })}
      </div>

      <div className="compare-bar">
        <button
          className="toggle-btn"
          disabled={selected.length < 2}
          onClick={() => navigate(`/compare?ids=${selected.join(",")}`)}
        >
          Compare selected
        </button>
      </div>
    </div>
  );
}
