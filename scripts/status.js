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

// --- Real plan quota, from the same OAuth usage API /usage uses ---

function readOAuthToken() {
  // Linux / older installs keep a credentials file; macOS uses the Keychain.
  try {
    const j = JSON.parse(
      fs.readFileSync(path.join(os.homedir(), '.claude', '.credentials.json'), 'utf8')
    );
    const t = (j.claudeAiOauth || j).accessToken;
    if (t) return t;
  } catch {}
  try {
    const out = execFileSync(
      '/usr/bin/security',
      ['find-generic-password', '-s', 'Claude Code-credentials', '-w'],
      { encoding: 'utf8', timeout: 5000 }
    );
    const j = JSON.parse(out);
    return (j.claudeAiOauth || j).accessToken || null;
  } catch {}
  return null;
}

// Fetches 5h/7d utilization + reset times. Cached 60s; the token is only
// ever sent to api.anthropic.com and never written to disk. Returns null on
// any failure so callers can fall back to local-log estimates.
function fetchQuota() {
  const cacheFile = path.join(os.homedir(), '.cache', 'claude-touchbar', 'quota.json');
  try {
    if (Date.now() - fs.statSync(cacheFile).mtimeMs < 60000) {
      return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    }
  } catch {}
  const token = readOAuthToken();
  if (!token) return null;
  try {
    const out = execFileSync(
      '/usr/bin/curl',
      [
        '-s', '-m', '10',
        'https://api.anthropic.com/api/oauth/usage',
        '-H', `Authorization: Bearer ${token}`,
        '-H', 'anthropic-beta: oauth-2025-04-20',
      ],
      { encoding: 'utf8', timeout: 15000 }
    );
    const j = JSON.parse(out);
    if (!j.five_hour) throw new Error('unexpected response');
    const quota = {
      fiveHour: { pct: j.five_hour.utilization, resetsAt: j.five_hour.resets_at },
      sevenDay: { pct: j.seven_day.utilization, resetsAt: j.seven_day.resets_at },
      scoped: (j.limits || [])
        .filter((l) => l.kind === 'weekly_scoped' && l.scope && l.scope.model)
        .map((l) => ({ model: l.scope.model.display_name, pct: l.percent })),
    };
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify(quota));
    return quota;
  } catch {
    // Stale cache beats nothing if the network is down.
    try { return JSON.parse(fs.readFileSync(cacheFile, 'utf8')); } catch {}
    return null;
  }
}

function minsUntil(iso) {
  return Math.max(0, Math.round((Date.parse(iso) - Date.now()) / 60000));
}
function fmtMins(mins) {
  return `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, '0')}`;
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
    const q = fetchQuota();
    const { blocks } = ccusage(['blocks']);
    const b = (blocks || []).find((x) => x.isActive);
    if (q && q.fiveHour && q.fiveHour.pct != null) {
      // Real plan quota from the OAuth usage API.
      const frac = q.fiveHour.pct / 100;
      const parts = [`5H ${fmtBar(frac, 8)} ${Math.round(q.fiveHour.pct)}%`];
      if (b) parts.push(fmtCost(b.costUSD));
      parts.push(`⏳${fmtMins(minsUntil(q.fiveHour.resetsAt))}`);
      console.log(parts.join(' '));
      process.exit(0);
    }
    // Fallback: % of the largest-ever block, a self-calibrating limit proxy.
    if (!b) {
      console.log('5H ░░░░░░░░ idle');
      process.exit(0);
    }
    const maxTokens = Math.max(
      ...(blocks || []).filter((x) => !x.isGap).map((x) => x.totalTokens || 0)
    );
    const frac = maxTokens ? Math.min(1, b.totalTokens / maxTokens) : 0;
    const mins = Math.max(0, Math.round((new Date(b.endTime) - Date.now()) / 60000));
    console.log(
      `5H ${fmtBar(frac, 8)} ~${Math.round(frac * 100)}% ${fmtCost(b.costUSD)} ⏳${fmtMins(mins)}`
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
    const q = fetchQuota();
    const since = new Date(Date.now() - 7 * 86400000);
    const ymd =
      since.getFullYear() * 10000 + (since.getMonth() + 1) * 100 + since.getDate();
    const { totals } = ccusage(['daily', '--since', String(ymd)]);
    if (q && q.sevenDay && q.sevenDay.pct != null) {
      console.log(
        `7D ${fmtBar(q.sevenDay.pct / 100, 5)} ${Math.round(q.sevenDay.pct)}% ${fmtCost(totals.totalCost)}`
      );
    } else {
      console.log(`7D ${fmtCost(totals.totalCost)} · ${fmtTokens(totals.totalTokens)}`);
    }
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

    const q = fetchQuota();
    const L = [];
    if (block) {
      const mins = Math.max(0, Math.round((new Date(block.endTime) - Date.now()) / 60000));
      const reset = `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, '0')}`;
      const pct =
        q && q.fiveHour && q.fiveHour.pct != null
          ? `${Math.round(q.fiveHour.pct)}% · `
          : '';
      L.push(`✳ ${pct}${fmtCost(block.costUSD)} ⏳${reset}`);
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
    if (q) {
      L.push('---');
      const scoped = (q.scoped || [])
        .map((s) => ` · ${s.model} ${Math.round(s.pct)}%`)
        .join('');
      L.push(
        `Plan quota: 5H ${Math.round(q.fiveHour.pct)}% · 7D ${Math.round(q.sevenDay.pct)}%${scoped}`
      );
      L.push(`Weekly resets ${new Date(q.sevenDay.resetsAt).toLocaleString()}`);
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
        quota: fetchQuota(),
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
