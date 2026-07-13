#!/usr/bin/env node
// Merges the Claude widgets into MTMR's items.json, idempotently:
// removes any previous items pointing at this project, then appends fresh ones.

const fs = require('fs');
const path = require('path');
const os = require('os');

const PROJECT = path.resolve(__dirname, '..');
const MTMR_DIR = path.join(os.homedir(), 'Library', 'Application Support', 'MTMR');
const ITEMS = path.join(MTMR_DIR, 'items.json');

const tapAction = {
  trigger: 'singleTap',
  action: 'shellScript',
  executablePath: '/bin/bash',
  shellArguments: [path.join(PROJECT, 'scripts', 'open-live.sh')],
};

const widgets = [
  {
    type: 'shellScriptTitledButton',
    refreshInterval: 30,
    source: { filePath: path.join(PROJECT, 'scripts', 'claude-status.sh') },
    align: 'right',
    bordered: true,
    actions: [tapAction],
  },
  {
    type: 'shellScriptTitledButton',
    refreshInterval: 300,
    source: { filePath: path.join(PROJECT, 'scripts', 'claude-week.sh') },
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

const refersToProject = (item) =>
  JSON.stringify(item).includes(PROJECT);

items = items.filter((i) => !refersToProject(i));
items.push(...widgets);

fs.writeFileSync(ITEMS, JSON.stringify(items, null, 2) + '\n');
console.log(`Updated ${ITEMS} (${items.length} items, backup at items.json.bak)`);
