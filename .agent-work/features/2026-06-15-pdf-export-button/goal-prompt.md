# /goal command

Implement the planned PDF output toolbar button and Command+P shortcut from `todo.md`, one phase per iteration.

# source artifact paths

- Research: `/Users/sakasegawa/src/github.com/nyosegawa/markdown-viewer/.agent-work/features/2026-06-15-pdf-export-button/research.md`
- Plan: `/Users/sakasegawa/src/github.com/nyosegawa/markdown-viewer/.agent-work/features/2026-06-15-pdf-export-button/plan.md`
- TODO: `/Users/sakasegawa/src/github.com/nyosegawa/markdown-viewer/.agent-work/features/2026-06-15-pdf-export-button/todo.md`

# repo guidance paths

- `/Users/sakasegawa/src/github.com/nyosegawa/markdown-viewer/AGENTS.md`
- `/Users/sakasegawa/src/github.com/nyosegawa/markdown-viewer/README.md`
- `/Users/sakasegawa/src/github.com/nyosegawa/markdown-viewer/docs/adr/`
- `/Users/sakasegawa/src/github.com/nyosegawa/markdown-viewer/.agents/skills/markdown-viewer-feature-planning/references/repo-research-summary.md`

# branch and planning commit

- Branch: `codex/pdf-export-button-plan`
- Planning commit: Pending
- Remote: `origin ssh://git@github.com/nyosegawa/markdown-viewer.git`
- Push result: Pending
- Continue implementation on this same branch. Do not create a separate implementation branch unless the user explicitly redirects.

# freshness policy and freshness result

- Read `research.md` Freshness Check first.
- Refresh external or time-sensitive facts only when they affect implementation; record sources.
- Freshness result: Targeted refresh performed for changed watched files; see `research.md`.

# execution rules

- Follow `plan.md`; complete `todo.md` phases in order unless a recorded dependency change requires otherwise.
- Keep the solution frontend-only unless `window.print()` is proven unusable in Tauri WebView.
- Update `todo.md` with status and evidence after each phase.

# validation rules

- Run phase-specific validation before marking the phase complete.
- Minimum gate: `npm run test:run && (cd src-tauri && cargo test --lib)`.
- Also run lint/typecheck and, for this user-facing app change, `npm run tauri build`, install replacement to `/Applications/markdown-viewer.app`, and verify launch unless the user waives it.

# review rules

- After validation, use an independent reviewer subagent when available.
- If unavailable, do a fresh self-review and record that limitation.
- Fix issues, then rerun relevant validation before commit.

# commit rules

- Prefer one implementation commit after validation/review.
- Avoid unrelated changes and record commit hashes in `todo.md`.

# push rules

- Push completed implementation commits to `origin` and record branch/hash/result.

# PR rules

- Open a PR after final validation when credentials are available and in scope.
- PR body should summarize behavior, validation, review, risks, and skipped checks.

# CI follow-through rules

- Watch CI to success or failure.
- Fix in-scope failures, validate, commit, push, and keep watching; escalate unavailable credentials, approvals, or out-of-scope failures.

# evidence rules

- Record implementation, validation, review, commit, push, PR, and CI evidence in `todo.md`.
- Do not claim completion without evidence.

# stop conditions

Stop only when all tasks are complete, completion criteria are met, required validation/build/install/launch checks passed or have a recorded user-approved exception, review evidence is recorded, and PR/CI has a concrete result when applicable.

# escalation conditions

Escalate conflicting PDF semantics, unusable WebView print behavior, print CSS clipping that cannot be resolved safely, forbidden edits, required validation blockers, or unsafe branch/worktree state.
