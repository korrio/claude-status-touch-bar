// Claude Code usage — Übersicht desktop widget.
// 24-hour token activity (48 half-hour bars, stacked per model), active
// 5-hour block summary, and rolling 7-day totals. Data comes from the
// shared status layer's `graph` mode (cached 5 min).

export const command =
  "$HOME/.local/share/claude-status-touch-bar/scripts/claude-status.sh graph";

export const refreshFrequency = 60 * 1000;

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

export const render = ({ output }) => {
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

  // Active block progress: elapsed fraction of the 5-hour window.
  let blockFrac = 0;
  let resetLabel = "";
  if (d.block) {
    const s = Date.parse(d.block.startTime);
    const e = Date.parse(d.block.endTime);
    blockFrac = Math.max(0, Math.min(1, (Date.now() - s) / (e - s)));
    const mins = Math.max(0, Math.round((e - Date.now()) / 60000));
    resetLabel = `resets ${hhmm(e)} · ${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, "0")} left`;
  }

  const PLOT_H = 56;

  return (
    <div>
      {/* header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontSize: 11, letterSpacing: "0.08em", color: INK_MUTED }}>
          CLAUDE CODE
        </div>
        <div style={{ fontSize: 11, color: INK_MUTED }}>last 24h</div>
      </div>

      {/* hero: active block */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
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

      {/* 24h stacked bars */}
      <div style={{ position: "relative", marginTop: 12 }}>
        {/* selective direct label on the peak bin */}
        {maxTotal > 1 && peakIdx >= 0 && (
          <div
            style={{
              position: "absolute",
              top: -2,
              left: `${(peakIdx / bins.length) * 100}%`,
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
          7D&nbsp;&nbsp;{fmtCost(d.week.cost)} · {fmtTok(d.week.tokens)} tokens
        </div>
      )}
    </div>
  );
};
