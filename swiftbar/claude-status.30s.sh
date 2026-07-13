#!/bin/bash
# <xbar.title>Claude Code Status</xbar.title>
# <xbar.version>v1.0</xbar.version>
# <xbar.author>korrio</xbar.author>
# <xbar.author.github>korrio</xbar.author.github>
# <xbar.desc>Claude Code usage: active 5-hour block + rolling 7-day totals</xbar.desc>
# <xbar.dependencies>node</xbar.dependencies>
# <swiftbar.hideRunInTerminal>true</swiftbar.hideRunInTerminal>
# <swiftbar.hideSwiftBar>true</swiftbar.hideSwiftBar>
#
# Delegates to the shared status layer (node discovery + 30s cache).
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/scripts/claude-status.sh" menu
