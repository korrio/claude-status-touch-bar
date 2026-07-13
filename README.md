# Claude Status Touch Bar

Live **Claude Code** usage status on the MacBook Pro Touch Bar — and in the
macOS menu bar via SwiftBar.

```
┌─────┬──────┐   ┌──────────────────────────────────┬────────────────┐   ┌────┬────┬───────┐
│ esc │ dock │   │ ✳ fable · $20.52 · 23.5M ⏳2h20  │ 7D $337 · 639M │   │ 🔆 │ 🔊 │ 11:39 │
└─────┴──────┘   └──────────────────────────────────┴────────────────┘   └────┴────┴───────┘
```

Inspired by [codex-status-touch-bar](https://github.com/binlabongbom/codex-status-touch-bar),
which does this for OpenAI Codex with a native Swift app. This project takes a
lighter route: it builds on [MTMR](https://github.com/Toxblh/MTMR) (My TouchBar
My Rules) and plain shell/Node scripts — no Xcode build, no private macOS APIs,
nothing to re-sign after OS updates.

🇹🇭 [อ่านภาษาไทย](docs/README.th.md)

## What you get

Two tappable buttons on the right side of the Touch Bar:

| Widget | Example | Shows | Refresh |
|---|---|---|---|
| **5-hour block** | `✳ fable · $20.52 · 23.5M ⏳2h20` | current model · cost & tokens in the active 5-hour billing block · time until the block resets | 30 s |
| **7-day window** | `7D $337 · 639.4M` | rolling 7-day cost & tokens | 5 min |

**Tap either button** to open a live dashboard in Terminal — recent 5-hour
blocks with burn rate and projections, auto-refreshing every 5 seconds.

### Menu bar widget (SwiftBar)

The same status also lives in the menu bar (works on Macs without a Touch
Bar too): `✳ $27.31 ⏳2h02` with a dropdown showing the full detail —

```
5-hour block — resets 14:00 (in 2h02)
$27.31 · 26.9M tokens
Burn $10.49/h → projected $48.63 · 47.9M
Models: opus-4-8, fable-5
---
Last 7 days: $345 · 647.0M tokens
---
Open live dashboard
Refresh
```

## Requirements

- MacBook Pro with a Touch Bar
- macOS 12+ (tested on Sonoma 14.7, Apple Silicon M2)
- [Homebrew](https://brew.sh) and Node.js 18+
- [Claude Code](https://claude.com/claude-code) — the data source
- On Apple Silicon: Rosetta 2 for MTMR
  (`softwareupdate --install-rosetta --agree-to-license`)

## Install

```bash
git clone https://github.com/korrio/claude-status-touch-bar.git
cd claude-status-touch-bar
bash scripts/install.sh
```

The installer:

1. installs the `ccusage` npm dependency locally (no globals),
2. installs MTMR and SwiftBar via Homebrew if they aren't present,
3. merges the two widgets into `~/Library/Application Support/MTMR/items.json`
   — your existing MTMR config is preserved and backed up to `items.json.bak`,
4. registers the SwiftBar plugin (points SwiftBar at `swiftbar/`, or symlinks
   into your existing plugin folder if you already use SwiftBar),
5. (re)starts MTMR and SwiftBar.

> **First launch:** macOS will ask you to grant MTMR **Accessibility**
> permission (*System Settings → Privacy & Security → Accessibility*). The
> custom Touch Bar only appears after you grant it.

## How it works

```
~/.claude/projects/**/*.jsonl          Claude Code session logs (local)
        │
        ▼
ccusage (local npm dep)                aggregates into 5h blocks / daily totals
        │
        ▼
scripts/status.js                      formats one compact line, detects model
        │
        ▼
scripts/claude-status.sh               caches 30s / 5min so the bar never blocks
        │
        ▼
MTMR shellScriptTitledButton           renders it on the Touch Bar
SwiftBar plugin (swiftbar/*.30s.sh)    renders it in the menu bar
```

Everything is computed from Claude Code's **local session logs** — the same
technique the Codex project uses. Only token counts and timestamps are read;
no prompts or responses, and nothing leaves your machine.

## Customization

- **Refresh rates**: edit `refreshInterval` in
  `~/Library/Application Support/MTMR/items.json` and the `TTL` values in
  `scripts/claude-status.sh`.
- **Text format**: edit `scripts/status.js` (the `block` / `week` branches).
- **Tap action**: `scripts/open-live.sh` — point it at anything
  (`claude`, `ccusage daily`, htop…).
- Re-run `node scripts/merge-items.js` after moving the project directory;
  it's idempotent and replaces stale entries.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Touch Bar unchanged after install | Grant MTMR Accessibility permission, then quit & reopen MTMR |
| `✳ no node` on the bar | MTMR runs scripts with a minimal `PATH`; `claude-status.sh` probes nvm/Homebrew locations — add yours if node lives elsewhere |
| `✳ —` on the bar | `ccusage` failed; run `./node_modules/.bin/ccusage blocks --json --active` in the project dir to see why |
| Stale numbers | Delete `~/.cache/claude-touchbar/` to force a refresh |
| MTMR won't open on Apple Silicon | Install Rosetta 2 (see Requirements) |

## Uninstall

```bash
pkill -x MTMR; pkill -x SwiftBar
cp ~/Library/Application\ Support/MTMR/items.json.bak \
   ~/Library/Application\ Support/MTMR/items.json   # restore old config
brew uninstall --cask mtmr swiftbar                 # optional
rm -rf ~/.cache/claude-touchbar
```

## Project structure

```
scripts/status.js         data collector — ccusage aggregation + model detection
scripts/claude-status.sh  MTMR entry point with caching (block widget)
scripts/claude-week.sh    wrapper for the 7-day widget
scripts/open-live.sh      tap action → opens live.sh in Terminal
scripts/live.sh           auto-refreshing blocks dashboard (5 s)
scripts/merge-items.js    idempotent merge into MTMR items.json
scripts/install.sh        one-shot installer
swiftbar/claude-status.30s.sh  SwiftBar/xbar menu bar plugin
docs/README.th.md         Thai documentation
```

## Limitations

- Costs are computed from local logs with public API pricing — close to, but
  not exactly, the official `/usage` meters, and plan quota **percentages**
  aren't available locally (Anthropic doesn't expose them offline).
- The model name comes from the tail of the most recently active session log,
  i.e. the last model used anywhere, not per-project.
- MTMR replaces the system Touch Bar layout; the merged preset keeps
  escape/brightness/volume/clock, but app-specific system buttons go away.

## Credits

- [codex-status-touch-bar](https://github.com/binlabongbom/codex-status-touch-bar) — the idea
- [MTMR](https://github.com/Toxblh/MTMR) — Touch Bar rendering
- [SwiftBar](https://github.com/swiftbar/SwiftBar) — menu bar rendering
- [ccusage](https://github.com/ryoppippi/ccusage) — Claude Code usage aggregation

## License

[MIT](LICENSE)
