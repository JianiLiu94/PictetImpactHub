import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { Autocomplete } from "../components/Autocomplete";
import type { AutocompleteItem } from "../components/Autocomplete";
import { Avatar } from "../components/Avatar";
import { ChevronDownIcon, ChevronUpIcon } from "../components/Icon";
import { formatAmount } from "../format";
import type { CompanySummary, ScoreOut } from "../types";

type SortKey = "name" | "market_cap" | "social" | "biodiversity";

interface Row {
  ticker: string;
  company_name: string;
  market_cap_usd_m: number | null;
  social_impact: number | null;
  biodiversity_impact: number | null;
}

export function CompaniesList() {
  const navigate = useNavigate();
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
        social_impact: s ? s.social_impact : null,
        biodiversity_impact: s ? s.biodiversity_impact : null,
      };
    });
  }, [companies, scores]);

  const autocompleteItems: AutocompleteItem[] = useMemo(
    () => companies.map((c) => ({ id: c.ticker, label: c.company_name, meta: c.ticker })),
    [companies]
  );

  const sorted = useMemo(() => {
    const withFallback = (v: number | null) => (v === null ? -Infinity : v);
    const copy = [...rows];
    copy.sort((a, b) => {
      let diff = 0;
      if (sortKey === "name") diff = a.company_name.localeCompare(b.company_name);
      else if (sortKey === "market_cap") diff = withFallback(a.market_cap_usd_m) - withFallback(b.market_cap_usd_m);
      else if (sortKey === "social") diff = withFallback(a.social_impact) - withFallback(b.social_impact);
      else diff = withFallback(a.biodiversity_impact) - withFallback(b.biodiversity_impact);
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

      <Autocomplete
        items={autocompleteItems}
        placeholder="Search companies..."
        onSelect={(item) => navigate(`/companies/${item.id}`)}
      />

      <p className="muted" style={{ fontSize: 11, marginBottom: 8 }}>
        Click a column header to sort. Row click opens the company detail page. Social and
        biodiversity columns show raw impact totals (WELLBY / PDF&middot;yr), not percentile
        scores &mdash; see the company page for scores.
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
                  Social impact &middot; WELLBY {sortIcon("social")}
                </button>
              </th>
              <th className="tone-bio">
                <button className="sort-btn" onClick={() => toggleSort("biodiversity")}>
                  Biodiversity impact &middot; PDF&middot;yr {sortIcon("biodiversity")}
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
                  {row.social_impact !== null ? row.social_impact.toExponential(2) : "-"}
                </td>
                <td className="num tone-bio">
                  {row.biodiversity_impact !== null ? row.biodiversity_impact.toExponential(2) : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
