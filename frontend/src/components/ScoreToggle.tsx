import { useState } from "react";
import { ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import { formatNum } from "../format";
import type { ScoreOut } from "../types";

interface ScoreToggleProps {
  scores: ScoreOut[];
}

export function ScoreToggle({ scores }: ScoreToggleProps) {
  const [view, setView] = useState<"bars" | "scatter">("bars");

  return (
    <div>
      <div className="toggle-row">
        <button
          className={`toggle-btn${view === "bars" ? " is-active" : ""}`}
          onClick={() => setView("bars")}
          aria-pressed={view === "bars"}
        >
          Score bars
        </button>
        <button
          className={`toggle-btn${view === "scatter" ? " is-active" : ""}`}
          onClick={() => setView("scatter")}
          aria-pressed={view === "scatter"}
        >
          Quadrant scatter
        </button>
      </div>

      {view === "bars" ? (
        <ul className="score-list">
          {scores.map((s) => (
            <li key={s.entity_id}>
              <div className="score-list__name">{s.name}</div>
              <div className="score-list__row tone-social">Social: {formatNum(s.social_score)}</div>
              <div className="score-list__row tone-bio">Biodiversity: {formatNum(s.biodiversity_score)}</div>
            </li>
          ))}
        </ul>
      ) : (
        <div data-testid="score-scatter" className="card">
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart>
              <XAxis dataKey="social_score" name="Social score" domain={[0, 100]} />
              <YAxis dataKey="biodiversity_score" name="Biodiversity score" domain={[0, 100]} />
              <Tooltip />
              <Scatter data={scores} fill="#a8456b" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
