import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScoreToggle } from "./ScoreToggle";

const scores = [
  { entity_id: "A", name: "Company A", social_score: 80, biodiversity_score: 30, social_impact: 1e6, biodiversity_impact: -2e3 },
  { entity_id: "B", name: "Company B", social_score: 40, biodiversity_score: 90, social_impact: 5e5, biodiversity_impact: -1e4 },
];

describe("ScoreToggle", () => {
  it("renders scores for all entities", () => {
    render(<ScoreToggle scores={scores} />);
    expect(screen.getByText("Company A")).toBeInTheDocument();
    expect(screen.getByText("Social score: 80")).toBeInTheDocument();
    expect(screen.getByText("Biodiversity score: 30")).toBeInTheDocument();
    expect(screen.getByText("Company B")).toBeInTheDocument();
  });
});
