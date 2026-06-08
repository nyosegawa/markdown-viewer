---
name: markdown-viewer-feature-planning
description: Plan markdown-viewer features before implementation. Use when the user asks "こういう機能を作りたい", "この問題群を解決したい", "実装前に計画して", "/goal に投げる前提で準備して", "feature planning して", "research/plan/todo/goal prompt にして", "Create a feature plan", or "Prepare a goal-ready implementation plan". Do not use for small direct edits, ordinary code review, release-only work, or implementation requests that do not ask for planning first.
---

# markdown-viewer Feature Planning

Use this skill to create a repo-specific planning package for future implementation work. Do not implement the feature while using this skill.

Canonical output location:

```text
.agent-work/features/<date>-<slug>/
  research.md
  plan.md
  todo.md
  goal-prompt.md
```

Do not create root-level planning aliases unless the user explicitly asks for them.

## Near Misses

Do not use this skill for:

- a one-file or obvious direct code edit
- ordinary review where the user asks for findings only
- fixing a failing test without a requested plan
- release, packaging, or install work by itself
- broad project rules that belong in `AGENTS.md`

## Required Reading

Read these files before finalizing a plan:

- `references/freshness-policy.md`
- `references/artifact-contract.md`
- `references/repo-research-summary.md`
- `references/review-rubric.md`

Use these templates:

- `assets/research-template.md`
- `assets/plan-template.md`
- `assets/todo-template.md`
- `assets/goal-prompt-template.md`

## Workflow

### 1. Freshness Check

Before relying on stored repo guidance:

1. Read `references/freshness-policy.md` and `references/freshness-manifest.json`.
2. Run `scripts/check-freshness.mjs` from the repo root when Node is available.
3. If no watched inputs changed, continue and record "fast freshness check passed" in working notes.
4. If watched inputs changed, inspect only changed inputs and refresh affected sections in `references/repo-research-summary.md` before planning.
5. If structural changes are detected, perform a full repo refresh before planning.
6. Do not update `references/freshness-manifest.json` until all refresh edits are complete.
7. After creating `.agent-work/features/<date>-<slug>/research.md`, record the freshness outcome in its `Freshness Check` section.

### 2. Branch Setup

Use one branch for both planning and implementation. Do not create a separate planning-only branch.

1. Inspect branch conventions with `git branch`, `git status --short --branch`, and recent commit or branch names when needed.
2. If the user provides a branch name, use it exactly. Otherwise derive a concise branch name from the feature slug, following discovered repo conventions.
3. Create or switch to that branch before writing planning artifacts.
4. Verify the current worktree does not contain unrelated changes that would make a safe planning commit impossible.
5. Record the branch decision, current remote, and blockers in working notes. Write them into `research.md` and `todo.md`.
6. Ensure the generated `/goal` prompt instructs implementation to continue on this same branch.

### 3. Specify

Create the feature artifact directory under `.agent-work/features/<date>-<slug>/`. Extract the user's request, need, affected users/systems/surfaces, success criteria, non-goals, completion criteria, and expected validation evidence.

### 4. Clarify

Ask only questions that materially affect planning. If the user asked for autonomous planning, make conservative assumptions and write them into `plan.md`.

### 5. Research

Research the repo before finalizing the plan. Use subagents when available and useful; default to four lanes and up to three rounds:

- repo guidance and existing agent workflow
- architecture, module boundaries, and public interfaces
- build, test, validation, generated files, and CI
- docs, release, operational rules, and examples

Use web/current-state research when external or time-sensitive facts affect the plan. Record sources in `research.md`, or state why live research was skipped.

### 6. Plan

Create `plan.md` using `assets/plan-template.md`. Include repo-specific constraints, design decisions, validation, commit, push, PR, and CI follow-through expectations.

### 7. Tasks

Create `todo.md` using `assets/todo-template.md`. Use phase-first execution:

- a phase is the default implementation/review/commit unit
- tasks live inside phases
- split to task-level execution only when a phase is too large, mixes unrelated responsibilities, has incompatible validation, or cannot be reviewed/committed coherently

### 8. Analyze

Review `research.md`, `plan.md`, and `todo.md` for contradictions, unsupported assumptions, missing validation, missing docs/update requirements, hidden deferred work, oversized phases, missing evidence fields, and repo rule violations. Fix artifacts before declaring them ready.

### 9. Goal Prompt

Create `goal-prompt.md` using `assets/goal-prompt-template.md`. It must be copy-paste-ready for Codex `/goal` and include absolute paths to `research.md`, `plan.md`, and `todo.md`, freshness result, phase-first execution rules, validation, independent review, commit, push, PR, CI follow-through, evidence, stop, and escalation rules.

Keep `goal-prompt.md` at 4000 characters or fewer. Refer to `research.md`, `plan.md`, and `todo.md` for detail instead of duplicating long content.

### 10. Validate Artifacts

Run:

```bash
node .agents/skills/markdown-viewer-feature-planning/scripts/validate-artifacts.mjs .agent-work/features/<date>-<slug>
```

If validation fails, fix the artifacts and rerun. Do not declare the planning package ready until validation passes, or script execution is impossible and the manual contract check from `references/artifact-contract.md` is recorded with the reason.

After `research.md`, `plan.md`, `todo.md`, and `goal-prompt.md` are complete and validation passes:

1. Commit the planning artifacts as one planning package when git is available and the worktree can be committed safely.
2. Use a concise imperative commit message, such as `Plan <feature slug>`.
3. If a remote exists and push is possible, push the branch.
4. Record branch name, planning commit hash, remote, push result, and blockers in `todo.md`.
5. If branch creation, commit, or push is blocked by missing git repo, dirty unrelated changes, authentication, missing remote, branch protection, or network failure, record the exact blocker in `research.md` or `todo.md` and report it. Do not silently continue as if planning was shared.

## Repo-Specific Hard Rules

- Do not edit protected harness/config files: `biome.json`, `lefthook.yml`, `tsconfig.json`, `.github/workflows/*.yml`, `.claude/settings.json`. `AGENTS.md` protects `src-tauri/Cargo.toml` lint sections; the Claude pre-policy hook blocks edits to the whole `src-tauri/Cargo.toml`.
- Keep Tauri IPC thin. Markdown parsing/rendering stays in the frontend; Rust reads files, watches paths, and emits app/open events.
- View mode is default. Edit mode is opt-in and edits stay in memory unless an ADR explicitly changes disk-save behavior.
- Required completion gate for implementation work: `npm run test:run && (cd src-tauri && cargo test --lib)`.
- For user-facing app changes, plan for `npm run tauri build`, replacing `/Applications/markdown-viewer.app`, and verifying installed app launch unless the user says not to.
