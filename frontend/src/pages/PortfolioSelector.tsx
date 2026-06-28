import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { PortfolioSummary } from "../types";

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

  if (error) return <div>{error}</div>;

  return (
    <div>
      <h1>Portfolios</h1>
      <ul>
        {portfolios.map((p) => (
          <li key={p.id}>
            <input
              type="checkbox"
              checked={selected.includes(p.id)}
              onChange={() => toggleSelected(p.id)}
            />
            <Link to={`/portfolios/${p.id}`}>{p.name}</Link>
            <span> — {p.n_companies} companies, ${p.total_market_value.toLocaleString()}</span>
          </li>
        ))}
      </ul>
      <button
        disabled={selected.length < 2}
        onClick={() => navigate(`/portfolios/compare?ids=${selected.join(",")}`)}
      >
        Compare selected
      </button>
    </div>
  );
}
