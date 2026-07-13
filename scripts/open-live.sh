#!/bin/bash
# Tap action: open a live usage dashboard in Terminal (ccusage blocks --live).
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
osascript <<EOF
tell application "Terminal"
  do script "cd '$DIR' && ./node_modules/.bin/ccusage blocks --live"
  activate
end tell
EOF
