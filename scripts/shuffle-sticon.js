#!/usr/bin/env node
// Swaps one Touch Bar sticker for a random different one from the pool.
// Usage: node shuffle-sticon.js <slot>   (0-based sticker position)
// MTMR watches items.json and hot-reloads on save, so the new image
// appears immediately.

const fs = require('fs');
const path = require('path');
const os = require('os');

const RUNTIME =
  process.env.CLAUDE_TOUCH_RUNTIME ||
  path.join(os.homedir(), '.local', 'share', 'claude-status-touch-bar');
const STICONS = path.join(RUNTIME, 'sticons', 'small');
const ITEMS = path.join(
  os.homedir(), 'Library', 'Application Support', 'MTMR', 'items.json'
);
const slot = Number(process.argv[2] || 0);

const items = JSON.parse(fs.readFileSync(ITEMS, 'utf8'));
const slots = items.filter(
  (i) =>
    i.type === 'staticButton' &&
    i.image &&
    i.image.filePath &&
    i.image.filePath.startsWith(STICONS)
);
const target = slots[slot];
if (!target) process.exit(0);

// Pick from images not currently on the bar so a tap always changes it.
const showing = new Set(slots.map((i) => path.basename(i.image.filePath)));
const pool = fs
  .readdirSync(STICONS)
  .filter((f) => f.endsWith('.png') && !showing.has(f));
if (!pool.length) process.exit(0);

target.image.filePath = path.join(
  STICONS, pool[Math.floor(Math.random() * pool.length)]
);
fs.writeFileSync(ITEMS, JSON.stringify(items, null, 2) + '\n');
