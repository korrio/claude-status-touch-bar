#!/bin/bash
# One-shot installer: MTMR + widgets + dependencies.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Installing npm dependencies (ccusage)"
(cd "$DIR" && npm install --no-fund --no-audit)

if [ ! -d "/Applications/MTMR.app" ]; then
  echo "==> Installing MTMR via Homebrew"
  brew install --cask mtmr
else
  echo "==> MTMR already installed"
fi

echo "==> Making scripts executable"
chmod +x "$DIR"/scripts/*.sh

echo "==> Merging Claude widgets into MTMR items.json"
node "$DIR/scripts/merge-items.js"

echo "==> (Re)starting MTMR"
pkill -x MTMR 2>/dev/null || true
sleep 1
open -a MTMR

cat <<'EOF'

Done. Notes:
 * First launch: macOS will ask for Accessibility permission for MTMR
   (System Settings > Privacy & Security > Accessibility). Grant it, then
   the custom Touch Bar appears.
 * Tap either widget to open a live dashboard (ccusage blocks --live).
EOF
