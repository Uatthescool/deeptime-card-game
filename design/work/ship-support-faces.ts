// Puts finished Support faces into the game, as ship-faces.ts does for Creatures: converts them to WebP in
// public/card-faces, links each from its card data, and notes the card-face use in the artwork credits.
// Faces come from design/support-faces, which holds no CC BY art: a card with CC BY art ships its face with the art
// from design/work/licensed-faces (make-support.ts -- <key> --out design/work/licensed-faces/<key>.png), and a card
// with CC BY-SA art ships its "no card art" face.
//   npx vite-node design/work/ship-support-faces.ts
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { CARD_LIBRARY } from "../../src/data/cards.ts";

const MANIFEST = "public/artwork/attribution-manifest.json";
const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const credits = new Map<string, any>(manifest.assets.map((asset: any) => [asset.cardKey, asset]));

const shipped: string[] = [];
for (const card of CARD_LIBRARY.values() as Iterable<any>) {
  if (card.kind === "creature" || card.cardFace) continue;
  const credit = credits.get(card.key);
  const licensed = credit && !/BY-SA/i.test(credit.license) && /CC BY/i.test(credit.license);
  const source = licensed ? `design/work/licensed-faces/${card.key}.png` : `design/support-faces/${card.key}.png`;
  if (!existsSync(source)) throw new Error(`No face for ${card.name} at ${source}.`);
  await sharp(source).webp({ quality: 88, alphaQuality: 100, effort: 6 }).toFile(`public/card-faces/${card.key}.webp`);
  if (credit && !/BY-SA/i.test(credit.license) && !String(credit.modifications).includes("card face")) {
    credit.modifications = `${credit.modifications} Also set into the ${card.name} card face, with the card's frame, type border and lettering.`;
  }
  shipped.push(card.key);
}

// Link each face from its card, on the line before its status.
for (const file of ["src/data/deck-1.json", "src/data/deck-2.ts", "src/data/deck-3.ts", "src/data/deck-4.ts"]) {
  let text = readFileSync(file, "utf8");
  const crlf = text.includes("\r\n");
  text = text.replace(/\r\n/g, "\n");
  const json = file.endsWith(".json");
  for (const key of shipped) {
    const at = text.indexOf(json ? `"key": "${key}"` : `key: "${key}"`);
    if (at < 0) continue;
    const status = text.indexOf(json ? '"status":' : "status:", at);
    const lineStart = text.lastIndexOf("\n", status) + 1;
    const indent = text.slice(lineStart, status);
    const line = json ? `"cardFace": "/card-faces/${key}.webp",` : `cardFace: "/card-faces/${key}.webp",`;
    text = `${text.slice(0, lineStart)}${indent}${line}\n${text.slice(lineStart)}`;
  }
  writeFileSync(file, crlf ? text.replace(/\n/g, "\r\n") : text);
}

writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`shipped ${shipped.length}: ${shipped.join(", ")}`);
