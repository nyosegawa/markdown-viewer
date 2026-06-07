# Scope

- Feature: Add a toolbar copy button for the active markdown document.
- Slug: `toolbar-copy-source`
- User request: `editorにコピーボタンを追加したい`, clarified as toolbar placement and not edit-mode limited.
- Artifact directory: `/Users/sakasegawa/src/github.com/nyosegawa/markdown-viewer/.agent-work/features/2026-06-07-toolbar-copy-source`

# Freshness Check

- Command: `node .agents/skills/markdown-viewer-feature-planning/scripts/check-freshness.mjs`
- Result: passed.
- Changed watched inputs: none.
- Refresh decision: no targeted refresh needed; fast freshness check passed.
- Manifest update: not needed.

# Investigation Method

- Repo-local research: inspected `src/App.tsx`, `src/components/Toolbar.tsx`, `src/components/Toolbar.test.tsx`, `src/App.test.tsx`, `src/lib/platform.ts`, and feature-planning references.
- Web/current-state research: skipped because this is a repo-local UI/API change and does not depend on external or time-sensitive facts.
- Subagents: not used because the change is narrow and local to existing toolbar/app state surfaces.
- Assumptions: the requested copy action should copy the active tab's current markdown source, including unsaved in-memory edits, in both view and edit modes.

# Subagent Rounds

- Round 1: not used; local inspection covered guidance, architecture, validation, and UI surfaces.
- Round 2: not used.
- Round 3: not used.

# Sources Inspected

- Repo files:
  - `/Users/sakasegawa/src/github.com/nyosegawa/markdown-viewer/AGENTS.md`
  - `/Users/sakasegawa/src/github.com/nyosegawa/markdown-viewer/src/App.tsx`
  - `/Users/sakasegawa/src/github.com/nyosegawa/markdown-viewer/src/components/Toolbar.tsx`
  - `/Users/sakasegawa/src/github.com/nyosegawa/markdown-viewer/src/components/Toolbar.test.tsx`
  - `/Users/sakasegawa/src/github.com/nyosegawa/markdown-viewer/src/App.test.tsx`
  - `/Users/sakasegawa/src/github.com/nyosegawa/markdown-viewer/src/lib/platform.ts`
  - `/Users/sakasegawa/src/github.com/nyosegawa/markdown-viewer/.agents/skills/markdown-viewer-feature-planning/references/*.md`
- Commands:
  - `rg -n "editor|Edit|copy|Clipboard|toolbar|textarea|CodeMirror|monaco" -S src package.json`
  - `rg --files src src-tauri docs`
  - `git status --short`
  - `node .agents/skills/markdown-viewer-feature-planning/scripts/check-freshness.mjs`
- Web/current-state sources: none.
- Sources intentionally skipped: browser/Tauri runtime smoke was skipped during planning because no implementation was performed.

# Findings

- `Toolbar` owns the top-level command buttons and already receives active `path`, `mode`, theme controls, recent-file controls, rename handler, and help handler.
- `App` owns the active tab and current `activeTab.source`, including edit-mode in-memory changes through `setActiveSource`.
- `App` already has `handleCopyPath`, which copies a file path through `navigator.clipboard.writeText`.
- `Tabs` already uses path copy behavior, and `TAB_SHORTCUTS.copyPath` maps `Cmd/Ctrl+Shift+C` to active-path copy.
- `Viewer` has a DOM `copy` handler that rewrites selected rendered text to original markdown source for selections, but it is not a toolbar whole-document copy action.

# Repo Guidance Findings

- Do not edit protected harness/config files.
- Minimum completion gate for implementation work is `npm run test:run && (cd src-tauri && cargo test --lib)`.
- User-facing app changes should also include `npm run tauri build`, installing `/Applications/markdown-viewer.app`, and launch verification unless waived.
- View mode remains default; edit mode is opt-in.
- Disk writes are out of scope.

# Architecture / Boundary Findings

- This feature belongs entirely in the frontend.
- No Rust/Tauri IPC change is needed because the active markdown source is already present in React state.
- `Toolbar` should receive a new optional callback/disabled state from `App`, rather than reading global app state itself.
- Copy should use the browser clipboard API from `App` or a small frontend helper, mirroring existing `handleCopyPath`.

# Validation / CI Findings

- Unit tests should cover:
  - toolbar renders a copy button when a copy handler is supplied.
  - copy button is disabled/no-op with no active file.
  - clicking the button from `App` writes the active source to `navigator.clipboard`.
  - copied source reflects current in-memory edits after switching to edit mode and changing the editor content if feasible in the test environment.
- Required final validation:
  - `npm run test:run`
  - `(cd src-tauri && cargo test --lib)`
- Recommended frontend validation:
  - `npm run lint`
  - `npm run typecheck`
- User-facing packaging validation:
  - `npm run tauri build`
  - replace `/Applications/markdown-viewer.app`
  - verify installed app launches.

# Existing Skill / Command Findings

- The feature-planning skill requires artifacts under `.agent-work/features/<date>-<slug>/`.
- Artifact validation command: `node .agents/skills/markdown-viewer-feature-planning/scripts/validate-artifacts.mjs .agent-work/features/2026-06-07-toolbar-copy-source`

# Web / Current-State Findings

- Used: no.
- Skipped reason: clipboard integration uses existing local frontend pattern and no external API/version decision is needed.

# Freshness / Staleness Findings

- The stored repo research was current enough for this plan; watched inputs did not change.
- The git head differed from the manifest base commit, but watched files/globs were unchanged, so no refresh was required.

# Generated / Vendored / Protected File Findings

- Do not edit `biome.json`, `lefthook.yml`, `tsconfig.json`, `.github/workflows/*.yml`, `.claude/settings.json`, or `src-tauri/Cargo.toml` lint sections.
- Do not touch generated outputs such as `dist/` or `src-tauri/target/`.
- Planning artifacts are intentionally under `.agent-work/features/2026-06-07-toolbar-copy-source/`.

# Risks

- Ambiguous label: existing `Cmd/Ctrl+Shift+C` copies the active path, so the new button must clearly represent document/source copying, not path copying.
- Clipboard failures can occur when permissions are unavailable; implementation should catch and log errors without crashing the app.
- Tests may need a stubbed `navigator.clipboard` because jsdom does not always provide it.
- A toolbar icon added to the right group may crowd the window on narrow widths; CSS should preserve stable button dimensions.

# Decisions

- Add the copy action to the global toolbar, not inside `Editor`.
- Make it available in both view and edit modes.
- Copy the active tab's current markdown source, including unsaved in-memory edits.
- Disable the button when no file/tab is active.
- Keep the existing active-path copy shortcut and tab menu behavior unchanged.

# Rejected Approaches

- Editor-only button: rejected by user clarification.
- Edit-mode-only copy: rejected by user clarification.
- Reusing `Cmd/Ctrl+Shift+C`: rejected because it already means copy active path.
- Rust IPC clipboard command: rejected because frontend state already contains the source and existing clipboard use is frontend-only.
- Copying rendered HTML/text in view mode: rejected because the app already has selection-copy handling; toolbar copy should be deterministic whole-document markdown.

# Remaining Unknowns

- Whether the final button label/title should be `Copy document`, `Copy markdown`, or `Copy source`.
- Whether the button should show transient copied/error feedback. The recommended first implementation can skip toast feedback unless the user asks for it.
