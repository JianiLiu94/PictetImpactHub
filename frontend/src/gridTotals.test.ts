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
