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

export async function invokeUnwatchFile(): Promise<void> {
  if (!isTauri()) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("unwatch_file");
}

export async function listenFileChanged(handler: (path: string) => void): Promise<UnlistenFn> {
  if (!isTauri()) return () => undefined;
  const { listen } = await import("@tauri-apps/api/event");
  return listen<{ path: string }>("file-changed", (event) => {
    handler(event.payload.path);
  });
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
