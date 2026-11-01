import sharp from "sharp";
const [a, b, ...areas] = process.argv.slice(2);
for (const area of areas) {
  const [name, l, t, w, h] = area.split(":");
  const crop = async (f) => sharp(await sharp(f).resize(1024, 1434, { fit: "fill" }).png().toBuffer()).extract({ left: +l, top: +t, width: +w, height: +h }).png().toBuffer();
  const sheet = await sharp({ create: { width: 2 * +w + 6, height: +h, channels: 3, background: "#ff00ff" } }).composite([{ input: await crop(a), left: 0, top: 0 }, { input: await crop(b), left: +w + 6, top: 0 }]).png().toBuffer();
  await sharp(sheet).resize((2 * +w + 6) * 2, +h * 2, { kernel: "nearest" }).png().toFile(`design/work/zoom-${name}.png`);
}
