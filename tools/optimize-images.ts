/**
 * Resizes and recompresses the site's images for the web.
 *
 *   npm run images
 *
 * Card artwork displays at most ~600 CSS px wide (1200 device px on high-DPI
 * screens), so larger sources are scaled down. Full card faces are converted
 * from PNG to WebP. A file is replaced only when the result is smaller, so the
 * script is safe to rerun after adding new art.
 */
import { readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

import sharp from "sharp";

sharp.cache(false);

type Rule = { directory: string; maxWidth: number; quality: number };

const RULES: Rule[] = [
  { directory: "public/artwork", maxWidth: 1200, quality: 80 },
  { directory: "public/card-faces", maxWidth: 1024, quality: 86 },
  { directory: "public/biomes", maxWidth: 1600, quality: 78 },
];

const IMAGE_EXTENSIONS = new Set([".webp", ".png", ".jpg", ".jpeg"]);

async function optimize(path: string, rule: Rule) {
  // Work from memory: on Windows a file still open by sharp cannot be overwritten.
  const source = await readFile(path);
  const output = path.replace(/\.(png|jpe?g|webp)$/i, ".webp");
  const result = await sharp(source)
    .resize({ width: rule.maxWidth, withoutEnlargement: true })
    .webp({ quality: rule.quality, effort: 6 })
    .toBuffer();
  if (result.length >= source.length && output === path) {
    return { path, before: source.length, after: source.length, changed: false };
  }
  await writeFile(output, result);
  if (output !== path) await unlink(path);
  return { path: output, before: source.length, after: result.length, changed: true };
}

let totalBefore = 0;
let totalAfter = 0;
for (const rule of RULES) {
  for (const name of (await readdir(rule.directory)).sort()) {
    if (!IMAGE_EXTENSIONS.has(extname(name).toLowerCase())) continue;
    const result = await optimize(join(rule.directory, name), rule);
    totalBefore += result.before;
    totalAfter += result.after;
    if (result.changed) {
      console.log(`${result.path}: ${(result.before / 1024).toFixed(0)} KB → ${(result.after / 1024).toFixed(0)} KB`);
    }
  }
}
console.log(`Total: ${(totalBefore / 1048576).toFixed(1)} MB → ${(totalAfter / 1048576).toFixed(1)} MB`);
