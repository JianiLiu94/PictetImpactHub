import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { EntityPicker } from "../components/EntityPicker";
import type { EntityPickerItem } from "../components/EntityPicker";
import { CompareBarList } from "../components/CompareBarList";
import type { CompareEntity, DrillDownData } from "../components/CompareBarList";
import { sumGridValue } from "../gridTotals";
import { formatAmount, formatNum } from "../format";
import type {
  CategoryScopeBreakdown,
  CompanyDetail,
  GridCell,
  PortfolioDetail,
  ScoreOut,
} from "../types";

type Mode = "portfolio" | "company";
type SocialBreakdown = "category" | "scope" | "stakeholder";
type BioBreakdown = "category" | "scope";

// ── Grid helpers ─────────────────────────────────────────────────────────────

function sumGridCells(cells: GridCell[], filter: Partial<Pick<GridCell, "scope" | "category" | "stakeholder">>) {
  const map = new Map<string, number>();
  for (const cell of cells) {
    if (cell.value === null) continue;
    if (filter.scope && cell.scope !== filter.scope) continue;
    if (filter.category && cell.category !== filter.category) continue;
    if (filter.stakeholder !== undefined && cell.stakeholder !== filter.stakeholder) continue;
    // group by whichever dimension is NOT filtered
    let key: string;
    if (!filter.category) key = cell.category;
    else if (!filter.scope) key = cell.scope;
    else key = cell.stakeholder ?? "unknown";
    map.set(key, (map.get(key) ?? 0) + cell.value);
  }
  return [...map.entries()]
    .map(([category, value]) => ({ category, value }))
    .sort((a, b) => b.value - a.value);
}

function gridPrimary(cells: GridCell[], dim: "category" | "scope" | "stakeholder") {
  const map = new Map<string, number>();
  for (const cell of cells) {
    if (cell.value === null) continue;
    const key = dim === "stakeholder" ? (cell.stakeholder ?? "unknown") : cell[dim];
    map.set(key, (map.get(key) ?? 0) + cell.value);
  }
  return [...map.entries()]
    .map(([category, value]) => ({ category, value }))
    .sort((a, b) => b.value - a.value);
}

// ── DrillDown builders ────────────────────────────────────────────────────────

/** Company social: builds drill-down hierarchy for given primary dimension. */
function buildCompanySocialDrillDown(
  companies: CompanyDetail[],
  primary: SocialBreakdown
): { entities: CompareEntity[]; drillDown: Map<string, DrillDownData> } {
  const order: SocialBreakdown[] = ["category", "scope", "stakeholder"];
  const rest = order.filter((d) => d !== primary) as SocialBreakdown[];

  const topValues = companies.map((c) => ({
    id: c.ticker,
    name: c.company_name,
    values: gridPrimary(c.social_grid, primary),
  }));

  const keys = Array.from(new Set(topValues.flatMap((e) => e.values.map((v) => v.category))));

  const drillDown = new Map<string, DrillDownData>(
    keys.map((key) => {
      // Second level
      const secondDim = rest[0];
      const secondEntities = companies.map((c) => ({
        id: c.ticker,
        name: c.company_name,
        values: sumGridCells(c.social_grid, { [primary]: key }),
      }));
      const secondKeys = Array.from(new Set(secondEntities.flatMap((e) => e.values.map((v) => v.category))));

      // Third level (stakeholder at end)
      const thirdDim = rest[1];
      const thirdChildren = new Map<string, DrillDownData>(
        secondKeys.map((sk) => [
          sk,
          {
            entities: companies.map((c) => ({
              id: c.ticker,
              name: c.company_name,
              values: sumGridCells(c.social_grid, { [primary]: key, [secondDim]: sk }),
            })),
            mode: thirdDim,
          },
        ])
      );

      return [
        key,
        {
          entities: secondEntities,
          mode: secondDim,
          children: thirdChildren,
        },
      ];
    })
  );

  return { entities: topValues, drillDown };
}

