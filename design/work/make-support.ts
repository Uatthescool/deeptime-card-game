// Makes a Support card face from the card's data: the v3 frame with one rules box in place of the Taxa, Tags and
// flavor panels and no Level badge, its type's texture and icon (design/support-assets), its art and its rules.
// Rules are left-aligned from the top of the box, at flavor-text size until they need to shrink; rulings and notes
// stay off the face. The footer names the type as the game does (typeLabel).
//   npx vite-node design/work/make-support.ts -- <card-key> [--out file.png] [--no-art]
import { existsSync, mkdirSync } from "node:fs";

if (!process.env.FONTCONFIG_FILE) {
  throw new Error("Set FONTCONFIG_FILE to design/fonts/fonts.conf before running (see design/README.md).");
}
const sharp = (await import("sharp")).default;
const { CARD_LIBRARY } = await import("../../src/data/cards.ts");
const { typeLabel } = await import("../../src/ui/inspection.ts");
const { ART, H, interior, load, paleTexture, panels, roseWeight, W } = await import("./geometry.mjs");

const args = process.argv.slice(2).filter((a) => a !== "--");
const key = args[0]!;
const opt = (name: string) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : undefined);
const card = CARD_LIBRARY.get(key) as Record<string, any> | undefined;
if (!card || card.kind === "creature") throw new Error(`No Support card "${key}".`);
const out = opt("out") ?? `design/support-faces/${key}.png`;

// Each Support type's border texture and medallion icon, from the Support asset kit.
const KIT = "design/support-assets";
const type = card.kind === "event" ? `${card.eventType}-event` : card.kind;
const TEXTURE: Record<string, string> = {
  adaptation: "adaptations/Adaptations-charcoal-amber.png",
  concept: "concepts/Concepts-scientific-grey.png",
  "continuous-event": "continuous-events/Continuous-Events-blue.png",
  "instant-event": "instant-events/Instant-Events-purple.png",
};
const textureFile = `${KIT}/textures/${TEXTURE[type]}`;
const iconFile = `${KIT}/icons/${type}-mask.png`;
for (const f of [textureFile, iconFile]) if (!existsSync(f)) throw new Error(`Missing ${f}.`);

const INK = "#1c1e12";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// --- Measuring text ---------------------------------------------------------------------------------------
type Font = { family: string; weight?: string; style?: string; stretch?: string; size: number; spacing?: number };
const attrs = (f: Font) =>
  `font-family="${f.family}" font-weight="${f.weight ?? "normal"}" font-style="${f.style ?? "normal"}" font-stretch="${f.stretch ?? "normal"}" font-size="${f.size}" letter-spacing="${f.spacing ?? 0}"`;
