import { useState } from "react";
import type { KeyboardEvent } from "react";

export interface AutocompleteItem {
  id: string;
  label: string;
  meta?: string;
}

interface AutocompleteProps {
  items: AutocompleteItem[];
  placeholder?: string;
  onSelect: (item: AutocompleteItem) => void;
  maxSuggestions?: number;
}

/** Type-ahead search: typing shows a dropdown of matching suggestions, selected via click or keyboard. */
export function Autocomplete({ items, placeholder = "Search...", onSelect, maxSuggestions = 8 }: AutocompleteProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const suggestions =
    query.trim() === ""
      ? []
      : items.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())).slice(0, maxSuggestions);

  const handleSelect = (item: AutocompleteItem) => {
    onSelect(item);
    setQuery("");
    setOpen(false);
    setActiveIndex(0);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleSelect(suggestions[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="autocomplete">
      <input
        type="text"
        className="autocomplete__input"
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setOpen(false), 100)}
      />
      {open && suggestions.length > 0 && (
        <ul className="autocomplete__menu" role="listbox">
          {suggestions.map((item, index) => (
            <li
              key={item.id}
              role="option"
              aria-selected={index === activeIndex}
              className={`autocomplete__option${index === activeIndex ? " is-active" : ""}`}
              onMouseDown={() => handleSelect(item)}
              onMouseEnter={() => setActiveIndex(index)}
            >
              <span>{item.label}</span>
              {item.meta && <span className="muted autocomplete__meta">{item.meta}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
