import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EntityPicker } from "./EntityPicker";

const items = [
  { id: "1", label: "Cleaner Planet", meta: "91 companies" },
  { id: "2", label: "AI & Automation", meta: "90 companies" },
];

describe("EntityPicker", () => {
  it("renders all items when the search query is empty", () => {
    render(<EntityPicker items={items} selected={[]} onToggle={() => {}} />);
    expect(screen.getByText("Cleaner Planet")).toBeInTheDocument();
    expect(screen.getByText("AI & Automation")).toBeInTheDocument();
  });

  it("filters items by label, case-insensitively", () => {
    render(<EntityPicker items={items} selected={[]} onToggle={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText("Search..."), { target: { value: "cleaner" } });
    expect(screen.getByText("Cleaner Planet")).toBeInTheDocument();
    expect(screen.queryByText("AI & Automation")).not.toBeInTheDocument();
  });

  it("shows a 'No matches' message when the filter excludes everything", () => {
    render(<EntityPicker items={items} selected={[]} onToggle={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText("Search..."), { target: { value: "zzz" } });
    expect(screen.getByText("No matches")).toBeInTheDocument();
  });

  it("reflects selection state and calls onToggle with the right id", () => {
    const onToggle = vi.fn();
    render(<EntityPicker items={items} selected={["1"]} onToggle={onToggle} />);

    const checkboxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    expect(checkboxes[0].checked).toBe(true);
    expect(checkboxes[1].checked).toBe(false);

    fireEvent.click(checkboxes[1]);
    expect(onToggle).toHaveBeenCalledWith("2");
  });

  it("supports keyboard navigation: ArrowDown moves the highlighted row, Enter toggles it", () => {
    const onToggle = vi.fn();
    render(<EntityPicker items={items} selected={[]} onToggle={onToggle} />);

    const input = screen.getByPlaceholderText("Search...");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onToggle).toHaveBeenCalledWith("2");
  });

  it("resets the highlighted row to the top whenever the filter changes", () => {
    const onToggle = vi.fn();
    render(<EntityPicker items={items} selected={[]} onToggle={onToggle} />);

    const input = screen.getByPlaceholderText("Search...");
    fireEvent.keyDown(input, { key: "ArrowDown" }); // highlight moves to index 1 ("AI & Automation")
    fireEvent.change(input, { target: { value: "cleaner" } }); // filter narrows to just "Cleaner Planet"
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onToggle).toHaveBeenCalledWith("1");
  });

  it("clears the query on Escape", () => {
    render(<EntityPicker items={items} selected={[]} onToggle={() => {}} />);

    const input = screen.getByPlaceholderText("Search...") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "cleaner" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(input.value).toBe("");
  });
});
