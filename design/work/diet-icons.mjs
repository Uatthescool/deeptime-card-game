// Lifts the Diet icons off the in-game card faces as ink masks, and builds an Omnivore icon from the two.
// Each icon is saved as an alpha mask the size of the Diet disc, centred on the disc.
import { mkdirSync } from "node:fs";
import sharp from "sharp";
import { fitBackground, load, panels, W } from "./geometry.mjs";

const OUT = "design/icons";
mkdirSync(OUT, { recursive: true });
const R = 52; // the disc's cream interior radius (its thin inner ring starts at 54)
const SIZE = 2 * R + 1;

/** The icon's ink coverage (0–1) in a card's Diet disc, measured against the disc's own background. */
async function lift(file) {
  const d = await load(file);
  const { label, slots } = panels(d);
  const disc = slots.diet;
  const cx = (disc.x0 + disc.x1) / 2, cy = (disc.y0 + disc.y1) / 2;
  const bg = fitBackground(d, label, disc);
  const a = new Float32Array(SIZE * SIZE);
  for (let j = 0; j < SIZE; j++) for (let i = 0; i < SIZE; i++) {
    const x = Math.round(cx - R + i), y = Math.round(cy - R + j);
    if (Math.hypot(x - cx, y - cy) >= R) continue;
    const p = (y * W + x) * 4, b = bg(x, y);
    const l = 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2], lb = 0.299 * b[0] + 0.587 * b[1] + 0.114 * b[2];
    a[j * SIZE + i] = Math.max(0, Math.min(1, (lb - l) / (lb - 12)));
  }
  return a;
}

/** Scales an alpha mask about its centre and shifts it, sampling bilinearly. */
function place(a, scale, dx, dy) {
  const out = new Float32Array(SIZE * SIZE), c = R;
  for (let j = 0; j < SIZE; j++) for (let i = 0; i < SIZE; i++) {
    const x = c + (i - c - dx) / scale, y = c + (j - c - dy) / scale;
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const at = (xx, yy) => (xx < 0 || yy < 0 || xx >= SIZE || yy >= SIZE ? 0 : a[yy * SIZE + xx]);
    out[j * SIZE + i] = (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy;
  }
  return out;
}

/** Grows a mask by `k` pixels (taking the maximum over a disc), for a knockout gap. */
function grow(a, k) {
  const out = new Float32Array(SIZE * SIZE);
  for (let j = 0; j < SIZE; j++) for (let i = 0; i < SIZE; i++) {
    let m = 0;
    for (let dy = -k; dy <= k; dy++) for (let dx = -k; dx <= k; dx++) {
      if (dx * dx + dy * dy > k * k) continue;
      const x = i + dx, y = j + dy;
      if (x >= 0 && y >= 0 && x < SIZE && y < SIZE) m = Math.max(m, a[y * SIZE + x]);
    }
    out[j * SIZE + i] = m;
  }
  return out;
}

// Faint coverage is the disc's own grain and ring, not the icon: drop it. Saved as single-channel masks.
const save = (a, name) =>
  sharp(Buffer.from(Uint8Array.from(a, (v) => (v < 0.12 ? 0 : Math.round(v * 255)))), { raw: { width: SIZE, height: SIZE, channels: 1 } })
    .toColourspace("b-w")
    .png()
    .toFile(`${OUT}/${name}.png`);

/** Replaces the leaf stem's square-cut end with a round cap of the same width. */
function roundStemEnd(a) {
  const at = (x, y) => a[y * SIZE + x];
  // The stem's tip is the ink furthest down and to the left.
  let tip = null;
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (at(x, y) > 0.5 && (!tip || y - x > tip.y - tip.x)) tip = { x, y };
  // The stem's line: the principal direction of the ink within 12px of the tip.
  const pts = [];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (at(x, y) > 0.5 && Math.hypot(x - tip.x, y - tip.y) <= 12) pts.push([x, y]);
  const mx = pts.reduce((t, q) => t + q[0], 0) / pts.length, my = pts.reduce((t, q) => t + q[1], 0) / pts.length;
  let sxx = 0, syy = 0, sxy = 0;
  for (const [x, y] of pts) { sxx += (x - mx) ** 2; syy += (y - my) ** 2; sxy += (x - mx) * (y - my); }
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  let d = [Math.cos(angle), Math.sin(angle)];
  if ((tip.x - mx) * d[0] + (tip.y - my) * d[1] > 0) d = [-d[0], -d[1]]; // point from the tip up into the stem
  const along = (x, y) => (x - mx) * d[0] + (y - my) * d[1];
  const across = (x, y) => Math.abs(-(x - mx) * d[1] + (y - my) * d[0]);
  const end = Math.min(...pts.map(([x, y]) => along(x, y)));
  const r = Math.max(...pts.filter(([x, y]) => along(x, y) < end + 4).map(([x, y]) => across(x, y))) + 0.5;
  const cx = mx + d[0] * (end + r), cy = my + d[1] * (end + r);
  // Inside the end slab, coverage becomes a disc's: the square corners go and the end turns round.
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    if (along(x, y) >= end + r || along(x, y) < end - 3 || across(x, y) > r + 2) continue;
    a[y * SIZE + x] = Math.max(0, Math.min(1, r + 0.5 - Math.hypot(x - cx, y - cy)));
  }
  return a;
}

const carnivore = await lift("design/templates/nautilus-reference.webp");
const herbivore = roundStemEnd(await lift("public/card-faces/amargasaurus.webp"));
await save(carnivore, "diet-carnivore");
await save(herbivore, "diet-herbivore");

// First Omnivore idea, kept for comparison: the leaf behind, up and to the left; the drumstick in front,
// down and to the right, with a thin cream gap where they overlap so both shapes stay readable.
const leaf = place(herbivore, 0.66, -14, -13);
const meat = place(carnivore, 0.66, 14, 13);
const gap = grow(meat, 4);
await save(leaf.map((v, k) => Math.max(meat[k], v * (1 - gap[k]))), "diet-omnivore-leaf-and-drumstick");

// Omnivore: a burger silhouette (design/icons/diet-omnivore-burger.svg; white there is ink).
const burger = await sharp("design/icons/diet-omnivore-burger.svg").extractChannel(0).raw().toBuffer();
await save(Float32Array.from(burger, (v) => v / 255), "diet-omnivore");
console.log(`wrote the Carnivore, Herbivore and Omnivore (burger) icons to ${OUT} (${SIZE}×${SIZE})`);
