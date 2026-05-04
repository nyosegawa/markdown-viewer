import { describe, expect, it } from "vitest";
import { normalizeRenameStem, splitFilename } from "./path-label";

describe("path-label", () => {
  it("splits a path into basename, stem, and extension", () => {
    expect(splitFilename("/docs/01-system-design.md")).toEqual({
      basename: "01-system-design.md",
      stem: "01-system-design",
      extension: ".md",
    });
  });

  it("strips the preserved extension from rename input", () => {
    expect(normalizeRenameStem("02-system-design.md", ".md")).toBe("02-system-design");
  });
});
