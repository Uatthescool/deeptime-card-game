// Makes a card face from the card's data, on the v3 frame, with its period's texture, its art and calibrated type.
//   npx vite-node design/work/make-card.ts -- <card-key> [--epoch Late] [--out file.png] [--no-art]
// --no-art gives the "no card art" placeholder even when the card has art (e.g. art whose licence is undecided).
import { existsSync } from "node:fs";

// The image library reads its font settings once, at process start (on Windows, setting process.env from inside
// the script never reaches it), so they must be set by whoever runs this.
if (!process.env.FONTCONFIG_FILE) {
  throw new Error("Set FONTCONFIG_FILE to design/fonts/fonts.conf before running (see design/README.md).");
}
const sharp = (await import("sharp")).default;
const { CARD_LIBRARY, printedScientificName } = await import("../../src/data/cards.ts");
const { ART, H, interior, load, paleTexture, panels, roseWeight, W } = await import("./geometry.mjs");

const args = process.argv.slice(2).filter((a) => a !== "--");
const key = args[0]!;
const opt = (name: string) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : undefined);
const card = CARD_LIBRARY.get(key) as Record<string, any> | undefined;
if (!card || card.kind !== "creature") throw new Error(`No Creature card "${key}".`);
// The Early/Middle/Late part of the period footer: --epoch wins, otherwise design/card-epochs.json.
const epochs = JSON.parse((await import("node:fs")).readFileSync("design/card-epochs.json", "utf8")) as Record<string, string>;
const epoch = opt("epoch") ?? epochs[key];
if (epoch === undefined) throw new Error(`No epoch for "${key}" in design/card-epochs.json (use "" for the period alone).`);
const out = opt("out") ?? `design/card-faces/${key}.png`;

const INK = "#1c1e12";
/** The list separator used on the in-game cards: a bold bullet between single spaces. */
// (Its bold glyph is wider than the regular one; a pixel off each side keeps the cards' spacing.)
const BULLET = ' <tspan font-weight="bold" dx="-1" letter-spacing="-1">•</tspan> ';
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// --- Measuring text ---------------------------------------------------------------------------------------
type Font = { family: string; weight?: string; style?: string; stretch?: string; size: number; spacing?: number };
const attrs = (f: Font) =>
  `font-family="${f.family}" font-weight="${f.weight ?? "normal"}" font-style="${f.style ?? "normal"}" font-stretch="${f.stretch ?? "normal"}" font-size="${f.size}" letter-spacing="${f.spacing ?? 0}"`;
/** Ink extent [left, right] of SVG text content drawn at (x, y) with an anchor, on the card. */
async function inkSpan(content: string, f: Font, x: number, y: number, anchor: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><text xml:space="preserve" x="${x}" y="${y}" text-anchor="${anchor}" ${attrs(f)}>${content}</text></svg>`;
  const { data } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = W, x1 = -1;
  for (let yy = Math.max(0, y - 60); yy < Math.min(H, y + 20); yy++) for (let xx = 0; xx < W; xx++) if (data[(yy * W + xx) * 4 + 3] > 100) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; }
  return [x0, x1] as const;
}

/** Ink width of a run of SVG text content (which may hold tspans). */
async function inkWidth(content: string, f: Font) {
  const w = 2000, h = 200;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><text xml:space="preserve" x="20" y="140" ${attrs(f)}>${content}</text></svg>`;
  const { data } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = w, x1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] > 100) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
  return x1 < 0 ? 0 : x1 - x0 + 1;
}

