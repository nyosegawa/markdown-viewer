import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const tauriMocks = vi.hoisted(() => ({
  isTauri: vi.fn(() => false),
  invokeReadMarkdown: vi.fn(),
  invokeWatchFile: vi.fn(async () => undefined),
  invokeUnwatchFile: vi.fn(async () => undefined),
  listenFileChanged: vi.fn(async () => () => {}),
  listenOpenFile: vi.fn(async () => () => {}),
  listenDragDrop: vi.fn(async () => () => {}),
  openFileDialog: vi.fn(async () => null as string | null),
  getCliPath: vi.fn(async () => null as string | null),
  setNativeTheme: vi.fn(async () => undefined),
}));

vi.mock("@/lib/tauri", () => tauriMocks);

// Avoid loading Shiki/Highlight core in unit tests.
vi.mock("@/lib/markdown", async () => {
  const actual = await vi.importActual<typeof import("@/lib/markdown")>("@/lib/markdown");
  return { ...actual, MarkdownRenderer: actual.SyncMarkdownRenderer };
});

import App from "./App";

describe("App", () => {
  beforeEach(() => {
    Object.values(tauriMocks).forEach((m) => {
      if (typeof m === "function" && "mockClear" in m) m.mockClear();
    });
    tauriMocks.openFileDialog.mockResolvedValue(null);
    tauriMocks.getCliPath.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the empty state until a file is opened", () => {
    render(<App />);
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });

  it("Open button invokes openFileDialog", async () => {
    render(<App />);
    await userEvent.click(screen.getByTestId("open-btn"));
    expect(tauriMocks.openFileDialog).toHaveBeenCalled();
  });

  it("Cmd+O also triggers openFileDialog", async () => {
    render(<App />);
    await act(async () => {
      await userEvent.keyboard("{Meta>}o{/Meta}");
    });
    expect(tauriMocks.openFileDialog).toHaveBeenCalled();
  });

  it("successful dialog → reads file, adds to recent, shows markdown", async () => {
    tauriMocks.openFileDialog.mockResolvedValueOnce("/tmp/readme.md");
    tauriMocks.invokeReadMarkdown.mockResolvedValueOnce("# From disk\n");

    render(<App />);
    await userEvent.click(screen.getByTestId("open-btn"));

    const heading = await screen.findByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("From disk");
    expect(screen.getByTestId("title").textContent).toBe("readme.md");
  });

  it("Escape in edit mode returns to view mode", async () => {
    tauriMocks.openFileDialog.mockResolvedValueOnce("/tmp/x.md");
    tauriMocks.invokeReadMarkdown.mockResolvedValueOnce("body");

    render(<App />);
    await userEvent.click(screen.getByTestId("open-btn"));
    await screen.findByTestId("markdown-body");

    const modeBtn = screen.getByTestId("mode-btn");
    await userEvent.click(modeBtn);
    expect(modeBtn).toHaveTextContent("Viewing");

    await act(async () => {
      await userEvent.keyboard("{Escape}");
    });
    expect(modeBtn).toHaveTextContent("Edit");
  });
});
