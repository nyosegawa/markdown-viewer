import { render, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownRenderer } from "./markdown";

// Diagnostic: verify Shiki itself can load in the test environment.
// If this fails, the other tests would silently fall back to the
// KaTeX-only plugin set and give a misleading "Shiki is broken" signal.
describe("Shiki availability (vitest sanity)", () => {
  it("loads @shikijs/core with the JS regex engine", async () => {
    const { createHighlighterCore } = await import("@shikijs/core");
    const { createJavaScriptRegexEngine } = await import("@shikijs/engine-javascript");
    const highlighter = await createHighlighterCore({
      themes: [import("@shikijs/themes/github-light")],
      langs: [import("@shikijs/langs/javascript")],
      engine: createJavaScriptRegexEngine(),
    });
    const html = highlighter.codeToHtml("console.log(1)", {
      lang: "javascript",
      theme: "github-light",
    });
    expect(html).toContain("<pre");
    expect(html).toMatch(/class="[^"]*shiki[^"]*"/);
  }, 20000);
});

/**
 * End-to-end check of the *production* rehype pipeline:
 *   remark-gfm + remark-math →
 *   rehype-slug → rehype-katex → rehype-shiki → rehype-sanitize
 *
 * The Sync renderer tests in markdown.test.tsx skip Shiki to stay fast,
 * but that means they cannot catch regressions where Shiki and KaTeX
 * fight over the same nodes. That exact class of bug (Shiki plaintext-
 * highlighting a `math math-display` code block) shipped to users once;
 * this suite exists so the next one is caught in CI.
 */
describe("MarkdownRenderer (integration: Shiki + KaTeX)", () => {
  it("renders display math AND a Shiki-highlighted code block in the same document", async () => {
    const src = [
      "",
      "$$",
      "\\min_{c \\in \\{0,1\\}^N} \\sum_i (1 - c_i) M_i \\quad \\text{s.t.} \\sum_i c_i R_i \\leq T_{\\max}",
      "$$",
      "",
      "```js",
      "console.log('hello');",
      "```",
      "",
    ].join("\n");

    const { container } = render(<MarkdownRenderer source={src} />);

    // Once KaTeX is in the DOM, the same loadRehype chain has applied Shiki
    // too (both run in one rehype pass triggered by setRehypePlugins).
    await waitFor(
      () => {
        expect(container.querySelector(".katex-display")).not.toBeNull();
      },
      { timeout: 20000 },
    );

    // Positioning classes KaTeX emits must survive rehype-sanitize.
    expect(container.querySelector(".vlist")).not.toBeNull();
    expect(container.querySelector(".mord")).not.toBeNull();

    // Shiki highlighted the JS block. In our config (dual theme +
    // `defaultColor: false`) Shiki does NOT emit a `.shiki` class —
    // it encodes theme colors via CSS custom properties
    // (`--shiki-light`, `--shiki-dark`) on inline styles instead.
    const pres = Array.from(container.querySelectorAll("pre"));
    const shikiPre = pres.find((p) => (p.getAttribute("style") ?? "").includes("--shiki-"));
    expect(shikiPre, "expected a <pre> with Shiki CSS variables").toBeDefined();

    // The regression we are guarding against: Shiki swallows the math
    // block and plaintext-highlights raw LaTeX. That would put `\min_`
    // inside a <pre>.
    for (const pre of pres) {
      expect(pre.textContent ?? "").not.toContain("\\min_");
    }

    // The JS block contains `console.log` tokenised into multiple spans.
    const jsPre = pres.find((p) => p.textContent?.includes("console.log"));
    expect(jsPre).toBeDefined();
    expect(jsPre?.querySelectorAll("span").length ?? 0).toBeGreaterThan(1);
  }, 25000);

  it("renders inline math alongside inline code without either clobbering the other", async () => {
    const src = "Given $x^2$, then `const x = 2` follows.\n";
    const { container } = render(<MarkdownRenderer source={src} />);

    await waitFor(
      () => {
        expect(container.querySelector(".katex")).not.toBeNull();
      },
      { timeout: 20000 },
    );

    // Inline math must not be wrapped in a display block.
    expect(container.querySelector(".katex-display")).toBeNull();
    // Inline code must still appear as a <code> element.
    const inlineCode = Array.from(container.querySelectorAll("code")).find(
      (el) => el.textContent === "const x = 2",
    );
    expect(inlineCode).toBeDefined();
  }, 25000);
});