// --- Type spec, measured from the in-game Nautilus (1024 × 1434) ---------------------------------------------
const serif = "DejaVu Serif", sans = "DejaVu Sans";
const SPEC = {
  name: { x: 87, baseline: 122, maxRight: 828, font: { family: serif, weight: "bold", size: 33.9 }, species: { family: serif, style: "italic", size: 23.07 }, gap: 16 },
  taxaLabel: { x: 512, baseline: 754, font: { family: sans, weight: "bold", size: 17.81, spacing: 2 } },
  taxa: { x: 512, baselines: [802, 846], maxWidth: 818, underline: { below: 5, thickness: 1.6 }, font: { family: serif, size: 26.48 } },
  tags: { x: 512, baseline: 975, maxWidth: 818, font: { family: serif, weight: "bold", size: 27.36 } },
  flavor: { first: 1084, pitch: 42, lines: 5, full: [106, 918], beside: [270, 933], besideFrom: 1155, font: { family: serif, size: 26.44 } },
  footer: { x: 907, baseline: 1348, font: { family: sans, weight: "bold", size: 21.05 } },
  levelLabel: { x: 166.5, baseline: 1240, font: { family: sans, weight: "bold", size: 17.81, spacing: -0.5 } },
  level: { x: 166, baseline: 1323, font: { family: serif, weight: "bold", stretch: "condensed", size: 96 } },
};
const texts: string[] = [];
const text = (x: number, y: number, f: Font, content: string, anchor = "start") =>
  texts.push(`<text xml:space="preserve" x="${x}" y="${y}" text-anchor="${anchor}" fill="${INK}" ${attrs(f)}>${content}</text>`);
const shrinkToFit = async (content: string, f: Font, max: number) => {
  let font = { ...f };
  for (let i = 0; i < 20 && (await inkWidth(content, font)) > max; i++) font = { ...font, size: font.size * 0.97 };
  return font;
};

// Name, then the scientific name in italics.
{
  const s = SPEC.name;
  const line = (scale: number) =>
    // Some cards name a whole group (Horseshoe Crab) and have no single scientific name: then the name stands alone.
    card.scientificName
      ? `${esc(card.name)}<tspan dx="${s.gap * scale}" font-weight="normal" font-style="italic" font-size="${s.species.size * scale}">${esc(printedScientificName(card as any)!)}</tspan>`
      : esc(card.name);
  let scale = 1;
  while (scale > 0.6 && s.x + (await inkWidth(line(scale), { ...s.font, size: s.font.size * scale })) > s.maxRight) scale *= 0.97;
  text(s.x, s.baseline, { ...s.font, size: s.font.size * scale }, line(scale));
}

// Taxa: split into two balanced lines; the gameplay Taxon is bold and underlined.
{
  // Each taxon is its own tspan so the gameplay Taxon can be measured alone (others hidden) for its underline.
  const item = (t: string, hide: boolean) => `<tspan${t === card.gameplayTaxon ? ' font-weight="bold"' : ""}${hide ? ' fill-opacity="0"' : ""}>${esc(t)}</tspan>`;
  const sep = (hide: boolean) => (hide ? `<tspan fill-opacity="0">${BULLET}</tspan>` : BULLET);
  const taxa = card.taxa as string[];
  const items = taxa.map((t) => item(t, false));
  // Lines break where the widest line is narrowest. Two lines at full size where they fit; a list too long for
  // two lines at 85% of full size takes three, at up to 85%, in the same panel.
  const widths = await Promise.all(items.map((_, i) => inkWidth(items[i]!, SPEC.taxa.font)));
  const sepWidth = (await inkWidth(`x${BULLET}x`, SPEC.taxa.font)) - 2 * (await inkWidth("x", SPEC.taxa.font));
  const span = (a: number, b: number) => widths.slice(a, b).reduce((s, w) => s + w, 0) + (b - a - 1) * sepWidth;
  const balanced = (count: number): number[][] => {
    let best: number[][] = [], bestMax = Infinity;
    const walk = (start: number, left: number, cuts: number[][]) => {
      if (left === 1) {
        const all = [...cuts, [start, items.length]];
        const max = Math.max(...all.map(([a, b]) => span(a!, b!)));
        if (max < bestMax) { bestMax = max; best = all; }
        return;
      }
      for (let end = start + 1; end <= items.length - left + 1; end++) walk(end, left - 1, [...cuts, [start, end]]);
    };
    walk(0, count, []);
    return best;
  };
  const MIN_TWO_LINE_SCALE = 0.85;
  let ranges = items.length <= 3 ? [[0, items.length]] : balanced(2);
  if (ranges.length === 2 && Math.max(...ranges.map(([a, b]) => span(a!, b!))) > SPEC.taxa.maxWidth / MIN_TWO_LINE_SCALE) ranges = balanced(3);
  const split = ranges.map(([a, b]) => items.slice(a, b));
  const lines = split.map((l) => l.join(BULLET));
  let font: Font = lines.length === 3 ? { ...SPEC.taxa.font, size: SPEC.taxa.font.size * MIN_TWO_LINE_SCALE } : SPEC.taxa.font;
  for (const l of lines) font = await shrinkToFit(l, font, SPEC.taxa.maxWidth);
  const [b0, b1] = SPEC.taxa.baselines as [number, number];
  const baselines = lines.length === 1 ? [(b0 + b1) / 2] : lines.length === 2 ? [b0, b1] : [b0 - 12, b0 + 22, b0 + 56];
  lines.forEach((l, i) => text(SPEC.taxa.x, baselines[i]!, font, l, "middle"));
  // Underline the gameplay Taxon at the Nautilus's position, measured from where its word actually lands.
  const at = split.findIndex((l) => l.some((x) => x.includes(`>${esc(card.gameplayTaxon)}<`)));
  if (at >= 0) {
    const offset = split.slice(0, at).reduce((n, l) => n + l.length, 0);
    const only = split[at]!.map((_, k) => (taxa[offset + k] === card.gameplayTaxon ? item(taxa[offset + k]!, false) : item(taxa[offset + k]!, true))).join(sep(true));
    const [x0, x1] = await inkSpan(only, font, SPEC.taxa.x, baselines[at]!, "middle");
    const u = SPEC.taxa.underline;
    texts.push(`<rect x="${x0}" y="${baselines[at]! + u.below - u.thickness / 2}" width="${x1 - x0 + 1}" height="${u.thickness}" fill="${INK}"/>`);
  }
  text(SPEC.taxaLabel.x, SPEC.taxaLabel.baseline, SPEC.taxaLabel.font, "TAXA", "middle");
}

