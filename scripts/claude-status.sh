#!/bin/bash
# Touch Bar entry point for MTMR. Prints one line and exits.
# Caches output so the Touch Bar never blocks on a slow read.
#   claude-status.sh block   (default, cached 30s)
#   claude-status.sh week    (cached 300s)
set -u

MODE="${1:-block}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CACHE_DIR="${HOME}/.cache/claude-touchbar"
CACHE="${CACHE_DIR}/${MODE}.txt"
TTL=30
[ "$MODE" = "week" ] && TTL=300

mkdir -p "$CACHE_DIR"

# Pick a node binary: PATH first, then nvm/homebrew fallbacks
# (MTMR runs scripts with a minimal PATH).
NODE="$(command -v node || true)"
if [ -z "$NODE" ]; then
  for candidate in "$HOME"/.nvm/versions/node/*/bin/node /opt/homebrew/bin/node /usr/local/bin/node; do
    [ -x "$candidate" ] && NODE="$candidate" && break
  done
fi
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
