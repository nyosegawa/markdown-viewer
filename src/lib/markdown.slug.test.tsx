import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SyncMarkdownRenderer } from "./markdown";

describe("SyncMarkdownRenderer (heading anchors)", () => {
  it("assigns slugified ids to headings (h1-h5)", () => {
    const src = [
      "# Top Title",
      "## Second Section",
      "### Third",
      "#### Fourth Level Deep",
      "##### Fifth",
    ].join("\n\n");
    const { container } = render(<SyncMarkdownRenderer source={src} />);
    expect(container.querySelector("h1")?.id).toBe("top-title");
    expect(container.querySelector("h2")?.id).toBe("second-section");
    expect(container.querySelector("h3")?.id).toBe("third");
    expect(container.querySelector("h4")?.id).toBe("fourth-level-deep");
    expect(container.querySelector("h5")?.id).toBe("fifth");
  });

  it("does NOT prefix ids with `user-content-` (clobber disabled)", () => {
    const { container } = render(<SyncMarkdownRenderer source={"## 1. cmux ssh とは何か\n"} />);
    const h2 = container.querySelector("h2");
    expect(h2?.id).toBe("1-cmux-ssh-とは何か");
    expect(h2?.id.startsWith("user-content-")).toBe(false);
  });

  it("author-written fragment links survive sanitization", () => {
    const src = "## 目次\n\n[jump](#target-section)\n\n## Target Section\n";
    const { container } = render(<SyncMarkdownRenderer source={src} />);
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("#target-section");
  });
});
