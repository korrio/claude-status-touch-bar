#!/usr/bin/env node
// Merges the Claude widgets into MTMR's items.json, idempotently.
//
// MTMR executes a source script's *contents* via `bash -c`, so the script
// cannot locate itself (no BASH_SOURCE). We therefore generate tiny
// launchers with the runtime path baked in, and point MTMR at those.
//
// The runtime lives outside TCC-protected folders (Desktop/Documents/
// Downloads) so MTMR/SwiftBar can execute it without a Files-and-Folders
// permission grant — install.sh copies the repo there.

const fs = require('fs');
const path = require('path');
const os = require('os');

const RUNTIME =
  process.env.CLAUDE_TOUCH_RUNTIME ||
  path.join(os.homedir(), '.local', 'share', 'claude-status-touch-bar');
const MTMR_DIR = path.join(os.homedir(), 'Library', 'Application Support', 'MTMR');
const ITEMS = path.join(MTMR_DIR, 'items.json');
const LAUNCHERS = path.join(RUNTIME, 'launchers');

// --- generate launchers (absolute paths, safe under bash -c) ---
fs.mkdirSync(LAUNCHERS, { recursive: true });
const statusSh = path.join(RUNTIME, 'scripts', 'claude-status.sh');
for (const name of ['block', 'week', 'context']) {
  const file = path.join(LAUNCHERS, `${name}.sh`);
  fs.writeFileSync(file, `#!/bin/bash\nexec "${statusSh}" ${name}\n`, { mode: 0o755 });
}

// --- MTMR items ---
const tapAction = {
  trigger: 'singleTap',
  action: 'shellScript',
  executablePath: '/bin/bash',
  shellArguments: [path.join(RUNTIME, 'scripts', 'open-live.sh')],
};

const widgets = [
  {
    type: 'shellScriptTitledButton',
    refreshInterval: 30,
    source: { filePath: path.join(LAUNCHERS, 'block.sh') },
    align: 'right',
    bordered: false,
    actions: [tapAction],
  },
  {
    type: 'shellScriptTitledButton',
    refreshInterval: 300,
    source: { filePath: path.join(LAUNCHERS, 'week.sh') },
    align: 'right',
    bordered: false,
    actions: [tapAction],
  },
  {
    type: 'shellScriptTitledButton',
    refreshInterval: 30,
    source: { filePath: path.join(LAUNCHERS, 'context.sh') },
    align: 'right',
    bordered: false,
    actions: [tapAction],
  },
];

// A minimal, sane preset used only when MTMR has no items.json yet.
// Brightness is exposed as up/down key buttons, not the "brightness"
// slider: the slider drives a legacy display API that silently fails on
// Apple Silicon (MTMR runs under Rosetta), while the key buttons work.
const defaultPreset = [
  { type: 'brightnessDown', align: 'left', width: 60 },
  { type: 'brightnessUp', align: 'left', width: 60 },
  { type: 'timeButton', formatTemplate: 'HH:mm', align: 'right' },
];

fs.mkdirSync(MTMR_DIR, { recursive: true });

let items = defaultPreset;
if (fs.existsSync(ITEMS)) {
  const raw = fs.readFileSync(ITEMS, 'utf8');
  fs.writeFileSync(ITEMS + '.bak', raw); // one-level backup before touching it
  items = JSON.parse(raw);
}

// Drop any previous incarnation of our widgets (old repo paths included).
const OURS = /claude-(status|week|touch)|claude-status-touch-bar/;
items = items.filter((i) => !OURS.test(JSON.stringify(i)));

// Optional: 3 random sticker images next to the brightness buttons.
// Populated by scripts/fetch-sticons.sh into the runtime dir (the images
// are personal-use downloads and are never committed to the repo).
// Re-run this script to reshuffle the pick.
try {
  const STICONS = path.join(RUNTIME, 'sticons', 'small');
  const pool = fs.readdirSync(STICONS).filter((f) => f.endsWith('.png'));
  const pick = pool.sort(() => Math.random() - 0.5).slice(0, 3);
  const at = items.findIndex((i) => i.type === 'brightnessUp') + 1;
  items.splice(
    at > 0 ? at : items.length,
    0,
    ...pick.map((f, idx) => ({
      type: 'staticButton',
      title: '',
      image: { filePath: path.join(STICONS, f) },
      align: 'left',
      width: 34,
      bordered: false,
      // Tap → swap this slot for another random image (MTMR hot-reloads
      // items.json on save, so it changes in place).
      actions: [
        {
          trigger: 'singleTap',
          action: 'shellScript',
          executablePath: '/bin/bash',
          shellArguments: [
            path.join(RUNTIME, 'scripts', 'shuffle-sticon.sh'),
            String(idx),
          ],
        },
      ],
    }))
  );
} catch {}

items.push(...widgets);

fs.writeFileSync(ITEMS, JSON.stringify(items, null, 2) + '\n');
console.log(`Updated ${ITEMS} (${items.length} items, backup at items.json.bak)`);
console.log(`Launchers in ${LAUNCHERS}`);
