import sharp from "sharp";
import { load, W } from "./geometry.mjs";
// The bullet between "Cephalopod" and "Nautilid" on the in-game Nautilus: its ink box.
const d = await load("design/templates/nautilus-reference.webp");
const dark = (x, y) => { const i = (y * W + x) * 4; return d[i] + d[i + 1] + d[i + 2] < 300; };
const box = (xa, xb, ya, yb, D = (x, y) => dark(x, y)) => { let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1; for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) if (D(x, y)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return { x0, x1, y0, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 }; };
// Find the gap columns around the bullet in line 2 (rows 826-852).
const cols = []; for (let x = 480; x <= 600; x++) { let n = 0; for (let y = 826; y <= 852; y++) n += dark(x, y); cols.push(n); }
console.log("line 2 columns 480-600:", cols.map((n) => (n ? "#" : ".")).join(""));
const b = box(500, 570, 826, 852);
console.log("Nautilus bullet region ink (incl. neighbours):", b);
// Rendered bullets for comparison, at the calibrated size, with baseline 846.
for (const [label, family, weight] of [["Serif", "DejaVu Serif", "normal"], ["Serif Bold", "DejaVu Serif", "bold"], ["Sans", "DejaVu Sans", "normal"], ["Sans Bold", "DejaVu Sans", "bold"]]) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><text x="50" y="150" font-family="${family}" font-weight="${weight}" font-size="26.48">•</text></svg>`;
  const { data } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1; for (let y = 0; y < 200; y++) for (let x = 0; x < 200; x++) if (data[(y * 200 + x) * 4 + 3] > 100) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  console.log(`${label.padEnd(10)} bullet ${x1 - x0 + 1}x${y1 - y0 + 1}, rows ${y0 - 150}..${y1 - 150} from baseline`);
}
