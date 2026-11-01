import sharp from "sharp";
const F = "design/fonts/";
const probe = async (text, file, family, size, spacing = 0) => {
  const markup = spacing ? `<span letter_spacing="${Math.round(spacing * 1024)}">${text}</span>` : text;
  const img = sharp({ text: { text: markup, fontfile: F + file, font: `${family} ${size}`, dpi: 72, rgba: false } });
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, x1 = -1, y0 = info.height, y1 = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * info.channels] > 100) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return { box: `${info.width}x${info.height}`, channels: info.channels, ink: `x ${x0}-${x1} (w ${x1 - x0 + 1}) y ${y0}-${y1} (h ${y1 - y0 + 1})` };
};
console.log("a      ", await probe("a", "DejaVuSerif.ttf", "DejaVu Serif", 40));
console.log("a+space", await probe("a ", "DejaVuSerif.ttf", "DejaVu Serif", 40));
console.log("Nautilus bold 40", await probe("Nautilus", "DejaVuSerif-Bold.ttf", "DejaVu Serif Bold", 40));
console.log("0 bold 100", await probe("0", "DejaVuSerif-Bold.ttf", "DejaVu Serif Bold", 100));