// Tags.
{
  // Tags are bold throughout, so their bullet is the plain one.
  const content = (card.tags as string[]).map(esc).join(" • ");
  text(SPEC.tags.x, SPEC.tags.baseline, await shrinkToFit(content, SPEC.tags.font, SPEC.tags.maxWidth), content, "middle");
}

// Flavour text: wrapped greedily, beside the Level badge once a line reaches it; shrinks if it runs long.
{
  const s = SPEC.flavor;
  const words = String(card.flavorText ?? "").split(/\s+/).filter(Boolean);
  let font: Font = s.font, lines: Array<{ text: string; region: number[]; baseline: number }> = [];
  for (let attempt = 0; attempt < 12; attempt++) {
    lines = [];
    const pitch = s.pitch * (font.size / s.font.size);
    let i = 0;
    while (i < words.length) {
      const baseline = s.first + lines.length * pitch;
      const region = baseline >= s.besideFrom ? s.beside : s.full;
      let j = i + 1;
      while (j < words.length && (await inkWidth(esc(words.slice(i, j + 1).join(" ")), font)) <= region[1]! - region[0]!) j++;
      lines.push({ text: words.slice(i, j).join(" "), region, baseline });
      i = j;
    }
    // No single word alone on the last line: bring the previous line's last word down with it.
    while (lines.length >= 2 && !lines.at(-1)!.text.includes(" ")) {
      const prev = lines.at(-2)!, last = lines.at(-1)!;
      const cut = prev.text.lastIndexOf(" ");
      if (cut < 0) break;
      const moved = `${prev.text.slice(cut + 1)} ${last.text}`;
      if ((await inkWidth(esc(moved), font)) > last.region[1]! - last.region[0]!) break;
      prev.text = prev.text.slice(0, cut);
      last.text = moved;
    }
    if (lines.length <= s.lines) break;
    font = { ...font, size: font.size * 0.95 };
  }
  for (const l of lines) text((l.region[0]! + l.region[1]!) / 2, l.baseline, font, esc(l.text), "middle");
}

// Period, then Level.
text(SPEC.footer.x, SPEC.footer.baseline, SPEC.footer.font, esc(`${epoch ? `${epoch} ` : ""}${card.period}`), "end");
text(SPEC.levelLabel.x, SPEC.levelLabel.baseline, SPEC.levelLabel.font, "LEVEL", "middle");
text(SPEC.level.x, SPEC.level.baseline, SPEC.level.font, String(card.printedLevel), "middle");

