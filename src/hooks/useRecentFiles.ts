import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "mdv.recentFiles";
const MAX_ENTRIES = 10;

function readStored(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string").slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

function persist(entries: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* ignore */
  }
}

export function useRecentFiles(): {
  recent: string[];
  addRecent: (path: string) => void;
  clearRecent: () => void;
} {
  const [recent, setRecent] = useState<string[]>(() => readStored());

  useEffect(() => {
    persist(recent);
  }, [recent]);

  const addRecent = useCallback((path: string) => {
    if (!path) return;
    setRecent((prev) => {
      const deduped = prev.filter((p) => p !== path);
      return [path, ...deduped].slice(0, MAX_ENTRIES);
    });
  }, []);

  const clearRecent = useCallback(() => {
    setRecent([]);
  }, []);

  return { recent, addRecent, clearRecent };
}

export const MAX_RECENT = MAX_ENTRIES;
