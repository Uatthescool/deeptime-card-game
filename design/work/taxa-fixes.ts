// One-off: makes the creature taxa consistent (see the taxa check of 27 October 2026). Rewrites each listed card's
// taxa (and gameplay Taxon where given) in every data file that defines it, then prints the keys it changed.
//   npx vite-node design/work/taxa-fixes.ts
import { readFileSync, writeFileSync } from "node:fs";

const base = ["Vertebrate", "Amniote", "Archosaur", "Dinosaur"];
const theropod = [...base, "Saurischian", "Theropod"];
const coelurosaur = [...theropod, "Tetanuran", "Coelurosaur"];
const ornithischian = [...base, "Ornithischian"];
const whale = ["Vertebrate", "Amniote", "Synapsid", "Mammal", "Cetacean"];

const FIXES: Record<string, { taxa: string[]; gameplayTaxon?: string }> = {
  // Theropods: Tetanuran > Coelurosaur > Paravian wherever they apply; Neotheropod and Maniraptoran are not used.
  dilophosaurus: { taxa: [...theropod, "Dilophosaurid"] },
  gojirasaurus: { taxa: [...theropod, "Coelophysoid"] },
  allosaurus: { taxa: [...theropod, "Tetanuran", "Carnosaur", "Allosaurid"] },
  baryonyx: { taxa: [...theropod, "Tetanuran", "Spinosaurid"] },
  yutyrannus: { taxa: [...coelurosaur, "Tyrannosauroid"] },
  "tyrannosaurus-rex": { taxa: [...coelurosaur, "Tyrannosauroid", "Tyrannosaurid"] },
  therizinosaurus: { taxa: [...coelurosaur, "Therizinosaurid"] },
  microraptor: { taxa: [...coelurosaur, "Paravian", "Dromaeosaurid"] },
  natovenator: { taxa: [...coelurosaur, "Paravian", "Dromaeosaurid"] },
  utahraptor: { taxa: [...coelurosaur, "Paravian", "Dromaeosaurid"] },
  velociraptor: { taxa: [...coelurosaur, "Paravian", "Dromaeosaurid"] },
  archaeopteryx: { taxa: [...coelurosaur, "Paravian", "Avialan"] },
  hoatzin: { taxa: [...coelurosaur, "Paravian", "Avialan", "Bird", "Opisthocomiform"] },
  "giant-moa": { taxa: [...coelurosaur, "Paravian", "Avialan", "Bird", "Palaeognath", "Dinornithiform"] },
  // Ornithischians: the subfamily and group ranks their relatives already list.
  triceratops: { taxa: [...ornithischian, "Ceratopsian", "Ceratopsid", "Chasmosaurine"] },
  shantungosaurus: { taxa: [...ornithischian, "Ornithopod", "Iguanodontian", "Hadrosaurid", "Saurolophine"] },
  parasaurolophus: { taxa: [...ornithischian, "Ornithopod", "Iguanodontian", "Hadrosaurid", "Lambeosaurine"] },
  ankylosaurus: { taxa: [...ornithischian, "Thyreophoran", "Ankylosaur", "Ankylosaurid"] },
  // Others.
  megalodon: { taxa: ["Vertebrate", "Gnathostome", "Chondrichthyan", "Euselachian", "Shark", "Lamniform", "Otodontid"] },
  omnidens: { taxa: ["Invertebrate", "Protostome", "Ecdysozoan", "Panarthropod", "Stem Euarthropod"] },
  diplocaulus: { taxa: ["Vertebrate", "Tetrapod", "Amphibian", "Lepospondyl", "Nectridean", "Diplocaulid"] },
  // Gameplay Taxon fixes.
  "horseshoe-crab": {
    taxa: ["Invertebrate", "Protostome", "Ecdysozoan", "Euarthropod", "Chelicerate", "Xiphosuran"],
    gameplayTaxon: "Chelicerate",
  },
  "blue-whale": { taxa: [...whale, "Mysticete", "Balaenopterid"], gameplayTaxon: "Synapsid" },
  orca: { taxa: [...whale, "Odontocete", "Delphinid"], gameplayTaxon: "Synapsid" },
  livyatan: { taxa: [...whale, "Odontocete", "Physeteroid"], gameplayTaxon: "Synapsid" },
  ichthyosaurus: { taxa: ["Vertebrate", "Amniote", "Diapsid", "Ichthyosaur"], gameplayTaxon: "Diapsid" },
  shastasaurus: { taxa: ["Vertebrate", "Amniote", "Diapsid", "Ichthyosaur", "Shastasaurid"], gameplayTaxon: "Diapsid" },
  plesiosaurus: { taxa: ["Vertebrate", "Amniote", "Diapsid", "Sauropterygian", "Plesiosaur"], gameplayTaxon: "Diapsid" },
  mosasaurus: {
    taxa: ["Vertebrate", "Amniote", "Diapsid", "Lepidosaur", "Squamate", "Mosasaurid"],
    gameplayTaxon: "Diapsid",
  },
};

const FILES = ["src/data/deck-1.json", "src/data/deck-2.ts", "src/data/deck-3.ts", "src/data/general-pool.ts"];
const changed = new Set<string>();
for (const file of FILES) {
  let text = readFileSync(file, "utf8");
  const json = file.endsWith(".json");
  for (const [key, fix] of Object.entries(FIXES)) {
    const keyText = json ? `"key": "${key}"` : `key: "${key}"`;
    for (let at = text.indexOf(keyText); at >= 0; at = text.indexOf(keyText, at + 1)) {
      // The card's own fields run to the next card's key.
      const next = text.indexOf(json ? `"key": "` : `key: "`, at + 1);
      const end = next < 0 ? text.length : next;
      let card = text.slice(at, end);
      const taxaRe = json ? /"taxa": \[[^\]]*\]/ : /taxa: \[[^\]]*\]/;
      if (!taxaRe.test(card)) throw new Error(`No taxa for ${key} in ${file}`);
      card = card.replace(taxaRe, `${json ? '"taxa"' : "taxa"}: ${JSON.stringify(fix.taxa)}`);
      if (fix.gameplayTaxon) {
        const gtRe = json ? /"gameplayTaxon": "[^"]*"/ : /gameplayTaxon: "[^"]*"/;
        card = card.replace(gtRe, `${json ? '"gameplayTaxon"' : "gameplayTaxon"}: "${fix.gameplayTaxon}"`);
      }
      text = text.slice(0, at) + card + text.slice(end);
      changed.add(key);
    }
  }
  writeFileSync(file, text);
}
const missing = Object.keys(FIXES).filter((k) => !changed.has(k));
console.log(`changed ${changed.size}: ${[...changed].join(" ")}`);
if (missing.length) console.log(`NOT FOUND: ${missing.join(" ")}`);
