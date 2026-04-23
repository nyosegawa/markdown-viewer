<p align="center">
  <img src="src-tauri/icons/app-icon.png" alt="markdown-viewer" width="128" height="128" />
</p>

# markdown-viewer

Fast, native **Markdown viewer** built on [Tauri 2.x](https://tauri.app). View-first, edit-on-demand, GitHub-flavoured.

## Features

- **Tauri 2.x** native shell (< 10 MB binary on macOS release build)
- **GitHub Flavored Markdown** — tables, task lists, strikethrough, autolinks
- **Syntax highlighting** with [Shiki](https://shiki.style/) (VS Code grammars, light + dark themes)
- **KaTeX math** (`$inline$` and `$$block$$`)
- **GitHub-style theming** via `github-markdown-css`, with runtime dark / light switch (default: follow system, persisted per user)
- **CodeMirror 6** edit mode — lazy-loaded, only paid for when you press Edit
- **Four ways to open a file**
  - Drag & drop onto the window
  - Toolbar **Open** dialog
  - CLI argument: `markdown-viewer path/to/file.md`
  - **Finder / macOS Launch Services** — double-click `.md` / `.markdown` / `.mdx`, or `open foo.md`
- **Hot reload** — changes on disk (from any external editor) reflow instantly
- **Recent files** history (last 10) in the toolbar

## Install (local, unsigned)

```bash
# After `npm run tauri build`
cp -R src-tauri/target/release/bundle/macos/markdown-viewer.app /Applications/
xattr -dr com.apple.quarantine /Applications/markdown-viewer.app

# Register + set as default handler for .md/.markdown/.mdx (requires duti: `brew install duti`)
/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister -f /Applications/markdown-viewer.app
for ext in md markdown mdx; do duti -s com.nyosegawa.markdownviewer $ext all; done
```

## Development

Prerequisites: Node 22+, Rust stable, the [Tauri 2 prerequisites](https://tauri.app/start/prerequisites/) for your OS.

```bash
npm install
npm run tauri dev
```

### Scripts

```bash
npm run dev               # Vite only
npm run tauri dev         # Full desktop app (hot reload)
npm run tauri build       # Release bundle (.dmg/.msi/.deb)

npm run lint              # biome
npm run typecheck         # tsc --noEmit
npm run test:run          # Vitest (unit / component)
npm run e2e               # WebDriverIO + tauri-driver (Linux only)

(cd src-tauri && cargo fmt --check)
(cd src-tauri && cargo clippy --all-targets -- -D warnings)
(cd src-tauri && cargo test --lib)
```

### Project layout

```
src/                  React + TS frontend
src-tauri/            Rust backend (commands, notify-based watcher)
e2e/                  WebDriverIO specs (Linux CI only)
docs/adr/             Architecture Decision Records
.claude/              Agent harness (hooks + settings)
```

## CI & releases

- **CI** (`.github/workflows/ci.yml`) — lint, typecheck, Vitest, cargo fmt/clippy/test, and a sanity build on macOS / Windows / Linux. Linux runs the WebDriverIO E2E suite under Xvfb.
- **Release** (`.github/workflows/release.yml`) — triggered by pushing a `v*` tag. Produces macOS Universal (`.dmg`), Linux x86_64 (`.deb`, `.AppImage`), and Windows x86_64 (`.msi`) via `tauri-action`, attached to a draft GitHub Release.

### Signing / notarization

Release binaries are **unsigned**. macOS will warn "unidentified developer" (right-click → Open) and Windows SmartScreen may flag the `.msi` ("More info → Run anyway"). Adding Apple Developer ID + notarization and an Authenticode cert is out of scope for v0.1.

## Contributing

Run `npx lefthook install` once to wire up the pre-commit / pre-push gate. The harness (`biome`, `tsc`, `clippy`, `cargo fmt`, Vitest, cargo test) runs automatically before each commit/push.

See [`docs/adr/`](./docs/adr) for architectural decisions and [`AGENTS.md`](./AGENTS.md) for contributor + agent rules.

## License

MIT — see [LICENSE](./LICENSE).
