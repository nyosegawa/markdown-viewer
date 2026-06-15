# Scope

- Feature: PDF output toolbar button and Command+P shortcut.
- Slug: `pdf-export-button`.
- User request: Put a PDF output button to the right of the Markdown copy button and support Command+P.
- Artifact directory: `/Users/sakasegawa/src/github.com/nyosegawa/markdown-viewer/.agent-work/features/2026-06-15-pdf-export-button`.

# Freshness Check

- Command: `node .agents/skills/markdown-viewer-feature-planning/scripts/check-freshness.mjs`
- Result: Targeted refresh required; watched inputs changed since the manifest.
- Changed watched inputs: `src/App.tsx`, `src/hooks/useTabs.ts`, `src/lib/tauri.ts`, `src-tauri/src/commands.rs`, `src-tauri/src/lib.rs`, and `docs/adr/*.md` because ADR 0006 was added.
- Refresh decision: Targeted refresh only. The changes refine edit-mode autosave and source-copy behavior but do not replace the app architecture, build system, or CI.
- Manifest update: Completed after the targeted `repo-research-summary.md` refresh.

# Branch Setup

- Branch: `codex/pdf-export-button-plan`
- Branch source: Created from clean `main`.
- Remote: `origin ssh://git@github.com/nyosegawa/markdown-viewer.git`
- Worktree safety: Clean before planning branch creation.
- Blockers: None at planning time.

# Investigation Method

- Repo-local research: Inspected toolbar, app command wiring, shortcut hook, shortcut labels, app tests, shortcut tests, styles, ADR 0006, and planning-skill references/templates.
- Web/current-state research: Used MDN for `window.print()` and CSS print media guidance.
- Subagents: Not used; this is a narrow UI command plan and local inspection was sufficient.
- Assumptions: "pdfで出力" means opening the native print/PDF dialog, not silently generating a PDF file to disk.

# Subagent Rounds

- Round 1: Not used.
- Round 2: Not used.
- Round 3: Not used.

# Sources Inspected

- Repo files: `AGENTS.md`, `src/App.tsx`, `src/components/Toolbar.tsx`, `src/hooks/useKeyboardShortcuts.ts`, `src/lib/platform.ts`, `src/App.test.tsx`, `src/hooks/useKeyboardShortcuts.test.tsx`, `src/styles/index.css`, `src/styles/markdown.css`, `docs/adr/0006-edit-mode-autosave.md`.
- Commands: `git status --short --branch`, `git remote -v`, `date +%F`, freshness checker.
- Web/current-state sources: MDN `Window.print()`, MDN CSS printing guide.
- Sources intentionally skipped: Tauri native print APIs; no repo dependency currently points to a native PDF export surface, and the request maps cleanly to browser print.

# Findings

- `Toolbar` already places `Copy markdown source` in the right-side command group before the edit-mode toggle.
- `App` owns `activeTab.source` and already passes `onCopySource` into `Toolbar`.
- `useKeyboardShortcuts` owns global shortcuts and intentionally skips most shortcuts while focus is in form fields.
- `TAB_SHORTCUTS` centralizes shortcut labels used by UI/help, but print is not currently represented.
- No current PDF/print code exists.

# Repo Guidance Findings

- Do not edit protected harness/config files.
- Required implementation gate remains `npm run test:run && (cd src-tauri && cargo test --lib)`.
- For user-facing app changes, plan for Tauri build, replacing `/Applications/markdown-viewer.app`, installed app launch verification, push, and GitHub Actions follow-through unless explicitly waived.

# Architecture / Boundary Findings

- The cleanest implementation is frontend-only: add a print/PDF command in `App`, pass it to `Toolbar`, and call `window.print()`.
- Print/PDF layout should be controlled with `@media print` and optionally `@page` CSS, hiding app chrome and printing only the active rendered Markdown.
- Command+P should route through `useKeyboardShortcuts`, prevent the default browser/webview print shortcut, and call the same handler as the toolbar button.
- Edit mode needs an explicit decision: either print the rendered preview by temporarily switching to view mode or disable/route print only when an active ready tab exists. Prefer "print current active document as rendered Markdown"; if implementation cannot render cleanly from edit mode, escalate before shipping.

# Validation / CI Findings

- Unit coverage should include toolbar button placement/availability, `window.print()` invocation, Command+P handling, and form-field behavior.
- Existing tests use Vitest and Testing Library with mocked Tauri and clipboard APIs; `window.print` can be spied/mocked similarly.
- CSS print changes require manual or browser-assisted visual verification beyond unit tests.

# Existing Skill / Command Findings

- Planning artifacts must stay under `.agent-work/features/2026-06-15-pdf-export-button/`.
- `goal-prompt.md` must stay under 4000 characters and point to these artifacts instead of restating everything.

# Web / Current-State Findings

- Used: MDN `Window.print()` states it opens the print dialog for the current document.
- Used: MDN CSS printing guide recommends `@media print` and `@page` to control paper/PDF output styles.
- Skipped reason: No additional live dependency research was needed because this plan uses standard browser APIs and existing CSS.

# Freshness / Staleness Findings

- The old repo summary was stale on edit-mode persistence. It was targeted-refreshed to reflect ADR 0006 autosave and the relevant toolbar/source-copy statement.
- No structural refresh was needed.

# Generated / Vendored / Protected File Findings

- Do not edit `biome.json`, `lefthook.yml`, `tsconfig.json`, `.github/workflows/*.yml`, `.claude/settings.json`, or `src-tauri/Cargo.toml`.
- Do not touch generated outputs such as `dist/` or `src-tauri/target/`.

# Risks

- `Command+P` may already be intercepted by the WebView/native shell on some platforms; implementation must verify the app-level handler works.
- Print CSS can accidentally include toolbar/tabs/empty state or clip rendered Markdown.
- "PDF output" could be interpreted as direct file generation, which this plan intentionally does not implement.

# Decisions

- Add a PDF/print icon button immediately to the right of `Copy markdown source`.
- Use `window.print()` for output, relying on the OS print dialog's PDF save path.
- Add print-specific CSS so the active rendered Markdown is the printable surface.
- Keep all behavior in the frontend; no Tauri IPC or Rust command is planned.

# Rejected Approaches

- Add Rust-side PDF generation: too much scope, new dependencies, and not aligned with the thin IPC boundary.
- Use a hidden iframe or duplicate renderer: unnecessary unless whole-window print cannot be made correct with CSS.
- Print Markdown source text: conflicts with the user's PDF output intent and the app's rendered-view purpose.

# Remaining Unknowns

- Whether edit-mode print should force a view render, temporarily switch modes, or require View mode. This should be resolved during implementation with UX and test evidence.
