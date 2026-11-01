// Contact sheets of the made card faces, ten to a sheet, for review.
import { readdirSync } from "node:fs";
import sharp from "sharp";
const keys = process.argv.slice(2);
const per = 10, w = 380, h = Math.round((w * 1434) / 1024), gap = 8;
for (let s = 0; s * per < keys.length; s++) {
  const batch = keys.slice(s * per, s * per + per);
  const parts = await Promise.all(batch.map(async (k, i) => ({ input: await sharp(`design/card-faces/${k}.png`).resize(w).png().toBuffer(), left: (i % 5) * (w + gap), top: Math.floor(i / 5) * (h + gap) })));
  await sharp({ create: { width: 5 * (w + gap), height: 2 * (h + gap), channels: 4, background: "#20352a" } }).composite(parts).png().toFile(`design/work/sheet-${s + 1}.png`);
  console.log(`sheet ${s + 1}: ${batch.join(", ")}`);
}
void readdirSync;
