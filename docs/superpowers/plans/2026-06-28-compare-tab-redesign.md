# Compare Tab Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Compare tab a self-contained entry point that supports comparing either 2+ portfolios or 2+ companies (one type at a time), with its own search/select picker — replacing the current checkbox-on-Portfolios-page flow, which only supported portfolios.

**Architecture:** Frontend-only change. A new generic `Compare.tsx` page reads `type`/`ids` from the URL query string, drives a new shared `EntityPicker` component (search + checklist) to build a selection, then fetches and renders comparison data for whichever mode is active — reusing the existing `/portfolios/compare` and `/companies/:ticker` endpoints (no backend changes). A new pure utility, `sumGridValue`, derives company-level absolute totals client-side from the grids `/companies/:ticker` already returns, mirroring what the backend computes for portfolios.

**Tech Stack:** React, TypeScript, react-router-dom (`useSearchParams`), Vitest + Testing Library.

## Global Constraints

- No backend changes — this plan is frontend-only.
- One entity type per comparison (portfolios OR companies, never mixed).
- State lives in the URL (`/compare?type=...&ids=...`) so a comparison is shareable/bookmarkable.
- Switching the mode toggle resets the current selection and clears any in-flight comparison data.
- Match the project's existing frontend test depth: light unit tests on shared components/utilities, no exhaustive page-level test suite.

**Reference spec:** `docs/superpowers/specs/2026-06-28-compare-tab-redesign-design.md`

---

## File Structure

```
frontend/src/
  gridTotals.ts                    # new: sumGridValue pure utility
  gridTotals.test.ts                # new
  components/
    EntityPicker.tsx                 # new: search + checklist picker
    EntityPicker.test.tsx            # new
  pages/
    Compare.tsx                      # new: replaces PortfolioCompare.tsx
    PortfolioCompare.tsx             # deleted
    PortfolioSelector.tsx            # modified: remove checkbox/compare button
  App.tsx                            # modified: route Compare.tsx at /compare, drop /portfolios/compare
  index.css                          # modified: remove now-dead .compare-bar rule
```

---

### Task 1: `sumGridValue` utility

**Files:**
- Create: `frontend/src/gridTotals.ts`
- Test: `frontend/src/gridTotals.test.ts`

**Interfaces:**
- Produces: `sumGridValue(cells: GridCell[]): number` — used by Task 3 (`Compare.tsx`) to derive a company's absolute social/biodiversity totals from `CompanyDetail.social_grid`/`biodiversity_grid`. `GridCell` is the existing type in `frontend/src/types.ts` (`{ scope: string; category: string; stakeholder: string | null; value: number | null }`).

- [ ] **Step 1: Write the failing test in `frontend/src/gridTotals.test.ts`**

```typescript
import { describe, expect, it } from "vitest";
import { sumGridValue } from "./gridTotals";

describe("sumGridValue", () => {
  it("sums non-null cell values", () => {
    const cells = [
      { scope: "upstream", category: "health", stakeholder: null, value: 2 },
      { scope: "downstream", category: "health", stakeholder: null, value: -1.5 },
    ];
    expect(sumGridValue(cells)).toBe(0.5);
  });

  it("ignores null cells", () => {
    const cells = [
      { scope: "upstream", category: "health", stakeholder: null, value: null },
      { scope: "downstream", category: "health", stakeholder: null, value: 3 },
    ];
    expect(sumGridValue(cells)).toBe(3);
  });

  it("returns 0 for an empty grid", () => {
    expect(sumGridValue([])).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && npx vitest run gridTotals`
Expected: FAIL — `Cannot find module './gridTotals'`

- [ ] **Step 3: Implement `frontend/src/gridTotals.ts`**

```typescript
import type { GridCell } from "./types";

/** Sums the non-null cell values in an impact grid (ignores "no data" cells). */
export function sumGridValue(cells: GridCell[]): number {
  return cells.reduce((total, cell) => total + (cell.value ?? 0), 0);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd frontend && npx vitest run gridTotals`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add frontend/src/gridTotals.ts frontend/src/gridTotals.test.ts
