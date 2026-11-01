import sharp from "sharp";
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
async function ink(spec, text, size, spacing = 0) {
  const W = 2400, H = 300, base = 220;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><text x="20" y="${base}" font-family="${spec.family}" font-weight="${spec.weight ?? "normal"}" font-style="${spec.style ?? "normal"}" font-stretch="${spec.stretch ?? "normal"}" font-size="${size}" letter-spacing="${spacing}" fill="#000">${esc(text)}</text></svg>`;
  const { data } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = W, x1 = -1, y0 = H, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 128) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return { w: x1 - x0 + 1, h: y1 - y0 + 1, top: base - y0 };
}
const serif = { family: "DejaVu Serif" }, serifBold = { family: "DejaVu Serif", weight: "bold" }, cond = { family: "DejaVu Serif", weight: "bold", stretch: "condensed" };
for (const [name, spec, text, width, top, rows] of [
  ["flavor", serif, "Its chambered shell regulated buoyancy while a jet of water", 805, 1064, 28],
  ["tags", serifBold, "Living Fossil • Shell • Aquatic • Propulsion", 662, 954, 28],
  ["digit-regular", serifBold, "0", 51, 1252, 72],
  ["digit-condensed", cond, "0", 51, 1252, 72],
]) {
  const m = await ink(spec, text, 40), size = (40 * width) / m.w, fit = await ink(spec, text, size);
  console.log(`${name.padEnd(15)} size ${size.toFixed(2)}  ink ${fit.w}x${fit.h} (Nautilus ${width}x${rows})  baseline ${top + fit.top}`);
}
