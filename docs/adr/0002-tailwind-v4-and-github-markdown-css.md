# 0002 — Tailwind v4 + github-markdown-css

- Status: accepted
- Date: 2026-04-23

## Context

The UI needs to stay small and fast, match "feels like GitHub" for rendered Markdown, and support runtime light/dark switching.

## Decision

Tailwind CSS v4 via `@tailwindcss/vite`, with `@theme` tokens and `@custom-variant dark` bound to `[data-theme="dark"]`. Rendered Markdown uses `github-markdown-css` scoped under `.markdown-body`, so Tailwind's preflight and GitHub's body styles don't collide.

## Consequences

- No `tailwind.config.js`; theme customisation lives in `src/styles/index.css`.
- Theme switching is a single attribute flip on `<html>` (`data-theme`), no class-list walks.
- Adding new tokens means editing `@theme`, not JS config.
