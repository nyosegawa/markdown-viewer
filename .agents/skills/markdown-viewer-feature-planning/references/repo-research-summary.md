# Repo Research Summary

Last full research: 2026-06-07.

## Scope

This summary supports the `markdown-viewer-feature-planning` skill. It records repo-specific facts that future feature plans should rely on after a freshness check.

## Skill Location Decision

The repo has `.claude/` hooks/settings but no existing `.agents/skills/` or `.claude/skills/` directory. `.claude/settings.json` is protected by `AGENTS.md`, and the requested artifact is a portable Agent Skill. Therefore the skill is installed under `.agents/skills/markdown-viewer-feature-planning/`.

## Sources Inspected

- `AGENTS.md`
- `README.md`
- `package.json`
- `src-tauri/Cargo.toml`
- `vite.config.ts`
- `vitest.config.ts`
- `e2e/wdio.conf.ts`
- `.claude/settings.json`
- `.claude/hooks/pre-policy.sh`
- `.claude/hooks/post-ts-lint.sh`
- `.claude/hooks/stop-verify.sh`
- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `docs/adr/0001-tauri-2x-stack.md`
- `docs/adr/0002-tailwind-v4-and-github-markdown-css.md`
- `docs/adr/0003-codemirror-for-edit-mode.md`
- `docs/adr/0004-macos-file-associations.md`
- `docs/adr/0005-multi-file-tabs.md`
- `/Users/sakasegawa/.agents/agent-skill-best-practices.md`

## Agent Guidance And Existing Workflow

`AGENTS.md` defines the project as a fast Tauri 2 markdown viewer using React 19, TypeScript, Tailwind v4, and a Rust fs/notify backend.

Protected files must not be edited directly: `biome.json`, `lefthook.yml`, `tsconfig.json`, `src-tauri/Cargo.toml` lint sections, `.github/workflows/*.yml`, and `.claude/settings.json`. The Claude pre-policy hook is stricter for `src-tauri/Cargo.toml` and blocks edits to the whole file.

The Claude hooks enforce protected-file policy, auto-run Biome on TS/JS/CSS edits, and block completion when Vitest or Rust lib tests fail.

## Architecture And Boundary Findings

- Frontend: `src/` contains React components, hooks, Markdown rendering, link/path helpers, and tests.
- Backend: `src-tauri/src/` contains thin Rust commands, pending-open buffering, file watching, and Tauri event plumbing.
- Markdown parsing/rendering belongs on the frontend.
- Rust owns file IO, path watching with `notify`, and macOS `RunEvent::Opened` forwarding as `open-file`.
- Tauri capabilities are in `src-tauri/capabilities/default.json`.
- Vite dev server uses port `1420` with strict port and HMR on `1421` when `TAURI_DEV_HOST` is set.
- View mode is the default. Edit mode is opt-in, CodeMirror 6 is lazy-loaded, and edits stay in memory unless a future ADR explicitly permits disk saves.
- Tabs are frontend-owned. Rust watcher supports multiple watched paths but does not know about tabs.
- Core feature-planning surfaces include `src/App.tsx`, `src/hooks/useTabs.ts`, `src/lib/tauri.ts`, `src-tauri/src/commands.rs`, `src-tauri/src/watcher.rs`, `src-tauri/src/lib.rs`, and `src-tauri/src/pending_open.rs`.
- Rendering plans should inspect `src/lib/markdown*.tsx`, `src/lib/rehype-*`, `src/styles/*.css`, and `src/components/viewer/**`.
- Edit-mode plans should inspect `src/components/Editor.tsx`, `src/hooks/useFitDisplayMath.ts`, and ADR 0003.
- Open/link/file lifecycle plans should inspect `src/lib/links.ts`, `src/components/DropZone.tsx`, and ADR 0004.
- Tabs/shortcuts plans should inspect `src/components/Tabs.tsx`, `src/hooks/useKeyboardShortcuts.ts`, and ADR 0005.

## Build, Test, Validation, CI

Local commands:

- `npm run dev`
- `npm run tauri dev`
- `npm run lint`
- `npm run typecheck`
- `npm run test:run`
- `(cd src-tauri && cargo test --lib)`
- `(cd src-tauri && cargo clippy --all-targets -- -D warnings && cargo fmt --check)`
- `npm run tauri build`
- `npm run e2e` after `npm run tauri build -- --debug --no-bundle` and native webdriver setup

Required completion gate from `AGENTS.md`: `npm run test:run && (cd src-tauri && cargo test --lib)`.

CI workflow `CI` runs on pushes and PRs to `main` across Ubuntu, macOS, and Windows. It runs npm install via `npm ci`, Biome, TypeScript, Vitest, Rust fmt, clippy with warnings denied, Rust lib tests, frontend build, and Linux E2E under Xvfb after a debug Tauri build.

Release workflow `Release` runs on `v*` tags or manual dispatch. It builds macOS universal, Linux x86_64, and Windows x86_64 bundles with `tauri-apps/tauri-action` and creates draft GitHub Releases. Binaries are unsigned.

## Operational Rules

- For user-facing changes, unless told otherwise, finish by committing, pushing to GitHub, watching the pushed GitHub Actions run, and reporting the concrete result.
- For user-facing app changes, unless told otherwise, run `npm run tauri build`, replace `/Applications/markdown-viewer.app`, and verify the installed app can launch.
- Do not persist edits to disk without an ADR.
- React hook dependency omissions must use a justified `useRef` pattern, not `// biome-ignore`.
- E2E is Linux-friendly in CI; macOS/Windows coverage is manual smoke until driver support matures.
- E2E requires `npm run tauri build -- --debug --no-bundle` before `npm run e2e`; it expects the debug binary and uses `test/sample.md`.

## Web / Current-State Research

No web research was used for this meta task because the requested skill design was based on repo-local workflow, existing docs, local scripts, CI files, and a local skill-authoring best-practices document. The generated skill requires future planners to use web/current-state research when a feature plan depends on external or time-sensitive facts.

## Generated / Vendored / Protected File Notes

Generated build outputs such as `dist/`, `src-tauri/target/`, and release bundles should not be used as planning artifacts. The skill's planning artifacts belong only under `.agent-work/features/<date>-<slug>/`.

## Subagent Research Protocol Used

Four parallel investigation lanes were requested for this meta task: agent guidance, architecture boundaries, validation/CI, and skill-design review. Findings were synthesized into this summary and the skill contracts.
