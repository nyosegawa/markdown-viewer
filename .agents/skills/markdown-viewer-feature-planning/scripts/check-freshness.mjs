#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const manifestPath = ".agents/skills/markdown-viewer-feature-planning/references/freshness-manifest.json";

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function gitHead() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function listFilesForGlob(glob) {
  if (glob.includes("**")) {
    const [base, suffix = ""] = glob.split("**");
    const baseDir = base.replace(/\/$/, "") || ".";
    const suffixPattern = suffix.replace(/^\//, "");
    return walk(baseDir).filter((file) => matchesSuffixGlob(file, suffixPattern));
  }
  if (glob.includes("*")) {
    const slash = glob.lastIndexOf("/");
    const dir = slash >= 0 ? glob.slice(0, slash) : ".";
    const pattern = slash >= 0 ? glob.slice(slash + 1) : glob;
    if (!existsSync(dir)) return [];
    const regex = new RegExp(`^${pattern.split("*").map(escapeRegex).join(".*")}$`);
    return readdirSync(dir)
      .map((name) => join(dir, name))
      .filter((path) => existsSync(path) && statSync(path).isFile() && regex.test(path.split("/").pop()));
  }
  return existsSync(glob) ? [glob] : [];
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) out.push(...walk(path));
    else if (stat.isFile()) out.push(path);
  }
  return out;
}

function matchesSuffixGlob(file, suffixPattern) {
  if (!suffixPattern || suffixPattern === "*") return true;
  if (!suffixPattern.includes("*")) return file.endsWith(suffixPattern);
  const regex = new RegExp(`${suffixPattern.split("*").map(escapeRegex).join(".*")}$`);
  return regex.test(file);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function main() {
  if (!existsSync(manifestPath)) {
    console.error(`Missing manifest: ${manifestPath}`);
    process.exit(2);
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    console.error(`Invalid manifest JSON: ${error.message}`);
    process.exit(2);
  }

  const root = process.cwd();
  const excluded = new Set(manifest.excluded_files || []);
  const changed = [];
  const missing = [];
  const globChanges = [];

  for (const [file, meta] of Object.entries(manifest.watched_files || {})) {
    if (excluded.has(file)) continue;
    if (!existsSync(file)) {
      missing.push(file);
      continue;
    }
    const current = sha256(file);
    if (current !== meta.sha256) {
      changed.push({ file, reason: meta.reason || "", before: meta.sha256, after: current });
    }
  }

  for (const entry of manifest.watched_globs || []) {
    const files = listFilesForGlob(entry.glob)
      .map((file) => relative(root, resolve(file)))
      .filter((file) => !excluded.has(file))
      .sort();
    const fingerprintInput = files
      .map((file) => `${file}\0${sha256(file)}`)
      .join("\n");
    const fingerprint = createHash("sha256").update(fingerprintInput).digest("hex");
    if (entry.fingerprint && entry.fingerprint !== fingerprint) {
      globChanges.push({ glob: entry.glob, reason: entry.reason || "", before: entry.fingerprint, after: fingerprint, files });
    }
  }

  const result = {
    ok: true,
    git_head: gitHead(),
    manifest_base_commit: manifest.last_full_research_commit || null,
    changed,
    missing,
    glob_changes: globChanges,
  };

  console.log(JSON.stringify(result, null, 2));
}

main();
