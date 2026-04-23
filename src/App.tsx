import { useCallback, useEffect, useState } from "react";
import { DropZone } from "@/components/DropZone";
import { Editor } from "@/components/Editor";
import { Toolbar, type ViewMode } from "@/components/Toolbar";
import { Viewer } from "@/components/Viewer";
import { useMarkdownFile } from "@/hooks/useMarkdownFile";
import { useRecentFiles } from "@/hooks/useRecentFiles";
import { useTheme } from "@/hooks/useTheme";
import { getCliPath, openFileDialog } from "@/lib/tauri";

function App() {
  const { theme, toggleTheme } = useTheme();
  const { file, openPath, setInlineSource } = useMarkdownFile();
  const { recent, addRecent, clearRecent } = useRecentFiles();
  const [mode, setMode] = useState<ViewMode>("view");

  const handleOpenPath = useCallback(
    async (path: string) => {
      await openPath(path);
      addRecent(path);
      setMode("view");
    },
    [openPath, addRecent],
  );

  const handleOpenDialog = useCallback(async () => {
    const selected = await openFileDialog();
    if (selected) await handleOpenPath(selected);
  }, [handleOpenPath]);

  useEffect(() => {
    let cancelled = false;
    getCliPath()
      .then((path) => {
        if (!cancelled && path) void handleOpenPath(path);
      })
      .catch((err) => console.warn("cli path lookup failed", err));
    return () => {
      cancelled = true;
    };
  }, [handleOpenPath]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && mode === "edit") {
        setMode("view");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode]);

  const toggleMode = useCallback(() => {
    setMode((m) => (m === "view" ? "edit" : "view"));
  }, []);

  const onEditorChange = useCallback(
    (next: string) => {
      setInlineSource(next);
    },
    [setInlineSource],
  );

  const hasFile = file.path !== null;

  return (
    <div className="app-shell" data-testid="app-shell">
      <Toolbar
        path={file.path}
        mode={mode}
        onToggleMode={toggleMode}
        onOpen={handleOpenDialog}
        theme={theme}
        onToggleTheme={toggleTheme}
        recent={recent}
        onPickRecent={(p) => void handleOpenPath(p)}
        onClearRecent={clearRecent}
      />

      <main className="app-body" data-testid="app-body">
        <DropZone onDropPath={(p) => void handleOpenPath(p)} />

        {!hasFile && file.status !== "loading" ? (
          <div className="empty-state" data-testid="empty-state">
            <p>Drop a markdown file, click "Open", or pass one on the command line.</p>
          </div>
        ) : null}

        {hasFile && file.status === "error" ? (
          <div className="empty-state" data-testid="error-state">
            <p>Failed to open file.</p>
            <pre>{file.error}</pre>
          </div>
        ) : null}

        {hasFile && file.status !== "error" ? (
          mode === "edit" ? (
            <Editor value={file.source} onChange={onEditorChange} theme={theme} />
          ) : (
            <Viewer source={file.source} />
          )
        ) : null}
      </main>
    </div>
  );
}

export default App;