git commit -m "feat: add sumGridValue utility for client-side company impact totals"
```

---

### Task 2: `EntityPicker` component

**Files:**
- Create: `frontend/src/components/EntityPicker.tsx`
- Test: `frontend/src/components/EntityPicker.test.tsx`
- Modify: `frontend/src/index.css` (append picker styles)

**Interfaces:**
- Produces: `EntityPickerItem` type (`{ id: string; label: string; meta?: string }`) and `EntityPicker` component with props `{ items: EntityPickerItem[]; selected: string[]; onToggle: (id: string) => void }`. Used by Task 3 (`Compare.tsx`), which supplies `items` already loaded (no data fetching inside `EntityPicker` itself) and owns `selected`/`onToggle`.
- Consumes: nothing from other tasks — pure presentational component, no API calls.

- [ ] **Step 1: Write the failing test in `frontend/src/components/EntityPicker.test.tsx`**

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EntityPicker } from "./EntityPicker";

const items = [
  { id: "1", label: "Cleaner Planet", meta: "91 companies" },
  { id: "2", label: "AI & Automation", meta: "90 companies" },
];

describe("EntityPicker", () => {
  it("renders all items when the search query is empty", () => {
    render(<EntityPicker items={items} selected={[]} onToggle={() => {}} />);
    expect(screen.getByText("Cleaner Planet")).toBeInTheDocument();
    expect(screen.getByText("AI & Automation")).toBeInTheDocument();
  });

  it("filters items by label, case-insensitively", () => {
    render(<EntityPicker items={items} selected={[]} onToggle={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText("Search..."), { target: { value: "cleaner" } });
    expect(screen.getByText("Cleaner Planet")).toBeInTheDocument();
    expect(screen.queryByText("AI & Automation")).not.toBeInTheDocument();
  });

  it("shows a 'No matches' message when the filter excludes everything", () => {
    render(<EntityPicker items={items} selected={[]} onToggle={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText("Search..."), { target: { value: "zzz" } });
    expect(screen.getByText("No matches")).toBeInTheDocument();
  });

  it("reflects selection state and calls onToggle with the right id", () => {
    const onToggle = vi.fn();
    render(<EntityPicker items={items} selected={["1"]} onToggle={onToggle} />);

    const checkboxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    expect(checkboxes[0].checked).toBe(true);
    expect(checkboxes[1].checked).toBe(false);

    fireEvent.click(checkboxes[1]);
    expect(onToggle).toHaveBeenCalledWith("2");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && npx vitest run EntityPicker`
Expected: FAIL — `Cannot find module './EntityPicker'`

- [ ] **Step 3: Implement `frontend/src/components/EntityPicker.tsx`**

```tsx
import { useState } from "react";

export interface EntityPickerItem {
  id: string;
  label: string;
  meta?: string;
}

interface EntityPickerProps {
  items: EntityPickerItem[];
  selected: string[];
  onToggle: (id: string) => void;
}

export function EntityPicker({ items, selected, onToggle }: EntityPickerProps) {
  const [query, setQuery] = useState("");

  const filtered = items.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="entity-picker">
      <input
        type="text"
        className="entity-picker__search"
        placeholder="Search..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="entity-picker__list">
        {filtered.map((item) => (
          <label key={item.id} className="entity-picker__row">
            <input type="checkbox" checked={selected.includes(item.id)} onChange={() => onToggle(item.id)} />
            <span className="entity-picker__label">{item.label}</span>
            {item.meta && <span className="entity-picker__meta muted">{item.meta}</span>}
          </label>
        ))}
        {filtered.length === 0 && <div className="muted entity-picker__empty">No matches</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Append picker styles to `frontend/src/index.css`**

```css
.entity-picker {
  margin-bottom: 20px;
}

.entity-picker__search {
  width: 100%;
  margin-bottom: 8px;
  padding: 7px 10px;
  font-size: 12.5px;
  border: 0.5px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--ink);
}

.entity-picker__list {
  max-height: 260px;
  overflow-y: auto;
  border: 0.5px solid var(--line);
  border-radius: var(--radius);
}

.entity-picker__row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  font-size: 12.5px;
  border-bottom: 0.5px solid var(--line-soft);
  cursor: pointer;
}

.entity-picker__row:last-child {
  border-bottom: none;
}

.entity-picker__meta {
  margin-left: auto;
  font-size: 11px;
}

.entity-picker__empty {
  padding: 10px;
  font-size: 12px;
}
```

- [ ] **Step 5: Run to verify pass**

Run: `cd frontend && npx vitest run EntityPicker`
Expected: 4 passed

- [ ] **Step 6: Run `tsc` to confirm no type errors**

Run: `cd frontend && npx tsc --noEmit`
Expected: no output

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/EntityPicker.tsx frontend/src/components/EntityPicker.test.tsx frontend/src/index.css
git commit -m "feat: add EntityPicker component for searchable multi-select"
```

---

### Task 3: `Compare.tsx` page, wired into routing

