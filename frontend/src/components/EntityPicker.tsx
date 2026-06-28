import { useState } from "react";

export interface EntityPickerItem {
  id: string;
  label: string;
  meta?: string;
}

interface EntityPickerProps {
  items: EntityPickerItem[];
  selected: string[];
  onToggle: (id: string) => void;
}

export function EntityPicker({ items, selected, onToggle }: EntityPickerProps) {
  const [query, setQuery] = useState("");

  const filtered = items.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="entity-picker">
      <input
        type="text"
        className="entity-picker__search"
        placeholder="Search..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="entity-picker__list">
        {filtered.map((item) => (
          <label key={item.id} className="entity-picker__row">
            <input type="checkbox" checked={selected.includes(item.id)} onChange={() => onToggle(item.id)} />
            <span className="entity-picker__label">{item.label}</span>
            {item.meta && <span className="entity-picker__meta muted">{item.meta}</span>}
          </label>
        ))}
        {filtered.length === 0 && <div className="muted entity-picker__empty">No matches</div>}
      </div>
    </div>
  );
}
