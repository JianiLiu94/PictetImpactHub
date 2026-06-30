import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { CpuIcon, GlobeIcon, LeafIcon } from "../components/Icon";
import { formatAmount, formatNum } from "../format";
import type { ImpactSummary, PortfolioSummary, ScoreOut } from "../types";

function themeIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("planet") || lower.includes("clean")) return { icon: <LeafIcon />, bg: "#085041" };
  if (lower.includes("international") || lower.includes("global") || lower.includes("world"))
    return { icon: <GlobeIcon />, bg: "#534ab7" };
  return { icon: <CpuIcon />, bg: "#0c447c" };
}

export function PortfolioSelector() {
  const [portfolios, setPortfolios] = useState<PortfolioSummary[]>([]);
  const [scores, setScores] = useState<ScoreOut[]>([]);
  const [impactById, setImpactById] = useState<Map<number, ImpactSummary>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    api
      .listPortfolios()
      .then((page) => setPortfolios(page.items))
      .catch(() => setError("Failed to load portfolios"));
    api
      .getScores("portfolio")
      .then((page) => setScores(page.items))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (portfolios.length === 0) return;
    api
      .comparePortfolios(portfolios.map((p) => p.id))
      .then((details) => setImpactById(new Map(details.map((d) => [d.id, d.impact]))))
      .catch(() => {});
  }, [portfolios]);

  const scoreById = useMemo(
    () => new Map(scores.map((s) => [s.entity_id, s])),
    [scores]
  );

  const filtered = useMemo(
    () => portfolios.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase())),
    [portfolios, query]
  );

  if (error) return <div className="error-text">{error}</div>;

  return (
    <div>
      <h1 className="page-title">Portfolios</h1>
      <p className="page-sub">Browse portfolios, or head to Compare to compare two or more.</p>

      <input
        type="text"
        className="autocomplete__input"
        placeholder="Search portfolios by name..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ marginBottom: 16 }}
      />

      {filtered.length === 0 && (
        <p className="muted">No portfolios match &ldquo;{query}&rdquo;.</p>
      )}

      <div className="card-grid">
        {filtered.map((p) => {
          const theme = themeIcon(p.name);
          const score = scoreById.get(String(p.id));
          const impact = impactById.get(p.id);
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

              {score && (
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, fontFamily: "var(--font-mono)" }}>
                  <span className="tone-social">Social score {formatNum(score.social_score ?? 0)}</span>
                  <span className="tone-bio">Bio score {formatNum(score.biodiversity_score ?? 0)}</span>
                </div>
              )}
              {impact && (
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10.5, fontFamily: "var(--font-mono)", opacity: 0.75 }}>
                  <span className="tone-social">
                    Social impact {impact.social_total_wellby.toExponential(2)} WELLBY
                  </span>
                  <span className="tone-bio">
                    Bio impact {impact.biodiversity_total_pdf_yr.toExponential(2)} PDF&middot;yr
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
