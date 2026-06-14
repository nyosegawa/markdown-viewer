# Summary

Fix three related editing lifecycle problems: normal view-mode selection should copy rendered plain text, edit mode should autosave to disk, and changes made by other editors should appear promptly without corrupting local drafts.

# Background

The app started as view-first. ADR 0003 intentionally kept edits in memory, and ADR 0005 made disk changes the source of truth for live tab refresh. The new request changes that contract: edit mode becomes a real disk-writing mode. That requires a small but explicit architecture update, not just wiring a write call into the editor.

# Current State

- `Viewer.tsx` intercepts copy and writes a Markdown source slice to the clipboard.
- `Editor.tsx` reports text changes upward, but `useTabs` only stores them in memory.
- Rust exposes `read_markdown`, `rename_markdown`, watch/unwatch, path metadata, and reveal commands; no write command exists.
- `useTabs` listens for `file-changed` and blindly replaces matching tab source after re-reading.
- Tab state has no dirty/save/conflict metadata.

# Goals

- View mode normal selection copy produces user-visible text, not Markdown syntax.
- Copied view text preserves meaningful line breaks across paragraphs, headings, lists, and code blocks.
- Edit mode autosaves to the backing file without requiring a manual save command.
- Autosave is debounced, reports failures, and keeps local edits when saving fails.
- External changes from other editors refresh open tabs quickly.
- Self-save watcher events do not cause flicker, stale overwrites, or cursor disruption.
- Local unsaved drafts are not silently overwritten by external changes.

# Non-Goals

- Full collaborative merge UI.
- Manual Save/Save As workflow.
- Persisting edits for error tabs or untitled documents.
- Moving Markdown parsing/rendering to Rust.
- Changing protected harness/config files.

# Repo-Specific Constraints

- Protected files: do not edit `biome.json`, `lefthook.yml`, `tsconfig.json`, `.github/workflows/*.yml`, `.claude/settings.json`, or protected Cargo lint config.
- Frontend/backend boundary: Rust performs thin file IO/watch commands; frontend owns debounce, dirty state, conflict policy, and Markdown rendering.
- View/edit persistence: Add or update an ADR before introducing disk writes from edit mode.
- Validation: `npm run test:run && (cd src-tauri && cargo test --lib)` is the minimum gate.
- User-facing app release/install expectations: after implementation, run full relevant validation, `npm run tauri build`, replace `/Applications/markdown-viewer.app`, verify launch, commit, push, and watch GitHub Actions unless explicitly waived.

# Design Decisions

1. Replace view copy-as-Markdown with rendered plain text.
   Remove the current `rangeToSourceSlice` copy override. Prefer native browser copy if it preserves line breaks acceptably in tests. If not, keep a copy handler that extracts text from rendered DOM blocks and writes plain `text/plain` only.

2. Keep explicit source copy separate.
   Toolbar copy may continue copying Markdown source as an explicit action. Its label/title should remain unambiguous.

3. Add ADR for autosave.
   Create a new ADR superseding the disk-write part of ADR 0003: edit mode is opt-in, autosaves the opened file, and conflict policy is conservative.

4. Add thin write IPC.
   Implement `write_markdown(path, source)` in Rust and `invokeWriteMarkdown(path, source)` in TS. Do not put save policy in Rust.

5. Centralize save lifecycle in `useTabs`.
   Extend `Tab` with save metadata such as `savedSource`, `dirty`, `saveStatus`, `lastSaveError`, `lastWrittenSource`, and a monotonically increasing save/read generation. `setActiveSource` marks dirty and schedules autosave.

6. Reconcile watcher events deliberately.
   On `file-changed`, re-read with a request token. If content equals this app's last successful write, mark clean and avoid unnecessary editor replacement. If tab is clean, apply the external source. If tab is dirty and external content differs, preserve local draft and surface conflict state.

7. Make refresh robust against editor write patterns.
   Keep Rust watcher broad enough for modify/create/rename. In frontend, coalesce file-changed events per path and optionally retry reads briefly when the first read returns old content or fails transiently.

# Impacted Areas

- `docs/adr/`
- `src-tauri/src/commands.rs`
- `src-tauri/src/lib.rs`
- `src/lib/tauri.ts`
- `src/hooks/useTabs.ts`
- `src/components/Editor.tsx`
- `src/components/viewer/Viewer.tsx`
- `src/components/Toolbar.tsx` if save/conflict status or copy labels need UI updates
- Tests under `src/**/*.test.tsx`, `src/**/*.test.ts`, and Rust unit tests

# Validation Plan

- Minimum required: `npm run test:run && (cd src-tauri && cargo test --lib)`.
- Frontend: update Vitest coverage for rendered text copy, autosave debounce/write success/failure, external refresh, dirty conflict, and stale async read/write ordering.
- Rust: add unit tests for `write_markdown`, including UTF-8 and overwrite behavior.
- E2E: add or manually perform a Tauri smoke path opening a file, editing, verifying disk content, editing via another process, and verifying UI refresh.
- Build/install/launch: run `npm run tauri build`, replace `/Applications/markdown-viewer.app`, and verify installed app launch.

# Commit, PR, And CI Plan

- Commit: one planning commit now; implementation should use phase commits where practical.
- Push: push `codex/editor-save-watch-plan` after planning and after implementation commits.
- PR: create a PR after implementation validation, summarizing ADR change, UX behavior, tests, and app install verification.
- CI follow-through: watch GitHub Actions to success/failure; fix in-scope failures and repeat.

# Risks

- Autosave changes an accepted ADR and could surprise users who expected scratch edits. Mitigate with a new ADR and clear opt-in edit-mode semantics.
- Race conditions between save writes and watcher reads can regress data integrity. Mitigate with generation tokens and source equality checks.
- Conflict UI can grow too large. Start with a minimal visible conflict state and avoid silent overwrite.
- Native copy behavior may not preserve enough line breaks. Validate with DOM tests and add a small rendered-text serializer only if needed.

# Completion Criteria

- View selection copy no longer includes Markdown syntax such as `**bold**` unless the rendered text itself contains it.
- Multi-block view selection preserves meaningful newlines in clipboard text.
- Edit changes are written to disk automatically after debounce.
- Save errors are visible and local edits remain intact.
- External edits refresh clean tabs quickly.
- Dirty local drafts are not silently overwritten by external edits.
- Unit/Rust tests pass, build/install/launch are verified, pushed CI has a concrete result.

# Open Questions

- Autosave debounce duration: default to 300-500ms unless implementation evidence suggests otherwise.
- Toolbar source-copy wording: keep as-is if explicit enough; adjust only if UX review finds ambiguity.
- Conflict recovery actions: minimal first pass can expose status and keep draft; a richer accept/reload UI can be follow-up if needed.
