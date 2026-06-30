import { useState } from "react";
import { humanizeLabel, scopeLabel } from "../format";
import { categoryIcon } from "../categoryIcons";
import type { CategoryValue } from "../types";

/** One entity's data for the comparison. */
export interface CompareEntity {
  id: string;
  name: string;
  values: CategoryValue[];
}

interface CompareBarListProps {
  entities: CompareEntity[];
  tone: "social" | "bio";
  mode?: "category" | "scope";
  /** Pre-computed drill-down data per category: key=category, value=CompareEntity[] with scope-level values. */
  drillDown?: Map<string, CompareEntity[]>;
  /** Internal: disables legend and drill-down so nested lists don't recurse further. */
  _nested?: boolean;
}

const ENTITY_COLORS = ["#2563eb", "#e07b39", "#7c3aed", "#059669"];

/**
 * Renders every category/scope as an aligned group of horizontal bars,
 * one bar per entity, all sharing the same absolute scale so intensities
 * are directly comparable across entities.
 *
 * The zero line is placed proportionally based on the actual data range:
 * - all-positive → bars grow from left (no zero line shown)
 * - all-negative → bars grow from right
 * - mixed        → zero line positioned at abs(min) / (abs(min) + max)
 */
export function CompareBarList({
  entities,
  tone,
  mode = "category",
  drillDown,
  _nested = false,
}: CompareBarListProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (entities.length === 0) return null;

  const categories = entities[0].values.map((v) => v.category);

  const lookup = new Map<string, Map<string, number>>();
  for (const e of entities) {
    const m = new Map<string, number>();
    for (const v of e.values) m.set(v.category, v.value);
    lookup.set(e.id, m);
  }

  // Compute global range across ALL entities and ALL categories.
  const allValues = entities.flatMap((e) => e.values.map((v) => v.value));
  const globalPosMax = Math.max(0, ...allValues.filter((v) => v > 0));
  const globalNegMin = Math.min(0, ...allValues.filter((v) => v < 0)); // most negative (≤ 0)
  const hasBoth = globalPosMax > 0 && globalNegMin < 0;
  const hasOnlyNeg = globalPosMax === 0 && globalNegMin < 0;
  const totalRange = globalPosMax + Math.abs(globalNegMin) || 1e-12;
  // Zero line position as % from left (0 = left edge, 100 = right edge)
  const zeroPos = globalNegMin < 0 ? (Math.abs(globalNegMin) / totalRange) * 100 : 0;

  const fillStyle = (value: number): React.CSSProperties => {
    if (hasOnlyNeg) {
      // All negative: bars grow leftward from right edge
      const w = Math.abs(globalNegMin) > 0 ? (Math.abs(value) / Math.abs(globalNegMin)) * 100 : 0;
      return { right: 0, width: `${Math.min(100, w)}%` };
    }
    if (!hasBoth) {
      // All positive (or zero): bars grow from left
      const w = globalPosMax > 0 ? (value / globalPosMax) * 100 : 0;
      return { left: 0, width: `${Math.min(100, w)}%` };
    }
    // Mixed: proportional zero line
    if (value >= 0) {
      const w = globalPosMax > 0 ? (value / globalPosMax) * (100 - zeroPos) : 0;
      return { left: `${zeroPos}%`, width: `${Math.min(100 - zeroPos, w)}%` };
    } else {
      const w = Math.abs(globalNegMin) > 0 ? (Math.abs(value) / Math.abs(globalNegMin)) * zeroPos : 0;
      return { left: `${Math.max(0, zeroPos - w)}%`, width: `${Math.min(zeroPos, w)}%` };
    }
  };

  const label = (cat: string) =>
    mode === "scope" ? scopeLabel(cat) : humanizeLabel(cat);

  const toggleExpand = (cat: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  return (
    <div className="compare-bar-list">
      {/* Legend — only on top-level list */}
      {!_nested && (
        <div className="compare-bar-list__legend">
          {entities.map((e, i) => (
            <span key={e.id} className="compare-bar-list__legend-item">
              <span
                className="compare-bar-list__legend-dot"
                style={{ background: ENTITY_COLORS[i % ENTITY_COLORS.length] }}
              />
              {e.name}
            </span>
          ))}
        </div>
      )}

      {categories.map((cat) => {
        const drillEntities = drillDown?.get(cat);
        const isExpandable = !_nested && !!drillEntities && drillEntities.length > 0;
        const isOpen = expanded.has(cat);

        return (
          <div key={cat} className="compare-bar-list__group">
            <div
              className={`compare-bar-list__cat-label${isExpandable ? " compare-bar-list__cat-label--clickable" : ""}`}
              onClick={isExpandable ? () => toggleExpand(cat) : undefined}
              title={isExpandable ? (isOpen ? "Collapse scope breakdown" : "Expand scope breakdown") : undefined}
            >
              {mode === "category" && categoryIcon(cat)}
              {label(cat)}
              {isExpandable && (
                <span className="compare-bar-list__expand-icon">{isOpen ? "▾" : "▸"}</span>
              )}
            </div>

            {entities.map((e, i) => {
              const value = lookup.get(e.id)?.get(cat) ?? 0;
              const color = ENTITY_COLORS[i % ENTITY_COLORS.length];
              return (
                <div key={e.id} className="compare-bar-list__row">
                  <div className="compare-bar-list__name">{e.name}</div>
                  <div className="compare-bar-list__track">
                    {hasBoth && (
                      <div
                        className="category-bar-row__zero-line"
                        style={{ left: `${zeroPos}%` }}
                      />
                    )}
                    <div
                      className="compare-bar-list__fill"
                      style={{ ...fillStyle(value), background: color, opacity: value < 0 ? 0.75 : 0.9 }}
                    />
                  </div>
                  <div className="compare-bar-list__value mono">{value.toExponential(2)}</div>
                </div>
              );
            })}

            {/* Drill-down: scope breakdown for this category */}
            {isExpandable && isOpen && drillEntities && (
              <div className="compare-bar-list__drilldown">
                <CompareBarList
                  entities={drillEntities}
                  tone={tone}
                  mode="scope"
                  _nested
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