/** Company bio: builds drill-down hierarchy for given primary dimension (no stakeholder). */
function buildCompanyBioDrillDown(
  companies: CompanyDetail[],
  primary: BioBreakdown
): { entities: CompareEntity[]; drillDown: Map<string, DrillDownData> } {
  const secondDim: BioBreakdown = primary === "category" ? "scope" : "category";

  const topValues = companies.map((c) => ({
    id: c.ticker,
    name: c.company_name,
    values: gridPrimary(c.biodiversity_grid, primary),
  }));

  const keys = Array.from(new Set(topValues.flatMap((e) => e.values.map((v) => v.category))));

  const drillDown = new Map<string, DrillDownData>(
    keys.map((key) => [
      key,
      {
        entities: companies.map((c) => ({
          id: c.ticker,
          name: c.company_name,
          values: sumGridCells(c.biodiversity_grid, { [primary]: key }),
        })),
        mode: secondDim,
      },
    ])
  );

  return { entities: topValues, drillDown };
}

/** Portfolio social: builds drill-down from the full category×scope×stakeholder backend data. */
function buildPortfolioSocialDrillDown(
  portfolios: PortfolioDetail[],
  cs: Map<string, CategoryScopeBreakdown>,
  primary: SocialBreakdown
): { entities: CompareEntity[]; drillDown: Map<string, DrillDownData> } {
  if (primary === "category") {
    const topEntities = portfolios
      .map((p) => {
        const data = cs.get(String(p.id));
        return data
          ? { id: String(p.id), name: p.name, values: data.social.map((c) => ({ category: c.category, value: c.value })) }
          : null;
      })
      .filter((e): e is CompareEntity => e !== null);

    const cats = topEntities[0]?.values.map((v) => v.category) ?? [];
    const drillDown = new Map<string, DrillDownData>(
      cats.map((cat) => {
        // second: scope
        const scopeEntities = portfolios
          .map((p) => {
            const scoped = cs.get(String(p.id))?.social.find((s) => s.category === cat);
            return scoped
              ? { id: String(p.id), name: p.name, values: scoped.by_scope.map((s) => ({ category: s.scope, value: s.value })) }
              : null;
          })
          .filter((e): e is CompareEntity => e !== null);

        const scopes = scopeEntities[0]?.values.map((v) => v.category) ?? [];
        // third: stakeholder
        const scopeChildren = new Map<string, DrillDownData>(
          scopes.map((sc) => [
            sc,
            {
              entities: portfolios
                .map((p) => {
                  const scoped = cs.get(String(p.id))?.social.find((s) => s.category === cat);
                  const scopeRow = scoped?.by_scope.find((s) => s.scope === sc);
                  return scopeRow
                    ? { id: String(p.id), name: p.name, values: scopeRow.by_stakeholder.map((s) => ({ category: s.stakeholder, value: s.value })) }
                    : null;
                })
                .filter((e): e is CompareEntity => e !== null),
              mode: "stakeholder" as const,
            },
          ])
        );

        return [cat, { entities: scopeEntities, mode: "scope" as const, children: scopeChildren }];
      })
    );

    return { entities: topEntities, drillDown };
  }

  if (primary === "scope") {
    // Aggregate each portfolio's social data by scope (sum over all cats)
    const topEntities = portfolios
      .map((p) => {
        const data = cs.get(String(p.id));
        if (!data) return null;
        const scopeMap = new Map<string, number>();
        for (const cat of data.social) {
          for (const sc of cat.by_scope) {
            scopeMap.set(sc.scope, (scopeMap.get(sc.scope) ?? 0) + sc.value);
          }
        }
        return { id: String(p.id), name: p.name, values: [...scopeMap.entries()].map(([category, value]) => ({ category, value })) };
      })
      .filter((e): e is CompareEntity => e !== null);

    const scopes = Array.from(new Set(topEntities.flatMap((e) => e.values.map((v) => v.category))));
    const drillDown = new Map<string, DrillDownData>(
      scopes.map((sc) => {
        // second: category
        const catEntities = portfolios
          .map((p) => {
            const data = cs.get(String(p.id));
            if (!data) return null;
            const vals = data.social.map((cat) => ({
              category: cat.category,
              value: cat.by_scope.find((s) => s.scope === sc)?.value ?? 0,
            }));
            return { id: String(p.id), name: p.name, values: vals };
          })
          .filter((e): e is CompareEntity => e !== null);

        const cats = catEntities[0]?.values.map((v) => v.category) ?? [];
        // third: stakeholder
        const catChildren = new Map<string, DrillDownData>(
          cats.map((cat) => [
            cat,
            {
              entities: portfolios
                .map((p) => {
                  const scopeRow = cs.get(String(p.id))?.social.find((c) => c.category === cat)?.by_scope.find((s) => s.scope === sc);
                  return scopeRow
                    ? { id: String(p.id), name: p.name, values: scopeRow.by_stakeholder.map((s) => ({ category: s.stakeholder, value: s.value })) }
                    : null;
                })
                .filter((e): e is CompareEntity => e !== null),
              mode: "stakeholder" as const,
            },
          ])
        );

        return [sc, { entities: catEntities, mode: "category" as const, children: catChildren }];
      })
    );

    return { entities: topEntities, drillDown };
  }

  // primary === "stakeholder"
  const topEntities = portfolios
    .map((p) => {
      const data = cs.get(String(p.id));
      if (!data) return null;
      const shMap = new Map<string, number>();
      for (const cat of data.social) {
        for (const sc of cat.by_scope) {
          for (const sh of sc.by_stakeholder) {
            shMap.set(sh.stakeholder, (shMap.get(sh.stakeholder) ?? 0) + sh.value);
          }
        }
      }
      return { id: String(p.id), name: p.name, values: [...shMap.entries()].map(([category, value]) => ({ category, value })).sort((a, b) => b.value - a.value) };
    })
    .filter((e): e is CompareEntity => e !== null);

  const stakeholders = Array.from(new Set(topEntities.flatMap((e) => e.values.map((v) => v.category))));
  const drillDown = new Map<string, DrillDownData>(
    stakeholders.map((sh) => {
      // second: category
      const catEntities = portfolios
        .map((p) => {
          const data = cs.get(String(p.id));
          if (!data) return null;
          const vals = data.social.map((cat) => ({
            category: cat.category,
            value: cat.by_scope.reduce((sum, sc) => sum + (sc.by_stakeholder.find((s) => s.stakeholder === sh)?.value ?? 0), 0),
          }));
          return { id: String(p.id), name: p.name, values: vals };
        })
        .filter((e): e is CompareEntity => e !== null);

      const cats = catEntities[0]?.values.map((v) => v.category) ?? [];
      const catChildren = new Map<string, DrillDownData>(
        cats.map((cat) => [
          cat,
          {
            entities: portfolios
              .map((p) => {
                const catData = cs.get(String(p.id))?.social.find((c) => c.category === cat);
                if (!catData) return null;
                const vals = catData.by_scope.map((sc) => ({
                  category: sc.scope,
                  value: sc.by_stakeholder.find((s) => s.stakeholder === sh)?.value ?? 0,
                }));
                return { id: String(p.id), name: p.name, values: vals };
              })
              .filter((e): e is CompareEntity => e !== null),
            mode: "scope" as const,
          },
        ])
      );

      return [sh, { entities: catEntities, mode: "category" as const, children: catChildren }];
    })
  );

  return { entities: topEntities, drillDown };
}