**Files:**
- Create: `frontend/src/pages/Compare.tsx`
- Delete: `frontend/src/pages/PortfolioCompare.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `EntityPicker`/`EntityPickerItem` from Task 2 (`frontend/src/components/EntityPicker.tsx`), `sumGridValue` from Task 1 (`frontend/src/gridTotals.ts`), and existing `api` client methods: `api.listPortfolios()`, `api.listCompanies(limit)`, `api.comparePortfolios(ids: number[])`, `api.getCompany(ticker: string)`, `api.getScores(entityType)` (all in `frontend/src/api/client.ts`, unchanged), plus existing types `PortfolioDetail`, `CompanyDetail`, `ScoreOut` (in `frontend/src/types.ts`, unchanged). Also consumes the existing `ScoreToggle` component (`frontend/src/components/ScoreToggle.tsx`, prop `scores: ScoreOut[]`, unchanged).
- Produces: default-exported `Compare` page component, routed at `/compare` in `App.tsx`.

This task has no new automated tests (per the project's existing page-level testing depth — pages aren't unit tested, only shared components/utilities are, which Tasks 1 and 2 already covered). Verification is `tsc` plus a manual check against the live backend.

- [ ] **Step 1: Create `frontend/src/pages/Compare.tsx`**

```tsx
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
```

- [ ] **Step 2: Delete `frontend/src/pages/PortfolioCompare.tsx`**

Run: `rm frontend/src/pages/PortfolioCompare.tsx`

- [ ] **Step 3: Modify `frontend/src/App.tsx`** — swap the import and route, drop the `/portfolios/compare` alias

Replace:
```tsx
import { PortfolioCompare } from "./pages/PortfolioCompare";
```
with:
```tsx
import { Compare } from "./pages/Compare";
```

Replace:
```tsx
            <Route path="/compare" element={<PortfolioCompare />} />
            <Route path="/portfolios/compare" element={<PortfolioCompare />} />
```
with:
```tsx
            <Route path="/compare" element={<Compare />} />
```

- [ ] **Step 4: Run `tsc` to confirm no type errors**

Run: `cd frontend && npx tsc --noEmit`
Expected: no output

- [ ] **Step 5: Run the full frontend test suite to confirm no regressions**

Run: `cd frontend && npx vitest run`
Expected: all existing tests still pass (no test referenced `PortfolioCompare.tsx`, so none should break)

- [ ] **Step 6: Manual check against the live backend**

Start Postgres and the backend if not already running:
```bash
brew services start postgresql@16
cd backend && DATABASE_URL=postgresql://impact:impact@localhost:5432/impact .venv/bin/uvicorn app.main:app --port 8000 &
```
Start the frontend:
```bash
cd frontend && npm run dev &
```
Open `http://localhost:5173/compare` in a browser (or verify via the dev server log showing no runtime errors, and `curl http://localhost:8000/portfolios` returning data). Confirm:
- Portfolios mode is the default; the picker lists the 3 seeded portfolios; selecting 2 renders comparison cards + composite score toggle.
- Clicking "Companies" resets the selection, switches the picker to the company list, and search narrows it (type part of any company name visible in the list, e.g. a few letters from one of the rows, and confirm the list shrinks to matches).
- Selecting 2+ companies renders cards with social/biodiversity totals and a composite score toggle.
- The URL reflects `?type=company&ids=...` while in company mode, and just `?ids=...` while in portfolio mode.

Kill both background processes when done (`kill %1 %2` or find the PIDs via `lsof -ti:8000,5173`).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/Compare.tsx frontend/src/App.tsx
git rm frontend/src/pages/PortfolioCompare.tsx
git commit -m "feat: add unified Compare page supporting portfolios or companies"
```

---

### Task 4: Simplify `PortfolioSelector.tsx`

**Files:**
- Modify: `frontend/src/pages/PortfolioSelector.tsx`
- Modify: `frontend/src/index.css` (remove the now-dead `.compare-bar` rule)

**Interfaces:**
- Consumes: nothing new — uses the existing `api.listPortfolios()` and `PortfolioSummary` type, unchanged.
- Produces: nothing consumed by other tasks — this is the last task.

- [ ] **Step 1: Replace `frontend/src/pages/PortfolioSelector.tsx`** with the checkbox/compare-button removed

```tsx
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
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .listPortfolios()
      .then((page) => setPortfolios(page.items))
      .catch(() => setError("Failed to load portfolios"));
  }, []);

  if (error) return <div className="error-text">{error}</div>;

  return (
    <div>
      <h1 className="page-title">Portfolios</h1>
      <p className="page-sub">Browse portfolios, or head to Compare to compare two or more.</p>

      <div className="card-grid">
        {portfolios.map((p) => {
          const theme = themeIcon(p.name);
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Remove the now-dead `.compare-bar` rule from `frontend/src/index.css`**

Delete this block:
```css
.compare-bar {
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}
```

- [ ] **Step 3: Run `tsc` to confirm no type errors**

Run: `cd frontend && npx tsc --noEmit`
Expected: no output

- [ ] **Step 4: Run the full frontend test suite to confirm no regressions**

Run: `cd frontend && npx vitest run`
Expected: all tests still pass

- [ ] **Step 5: Manual check**

With the backend and frontend dev server running (see Task 3 Step 6), open `http://localhost:5173/` and confirm:
- Portfolio cards render with no checkboxes and no "Compare selected" button.
- Clicking a portfolio card still navigates to its detail page.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/PortfolioSelector.tsx frontend/src/index.css
git commit -m "refactor: remove checkbox-based compare entry point from Portfolios page"
```
