#!/bin/bash
# MTMR wrapper for the 7-day widget (MTMR can't pass args to source scripts).
exec "$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)/claude-status.sh" week