/** Portfolio bio: builds drill-down from the category×scope backend data. */
function buildPortfolioBioDrillDown(
  portfolios: PortfolioDetail[],
  cs: Map<string, CategoryScopeBreakdown>,
  primary: BioBreakdown
): { entities: CompareEntity[]; drillDown: Map<string, DrillDownData> } {
  if (primary === "category") {
    const topEntities = portfolios
      .map((p) => {
        const data = cs.get(String(p.id));
        return data
          ? { id: String(p.id), name: p.name, values: data.biodiversity.map((c) => ({ category: c.category, value: c.value })) }
          : null;
      })
      .filter((e): e is CompareEntity => e !== null);

    const cats = topEntities[0]?.values.map((v) => v.category) ?? [];
    const drillDown = new Map<string, DrillDownData>(
      cats.map((cat) => [
        cat,
        {
          entities: portfolios
            .map((p) => {
              const scoped = cs.get(String(p.id))?.biodiversity.find((c) => c.category === cat);
              return scoped
                ? { id: String(p.id), name: p.name, values: scoped.by_scope.map((s) => ({ category: s.scope, value: s.value })) }
                : null;
            })
            .filter((e): e is CompareEntity => e !== null),
          mode: "scope" as const,
        },
      ])
    );
    return { entities: topEntities, drillDown };
  }

  // primary === "scope"
  const topEntities = portfolios
    .map((p) => {
      const data = cs.get(String(p.id));
      if (!data) return null;
      const scopeMap = new Map<string, number>();
      for (const cat of data.biodiversity) {
        for (const sc of cat.by_scope) {
          scopeMap.set(sc.scope, (scopeMap.get(sc.scope) ?? 0) + sc.value);
        }
      }
      return { id: String(p.id), name: p.name, values: [...scopeMap.entries()].map(([category, value]) => ({ category, value })) };
    })
    .filter((e): e is CompareEntity => e !== null);

  const scopes = Array.from(new Set(topEntities.flatMap((e) => e.values.map((v) => v.category))));
  const drillDown = new Map<string, DrillDownData>(
    scopes.map((sc) => [
      sc,
      {
        entities: portfolios
          .map((p) => {
            const data = cs.get(String(p.id));
            if (!data) return null;
            const vals = data.biodiversity.map((cat) => ({
              category: cat.category,
              value: cat.by_scope.find((s) => s.scope === sc)?.value ?? 0,
            }));
            return { id: String(p.id), name: p.name, values: vals };
          })
          .filter((e): e is CompareEntity => e !== null),
        mode: "category" as const,
      },
    ])
  );
  return { entities: topEntities, drillDown };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Compare() {
  const [searchParams, setSearchParams] = useSearchParams();
  const mode: Mode = searchParams.get("type") === "company" ? "company" : "portfolio";
  const selectedIds = (searchParams.get("ids") || "").split(",").filter(Boolean);

  const [pickerItems, setPickerItems] = useState<EntityPickerItem[]>([]);
  const [pickerError, setPickerError] = useState<string | null>(null);

  const [portfolios, setPortfolios] = useState<PortfolioDetail[]>([]);
  const [portCategoryScopes, setPortCategoryScopes] = useState<Map<string, CategoryScopeBreakdown>>(new Map());
  const [companies, setCompanies] = useState<CompanyDetail[]>([]);
  const [scores, setScores] = useState<ScoreOut[]>([]);
  const [compareError, setCompareError] = useState<string | null>(null);

  const [socialBreakdown, setSocialBreakdown] = useState<SocialBreakdown>("category");
  const [bioBreakdown, setBioBreakdown] = useState<BioBreakdown>("category");

  useEffect(() => {
    setPickerError(null);
    if (mode === "portfolio") {
      api
        .listPortfolios()
        .then((page) =>
          setPickerItems(page.items.map((p) => ({ id: String(p.id), label: p.name, meta: `${p.n_companies} companies` })))
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
    setCompanies([]);
    setScores([]);
    setSocialBreakdown("category");
    setBioBreakdown("category");
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
    } else {
      Promise.all(selectedIds.map((ticker) => api.getCompany(ticker)))
        .then(setCompanies)
        .catch(() => setCompareError("Failed to load comparison"));
      api
        .getScores("company")
        .then((page) => setScores(page.items.filter((s) => selectedIds.includes(s.entity_id))))
        .catch(() => setCompareError("Failed to load scores"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedIds.join(",")]);

  const setMode = (newMode: Mode) => setSearchParams(newMode === "portfolio" ? {} : { type: "company" });

  const toggleSelected = (id: string) => {
    const next = selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id];
    const params: Record<string, string> = { ids: next.join(",") };
    if (mode === "company") params.type = "company";
    setSearchParams(params);
  };

  const socialData = useMemo(() => {
    if (mode === "portfolio" && portfolios.length > 0 && portCategoryScopes.size > 0)
      return buildPortfolioSocialDrillDown(portfolios, portCategoryScopes, socialBreakdown);
    if (mode === "company" && companies.length > 0)
      return buildCompanySocialDrillDown(companies, socialBreakdown);
    return null;
  }, [mode, portfolios, portCategoryScopes, companies, socialBreakdown]);

  const bioData = useMemo(() => {
    if (mode === "portfolio" && portfolios.length > 0 && portCategoryScopes.size > 0)
      return buildPortfolioBioDrillDown(portfolios, portCategoryScopes, bioBreakdown);
    if (mode === "company" && companies.length > 0)
      return buildCompanyBioDrillDown(companies, bioBreakdown);
    return null;
  }, [mode, portfolios, portCategoryScopes, companies, bioBreakdown]);

  const hasData = mode === "portfolio" ? portfolios.length > 0 : companies.length > 0;

  return (
    <div className="content--narrow">
      <h1 className="page-title">Compare</h1>
      <p className="page-sub">Select two or more portfolios or companies to compare their impact profiles.</p>

      <div className="toggle-row" style={{ marginBottom: 16 }}>
        <button className={`toggle-btn${mode === "portfolio" ? " is-active" : ""}`} onClick={() => setMode("portfolio")}>
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

      {hasData && (
        <>
          {/* Overview */}
          <section style={{ marginTop: 16 }}>
            <h2>Overview</h2>
            <div className="card-grid">
              {mode === "portfolio"
                ? portfolios.map((p) => {
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
                  })
                : companies.map((c) => {
                    const score = scores.find((s) => s.entity_id === c.ticker);
                    return (
                      <div key={c.ticker} className="card">
                        <div className="portfolio-card__name" style={{ marginBottom: 4 }}>{c.company_name}</div>
                        <div className="portfolio-card__meta" style={{ marginBottom: 10 }}>
                          {c.ticker} &middot; {c.market_cap_usd_m !== null ? `$${formatAmount(c.market_cap_usd_m)}M` : "-"}
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

          {/* Social impact */}
          {socialData && socialData.entities.length > 0 && (
            <section>
              <div className="breakdown-header">
                <h2 className="tone-social" style={{ margin: 0 }}>Social impact &middot; WELLBY</h2>
                <label className="breakdown-select">
                  Breakdown by
                  <select value={socialBreakdown} onChange={(e) => setSocialBreakdown(e.target.value as SocialBreakdown)}>
                    <option value="category">Category</option>
                    <option value="scope">Scope</option>
                    <option value="stakeholder">Stakeholder</option>
                  </select>
                </label>
              </div>
              <div className="card" style={{ marginTop: 10 }}>
                <CompareBarList
                  entities={socialData.entities}
                  tone="social"
                  mode={socialBreakdown}
                  drillDown={socialData.drillDown}
                />
              </div>
            </section>
          )}

          {/* Biodiversity impact */}
          {bioData && bioData.entities.length > 0 && (
            <section>
              <div className="breakdown-header">
                <h2 className="tone-bio" style={{ margin: 0 }}>Biodiversity impact &middot; PDF&middot;yr</h2>
                <label className="breakdown-select">
                  Breakdown by
                  <select value={bioBreakdown} onChange={(e) => setBioBreakdown(e.target.value as BioBreakdown)}>
                    <option value="category">Category</option>
                    <option value="scope">Scope</option>
                  </select>
                </label>
              </div>
              <div className="card" style={{ marginTop: 10 }}>
                <CompareBarList
                  entities={bioData.entities}
                  tone="bio"
                  mode={bioBreakdown}
                  drillDown={bioData.drillDown}
                />
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
