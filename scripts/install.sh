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

if [ ! -d "/Applications/SwiftBar.app" ]; then
  echo "==> Installing SwiftBar via Homebrew"
  brew install --cask swiftbar
else
  echo "==> SwiftBar already installed"
fi

echo "==> Making scripts executable"
chmod +x "$DIR"/scripts/*.sh

echo "==> Merging Claude widgets into MTMR items.json"
node "$DIR/scripts/merge-items.js"

echo "==> Configuring SwiftBar menu bar plugin"
if ! defaults read com.ameba.SwiftBar PluginDirectory >/dev/null 2>&1; then
  # Fresh SwiftBar: point it straight at our plugin folder.
  defaults write com.ameba.SwiftBar PluginDirectory -string "$DIR/swiftbar"
  defaults write com.ameba.SwiftBar MakePluginExecutable -bool true
else
  # Existing SwiftBar setup: link our plugin into the user's folder.
  EXISTING="$(defaults read com.ameba.SwiftBar PluginDirectory)"
  ln -sf "$DIR/swiftbar/claude-status.30s.sh" "$EXISTING/claude-status.30s.sh"
fi

echo "==> (Re)starting MTMR and SwiftBar"
pkill -x MTMR 2>/dev/null || true
pkill -x SwiftBar 2>/dev/null || true
sleep 1
open -a MTMR
open -a SwiftBar

cat <<'EOF'

Done. Notes:
 * First launch: macOS will ask for Accessibility permission for MTMR
   (System Settings > Privacy & Security > Accessibility). Grant it, then
   the custom Touch Bar appears.
 * Tap either widget to open a live dashboard in Terminal.
EOF
