import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MermaidDiagram } from "./MermaidDiagram";

const mermaidMock = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn(async (_id: string, _source: string) => ({
    svg: '<svg viewBox="0 0 120 40"><text>rendered diagram</text></svg>',
    bindFunctions: vi.fn(),
  })),
}));

vi.mock("mermaid", () => ({
  default: mermaidMock,
}));

describe("MermaidDiagram", () => {
  it("renders mermaid source to SVG and exposes a PDF readiness status", async () => {
    render(<MermaidDiagram source={"graph TD\n  A[Start] --> B[Done]"} />);

    expect(document.querySelector(".mermaid-fallback")?.textContent).toContain("graph TD");

    await waitFor(() => {
      expect(document.querySelector(".mermaid-diagram svg")).not.toBeNull();
    });

    expect(document.querySelector(".mermaid-diagram text")?.textContent).toBe("rendered diagram");
    expect(mermaidMock.initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        startOnLoad: false,
        securityLevel: "strict",
      }),
    );
    expect(mermaidMock.render).toHaveBeenCalledWith(
      expect.stringMatching(/^mermaid-/),
      "graph TD\n  A[Start] --> B[Done]",
      expect.any(HTMLDivElement),
    );
    expect(document.querySelector(".mermaid-diagram")).toHaveAttribute(
      "data-mermaid-status",
      "rendered",
    );
  });
});
