// Puts finished card faces into the game: converts them to WebP in public/card-faces, links each from its card
// data, and notes the card-face use in the artwork credits. Cards whose art is CC BY-SA are held back, or ship
// their placeholder face from design/card-faces/placeholder.
//   npx vite-node design/work/ship-faces.ts
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { DECKS, GENERAL_POOL } from "../../src/data/cards.ts";

const MANIFEST = "public/artwork/attribution-manifest.json";
const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const credits = new Map<string, any>();
const walk = (o: any) => { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === "object") { if (o.cardKey) credits.set(o.cardKey, o); Object.values(o).forEach(walk); } };
walk(manifest);

const shipped: string[] = [], held: string[] = [];
const seen = new Set<string>();
for (const cards of [...Object.values(DECKS), GENERAL_POOL]) for (const card of cards as any[]) {
  if (card.kind !== "creature" || seen.has(card.key) || card.cardFace) continue;
  seen.add(card.key);
  if (!existsSync(`design/card-faces/${card.key}.png`)) continue;
  const credit = credits.get(card.key);
  if (credit && /BY-SA/i.test(credit.license)) {
    // Its placeholder face (make-card --no-art) ships instead, if made; it uses none of the art, so needs no credit.
    const placeholder = `design/card-faces/placeholder/${card.key}.png`;
    if (!existsSync(placeholder)) { held.push(`${card.key} (${credit.license})`); continue; }
    await sharp(placeholder).webp({ quality: 88, alphaQuality: 100, effort: 6 }).toFile(`public/card-faces/${card.key}.webp`);
    shipped.push(card.key);
    continue;
  }
  await sharp(`design/card-faces/${card.key}.png`).webp({ quality: 88, alphaQuality: 100, effort: 6 }).toFile(`public/card-faces/${card.key}.webp`);
  if (credit && !String(credit.modifications).includes("card face")) {
    credit.modifications = `${credit.modifications} Also set into the ${card.name} card face, with the card's frame, period border and lettering.`;
  }
  shipped.push(card.key);
}

// Link each face from its card: before "status" in the JSON deck, at the end of the creature({...}) call in TS decks.
for (const file of ["src/data/deck-1.json", "src/data/deck-2.ts", "src/data/deck-3.ts", "src/data/general-pool.ts"]) {
  let text = readFileSync(file, "utf8");
  const crlf = text.includes("\r\n");
  text = text.replace(/\r\n/g, "\n");
  for (const key of shipped) {
    const json = file.endsWith(".json");
    const at = text.indexOf(json ? `"key": "${key}"` : `key: "${key}"`);
    if (at < 0) continue;
    if (json) {
      const status = text.indexOf('"status":', at);
      const lineStart = text.lastIndexOf("\n", status) + 1;
      const indent = text.slice(lineStart, status);
      text = `${text.slice(0, lineStart)}${indent}"cardFace": "/card-faces/${key}.webp",\n${text.slice(lineStart)}`;
    } else {
      const close = text.indexOf("\n  }),", at);
      text = `${text.slice(0, close)}\n    cardFace: "/card-faces/${key}.webp",${text.slice(close)}`;
    }
  }
  writeFileSync(file, crlf ? text.replace(/\n/g, "\r\n") : text);
}

writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`shipped ${shipped.length}: ${shipped.join(", ")}`);
console.log(`held back ${held.length}: ${held.join(", ")}`);
