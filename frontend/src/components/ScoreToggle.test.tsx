import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScoreToggle } from "./ScoreToggle";

const scores = [
  { entity_id: "A", name: "Company A", social_score: 80, biodiversity_score: 30 },
  { entity_id: "B", name: "Company B", social_score: 40, biodiversity_score: 90 },
];

describe("ScoreToggle", () => {
  it("defaults to bar view and shows both scores per entity", () => {
    render(<ScoreToggle scores={scores} />);
    expect(screen.getByText("Company A")).toBeInTheDocument();
    expect(screen.getByText("Social: 80")).toBeInTheDocument();
    expect(screen.getByText("Biodiversity: 30")).toBeInTheDocument();
  });

  it("switches to scatter view on toggle click", () => {
    render(<ScoreToggle scores={scores} />);
    fireEvent.click(screen.getByText("Quadrant scatter"));
    expect(screen.getByTestId("score-scatter")).toBeInTheDocument();
  });
});
