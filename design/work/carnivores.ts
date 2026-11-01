import { existsSync } from "node:fs";
import { CARD_LIBRARY, DECKS } from "../../src/data/cards.ts";
import { artSource } from "../../src/data/art.ts";
const manifest = JSON.parse((await import("node:fs")).readFileSync("public/artwork/attribution-manifest.json", "utf8"));
const credits = new Map<string, any>();
const walk = (o: any) => { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === "object") { if (o.key || o.cardKey) credits.set(o.key ?? o.cardKey, o); Object.values(o).forEach(walk); } };
walk(manifest);
const seen = new Set<string>();
for (const [deck, cards] of Object.entries(DECKS)) for (const c of cards as any[]) {
  if (c.kind !== "creature" || c.diet !== "Carnivore" || seen.has(c.key)) continue;
  seen.add(c.key);
  const src = artSource(c.key);
  const art = existsSync(`public/artwork/${c.key}.webp`);
  const lic = credits.get(c.key);
  const proto = (await import("node:fs")).readdirSync("design/prototype-cards").some((f) => f.toLowerCase().startsWith(c.name.toLowerCase().replace(/ /g, "_")));
  console.log(`${deck}  ${c.key.padEnd(18)} L${c.printedLevel} ${c.period.padEnd(13)} art:${(art ? src : "none").padEnd(15)} ${lic ? `licence: ${lic.license ?? lic.licence ?? JSON.stringify(lic).slice(0, 60)}` : ""}${proto ? "  [prototype]" : ""}`);
}
