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

describe("SyncMarkdownRenderer (front matter)", () => {
  const SRC =
    "---\nlevel: 2\nchapter: 4\ntitle: RLHF・DPO・GRPO — 3 つの代表的な教え方\nslug: algorithms\nwritten_by: writer-subagent\n---\n\n# 第 4 章\n\nbody text\n";

  it("renders the front-matter block as a styled card with key/value pairs", () => {
    render(<SyncMarkdownRenderer source={SRC} />);
    const card = screen.getByTestId("front-matter");
    expect(card.tagName).toBe("DL");
    const keys = Array.from(card.querySelectorAll(".front-matter-key")).map((el) => el.textContent);
    const values = Array.from(card.querySelectorAll(".front-matter-value")).map(
      (el) => el.textContent,
    );
    expect(keys).toEqual(["level", "chapter", "title", "slug", "written_by"]);
    expect(values).toEqual([
      "2",
      "4",
      "RLHF・DPO・GRPO — 3 つの代表的な教え方",
      "algorithms",
      "writer-subagent",
    ]);
  });

  it("does not leak the raw delimiter text or YAML keys into the rendered body", () => {
    const { container } = render(<SyncMarkdownRenderer source={SRC} />);
    // No `<hr>` from a thematic break — that was the old failure mode where
    // remark interpreted `---` as a horizontal rule.
    expect(container.querySelector("hr")).toBeNull();
    // The body itself should still render.
    expect(screen.getByRole("heading", { level: 1, name: "第 4 章" })).toBeInTheDocument();
    expect(container.textContent).toContain("body text");
  });

  it("stamps source-position offsets covering the entire front-matter block", () => {
    render(<SyncMarkdownRenderer source={SRC} />);
    const card = screen.getByTestId("front-matter");
    const start = Number(card.dataset.srcstart);
    const end = Number(card.dataset.srcend);
    expect(start).toBe(0);
    // Should include both `---` delimiters and end at (or just past) the
    // closing newline.
    expect(end).toBeGreaterThan(SRC.indexOf("---\n", 4));
    expect(end).toBeLessThanOrEqual(SRC.indexOf("# 第 4 章"));
  });

  it("does not render a card when there is no front matter", () => {
    render(<SyncMarkdownRenderer source={"# Just a heading\n"} />);
    expect(screen.queryByTestId("front-matter")).toBeNull();
  });

  it("strips surrounding quotes from quoted scalar values", () => {
    const src = "---\ntitle: \"Quoted Title\"\nname: 'single'\n---\n\nbody\n";
    render(<SyncMarkdownRenderer source={src} />);
    const values = Array.from(
      screen.getByTestId("front-matter").querySelectorAll(".front-matter-value"),
    ).map((el) => el.textContent);
    expect(values).toEqual(["Quoted Title", "single"]);
  });
});
