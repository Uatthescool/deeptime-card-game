import sharp from "sharp";
import { ART, creamRegions, H, interior, paleTexture, panels, roseWeight, W } from "./geometry.mjs";
const [refFile, candFile, maskFile] = process.argv.slice(2);
const load = async (f) => (await sharp(f).resize(W, H, { fit: "fill" }).ensureAlpha().raw().toBuffer());
const ref = await load(refFile), cand = await load(candFile);
// Which pixels count as frame comes from a third card when given (its border colour identifies the texture).
const maskSrc = maskFile ? await load(maskFile) : ref;
const smooth = (e0, e1, v) => { const k = Math.max(0, Math.min(1, (v - e0) / (e1 - e0))); return k * k * (3 - 2 * k); };
const inside = new Uint8Array(W * H);
for (const r of creamRegions(maskSrc).regions) for (let y = r.y0 + 3; y <= r.y1 - 3; y++) for (let x = r.x0 + 3; x <= r.x1 - 3; x++) inside[y * W + x] = 1;
for (let y = ART.y0; y <= ART.y1; y++) for (let x = ART.x0; x <= ART.x1; x++) inside[y * W + x] = 1;
// Within four pixels of a panel or badge (its actual rounded shape, holes and all), as the template builder uses.
const nearPanel = new Uint8Array(W * H);
{
  const { label, slots } = panels(maskSrc);
  for (const r of Object.values(slots)) {
    const m = interior(label, r);
    for (let q = 0; q < W * H; q++) if (m[q]) for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const t = q + dy * W + dx; if (t >= 0 && t < W * H) nearPanel[t] = 1; }
  }
}
const pale = paleTexture(maskSrc);
let frame = 0, same = 0, worst = 0;
for (let p = 0; p < W * H; p++) {
  if (inside[p]) continue;
  const i = p * 4, r = maskSrc[i], g = maskSrc[i + 1], b = maskSrc[i + 2];
  if (roseWeight(r, g, b) > 0.02) continue; // recoloured border texture
  if (pale[p] && !nearPanel[p]) continue; // the texture's palest highlights
  frame++;
  const d = Math.max(Math.abs(ref[i] - cand[i]), Math.abs(ref[i + 1] - cand[i + 1]), Math.abs(ref[i + 2] - cand[i + 2]), Math.abs(ref[i + 3] - cand[i + 3]));
  if (d <= 2) same++; else worst = Math.max(worst, d);
  void r;
}
console.log(`frame pixels (rims, outlines, badges, corners): ${frame}; identical: ${(same / frame * 100).toFixed(2)}%`);
const map = Buffer.alloc(W * H * 3);
for (let p = 0; p < W * H; p++) {
  const i = p * 4, o = p * 3;
  const d = Math.max(Math.abs(ref[i] - cand[i]), Math.abs(ref[i + 1] - cand[i + 1]), Math.abs(ref[i + 2] - cand[i + 2]));
  const g = Math.round((ref[i] + ref[i + 1] + ref[i + 2]) / 12);
  map[o] = map[o + 1] = map[o + 2] = g;
  const r = maskSrc[i], gg = maskSrc[i + 1], b = maskSrc[i + 2];
  const rose = roseWeight(r, gg, b) > 0.02;
  if (!inside[p] && !rose && d > 2) { map[o] = 255; map[o + 1] = 30; map[o + 2] = 30; }
}
await sharp(map, { raw: { width: W, height: H, channels: 3 } }).png().toFile("design/work/frame-diff.png");
