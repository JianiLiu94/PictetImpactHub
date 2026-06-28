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
});
