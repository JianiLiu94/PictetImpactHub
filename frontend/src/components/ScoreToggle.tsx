import { formatNum } from "../format";
import type { ScoreOut } from "../types";

interface ScoreToggleProps {
  scores: ScoreOut[];
}

export function ScoreToggle({ scores }: ScoreToggleProps) {
  return (
    <ul className="score-list">
      {scores.map((s) => (
        <li key={s.entity_id}>
          <div className="score-list__name">{s.name}</div>
          <div className="score-list__row tone-social">Social score: {formatNum(s.social_score)}</div>
          <div className="score-list__row tone-bio">Biodiversity score: {formatNum(s.biodiversity_score)}</div>
        </li>
      ))}
    </ul>
  );
}
