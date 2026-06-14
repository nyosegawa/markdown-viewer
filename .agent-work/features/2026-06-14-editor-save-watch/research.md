# Scope

- Feature: Natural view-mode text copy, edit-mode autosave, and reliable live disk refresh.
- Slug: editor-save-watch
- User request: View mode should copy rendered text instead of Markdown source, preserving line breaks; edit mode should automatically save; external editor changes should reflect immediately; produce a beautiful design/implementation plan.
- Artifact directory: `.agent-work/features/2026-06-14-editor-save-watch/`

# Freshness Check

- Command: `node .agents/skills/markdown-viewer-feature-planning/scripts/check-freshness.mjs`
- Result: Fast freshness check passed. `ok: true`; git head `1193b6cc0cec1f32b6d5fa6e3678c8cbde3b83a1`; no watched input changes.
- Changed watched inputs: none.
- Refresh decision: Reuse existing repo research summary; inspect current feature-specific files directly.
- Manifest update: Not needed because watched inputs did not change.

# Branch Setup

- Branch: `codex/editor-save-watch-plan`
- Branch source: Created from clean `main`.
- Remote: `origin ssh://git@github.com/nyosegawa/markdown-viewer.git`
- Worktree safety: Clean before branch creation; only planning artifacts are intended changes.
- Blockers: none.

# Investigation Method

- Repo-local research: Read AGENTS, README, ADR 0003/0005, App/useTabs/Viewer/Editor/tauri wrappers/Rust commands/watcher, and relevant tests.
- Web/current-state research: Skipped. The plan depends on current repo code and established Tauri/notify behavior already represented in code, not external current facts.
- Subagents: Not used; current scope is bounded enough for direct inspection.
- Assumptions: Autosave is now intentionally allowed only if an ADR updates the previous "edits stay in memory" decision.

# Subagent Rounds

- Round 1: Not used.
- Round 2: Not used.
- Round 3: Not used.

# Sources Inspected

- Repo files: `AGENTS.md`, `README.md`, `docs/adr/0003-codemirror-for-edit-mode.md`, `docs/adr/0005-multi-file-tabs.md`, `src/App.tsx`, `src/hooks/useTabs.ts`, `src/components/viewer/Viewer.tsx`, `src/components/Editor.tsx`, `src/lib/tauri.ts`, `src-tauri/src/commands.rs`, `src-tauri/src/watcher.rs`, `src/hooks/useTabs.test.tsx`, `src/components/viewer/Viewer.test.tsx`, `src/App.test.tsx`, `src/components/Toolbar.tsx`.
- Commands: `rg ...`, `sed ...`, `git status --short --branch`, `git remote -v`, `date +%F`, freshness script.
- Web/current-state sources: none.
- Sources intentionally skipped: Build outputs and generated targets.

# Findings

- View-mode selection copy is currently intercepted in `Viewer.tsx`; it maps DOM selection to source offsets and writes Markdown source to `text/plain`. This directly causes unnatural copy ranges.
- Toolbar copy still copies the active source intentionally. The user's complaint appears to target normal selection copy in view mode, not necessarily the toolbar button.
- Edit mode currently calls `setActiveSource` only; no write IPC exists. ADR 0003 explicitly forbids disk persistence without a follow-up ADR.
- External changes are handled by a single `listenFileChanged` effect in `useTabs`; matching tabs are re-read and their `source` is replaced.
- The current model stores one mutable `source` per tab. That is too weak for autosave plus external refresh because local editor changes, successful disk writes, and external disk updates are indistinguishable.

# Repo Guidance Findings

- Do not edit protected harness/config files.
- Tauri IPC must stay thin: Rust reads/writes/watches files; Markdown-heavy work stays frontend-side.
- View mode is default and edit mode is opt-in.
- Disk writes require an explicit ADR because current guidance says not to persist edits without one.
- Required implementation completion gate: `npm run test:run && (cd src-tauri && cargo test --lib)`.
- User-facing app changes also require Tauri build, replacing `/Applications/markdown-viewer.app`, verifying launch, commit, push, and GitHub Actions follow-through unless waived.

