#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

const requiredSections = {
  "research.md": [
    "Scope",
    "Freshness Check",
    "Investigation Method",
    "Subagent Rounds",
    "Sources Inspected",
    "Findings",
    "Repo Guidance Findings",
    "Architecture / Boundary Findings",
    "Validation / CI Findings",
    "Existing Skill / Command Findings",
    "Web / Current-State Findings",
    "Freshness / Staleness Findings",
    "Generated / Vendored / Protected File Findings",
    "Risks",
    "Decisions",
    "Rejected Approaches",
    "Remaining Unknowns",
  ],
  "plan.md": [
    "Summary",
    "Background",
    "Current State",
    "Goals",
    "Non-Goals",
    "Repo-Specific Constraints",
    "Design Decisions",
    "Impacted Areas",
    "Validation Plan",
    "Commit, PR, And CI Plan",
    "Risks",
    "Completion Criteria",
    "Open Questions",
  ],
  "todo.md": [
    "Status Summary",
    "Phase Checklist",
    "Task Checklist By Phase",
    "Implementation Notes",
    "Validation Evidence",
    "Review Evidence",
    "Commit Log",
    "Final Checklist",
  ],
  "goal-prompt.md": [
    "/goal command",
    "source artifact paths",
    "repo guidance paths",
    "freshness policy and freshness result",
    "execution rules",
    "validation rules",
    "review rules",
    "commit rules",
    "push rules",
    "PR rules",
    "CI follow-through rules",
    "evidence rules",
    "stop conditions",
    "escalation conditions",
  ],
};

const requiredPhaseFields = [
  "Goal:",
  "Scope:",
  "Expected files/areas:",
  "Validation:",
  "Review:",
  "Commit:",
  "Push:",
  "PR/CI:",
  "Evidence:",
  "Tasks:",
];

const requiredGoalPaths = ["research.md", "plan.md", "todo.md"];

function normalizeHeading(value) {
  return value.trim().replace(/:$/, "").replace(/\s+/g, " ").toLowerCase();
}

function markdownHeadings(markdown) {
  const headings = [];
  let fenced = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    const match = /^(#{1,3})\s+(.+?)\s*$/.exec(line);
    if (match) headings.push(normalizeHeading(match[2]));
  }
  return new Set(headings);
}

function phaseBlocks(todo) {
  const lines = todo.split(/\r?\n/);
  const blocks = [];
  let current = null;
  for (const line of lines) {
    if (/^- \[[ xX]\]\s+P\d{3}\s+\S+/.test(line)) {
      if (current) blocks.push(current);
      current = [line];
    } else if (current) {
      if (/^- \[[ xX]\]\s+P\d{3}\s+\S+/.test(line)) {
        blocks.push(current);
        current = [line];
      } else {
        current.push(line);
      }
    }
  }
  if (current) blocks.push(current);
  return blocks.map((block) => block.join("\n"));
}

function validateTodo(todo, errors) {
  const phases = phaseBlocks(todo);
  if (phases.length === 0) {
    errors.push("todo.md: missing at least one '- [ ] P### <title>' phase entry");
    return;
  }

  phases.forEach((phase, index) => {
    const label = `todo.md phase ${index + 1}`;
    for (const field of requiredPhaseFields) {
      if (!phase.includes(field)) errors.push(`${label}: missing '${field}'`);
    }
    const isExempt = /planning-only|validation-only/i.test(phase);
    if (!isExempt && !/- \[[ xX]\]\s+T\d{3}\s+\S+/.test(phase)) {
      errors.push(`${label}: missing at least one '- [ ] T### <title>' task`);
    }
    if (!/- \[[ xX]\]\s+P\d{3}\s+\S+/.test(phase)) {
      errors.push(`${label}: invalid phase checkbox/id/title`);
    }
  });
}

function validateGoalPaths(goalPrompt, artifactDir, errors) {
  for (const file of requiredGoalPaths) {
    const absPath = resolve(artifactDir, file);
    if (!goalPrompt.includes(absPath)) {
      errors.push(`goal-prompt.md: missing absolute path ${absPath}`);
    }
  }
}

function main() {
  const artifactArg = process.argv[2];
  if (!artifactArg) {
    console.error("Usage: validate-artifacts.mjs <feature-artifact-dir>");
    process.exit(2);
  }

  const artifactDir = isAbsolute(artifactArg) ? artifactArg : resolve(process.cwd(), artifactArg);
  const errors = [];
  const contents = {};

  for (const [file, sections] of Object.entries(requiredSections)) {
    const path = join(artifactDir, file);
    if (!existsSync(path)) {
      errors.push(`${file}: missing required file`);
      continue;
    }
    const markdown = readFileSync(path, "utf8");
    contents[file] = markdown;
    const headings = markdownHeadings(markdown);
    for (const section of sections) {
      if (!headings.has(normalizeHeading(section))) {
        errors.push(`${file}: missing section '${section}'`);
      }
    }
  }

  if (contents["todo.md"]) validateTodo(contents["todo.md"], errors);
  if (contents["goal-prompt.md"]) validateGoalPaths(contents["goal-prompt.md"], artifactDir, errors);

  if (errors.length > 0) {
    console.error(`Artifact validation failed for ${artifactDir}`);
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log(`Artifact validation passed for ${artifactDir}`);
}

main();

