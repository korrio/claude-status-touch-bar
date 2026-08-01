// Claude Code usage — Übersicht desktop widget.
// 24-hour token activity (48 half-hour bars, stacked per model), active
// 5-hour block summary, and rolling 7-day totals. Data comes from the
// shared status layer's `graph` mode (cached 5 min).

import { PET_PALETTE, PET_BOX, PET_STATES } from "./lib/pet-frames.js";

// widget-data.sh = graph mode (served from its 5-min cache) + the live pet
// state, so the fast refresh below only costs a bash spawn and two cats.
export const command =
  "$HOME/.local/share/claude-status-touch-bar/scripts/widget-data.sh";

// Fast refresh keeps the pet reacting to Claude Code hook events within
// ~2s; the heavy data underneath is still cached by the status layer.
export const refreshFrequency = 2 * 1000;

// The quota line chart starts collapsed (one header line) to save space;
// clicking the PLAN QUOTA header toggles it. Needs "Interaction" enabled
// in the Übersicht menu-bar menu for clicks to reach the widget.
export const initialState = { output: "", chartOpen: false };

export const updateState = (event, prev) => {
  switch (event.type) {
    case "UB/COMMAND_RAN":
      return Object.assign({}, prev, { output: event.output });
    case "TOGGLE_CHART":
      return Object.assign({}, prev, { chartOpen: !prev.chartOpen });
    default:
      return prev;
  }
};

// Fixed model→hue assignment (validated categorical palette, dark surface).
// Color follows the model, never its rank in the current window.
const MODEL_HUES = [
  [/^fable/, "#3987e5"],
  [/^opus/, "#199e70"],
  [/^sonnet/, "#c98500"],
  [/^haiku/, "#e66767"],
];
const OTHER_HUE = "#898781";
const MODEL_ORDER = ["fable", "opus", "sonnet", "haiku"];

const INK = "#ffffff";
const INK_SECONDARY = "#c3c2b7";
const INK_MUTED = "#898781";
const HAIRLINE = "rgba(255,255,255,0.10)";
const TRACK = "#383835";

export const className = `
  top: 36px;
  right: 24px;
  width: 340px;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  color: ${INK};
  background: rgba(26, 26, 25, 0.85);
  border: 1px solid ${HAIRLINE};
  border-radius: 14px;
  padding: 16px 18px;
  -webkit-backdrop-filter: blur(24px);
  z-index: 1;
`;

const familyOf = (model) => {
  for (const [re] of MODEL_HUES) if (re.test(model)) return re.source.slice(1);
  return "other";
};
const hueFor = (family) => {
  for (const [re, hue] of MODEL_HUES) if (re.test(family)) return hue;
  return OTHER_HUE;
};

// Quota line chart series colors (same validated palette).
const QUOTA_COLORS = ["#3987e5", "#199e70", "#c98500", "#e66767"];

