#!/bin/bash
# Payload for the Übersicht widget: the graph-mode JSON with the live pet
# state merged in as a top-level "pet" key. Runs every couple of seconds,
# so it must stay cheap — graph mode is served from its 5-minute cache and
# the pet state is a one-line file written by pet-hook.sh.
set -u

DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"

graph="$("$DIR/claude-status.sh" graph 2>/dev/null)"
case "$graph" in
  "{"*) ;;
  *) echo '{}'; exit 0 ;;
esac

pet="$(cat "$HOME/.cache/claude-touchbar/pet-state.json" 2>/dev/null || true)"
case "$pet" in
  "{"*"}") ;;
  *) pet="null" ;;
esac

printf '{"pet":%s,%s' "$pet" "${graph#\{}"