// --- Frame, border texture, Diet icon and art ---------------------------------------------------------------
const N = await load("design/templates/nautilus-reference.webp");
const T3 = await load("design/templates/Prehistoric_Card_Master_Template_Geometry_v3_1024x1434.png");
const face = Buffer.from(T3);

const textureFile = `design/period-textures/${card.period}.png`;
if (!existsSync(textureFile)) throw new Error(`No period texture at ${textureFile}.`);
const tex = await sharp(textureFile).resize(W, H, { fit: "fill", kernel: "lanczos3" }).removeAlpha().raw().toBuffer();
{
  // Border: the frame's rose texture, replaced by this period's, keeping the frame's light and shade.
  // Only the border is recoloured: never a pixel in a panel or badge (soft text edges can look faintly rose).
  const frame = panels(N), inPanel = new Uint8Array(W * H);
  for (const r of Object.values(frame.slots) as any[]) {
    const m = interior(frame.label, r);
    for (let p = 0; p < W * H; p++) if (m[p]) inPanel[p] = 1;
  }
  const pale = paleTexture(N);
  const weight = new Float32Array(W * H);
  for (let p = 0; p < W * H; p++) weight[p] = pale[p] ? 1 : roseWeight(N[p * 4]!, N[p * 4 + 1]!, N[p * 4 + 2]!);
  const lum = (p: number) => 0.299 * N[p * 4]! + 0.587 * N[p * 4 + 1]! + 0.114 * N[p * 4 + 2]!;
  const R = 10, wts = new Float32Array(W * H), lw = new Float32Array(W * H);
  for (let p = 0; p < W * H; p++) { wts[p] = weight[p]! * (lum(p) > 70 ? 1 : 0); lw[p] = wts[p]! * lum(p); }
  const blur = (src: Float32Array) => {
    const tmp = new Float32Array(W * H), dst = new Float32Array(W * H);
    for (let y = 0; y < H; y++) { let a = 0; for (let x = -R; x < W + R; x++) { if (x + R < W) a += src[y * W + x + R] ?? 0; if (x - R - 1 >= 0) a -= src[y * W + x - R - 1]!; if (x >= 0 && x < W) tmp[y * W + x] = a; } }
    for (let x = 0; x < W; x++) { let a = 0; for (let y = -R; y < H + R; y++) { if (y + R < H) a += tmp[(y + R) * W + x] ?? 0; if (y - R - 1 >= 0) a -= tmp[(y - R - 1) * W + x]!; if (y >= 0 && y < H) dst[y * W + x] = a; } }
    return dst;
  };
  const sumL = blur(lw), sumW = blur(wts);
  const ART_PAD = 0;
  for (let p = 0; p < W * H; p++) {
    const w = weight[p]!;
    const x = p % W, y = (p - x) / W;
    if (w <= 0 || inPanel[p] || (x >= ART.x0 - ART_PAD && x <= ART.x1 + ART_PAD && y >= ART.y0 - ART_PAD && y <= ART.y1 + ART_PAD)) continue;
    const local = sumW[p]! > 0.5 ? sumL[p]! / sumW[p]! : lum(p);
    let s = lum(p) / Math.max(1, local);
    const dev = Math.abs(s - 1), k = 0.3 + 0.7 * Math.min(1, Math.max(0, (dev - 0.1) / 0.25));
    s = 1 + (s - 1) * k;
    for (let c = 0; c < 3; c++) face[p * 4 + c] = Math.round(N[p * 4 + c]! * (1 - w) + Math.min(255, tex[p * 3 + c]! * s) * w);
  }
}
{
  // Diet icon, inked onto the empty Diet disc: drumstick (Carnivore), leaf (Herbivore) or both (Omnivore).
  const iconFile = `design/icons/diet-${String(card.diet).toLowerCase()}.png`;
  if (!existsSync(iconFile)) throw new Error(`No Diet icon at ${iconFile}.`);
  const icon = await sharp(iconFile).extractChannel(0).raw().toBuffer({ resolveWithObject: true });
  const size = icon.info.width, half = (size - 1) / 2;
  const diet = panels(N).slots.diet;
  const cx = (diet.x0 + diet.x1) / 2, cy = (diet.y0 + diet.y1) / 2;
  const ICON_INK = [2, 2, 1];
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const a = icon.data[j * size + i]! / 255;
    if (a === 0) continue;
    const p = (Math.round(cy - half + j) * W + Math.round(cx - half + i)) * 4;
    for (let c = 0; c < 3; c++) face[p + c] = Math.round(face[p + c]! * (1 - a) + ICON_INK[c]! * a);
  }
}
{
  // Art, cover-fitted into the rounded art window. A card without art gets the "no card art" placeholder:
  // its period's texture, darkened, with a hairline frame and a centred label.
  const artFile = `public/artwork/${key}.webp`;
  const aw = ART.x1 - ART.x0 + 1, ah = ART.y1 - ART.y0 + 1;
  const art = existsSync(artFile) && !args.includes("--no-art")
    ? await sharp(artFile).resize(aw, ah, { fit: "cover", kernel: "lanczos3" }).removeAlpha().raw().toBuffer()
    : await placeholderArt(aw, ah);
  for (let y = ART.y0; y <= ART.y1; y++) for (let x = ART.x0; x <= ART.x1; x++) {
    const dx = Math.max(ART.x0 + ART.r - x, 0, x - (ART.x1 - ART.r)), dy = Math.max(ART.y0 + ART.r - y, 0, y - (ART.y1 - ART.r));
    const a = Math.max(0, Math.min(1, 0.5 - (Math.hypot(dx, dy) - ART.r)));
    if (a <= 0) continue;
    const p = (y * W + x) * 4, q = ((y - ART.y0) * aw + (x - ART.x0)) * 3;
    for (let c = 0; c < 3; c++) face[p + c] = Math.round(face[p + c]! * (1 - a) + art[q + c]! * a);
  }
}

