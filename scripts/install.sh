#!/bin/bash
# One-shot installer: MTMR + SwiftBar + widgets + dependencies.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Runtime copy outside TCC-protected folders (Desktop/Documents/Downloads):
# MTMR and SwiftBar can't execute scripts there without a permission grant.
RUNTIME="${CLAUDE_TOUCH_RUNTIME:-$HOME/.local/share/claude-status-touch-bar}"

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

if [ ! -d "/Applications/Übersicht.app" ]; then
  echo "==> Installing Übersicht via Homebrew"
  brew install --cask ubersicht
else
  echo "==> Übersicht already installed"
fi

echo "==> Deploying runtime to $RUNTIME"
mkdir -p "$RUNTIME"
rsync -a --delete \
  "$DIR/scripts" "$DIR/swiftbar" "$DIR/node_modules" "$DIR/package.json" \
  "$RUNTIME/"
chmod +x "$RUNTIME"/scripts/*.sh "$RUNTIME"/swiftbar/*.sh

echo "==> Installing Übersicht desktop widget"
WIDGETS="$HOME/Library/Application Support/Übersicht/widgets"
mkdir -p "$WIDGETS"
rsync -a --delete "$DIR/ubersicht/claude-status.widget" "$WIDGETS/"

echo "==> Merging Claude widgets into MTMR items.json"
CLAUDE_TOUCH_RUNTIME="$RUNTIME" node "$DIR/scripts/merge-items.js"

echo "==> Configuring SwiftBar menu bar plugin"
EXISTING="$(defaults read com.ameba.SwiftBar PluginDirectory 2>/dev/null || true)"
if [ -z "$EXISTING" ] || [[ "$EXISTING" == *claude* ]]; then
  # Fresh SwiftBar (or one we configured before): own the plugin folder.
  defaults write com.ameba.SwiftBar PluginDirectory -string "$RUNTIME/swiftbar"
  defaults write com.ameba.SwiftBar MakePluginExecutable -bool true
else
  # Existing SwiftBar setup: link our plugin into the user's folder.
  ln -sf "$RUNTIME/swiftbar/claude-status.30s.sh" "$EXISTING/claude-status.30s.sh"
fi

echo "==> (Re)starting MTMR, SwiftBar and Übersicht"
pkill -x MTMR 2>/dev/null || true
pkill -x SwiftBar 2>/dev/null || true
pkill -x "Übersicht" 2>/dev/null || true
sleep 1
open -a MTMR
open -a SwiftBar
open -a "Übersicht"

cat <<'EOF'

Done. Notes:
 * First launch: macOS will ask for Accessibility permission for MTMR
   (System Settings > Privacy & Security > Accessibility). Grant it, then
   the custom Touch Bar appears.
 * Tap a Touch Bar widget or use the menu bar dropdown to open a live
   dashboard in Terminal.
 * After changing the repo, re-run this installer to redeploy the runtime.
EOF
