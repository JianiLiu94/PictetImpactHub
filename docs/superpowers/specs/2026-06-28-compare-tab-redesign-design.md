# Compare tab redesign — design

## Overview

Comparison currently only works for portfolios, and only via checkboxes on
the Portfolios page that navigate to `/compare?ids=...`. There is no way to
compare individual companies. This redesign makes the Compare tab a
self-contained entry point that supports comparing either 2+ portfolios or
2+ companies (one type at a time — no mixing), with its own search/select
picker, replacing the checkbox-on-Portfolios-page flow entirely.

## URL structure & routing

State lives in the URL so a comparison is shareable/bookmarkable:

```
/compare?type=portfolio&ids=1,2        (type omitted defaults to portfolio)
/compare?type=company&ids=AAPL,MSFT
```

- `PortfolioSelector.tsx` loses its checkboxes, `selected` state, and
  "Compare selected" button — it goes back to being a plain browse/link list.
- `App.tsx` consolidates comparison routing to a single `/compare` route,
  dropping the old `/portfolios/compare` alias. `/compare` renders a new
  `Compare.tsx` page that replaces `PortfolioCompare.tsx`.

## Picker UI

A mode toggle ("Portfolios" / "Companies") sits at the top of `/compare`.
Switching it resets the current selection and clears any in-flight
comparison data (portfolio ids and company tickers aren't comparable, so
there's nothing sensible to carry across a mode switch).

Below the toggle, a new shared `EntityPicker` component renders a search
input plus a scrollable checklist with one checkbox per row. It's generic
over `{id, label, meta}` items, so it works for both the portfolio list (3
items, search is harmless but not essential) and the company list (~288
items, where search is essential to be usable). Selecting 2+ items renders
the comparison panel below, on the same page — no navigation required.

## Comparison content

Both modes use the same compact-card-plus-score-toggle layout already
established for portfolios:

- **Portfolio mode** — unchanged from the current implementation:
  `GET /portfolios/compare?ids=...` supplies the cards (name, n_companies,
  total market value, weighted social/biodiversity totals);
  `GET /scores?entity_type=portfolio` supplies the `ScoreToggle` data below,
  filtered client-side to the selected ids.
- **Company mode** — no new backend endpoint. For each selected ticker,
  fetch `GET /companies/:ticker` (already returns market cap, revenue, and
  the full `social_grid`/`biodiversity_grid`). A new pure utility,
  `sumGridValue(cells: GridCell[]): number`, sums the non-null cell values
  to produce the same kind of absolute social/biodiversity totals shown on
  portfolio cards — mirroring what the backend already does for portfolios,
  just computed client-side since per-company absolute totals aren't
  currently exposed as a dedicated field. `GET /scores?entity_type=company`
  filtered client-side to the selected tickers supplies the `ScoreToggle`.

## Components

- **`EntityPicker.tsx`** (new, shared, presentational only — no data
  fetching) — props: `items: {id: string, label: string, meta?: string}[]`,
  `selected: string[]`, `onToggle(id: string): void`. Renders a search input
  that filters `items` by `label` (case-insensitive substring match) and a
  checklist reflecting `selected`.
- **`Compare.tsx`** (new, replaces `PortfolioCompare.tsx`) — reads
  `type`/`ids` from `useSearchParams`; owns the mode toggle and selection
  state, writing changes back to the URL; loads the picker's item list
  (`api.listPortfolios()` or `api.listCompanies(500)`) based on the active
  mode; once 2+ items are selected, fetches the comparison data for that
  mode and renders the cards + `ScoreToggle`.
- **`gridTotals.ts`** (new util) — houses `sumGridValue`. Pure function,
  unit-testable independent of any component.
- **`PortfolioSelector.tsx`** (modified) — remove checkbox/selection/compare
  button; keep the existing list/links to portfolio detail pages.
- **`App.tsx`** (modified) — remove the `/portfolios/compare` route; keep
  `/compare` pointing at the new `Compare.tsx`.

## Error handling & loading states

Each async fetch (picker item list, comparison data, scores) sets its own
error string on failure rather than blanking the whole page, consistent with
the rest of the app. Fewer than 2 items selected shows a plain hint ("Select
at least two to compare") rather than an error state.

## Testing

Matches the project's existing frontend test depth (light unit tests on
shared components/utilities, not exhaustive page-level coverage):

- `EntityPicker`: search narrows the visible list; clicking a checkbox calls
  `onToggle` with the corresponding id.
- `gridTotals.sumGridValue`: sums non-null values, ignores nulls, returns 0
  for an empty/all-null grid.

No backend changes are required, so no new backend tests.
