# 0001 — Tauri 2.x + React 19 + Vite

- Status: accepted
- Date: 2026-04-23

## Context

We want a native-feeling Markdown viewer with small binaries and quick startup, shipping to macOS, Windows, and Linux without Electron's footprint.

## Decision

Use Tauri 2.x (the stable line) with a React 19 + TypeScript frontend bundled by Vite. Rust handles file I/O (`tokio::fs`), file-system watching (`notify`), and the CLI-arg plugin. The frontend owns Markdown parsing and rendering.

## Consequences

- Binary footprint is ~10MB vs ~100MB Electron.
- Capabilities replace v1 allowlists; scope must be explicit (`capabilities/default.json`).
- E2E via `tauri-driver` remains Linux-friendly only; macOS/Windows coverage is manual smoke until the driver matures.
