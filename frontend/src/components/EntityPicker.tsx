import { useEffect, useState } from "react";
import type { KeyboardEvent } from "react";

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
  const [activeIndex, setActiveIndex] = useState(0);

  const filtered = items.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      onToggle(filtered[activeIndex].id);
    } else if (e.key === "Escape") {
      setQuery("");
    }
  };

  return (
    <div className="entity-picker">
      <input
        type="text"
        className="entity-picker__search"
        placeholder="Search..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <div className="entity-picker__list">
        {filtered.map((item, index) => (
          <label key={item.id} className={`entity-picker__row${index === activeIndex ? " is-active" : ""}`}>
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
