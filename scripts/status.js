#!/usr/bin/env node
// Collects Claude Code status from local session data (~/.claude/projects)
// and prints one compact line for the Touch Bar.
//
// Usage: node status.js block   -> "✳ fable · $15.63 · 21.0M ⏳2h23"
//        node status.js week    -> "7D $336 · 639M"
//        node status.js menu    -> full SwiftBar/xbar plugin output

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

// Current model = last "model" seen in the most recently modified session log.
function currentModel() {
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
    // Read only the tail of the log; session files can be large.
    const size = fs.statSync(newest.p).size;
    const fd = fs.openSync(newest.p, 'r');
    const len = Math.min(size, 256 * 1024);
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, size - len);
    fs.closeSync(fd);
    const matches = buf.toString('utf8').match(/"model"\s*:\s*"(claude-[^"]+)"/g);
    if (!matches) return '';
    const last = matches[matches.length - 1].match(/"(claude-[^"]+)"/)[1];
    return last.replace(/^claude-/, '').replace(/-[\d-]+$/, '').split('-')[0];
  } catch {
    return '';
  }
}

try {
  if (mode === 'block') {
    const { blocks } = ccusage(['blocks', '--active']);
    const b = blocks && blocks[0];
    if (!b) {
      console.log('✳ idle');
      process.exit(0);
    }
    const mins = Math.max(0, Math.round((new Date(b.endTime) - Date.now()) / 60000));
    const reset = `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, '0')}`;
    const model = currentModel();
    const parts = ['✳'];
    if (model) parts.push(model, '·');
    parts.push(fmtCost(b.costUSD), '·', fmtTokens(b.totalTokens), `⏳${reset}`);
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
  } else {
    console.error(`unknown mode: ${mode}`);
    process.exit(1);
  }
} catch (e) {
  console.log(mode === 'week' ? '7D —' : '✳ —');
}
