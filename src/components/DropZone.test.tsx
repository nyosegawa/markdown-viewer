import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tauri", () => ({
  isTauri: () => false,
  listenDragDrop: vi.fn(async () => () => {}),
}));

import { DropZone } from "./DropZone";

describe("DropZone", () => {
  it("renders nothing (null subtree)", () => {
    const { container } = render(<DropZone onDropPath={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it("does not attach drag listeners outside Tauri", async () => {
    const { listenDragDrop } = await import("@/lib/tauri");
    render(<DropZone onDropPath={() => {}} />);
    expect(listenDragDrop).not.toHaveBeenCalled();
  });
});
