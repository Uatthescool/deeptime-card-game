import sharp from "sharp";
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
async function inkOf(inner, W = 1200, H = 200) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${inner}</svg>`;
  const { data } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const cols = new Array(W).fill(0);
  let y0 = H, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 128) { cols[x]++; y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const xs = cols.map((n, i) => (n ? i : -1)).filter((i) => i >= 0);
  return { x0: xs[0], x1: xs.at(-1), y0, y1, cols };
}
// Name ink starts where? (left side bearing of "N" at 33.9px)
const name = await inkOf(`<text x="100" y="150" font-family="DejaVu Serif" font-weight="bold" font-size="33.9">Nautilus</text>`);
console.log("name: x=100 gives ink left", name.x0, "-> origin for ink 88:", 88 - (name.x0 - 100));
// Species size: fit italic ink width 274.
const sp = await inkOf(`<text x="20" y="150" font-family="DejaVu Serif" font-style="italic" font-size="40">${esc("Nautilus praepompilius")}</text>`);
const spSize = (40 * 274) / (sp.x1 - sp.x0 + 1);
console.log("species size", spSize.toFixed(2));
// Gap: name then species in one text; adjust dx so the ink gap is 17px.
for (const dx of [0, 4, 8, 10, 12]) {
  const t = await inkOf(`<text x="100" y="150" font-family="DejaVu Serif" font-weight="bold" font-size="33.9">Nautilus<tspan dx="${dx}" font-weight="normal" font-style="italic" font-size="${spSize.toFixed(2)}">Nautilus praepompilius</tspan></text>`);
  let gapStart = -1, gap = 0; for (let x = t.x0; x <= t.x1; x++) { if (t.cols[x] === 0) { if (gapStart < 0) gapStart = x; } else if (gapStart >= 0) { gap = Math.max(gap, x - gapStart); gapStart = -1; } }
  console.log(` dx ${dx}: widest gap ${gap}px`);
}
// Footer right anchor: ink right edge for text-anchor end at x=900.
const foot = await inkOf(`<text x="900" y="150" text-anchor="end" font-family="DejaVu Sans" font-weight="bold" font-size="21.05">Early Paleogene</text>`);
console.log("footer: anchor 900 gives ink right", foot.x1, "-> anchor for ink 905:", 905 + (900 - foot.x1));
// Species ink top/bottom relative to baseline 150 (Nautilus line ink spans 96-127 with name baseline 122).
console.log("species ink rows", sp.y0 - 150, "to", sp.y1 - 150, "(relative to baseline, at size 40)");
