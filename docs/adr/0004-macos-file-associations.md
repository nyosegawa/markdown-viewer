# 0004 — macOS file associations and the `open-file` event

- Status: accepted
- Date: 2026-04-23

## Context

Users expect to double-click a `.md` in Finder (or run `open foo.md`) and land in `markdown-viewer`. The `tauri-plugin-cli` plugin covers plain argv paths, but macOS Launch Services does **not** pass double-clicked or `open`-ed files via argv — it dispatches an Apple Event to the running process instead.

## Decision

1. `tauri.conf.json → bundle.fileAssociations` declares `.md` / `.markdown` / `.mdx` as `Viewer` associations with `text/markdown` MIME, so the tauri-cli bundler writes `CFBundleDocumentTypes` into the generated `Info.plist`.
2. `src-tauri/src/lib.rs` switches from the single-call `.run(generate_context!())` form to `.build(...)` + `.run(|app, event| ...)` so we can pattern-match `RunEvent::Opened { urls }`, convert each URL to a filesystem path, and emit it to the frontend as the `open-file` event.
3. The frontend (`App.tsx` → `listenOpenFile`) subscribes to `open-file` and feeds the path through the same `handleOpenPath` flow used by drag-drop / dialog / CLI, so all four entry points converge on a single code path.
4. Cold launch fires `RunEvent::Opened` before the React tree mounts, so the synchronous emit reaches no listeners. We additionally buffer every URL in a managed `PendingOpenFiles` (`src-tauri/src/pending_open.rs`); after tab restoration the frontend invokes `drain_pending_open_files` and re-runs `handleOpenPath` for each entry. The live `listen("open-file")` subscription continues to handle hot-running double-clicks without going through the buffer.

## Consequences

- Local install wiring: once the `.app` is in `/Applications` and registered with `lsregister -f`, macOS dispatches file opens without argv. `duti -s com.nyosegawa.markdownviewer md all` (etc.) makes markdown-viewer the default handler.
- The Rust `run()` function is no longer a single fluent chain; future maintainers must remember that additional `RunEvent` variants should be handled in the same closure.
- Other platforms ignore `RunEvent::Opened` (Linux file managers typically pass argv, Windows uses `SHOpenWithDialog`/registry). The CLI plugin still covers those paths, so no behaviour regresses.
