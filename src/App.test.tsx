import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const tauriMocks = vi.hoisted(() => ({
  isTauri: vi.fn(() => false),
  invokeReadMarkdown: vi.fn(),
  invokeWriteMarkdown: vi.fn(async () => undefined),
  invokeWatchFile: vi.fn(async () => undefined),
  invokeUnwatchFile: vi.fn(async () => undefined),
  listenFileChanged: vi.fn(async () => () => {}),
  listenOpenFile: vi.fn(async () => () => {}),
  listenDragDrop: vi.fn(async () => () => {}),
  openFileDialog: vi.fn(async () => null as string | null),
  getCliPath: vi.fn(async () => null as string | null),
  drainPendingOpenFiles: vi.fn(async () => [] as string[]),
  setNativeTheme: vi.fn(async () => undefined),
}));

vi.mock("@/lib/tauri", () => tauriMocks);

// Avoid loading Shiki/Highlight core in unit tests.
vi.mock("@/lib/markdown", async () => {
  const actual = await vi.importActual<typeof import("@/lib/markdown")>("@/lib/markdown");
  return { ...actual, MarkdownRenderer: actual.SyncMarkdownRenderer };
});

vi.mock("@/components/Editor", () => ({
  Editor: ({ value, onChange }: { value: string; onChange: (next: string) => void }) => (
    <textarea
      aria-label="Mock markdown editor"
      data-testid="mock-editor"
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
    />
  ),
}));

import App from "./App";

describe("App", () => {
  let clipboardWriteText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    Object.values(tauriMocks).forEach((m) => {
      if (typeof m === "function" && "mockClear" in m) m.mockClear();
    });
    tauriMocks.openFileDialog.mockResolvedValue(null);
    tauriMocks.getCliPath.mockResolvedValue(null);
    tauriMocks.drainPendingOpenFiles.mockResolvedValue([]);
    clipboardWriteText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: clipboardWriteText },
    });
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

  it("copies the active markdown source from the toolbar in view mode", async () => {
    tauriMocks.openFileDialog.mockResolvedValueOnce("/tmp/readme.md");
    tauriMocks.invokeReadMarkdown.mockResolvedValueOnce("# From disk\n");

    render(<App />);
    await userEvent.click(screen.getByTestId("open-btn"));
    await screen.findByRole("heading", { level: 1, name: "From disk" });

    await userEvent.click(screen.getByRole("button", { name: "Copy markdown source" }));
    expect(clipboardWriteText).toHaveBeenCalledWith("# From disk\n");
  });

  it("copies in-memory edit mode source from the toolbar", async () => {
    tauriMocks.openFileDialog.mockResolvedValueOnce("/tmp/readme.md");
    tauriMocks.invokeReadMarkdown.mockResolvedValueOnce("# From disk\n");

    render(<App />);
    await userEvent.click(screen.getByTestId("open-btn"));
    await screen.findByRole("heading", { level: 1, name: "From disk" });

    await userEvent.click(screen.getByTestId("mode-btn"));
    await userEvent.clear(screen.getByTestId("mock-editor"));
    await userEvent.type(screen.getByTestId("mock-editor"), "edited source");
    await userEvent.click(screen.getByRole("button", { name: "Copy markdown source" }));

    expect(clipboardWriteText).toHaveBeenLastCalledWith("edited source");
  });

  it("opens any path stashed by Apple Events before the listener was wired up", async () => {
    // Simulates a cold-launch double-click: Tauri buffers the path on the
    // Rust side because `RunEvent::Opened` fires before the React tree
    // mounts. Once tab restoration finishes, App.tsx must drain the buffer
    // and open every path through the same handler the dialog uses.
    tauriMocks.drainPendingOpenFiles.mockResolvedValueOnce(["/tmp/cold-launched.md"]);
    tauriMocks.invokeReadMarkdown.mockResolvedValueOnce("# Cold launched\n");

    render(<App />);

    // The empty state's "Markdown Viewer" h1 paints first, so query by name
    // rather than role+level — we want the h1 that the drained file produced.
    expect(
      await screen.findByRole("heading", { level: 1, name: "Cold launched" }),
    ).toBeInTheDocument();
    expect(tauriMocks.drainPendingOpenFiles).toHaveBeenCalled();
    expect(tauriMocks.invokeReadMarkdown).toHaveBeenCalledWith("/tmp/cold-launched.md");
  });

  it("Escape in edit mode returns to view mode", async () => {
    tauriMocks.openFileDialog.mockResolvedValueOnce("/tmp/x.md");
    tauriMocks.invokeReadMarkdown.mockResolvedValueOnce("body");

    render(<App />);
    await userEvent.click(screen.getByTestId("open-btn"));
    await screen.findByTestId("markdown-body");

    const modeBtn = screen.getByTestId("mode-btn");
    await userEvent.click(modeBtn);
    expect(modeBtn).toHaveAccessibleName("Switch to view mode");

    await act(async () => {
      await userEvent.keyboard("{Escape}");
    });
    expect(modeBtn).toHaveAccessibleName("Switch to edit mode");
  });
});
