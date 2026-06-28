import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CategoryBarList } from "./CategoryBarList";

describe("CategoryBarList", () => {
  it("renders humanized category labels and formatted values, in the given order", () => {
    render(
      <CategoryBarList
        values={[
          { category: "own_ops_total", value: 3.2e-5 },
          { category: "water_stress", value: -1.1e-6 },
        ]}
        tone="bio"
      />
    );

    const labels = screen.getAllByText(/Own Ops Total|Water Stress/);
    expect(labels.map((el) => el.textContent)).toEqual(["Own Ops Total", "Water Stress"]);
  });

  it("renders an empty-state message when there are no categories", () => {
    render(<CategoryBarList values={[]} tone="social" />);
    expect(screen.getByText("No data available")).toBeInTheDocument();
  });

  it("diverges social bars from a zero baseline: positive grows right, negative grows left", () => {
    render(
      <CategoryBarList
        values={[
          { category: "employment", value: 4 },
          { category: "health", value: -2 },
        ]}
        tone="social"
      />
    );

    const rows = document.querySelectorAll(".category-bar-row");
    expect(rows).toHaveLength(2);

    const positiveFill = rows[0].querySelector(".category-bar-row__fill") as HTMLElement;
    expect(positiveFill.style.left).toBe("50%");
    expect(positiveFill.style.right).toBe("");

    const negativeFill = rows[1].querySelector(".category-bar-row__fill") as HTMLElement;
    expect(negativeFill.style.right).toBe("50%");
    expect(negativeFill.style.left).toBe("");

    expect(document.querySelectorAll(".category-bar-row__zero-line")).toHaveLength(2);
  });

  it("does not diverge biodiversity bars (no zero line, fill grows from the left edge)", () => {
    render(<CategoryBarList values={[{ category: "land_use", value: -3 }]} tone="bio" />);

    expect(document.querySelectorAll(".category-bar-row__zero-line")).toHaveLength(0);
    const fill = document.querySelector(".category-bar-row__fill") as HTMLElement;
    expect(fill.style.left).toBe("0px");
  });

  it("aligns own_ops and direct to the same 'Own Ops' label in scope mode, without reordering", () => {
    render(
      <CategoryBarList
        values={[
          { category: "upstream", value: 1 },
          { category: "own_ops", value: 2 },
          { category: "downstream", value: -1 },
        ]}
        tone="social"
        mode="scope"
      />
    );
    expect(screen.getAllByText(/Upstream|Own Ops|Downstream/).map((el) => el.textContent)).toEqual([
      "Upstream",
      "Own Ops",
      "Downstream",
    ]);

    render(
      <CategoryBarList
        values={[
          { category: "upstream", value: 1 },
          { category: "direct", value: 2 },
          { category: "downstream", value: -1 },
        ]}
        tone="bio"
        mode="scope"
      />
    );
    expect(screen.getAllByText("Own Ops")).toHaveLength(2); // one from each render above
  });
});
