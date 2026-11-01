// Copies only the name panel (its cream interior and lettering) from a newly made face onto an existing face.
// For faces that weren't made by make-card.ts, such as the in-game Nautilus, so the rest stays untouched.
//   node design/work/splice-name.mjs <existing face> <new face> <out.png>
import sharp from "sharp";
import { H, interior, load, panels, W } from "./geometry.mjs";

const [oldFile, newFile, out] = process.argv.slice(2);
const old = await load(oldFile), made = await load(newFile);
const { label, slots } = panels(old);
const mask = interior(label, slots.name);
let copied = 0;
for (let p = 0; p < W * H; p++) if (mask[p]) { for (let c = 0; c < 4; c++) old[p * 4 + c] = made[p * 4 + c]; copied++; }
await sharp(Buffer.from(old), { raw: { width: W, height: H, channels: 4 } }).png().toFile(out);
console.log(`copied ${copied} name-panel pixels into ${out}`);
