# Summary

Add a toolbar button that copies the active tab's current markdown source to the clipboard. The button is global, works in both view and edit modes, and is disabled when no file is active.

# Background

The user first asked for a copy button in the editor, then clarified that it should be in the toolbar and not limited to editor mode. The app already supports copying active file paths from tabs/shortcuts and rewrites viewer selection copies to markdown source, but there is no one-click whole-document markdown copy action.

# Current State

`App` owns `activeTab.source` and updates it when `Editor` changes. `Toolbar` renders top-level app commands but does not currently expose a copy-document action. `handleCopyPath` in `App` already demonstrates the local clipboard pattern using `navigator.clipboard.writeText` with a logged failure path.

# Goals

- Add a toolbar copy button for the active markdown source.
- Make the button available in view and edit modes.
- Copy the current in-memory source for the active tab, not just the last disk-read source.
- Keep existing path-copy behavior unchanged.
- Add focused tests for toolbar behavior and app-level clipboard integration.

# Non-Goals

- Do not add disk save behavior.
- Do not change `Cmd/Ctrl+Shift+C` path-copy semantics.
- Do not change viewer selection copy behavior.
- Do not add Rust/Tauri clipboard IPC.
- Do not add toast/notification infrastructure unless the implementation can reuse an existing local pattern.

# Repo-Specific Constraints

- Protected files: do not edit `biome.json`, `lefthook.yml`, `tsconfig.json`, `.github/workflows/*.yml`, `.claude/settings.json`, or `src-tauri/Cargo.toml` lint sections.
- Frontend/backend boundary: keep this feature in React; Rust remains limited to file IO, watch, and open events.
- View/edit persistence: view mode remains default, edit mode remains opt-in, and source edits remain in memory.
- Validation: `npm run test:run && (cd src-tauri && cargo test --lib)` must pass before declaring implementation done.
- User-facing app release/install expectations: after implementation, run `npm run tauri build`, replace `/Applications/markdown-viewer.app`, and verify launch unless explicitly waived.

# Design Decisions

- Add an optional `onCopySource` callback or equivalent explicit prop to `Toolbar`.
- Render the copy button in the existing right-side `.toolbar-group`, near mode/theme/help controls.
- Disable the button when `path === null` or no active tab is available.
- Implement the action in `App` using `activeTab.source` and `navigator.clipboard.writeText`.
- Use a copy/document icon consistent with existing inline toolbar SVG style unless the repo adds an icon library before implementation.
- Use title/aria-label text that distinguishes the action from path copy, preferably `Copy markdown source`.
- Catch clipboard write failures and log a concise warning, matching `handleCopyPath`.

# Impacted Areas

- `src/App.tsx`: add source-copy handler and pass it to `Toolbar`.
- `src/components/Toolbar.tsx`: add prop, icon, button, disabled state, accessible name, and test id.
- `src/components/Toolbar.test.tsx`: add button render/click/disabled tests.
- `src/App.test.tsx`: stub clipboard and verify active source copy.
- `src/styles/index.css`: only if existing toolbar styles are insufficient; preserve stable icon button dimensions.

# Validation Plan

- Minimum required:
  - `npm run test:run`
  - `(cd src-tauri && cargo test --lib)`
- Frontend:
  - `npm run lint`
  - `npm run typecheck`
  - targeted Vitest during development, then full `npm run test:run`
- Rust:
  - no Rust changes expected, but run Rust lib tests per repo rule.
- E2E:
  - not required for the first implementation unless unit tests cannot cover the user-facing behavior.
- Build/install/launch:
  - `npm run tauri build`
  - replace `/Applications/markdown-viewer.app` with the generated release app.
  - launch the installed app and verify it opens.

# Commit, PR, And CI Plan

- Commit: one implementation commit after validation and review, for example `Add toolbar markdown copy button`.
- Push: push the branch after commit.
- PR: create a PR if this is not already being implemented directly on the intended branch.
- CI follow-through: watch the pushed GitHub Actions run to success or concrete failure; fix in-scope failures.

# Risks

- Users may confuse document/source copy with path copy unless the title and icon are clear.
- Clipboard API may be unavailable in some test/runtime contexts; guard the call and test the supported path with stubs.
- Copying in edit mode must use React tab state, not CodeMirror DOM content, otherwise unsaved edits could be missed.
- Toolbar width may become tight; use existing icon-button sizing and avoid text labels.

# Completion Criteria

- Toolbar shows a copy button when an active file exists and disables it otherwise.
- Clicking the button copies the active tab's current markdown source in view mode.
- Clicking the button after edit-mode changes copies the edited in-memory source.
- Existing path-copy shortcut/menu behavior still works.
- Required tests and validation commands pass.
- User-facing build/install/launch verification is completed or a user-approved exception is recorded.

# Open Questions

- Exact user-facing label: recommended default is `Copy markdown source`.
- Whether copied/error visual feedback is desired; this plan treats it as out of scope for the initial version.
