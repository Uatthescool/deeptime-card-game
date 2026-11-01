// Builds the black geometry template from the in-game Nautilus frame, so it matches the in-game cards pixel for pixel.
import sharp from "sharp";
import { ART, dividers, erode, fitBackground, H, interior, load, paleTexture, panels, roseWeight, W } from "./geometry.mjs";

const NAUTILUS = "design/templates/nautilus-reference.webp";
const OUT = "design/templates/Prehistoric_Card_Master_Template_Geometry_v3_1024x1434.png";
const OUT_LARGE = "design/templates/Prehistoric_Card_Master_Template_Geometry_v3_1462x2048.png";
const BLACK = [11, 11, 11];

const N = await load(NAUTILUS);
const out = Buffer.from(N);
const n = panels(N);
const cleared = new Uint8Array(W * H);

// Panels and badge discs: clear their text and icons to the plain panel background; keep divider lines.
for (const slot of ["name", "taxa", "tags", "rules", "level", "diet"]) {
  const r = n.slots[slot];
  const round = slot === "diet" || slot === "level";
  const mask = interior(n.label, r), bg = fitBackground(N, n.label, r);
  // Badges have no divider lines (a wide dark icon row would look like one).
  const keep = round ? new Uint8Array(W * H) : dividers(N, mask, r);
  // The Diet icon touches its disc's edge, so clear that disc by radius instead of by enclosed shape.
  const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
  const inDisc = (p) => slot === "diet" && Math.hypot((p % W) - cx, Math.floor(p / W) - cy) < 52;
  if (slot === "diet") for (let p = 0; p < W * H; p++) if (inDisc(p)) mask[p] = 1;
  const disc = new Uint8Array(W * H);
  if (slot === "diet") for (let p = 0; p < W * H; p++) if (inDisc(p)) disc[p] = 1;
  const writable = slot === "diet" ? disc : erode(mask, 6);
  const ink = new Uint8Array(W * H);
  for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) {
    const p = y * W + x;
    if (!mask[p] || keep[p]) continue;
    const b = bg(x, y), l = 0.299 * N[p * 4] + 0.587 * N[p * 4 + 1] + 0.114 * N[p * 4 + 2];
    if (l / (0.299 * b[0] + 0.587 * b[1] + 0.114 * b[2]) < 0.95) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) ink[(y + dy) * W + x + dx] = 1;
  }
  for (let p = 0; p < W * H; p++) {
    if (!mask[p]) continue;
    cleared[p] = 1;
    if (!writable[p] || keep[p] || !ink[p]) continue;
    const x = p % W, y = (p - x) / W, b = bg(x, y);
    for (let c = 0; c < 3; c++) out[p * 4 + c] = Math.max(0, Math.min(255, Math.round(b[c])));
  }
}

// Art window: solid black, with the same rounded corners as the art it holds.
const art = ART;
const inArt = new Float32Array(W * H);
for (let y = art.y0; y <= art.y1; y++) for (let x = art.x0; x <= art.x1; x++) {
  const dx = Math.max(art.x0 + art.r - x, 0, x - (art.x1 - art.r)), dy = Math.max(art.y0 + art.r - y, 0, y - (art.y1 - art.r));
  const a = Math.max(0, Math.min(1, 0.5 - (Math.hypot(dx, dy) - art.r)));
  const p = y * W + x;
  inArt[p] = a;
  for (let c = 0; c < 3; c++) out[p * 4 + c] = Math.round(out[p * 4 + c] * (1 - a));
}

// Border texture: black, as in the original template. Rims, outlines and badges stay as they are.
const smooth = (e0, e1, v) => { const k = Math.max(0, Math.min(1, (v - e0) / (e1 - e0))); return k * k * (3 - 2 * k); };
for (let p = 0; p < W * H; p++) {
  if (cleared[p] || inArt[p] > 0 || N[p * 4 + 3] < 8) continue;
  const r = N[p * 4], g = N[p * 4 + 1], b = N[p * 4 + 2];
  const w = roseWeight(r, g, b);
  if (w <= 0) continue;
  for (let c = 0; c < 3; c++) out[p * 4 + c] = Math.round(out[p * 4 + c] * (1 - w) + BLACK[c] * w);
}

// The texture's palest highlights read as cream rather than rose; away from the panels they are border too.
const nearPanel = new Uint8Array(W * H);
for (let p = 0; p < W * H; p++) if (cleared[p]) for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const q = p + dy * W + dx; if (q >= 0 && q < W * H) nearPanel[q] = 1; }
const pale = paleTexture(N);
for (let p = 0; p < W * H; p++) {
  if (nearPanel[p] || inArt[p] > 0 || !pale[p]) continue;
  for (let c = 0; c < 3; c++) out[p * 4 + c] = BLACK[c];
}

await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toFile(OUT);
await sharp(OUT).resize(1462, 2048, { fit: "fill", kernel: "lanczos3" }).png().toFile(OUT_LARGE);
console.log(`wrote ${OUT} and ${OUT_LARGE}`);
