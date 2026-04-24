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

describe("SyncMarkdownRenderer (math)", () => {
  // remark-math requires display math (`$$...$$`) to sit in its own paragraph,
  // i.e. separated by blank lines. Without that it is parsed as inline.
  const DISPLAY_SIMPLE = "\n$$\nx^2\n$$\n";

  it("renders display math via rehype-katex", () => {
    const { container } = render(<SyncMarkdownRenderer source={DISPLAY_SIMPLE} />);
    expect(container.querySelector(".katex-display")).not.toBeNull();
    expect(container.querySelector(".katex")).not.toBeNull();
  });

  it("keeps KaTeX internal span classes through sanitization", () => {
    // `mord` etc. are the internal positioning classes KaTeX emits. If
    // sanitize strips them, the math looks like a broken string of letters.
    const { container } = render(<SyncMarkdownRenderer source={DISPLAY_SIMPLE} />);
    expect(container.querySelector(".mord")).not.toBeNull();
  });

  it("renders inline math without a display wrapper", () => {
    const { container } = render(<SyncMarkdownRenderer source={"eq $x^2$ mid"} />);
    expect(container.querySelector(".katex")).not.toBeNull();
    expect(container.querySelector(".katex-display")).toBeNull();
  });

  it("renders a compute-optimization style display equation end-to-end", () => {
    const src =
      "\n$$\n\\min_{c \\in \\{0,1\\}^N} \\sum_i (1 - c_i) M_i \\quad \\text{s.t.} \\sum_i c_i R_i \\leq T_{\\max}\n$$\n";
    const { container } = render(<SyncMarkdownRenderer source={src} />);
    expect(container.querySelector(".katex-display")).not.toBeNull();
    // Big operators and sub/superscripts all use `vlist` internally.
    expect(container.querySelector(".vlist")).not.toBeNull();
  });

  it("preserves the <math> MathML annotation", () => {
    const { container } = render(<SyncMarkdownRenderer source={DISPLAY_SIMPLE} />);
    expect(container.querySelector("math")).not.toBeNull();
  });
});
