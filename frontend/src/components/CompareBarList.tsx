import { useState } from "react";
import { humanizeLabel, scopeLabel } from "../format";
import { categoryIcon } from "../categoryIcons";
import type { CategoryValue } from "../types";

export interface CompareEntity {
  id: string;
  name: string;
  values: CategoryValue[];
}

/** Recursive drill-down node: entities to show at this level + optional next level per key. */
export interface DrillDownData {
  entities: CompareEntity[];
  mode: "category" | "scope" | "stakeholder";
  children?: Map<string, DrillDownData>;
}

interface CompareBarListProps {
  entities: CompareEntity[];
  tone: "social" | "bio";
  mode?: "category" | "scope" | "stakeholder";
  drillDown?: Map<string, DrillDownData>;
  _depth?: number;
}

const ENTITY_COLORS = ["#2563eb", "#e07b39", "#7c3aed", "#059669"];

function rowLabel(key: string, mode: "category" | "scope" | "stakeholder"): string {
  if (mode === "scope") return scopeLabel(key);
  return humanizeLabel(key);
}

export function CompareBarList({
  entities,
  tone,
  mode = "category",
  drillDown,
  _depth = 0,
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

  const allValues = entities.flatMap((e) => e.values.map((v) => v.value));
  const globalPosMax = Math.max(0, ...allValues.filter((v) => v > 0));
  const globalNegMin = Math.min(0, ...allValues.filter((v) => v < 0));
  const hasBoth = globalPosMax > 0 && globalNegMin < 0;
  const hasOnlyNeg = globalPosMax === 0 && globalNegMin < 0;
  const totalRange = globalPosMax + Math.abs(globalNegMin) || 1e-12;
  const zeroPos = globalNegMin < 0 ? (Math.abs(globalNegMin) / totalRange) * 100 : 0;

  const fillStyle = (value: number): React.CSSProperties => {
    if (hasOnlyNeg) {
      const w = Math.abs(globalNegMin) > 0 ? (Math.abs(value) / Math.abs(globalNegMin)) * 100 : 0;
      return { right: 0, width: `${Math.min(100, w)}%` };
    }
    if (!hasBoth) {
      const w = globalPosMax > 0 ? (value / globalPosMax) * 100 : 0;
      return { left: 0, width: `${Math.min(100, w)}%` };
    }
    if (value >= 0) {
      const w = globalPosMax > 0 ? (value / globalPosMax) * (100 - zeroPos) : 0;
      return { left: `${zeroPos}%`, width: `${Math.min(100 - zeroPos, w)}%` };
    } else {
      const w = Math.abs(globalNegMin) > 0 ? (Math.abs(value) / Math.abs(globalNegMin)) * zeroPos : 0;
      return { left: `${Math.max(0, zeroPos - w)}%`, width: `${Math.min(zeroPos, w)}%` };
    }
  };

  const toggle = (cat: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });

  return (
    <div className="compare-bar-list" style={_depth > 0 ? { marginTop: 4 } : undefined}>
      {/* Legend — only at top level */}
      {_depth === 0 && (
        <div className="compare-bar-list__legend">
          {entities.map((e, i) => (
            <span key={e.id} className="compare-bar-list__legend-item">
              <span className="compare-bar-list__legend-dot" style={{ background: ENTITY_COLORS[i % ENTITY_COLORS.length] }} />
              {e.name}
            </span>
          ))}
        </div>
      )}

      {categories.map((cat) => {
        const node = drillDown?.get(cat);
        const isExpandable = !!node;
        const isOpen = expanded.has(cat);

        return (
          <div key={cat} className="compare-bar-list__group">
            <div
              className={`compare-bar-list__cat-label${isExpandable ? " compare-bar-list__cat-label--clickable" : ""}`}
              onClick={isExpandable ? () => toggle(cat) : undefined}
            >
              {mode === "category" && _depth === 0 && categoryIcon(cat)}
              {rowLabel(cat, mode)}
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
                    <div
                      className="compare-bar-list__fill"
                      style={{ ...fillStyle(value), background: color, opacity: value < 0 ? 0.75 : 0.9 }}
                    />
                  </div>
                  <div className="compare-bar-list__value mono">{value.toExponential(2)}</div>
                </div>
              );
            })}

            {isExpandable && isOpen && node && (
              <div className="compare-bar-list__drilldown">
                <CompareBarList
                  entities={node.entities}
                  tone={tone}
                  mode={node.mode}
                  drillDown={node.children}
                  _depth={_depth + 1}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
