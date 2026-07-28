#!/bin/bash
# Tap action for the Touch Bar stickers: swap the tapped one for another
# random image. Thin wrapper so MTMR (minimal PATH, no shebang support for
# env node) can run the node script.
set -u

SLOT="${1:-0}"
# ${BASH_SOURCE[0]:-$0}: MTMR may execute script *contents* via bash -c,
# where BASH_SOURCE is unset and set -u would abort.
DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"

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
[ -n "$NODE" ] || exit 0

exec "$NODE" "$DIR/shuffle-sticon.js" "$SLOT"
