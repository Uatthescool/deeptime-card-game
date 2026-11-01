// Checks that the aligned card's frame is the Nautilus frame: every pixel that isn't panel content, art or
// recoloured border must be identical, and the panels, badges and art window must sit on the same pixels.
import sharp from "sharp";
import { creamRegions, H, W } from "./geometry.mjs";
const [refFile, candFile] = process.argv.slice(2);
const load = async (f) => (await sharp(f).resize(W, H, { fit: "fill" }).ensureAlpha().raw().toBuffer());
const ref = await load(refFile), cand = await load(candFile);
const a = creamRegions(ref).regions, b = creamRegions(cand).regions;
const key = (r) => `x ${r.x0}-${r.x1} y ${r.y0}-${r.y1}`;
const big = (rs) => rs.filter((r) => r.n > 5000).map(key);
console.log("reference panels:", big(a).join(" | "));
console.log("candidate panels:", big(b).join(" | "));
let same = 0, dark = 0, gold = 0, darkSame = 0, goldSame = 0;
for (let p = 0; p < W * H; p++) {
  const i = p * 4, r = ref[i], g = ref[i + 1], bl = ref[i + 2];
  const isDark = r + g + bl < 90, isGold = r > 150 && g > 115 && bl < 140 && r - bl > 50 && r >= g;
  const eq = Math.abs(ref[i] - cand[i]) + Math.abs(ref[i + 1] - cand[i + 1]) + Math.abs(ref[i + 2] - cand[i + 2]) + Math.abs(ref[i + 3] - cand[i + 3]) <= 3;
  if (eq) same++;
  if (isDark) { dark++; if (eq) darkSame++; }
  if (isGold) { gold++; if (eq) goldSame++; }
}
console.log(`identical pixels overall: ${(same / (W * H) * 100).toFixed(1)}%  dark frame lines: ${(darkSame / dark * 100).toFixed(1)}% of ${dark}  gold rims: ${(goldSame / gold * 100).toFixed(1)}% of ${gold}`);
