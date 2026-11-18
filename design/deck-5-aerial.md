# Deck 5: Aerial (on paper)

Built around the Aerial Tag and the convergent evolution of wings, across a range of taxa. The Biome and the deck's shape aren't decided. It doesn't need to match the Level spread of the other decks.

Epochs use the earliest epoch the animal is known from. An animal still alive today is always Quaternary.

## Roster so far

| Creature | Level | Scientific name | Diet | Tags | Period | Epoch | Status |
|---|---|---|---|---|---|---|---|
| Hatzegopteryx | 3 | Hatzegopteryx thambema | Carnivore | Aerial, Sovereign, Apex Predator | Cretaceous | Late | New |
| Quetzalcoatlus | 3 | Quetzalcoatlus northropi | Carnivore | Aerial, Gigantic, Small Game Hunter | Cretaceous | Late | New |
| Argentavis | 2 | Argentavis magnificens | Carnivore | Aerial, Gigantic, Scavenger, Small Game Hunter | Neogene | | New |
| Haast's Eagle | 2 | Hieraaetus moorei | Carnivore | Aerial, Apex Predator, Ambush, Raptorial | Quaternary | | New |
| Pteranodon | 1 | Pteranodon longiceps | Carnivore | Aerial, Diver, Cranial Display | Cretaceous | Late | New |
| Pterodaustro | 1 | Pterodaustro guinazui | Carnivore | Aerial, Specialized, Filter Feeder, Nesting | Cretaceous | Early | New |
| Archaeopteryx | 1 | Archaeopteryx lithographica | Carnivore | Small Game Hunter, Divergent, Aerial | Jurassic | Late | From Deck 1, preliminary; Divergent replaces Transitional in both decks, to be tested |
| Pelagornis | 1 | Pelagornis sandersi | Carnivore | Aerial, Semi-Aquatic, Gigantic | Paleogene | Late | From Deck 1, preliminary |
| Meganeura | 0 | Meganeura monyi | Carnivore | Aerial, Raptorial, Elusive | Carboniferous | Late | New |
| Ambopteryx | 0 | Ambopteryx longibrachium | Omnivore | Glider, Elusive, Dead End | Jurassic | Late | New |
| Weigeltisaurus | 0 | Weigeltisaurus jaekeli | Carnivore | Glider, Cranial Display, Dead End | Permian | Late | New |
| Microraptor | 0 | Microraptor gui | Carnivore | Generalist, Glider, Elusive | Cretaceous | Early | From Deck 1, preliminary |
| Hoatzin | 0 | Opisthocomus hoazin | Herbivore | Resourceful, Living Fossil, Aerial | Quaternary | | From Deck 1, preliminary |

Taxa for every new Creature still need checking against sources.

## Card faces

The cards are in the game data (`src/data/deck-5.ts`) as an inspect-only deck. Faces are built into `design/card-faces/` and shipped as WebP in `public/card-faces/`. Art is in `public/artwork/` at 1200 × 678, credited in `public/artwork/attribution-manifest.json`.

| Card | Commons file | Creator | License | sha1 | Changes |
|---|---|---|---|---|---|
| Hatzegopteryx | Hatzegopteryx thambema.png | Connor Ashbridge | CC BY 4.0 | 27f3d39a2a0b82ecbb63d3a3c69d28cd26db1c70 | Transparent background made white; trimmed and fitted inside the frame; resized; WebP |
| Quetzalcoatlus | Life restoration of a group of giant azhdarchids, Quetzalcoatlus northropi, foraging on a Cretaceous fern prairie.png | Mark Witton and Darren Naish (Witton & Naish 2008, PLoS ONE) | CC BY 3.0 | a575fcd9f76aadc1453c84918562569fc36268b9 | Cropped from the top (y = 30) at full width; resized; WebP |
| Haast's Eagle | Giant Haasts eagle attacking New Zealand moa.jpg | John Megahan (PLoS Biology 3(1): e20, 2005) | CC BY 2.5 | 6ed022c076f68c9f59422d83f758058f3b0b547d | Cropped from the top (y = 40) at full width; resized; WebP |
| Pteranodon | Pteranodon TD.png | TotalDino | CC BY 4.0 | ca9fe819b3a093f22141e7dace6292410131c837 | Transparent background made white; trimmed and fitted inside the frame; resized; WebP |
| Pterodaustro | Pterodaustro guinazui.png | Connor Ashbridge | CC BY 4.0 | 9ab06abdadf331353e87b54e9d69ae75e629700f | Transparent background made white; trimmed and fitted inside the frame; resized; WebP |

No acceptable art yet for Argentavis (only CC0 file is flagged inaccurate), Meganeura (flagged drawing or a model photo), Ambopteryx (all restorations are CC BY-SA) or Weigeltisaurus (only a tiny, outdated file). Also downloaded and not used: Cretoxyrhina attacking Pteranodon.png (Mark P. Witton, CC BY 4.0), where the shark is the subject.

## New Tag: Dead End

> **Dead End:** When this Creature goes to your History Pile from anywhere, you may choose a Concept in your History Pile and add it to your hand. Dead End can trigger only once per turn across all your Creatures.

- Who qualifies: a Creature whose signature adaptation lost out to a different solution, and which no living animal has. Pterosaurs don't qualify: their wing succeeded for 160 million years until the end-Cretaceous extinction.
- Ambopteryx: its membrane wing on a rod-like wrist bone. Dinosaurs went on to fly on feathers instead.
- Smilodon (Deck 4 and General Pool; one card, so it changes everywhere): saber teeth evolved independently at least four or five times (gorgonopsians, nimravids, barbourofelids, sabertooth cats, a sabertooth marsupial) and every lineage died out; the conical-toothed cats survived.
- Weigeltisaurus: no living animal glides on rods of bone growing from the skin; today's gliding lizards use their ribs.
- "From anywhere" is deliberate: discarding a Dead End Creature as a cost (Natural Selection, Whale Fall, Genetic Drift) is meant as a boon.
- The once-per-turn limit is provisional.
- Timing (engine only, not printed): Dead End resolves the moment the Creature reaches History, even mid-effect, so the card that sent it there isn't in History yet and can't be chosen.