# Architecture / Boundary Findings

- Add a thin Rust `write_markdown` command using async filesystem write; keep debounce/autosave policy in frontend.
- Add a frontend tauri wrapper for `write_markdown`.
- Evolve `Tab` state from plain `source` to explicit content/save metadata, likely including `source`, `savedSource`, `dirty`, `saveStatus`, `lastSaveError`, and a save generation/token.
- External refresh should update `source` only when the tab is not dirty or when the change is known to be the result of this app's own successful save. Dirty conflict handling must avoid silently overwriting user edits.
- Watcher currently sleeps 20ms and drains all pending events. That can be too aggressive for editors that write temp-file rename bursts or delayed flushes. A slightly more robust debounce/read retry belongs in the frontend around `file-changed`.

# Validation / CI Findings

- Existing unit coverage covers view copy-as-markdown, source copy toolbar, edit source state, and file-changed refresh.
- Tests must be updated to assert native rendered text copy behavior instead of Markdown source rewriting.
- New tests should cover autosave debounce, successful write status, write failure retention, file-changed reload, stale read race protection, own-save event de-duplication, and dirty external conflict behavior.
- Rust tests should cover `write_markdown` preserving UTF-8 and replacing file contents.

# Existing Skill / Command Findings

- Planning skill requires artifacts in `.agent-work/features/<date>-<slug>/`, validation via `validate-artifacts.mjs`, same branch for planning/implementation, and goal prompt under 4000 characters.
- No existing save command is present in `src/lib/tauri.ts` or `src-tauri/src/commands.rs`.

# Web / Current-State Findings

- Used: no.
- Skipped reason: Planning relies on local code, repo ADRs, and tests; no external or time-sensitive API choice is required.

# Freshness / Staleness Findings

- Stored repo research is still fresh per the skill script.
- ADR 0003 is now stale relative to the requested behavior and should be superseded/updated by a new ADR before implementing autosave.

# Generated / Vendored / Protected File Findings

- Do not edit `biome.json`, `lefthook.yml`, `tsconfig.json`, `.github/workflows/*.yml`, `.claude/settings.json`, or protected Cargo lint config.
- Avoid generated outputs: `dist/`, `src-tauri/target/`, release bundles.

# Risks

- Autosave can overwrite external editor changes if dirty state and write generations are not modeled explicitly.
- File watcher events can arrive before writes are fully flushed or can arrive multiple times per save.
- Editor dispatching full-document replacements on external refresh can disturb cursor/history if not gated carefully.
- Normal browser selection text may collapse Markdown block boundaries differently than desired; line-break preservation needs a focused DOM text extraction fallback if native copy is insufficient.

# Decisions

- Remove the view-mode copy-as-Markdown interception for normal selection copy.
- Preserve rendered-text line breaks by using native copy first; if tests show unacceptable paragraph/list/code block behavior, replace the handler with a rendered-text extraction helper that writes plain text only, never Markdown source.
- Keep toolbar source copy as an explicit command unless implementation review finds its label/behavior now conflicts with the new UX.
- Introduce a new autosave ADR and thin Rust write command.
- Implement autosave in `useTabs`, not `Editor`, so file lifecycle, tabs, watcher, save metadata, and conflict handling stay centralized.
- Treat external changes as authoritative only for clean tabs. For dirty tabs, preserve local draft and surface a conflict/error state instead of overwriting silently.

# Rejected Approaches

- Keep source-offset copy and tune selection granularity: rejected because the user explicitly wants text copy in view mode.
- Save on every keystroke with no debounce: rejected due to filesystem churn and watcher feedback loops.
- Put save logic inside CodeMirror `Editor`: rejected because it hides file path/watch/conflict state outside the tab lifecycle.
- Disable watcher while saving: rejected as fragile; save generations and read-back reconciliation are more explicit.

# Remaining Unknowns

- Exact autosave delay should be selected during implementation; recommended starting point is 300-500ms after the last edit.
- Whether the toolbar button should remain "Copy markdown source" or be renamed/split is a small UX decision for implementation review.
- Conflict UI can start minimal but should be visible enough that dirty local edits are not silently lost.
