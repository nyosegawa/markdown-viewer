#!/usr/bin/env bash
# Completion gate: run fast tests before letting the agent declare done.
# Kept short (<20s local) so feedback lands quickly.
set -euo pipefail

cd "$(dirname "$0")/../.."

# Only run if tests have been written and scaffolded.
if [ ! -d node_modules ] || [ ! -f vitest.config.ts ]; then
  exit 0
fi

npm run --silent test:run >/tmp/mdv-stop-vitest.log 2>&1 || {
  tail -30 /tmp/mdv-stop-vitest.log >&2
  echo "Stop hook: vitest failed. Fix the tests before declaring done." >&2
  exit 2
}

if [ -f src-tauri/Cargo.toml ]; then
  (cd src-tauri && cargo test --lib --quiet) >/tmp/mdv-stop-cargo.log 2>&1 || {
    tail -30 /tmp/mdv-stop-cargo.log >&2
    echo "Stop hook: cargo test failed. Fix the tests before declaring done." >&2
    exit 2
  }
fi

exit 0
