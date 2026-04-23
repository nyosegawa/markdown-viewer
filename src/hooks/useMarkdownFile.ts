import { useCallback, useEffect, useRef, useState } from "react";
import {
  invokeReadMarkdown,
  invokeUnwatchFile,
  invokeWatchFile,
  listenFileChanged,
} from "@/lib/tauri";

export interface OpenedFile {
  path: string | null;
  source: string;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
}

const EMPTY: OpenedFile = {
  path: null,
  source: "",
  status: "idle",
  error: null,
};

export function useMarkdownFile() {
  const [file, setFile] = useState<OpenedFile>(EMPTY);
  const unlistenRef = useRef<(() => void) | null>(null);

  const openPath = useCallback(async (path: string) => {
    setFile((prev) => ({ ...prev, status: "loading", path, error: null }));
    try {
      const source = await invokeReadMarkdown(path);
      setFile({ path, source, status: "ready", error: null });
      try {
        await invokeWatchFile(path);
      } catch (err) {
        console.warn("watch_file failed", err);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setFile({ path, source: "", status: "error", error: message });
    }
  }, []);

  const setInlineSource = useCallback((source: string) => {
    setFile((prev) => ({
      path: prev.path,
      source,
      status: "ready",
      error: null,
    }));
  }, []);

  const closeFile = useCallback(async () => {
    try {
      await invokeUnwatchFile();
    } catch {
      /* ignore */
    }
    setFile(EMPTY);
  }, []);

  useEffect(() => {
    let active = true;
    listenFileChanged((changedPath) => {
      setFile((prev) => {
        if (prev.path !== changedPath) return prev;
        // Fire and forget re-read.
        void invokeReadMarkdown(changedPath).then((source) => {
          if (!active) return;
          setFile((curr) => (curr.path === changedPath ? { ...curr, source } : curr));
        });
        return prev;
      });
    })
      .then((unlisten) => {
        if (!active) {
          unlisten();
          return;
        }
        unlistenRef.current = unlisten;
      })
      .catch((err) => console.warn("listen file-changed failed", err));

    return () => {
      active = false;
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    };
  }, []);

  return { file, openPath, setInlineSource, closeFile };
}
