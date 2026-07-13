#!/usr/bin/env node
// Collects Claude Code status from local session data (~/.claude/projects)
// and prints one compact line for the Touch Bar.
//
// Usage: node status.js block   -> "5H █████░░░ 65% $42 ⏳1h47"
//        node status.js week    -> "7D $336 · 639M"
//        node status.js context -> "✳ fable-5 ▓▓▓░ 147K/200K"
//        node status.js menu    -> full SwiftBar/xbar plugin output
//        node status.js graph   -> JSON for the Übersicht desktop widget:
//                                  48 half-hour token bins (24h) per model,
//                                  plus block/week summaries

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Resolve the .bin symlink and run it with our own node binary: MTMR and
// SwiftBar spawn plugins with a minimal PATH where `#!/usr/bin/env node`
// shebangs fail.
const CCUSAGE = fs.realpathSync(
  path.join(__dirname, '..', 'node_modules', '.bin', 'ccusage')
);
const mode = process.argv[2] || 'block';

function ccusage(args) {
  const out = execFileSync(process.execPath, [CCUSAGE, ...args, '--json'], {
    encoding: 'utf8',
    timeout: 30000,
    env: {
      ...process.env,
      NO_COLOR: '1',
      PATH: `${path.dirname(process.execPath)}:${process.env.PATH || '/usr/bin:/bin'}`,
    },
  });
  return JSON.parse(out);
}

function fmtTokens(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return Math.round(n / 1e3) + 'K';
  return String(n);
}

function fmtCost(c) {
  return '$' + (c >= 100 ? Math.round(c) : c.toFixed(2));
}

function fmtBar(frac, width) {
  const filled = Math.max(0, Math.min(width, Math.round(frac * width)));
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

// Tail of the most recently modified session log (sessions can be large).
function latestSessionTail() {
  try {
    const projects = path.join(os.homedir(), '.claude', 'projects');
    let newest = null;
    for (const dir of fs.readdirSync(projects)) {
      const full = path.join(projects, dir);
      let files;
      try { files = fs.readdirSync(full); } catch { continue; }
      for (const f of files) {
        if (!f.endsWith('.jsonl')) continue;
        const p = path.join(full, f);
        const m = fs.statSync(p).mtimeMs;
        if (!newest || m > newest.m) newest = { p, m };
      }
    }
    if (!newest) return '';
    const size = fs.statSync(newest.p).size;
    const fd = fs.openSync(newest.p, 'r');
    const len = Math.min(size, 256 * 1024);
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, size - len);
    fs.closeSync(fd);
    return buf.toString('utf8');
  } catch {
    return '';
  }
}

// Current model = last "model" seen in the newest session log.
function currentModel(shorten = true) {
  const matches = latestSessionTail().match(/"model"\s*:\s*"(claude-[^"]+)"/g);
  if (!matches) return '';
  const last = matches[matches.length - 1].match(/"(claude-[^"]+)"/)[1];
  const name = last.replace(/^claude-/, '').replace(/-\d{8}$/, '');
  return shorten ? name.split('-')[0] : name;
}

// Current conversation's context usage from the newest session log's last
// usage entry: input + cache read + cache creation ≈ tokens in the window.
function contextUsage() {
  const lines = latestSessionTail().split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].includes('"usage"')) continue;
    try {
      const j = JSON.parse(lines[i]); // first line of the tail may be truncated
      const u = j.message && j.message.usage;
      if (!u) continue;
      const used =
        (u.input_tokens || 0) +
        (u.cache_read_input_tokens || 0) +
        (u.cache_creation_input_tokens || 0);
      if (used > 0) return used;
    } catch {}
  }
  return null;
}

