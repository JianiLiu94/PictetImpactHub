/** Rounds to at most `decimals` places and trims trailing zeros (80 -> "80", 43.4545 -> "43.45"). */
export function formatNum(value: number, decimals = 2): string {
  return Number(value.toFixed(decimals)).toString();
}

/** Same as formatNum but keeps thousands separators, for currency-like values. */
export function formatAmount(value: number, decimals = 2): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

/** Turns a snake_case backend label into a readable title (own_ops -> "Own Ops"). */
export function humanizeLabel(value: string): string {
  return value
    .split("_")
    .map((word) => (word.length === 0 ? word : word[0].toUpperCase() + word.slice(1)))
    .join(" ");
}

/**
 * Same as humanizeLabel, but aligns the two models' "own operations" scope:
 * social calls it own_ops, biodiversity calls it direct -- same scope
 * position, so both render as "Own Ops" instead of "Own Ops" vs "Direct".
 */
export function scopeLabel(value: string): string {
  if (value === "direct") return "Own Ops";
  return humanizeLabel(value);
}
