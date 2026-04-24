import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Editor } from "./Editor";

describe("Editor", () => {
  it("places the cursor at the line containing initialSourceOffset", () => {
    const value = "first line\nsecond line\nthird line\n";
    const offset = value.indexOf("third line");
    const { container } = render(
      <Editor value={value} onChange={() => {}} theme="light" initialSourceOffset={offset} />,
    );

    // CodeMirror renders each line as a `.cm-line`. We can check the DOM order:
    // the line for the offset we passed should be rendered, and `.cm-activeLine`
    // should be the third one.
    const lines = container.querySelectorAll(".cm-line");
    expect(lines.length).toBeGreaterThanOrEqual(3);
    const active = container.querySelector(".cm-activeLine");
    expect(active?.textContent).toBe("third line");
  });

  it("no-ops when initialSourceOffset is 0 or missing", () => {
    const value = "first line\nsecond line\n";
    const { container } = render(<Editor value={value} onChange={() => {}} theme="light" />);
    const active = container.querySelector(".cm-activeLine");
    // No scroll/selection effect → cursor stays at doc start.
    expect(active?.textContent).toBe("first line");
  });
});