try {
  if (mode === 'block') {
    // All blocks in one call: the active one plus the historical maximum,
    // which serves as a self-calibrating stand-in for the plan's 5h limit.
    const { blocks } = ccusage(['blocks']);
    const b = (blocks || []).find((x) => x.isActive);
    if (!b) {
      console.log('5H ░░░░░░░░ idle');
      process.exit(0);
    }
    const maxTokens = Math.max(
      ...(blocks || []).filter((x) => !x.isGap).map((x) => x.totalTokens || 0)
    );
    const frac = maxTokens ? Math.min(1, b.totalTokens / maxTokens) : 0;
    const mins = Math.max(0, Math.round((new Date(b.endTime) - Date.now()) / 60000));
    const reset = `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, '0')}`;
    console.log(
      `5H ${fmtBar(frac, 8)} ${Math.round(frac * 100)}% ${fmtCost(b.costUSD)} ⏳${reset}`
    );
  } else if (mode === 'context') {
    const model = currentModel(false);
    const used = contextUsage();
    if (!model && used == null) {
      console.log('✳ no session');
      process.exit(0);
    }
    const win = Number(process.env.CLAUDE_CONTEXT_WINDOW || 200000);
    const parts = ['✳', model || '?'];
    if (used != null) {
      parts.push(fmtBar(used / win, 4), `${fmtTokens(used)}/${fmtTokens(win)}`);
    }
    console.log(parts.join(' '));
  } else if (mode === 'week') {
    const since = new Date(Date.now() - 7 * 86400000);
    const ymd =
      since.getFullYear() * 10000 + (since.getMonth() + 1) * 100 + since.getDate();
    const { totals } = ccusage(['daily', '--since', String(ymd)]);
    console.log(`7D ${fmtCost(totals.totalCost)} · ${fmtTokens(totals.totalTokens)}`);
  } else if (mode === 'menu') {
    // SwiftBar/xbar plugin body: menu bar line, then dropdown after "---".
    let block = null;
    let totals = null;
    try {
      block = (ccusage(['blocks', '--active']).blocks || [])[0] || null;
    } catch {}
    try {
      const since = new Date(Date.now() - 7 * 86400000);
      const ymd =
        since.getFullYear() * 10000 + (since.getMonth() + 1) * 100 + since.getDate();
      totals = ccusage(['daily', '--since', String(ymd)]).totals || null;
    } catch {}

    const L = [];
    if (block) {
      const mins = Math.max(0, Math.round((new Date(block.endTime) - Date.now()) / 60000));
      const reset = `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, '0')}`;
      L.push(`✳ ${fmtCost(block.costUSD)} ⏳${reset}`);
      L.push('---');
      const end = new Date(block.endTime);
      const hhmm = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
      L.push(`5-hour block — resets ${hhmm} (in ${reset})`);
      L.push(`${fmtCost(block.costUSD)} · ${fmtTokens(block.totalTokens)} tokens`);
      if (block.burnRate && block.projection) {
        L.push(
          `Burn ${fmtCost(block.burnRate.costPerHour)}/h → projected ` +
            `${fmtCost(block.projection.totalCost)} · ${fmtTokens(block.projection.totalTokens)}`
        );
      }
      const models = (block.models || []).map((m) => m.replace(/^claude-/, ''));
      if (models.length) L.push(`Models: ${models.join(', ')}`);
    } else {
      L.push('✳ idle');
      L.push('---');
      L.push('No active 5-hour block');
    }
    L.push('---');
    L.push(
      totals
        ? `Last 7 days: ${fmtCost(totals.totalCost)} · ${fmtTokens(totals.totalTokens)} tokens`
        : 'Last 7 days: —'
    );
    L.push('---');
    L.push(
      `Open live dashboard | bash="${path.join(__dirname, 'live.sh')}" terminal=true`
    );
    L.push('Refresh | refresh=true');
    console.log(L.join('\n'));
  } else if (mode === 'graph') {
    const BIN_MS = 30 * 60 * 1000;
    const now = Date.now();
    const end = Math.ceil(now / BIN_MS) * BIN_MS;
    const start = end - 48 * BIN_MS;
    const bins = Array.from({ length: 48 }, (_, i) => ({
      t: start + i * BIN_MS,
      models: {},
    }));

    const projects = path.join(os.homedir(), '.claude', 'projects');
    const seen = new Set();
    let dirs = [];
    try { dirs = fs.readdirSync(projects); } catch {}
    for (const dir of dirs) {
      const full = path.join(projects, dir);
      let files = [];
      try { files = fs.readdirSync(full); } catch { continue; }
      for (const f of files) {
        if (!f.endsWith('.jsonl')) continue;
        const p = path.join(full, f);
        let st;
        try { st = fs.statSync(p); } catch { continue; }
        if (st.mtimeMs < start) continue; // no entries in our window
        let lines;
        try { lines = fs.readFileSync(p, 'utf8').split('\n'); } catch { continue; }
        for (const line of lines) {
          if (!line.includes('"usage"')) continue;
          let j;
          try { j = JSON.parse(line); } catch { continue; }
          const ts = Date.parse(j.timestamp);
          if (!(ts >= start && ts < end)) continue;
          const u = j.message && j.message.usage;
          if (!u) continue;
          const id = `${(j.message && j.message.id) || ''}:${j.requestId || ''}`;
          if (id !== ':' && seen.has(id)) continue;
          seen.add(id);
          const tokens =
            (u.input_tokens || 0) +
            (u.output_tokens || 0) +
            (u.cache_creation_input_tokens || 0) +
            (u.cache_read_input_tokens || 0);
          if (!tokens) continue;
          const model = ((j.message && j.message.model) || 'other')
            .replace(/^claude-/, '')
            .replace(/-\d{8}$/, '');
          const bin = bins[Math.floor((ts - start) / BIN_MS)];
          bin.models[model] = (bin.models[model] || 0) + tokens;
        }
      }
    }

    let block = null;
    let totals = null;
    try { block = (ccusage(['blocks', '--active']).blocks || [])[0] || null; } catch {}
    try {
      const since = new Date(now - 7 * 86400000);
      const ymd =
        since.getFullYear() * 10000 + (since.getMonth() + 1) * 100 + since.getDate();
      totals = ccusage(['daily', '--since', String(ymd)]).totals || null;
    } catch {}

    console.log(
      JSON.stringify({
        generatedAt: now,
        bins,
        block: block && {
          cost: block.costUSD,
          tokens: block.totalTokens,
          startTime: block.startTime,
          endTime: block.endTime,
          projectedCost: block.projection ? block.projection.totalCost : null,
          models: (block.models || []).map((m) => m.replace(/^claude-/, '')),
        },
        week: totals && { cost: totals.totalCost, tokens: totals.totalTokens },
      })
    );
  } else {
    console.error(`unknown mode: ${mode}`);
    process.exit(1);
  }
} catch (e) {
  if (mode === 'graph') console.log('{}');
  else console.log(mode === 'week' ? '7D —' : '✳ —');
}
