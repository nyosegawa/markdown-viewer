import { describe, expect, it } from "vitest";
import { isMarkdownPath, parseLocalLinkHref } from "./links";

describe("parseLocalLinkHref", () => {
  it("returns null for bare in-page anchors", () => {
    expect(parseLocalLinkHref("#heading")).toBeNull();
    expect(parseLocalLinkHref("#")).toBeNull();
  });

  it("returns null for web schemes", () => {
    expect(parseLocalLinkHref("https://example.com")).toBeNull();
    expect(parseLocalLinkHref("http://example.com/path?q=1")).toBeNull();
    expect(parseLocalLinkHref("mailto:foo@bar.com")).toBeNull();
    expect(parseLocalLinkHref("tel:+1-555")).toBeNull();
    expect(parseLocalLinkHref("javascript:alert(1)")).toBeNull();
  });

  it("returns null for empty href", () => {
    expect(parseLocalLinkHref("")).toBeNull();
  });

  it("parses relative posix paths", () => {
    expect(parseLocalLinkHref("./README.md")).toEqual({ path: "./README.md", fragment: null });
    expect(parseLocalLinkHref("docs/01-foo.md")).toEqual({
      path: "docs/01-foo.md",
      fragment: null,
    });
    expect(parseLocalLinkHref("../sibling/x.md")).toEqual({
      path: "../sibling/x.md",
      fragment: null,
    });
  });

  it("parses absolute posix paths", () => {
    expect(parseLocalLinkHref("/Users/me/notes/x.md")).toEqual({
      path: "/Users/me/notes/x.md",
      fragment: null,
    });
  });

  it("splits and url-decodes fragments", () => {
    expect(parseLocalLinkHref("./README.md#install")).toEqual({
      path: "./README.md",
      fragment: "install",
    });
    expect(parseLocalLinkHref("./a%20b.md#%E8%A6%8B%E5%87%BA%E3%81%97")).toEqual({
      path: "./a b.md",
      fragment: "見出し",
    });
  });

  it("strips query strings from the path", () => {
    expect(parseLocalLinkHref("./image.png?v=2")).toEqual({ path: "./image.png", fragment: null });
  });

  it("parses file:// URLs", () => {
    expect(parseLocalLinkHref("file:///Users/me/x.md")).toEqual({
      path: "/Users/me/x.md",
      fragment: null,
    });
    expect(parseLocalLinkHref("file:///Users/me/x.md#sec")).toEqual({
      path: "/Users/me/x.md",
      fragment: "sec",
    });
  });

  it("strips the leading slash from windows file:// URLs (file:///C:/...)", () => {
    expect(parseLocalLinkHref("file:///C:/Users/me/x.md")).toEqual({
      path: "C:/Users/me/x.md",
      fragment: null,
    });
  });
});

describe("isMarkdownPath", () => {
  it("recognises markdown extensions case-insensitively", () => {
    expect(isMarkdownPath("README.md")).toBe(true);
    expect(isMarkdownPath("/abs/path.MARKDOWN")).toBe(true);
    expect(isMarkdownPath("./x.mdx")).toBe(true);
  });

  it("rejects non-markdown paths", () => {
    expect(isMarkdownPath("./image.png")).toBe(false);
    expect(isMarkdownPath("./file.txt")).toBe(false);
    expect(isMarkdownPath("./no-ext")).toBe(false);
  });
});
