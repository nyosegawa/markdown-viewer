import { describe, expect, it } from "vitest";
import { extractFrontMatter } from "./front-matter";

describe("extractFrontMatter", () => {
  it("returns null when the document has no front matter", () => {
    expect(extractFrontMatter("# heading\n\nbody\n")).toBeNull();
  });

  it("returns null when --- only appears mid-document (not at the start)", () => {
    expect(extractFrontMatter("intro\n\n---\nkey: value\n---\n")).toBeNull();
  });

  it("parses simple key:value entries in source order", () => {
    const src = "---\nlevel: 2\ntitle: hello\n---\n\nbody";
    const m = extractFrontMatter(src);
    expect(m).not.toBeNull();
    expect(m?.entries).toEqual([
      { key: "level", value: "2" },
      { key: "title", value: "hello" },
    ]);
  });

  it("end offset covers the closing delimiter and trailing newline", () => {
    const src = "---\nk: v\n---\nbody";
    const m = extractFrontMatter(src);
    expect(m).not.toBeNull();
    expect(src.slice(m?.start, m?.end)).toBe("---\nk: v\n---\n");
  });

  it("handles CRLF line endings", () => {
    const src = "---\r\nk: v\r\n---\r\nbody";
    const m = extractFrontMatter(src);
    expect(m?.entries).toEqual([{ key: "k", value: "v" }]);
  });

  it("strips matching surrounding double or single quotes", () => {
    const m = extractFrontMatter("---\na: \"x\"\nb: 'y'\n---\n");
    expect(m?.entries).toEqual([
      { key: "a", value: "x" },
      { key: "b", value: "y" },
    ]);
  });

  it("ignores blank lines and comments inside the block", () => {
    const m = extractFrontMatter("---\n# top comment\n\nk: v\n---\n");
    expect(m?.entries).toEqual([{ key: "k", value: "v" }]);
  });
});
