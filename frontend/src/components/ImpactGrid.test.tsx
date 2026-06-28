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

    expect(screen.getByTestId("cell-direct-climate_change")).toHaveTextContent("-1.50e+0");
    expect(screen.getByTestId("cell-direct-water_stress")).toHaveTextContent("n/a");
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

    expect(screen.getByTestId("cell-direct-unassigned")).toHaveTextContent("1.00e+0");
    expect(screen.getByTestId("cell-indirect-unassigned")).toHaveTextContent("2.00e+0");
  });

  it("renders an empty-state message when there are no cells", () => {
    render(<ImpactGrid cells={[]} rowKeyField="scope" colKeyField="category" />);

    expect(screen.getByText("No data available")).toBeInTheDocument();
  });

  it("humanizes snake_case row/column labels", () => {
    render(
      <ImpactGrid
        cells={[{ scope: "own_ops", category: "income_wealth", stakeholder: null, value: 1 }]}
        rowKeyField="scope"
        colKeyField="category"
      />
    );

    expect(screen.getByText("Own Ops")).toBeInTheDocument();
    expect(screen.getByText("Income Wealth")).toBeInTheDocument();
  });

  it("adds a Sum and Max column per row and a Sum and Max row per column", () => {
    render(
      <ImpactGrid
        cells={[
          { scope: "direct", category: "climate_change", stakeholder: null, value: 1 },
          { scope: "direct", category: "water_stress", stakeholder: null, value: 3 },
          { scope: "upstream", category: "climate_change", stakeholder: null, value: 2 },
          { scope: "upstream", category: "water_stress", stakeholder: null, value: 4 },
        ]}
        rowKeyField="scope"
        colKeyField="category"
      />
    );

    expect(screen.getAllByText("Sum")).toHaveLength(2);
    expect(screen.getAllByText("Max")).toHaveLength(2);

    expect(screen.getByTestId("cell-direct-__sum__")).toHaveTextContent("4.00e+0");
    expect(screen.getByTestId("cell-direct-__max__")).toHaveTextContent("3.00e+0");
    expect(screen.getByTestId("cell-upstream-__sum__")).toHaveTextContent("6.00e+0");
    expect(screen.getByTestId("cell-upstream-__max__")).toHaveTextContent("4.00e+0");

    expect(screen.getByTestId("cell-__sum__-climate_change")).toHaveTextContent("3.00e+0");
    expect(screen.getByTestId("cell-__max__-climate_change")).toHaveTextContent("2.00e+0");
    expect(screen.getByTestId("cell-__sum__-water_stress")).toHaveTextContent("7.00e+0");
    expect(screen.getByTestId("cell-__max__-water_stress")).toHaveTextContent("4.00e+0");

    expect(screen.getByTestId("cell-__sum__-__sum__")).toHaveTextContent("1.00e+1");
    expect(screen.getByTestId("cell-__max__-__max__")).toHaveTextContent("4.00e+0");
    expect(screen.getByTestId("cell-__sum__-__max__")).toHaveTextContent("n/a");
    expect(screen.getByTestId("cell-__max__-__sum__")).toHaveTextContent("n/a");
  });

  it("aligns biodiversity's 'direct' scope to the same 'Own Ops' label social uses, only for the scope field", () => {
    render(
      <ImpactGrid
        cells={[{ scope: "direct", category: "direct", stakeholder: null, value: 1 }]}
        rowKeyField="scope"
        colKeyField="category"
      />
    );

    expect(screen.getByText("Own Ops")).toBeInTheDocument();
    expect(screen.getByText("Direct")).toBeInTheDocument();
  });
});
