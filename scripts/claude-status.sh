#!/bin/bash
# Touch Bar entry point for MTMR. Prints one line and exits.
# Caches output so the Touch Bar never blocks on a slow read.
#   claude-status.sh block   (default, cached 30s)
#   claude-status.sh week    (cached 300s)
#   claude-status.sh menu    (cached 30s)
#   claude-status.sh graph   (cached 300s)
set -u

MODE="${1:-block}"
# ${BASH_SOURCE[0]:-$0}: MTMR executes script *contents* via bash -c,
# where BASH_SOURCE is unset and set -u would abort.
DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd)"
CACHE_DIR="${HOME}/.cache/claude-touchbar"
CACHE="${CACHE_DIR}/${MODE}.txt"
TTL=30
case "$MODE" in week|graph) TTL=300 ;; esac

mkdir -p "$CACHE_DIR"

# Pick a node binary: PATH first, then nvm/homebrew fallbacks (MTMR and
# SwiftBar run scripts with their own PATHs). Each candidate is test-run:
# a broken install (e.g. homebrew node missing its icu4c dylib) must not win.
NODE=""
for candidate in "$(command -v node 2>/dev/null || true)" \
    "$HOME"/.nvm/versions/node/*/bin/node \
    /opt/homebrew/bin/node /usr/local/bin/node; do
  if [ -n "$candidate" ] && [ -x "$candidate" ] && \
     "$candidate" -e 'process.exit(0)' >/dev/null 2>&1; then
    NODE="$candidate"
    break
  fi
done
if [ -z "$NODE" ]; then
  echo "✳ no node"
  exit 0
fi

now=$(date +%s)
if [ -f "$CACHE" ]; then
  age=$(( now - $(stat -f %m "$CACHE") ))
  if [ "$age" -lt "$TTL" ]; then
    cat "$CACHE"
    exit 0
  fi
fi

out="$("$NODE" "$DIR/scripts/status.js" "$MODE" 2>/dev/null)"
if [ -n "$out" ]; then
  printf '%s\n' "$out" | tee "$CACHE"
else
  # Fall back to stale cache rather than flashing an empty button.
  [ -f "$CACHE" ] && cat "$CACHE" || echo "✳ …"
fi
