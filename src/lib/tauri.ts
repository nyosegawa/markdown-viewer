/**
 * Thin wrappers around Tauri APIs. Detects a non-Tauri environment (tests,
 * browser preview) and returns no-op stubs so the React tree still renders.
 */

import type { UnlistenFn } from "@tauri-apps/api/event";

type TauriGlobal = {
  __TAURI_INTERNALS__?: unknown;
};

export const isTauri = (): boolean =>
  typeof window !== "undefined" && Boolean((window as unknown as TauriGlobal).__TAURI_INTERNALS__);

export async function invokeReadMarkdown(path: string): Promise<string> {
  if (!isTauri()) {
    throw new Error("Tauri runtime unavailable");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string>("read_markdown", { path });
}

export async function invokeWatchFile(path: string): Promise<void> {
  if (!isTauri()) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("watch_file", { path });
}

export async function invokeUnwatchFile(path?: string): Promise<void> {
  if (!isTauri()) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("unwatch_file", { path: path ?? null });
}

export async function invokeRevealInFileManager(path: string): Promise<void> {
  if (!isTauri()) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("reveal_in_file_manager", { path });
}

export interface PathMeta {
  exists: boolean;
  is_dir: boolean;
}

export async function invokePathMeta(path: string): Promise<PathMeta> {
  if (!isTauri()) return { exists: false, is_dir: false };
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<PathMeta>("path_meta", { path });
}

export async function invokeOpenWithSystem(path: string): Promise<void> {
  if (!isTauri()) return;
  const { openPath } = await import("@tauri-apps/plugin-opener");
  await openPath(path);
}

/**
 * Resolve `relative` against the directory containing `basePath`, using the
 * host OS's path semantics (separator, case rules). When `relative` is already
 * absolute, returns it unchanged.
 */
export async function resolveAgainstBase(basePath: string, relative: string): Promise<string> {
  if (!isTauri()) return relative;
  const { dirname, resolve } = await import("@tauri-apps/api/path");
  const dir = await dirname(basePath);
  return resolve(dir, relative);
}

export async function listenFileChanged(handler: (path: string) => void): Promise<UnlistenFn> {
  if (!isTauri()) return () => undefined;
  const { listen } = await import("@tauri-apps/api/event");
  return listen<{ path: string }>("file-changed", (event) => {
    handler(event.payload.path);
  });
}

export async function listenOpenFile(handler: (path: string) => void): Promise<UnlistenFn> {
  if (!isTauri()) return () => undefined;
  const { listen } = await import("@tauri-apps/api/event");
  return listen<string>("open-file", (event) => {
    if (event.payload) handler(event.payload);
  });
}

/**
 * Pulls any paths the OS dispatched to us via Apple Events (`open foo.md`,
 * Finder double-click) before the frontend was ready to receive `open-file`.
 * On cold launch the React tree mounts after `RunEvent::Opened` has already
 * fired, so the synchronous emit lands on zero listeners — the Rust side
 * also stashes each path in a buffer that this command drains.
 */
export async function drainPendingOpenFiles(): Promise<string[]> {
  if (!isTauri()) return [];
  const { invoke } = await import("@tauri-apps/api/core");
  try {
    return await invoke<string[]>("drain_pending_open_files");
  } catch (err) {
    console.warn("drain_pending_open_files failed", err);
    return [];
  }
}

export async function openFileDialog(): Promise<string | null> {
  if (!isTauri()) return null;
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({
    multiple: false,
    filters: [
      { name: "Markdown", extensions: ["md", "markdown", "mdx"] },
      { name: "Text", extensions: ["txt"] },
      { name: "All", extensions: ["*"] },
    ],
  });
  if (typeof selected === "string") return selected;
  return null;
}

export async function listenDragDrop(handler: (paths: string[]) => void): Promise<UnlistenFn> {
  if (!isTauri()) return () => undefined;
  const { getCurrentWebview } = await import("@tauri-apps/api/webview");
  return getCurrentWebview().onDragDropEvent((event) => {
    if (event.payload.type === "drop") {
      handler(event.payload.paths);
    }
  });
}

export async function setNativeTheme(theme: "light" | "dark"): Promise<void> {
  if (!isTauri()) return;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().setTheme(theme);
  } catch (err) {
    console.warn("setTheme failed", err);
  }
}

export async function getCliPath(): Promise<string | null> {
  if (!isTauri()) return null;
  const { getMatches } = await import("@tauri-apps/plugin-cli");
  try {
    const matches = await getMatches();
    const raw = matches.args?.path?.value;
    if (typeof raw === "string" && raw.length > 0) return raw;
  } catch (err) {
    console.warn("cli getMatches failed", err);
  }
  return null;
}
