import { useCallback, useEffect, useMemo, useState } from "react";
import { DropZone } from "@/components/DropZone";
import { Editor } from "@/components/Editor";
import { ShortcutsHelp } from "@/components/ShortcutsHelp";
import { Tabs } from "@/components/Tabs";
import { Toolbar } from "@/components/Toolbar";
import { Viewer } from "@/components/viewer";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useRecentFiles } from "@/hooks/useRecentFiles";
import { readStoredTabs, useTabPersistence } from "@/hooks/useTabPersistence";
import { useTabs } from "@/hooks/useTabs";
import { useTheme } from "@/hooks/useTheme";
import { getSrcOffset } from "@/lib/scroll-memory";
import { getCliPath, invokeRevealInFileManager, listenOpenFile, openFileDialog } from "@/lib/tauri";

function App() {
  const { theme, toggleTheme } = useTheme();
  const {
    tabs,
    activeId,
    activeTab,
    openPath,
    activate,
    activateIndex,
    activateLast,
    nextTab,
    prevTab,
    closeTab,
    closeOthers,
    closeRight,
    closeAll,
    reopenClosed,
    moveTab,
    toggleActiveMode,
    setActiveMode,
    setActiveSource,
  } = useTabs();
  const { recent, addRecent, clearRecent } = useRecentFiles();
  const [helpOpen, setHelpOpen] = useState(false);
  const [restored, setRestored] = useState(false);

  const handleOpenPath = useCallback(
    async (path: string) => {
      await openPath(path);
      addRecent(path);
    },
    [openPath, addRecent],
  );

  const handleOpenDialog = useCallback(async () => {
    const selected = await openFileDialog();
    if (selected) await handleOpenPath(selected);
  }, [handleOpenPath]);

  const handleCloseActive = useCallback(() => {
    if (activeId) void closeTab(activeId);
  }, [activeId, closeTab]);

  const handleCopyPath = useCallback((path: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(path).catch((err) => {
        console.warn("clipboard write failed", err);
      });
    }
  }, []);

  const handleReveal = useCallback((path: string) => {
    void invokeRevealInFileManager(path).catch((err) => {
      console.warn("reveal failed", err);
    });
  }, []);

  // Restore persisted tabs at startup (runs once, before CLI/open-file listeners
  // are allowed to add anything — those paths go into the restored set too).
  useEffect(() => {
    const stored = readStoredTabs();
    if (!stored) {
      setRestored(true);
      return;
    }
    let cancelled = false;
    (async () => {
      for (const p of stored.paths) {
        if (cancelled) return;
        await openPath(p);
      }
      if (!cancelled && stored.activeIndex >= 0) {
        activateIndex(stored.activeIndex);
      }
      if (!cancelled) setRestored(true);
    })().catch((err) => {
      console.warn("tab restore failed", err);
      if (!cancelled) setRestored(true);
    });
    return () => {
      cancelled = true;
    };
  }, [openPath, activateIndex]);

  // Once restoration is done, honour CLI path / macOS open-file events.
  useEffect(() => {
    if (!restored) return;
    let cancelled = false;
    getCliPath()
      .then((path) => {
        if (!cancelled && path) void handleOpenPath(path);
      })
      .catch((err) => console.warn("cli path lookup failed", err));
    return () => {
      cancelled = true;
    };
  }, [restored, handleOpenPath]);

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | null = null;
    listenOpenFile((path) => {
      if (active) void handleOpenPath(path);
    })
      .then((u) => {
        if (!active) {
          u();
          return;
        }
        unlisten = u;
      })
      .catch((err) => console.warn("open-file listener failed", err));
    return () => {
      active = false;
      if (unlisten) unlisten();
    };
  }, [handleOpenPath]);

  // Persist tab list (paths only) and active index.
  const persistedPaths = useMemo(() => tabs.map((t) => t.path), [tabs]);
  const persistedActiveIndex = useMemo(() => {
    if (activeId === null) return 0;
    const idx = tabs.findIndex((t) => t.id === activeId);
    return idx < 0 ? 0 : idx;
  }, [tabs, activeId]);
  useTabPersistence(persistedPaths, persistedActiveIndex);

  // Edit-mode Escape takes precedence over the global Esc handler.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (helpOpen) return; // ShortcutsHelp captures Esc itself.
      if (activeTab?.mode === "edit") {
        e.preventDefault();
        setActiveMode("view");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeTab, helpOpen, setActiveMode]);

  useKeyboardShortcuts({
    onOpenDialog: () => void handleOpenDialog(),
    onCloseTab: handleCloseActive,
    onReopenClosed: () => void reopenClosed(),
    onNextTab: nextTab,
    onPrevTab: prevTab,
    onJumpToIndex: activateIndex,
    onJumpToLast: activateLast,
    onShowHelp: () => setHelpOpen(true),
    onEscape: () => {
      if (helpOpen) setHelpOpen(false);
    },
  });

  const onEditorChange = useCallback(
    (next: string) => {
      setActiveSource(next);
    },
    [setActiveSource],
  );

  const hasTabs = tabs.length > 0;

  return (
    <div className="app-shell" data-testid="app-shell">
      <Toolbar
        path={activeTab?.path ?? null}
        mode={activeTab?.mode ?? "view"}
        onToggleMode={toggleActiveMode}
        onOpen={handleOpenDialog}
        theme={theme}
        onToggleTheme={toggleTheme}
        recent={recent}
        onPickRecent={(p) => void handleOpenPath(p)}
        onClearRecent={clearRecent}
        onShowHelp={() => setHelpOpen(true)}
      />

      {hasTabs ? (
        <Tabs
          tabs={tabs}
          activeId={activeId}
          onActivate={activate}
          onClose={(id) => void closeTab(id)}
          onCloseOthers={(id) => void closeOthers(id)}
          onCloseRight={(id) => void closeRight(id)}
          onCloseAll={() => void closeAll()}
          onCopyPath={handleCopyPath}
          onRevealInFileManager={handleReveal}
          onReorder={moveTab}
        />
      ) : null}

      <main className="app-body" data-testid="app-body">
        <DropZone onDropPath={(p) => void handleOpenPath(p)} />

        {!hasTabs ? (
          <div className="empty-state" data-testid="empty-state">
            <img src="/icon-mark.png" alt="" className="empty-state-mark" />
            <h1 className="empty-state-title">Markdown Viewer</h1>
            <p className="empty-state-hint">
              Drag a <code>.md</code> file here, open one from disk, or pass a path on the command
              line.
            </p>
            <button type="button" className="empty-state-cta" onClick={handleOpenDialog}>
              Open file…
            </button>
            <span className="empty-state-shortcut">
              <kbd>⌘</kbd>
              <kbd>O</kbd>
              <span>to open</span>
            </span>
          </div>
        ) : null}

        {activeTab && activeTab.status === "error" ? (
          <div className="error-state" data-testid="error-state">
            <strong>Failed to open file.</strong>
            <pre>{activeTab.error}</pre>
          </div>
        ) : null}

        {activeTab && activeTab.status !== "error" ? (
          activeTab.mode === "edit" ? (
            <Editor
              value={activeTab.source}
              onChange={onEditorChange}
              theme={theme}
              initialSourceOffset={getSrcOffset(activeTab.id)}
            />
          ) : (
            <Viewer source={activeTab.source} tabId={activeTab.id} />
          )
        ) : null}
      </main>

      <ShortcutsHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

export default App;
