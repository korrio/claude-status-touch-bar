#!/usr/bin/env node
// Install the Claude Code hooks that feed the desktop widget's pet state
// (~/.cache/claude-touchbar/pet-state.json). Idempotent: replaces its own
// earlier entries, leaves every other hook untouched, and backs up
// ~/.claude/settings.json first. Takes effect in new Claude Code sessions.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const RUNTIME =
  process.env.CLAUDE_TOUCH_RUNTIME ||
  path.join(os.homedir(), '.local', 'share', 'claude-status-touch-bar');
const SETTINGS = path.join(os.homedir(), '.claude', 'settings.json');
const HOOK = path.join(RUNTIME, 'scripts', 'pet-hook.sh');
const MARK = 'claude-status-touch-bar/scripts/pet-hook.sh';

// Tool-matcher events get a matcher; lifecycle events must not.
const EVENTS = [
  ['SessionStart', false],
  ['UserPromptSubmit', false],
  ['PreToolUse', true],
  ['Notification', false],
  ['Stop', false],
  ['SessionEnd', false],
];

let settings = {};
try {
  settings = JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));
  fs.copyFileSync(SETTINGS, SETTINGS + '.bak-pet-hooks');
} catch {}

settings.hooks = settings.hooks || {};
for (const [event, withMatcher] of EVENTS) {
  const entries = (Array.isArray(settings.hooks[event]) ? settings.hooks[event] : [])
    .filter((e) => !JSON.stringify(e).includes(MARK));
  const entry = {
    hooks: [
      {
        type: 'command',
        command: `/bin/bash "${HOOK}" ${event}`,
        timeout: 5,
      },
    ],
  };
  if (withMatcher) entry.matcher = '*';
  entries.push(entry);
  settings.hooks[event] = entries;
}

fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 2) + '\n');
console.log('pet hooks installed in ' + SETTINGS);
