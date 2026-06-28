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
});
