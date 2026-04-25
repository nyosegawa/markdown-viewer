import { act, renderHook } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";

function makeHandlers() {
  return {
    onOpenDialog: vi.fn(),
    onCloseTab: vi.fn(),
    onCloseOthers: vi.fn(),
    onCloseAll: vi.fn(),
    onReopenClosed: vi.fn(),
    onNextTab: vi.fn(),
    onPrevTab: vi.fn(),
    onJumpToIndex: vi.fn(),
    onJumpToLast: vi.fn(),
    onCopyActivePath: vi.fn(),
    onRevealActiveInFileManager: vi.fn(),
    onShowHelp: vi.fn(),
    onEscape: vi.fn(),
  };
}

describe("useKeyboardShortcuts", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Ctrl+O fires onOpenDialog", async () => {
    const h = makeHandlers();
    renderHook(() => useKeyboardShortcuts(h));
    await act(async () => {
      await userEvent.keyboard("{Control>}o{/Control}");
    });
    expect(h.onOpenDialog).toHaveBeenCalled();
  });

  it("Cmd+W fires onCloseTab", async () => {
    const h = makeHandlers();
    renderHook(() => useKeyboardShortcuts(h));
    await act(async () => {
      await userEvent.keyboard("{Meta>}w{/Meta}");
    });
    expect(h.onCloseTab).toHaveBeenCalled();
    expect(h.onCloseOthers).not.toHaveBeenCalled();
    expect(h.onCloseAll).not.toHaveBeenCalled();
  });

  it("Cmd+Alt+W fires onCloseOthers (and not onCloseTab)", async () => {
    const h = makeHandlers();
    renderHook(() => useKeyboardShortcuts(h));
    await act(async () => {
      await userEvent.keyboard("{Meta>}{Alt>}w{/Alt}{/Meta}");
    });
    expect(h.onCloseOthers).toHaveBeenCalledTimes(1);
    expect(h.onCloseTab).not.toHaveBeenCalled();
  });

  it("Cmd+Shift+W fires onCloseAll (and not onCloseTab)", async () => {
    const h = makeHandlers();
    renderHook(() => useKeyboardShortcuts(h));
    await act(async () => {
      await userEvent.keyboard("{Meta>}{Shift>}w{/Shift}{/Meta}");
    });
    expect(h.onCloseAll).toHaveBeenCalledTimes(1);
    expect(h.onCloseTab).not.toHaveBeenCalled();
  });

  it("Cmd+Shift+C fires onCopyActivePath", async () => {
    const h = makeHandlers();
    renderHook(() => useKeyboardShortcuts(h));
    await act(async () => {
      await userEvent.keyboard("{Meta>}{Shift>}c{/Shift}{/Meta}");
    });
    expect(h.onCopyActivePath).toHaveBeenCalled();
  });

  it("Cmd+Shift+R fires onRevealActiveInFileManager", async () => {
    const h = makeHandlers();
    renderHook(() => useKeyboardShortcuts(h));
    await act(async () => {
      await userEvent.keyboard("{Meta>}{Shift>}r{/Shift}{/Meta}");
    });
    expect(h.onRevealActiveInFileManager).toHaveBeenCalled();
  });

  it("Ctrl+Tab fires onNextTab, Ctrl+Shift+Tab fires onPrevTab", async () => {
    const h = makeHandlers();
    renderHook(() => useKeyboardShortcuts(h));
    await act(async () => {
      await userEvent.keyboard("{Control>}{Tab}{/Control}");
    });
    expect(h.onNextTab).toHaveBeenCalledTimes(1);
    await act(async () => {
      await userEvent.keyboard("{Control>}{Shift>}{Tab}{/Shift}{/Control}");
    });
    expect(h.onPrevTab).toHaveBeenCalledTimes(1);
  });

  it("Cmd+Shift+T fires onReopenClosed", async () => {
    const h = makeHandlers();
    renderHook(() => useKeyboardShortcuts(h));
    await act(async () => {
      await userEvent.keyboard("{Meta>}{Shift>}t{/Shift}{/Meta}");
    });
    expect(h.onReopenClosed).toHaveBeenCalled();
  });

  it("Cmd+1 jumps to index 0, Cmd+9 jumps to last", async () => {
    const h = makeHandlers();
    renderHook(() => useKeyboardShortcuts(h));
    await act(async () => {
      await userEvent.keyboard("{Meta>}1{/Meta}");
    });
    expect(h.onJumpToIndex).toHaveBeenCalledWith(0);
    await act(async () => {
      await userEvent.keyboard("{Meta>}9{/Meta}");
    });
    expect(h.onJumpToLast).toHaveBeenCalled();
  });

  it("F1 fires onShowHelp", async () => {
    const h = makeHandlers();
    renderHook(() => useKeyboardShortcuts(h));
    await act(async () => {
      await userEvent.keyboard("{F1}");
    });
    expect(h.onShowHelp).toHaveBeenCalled();
  });

  it("Ctrl+/ fires onShowHelp (no shift needed)", async () => {
    const h = makeHandlers();
    renderHook(() => useKeyboardShortcuts(h));
    await act(async () => {
      await userEvent.keyboard("{Control>}/{/Control}");
    });
    expect(h.onShowHelp).toHaveBeenCalled();
  });

  it("Ctrl+? (shift+/) also fires onShowHelp as a legacy alias", async () => {
    const h = makeHandlers();
    renderHook(() => useKeyboardShortcuts(h));
    await act(async () => {
      await userEvent.keyboard("{Control>}{Shift>}/{/Shift}{/Control}");
    });
    expect(h.onShowHelp).toHaveBeenCalled();
  });

  it("bare Escape fires onEscape", async () => {
    const h = makeHandlers();
    renderHook(() => useKeyboardShortcuts(h));
    await act(async () => {
      await userEvent.keyboard("{Escape}");
    });
    expect(h.onEscape).toHaveBeenCalled();
  });

  it("skips shortcuts when focus is in an input (except help)", async () => {
    const h = makeHandlers();
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    renderHook(() => useKeyboardShortcuts(h));

    await act(async () => {
      await userEvent.keyboard("{Control>}o{/Control}");
    });
    expect(h.onOpenDialog).not.toHaveBeenCalled();

    // help still works because it's meant to rescue the user anywhere.
    await act(async () => {
      await userEvent.keyboard("{F1}");
    });
    expect(h.onShowHelp).toHaveBeenCalled();
  });
});
