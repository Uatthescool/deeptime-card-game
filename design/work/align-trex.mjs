// Rebuilds the T. rex prototype on the in-game Nautilus frame, so every frame element sits on the same pixel.
import sharp from "sharp";
import { ART, dividers, erode, fitBackground, H, interior, load, panels, roseWeight, W } from "./geometry.mjs";

const NAUTILUS = "design/templates/nautilus-reference.webp";
const TREX = "design/prototype-cards/Tyrannosaurus_rex_Prototype_001.png";
const TEXTURE = "design/period-textures/Cretaceous.png";
const OUT = "design/prototype-cards/Tyrannosaurus_rex_aligned_1024x1434.png";

const N = await load(NAUTILUS);
const T = await load(TREX);
const tex = await sharp(TEXTURE).resize(W, H, { fit: "fill", kernel: "lanczos3" }).removeAlpha().raw().toBuffer();
const out = Buffer.from(N);

const n = panels(N), t = panels(T);
// The T. rex prototype has a soft glow around its own Level badge; nothing written lives there.
const tl = t.slots.level, tlx = (tl.x0 + tl.x1) / 2, tly = (tl.y0 + tl.y1) / 2, tlr = (tl.x1 - tl.x0) / 2 + 30;
const nearOwnBadge = (x, y) => Math.hypot(x - tlx, y - tly) < tlr;
const panelMasks = new Uint8Array(W * H);
const anchor = { name: "left", taxa: "center", tags: "center", rules: "center", level: "center" };
const report = [];
for (const slot of Object.keys(anchor)) {
  const rn = n.slots[slot], rt = t.slots[slot];
  const maskN = interior(n.label, rn), maskT = erode(interior(t.label, rt), 4);
  const levelSlot = slot === "level";
  // Nothing is ever written within six pixels of a panel edge, so the Nautilus edge stays exactly as it is.
  const writable = erode(maskN, 6);
  const keepN = dividers(N, maskN, rn), dropT = dividers(T, maskT, rt);
  const bgN = fitBackground(N, n.label, rn), bgT = fitBackground(T, t.label, rt);
  const s = Math.min((rn.x1 - rn.x0) / (rt.x1 - rt.x0), (rn.y1 - rn.y0) / (rt.y1 - rt.y0));
  const ncx = anchor[slot] === "left" ? rn.x0 : (rn.x0 + rn.x1) / 2, ncy = (rn.y0 + rn.y1) / 2;
  const tcx = anchor[slot] === "left" ? rt.x0 : (rt.x0 + rt.x1) / 2, tcy = (rt.y0 + rt.y1) / 2;
  report.push(`${slot}: scale ${s.toFixed(3)}`);
  // The T. rex panel's ink, as a ratio to its own background (1 where the panel is plain).
  const ratio = (x, y, c) => {
    const xi = Math.round(x), yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= W || yi >= H) return 1;
    const p = yi * W + xi;
    if (!maskT[p] || dropT[p] || (!levelSlot && nearOwnBadge(xi, yi))) return 1;
    const bg = bgT(xi, yi)[c];
    // Only real ink carries over: faint shading (glows, gradients) in the T. rex panel counts as plain.
    const ink = T[p * 4 + c] / bg;
    return ink >= 0.95 ? 1 : ink <= 0.88 ? ink : ink + (1 - ink) * ((ink - 0.88) / 0.07);
  };
  const sample = (x, y, c) => {
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    return (ratio(x0, y0, c) * (1 - fx) + ratio(x0 + 1, y0, c) * fx) * (1 - fy) + (ratio(x0, y0 + 1, c) * (1 - fx) + ratio(x0 + 1, y0 + 1, c) * fx) * fy;
  };
  // The Nautilus text to clear: dark pixels against the panel background, grown by two pixels.
  const textN = new Uint8Array(W * H);
  for (let y = rn.y0; y <= rn.y1; y++) for (let x = rn.x0; x <= rn.x1; x++) {
    const p = y * W + x;
    if (!maskN[p] || keepN[p]) continue;
    const b = bgN(x, y), lumN = 0.299 * N[p * 4] + 0.587 * N[p * 4 + 1] + 0.114 * N[p * 4 + 2];
    if (lumN / (0.299 * b[0] + 0.587 * b[1] + 0.114 * b[2]) < 0.95) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) textN[(y + dy) * W + x + dx] = 1;
  }
  for (let y = rn.y0; y <= rn.y1; y++) for (let x = rn.x0; x <= rn.x1; x++) {
    const p = y * W + x;
    if (!maskN[p] || keepN[p]) continue;
    panelMasks[p] = 1;
    if (!writable[p]) continue;
    // Keep the Nautilus panel exactly (its shading and shadows) except where its own text was.
    const bg = textN[p] ? bgN(x, y) : [N[p * 4], N[p * 4 + 1], N[p * 4 + 2]];
    const sx = tcx + (x - ncx) / s, sy = tcy + (y - ncy) / s;
    for (let c = 0; c < 3; c++) out[p * 4 + c] = Math.max(0, Math.min(255, Math.round(bg[c] * sample(sx, sy, c))));
  }
}

