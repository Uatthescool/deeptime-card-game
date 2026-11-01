import sharp from "sharp";
export const W = 1024, H = 1434;
export async function load(file) {
  return await sharp(file).resize(W, H, { fit: "fill", kernel: "lanczos3" }).ensureAlpha().raw().toBuffer();
}
export const isCream = (d, p) => { const i = p * 4; return d[i + 3] > 128 && d[i] > 222 && d[i + 1] > 205 && d[i + 2] > 160 && d[i] - d[i + 2] < 75; };
/** Connected cream regions (4-connected), with bounding boxes, largest first. */
export function creamRegions(d) {
  const label = new Int32Array(W * H).fill(-1), regions = [];
  for (let s = 0; s < W * H; s++) {
    if (label[s] !== -1 || !isCream(d, s)) continue;
    const id = regions.length, stack = [s]; label[s] = id;
    let x0 = W, y0 = H, x1 = 0, y1 = 0, n = 0;
    while (stack.length) {
      const p = stack.pop(), x = p % W, y = (p - x) / W; n++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const q of [p - 1, p + 1, p - W, p + W]) {
        if (q < 0 || q >= W * H || label[q] !== -1) continue;
        if (Math.abs((q % W) - x) > 1) continue;
        if (isCream(d, q)) { label[q] = id; stack.push(q); }
      }
    }
    regions.push({ id, n, x0, y0, x1, y1 });
  }
  return { label, regions: regions.filter((r) => r.n > 1500).sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0) };
}
/** Names the panels and badge discs by where they sit on the card. */
export function namePanels(regions) {
  const named = {};
  for (const r of regions) {
    const w = r.x1 - r.x0, h = r.y1 - r.y0, cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
    const round = Math.abs(w - h) < 25 && w < 260;
    if (round && cy < 300) named.diet = r;
    else if (round) named.level = r;
    else if (cy < 300) named.name = r;
    else if (cy < 1100 && h > 120) named.taxa = r;
    else if (cy < 1200) named.tags = r;
    else named.rules = r;
  }
  return named;
}

// --- Panels -----------------------------------------------------------------
/** The panel in each slot: the largest cream region there (skips the T. rex's thin inner rims). */
export function panels(d) {
  const { label, regions } = creamRegions(d);
  const slots = {};
  for (const r of regions) {
    const w = r.x1 - r.x0, h = r.y1 - r.y0, cy = (r.y0 + r.y1) / 2;
    const round = Math.abs(w - h) < 25 && w < 260;
    const slot = round ? (cy < 300 ? "diet" : "level") : cy < 300 ? "name" : cy < 890 ? "taxa" : cy < 1030 ? "tags" : "rules";
    if (!slots[slot] || slots[slot].n < r.n) slots[slot] = r;
  }
  return { label, slots };
}

/** Region pixels plus the holes inside it (its text), as a mask over the whole card. */
export function interior(label, r) {
  const mask = new Uint8Array(W * H);
  const outside = new Uint8Array(W * H);
  const stack = [];
  const inBox = (x, y) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
  for (let x = r.x0; x <= r.x1; x++) for (const y of [r.y0, r.y1]) stack.push(y * W + x);
  for (let y = r.y0; y <= r.y1; y++) for (const x of [r.x0, r.x1]) stack.push(y * W + x);
  while (stack.length) {
    const p = stack.pop();
    if (outside[p] || label[p] === r.id) continue;
    outside[p] = 1;
    const x = p % W, y = (p - x) / W;
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) if (inBox(nx, ny)) stack.push(ny * W + nx);
  }
  for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) if (!outside[y * W + x]) mask[y * W + x] = 1;
  return mask;
}

/** Shrinks a mask by `k` pixels, so a panel's own rim never counts as its content. */
export function erode(mask, k) {
  let cur = mask;
  for (let i = 0; i < k; i++) {
    const next = new Uint8Array(W * H);
    for (let p = W; p < W * H - W; p++) next[p] = cur[p] && cur[p - 1] && cur[p + 1] && cur[p - W] && cur[p + W] ? 1 : 0;
    cur = next;
  }
  return cur;
}

