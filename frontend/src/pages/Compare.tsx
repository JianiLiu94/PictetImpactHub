import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { EntityPicker } from "../components/EntityPicker";
import type { EntityPickerItem } from "../components/EntityPicker";
import { ScoreToggle } from "../components/ScoreToggle";
import { sumGridValue } from "../gridTotals";
import { formatAmount } from "../format";
import type { CompanyDetail, PortfolioDetail, ScoreOut } from "../types";

type Mode = "portfolio" | "company";

interface CompanyCardData {
  ticker: string;
  company_name: string;
  market_cap_usd_m: number | null;
  social_total: number;
  biodiversity_total: number;
}

export function Compare() {
  const [searchParams, setSearchParams] = useSearchParams();
  const mode: Mode = searchParams.get("type") === "company" ? "company" : "portfolio";
  const selectedIds = (searchParams.get("ids") || "").split(",").filter(Boolean);

  const [pickerItems, setPickerItems] = useState<EntityPickerItem[]>([]);
  const [pickerError, setPickerError] = useState<string | null>(null);

  const [portfolios, setPortfolios] = useState<PortfolioDetail[]>([]);
  const [companies, setCompanies] = useState<CompanyCardData[]>([]);
  const [scores, setScores] = useState<ScoreOut[]>([]);
  const [compareError, setCompareError] = useState<string | null>(null);

  useEffect(() => {
    setPickerError(null);
    if (mode === "portfolio") {
      api
        .listPortfolios()
        .then((page) =>
          setPickerItems(
            page.items.map((p) => ({ id: String(p.id), label: p.name, meta: `${p.n_companies} companies` }))
          )
        )
        .catch(() => setPickerError("Failed to load portfolios"));
    } else {
      api
        .listCompanies(500)
        .then((page) =>
          setPickerItems(page.items.map((c) => ({ id: c.ticker, label: c.company_name, meta: c.ticker })))
        )
        .catch(() => setPickerError("Failed to load companies"));
    }
  }, [mode]);

  useEffect(() => {
    setCompareError(null);
    setPortfolios([]);
    setCompanies([]);
    setScores([]);
    if (selectedIds.length < 2) return;

    if (mode === "portfolio") {
      const ids = selectedIds.map(Number);
      api.comparePortfolios(ids).then(setPortfolios).catch(() => setCompareError("Failed to load comparison"));
      api
        .getScores("portfolio")
        .then((page) => setScores(page.items.filter((s) => selectedIds.includes(s.entity_id))))
        .catch(() => setCompareError("Failed to load scores"));
    } else {
      Promise.all(selectedIds.map((ticker) => api.getCompany(ticker)))
        .then((details: CompanyDetail[]) =>
          setCompanies(
            details.map((d) => ({
              ticker: d.ticker,
              company_name: d.company_name,
              market_cap_usd_m: d.market_cap_usd_m,
              social_total: sumGridValue(d.social_grid),
              biodiversity_total: sumGridValue(d.biodiversity_grid),
            }))
          )
        )
        .catch(() => setCompareError("Failed to load comparison"));
      api
        .getScores("company")
        .then((page) => setScores(page.items.filter((s) => selectedIds.includes(s.entity_id))))
        .catch(() => setCompareError("Failed to load scores"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedIds.join(",")]);

  const setMode = (newMode: Mode) => {
    setSearchParams(newMode === "portfolio" ? {} : { type: "company" });
  };

  const toggleSelected = (id: string) => {
    const next = selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id];
    const params: Record<string, string> = { ids: next.join(",") };
    if (mode === "company") params.type = "company";
    setSearchParams(params);
  };

  return (
    <div className="content--narrow">
      <h1 className="page-title">Compare</h1>
      <p className="page-sub">Select two or more portfolios or companies to compare their impact profiles.</p>

      <div className="toggle-row" style={{ marginBottom: 16 }}>
        <button
          className={`toggle-btn${mode === "portfolio" ? " is-active" : ""}`}
          onClick={() => setMode("portfolio")}
        >
          Portfolios
        </button>
        <button className={`toggle-btn${mode === "company" ? " is-active" : ""}`} onClick={() => setMode("company")}>
          Companies
        </button>
      </div>

      {pickerError && <div className="error-text">{pickerError}</div>}
      <EntityPicker items={pickerItems} selected={selectedIds} onToggle={toggleSelected} />

      {selectedIds.length < 2 && <p className="muted">Select at least two to compare.</p>}
      {compareError && <div className="error-text">{compareError}</div>}

      {mode === "portfolio" && portfolios.length > 0 && (
        <>
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
            <ScoreToggle scores={scores} />
          </section>
        </>
      )}

      {mode === "company" && companies.length > 0 && (
        <>
          <div className="card-grid" style={{ marginTop: 16, marginBottom: 24 }}>
            {companies.map((c) => (
              <div key={c.ticker} className="card">
                <div className="portfolio-card__name" style={{ marginBottom: 4 }}>
                  {c.company_name}
                </div>
                <div className="portfolio-card__meta" style={{ marginBottom: 10 }}>
                  {c.ticker} &middot; Market cap{" "}
                  {c.market_cap_usd_m !== null ? `$${formatAmount(c.market_cap_usd_m)}M` : "-"}
                </div>
                <div className="split-ledger">
                  <div className="split-ledger__panel">
                    <div className="split-ledger__label tone-social">SOCIAL</div>
                    <div className="split-ledger__value" style={{ fontSize: 15 }}>
                      {c.social_total.toExponential(2)}
                    </div>
                  </div>
                  <div className="split-ledger__panel">
                    <div className="split-ledger__label tone-bio">BIODIVERSITY</div>
                    <div className="split-ledger__value" style={{ fontSize: 15 }}>
                      {c.biodiversity_total.toExponential(2)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <section>
            <h2>Composite scores</h2>
            <ScoreToggle scores={scores} />
          </section>
        </>
      )}
    </div>
  );
}