// --- Art --------------------------------------------------------------------
const artN = ART;
const artT = { x0: 70, y0: 186, x1: 954, y1: 680 };
const aw = artN.x1 - artN.x0 + 1, ah = artN.y1 - artN.y0 + 1;
const trexCard = await sharp(TREX).resize(W, H, { fit: "fill", kernel: "lanczos3" }).png().toBuffer();
const art = await sharp(trexCard)
  .extract({ left: artT.x0, top: artT.y0, width: artT.x1 - artT.x0 + 1, height: artT.y1 - artT.y0 + 1 })
  .resize(aw, ah, { fit: "cover", kernel: "lanczos3" })
  .removeAlpha()
  .raw()
  .toBuffer();
const artMask = new Float32Array(W * H);
for (let y = artN.y0; y <= artN.y1; y++) for (let x = artN.x0; x <= artN.x1; x++) {
  // Rounded-rectangle coverage with a one-pixel soft edge.
  const dx = Math.max(artN.x0 + artN.r - x, 0, x - (artN.x1 - artN.r)), dy = Math.max(artN.y0 + artN.r - y, 0, y - (artN.y1 - artN.r));
  const dist = Math.hypot(dx, dy) - artN.r;
  const a = Math.max(0, Math.min(1, 0.5 - dist));
  if (a <= 0) continue;
  const p = y * W + x, q = ((y - artN.y0) * aw + (x - artN.x0)) * 3;
  artMask[p] = a;
  for (let c = 0; c < 3; c++) out[p * 4 + c] = Math.round(out[p * 4 + c] * (1 - a) + art[q + c] * a);
}

// --- Border: recolour the rose Paleogene texture with the Cretaceous texture -------------------
const lum = (d, p) => 0.299 * d[p * 4] + 0.587 * d[p * 4 + 1] + 0.114 * d[p * 4 + 2];
const smooth = (e0, e1, v) => { const k = Math.max(0, Math.min(1, (v - e0) / (e1 - e0))); return k * k * (3 - 2 * k); };
const rose = new Float32Array(W * H);
for (let p = 0; p < W * H; p++) {
  if (panelMasks[p] || artMask[p] > 0 || N[p * 4 + 3] < 8) continue;
  const r = N[p * 4], g = N[p * 4 + 1], b = N[p * 4 + 2];
  rose[p] = roseWeight(r, g, b);
}
// Local texture brightness, from the bright rose pixels only (so outlines and shadows stay dark).
const R = 10, sumL = new Float32Array(W * H), sumW = new Float32Array(W * H);
const wts = new Float32Array(W * H);
for (let p = 0; p < W * H; p++) wts[p] = rose[p] * (lum(N, p) > 70 ? 1 : 0);
const boxBlur = (src, dst) => {
  const tmp = new Float32Array(W * H);
  for (let y = 0; y < H; y++) { let acc = 0; for (let x = -R; x < W + R; x++) { if (x + R < W && x + R >= 0) acc += src[y * W + x + R]; if (x - R - 1 >= 0) acc -= src[y * W + x - R - 1]; if (x >= 0 && x < W) tmp[y * W + x] = acc; } }
  for (let x = 0; x < W; x++) { let acc = 0; for (let y = -R; y < H + R; y++) { if (y + R < H && y + R >= 0) acc += tmp[(y + R) * W + x]; if (y - R - 1 >= 0) acc -= tmp[(y - R - 1) * W + x]; if (y >= 0 && y < H) dst[y * W + x] = acc; } }
};
const lw = new Float32Array(W * H);
for (let p = 0; p < W * H; p++) lw[p] = wts[p] * lum(N, p);
boxBlur(lw, sumL);
boxBlur(wts, sumW);
let recoloured = 0;
for (let p = 0; p < W * H; p++) {
  const w = rose[p];
  if (w <= 0) continue;
  const local = sumW[p] > 0.5 ? sumL[p] / sumW[p] : lum(N, p);
  let s = lum(N, p) / Math.max(1, local);
  // Soften the rose texture's own grain so it doesn't print over the new texture; keep real shading.
  const dev = Math.abs(s - 1), k = 0.3 + 0.7 * smooth(0.1, 0.35, dev);
  s = 1 + (s - 1) * k;
  for (let c = 0; c < 3; c++) {
    const v = Math.min(255, tex[p * 3 + c] * s);
    out[p * 4 + c] = Math.round(out[p * 4 + c] * (1 - w) + v * w);
  }
  recoloured++;
}

await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toFile(OUT);
console.log(report.join(" | "));
console.log(`recoloured ${recoloured} border pixels; wrote ${OUT}`);
