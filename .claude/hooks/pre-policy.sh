#!/usr/bin/env bash
# Blocks edits to protected harness/lint/config files. Fix the code, not the config.
set -euo pipefail

input="$(cat)"
file="$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_input.path // empty')"

case "$file" in
  */biome.json|biome.json \
  |*/lefthook.yml|lefthook.yml \
  |*/.claude/settings.json \
  |*/src-tauri/Cargo.toml|src-tauri/Cargo.toml \
  |*/.github/workflows/*.yml \
  |*/tsconfig.json|tsconfig.json)
    echo "BLOCKED: $file is a protected config file. Fix the code, not the linter/CI config." >&2
    exit 2
    ;;
esac

exit 0
