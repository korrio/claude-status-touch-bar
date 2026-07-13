#!/bin/bash
# Live dashboard: re-renders recent 5-hour blocks every 5 s (Ctrl+C to quit).
# Replaces `ccusage blocks --live`, which was removed in ccusage v20.
DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd)"
CC="$DIR/node_modules/.bin/ccusage"

trap 'exit 0' INT
while true; do
  out="$("$CC" blocks --recent --color 2>&1)"
  clear
  printf '%s\n\n  ↻ refreshes every 5 s — Ctrl+C to quit\n' "$out"
  sleep 5
done
