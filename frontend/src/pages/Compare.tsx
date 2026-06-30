import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { EntityPicker } from "../components/EntityPicker";
import type { EntityPickerItem } from "../components/EntityPicker";
import { ImpactGrid } from "../components/ImpactGrid";
import { CompareBarList } from "../components/CompareBarList";
import type { CompareEntity } from "../components/CompareBarList";
import { sumGridValue } from "../gridTotals";
import { formatAmount, formatNum } from "../format";
import type {
  CategoryScopeBreakdown,
  CompanyDetail,
  GridCell,
  PortfolioDetail,
  ScopeBreakdown,
  ScoreOut,
} from "../types";

type Mode = "portfolio" | "company";

/** Sum social grid cells over the stakeholder dimension → one cell per scope×category. */
function collapseToScopeCategory(cells: GridCell[]): GridCell[] {
  const sums = new Map<string, number>();
  for (const cell of cells) {
    if (cell.value === null) continue;
    const key = `${cell.scope}|${cell.category}`;
    sums.set(key, (sums.get(key) ?? 0) + cell.value);
  }
  const seen = new Set<string>();
  const result: GridCell[] = [];
  for (const cell of cells) {
    const key = `${cell.scope}|${cell.category}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push({ scope: cell.scope, category: cell.category, stakeholder: null, value: sums.get(key) ?? null });
    }
  }
  return result;
}

function gridMaxAbs(cells: GridCell[]): number {
  return Math.max(0, ...cells.map((c) => Math.abs(c.value ?? 0)));
}

/** Aggregate grid cells by category (sum over all scope×stakeholder combos). */
function gridByCategory(cells: GridCell[]) {
  const map = new Map<string, number>();
  for (const cell of cells) {
    if (cell.value === null) continue;
    map.set(cell.category, (map.get(cell.category) ?? 0) + cell.value);
  }
  return [...map.entries()]
    .map(([category, value]) => ({ category, value }))
    .sort((a, b) => b.value - a.value);
}

/** Sum grid cells for a specific category, grouped by scope. */
function gridScopesByCategory(cells: GridCell[], category: string) {
  const map = new Map<string, number>();
  for (const cell of cells) {
    if (cell.category !== category || cell.value === null) continue;
    map.set(cell.scope, (map.get(cell.scope) ?? 0) + cell.value);
  }
  return [...map.entries()].map(([cat, value]) => ({ category: cat, value }));
}

export function Compare() {
  const [searchParams, setSearchParams] = useSearchParams();
  const mode: Mode = searchParams.get("type") === "company" ? "company" : "portfolio";
  const selectedIds = (searchParams.get("ids") || "").split(",").filter(Boolean);

  const [pickerItems, setPickerItems] = useState<EntityPickerItem[]>([]);
  const [pickerError, setPickerError] = useState<string | null>(null);

  const [portfolios, setPortfolios] = useState<PortfolioDetail[]>([]);
  const [portCategoryScopes, setPortCategoryScopes] = useState<Map<string, CategoryScopeBreakdown>>(new Map());
  const [portScopes, setPortScopes] = useState<Map<string, ScopeBreakdown>>(new Map());
  const [companies, setCompanies] = useState<CompanyDetail[]>([]);
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
    setPortCategoryScopes(new Map());
    setPortScopes(new Map());
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
      Promise.all(ids.map((id) => api.getPortfolioCategoryScopes(id).then((cs) => [String(id), cs] as const)))
        .then((entries) => setPortCategoryScopes(new Map(entries)))
        .catch(() => {});
      Promise.all(ids.map((id) => api.getPortfolioScopes(id).then((sc) => [String(id), sc] as const)))
        .then((entries) => setPortScopes(new Map(entries)))
        .catch(() => {});
    } else {
      Promise.all(selectedIds.map((ticker) => api.getCompany(ticker)))
        .then((details: CompanyDetail[]) => setCompanies(details))
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

  // Shared max-abs for company grids so heat intensity is comparable across companies.
  const sharedSocialMax = useMemo(
    () => Math.max(0, ...companies.map((c) => gridMaxAbs(collapseToScopeCategory(c.social_grid)))),
    [companies]
  );
  const sharedBioMax = useMemo(
    () => Math.max(0, ...companies.map((c) => gridMaxAbs(c.biodiversity_grid))),
    [companies]
  );

  // Portfolio: CompareBarList entities from category-scope breakdown.
  const catSocialEntities = useMemo<CompareEntity[]>(
    () =>
      portfolios
        .map((p) => {
          const cs = portCategoryScopes.get(String(p.id));
          return cs
            ? {
                id: String(p.id),
                name: p.name,
                values: cs.social.map((c) => ({ category: c.category, value: c.value })),
              }
            : null;
        })
        .filter((e): e is CompareEntity => e !== null),
    [portfolios, portCategoryScopes]
  );
  const catBioEntities = useMemo<CompareEntity[]>(
    () =>
      portfolios
        .map((p) => {
          const cs = portCategoryScopes.get(String(p.id));
          return cs
            ? {
                id: String(p.id),
                name: p.name,
                values: cs.biodiversity.map((c) => ({ category: c.category, value: c.value })),
              }
            : null;
        })
        .filter((e): e is CompareEntity => e !== null),
    [portfolios, portCategoryScopes]
  );

  // Portfolio drill-down: for each category, a CompareEntity[] with scope-level values.
  const portSocialDrillDown = useMemo<Map<string, CompareEntity[]>>(() => {
    if (catSocialEntities.length === 0) return new Map();
    const categories = catSocialEntities[0]?.values.map((v) => v.category) ?? [];
    return new Map(
      categories.map((cat) => [
        cat,
        portfolios
          .map((p) => {
            const cs = portCategoryScopes.get(String(p.id));
            const scoped = cs?.social.find((s) => s.category === cat);
            return scoped
              ? {
                  id: String(p.id),
                  name: p.name,
                  values: scoped.by_scope.map((s) => ({ category: s.scope, value: s.value })),
                }
              : null;
          })
          .filter((e): e is CompareEntity => e !== null),
      ])
    );
  }, [portfolios, portCategoryScopes, catSocialEntities]);

  const portBioDrillDown = useMemo<Map<string, CompareEntity[]>>(() => {
    if (catBioEntities.length === 0) return new Map();
    const categories = catBioEntities[0]?.values.map((v) => v.category) ?? [];
    return new Map(
      categories.map((cat) => [
        cat,
        portfolios
          .map((p) => {
            const cs = portCategoryScopes.get(String(p.id));
            const scoped = cs?.biodiversity.find((s) => s.category === cat);
            return scoped
              ? {
                  id: String(p.id),
                  name: p.name,
                  values: scoped.by_scope.map((s) => ({ category: s.scope, value: s.value })),
                }
              : null;
          })
          .filter((e): e is CompareEntity => e !== null),
      ])
    );
  }, [portfolios, portCategoryScopes, catBioEntities]);

  const scopeSocialEntities = useMemo<CompareEntity[]>(
    () =>
      portfolios
        .map((p) => {
          const sc = portScopes.get(String(p.id));
          return sc
            ? { id: String(p.id), name: p.name, values: sc.social.map((s) => ({ category: s.scope, value: s.value })) }
            : null;
        })
        .filter((e): e is CompareEntity => e !== null),
    [portfolios, portScopes]
  );
  const scopeBioEntities = useMemo<CompareEntity[]>(
    () =>
      portfolios
        .map((p) => {
          const sc = portScopes.get(String(p.id));
          return sc
            ? { id: String(p.id), name: p.name, values: sc.biodiversity.map((s) => ({ category: s.scope, value: s.value })) }
            : null;
        })
        .filter((e): e is CompareEntity => e !== null),
    [portfolios, portScopes]
  );

  // Company: CompareBarList entities computed client-side from grids.
  const companySocialCatEntities = useMemo<CompareEntity[]>(
    () =>
      companies.map((c) => ({
        id: c.ticker,
        name: c.company_name,
        values: gridByCategory(c.social_grid),
      })),
    [companies]
  );
  const companyBioCatEntities = useMemo<CompareEntity[]>(
    () =>
      companies.map((c) => ({
        id: c.ticker,
        name: c.company_name,
        values: gridByCategory(c.biodiversity_grid),
      })),
    [companies]
  );

  // Company drill-down: for each category, scope breakdown computed from grids.
  const companySocialDrillDown = useMemo<Map<string, CompareEntity[]>>(() => {
    if (companySocialCatEntities.length === 0) return new Map();
    const categories = companySocialCatEntities[0]?.values.map((v) => v.category) ?? [];
    return new Map(
      categories.map((cat) => [
        cat,
        companies.map((c) => ({
          id: c.ticker,
          name: c.company_name,
          values: gridScopesByCategory(c.social_grid, cat),
        })),
      ])
    );
  }, [companies, companySocialCatEntities]);

  const companyBioDrillDown = useMemo<Map<string, CompareEntity[]>>(() => {
    if (companyBioCatEntities.length === 0) return new Map();
    const categories = companyBioCatEntities[0]?.values.map((v) => v.category) ?? [];
    return new Map(
      categories.map((cat) => [
        cat,
        companies.map((c) => ({
          id: c.ticker,
          name: c.company_name,
          values: gridScopesByCategory(c.biodiversity_grid, cat),
        })),
      ])
    );
  }, [companies, companyBioCatEntities]);

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

      {/* ── PORTFOLIO COMPARISON ───────────────────────────────────── */}
      {mode === "portfolio" && portfolios.length > 0 && (
        <>
          {/* 1. Overview: score + total impact */}
          <section style={{ marginTop: 16 }}>
            <h2>Overview</h2>
            <div className="card-grid">
              {portfolios.map((p) => {
                const score = scores.find((s) => s.entity_id === String(p.id));
                return (
                  <div key={p.id} className="card">
                    <div className="portfolio-card__name" style={{ marginBottom: 4 }}>{p.name}</div>
                    <div className="portfolio-card__meta" style={{ marginBottom: 10 }}>
                      {p.n_companies} companies &middot; ${formatAmount(p.total_market_value)}
                    </div>
                    <div className="split-ledger">
                      <div className="split-ledger__panel">
                        <div className="split-ledger__label tone-social">SOCIAL</div>
                        <div className="split-ledger__value tone-social" style={{ fontSize: 20 }}>
                          {score ? formatNum(score.social_score) : "—"}
                        </div>
                        <div className="tone-social" style={{ fontSize: 11, fontFamily: "var(--font-mono)", opacity: 0.75 }}>
                          {p.impact.social_total_wellby.toExponential(2)} WELLBY
                        </div>
                      </div>
                      <div className="split-ledger__panel">
                        <div className="split-ledger__label tone-bio">BIODIVERSITY</div>
                        <div className="split-ledger__value tone-bio" style={{ fontSize: 20 }}>
                          {score ? formatNum(score.biodiversity_score) : "—"}
                        </div>
                        <div className="tone-bio" style={{ fontSize: 11, fontFamily: "var(--font-mono)", opacity: 0.75 }}>
                          {p.impact.biodiversity_total_pdf_yr.toExponential(2)} PDF&middot;yr
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 2. Impact by category — click to drill down into scope */}
          {catSocialEntities.length > 0 && (
            <section>
              <h2>Social impact by category &middot; WELLBY</h2>
              <p className="muted" style={{ fontSize: 11, marginBottom: 8 }}>Click a category to expand scope breakdown.</p>
              <div className="card">
                <CompareBarList entities={catSocialEntities} tone="social" drillDown={portSocialDrillDown} />
              </div>

              <h2 style={{ marginTop: 24 }}>Biodiversity impact by category &middot; PDF&middot;yr</h2>
              <p className="muted" style={{ fontSize: 11, marginBottom: 8 }}>Click a category to expand scope breakdown.</p>
              <div className="card">
                <CompareBarList entities={catBioEntities} tone="bio" drillDown={portBioDrillDown} />
              </div>
            </section>
          )}

          {/* 3. Impact by scope */}
          {scopeSocialEntities.length > 0 && (
            <section>
              <h2>Social impact by scope &middot; WELLBY</h2>
              <div className="card">
                <CompareBarList entities={scopeSocialEntities} tone="social" mode="scope" />
              </div>

              <h2 style={{ marginTop: 24 }}>Biodiversity impact by scope &middot; PDF&middot;yr</h2>
              <div className="card">
                <CompareBarList entities={scopeBioEntities} tone="bio" mode="scope" />
              </div>
            </section>
          )}
        </>
      )}

      {/* ── COMPANY COMPARISON ────────────────────────────────────── */}
      {mode === "company" && companies.length > 0 && (
        <>
          {/* 1. Overview: score + total impact */}
          <section style={{ marginTop: 16 }}>
            <h2>Overview</h2>
            <div className="card-grid">
              {companies.map((c) => {
                const score = scores.find((s) => s.entity_id === c.ticker);
                return (
                  <div key={c.ticker} className="card">
                    <div className="portfolio-card__name" style={{ marginBottom: 4 }}>{c.company_name}</div>
                    <div className="portfolio-card__meta" style={{ marginBottom: 10 }}>
                      {c.ticker} &middot; Market cap{" "}
                      {c.market_cap_usd_m !== null ? `$${formatAmount(c.market_cap_usd_m)}M` : "-"}
                    </div>
                    <div className="split-ledger">
                      <div className="split-ledger__panel">
                        <div className="split-ledger__label tone-social">SOCIAL</div>
                        <div className="split-ledger__value tone-social" style={{ fontSize: 20 }}>
                          {score ? formatNum(score.social_score) : "—"}
                        </div>
                        <div className="tone-social" style={{ fontSize: 11, fontFamily: "var(--font-mono)", opacity: 0.75 }}>
                          {sumGridValue(c.social_grid).toExponential(2)} WELLBY
                        </div>
                      </div>
                      <div className="split-ledger__panel">
                        <div className="split-ledger__label tone-bio">BIODIVERSITY</div>
                        <div className="split-ledger__value tone-bio" style={{ fontSize: 20 }}>
                          {score ? formatNum(score.biodiversity_score) : "—"}
                        </div>
                        <div className="tone-bio" style={{ fontSize: 11, fontFamily: "var(--font-mono)", opacity: 0.75 }}>
                          {sumGridValue(c.biodiversity_grid).toExponential(2)} PDF&middot;yr
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 2. Impact by category — click to drill down into scope */}
          {companySocialCatEntities.length > 0 && (
            <section>
              <h2 className="tone-social">Social impact by category &middot; WELLBY</h2>
              <p className="muted" style={{ fontSize: 11, marginBottom: 8 }}>Click a category to expand scope breakdown.</p>
              <div className="card">
                <CompareBarList entities={companySocialCatEntities} tone="social" drillDown={companySocialDrillDown} />
              </div>

              <h2 className="tone-bio" style={{ marginTop: 24 }}>Biodiversity impact by category &middot; PDF&middot;yr</h2>
              <p className="muted" style={{ fontSize: 11, marginBottom: 8 }}>Click a category to expand scope breakdown.</p>
              <div className="card">
                <CompareBarList entities={companyBioCatEntities} tone="bio" drillDown={companyBioDrillDown} />
              </div>
            </section>
          )}

          {/* 3. Social grid — shared heat scale so intensity is directly comparable */}
          <section>
            <h2 className="tone-social">Social impact detail &middot; WELLBY (scope &times; category)</h2>
            <p className="muted" style={{ fontSize: 11, marginBottom: 12 }}>
              Summed across stakeholder groups. All grids share the same colour scale.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {companies.map((c) => (
                <div key={c.ticker} className="card">
                  <div className="split-ledger__label tone-social" style={{ marginBottom: 10 }}>
                    {c.company_name}
                  </div>
                  <ImpactGrid
                    cells={collapseToScopeCategory(c.social_grid)}
                    rowKeyField="scope"
                    colKeyField="category"
                    tone="social"
                    maxAbsOverride={sharedSocialMax}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* 4. Biodiversity grid — shared heat scale */}
          <section>
            <h2 className="tone-bio">Biodiversity impact detail &middot; PDF&middot;yr (scope &times; category)</h2>
            <p className="muted" style={{ fontSize: 11, marginBottom: 12 }}>
              All grids share the same colour scale.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {companies.map((c) => (
                <div key={c.ticker} className="card">
                  <div className="split-ledger__label tone-bio" style={{ marginBottom: 10 }}>
                    {c.company_name}
                  </div>
                  <ImpactGrid
                    cells={c.biodiversity_grid}
                    rowKeyField="scope"
                    colKeyField="category"
                    tone="bio"
                    maxAbsOverride={sharedBioMax}
                  />
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
