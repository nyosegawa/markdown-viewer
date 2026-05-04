# markdown-viewer — Agent Guidelines

Fast Tauri 2 markdown viewer (React 19 + TS + Tailwind v4, Rust fs/notify backend).

## Commands

```bash
npm run dev             # Vite dev server (1420)
npm run tauri dev       # Desktop app with live reload
npm run typecheck       # tsc --noEmit
npm run lint            # biome check .
npm run test:run        # Vitest
(cd src-tauri && cargo test --lib)
(cd src-tauri && cargo clippy --all-targets -- -D warnings && cargo fmt --check)
npm run tauri build     # Release bundle
```

## Rules

- **Never edit** `biome.json`, `lefthook.yml`, `tsconfig.json`, `src-tauri/Cargo.toml [lints.*]`, `.github/workflows/*.yml`, `.claude/settings.json`. Fix the code, not the harness.
- `npm run test:run && (cd src-tauri && cargo test --lib)` must pass before declaring done (Stop hook enforces this).
- React hooks dependency omissions must be justified with `useRef` pattern, not `// biome-ignore`.
- Tauri IPC stays thin: heavy Markdown work happens on the frontend. Rust only reads files, watches them (`notify`), and forwards macOS `RunEvent::Opened` as the `open-file` event.
- View mode is the default; Edit mode is opt-in only. Don't persist edits to disk without an explicit ADR.
- For user-facing changes, unless explicitly told not to, finish by committing, pushing to GitHub, watching the pushed GitHub Actions run until it succeeds or fails, and reporting the concrete result.
- For user-facing app changes, unless explicitly told not to, run `npm run tauri build`, replace `/Applications/markdown-viewer.app` with the generated release `.app`, and verify the installed app can launch.
- See `docs/adr/` for architectural decisions.
