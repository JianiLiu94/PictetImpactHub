import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { Avatar } from "../components/Avatar";
import { ChevronDownIcon, ChevronUpIcon } from "../components/Icon";
import { formatAmount, formatNum } from "../format";
import type { CompanySummary, ScoreOut } from "../types";

type SortKey = "name" | "market_cap" | "social" | "biodiversity";

interface Row {
  ticker: string;
  company_name: string;
  market_cap_usd_m: number | null;
  social_score: number | null;
  biodiversity_score: number | null;
}

export function CompaniesList() {
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [scores, setScores] = useState<ScoreOut[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("social");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    api
      .listCompanies(500)
      .then((page) => setCompanies(page.items))
      .catch(() => setError("Failed to load companies"));
    api
      .getScores("company")
      .then((page) => setScores(page.items))
      .catch(() => setError("Failed to load scores"));
  }, []);

  const rows: Row[] = useMemo(() => {
    const scoreByTicker = new Map(scores.map((s) => [s.entity_id, s]));
    return companies.map((c) => {
      const s = scoreByTicker.get(c.ticker);
      return {
        ticker: c.ticker,
        company_name: c.company_name,
        market_cap_usd_m: c.market_cap_usd_m,
        social_score: s ? s.social_score : null,
        biodiversity_score: s ? s.biodiversity_score : null,
      };
    });
  }, [companies, scores]);

  const sorted = useMemo(() => {
    const withFallback = (v: number | null) => (v === null ? -Infinity : v);
    const copy = [...rows];
    copy.sort((a, b) => {
      let diff = 0;
      if (sortKey === "name") diff = a.company_name.localeCompare(b.company_name);
      else if (sortKey === "market_cap") diff = withFallback(a.market_cap_usd_m) - withFallback(b.market_cap_usd_m);
      else if (sortKey === "social") diff = withFallback(a.social_score) - withFallback(b.social_score);
      else diff = withFallback(a.biodiversity_score) - withFallback(b.biodiversity_score);
      return sortDir === "asc" ? diff : -diff;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sortIcon = (key: SortKey) => {
    if (key !== sortKey) return null;
    return sortDir === "asc" ? <ChevronUpIcon /> : <ChevronDownIcon />;
  };

  if (error) return <div className="error-text">{error}</div>;

  return (
    <div>
      <div className="entity-header" style={{ justifyContent: "space-between", display: "flex" }}>
        <h1 className="page-title">Companies</h1>
        <span className="muted" style={{ fontSize: 12 }}>
          {sorted.length} companies, ranked
        </span>
      </div>

      <p className="muted" style={{ fontSize: 11, marginBottom: 8 }}>
        Click a column header to sort. Row click opens the company detail page.
      </p>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>
                <button className="sort-btn" onClick={() => toggleSort("name")}>
                  Company {sortIcon("name")}
                </button>
              </th>
              <th>
                <button className="sort-btn" onClick={() => toggleSort("market_cap")}>
                  Market cap {sortIcon("market_cap")}
                </button>
              </th>
              <th className="tone-social">
                <button className="sort-btn" onClick={() => toggleSort("social")}>
                  WELLBY {sortIcon("social")}
                </button>
              </th>
              <th className="tone-bio">
                <button className="sort-btn" onClick={() => toggleSort("biodiversity")}>
                  PDF&middot;yr {sortIcon("biodiversity")}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.ticker}>
                <td>
                  <Link to={`/companies/${row.ticker}`} className="row-name">
                    <Avatar name={row.company_name} />
                    {row.company_name}
                  </Link>
                </td>
                <td className="num">
                  {row.market_cap_usd_m !== null ? `$${formatAmount(row.market_cap_usd_m)}M` : "-"}
                </td>
                <td className="num tone-social">
                  {row.social_score !== null ? formatNum(row.social_score) : "-"}
                  {row.social_score !== null && (
                    <span className="score-bar" style={{ background: "var(--social-soft)" }}>
                      <span style={{ width: `${row.social_score}%`, background: "var(--social)" }} />
                    </span>
                  )}
                </td>
                <td className="num tone-bio">
                  {row.biodiversity_score !== null ? formatNum(row.biodiversity_score) : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
