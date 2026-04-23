import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SyncMarkdownRenderer } from "./markdown";

describe("SyncMarkdownRenderer (GFM)", () => {
  it("renders headings", () => {
    render(<SyncMarkdownRenderer source={"# Hello World\n"} />);
    expect(screen.getByRole("heading", { level: 1, name: "Hello World" })).toBeInTheDocument();
  });

  it("renders GFM tables", () => {
    const src = "| a | b |\n|---|---|\n| 1 | 2 |\n";
    render(<SyncMarkdownRenderer source={src} />);
    const table = screen.getByRole("table");
    expect(table).toBeInTheDocument();
    expect(table.textContent).toContain("1");
    expect(table.textContent).toContain("2");
  });

  it("renders task lists as checkboxes", () => {
    const src = "- [x] done\n- [ ] todo\n";
    render(<SyncMarkdownRenderer source={src} />);
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(2);
    expect((checkboxes[0] as HTMLInputElement).checked).toBe(true);
    expect((checkboxes[1] as HTMLInputElement).checked).toBe(false);
  });

  it("supports strike-through", () => {
    const { container } = render(<SyncMarkdownRenderer source={"~~gone~~"} />);
    expect(container.querySelector("del")?.textContent).toBe("gone");
  });

  it("does not inject raw script tags", () => {
    const { container } = render(
      <SyncMarkdownRenderer source={"<script>alert(1)</script>\n\nplain text"} />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("plain text");
  });
});
