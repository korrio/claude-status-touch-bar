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
for (const [name, arg] of [['block', 'block'], ['week', 'week']]) {
  const file = path.join(LAUNCHERS, `${name}.sh`);
  fs.writeFileSync(file, `#!/bin/bash\nexec "${statusSh}" ${arg}\n`, { mode: 0o755 });
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
    bordered: true,
    actions: [tapAction],
  },
  {
    type: 'shellScriptTitledButton',
    refreshInterval: 300,
    source: { filePath: path.join(LAUNCHERS, 'week.sh') },
    align: 'right',
    bordered: true,
    actions: [tapAction],
  },
];

// A minimal, sane preset used only when MTMR has no items.json yet.
const defaultPreset = [
  { type: 'escape', width: 110 },
  { type: 'dock', align: 'left' },
  { type: 'brightness', align: 'right', width: 100 },
  { type: 'volume', align: 'right', width: 100 },
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
items.push(...widgets);

fs.writeFileSync(ITEMS, JSON.stringify(items, null, 2) + '\n');
console.log(`Updated ${ITEMS} (${items.length} items, backup at items.json.bak)`);
console.log(`Launchers in ${LAUNCHERS}`);
