import type { GridCell } from "./types";

/** Sums the non-null cell values in an impact grid (ignores "no data" cells). */
export function sumGridValue(cells: GridCell[]): number {
  return cells.reduce((total, cell) => total + (cell.value ?? 0), 0);
}
