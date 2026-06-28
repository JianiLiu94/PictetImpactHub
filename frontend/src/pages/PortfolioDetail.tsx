import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { PaginatedTable } from "../components/PaginatedTable";
import { ScoreToggle } from "../components/ScoreToggle";
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
  const [scores, setScores] = useState<ScoreOut[]>([]);
  const [companyScores, setCompanyScores] = useState<ScoreOut[]>([]);
  const [categories, setCategories] = useState<CategoryBreakdown | null>(null);
  const [scopes, setScopes] = useState<ScopeBreakdown | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getPortfolio(portfolioId).then(setDetail).catch(() => setError("Failed to load portfolio"));
    api.getScores("portfolio").then((page) => setScores(page.items)).catch(() => setError("Failed to load scores"));
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
            rows={holdings}
            total={holdingsTotal}
            pageSize={PAGE_SIZE}
            onPageChange={loadHoldingsPage}
            rowKey={(h) => h.ticker}
            columns={[
              { header: "Company", render: (h) => <Link to={`/companies/${h.ticker}`}>{h.company_name}</Link> },
              { header: "Weight %", render: (h) => formatNum(h.pct_of_fund) },
              { header: "Market value", render: (h) => (h.market_value !== null ? formatAmount(h.market_value) : "-") },
              {
                header: "WELLBY",
                render: (h) => {
                  const s = scoreByTicker.get(h.ticker);
                  return s ? <span className="tone-social">{formatNum(s.social_score)}</span> : "-";
                },
              },
              {
                header: "PDF·yr",
                render: (h) => {
                  const s = scoreByTicker.get(h.ticker);
                  return s ? <span className="tone-bio">{formatNum(s.biodiversity_score)}</span> : "-";
                },
              },
            ]}
          />
        </div>
      </section>

      <section>
        <h2>Composite score</h2>
        <ScoreToggle scores={scores} />
      </section>
    </div>
  );
}
