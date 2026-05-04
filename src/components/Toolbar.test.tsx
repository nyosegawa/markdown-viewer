import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Toolbar } from "./Toolbar";

function baseProps() {
  return {
    path: "/tmp/hello.md",
    mode: "view" as const,
    onToggleMode: vi.fn(),
    onOpen: vi.fn(),
    theme: "dark" as const,
    onToggleTheme: vi.fn(),
    recent: ["/tmp/one.md", "/tmp/two.md"],
    onPickRecent: vi.fn(),
    onClearRecent: vi.fn(),
    onRenameActive: vi.fn().mockResolvedValue(undefined),
  };
}

describe("Toolbar", () => {
  it("shows the basename of the open file", () => {
    render(<Toolbar {...baseProps()} />);
    expect(screen.getByTestId("title").textContent).toBe("hello.md");
  });

  it("calls onOpen when Open is clicked", async () => {
    const props = baseProps();
    render(<Toolbar {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "Open file" }));
    expect(props.onOpen).toHaveBeenCalledOnce();
  });

  it("toggles mode action between edit and view", () => {
    const props = baseProps();
    const { rerender } = render(<Toolbar {...props} />);
    expect(screen.getByTestId("mode-btn")).toHaveAccessibleName("Switch to edit mode");
    rerender(<Toolbar {...props} mode="edit" />);
    expect(screen.getByTestId("mode-btn")).toHaveAccessibleName("Switch to view mode");
    expect(screen.getByTestId("mode-btn").getAttribute("aria-pressed")).toBe("true");
  });

  it("disables edit toggle when no file is open", () => {
    render(<Toolbar {...baseProps()} path={null} />);
    expect(screen.getByTestId("mode-btn")).toBeDisabled();
  });

  it("shows recent files in a menu", async () => {
    render(<Toolbar {...baseProps()} />);
    await userEvent.click(screen.getByRole("button", { name: "Open recent files" }));
    const list = screen.getByTestId("recent-list");
    expect(list.textContent).toContain("one.md");
    expect(list.textContent).toContain("two.md");
  });

  it("calls onToggleTheme", async () => {
    const props = baseProps();
    render(<Toolbar {...props} />);
    await userEvent.click(screen.getByTestId("theme-btn"));
    expect(props.onToggleTheme).toHaveBeenCalledOnce();
  });

  it("double-clicking the title renames only the active filename stem", async () => {
    const props = baseProps();
    render(<Toolbar {...props} path="/tmp/01-system-design.md" />);

    await userEvent.dblClick(screen.getByTestId("title"));
    const input = screen.getByRole("textbox", { name: "Rename active file" });
    expect(input).toHaveValue("01-system-design");
    expect(screen.getByText(".md")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "02-system-design" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(props.onRenameActive).toHaveBeenCalledWith("02-system-design");
  });
});
