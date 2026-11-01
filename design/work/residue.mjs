// Counts leftover marks inside the template's panels: pixels noticeably darker than the panel's smooth background.
import { dividers, erode, fitBackground, interior, load, panels, W } from "./geometry.mjs";
const T = await load(process.argv[2] ?? "design/templates/Prehistoric_Card_Master_Template_Geometry_v3_1024x1434.png");
const N = await load("design/templates/nautilus-reference.webp");
const n = panels(N);
for (const slot of ["name", "taxa", "tags", "rules", "level"]) {
  const r = n.slots[slot], mask = interior(n.label, r), keep = dividers(N, mask, r), inner = erode(mask, 6), bg = fitBackground(N, n.label, r);
  let marks = 0, worst = 1;
  for (let p = 0; p < mask.length; p++) {
    if (!inner[p] || keep[p]) continue;
    const x = p % W, y = (p - x) / W, b = bg(x, y);
    const ratio = (0.299 * T[p * 4] + 0.587 * T[p * 4 + 1] + 0.114 * T[p * 4 + 2]) / (0.299 * b[0] + 0.587 * b[1] + 0.114 * b[2]);
    if (ratio < 0.97) marks++;
    worst = Math.min(worst, ratio);
  }
  console.log(`${slot.padEnd(6)} leftover marks: ${marks}  darkest: ${(worst * 100).toFixed(1)}% of background`);
}
