// Finds each line of text in each panel of a card: its rows, its left and right ink edges, and its colour.
import { fitBackground, interior, load, panels, W } from "./geometry.mjs";
const file = process.argv[2] ?? "design/templates/nautilus-reference.webp";
const d = await load(file);
const { label, slots } = panels(d);
for (const [slot, r] of Object.entries(slots)) {
  const mask = interior(label, r), bg = fitBackground(d, label, r);
  const ink = (x, y) => { const p = y * W + x; if (!mask[p]) return 0; const b = bg(x, y); const l = 0.299 * d[p * 4] + 0.587 * d[p * 4 + 1] + 0.114 * d[p * 4 + 2]; return l / (0.299 * b[0] + 0.587 * b[1] + 0.114 * b[2]) < 0.6 ? 1 : 0; };
  const rows = [];
  for (let y = r.y0 + 5; y <= r.y1 - 5; y++) { let n = 0; for (let x = r.x0 + 5; x <= r.x1 - 5; x++) n += ink(x, y); rows.push([y, n]); }
  const lines = []; let cur = null;
  for (const [y, n] of rows) { if (n > 0) { if (!cur) cur = { y0: y, y1: y }; cur.y1 = y; } else if (cur) { lines.push(cur); cur = null; } }
  if (cur) lines.push(cur);
  console.log(`\n${slot} (panel x ${r.x0}-${r.x1}, y ${r.y0}-${r.y1})`);
  for (const l of lines) {
    let x0 = W, x1 = 0, dark = [0, 0, 0], k = 0, minL = 255;
    for (let y = l.y0; y <= l.y1; y++) for (let x = r.x0 + 5; x <= r.x1 - 5; x++) if (ink(x, y)) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); const p = (y * W + x) * 4; const lum = (d[p] + d[p + 1] + d[p + 2]) / 3;
      if (lum < minL) minL = lum; if (lum < 60) { dark[0] += d[p]; dark[1] += d[p + 1]; dark[2] += d[p + 2]; k++; }
    }
    // Gaps of 14px or more split a line into runs (name and scientific name, for instance).
    const cols = []; for (let x = x0; x <= x1; x++) { let n = 0; for (let y = l.y0; y <= l.y1; y++) n += ink(x, y); cols.push(n); }
    const runs = []; let s = null, gap = 0;
    cols.forEach((n, i) => { if (n) { if (s === null) s = i; gap = 0; } else if (s !== null && ++gap >= 14) { runs.push([x0 + s, x0 + i - gap]); s = null; } });
    if (s !== null) runs.push([x0 + s, x1]);
    console.log(`  rows ${l.y0}-${l.y1} (h ${l.y1 - l.y0 + 1})  x ${x0}-${x1}  runs ${runs.map(([a, b]) => `${a}-${b}`).join(", ")}  ink ${k ? dark.map((v) => Math.round(v / k)).join(",") : "-"}`);
  }
}
