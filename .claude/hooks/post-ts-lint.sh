#!/usr/bin/env bash
# Auto-format and lint any TS/JS/CSS file that was just written or edited.
# Feeds residual diagnostics back to the agent.
set -euo pipefail

input="$(cat)"
file="$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_input.path // empty')"

if [ -z "$file" ] || [ ! -f "$file" ]; then
  exit 0
fi

case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.css) ;;
  *) exit 0 ;;
esac

cd "$(dirname "$0")/../.."

npx --no-install biome check --write --no-errors-on-unmatched --diagnostic-level=error "$file" >/dev/null 2>&1 || true

residual="$(npx --no-install biome check --no-errors-on-unmatched --diagnostic-level=error "$file" 2>&1 | head -40 || true)"

if printf '%s' "$residual" | grep -qE '(error|warn)'; then
  jq -Rn --arg msg "biome check after edit: $residual" \
    '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:$msg}}'
fi
