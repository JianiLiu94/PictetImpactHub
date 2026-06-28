import { useState } from "react";
import { ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import type { ScoreOut } from "../types";

interface ScoreToggleProps {
  scores: ScoreOut[];
}

export function ScoreToggle({ scores }: ScoreToggleProps) {
  const [view, setView] = useState<"bars" | "scatter">("bars");

  return (
    <div>
      <div>
        <button onClick={() => setView("bars")} aria-pressed={view === "bars"}>
          Score bars
        </button>
        <button onClick={() => setView("scatter")} aria-pressed={view === "scatter"}>
          Quadrant scatter
        </button>
      </div>

      {view === "bars" ? (
        <ul>
          {scores.map((s) => (
            <li key={s.entity_id}>
              {s.name}
              <div>Social: {s.social_score}</div>
              <div>Biodiversity: {s.biodiversity_score}</div>
            </li>
          ))}
        </ul>
      ) : (
        <div data-testid="score-scatter">
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart>
              <XAxis dataKey="social_score" name="Social score" domain={[0, 100]} />
              <YAxis dataKey="biodiversity_score" name="Biodiversity score" domain={[0, 100]} />
              <Tooltip />
              <Scatter data={scores} fill="#4a90d9" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
