import { Fragment } from "react";
import type { GridCell } from "../types";
import "./ImpactGrid.css";

interface ImpactGridProps {
  cells: GridCell[];
  rowKeyField: "scope" | "category";
  colKeyField: "scope" | "category" | "stakeholder";
}

function cellClass(value: number | null): string {
  if (value === null) return "impact-grid__cell--no-data";
  if (value > 0) return "impact-grid__cell--positive";
  if (value < 0) return "impact-grid__cell--negative";
  return "impact-grid__cell--zero";
}

function cellLabel(value: number | null): string {
  if (value === null) return "no data";
  return value.toExponential(2);
}

export function ImpactGrid({ cells, rowKeyField, colKeyField }: ImpactGridProps) {
  const rowKeys = Array.from(new Set(cells.map((c) => c[rowKeyField] as string)));
  const colKeys = Array.from(new Set(cells.map((c) => c[colKeyField] as string)));

  const lookup = new Map<string, number | null>();
  for (const cell of cells) {
    lookup.set(`${cell[rowKeyField]}|${cell[colKeyField]}`, cell.value);
  }

  return (
    <div
      className="impact-grid"
      style={{ gridTemplateColumns: `120px repeat(${colKeys.length}, 1fr)` }}
    >
      <div />
      {colKeys.map((col) => (
        <div key={col} className="impact-grid__cell">
          {col}
        </div>
      ))}
      {rowKeys.map((row) => (
        <Fragment key={row}>
          <div key={`${row}-label`} className="impact-grid__cell">
            {row}
          </div>
          {colKeys.map((col) => {
            const value = lookup.get(`${row}|${col}`) ?? null;
            return (
              <div key={`${row}-${col}`} className={`impact-grid__cell ${cellClass(value)}`}>
                {cellLabel(value)}
              </div>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}
