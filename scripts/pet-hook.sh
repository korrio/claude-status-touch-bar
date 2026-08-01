#!/bin/bash
# Claude Code hook → desktop-pet state (tamaclaude-style mascot in the
# Übersicht widget). Called as: pet-hook.sh <HookEventName>, hook input
# JSON on stdin. Must stay fast and always exit 0 — a non-zero exit from
# PreToolUse would block the tool call itself.
set -u

EVENT="${1:-}"
CACHE="$HOME/.cache/claude-touchbar"
INPUT="$(cat 2>/dev/null || true)"

state=""
case "$EVENT" in
  SessionStart)     state="idle" ;;
  UserPromptSubmit) state="thinking" ;;
  Notification)     state="alert" ;;
  Stop)             state="celebrate" ;;
  SessionEnd)       state="sleeping" ;;
  PreToolUse)
    # Tool → visual state, same table tamaclaude's daemon uses.
    tool="$(printf '%s' "$INPUT" | sed -n 's/.*"tool_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
    case "$tool" in
      Read|Grep|Glob|NotebookRead)                 state="reading" ;;
      Edit|Write|MultiEdit|NotebookEdit|TodoWrite) state="writing" ;;
      Bash|BashOutput|KillShell)                   state="building" ;;
      WebSearch|WebFetch)                          state="searching" ;;
      mcp__*|LSP|ListMcpResourcesTool|ReadMcpResourceTool) state="beacon" ;;
      *)                                           state="thinking" ;;
    esac ;;
  *) exit 0 ;;
esac

mkdir -p "$CACHE" 2>/dev/null || exit 0
printf '{"state":"%s","t":%s}\n' "$state" "$(($(date +%s) * 1000))" \
  > "$CACHE/pet-state.json.tmp" 2>/dev/null \
  && mv -f "$CACHE/pet-state.json.tmp" "$CACHE/pet-state.json" 2>/dev/null
exit 0
