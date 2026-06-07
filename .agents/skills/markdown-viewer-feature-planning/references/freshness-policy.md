# Freshness Policy

Every feature-planning run must check whether this skill's repo-specific knowledge is still current before planning.

## Levels

### Fast Freshness Check

Run on every invocation. Compare current `git rev-parse HEAD` when available plus hashes for watched files and glob results from `references/freshness-manifest.json`. If nothing changed, continue and later record the result in `research.md`.

### Targeted Refresh

Run when watched inputs changed. Inspect only the changed or newly relevant files, update affected sections in `references/repo-research-summary.md`, then update `references/freshness-manifest.json` after all edits are complete.

### Full Refresh

Run only when structural changes make targeted refresh unsafe or the user explicitly asks to re-research the repo. Re-run repo discovery, refresh `references/repo-research-summary.md`, then update the manifest.

## Targeted Refresh Triggers

- agent guidance changed
- validation, build, or test commands changed
- CI or release workflow changed
- architecture/module boundary docs changed
- protected/generated file rules changed
- existing skill/command files changed
- generated skill implementation changed

## Full Refresh Triggers

- package manager, primary framework, monorepo layout, or build system changed
- CI was replaced or substantially reorganized
- agent guidance was broadly rewritten
- manifest is missing, invalid, or inconsistent
- many watched inputs changed and the base commit is far behind
- user asks to refresh, re-audit, or re-research

## Web / Current-State Research

Use web or current-state research when a plan depends on facts outside the checkout or on information likely to drift, including official APIs, platform behavior, dependency versions, package registry state, GitHub PR/release/CI state, browser/tooling behavior, or external standards. Record sources in `research.md`. If live research is skipped, state why.

