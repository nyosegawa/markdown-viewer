import { afterEach, describe, expect, it, vi } from "vitest";
import {
  drainPendingOpenFiles,
  getCliPath,
  invokeReadMarkdown,
  invokeRevealInFileManager,
  invokeUnwatchFile,
  invokeWatchFile,
  isTauri,
  listenDragDrop,
  listenFileChanged,
  listenOpenFile,
  openFileDialog,
  setNativeTheme,
} from "./tauri";

describe("lib/tauri stubs in non-Tauri env", () => {
  afterEach(() => {
    // happy-dom doesn't define __TAURI_INTERNALS__, but make sure
    // nothing we do here leaks.
    // biome-ignore lint/suspicious/noExplicitAny: test-only global probe.
    delete (window as any).__TAURI_INTERNALS__;
    vi.restoreAllMocks();
  });

  it("isTauri returns false outside Tauri", () => {
    expect(isTauri()).toBe(false);
  });

  it("invokeReadMarkdown throws with a helpful message", async () => {
    await expect(invokeReadMarkdown("/whatever.md")).rejects.toThrow(/Tauri runtime/);
  });

  it("invokeWatchFile / invokeUnwatchFile resolve to undefined silently", async () => {
    await expect(invokeWatchFile("/ignored.md")).resolves.toBeUndefined();
    await expect(invokeUnwatchFile()).resolves.toBeUndefined();
    await expect(invokeUnwatchFile("/ignored.md")).resolves.toBeUndefined();
  });

  it("invokeRevealInFileManager is a silent no-op outside Tauri", async () => {
    await expect(invokeRevealInFileManager("/ignored.md")).resolves.toBeUndefined();
  });

  it("listenFileChanged / listenOpenFile / listenDragDrop return a no-op unlisten", async () => {
    const unlistenA = await listenFileChanged(() => {});
    const unlistenB = await listenOpenFile(() => {});
    const unlistenC = await listenDragDrop(() => {});
    // Calling them must not throw.
    expect(() => unlistenA()).not.toThrow();
    expect(() => unlistenB()).not.toThrow();
    expect(() => unlistenC()).not.toThrow();
  });

  it("openFileDialog / getCliPath resolve to null", async () => {
    await expect(openFileDialog()).resolves.toBeNull();
    await expect(getCliPath()).resolves.toBeNull();
  });

  it("drainPendingOpenFiles resolves to an empty array outside Tauri", async () => {
    // The cold-start buffer only ever populates from Apple Events on a
    // packaged macOS build. In tests there's no Tauri runtime, so the
    // wrapper must short-circuit rather than throw — App.tsx awaits this
    // unconditionally on every startup.
    await expect(drainPendingOpenFiles()).resolves.toEqual([]);
  });

  it("setNativeTheme is a silent no-op", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(setNativeTheme("dark")).resolves.toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });
});
