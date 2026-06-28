import { humanizeLabel, scopeLabel } from "../format";
import { categoryIcon } from "../categoryIcons";
import type { CategoryValue } from "../types";

interface CategoryBarListProps {
  values: CategoryValue[];
  tone: "social" | "bio";
  /**
   * "category" (default) shows the category icon and humanized category
   * label, in whatever order `values` is given (callers sort by value).
   * "scope" shows the aligned scope label (own_ops/direct both render as
   * "Own Ops") and skips the icon, preserving `values`' given order rather
   * than re-sorting -- callers pass scopes in fixed upstream/own/downstream
   * order so the two models' scope rows stay aligned.
   */
  mode?: "category" | "scope";
}

/**
 * Ranked horizontal bar list, assumes `values` is already in display order.
 *
 * Social values can be positive or negative, so bars diverge from a zero
 * baseline at the track's center (positive grows right, negative grows
 * left). Biodiversity values are always negative, so its bars grow from the
 * left edge — there's no meaningful "positive" direction to diverge against.
 */
export function CategoryBarList({ values, tone, mode = "category" }: CategoryBarListProps) {
  if (values.length === 0) {
    return <div className="muted">No data available</div>;
  }

  const diverging = tone === "social";
  const maxAbs = Math.max(1e-12, ...values.map((v) => Math.abs(v.value)));

  return (
    <div className="category-bar-list">
      {values.map((v) => {
        const pct = Math.min(100, (Math.abs(v.value) / maxAbs) * (diverging ? 50 : 100));
        const isNegative = v.value < 0;
        const fillStyle = diverging
          ? isNegative
            ? { right: "50%", width: `${pct}%` }
            : { left: "50%", width: `${pct}%` }
          : { left: 0, width: `${pct}%` };

        return (
          <div key={v.category} className="category-bar-row">
            <div className="category-bar-row__label">
              {mode === "category" && categoryIcon(v.category)}
              {mode === "scope" ? scopeLabel(v.category) : humanizeLabel(v.category)}
            </div>
            <div className="category-bar-row__track">
              {diverging && <div className="category-bar-row__zero-line" />}
              <div
                className={`category-bar-row__fill tone-${tone}-bg${isNegative ? " category-bar-row__fill--negative" : ""}`}
                style={fillStyle}
              />
            </div>
            <div className="category-bar-row__value mono">{v.value.toExponential(2)}</div>
          </div>
        );
      })}
    </div>
  );
}
