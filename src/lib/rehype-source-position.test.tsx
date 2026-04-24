import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SyncMarkdownRenderer } from "./markdown";

describe("rehype-source-position", () => {
  it("stamps block elements with data-srcstart / data-srcend", () => {
    const source = "# Heading\n\nFirst para.\n\nSecond para.\n";
    const { container } = render(<SyncMarkdownRenderer source={source} />);

    const h1 = container.querySelector("h1");
    expect(h1).not.toBeNull();
    const hs = Number(h1?.dataset.srcstart);
    const he = Number(h1?.dataset.srcend);
    expect(Number.isFinite(hs)).toBe(true);
    expect(Number.isFinite(he)).toBe(true);
    // The heading source runs from column 0 up to (and including) the newline.
    expect(source.slice(hs, he)).toContain("# Heading");

    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs.length).toBe(2);
    const [p1, p2] = paragraphs;
    expect(source.slice(Number(p1?.dataset.srcstart), Number(p1?.dataset.srcend))).toContain(
      "First para.",
    );
    expect(source.slice(Number(p2?.dataset.srcstart), Number(p2?.dataset.srcend))).toContain(
      "Second para.",
    );
  });

  it("stamps inline emphasis nodes too", () => {
    const source = "paragraph with **bold** and *italic*.\n";
    const { container } = render(<SyncMarkdownRenderer source={source} />);

    const strong = container.querySelector("strong");
    const em = container.querySelector("em");
    expect(strong).not.toBeNull();
    expect(em).not.toBeNull();
    expect(source.slice(Number(strong?.dataset.srcstart), Number(strong?.dataset.srcend))).toBe(
      "**bold**",
    );
    expect(source.slice(Number(em?.dataset.srcstart), Number(em?.dataset.srcend))).toBe("*italic*");
  });

  it("survives rehype-sanitize (attribute is in the allow-list)", () => {
    const source = "a\n\nb\n";
    const { container } = render(<SyncMarkdownRenderer source={source} />);
    for (const p of container.querySelectorAll("p")) {
      expect(p.getAttribute("data-srcstart")).not.toBeNull();
      expect(p.getAttribute("data-srcend")).not.toBeNull();
    }
  });
});
