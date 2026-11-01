// Fits a font size (and letter spacing for spaced capitals) for each text element so it matches the in-game Nautilus.
import sharp from "sharp";
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
async function ink(spec, text, size, spacing = 0) {
  const W = 1600, H = 400, base = 300;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><text x="20" y="${base}" font-family="${spec.family}" font-weight="${spec.weight ?? "normal"}" font-style="${spec.style ?? "normal"}" font-size="${size}" letter-spacing="${spacing}" fill="#000">${esc(text)}</text></svg>`;
  const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = W, x1 = -1, y0 = H, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 128) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return { w: x1 - x0 + 1, h: y1 - y0 + 1, left: x0 - 20, top: base - y0, bottom: y1 - base };
}
const serif = { family: "DejaVu Serif" }, serifBold = { family: "DejaVu Serif", weight: "bold" }, serifItalic = { family: "DejaVu Serif", style: "italic" }, sansBold = { family: "DejaVu Sans", weight: "bold" };
// Targets measured on the in-game Nautilus: ink width and ink top row.
const targets = [
  ["name", serifBold, "Nautilus", 160, 96],
  ["flavor", serif, "Its chambered shell regulated buoyancy while a jet of water", 805, 1064],
  ["taxa2", serif, "Cephalopod • Nautilid", 299, 826],
  ["tags", serifBold, "Living Fossil • Shell • Aquatic • Propulsion", 662, 954],
  ["footer", sansBold, "Early Paleogene", 188, 1332],
  ["digit", serifBold, "0", 51, 1252],
];
for (const [name, spec, text, width, top] of targets) {
  const m = await ink(spec, text, 100);
  const size = (100 * width) / m.w;
  const fit = await ink(spec, text, size);
  console.log(`${name.padEnd(7)} size ${size.toFixed(2)}  ink ${fit.w}x${fit.h}  baseline ${top + fit.top}  (ink top ${top})`);
}
// Spaced capitals: size from cap height, spacing from width.
for (const [name, text, capTop, capH, width] of [["taxaLabel", "TAXA", 741, 13, 58], ["levelLabel", "LEVEL", 1227, 13, 56]]) {
  const m = await ink(sansBold, text, 100);
  const size = (100 * capH) / m.h;
  const plain = await ink(sansBold, text, size);
  const spacing = (width - plain.w) / (text.length - 1);
  const fit = await ink(sansBold, text, size, spacing);
  console.log(`${name.padEnd(10)} size ${size.toFixed(2)} spacing ${spacing.toFixed(2)}  ink ${fit.w}x${fit.h}  baseline ${capTop + fit.top}`);
}
