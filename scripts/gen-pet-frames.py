#!/usr/bin/env python3
"""Pre-render tamaclaude mascot states into the widget's pet-frames.js.

The mascot artwork and animation come from tamaclaude
(github.com/thaitop/tamaclaude, MIT License, Copyright (c) 2026 Uthai
Moolpak), which generates every frame as a list of rounded rectangles.
This script bakes 12 frames per state into a compact JS module the
Übersicht widget renders as SVG — no Python needed at runtime.

Usage: gen-pet-frames.py <tamaclaude-checkout> [output.js]
Requires Python 3.11+ (tomllib).
"""
import json
import sys
from pathlib import Path

REPO = Path(sys.argv[1]).resolve()
OUT = Path(
    sys.argv[2]
    if len(sys.argv) > 2
    else Path(__file__).resolve().parent.parent
    / "ubersicht/claude-status.widget/lib/pet-frames.js"
)
sys.path.insert(0, str(REPO / "tools"))

from gen.mascot import build_centered, state_box  # noqa: E402

STATES = [
    "idle", "reading", "writing", "building", "searching", "thinking",
    "waiting", "sleeping", "alert", "celebrate", "error", "beacon",
]
FRAMES = 12

palette: list[str] = []


def color_idx(c: str) -> int:
    if c not in palette:
        palette.append(c)
    return palette.index(c)


out: dict[str, list] = {}
x0 = y0 = x1 = y1 = 0.0
for st in STATES:
    out[st] = [
        [
            [
                round(r.x, 2), round(r.y, 2), round(r.w, 2), round(r.h, 2),
                color_idx(r.color), round(r.r, 2),
            ]
            for r in build_centered(st, i / FRAMES, connected=True, cycle=0)
        ]
        for i in range(FRAMES)
    ]
    bx0, by0, bx1, by1 = state_box(st)
    x0, y0 = min(x0, bx0), min(y0, by0)
    x1, y1 = max(x1, bx1), max(y1, by1)

box = [round(v, 2) for v in (x0, y0, x1, y1)]
OUT.write_text(
    "// Mascot frames generated from tamaclaude (github.com/thaitop/tamaclaude),\n"
    "// MIT License, Copyright (c) 2026 Uthai Moolpak. Regenerate with\n"
    "// scripts/gen-pet-frames.py against a tamaclaude checkout.\n"
    "export const PET_PALETTE = " + json.dumps(palette) + ";\n"
    "export const PET_BOX = " + json.dumps(box) + ";\n"
    "export const PET_STATES = " + json.dumps(out, separators=(",", ":")) + ";\n"
)
print(f"wrote {OUT} ({OUT.stat().st_size // 1024}KB, {len(out)} states)")
