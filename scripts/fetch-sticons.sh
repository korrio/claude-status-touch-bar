#!/bin/bash
# Downloads the LINE sticon set into the runtime folder and resizes copies
# to Touch Bar height. Images stay in the runtime dir (personal use), never
# in the repo. Re-run scripts/merge-items.js afterwards to (re)pick 3.
set -euo pipefail

RUNTIME="${CLAUDE_TOUCH_RUNTIME:-$HOME/.local/share/claude-status-touch-bar}"
SET_ID="${1:-5bbc27ca040ab16e95048a07}"
COUNT="${2:-40}"
RAW="$RUNTIME/sticons/raw"
SMALL="$RUNTIME/sticons/small"
mkdir -p "$RAW" "$SMALL"

for i in $(seq 1 "$COUNT"); do
  n=$(printf '%03d' "$i")
  url="https://stickershop.line-scdn.net/sticonshop/v1/sticon/$SET_ID/iPhone/$n.png?v=3"
  out="$RAW/$n.png"
  [ -s "$out" ] || curl -fsS -m 20 -o "$out" "$url" || { echo "skip $n"; continue; }
  sips -Z 26 "$out" --out "$SMALL/$n.png" >/dev/null
done

echo "downloaded: $(ls "$RAW" | wc -l | tr -d ' ') · resized: $(ls "$SMALL" | wc -l | tr -d ' ') → $SMALL"
