#!/bin/bash
# Tap action: open a live usage dashboard in Terminal (scripts/live.sh).
DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd)"
osascript <<EOF
tell application "Terminal"
  do script "'$DIR/scripts/live.sh'"
  activate
end tell
EOF