async function placeholderArt(aw: number, ah: number) {
  const CREAM = "#efe6cf", inset = 22;
  const label: Font = { family: sans, weight: "bold", size: 34, spacing: 6 };
  const note: Font = { family: serif, style: "italic", size: 24 };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${aw}" height="${ah}">
    <rect x="${inset}" y="${inset}" width="${aw - 2 * inset}" height="${ah - 2 * inset}" rx="8" fill="none" stroke="${CREAM}" stroke-opacity="0.45" stroke-width="2"/>
    <text x="${aw / 2}" y="${ah / 2 + 6}" text-anchor="middle" fill="${CREAM}" ${attrs(label)}>NO CARD ART</text>
    <text x="${aw / 2}" y="${ah / 2 + 50}" text-anchor="middle" fill="${CREAM}" fill-opacity="0.75" ${attrs(note)}>Artwork to come</text>
  </svg>`;
  // The period texture under the art window, darkened and a little desaturated so the label reads.
  const ground = Buffer.alloc(aw * ah * 3);
  for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) {
    const p = ((ART.y0 + y) * W + ART.x0 + x) * 3, q = (y * aw + x) * 3;
    const grey = 0.299 * tex[p]! + 0.587 * tex[p + 1]! + 0.114 * tex[p + 2]!;
    for (let c = 0; c < 3; c++) ground[q + c] = Math.round((tex[p + c]! * 0.7 + grey * 0.3) * 0.36);
  }
  return sharp(ground, { raw: { width: aw, height: ah, channels: 3 } }).composite([{ input: Buffer.from(svg) }]).removeAlpha().raw().toBuffer();
}

// --- Lettering ----------------------------------------------------------------------------------------------
const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${texts.join("\n")}</svg>`);
const { mkdirSync } = await import("node:fs");
mkdirSync(out.replace(/[\\/][^\\/]*$/, ""), { recursive: true });
// Blend the lettering in by hand, so every pixel without text keeps its exact value (corners included).
const ink = await sharp(overlay).ensureAlpha().raw().toBuffer();
for (let p = 0; p < W * H; p++) {
  const a = ink[p * 4 + 3]! / 255;
  if (a === 0) continue;
  for (let c = 0; c < 3; c++) face[p * 4 + c] = Math.round(face[p * 4 + c]! * (1 - a) + ink[p * 4 + c]! * a);
}
await sharp(face, { raw: { width: W, height: H, channels: 4 } }).png().toFile(out);
console.log(`wrote ${out}`);
