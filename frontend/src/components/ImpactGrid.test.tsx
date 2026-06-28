import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ImpactGrid } from "./ImpactGrid";

describe("ImpactGrid", () => {
  it("renders 'no data' for null cells and a formatted value for present cells", () => {
    render(
      <ImpactGrid
        cells={[
          { scope: "direct", category: "climate_change", stakeholder: null, value: -1.5 },
          { scope: "direct", category: "water_stress", stakeholder: null, value: null },
        ]}
        rowKeyField="scope"
        colKeyField="category"
      />
    );

    expect(screen.getByText("no data")).toBeInTheDocument();
    expect(screen.getByText("-1.50e+0")).toBeInTheDocument();
  });

  it("keeps cells with null stakeholder distinct instead of collapsing them into one column", () => {
    render(
      <ImpactGrid
        cells={[
          { scope: "direct", category: "climate_change", stakeholder: null, value: 1 },
          { scope: "indirect", category: "water_stress", stakeholder: null, value: 2 },
        ]}
        rowKeyField="scope"
        colKeyField="stakeholder"
      />
    );

    expect(screen.getByText("1.00e+0")).toBeInTheDocument();
    expect(screen.getByText("2.00e+0")).toBeInTheDocument();
  });

  it("renders an empty-state message when there are no cells", () => {
    render(<ImpactGrid cells={[]} rowKeyField="scope" colKeyField="category" />);

    expect(screen.getByText("No data available")).toBeInTheDocument();
  });
});