/** Long horizontal non-cream runs inside a panel: its divider lines, not its text. */
export function dividers(d, mask, r) {
  const keep = new Uint8Array(W * H);
  for (let y = r.y0; y <= r.y1; y++) {
    let start = -1;
    for (let x = r.x0; x <= r.x1 + 1; x++) {
      const p = y * W + x;
      const line = x <= r.x1 && mask[p] && !isCream(d, p);
      if (line && start < 0) start = x;
      if (!line && start >= 0) {
        // 200px separates the footer divider (about 240px) from word underlines (about 120–150px).
        if (x - start >= Math.min(0.45 * (r.x1 - r.x0), 200)) for (let k = start; k < x; k++) keep[y * W + k] = 1;
        start = -1;
      }
    }
  }
  // Grow by a pixel so the lines' soft edges come along.
  const grown = new Uint8Array(keep);
  for (let p = W; p < W * H - W; p++) if (keep[p]) grown[p - W] = grown[p + W] = grown[p - 1] = grown[p + 1] = 1;
  return grown;
}

/** Least-squares quadratic background (per channel) over a panel's clean cream pixels. */
export function fitBackground(d, label, r) {
  const rows = [], vals = [[], [], []];
  for (let y = r.y0 + 4; y <= r.y1 - 4; y += 2) for (let x = r.x0 + 4; x <= r.x1 - 4; x += 2) {
    const p = y * W + x;
    if (label[p] !== r.id) continue;
    const u = (x - r.x0) / (r.x1 - r.x0), v = (y - r.y0) / (r.y1 - r.y0);
    rows.push([1, u, v, u * u, v * v, u * v]);
    for (let c = 0; c < 3; c++) vals[c].push(d[p * 4 + c]);
  }
  const coef = vals.map((b) => solve(rows, b));
  return (x, y) => {
    const u = (x - r.x0) / (r.x1 - r.x0), v = (y - r.y0) / (r.y1 - r.y0), t = [1, u, v, u * u, v * v, u * v];
    return coef.map((k) => k.reduce((s, kk, i) => s + kk * t[i], 0));
  };
}
export function solve(A, b) {
  const n = A[0].length, M = Array.from({ length: n }, () => new Array(n + 1).fill(0));
  for (let r = 0; r < A.length; r++) for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) M[i][j] += A[r][i] * A[r][j];
    M[i][n] += A[r][i] * b[r];
  }
  for (let i = 0; i < n; i++) {
    let piv = i;
    for (let k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[piv][i])) piv = k;
    [M[i], M[piv]] = [M[piv], M[i]];
    for (let k = 0; k < n; k++) if (k !== i) { const f = M[k][i] / M[i][i]; for (let j = i; j <= n; j++) M[k][j] -= f * M[i][j]; }
  }
  return M.map((row, i) => row[n] / row[i]);
}


/** The border texture's near-cream highlights: light, and not gold (gold has far less blue than green). */
export const isPaleHighlight = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b > 120 && b - g > -35;

/**
 * The texture's pale highlights: pale pixels set in rose texture (at least a fifth of their 7×7 neighbourhood is
 * rose). Rims and badge rings are walled off from the texture by dark outlines, so they never qualify.
 */
export function paleTexture(d) {
  const rose = new Uint8Array(W * H), out = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) if (roseWeight(d[p * 4], d[p * 4 + 1], d[p * 4 + 2]) > 0.3) rose[p] = 1;
  for (let y = 3; y < H - 3; y++) for (let x = 3; x < W - 3; x++) {
    const p = y * W + x;
    if (d[p * 4 + 3] < 8 || !isPaleHighlight(d[p * 4], d[p * 4 + 1], d[p * 4 + 2])) continue;
    let n = 0;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) n += rose[p + dy * W + dx];
    if (n >= 10) out[p] = 1;
  }
  return out;
}

/** The in-game art window: the area inside its dark outline, with rounded corners. */
export const ART = { x0: 69, y0: 189, x1: 954, y1: 682, r: 14 };

/**
 * How much a pixel belongs to the rose Paleogene border texture (0–1). Rose is reddish with blue about equal to
 * green; the texture's pale salmon highlights have a little less blue, so the window widens as red rises. Gold
 * rims have far less blue than green and never count.
 */
export function roseWeight(r, g, b) {
  const red = r - g, blueVsGreen = b - g;
  const lo = -30 - Math.max(0, red) * 0.25, hi = lo + 18;
  const s = (e0, e1, v) => { const k = Math.max(0, Math.min(1, (v - e0) / (e1 - e0))); return k * k * (3 - 2 * k); };
  const w = s(8, 28, red) * s(lo, hi, blueVsGreen);
  // A trace of rose on a rim or outline pixel is anti-aliasing, not texture: leave it alone.
  return w > 0.02 ? w : 0;
}