/** Ink width of a run of SVG text content. */
async function inkWidth(content: string, f: Font) {
  const w = 2000, h = 200;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><text xml:space="preserve" x="20" y="140" ${attrs(f)}>${content}</text></svg>`;
  const { data } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = w, x1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] > 100) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
  return x1 < 0 ? 0 : x1 - x0 + 1;
}

// --- Type spec: the Creature face's, with the rules set like its flavor text ---------------------------------
const serif = "DejaVu Serif", sans = "DejaVu Sans";
const SPEC = {
  name: { x: 87, baseline: 122, maxRight: 828, font: { family: serif, weight: "bold", size: 33.9 } },
  // The rules box runs from the Taxa panel's top to the flavor panel's bottom; text stops above the footer rule.
  // Shorter rules grow, up to maxScale; capHeight keeps the gap above the first line the same at any size.
  rules: { first: 764, last: 1290, pitch: 42, region: [100, 924], paragraphGap: 0.5, maxScale: 1.25, capHeight: 0.73, font: { family: serif, size: 26.44 } },
  footer: { x: 907, baseline: 1348, font: { family: sans, weight: "bold", size: 21.05 } },
};
const texts: string[] = [];
const text = (x: number, y: number, f: Font, content: string, anchor = "start") =>
  texts.push(`<text xml:space="preserve" x="${x}" y="${y}" text-anchor="${anchor}" fill="${INK}" ${attrs(f)}>${content}</text>`);

// Name alone; a long one shrinks to fit beside the medallion.
{
  const s = SPEC.name;
  let font: Font = s.font;
  while (font.size > s.font.size * 0.6 && s.x + (await inkWidth(esc(card.name), font)) > s.maxRight) font = { ...font, size: font.size * 0.97 };
  text(s.x, s.baseline, font, esc(card.name));
}

// Rules: paragraphs split on blank lines and lines on line breaks (Feedback Loops' list), each wrapped greedily.
// The block is set at the largest size, up to maxScale, that fits above the footer rule; the longest rules may
// need less than flavor-text size.
{
  const s = SPEC.rules, width = s.region[1]! - s.region[0]!;
  const paragraphs = String(card.rules).split(/\n\s*\n/).map((p) => p.split("\n"));
  const scales: number[] = [];
  for (let k = s.maxScale; k > 1.001; k -= 0.05) scales.push(k);
  for (let k = 1; scales.length < 30; k *= 0.95) scales.push(k);
  let font: Font = s.font, lines: Array<{ text: string; baseline: number }> = [];
  for (const scale of scales) {
    font = { ...s.font, size: s.font.size * scale };
    lines = [];
    const pitch = s.pitch * scale;
    let y = s.first + s.capHeight * (font.size - s.font.size);
    for (const [pi, paragraph] of paragraphs.entries()) {
      if (pi > 0) y += pitch * s.paragraphGap;
      for (const source of paragraph) {
        const words = source.split(/\s+/).filter(Boolean);
        let i = 0;
        while (i < words.length) {
          let j = i + 1;
          while (j < words.length && (await inkWidth(esc(words.slice(i, j + 1).join(" ")), font)) <= width) j++;
          lines.push({ text: words.slice(i, j).join(" "), baseline: y });
          y += pitch;
          i = j;
        }
      }
    }
    if (lines.at(-1)!.baseline <= s.last) break;
  }
  console.log(`rules at ${Math.round((100 * font.size) / s.font.size)}% of flavor-text size, ${lines.length} lines`);
  for (const l of lines) text(s.region[0]!, l.baseline, font, esc(l.text));
}

// The type, where a Creature shows its Time Period.
text(SPEC.footer.x, SPEC.footer.baseline, SPEC.footer.font, esc(typeLabel(card as any)), "end");

// --- Frame, border texture, icon and art -------------------------------------------------------------------
const N = await load("design/templates/nautilus-reference.webp");
const T3 = await load("design/templates/Prehistoric_Card_Master_Template_Geometry_v3_1024x1434.png");
const face = Buffer.from(T3);
const frame = panels(N);

const tex = await sharp(textureFile).resize(W, H, { fit: "fill", kernel: "lanczos3" }).removeAlpha().raw().toBuffer();
{
  // Border: as on a Creature face (make-card.ts), recoloured with the type's texture.
  const inPanel = new Uint8Array(W * H);
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
  for (let p = 0; p < W * H; p++) {
    const w = weight[p]!;
    const x = p % W, y = (p - x) / W;
    if (w <= 0 || inPanel[p] || (x >= ART.x0 && x <= ART.x1 && y >= ART.y0 && y <= ART.y1)) continue;
    const local = sumW[p]! > 0.5 ? sumL[p]! / sumW[p]! : lum(p);
    let s = lum(p) / Math.max(1, local);
    const dev = Math.abs(s - 1), k = 0.3 + 0.7 * Math.min(1, Math.max(0, (dev - 0.1) / 0.25));
    s = 1 + (s - 1) * k;
    for (let c = 0; c < 3; c++) face[p * 4 + c] = Math.round(N[p * 4 + c]! * (1 - w) + Math.min(255, tex[p * 3 + c]! * s) * w);
  }
}
{
  // No Level badge: the frame is symmetric there, so the bottom-left corner is the bottom-right one mirrored,
  // less the footer rule (rows 1311–1315), which is painted over with the panel just above it.
  const at = (x: number, y: number) => (y * W + x) * 4;
  for (let y = 1165; y < 1395; y++) for (let x = 20; x < 285; x++) face.copy(face, at(x, y), at(W - 1 - x, y), at(W - 1 - x, y) + 4);
  for (let y = 1311; y <= 1315; y++) for (let x = 20; x < 285; x++) face.copy(face, at(x, y), at(x, y - 5), at(x, y - 5) + 4);
}
{
  // One rules box: the flavor panel stretched up over the Taxa and Tags panels. Its top and bottom bands (with the
  // rounded corners and the footer rule) keep their size; only the plain middle is stretched.
  const X0 = 64, X1 = W - 1 - X0;
  const SRC = { top: 1033, topBand: 52, stretch: [1085, 1295], bottom: 1295 };
  const TOP = 712;
  const src = Buffer.from(face);
  const row = (to: number, from: number) => src.copy(face, (to * W + X0) * 4, (from * W + X0) * 4, (from * W + X1 + 1) * 4);
  for (let i = 0; i < SRC.topBand; i++) row(TOP + i, SRC.top + i);
  const [s0, s1] = SRC.stretch as [number, number], t0 = TOP + SRC.topBand, t1 = SRC.bottom;
  for (let y = t0; y < t1; y++) {
    const f = s0 + ((y - t0) / (t1 - t0)) * (s1 - s0), a = Math.floor(f), b = Math.min(s1, a + 1), w = f - a;
    for (let x = X0; x <= X1; x++) for (let c = 0; c < 3; c++) {
      const p = (y * W + x) * 4 + c;
      face[p] = Math.round(src[(a * W + x) * 4 + c]! * (1 - w) + src[(b * W + x) * 4 + c]! * w);
    }
  }
}
{
  // Type icon, inked onto the medallion where a Creature shows its Diet.
  const icon = await sharp(iconFile).extractChannel(0).raw().toBuffer({ resolveWithObject: true });
  const size = icon.info.width, half = (size - 1) / 2;
  const disc = frame.slots.diet;
  const cx = (disc.x0 + disc.x1) / 2, cy = (disc.y0 + disc.y1) / 2;
  const ICON_INK = [2, 2, 1];
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const a = icon.data[j * size + i]! / 255;
    if (a === 0) continue;
    const p = (Math.round(cy - half + j) * W + Math.round(cx - half + i)) * 4;
    for (let c = 0; c < 3; c++) face[p + c] = Math.round(face[p + c]! * (1 - a) + ICON_INK[c]! * a);
  }
}
{
  // Art, cover-fitted into the rounded art window, or the "no card art" placeholder.
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
mkdirSync(out.replace(/[\\/][^\\/]*$/, ""), { recursive: true });
const ink = await sharp(overlay).ensureAlpha().raw().toBuffer();
for (let p = 0; p < W * H; p++) {
  const a = ink[p * 4 + 3]! / 255;
  if (a === 0) continue;
  for (let c = 0; c < 3; c++) face[p * 4 + c] = Math.round(face[p * 4 + c]! * (1 - a) + ink[p * 4 + c]! * a);
}
await sharp(face, { raw: { width: W, height: H, channels: 4 } }).png().toFile(out);
console.log(`wrote ${out}`);
