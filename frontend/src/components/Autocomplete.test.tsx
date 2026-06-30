import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Autocomplete } from "./Autocomplete";

const items = [
  { id: "AAA", label: "Apple Holdings", meta: "AAA" },
  { id: "BBB", label: "Bridge Corp", meta: "BBB" },
];

describe("Autocomplete", () => {
  it("shows no dropdown when the query is empty", () => {
    render(<Autocomplete items={items} onSelect={() => {}} />);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("shows matching suggestions in a dropdown as the user types", () => {
    render(<Autocomplete items={items} onSelect={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText("Search..."), { target: { value: "apple" } });

    const menu = screen.getByRole("listbox");
    expect(within(menu).getByText("Apple Holdings")).toBeInTheDocument();
    expect(within(menu).queryByText("Bridge Corp")).not.toBeInTheDocument();
  });

  it("calls onSelect and clears the query when a suggestion is clicked", () => {
    const onSelect = vi.fn();
    render(<Autocomplete items={items} onSelect={onSelect} />);

    const input = screen.getByPlaceholderText("Search...") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "apple" } });
    fireEvent.mouseDown(within(screen.getByRole("listbox")).getByText("Apple Holdings"));

    expect(onSelect).toHaveBeenCalledWith(items[0]);
    expect(input.value).toBe("");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("supports keyboard navigation: ArrowDown highlights the next option, Enter selects it", () => {
    const onSelect = vi.fn();
    render(<Autocomplete items={items} onSelect={onSelect} />);

    const input = screen.getByPlaceholderText("Search...");
    fireEvent.change(input, { target: { value: "o" } }); // matches both "Apple Holdings" and "Bridge Corp"
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSelect).toHaveBeenCalledWith(items[1]);
  });

  it("closes the dropdown on Escape", () => {
    render(<Autocomplete items={items} onSelect={() => {}} />);

    const input = screen.getByPlaceholderText("Search...");
    fireEvent.change(input, { target: { value: "apple" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