## Notes

- Hatzegopteryx: giant azhdarchid pterosaur from the Maastrichtian Hațeg Basin, Romania (Buffetaut, Grigorescu and Csiki, 2002). Wingspan estimates run 8–12 m; older 15–20 m figures were revised down. Naish and Witton (2017, PeerJ 5:e2908) describe it as short-necked and robust, likely the island's top predator, as no large theropods are known from Hațeg.
- Quetzalcoatlus northropi: giant azhdarchid from the Maastrichtian of Big Bend, Texas, with a wingspan around 10–11 m. Long, slender neck and small head; the model "terrestrial stalker" of small to mid-sized prey (Witton and Naish, 2008). It sets itself apart from Hatzegopteryx as the long-necked small-prey stalker against the short-necked heavy predator.
- Meganeura monyi: griffinfly from the late Carboniferous of Commentry, France, wingspan about 65–70 cm. A predatory insect.
- Pteranodon longiceps: toothless, crested pterosaur from the Late Cretaceous Niobrara deposits of the Western Interior Seaway; ate fish.
- Argentavis magnificens: late Miocene, Argentina; wingspan around 6 m. Neogene cards leave the epoch blank, like Megalodon and Livyatan.
- Haast's eagle: New Zealand, hunted moa; extinct around 1400. Once called Harpagornis moorei; DNA work moved it to Hieraaetus.
- Ambopteryx longibrachium: Yanliao Biota, Liaoning, China, Oxfordian (Late Jurassic), described by Wang, O'Connor, Xu and Zhou (2019, Nature 569: 256–259). The name means "both wings": feathers and a membrane wing on a rod-like wrist bone. Gizzard stones and bone fragments in its stomach area, with its family's teeth, point to an omnivore. About 32 cm long and roughly 300 g; fused tail bones show a full-grown animal. It replaced its sister species Yi qi, whose diet is unknown, because its Omnivore Diet rests on direct evidence.
- Weigeltisaurus jaekeli: Late Permian Kupferschiefer of Germany. Its gliding membrane was held out by long, hollow rods of bone growing from the skin, not by ribs (Frey, Sues and Munk, 1997). Once filed under Coelurosauravus, it was given back its own genus in 2015. Likely ate insects.
- Pterodaustro guinazui: Lagarcito Formation, San Luis, Argentina, Albian (Early Cretaceous). Filter feeder with about a thousand bristle-like teeth; more than 750 specimens known.
- Why each Tag, argued from the sources:
  - Meganeura: Raptorial for the large spines on its feet, read by comparison with dragonflies as a prey-catching "flying trap". Not Small Game Hunter: it ate insects, and the game's Level 0 Creatures are larger vertebrates.
  - Pteranodon: Diver for fish remains in its stomach area and a fish bolus between the jaws of another specimen. Cranial Display for crest sexual dimorphism (Bennett 1992; Bennett and Penkalski 2017), which is debated. No Gigantic: azhdarchids twice its span lived alongside it.
  - Argentavis: Level 2 for mass estimates of 65–120 kg, more than double Pelagornis. Gigantic as the largest flying bird known. Both Scavenger (Palmqvist and Vizcaíno 2003) and Small Game Hunter (Campbell and Tonni 1983, and later teratorn work), because its diet is still debated.
  - Haast's Eagle: Level 2 although it weighed 15–18 kg, because it killed moa up to adult South Island giant moa size (puncture wounds in moa hips), and the game's Giant Moa is Gigantic, which blocks Level 0–1 hunters. Apex Predator as New Zealand's top predator. Ambush for diving onto moa from a high perch and striking from behind.
  - Ambopteryx: Glider, not Aerial; aerodynamic modelling of the membrane-winged dinosaurs found them poor gliders without powered flight (Dececchi et al. 2020). Elusive as a small, long-fingered tree-climber. Not Ancestor: its wing was an evolutionary dead end.
  - Weigeltisaurus: Glider for its rod-supported membrane and slender toes like those of tree-dwelling lizards. Cranial Display for its horned skull frill (Pritchard et al. 2021); the frill's purpose is unknown.
  - Meganeura: Elusive because, as an insect, it can't Hunt vertebrates (Level 1+), and its coin flip stands for dragonfly-style agile flight, inferred from living relatives.
  - Haast's Eagle: Raptorial because it killed with its talons: crushing grips and punctures in moa hips.
  - Archaeopteryx: Divergent (preliminary, may prove too strong in testing) as the classic transitional form at the base of birds; every bird in the deck has all of its taxa.
  - Pterodaustro: Specialized Filter Feeder for its roughly thousand bristle-like teeth, the most extreme filter apparatus among pterosaurs. Nesting for an embryo in its egg and hatchlings at its one site, which point to a nesting ground nearby (Chiappe et al. 2004).
- Birds are capped at Level 2, game-wide. Argentavis stays Level 2 for its place in the food chain. The largest terror bird and the elephant bird would also be Level 2. So Divergent on Archaeopteryx never gets its two-Level jump; it works as Transitional plus the extra-play override.
- Levers held back for later: Bruiser on Hatzegopteryx (fits "prey too large for other azhdarchids", Naish and Witton 2017; held back for power level).
- Sovereign on a Carnivore means it also counts as Gigantic and gains Territorial. It is the third Sovereign Creature, after Tyrannosaurus and Dreadnoughtus.
