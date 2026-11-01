import { existsSync, readFileSync } from "node:fs";
import { DECKS } from "../../src/data/cards.ts";
import { artSource } from "../../src/data/art.ts";
const manifest = JSON.parse(readFileSync("public/artwork/attribution-manifest.json", "utf8"));
const lic = new Map<string, string>();
const walk = (o: any) => { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === "object") { if (o.cardKey) lic.set(o.cardKey, o.license); Object.values(o).forEach(walk); } };
walk(manifest);
const seen = new Set<string>();
for (const [deck, cards] of Object.entries(DECKS)) for (const c of cards as any[]) {
  if (c.kind !== "creature" || seen.has(c.key)) continue;
  seen.add(c.key);
  const art = existsSync(`public/artwork/${c.key}.webp`) ? artSource(c.key) : "none";
  const made = existsSync(`design/card-faces/${c.key}.png`);
  console.log([deck, c.key, c.diet, c.period, c.scientificName ?? "—", art, lic.get(c.key) ?? "", made ? "made" : ""].join(" | "));
}
