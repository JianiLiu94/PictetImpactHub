import { Fragment } from "react";
import type { GridCell } from "../types";
import { humanizeLabel, scopeLabel } from "../format";
import "./ImpactGrid.css";

type KeyField = "scope" | "category" | "stakeholder";

interface ImpactGridProps {
  cells: GridCell[];
  rowKeyField: "scope" | "category";
  colKeyField: "scope" | "category" | "stakeholder";
  tone?: "social" | "bio";
}

const SUM_KEY = "__sum__";
const MAX_KEY = "__max__";
const AGG_KEYS = [SUM_KEY, MAX_KEY];

const TONE_COLORS: Record<"social" | "bio", { soft: string; mid: string; full: string }> = {
  social: { soft: "#f0e3e8", mid: "#d08ca4", full: "#a8456b" },
  bio: { soft: "#c3ded4", mid: "#5e9c85", full: "#1c6b4f" },
};

function hexToRgb(hex: string): [number, number, number] {
  const v = hex.replace("#", "");
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const bb = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r}, ${g}, ${bb})`;
}

function cellClass(value: number | null): string {
  if (value === null) return "impact-grid__cell--no-data";
  if (value > 0) return "impact-grid__cell--positive";
  if (value < 0) return "impact-grid__cell--negative";
  return "impact-grid__cell--zero";
}

function cellLabel(value: number | null): string {
  if (value === null) return "n/a";
  return value.toExponential(2);
}

function headLabel(key: string, field: KeyField): string {
  if (key === SUM_KEY) return "Sum";
  if (key === MAX_KEY) return "Max";
  return field === "scope" ? scopeLabel(key) : humanizeLabel(key);
}

const keyOf = (v: string | null): string => v ?? "unassigned";

function sumOf(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0);
}

function maxOf(values: number[]): number | null {
  return values.length === 0 ? null : Math.max(...values);
}

export function ImpactGrid({ cells, rowKeyField, colKeyField, tone }: ImpactGridProps) {
  if (cells.length === 0) {
    return <div>No data available</div>;
  }

  const rowKeys = Array.from(new Set(cells.map((c) => keyOf(c[rowKeyField]))));
  const colKeys = Array.from(new Set(cells.map((c) => keyOf(c[colKeyField]))));

  const lookup = new Map<string, number | null>();
  for (const cell of cells) {
    lookup.set(`${keyOf(cell[rowKeyField])}|${keyOf(cell[colKeyField])}`, cell.value);
  }

  const rowValues = (row: string): number[] =>
    colKeys.map((col) => lookup.get(`${row}|${col}`) ?? null).filter((v): v is number => v !== null);
  const colValues = (col: string): number[] =>
    rowKeys.map((row) => lookup.get(`${row}|${col}`) ?? null).filter((v): v is number => v !== null);
  const allValues = rowKeys.flatMap((row) => rowValues(row));

  const getValue = (row: string, col: string): number | null => {
    const rowIsAgg = AGG_KEYS.includes(row);
    const colIsAgg = AGG_KEYS.includes(col);

    if (!rowIsAgg && !colIsAgg) return lookup.get(`${row}|${col}`) ?? null;
    if (!rowIsAgg && col === SUM_KEY) return sumOf(rowValues(row));
    if (!rowIsAgg && col === MAX_KEY) return maxOf(rowValues(row));
    if (row === SUM_KEY && !colIsAgg) return sumOf(colValues(col));
    if (row === MAX_KEY && !colIsAgg) return maxOf(colValues(col));
    if (row === SUM_KEY && col === SUM_KEY) return sumOf(allValues);
    if (row === MAX_KEY && col === MAX_KEY) return maxOf(allValues);
    return null;
  };

  const allRowKeys = [...rowKeys, ...AGG_KEYS];
  const allColKeys = [...colKeys, ...AGG_KEYS];

  const maxAbs = Math.max(0, ...allValues.map((v) => Math.abs(v)));
  const colors = tone ? TONE_COLORS[tone] : null;

  const heatStyle = (value: number | null): React.CSSProperties | undefined => {
    if (!colors || value === null || maxAbs === 0) return undefined;
    const intensity = Math.min(1, Math.abs(value) / maxAbs);
    const background = intensity < 0.5 ? mix(colors.soft, colors.mid, intensity * 2) : mix(colors.mid, colors.full, (intensity - 0.5) * 2);
    const color = intensity > 0.6 ? "#fff" : undefined;
    return { background, color };
  };

  return (
    <div className="impact-grid-scroll">
      <div
        className="impact-grid"
        style={{ gridTemplateColumns: `68px repeat(${allColKeys.length}, minmax(46px, 1fr))` }}
      >
      <div />
      {allColKeys.map((col) => (
        <div
          key={col}
          className={`impact-grid__cell impact-grid__cell--head${AGG_KEYS.includes(col) ? " impact-grid__cell--agg-sep" : ""}`}
          title={headLabel(col, colKeyField)}
        >
          {headLabel(col, colKeyField)}
        </div>
      ))}
      {allRowKeys.map((row) => (
        <Fragment key={row}>
          <div
            key={`${row}-label`}
            className={`impact-grid__cell impact-grid__cell--head${AGG_KEYS.includes(row) ? " impact-grid__cell--agg-sep" : ""}`}
          >
            {headLabel(row, rowKeyField)}
          </div>
          {allColKeys.map((col) => {
            const value = getValue(row, col);
            const isAgg = AGG_KEYS.includes(row) || AGG_KEYS.includes(col);
            const sepClasses = [
              AGG_KEYS.includes(col) ? "impact-grid__cell--agg-sep" : "",
              AGG_KEYS.includes(row) ? "impact-grid__cell--agg-sep-top" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <div
                key={`${row}-${col}`}
                data-testid={`cell-${row}-${col}`}
                className={`impact-grid__cell ${cellClass(value)} ${sepClasses}${isAgg ? " impact-grid__cell--agg" : ""}`}
                style={heatStyle(value)}
                title={cellLabel(value)}
              >
                {cellLabel(value)}
              </div>
            );
          })}
        </Fragment>
      ))}
      </div>
    </div>
  );
}