// Catmull-Rom → cubic bezier, for smooth quota lines.
const smoothPath = (pts) => {
  if (pts.length < 2) return "";
  let p = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    p +=
      ` C ${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)}` +
      ` ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)},` +
      ` ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)}` +
      ` ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)},` +
      ` ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return p;
};

// Split a series into segments wherever sampling gapped (Mac asleep, app
// closed) so the line doesn't lie across the gap.
const segment = (pts, maxGapMs) => {
  const segs = [];
  let cur = [];
  for (const p of pts) {
    if (cur.length && p.t - cur[cur.length - 1].t > maxGapMs) {
      if (cur.length >= 2) segs.push(cur);
      cur = [];
    }
    cur.push(p);
  }
  if (cur.length >= 2) segs.push(cur);
  return segs;
};

// --- tamaclaude pet ---------------------------------------------------------
// Mascot by tamaclaude (github.com/thaitop/tamaclaude, MIT). Each state is
// 12 pre-rendered frames of rounded rects; frame switching is a CSS opacity
// animation phase-locked to the wall clock, so the 2s re-renders never
// stutter the loop.
const PET_T = 1200; // ms per animation loop

const petVisualState = (pet) => {
  if (!pet || !pet.state || !PET_STATES[pet.state]) return "sleeping";
  const age = Date.now() - (pet.t || 0);
  let s = pet.state;
  if (s === "celebrate" && age > 8000) s = "waiting"; // party's over, now waiting on you
  if (s === "alert" && age > 3 * 60000) s = "waiting";
  if (age > 10 * 60000) s = "sleeping"; // stale state = session gone quiet
  return s;
};

const Pet = ({ state, height }) => {
  const frames = PET_STATES[state] || PET_STATES.idle;
  const n = frames.length;
  const [bx0, by0, bx1, by1] = PET_BOX;
  const now = Date.now();
  const cur = Math.floor(((now % PET_T) / PET_T) * n) % n;
  return (
    <svg
      width={(height * (bx1 - bx0)) / (by1 - by0)}
      height={height}
      viewBox={`${bx0} ${by0} ${bx1 - bx0} ${by1 - by0}`}
      style={{ display: "block", overflow: "visible" }}
    >
      <style>{`@keyframes tcpetf { 0%, ${(100 / n - 0.04).toFixed(2)}% { opacity: 1 } ${(100 / n).toFixed(2)}%, 100% { opacity: 0 } }`}</style>
      {frames.map((rects, k) => {
        // Negative delay aligns frame k's visible window to wall-clock
        // phase slot k, keeping playback continuous across re-renders.
        let delay = (k * PET_T) / n - (now % PET_T);
        if (delay > 0) delay -= PET_T;
        return (
          <g
            key={k}
            style={{
              opacity: k === cur ? 1 : 0,
              animation: `tcpetf ${PET_T}ms linear infinite`,
              animationDelay: `${Math.round(delay)}ms`,
            }}
          >
            {rects.map(([x, y, w, h, c, r], j) => (
              <rect
                key={j}
                x={x} y={y} width={w} height={h}
                rx={r || 0}
                fill={PET_PALETTE[c]}
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
};

const fmtTok = (n) =>
  n >= 1e9 ? (n / 1e9).toFixed(1) + "B"
  : n >= 1e6 ? (n / 1e6).toFixed(1) + "M"
  : n >= 1e3 ? Math.round(n / 1e3) + "K"
  : String(n);
const fmtCost = (c) => "$" + (c >= 100 ? Math.round(c) : c.toFixed(2));
const hhmm = (t) => {
  const d = new Date(t);
  return (
    String(d.getHours()).padStart(2, "0") +
    ":" +
    String(d.getMinutes()).padStart(2, "0")
  );
};

export const render = ({ output, chartOpen }, dispatch) => {
  let d = null;
  try { d = JSON.parse(output); } catch (e) {}
  if (!d || !d.bins) {
    return (
      <div style={{ fontSize: 12, color: INK_MUTED }}>
        Claude Code — waiting for data…
      </div>
    );
  }

  // Aggregate bins by model family, in fixed order.
  const bins = d.bins.map((b) => {
    const perFamily = {};
    let total = 0;
    for (const [model, tok] of Object.entries(b.models || {})) {
      const fam = familyOf(model);
      perFamily[fam] = (perFamily[fam] || 0) + tok;
      total += tok;
    }
    return { t: b.t, perFamily, total };
  });
  const maxTotal = Math.max(1, ...bins.map((b) => b.total));
  const peakIdx = bins.findIndex((b) => b.total === maxTotal);
  const families = MODEL_ORDER.concat(["other"]).filter((f) =>
    bins.some((b) => b.perFamily[f])
  );

  // Quota history → line chart series, sharing the bars' 24h time domain.
  const domainStart = bins.length ? bins[0].t : Date.now() - 86400000;
  const domainMs = 48 * 30 * 60 * 1000;
  const qh = (d.quotaHistory || []).filter((s) => s.t >= domainStart);
  const scopedNames = [];
  for (const s of qh)
    for (const m of Object.keys(s.sc || {}))
      if (scopedNames.indexOf(m) < 0) scopedNames.push(m);
  const series = [
    { label: "5H", pts: qh.map((s) => ({ t: s.t, v: s.five })) },
    { label: "7D", pts: qh.map((s) => ({ t: s.t, v: s.seven })) },
  ]
    .concat(
      scopedNames.map((m) => ({
        label: m.toUpperCase() + " 7D",
        pts: qh
          .filter((s) => (s.sc || {})[m] != null)
          .map((s) => ({ t: s.t, v: s.sc[m] })),
      }))
    )
    .map((s, i) =>
      Object.assign({}, s, { color: QUOTA_COLORS[i % QUOTA_COLORS.length] })
    )
    .filter((s) => s.pts.length >= 2);
  const showChart = series.length > 0;
  // Current values for the chart header (live quota beats last sample).
  const qNow = d.quota || {};
  const headerVals = showChart
    ? series.map((s) => {
        let v = s.pts[s.pts.length - 1].v;
        if (s.label === "5H" && qNow.fiveHour && qNow.fiveHour.pct != null)
          v = qNow.fiveHour.pct;
        if (s.label === "7D" && qNow.sevenDay && qNow.sevenDay.pct != null)
          v = qNow.sevenDay.pct;
        return { label: s.label, color: s.color, v };
      })
    : [];

  // 5H bar: real plan quota when available, else elapsed time in the block.
  const q5 = d.quota && d.quota.fiveHour;
  let blockFrac = 0;
  let resetLabel = "";
  if (q5 && q5.pct != null) {
    blockFrac = Math.max(0, Math.min(1, q5.pct / 100));
    const r = Date.parse(q5.resetsAt);
    const mins = Math.max(0, Math.round((r - Date.now()) / 60000));
    // The chart header already carries the percentage once it has data.
    const pctLabel = showChart ? "" : `quota ${Math.round(q5.pct)}% · `;
    resetLabel = `${pctLabel}resets ${hhmm(r)} · ${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, "0")} left`;
  } else if (d.block) {
    const s = Date.parse(d.block.startTime);
    const e = Date.parse(d.block.endTime);
    blockFrac = Math.max(0, Math.min(1, (Date.now() - s) / (e - s)));
    const mins = Math.max(0, Math.round((e - Date.now()) / 60000));
    resetLabel = `resets ${hhmm(e)} · ${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, "0")} left`;
  }

  const PLOT_H = 56;
  const petState = petVisualState(d.pet);

  return (
    <div>
      {/* header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 11, letterSpacing: "0.08em", color: INK_MUTED }}>
          CLAUDE CODE
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 11, color: INK_MUTED }}>last 24h</div>
          {/* Anthropic symbol, white */}
          <svg width="32" height="22.6" viewBox="0 0 92.2 65" aria-label="Anthropic">
            <path
              fill={INK}
              d="M66.5,0H52.4l25.7,65h14.1L66.5,0z M25.7,0L0,65h14.4l5.3-13.6h26.9L51.8,65h14.4L40.5,0C40.5,0,25.7,0,25.7,0z M24.3,39.3l8.8-22.8l8.8,22.8H24.3z"
            />
          </svg>
        </div>
      </div>

      {/* hero: active block, with the tamaclaude pet on the right */}
      <div style={{ display: "flex", gap: 12, marginTop: 6, alignItems: "flex-end" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <div style={{ fontSize: 26, fontWeight: 600 }}>
              {d.block ? fmtCost(d.block.cost) : "idle"}
            </div>
            {d.block && (
              <div style={{ fontSize: 12, color: INK_SECONDARY }}>
                {fmtTok(d.block.tokens)} tokens this block
              </div>
            )}
          </div>
          {d.block && (
            <div style={{ marginTop: 6 }}>
              <div style={{ height: 4, borderRadius: 2, background: TRACK }}>
                <div
                  style={{
                    width: `${blockFrac * 100}%`,
                    height: 4,
                    borderRadius: 2,
                    background: "#3987e5",
                  }}
                />
              </div>
              <div style={{ fontSize: 10, color: INK_MUTED, marginTop: 3 }}>
                5H · {resetLabel}
                {d.block.projectedCost != null &&
                  ` · projected ${fmtCost(d.block.projectedCost)}`}
              </div>
            </div>
          )}
        </div>
        <div style={{ textAlign: "center", flexShrink: 0 }}>
          <Pet state={petState} height={46} />
          <div style={{ fontSize: 8, color: INK_MUTED, marginTop: 1 }}>
            {petState}
          </div>
        </div>
      </div>

      {/* plan quota — collapsed to one line by default; the header toggles
          a smooth line chart auto-zoomed to available history */}
      {showChart && (() => {
        const W = 304;
        const H = 72;
        const PAD_T = 8;
        // X: from the first sample to the last (min 45 min, max 24 h), so
        // the chart fills the full width even with young history.
        const lastT = qh[qh.length - 1].t;
        const firstT = Math.max(qh[0].t, lastT - 86400000);
        const span = Math.max(10 * 60 * 1000, lastT - firstT);
        const x0 = lastT - span;
        const x = (t) => Math.max(0, Math.min(W, ((t - x0) / span) * W));
        // Y: auto-scale to the data (nice 25/50/75/100 ceiling) so low
        // percentages still draw as visible lines.
        const vMax = Math.max(
          1,
          ...series.map((s) => Math.max(...s.pts.map((p) => p.v)))
        );
        const yMax = Math.min(100, Math.max(25, Math.ceil((vMax * 1.15) / 25) * 25));
        const y = (v) =>
          H - Math.max(0, Math.min(yMax, v)) / yMax * (H - PAD_T);
        return (
          <div style={{ marginTop: 14 }}>
            <div
              onClick={() => dispatch({ type: "TOGGLE_CHART" })}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                cursor: "pointer",
              }}
            >
              <div style={{ fontSize: 10, letterSpacing: "0.08em", color: INK_MUTED }}>
                PLAN QUOTA {chartOpen ? "▾" : "▸"}
              </div>
              <div style={{ fontSize: 10 }}>
                {headerVals.map((h, i) => (
                  <span key={h.label}>
                    {i > 0 && <span style={{ color: INK_MUTED }}> · </span>}
                    <span style={{ color: h.color, fontWeight: 600 }}>
                      {h.label} {Math.round(h.v)}%
                    </span>
                  </span>
                ))}
              </div>
            </div>
            {chartOpen && (<div>
            <svg
              width="100%"
              height={H}
              viewBox={`0 0 ${W} ${H}`}
              style={{ display: "block", marginTop: 4 }}
            >
              <defs>
                {series.map((s) => (
                  <linearGradient
                    key={s.label}
                    id={`qg-${s.label.replace(/\W/g, "")}`}
                    x1="0" y1="0" x2="0" y2="1"
                  >
                    <stop offset="0%" stopColor={s.color} stopOpacity="0.28" />
                    <stop offset="100%" stopColor={s.color} stopOpacity="0.02" />
                  </linearGradient>
                ))}
              </defs>
              {[0.25, 0.5, 0.75].map((f) => (
                <line
                  key={f}
                  x1="0" x2={W} y1={y(f * yMax)} y2={y(f * yMax)}
                  stroke={HAIRLINE}
                  strokeWidth="1"
                  strokeDasharray="2 4"
                />
              ))}
              <line x1="0" x2={W} y1={y(0)} y2={y(0)} stroke={TRACK} strokeWidth="1" />
              {series.map((s) =>
                segment(s.pts, 30 * 60 * 1000).map((seg, i) => {
                  const pts = seg.map((p) => [x(p.t), y(p.v)]);
                  const line = smoothPath(pts);
                  const area =
                    line +
                    ` L ${pts[pts.length - 1][0].toFixed(1)} ${y(0)}` +
                    ` L ${pts[0][0].toFixed(1)} ${y(0)} Z`;
                  return (
                    <g key={`${s.label}-${i}`}>
                      <path d={area} fill={`url(#qg-${s.label.replace(/\W/g, "")})`} />
                      <path
                        d={line}
                        fill="none"
                        stroke={s.color}
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </g>
                  );
                })
              )}
              {/* live endpoint dots */}
              {series.map((s) => {
                const last = s.pts[s.pts.length - 1];
                return (
                  <circle
                    key={s.label}
                    cx={x(last.t)}
                    cy={y(last.v)}
                    r="2.4"
                    fill={s.color}
                  />
                );
              })}
              <text x={W - 2} y={y(yMax * 0.5) - 3} textAnchor="end" fontSize="8" fill={INK_MUTED}>
                {Math.round(yMax * 0.5)}%
              </text>
              <text x={W - 2} y={y(yMax) + 8} textAnchor="end" fontSize="8" fill={INK_MUTED}>
                {yMax}%
              </text>
            </svg>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 9,
                color: INK_MUTED,
                marginTop: 2,
              }}
            >
              <span>{hhmm(x0)}</span>
              <span>now</span>
            </div>
            </div>)}
          </div>
        );
      })()}

      {/* 24h stacked bars */}
      <div style={{ position: "relative", marginTop: 12 }}>
        {/* selective direct label on the peak bin */}
        {maxTotal > 1 && peakIdx >= 0 && (
          <div
            style={{
              position: "absolute",
              top: -2,
              left: `${Math.min(93, Math.max(7, ((peakIdx + 0.5) / bins.length) * 100))}%`,
              transform: "translateX(-50%)",
              fontSize: 9,
              color: INK_MUTED,
              whiteSpace: "nowrap",
            }}
          >
            {fmtTok(maxTotal)}
          </div>
        )}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 2,
            height: PLOT_H,
            marginTop: 10,
            borderBottom: `1px solid ${TRACK}`,
          }}
        >
          {bins.map((b, i) => (
            <div
              key={b.t}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column-reverse",
                gap: 1,
                height: "100%",
                justifyContent: "flex-start",
              }}
              title={`${hhmm(b.t)} — ${fmtTok(b.total)}`}
            >
              {families
                .filter((f) => b.perFamily[f])
                .map((f, j, arr) => (
                  <div
                    key={f}
                    style={{
                      height: Math.max(
                        1,
                        (b.perFamily[f] / maxTotal) * (PLOT_H - 8)
                      ),
                      background: hueFor(f),
                      borderRadius:
                        j === arr.length - 1 ? "2px 2px 0 0" : 0,
                    }}
                  />
                ))}
            </div>
          ))}
        </div>
        {/* local-time markers at 00/06/12/18 */}
        <div style={{ position: "relative", height: 12 }}>
          {bins.map((b, i) => {
            const dt = new Date(b.t);
            if (dt.getMinutes() !== 0 || dt.getHours() % 6 !== 0) return null;
            return (
              <div
                key={b.t}
                style={{
                  position: "absolute",
                  left: `${((i + 0.5) / bins.length) * 100}%`,
                  transform: "translateX(-50%)",
                  fontSize: 9,
                  color: INK_MUTED,
                }}
              >
                {String(dt.getHours()).padStart(2, "0")}
              </div>
            );
          })}
        </div>
      </div>

      {/* legend (identity is never color-alone) */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", marginTop: 6 }}>
        {families.map((f) => (
          <div key={f} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                background: hueFor(f),
              }}
            />
            <div style={{ fontSize: 10, color: INK_SECONDARY }}>{f}</div>
          </div>
        ))}
        {families.length === 0 && (
          <div style={{ fontSize: 10, color: INK_MUTED }}>no activity in the last 24h</div>
        )}
      </div>

      {/* footer: 7-day window */}
      {d.week && (
        <div
          style={{
            marginTop: 10,
            paddingTop: 8,
            borderTop: `1px solid ${HAIRLINE}`,
            fontSize: 11,
            color: INK_SECONDARY,
          }}
        >
          7D&nbsp;&nbsp;
          {!showChart && d.quota && d.quota.sevenDay && d.quota.sevenDay.pct != null
            ? `${Math.round(d.quota.sevenDay.pct)}% of plan · `
            : ""}
          {fmtCost(d.week.cost)} · {fmtTok(d.week.tokens)} tokens
        </div>
      )}
    </div>
  );
};
