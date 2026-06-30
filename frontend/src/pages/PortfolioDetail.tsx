import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { PaginatedTable } from "../components/PaginatedTable";
import { CategoryBarList } from "../components/CategoryBarList";
import { ArrowLeftIcon } from "../components/Icon";
import { formatAmount, formatNum } from "../format";
import type {
  CategoryBreakdown,
  HoldingOut,
  PortfolioDetail as PortfolioDetailType,
  ScopeBreakdown,
  ScoreOut,
} from "../types";

const PAGE_SIZE = 20;

export function PortfolioDetail() {
  const { id } = useParams<{ id: string }>();
  const portfolioId = Number(id);

  const [detail, setDetail] = useState<PortfolioDetailType | null>(null);
  const [holdings, setHoldings] = useState<HoldingOut[]>([]);
  const [holdingsTotal, setHoldingsTotal] = useState(0);
  const [companyScores, setCompanyScores] = useState<ScoreOut[]>([]);
  const [categories, setCategories] = useState<CategoryBreakdown | null>(null);
  const [scopes, setScopes] = useState<ScopeBreakdown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    api.getPortfolio(portfolioId).then(setDetail).catch(() => setError("Failed to load portfolio"));
    api
      .getScores("company")
      .then((page) => setCompanyScores(page.items))
      .catch(() => setError("Failed to load scores"));
    api
      .getPortfolioCategories(portfolioId)
      .then(setCategories)
      .catch(() => setError("Failed to load category breakdown"));
    api
      .getPortfolioScopes(portfolioId)
      .then(setScopes)
      .catch(() => setError("Failed to load scope breakdown"));
  }, [portfolioId]);

  const scoreByTicker = new Map(companyScores.map((s) => [s.entity_id, s]));

  const loadHoldingsPage = (offset: number, sortByOverride = sortBy, sortDirOverride = sortDir) => {
    api
      .getPortfolioCompanies(portfolioId, PAGE_SIZE, offset, sortByOverride ?? undefined, sortDirOverride)
      .then((page) => {
        setHoldings(page.items);
        setHoldingsTotal(page.total);
      })
      .catch(() => setError("Failed to load holdings"));
  };

  useEffect(() => {
    loadHoldingsPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolioId]);

  const handleSort = (key: string) => {
    const nextDir = sortBy === key && sortDir === "asc" ? "desc" : "asc";
    setSortBy(key);
    setSortDir(nextDir);
    loadHoldingsPage(0, key, nextDir);
  };

  if (error) return <div className="error-text">{error}</div>;
  if (!detail) return <div className="muted">Loading...</div>;

  return (
    <div className="content--narrow">
      <Link to="/" className="breadcrumb">
        <ArrowLeftIcon /> Portfolios
      </Link>
      <h1 className="page-title">{detail.name}</h1>
      <p className="page-sub">
        {detail.n_companies} companies &middot; ${formatAmount(detail.total_market_value)} total value
      </p>

      <div className="split-ledger" style={{ marginBottom: 24 }}>
        <div className="split-ledger__panel">
          <div className="split-ledger__label tone-social">SOCIAL &middot; WELLBY</div>
          <div className="split-ledger__value">{detail.impact.social_total_wellby.toExponential(2)}</div>
          <div className="muted" style={{ fontSize: 11 }}>Weighted across holdings</div>
        </div>
        <div className="split-ledger__panel">
          <div className="split-ledger__label tone-bio">BIODIVERSITY &middot; PDF&middot;YR</div>
          <div className="split-ledger__value">{detail.impact.biodiversity_total_pdf_yr.toExponential(2)}</div>
          <div className="muted" style={{ fontSize: 11 }}>Weighted across holdings</div>
        </div>
      </div>

      {categories && (
        <section>
          <h2>Weighted sum by category</h2>
          <div className="split-ledger">
            <div className="split-ledger__panel">
              <div className="split-ledger__label tone-social">SOCIAL &middot; WELLBY</div>
              <CategoryBarList values={categories.social} tone="social" />
            </div>
            <div className="split-ledger__panel">
              <div className="split-ledger__label tone-bio">BIODIVERSITY &middot; PDF&middot;YR</div>
              <CategoryBarList values={categories.biodiversity} tone="bio" />
            </div>
          </div>
        </section>
      )}

      {scopes && (
        <section>
          <h2>Weighted sum by scope</h2>
          <div className="split-ledger">
            <div className="split-ledger__panel">
              <div className="split-ledger__label tone-social">SOCIAL &middot; WELLBY</div>
              <CategoryBarList
                values={scopes.social.map((s) => ({ category: s.scope, value: s.value }))}
                tone="social"
                mode="scope"
              />
            </div>
            <div className="split-ledger__panel">
              <div className="split-ledger__label tone-bio">BIODIVERSITY &middot; PDF&middot;YR</div>
              <CategoryBarList
                values={scopes.biodiversity.map((s) => ({ category: s.scope, value: s.value }))}
                tone="bio"
                mode="scope"
              />
            </div>
          </div>
        </section>
      )}

      <section>
        <h2>Holdings</h2>
        <div className="table-wrap">
          <PaginatedTable
            key={`${sortBy}-${sortDir}`}
            rows={holdings}
            total={holdingsTotal}
            pageSize={PAGE_SIZE}
            onPageChange={(offset) => loadHoldingsPage(offset)}
            rowKey={(h) => h.ticker}
            sortBy={sortBy}
            sortDir={sortDir}
            onSort={handleSort}
            columns={[
              {
                header: "Company",
                sortKey: "company_name",
                render: (h) => <Link to={`/companies/${h.ticker}`}>{h.company_name}</Link>,
              },
              { header: "Weight %", sortKey: "pct_of_fund", render: (h) => formatNum(h.pct_of_fund) },
              {
                header: "Market value",
                sortKey: "market_value",
                render: (h) => (h.market_value !== null ? formatAmount(h.market_value) : "-"),
              },
              {
                header: "Social impact · WELLBY",
                sortKey: "social_score",
                render: (h) => {
                  const s = scoreByTicker.get(h.ticker);
                  return s ? <span className="tone-social">{s.social_impact.toExponential(2)}</span> : "-";
                },
              },
              {
                header: "Biodiversity impact · PDF·yr",
                sortKey: "biodiversity_score",
                render: (h) => {
                  const s = scoreByTicker.get(h.ticker);
                  return s ? <span className="tone-bio">{s.biodiversity_impact.toExponential(2)}</span> : "-";
                },
              },
            ]}
          />
        </div>
      </section>

    </div>
  );
}
