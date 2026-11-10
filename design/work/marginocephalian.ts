// One-off: adds Marginocephalian (ceratopsians + pachycephalosaurs) to the taxa of every marginocephalian card, and
// ends Yinlong's taxa there so Divergent's Ancestor half can match both groups. Rewrites every data file that
// defines each card, then prints the keys it changed.
//   npx vite-node design/work/marginocephalian.ts
import { readFileSync, writeFileSync } from "node:fs";

const marginocephalian = ["Vertebrate", "Amniote", "Archosaur", "Dinosaur", "Ornithischian", "Marginocephalian"];
const FIXES: Record<string, string[]> = {
  yinlong: marginocephalian,
  protoceratops: [...marginocephalian, "Ceratopsian", "Protoceratopsid"],
  pachycephalosaurus: [...marginocephalian, "Pachycephalosaurid"],
  styracosaurus: [...marginocephalian, "Ceratopsian", "Ceratopsid", "Centrosaurine"],
  pachyrhinosaurus: [...marginocephalian, "Ceratopsian", "Ceratopsid", "Centrosaurine"],
  triceratops: [...marginocephalian, "Ceratopsian", "Ceratopsid", "Chasmosaurine"],
};

const FILES = ["src/data/deck-1.json", "src/data/deck-2.ts", "src/data/deck-3.ts", "src/data/deck-4.ts", "src/data/general-pool.ts"];
const changed = new Map<string, number>();
for (const file of FILES) {
  let text = readFileSync(file, "utf8");
  const json = file.endsWith(".json");
  for (const [key, taxa] of Object.entries(FIXES)) {
    const keyText = json ? `"key": "${key}"` : `key: "${key}"`;
    for (let at = text.indexOf(keyText); at >= 0; at = text.indexOf(keyText, at + 1)) {
      const next = text.indexOf(json ? `"key": "` : `key: "`, at + 1);
      const end = next < 0 ? text.length : next;
      let card = text.slice(at, end);
      const taxaRe = json ? /"taxa": \[[^\]]*\]/ : /taxa: \[[^\]]*\]/;
      if (!taxaRe.test(card)) continue; // a key reference, not a card definition
      card = card.replace(taxaRe, `${json ? '"taxa"' : "taxa"}: ${JSON.stringify(taxa)}`);
      text = text.slice(0, at) + card + text.slice(end);
      changed.set(key, (changed.get(key) ?? 0) + 1);
    }
  }
  writeFileSync(file, text);
}
console.log([...changed].map(([k, n]) => `${k} x${n}`).join(" "));
const missing = Object.keys(FIXES).filter((k) => !changed.has(k));
if (missing.length) console.log(`NOT FOUND: ${missing.join(" ")}`);
