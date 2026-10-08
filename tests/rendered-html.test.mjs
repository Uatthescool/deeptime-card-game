import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("renders development preview metadata", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  assert.match(await response.text(), developmentPreviewMeta);
});

test("protects the desktop battlefield in short browser windows", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const compactMode = css
    .split("@media (min-width: 821px) and (max-height: 760px) {")[1]
    ?.split("@media (min-width: 821px) and (max-width: 1100px)")[0] ?? "";

  assert.match(compactMode, /\.table-board-region\s*\{[\s\S]*?grid-template-rows:\s*minmax\(136px, 1fr\) 11px minmax\(136px, 1fr\);/);
  assert.match(compactMode, /\.table-board-region\s*\{[\s\S]*?overflow-y:\s*auto;/);
  assert.match(compactMode, /\.opponent-biome-half\s*\{\s*grid-template-rows:\s*28px minmax\(108px, 1fr\);/);
  assert.match(compactMode, /\.player-biome-half\s*\{\s*grid-template-rows:\s*minmax\(108px, 1fr\) 28px;/);
  assert.match(compactMode, /\.hand-workspace\s*\{\s*grid-template-rows:\s*44px minmax\(0, 1fr\);/);
  assert.match(compactMode, /\.sidewall-identity \.card-art-window\s*\{\s*width:\s*calc\(100% \+ 1\.3rem\);\s*margin-inline:\s*-\.65rem;/);
  assert.doesNotMatch(compactMode, /320px/);
  assert.doesNotMatch(compactMode, /\.hand-card-button|\.game-card\.compact|\.hand-scroll\s*\{/);
});

test("keeps every deck-browser card uniform and fits long single-word names", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(page, /word\.length >= 16/);
  assert.match(page, /className=\{hasLongTitleWord \? "long-word-title" : undefined\}/);
  assert.match(css, /\.deck-browser-grid\s*\{[^}]*grid-auto-rows:\s*232px;/);
  assert.match(css, /\.deck-browser-card \.game-card\.compact\s*\{[^}]*height:\s*100%;[^}]*grid-template-rows:/);
  assert.match(css, /h3\.long-word-title\s*\{[^}]*font-size:\s*\.84rem;[^}]*white-space:\s*nowrap;/);
});

test("puts every Tag rule on the primary card screen without Card Role or Period Color", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.doesNotMatch(page, /tags\.slice/);
  assert.doesNotMatch(page, /className="card-status"/);
  assert.doesNotMatch(css, /\.card-status\s*\{/);
  assert.match(page, /function CardTagRules/);
  assert.match(page, /className="primary-tag-section"/);
  assert.match(page, /<CardTagRules card=\{card\}/);
  assert.doesNotMatch(page, /<h3>Card role<\/h3>/i);
  assert.doesNotMatch(page, /<dt>Period color<\/dt>/i);
  assert.match(page, /inherited && <small>from Sovereign<\/small>/);
  assert.match(css, /\.board-tags\s*\{[^}]*white-space:\s*normal;/);
});

test("pins clicked cards and prevents hover previews from overriding the pin", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /const \[pinnedInspection, setPinnedInspection\]/);
  assert.match(page, /const \[hoverInspection, setHoverInspection\]/);
  assert.match(page, /const activeInspection = pinnedInspection \?\? hoverInspection;/);
  assert.match(page, /const target = pinnedTarget \?\? hoverTarget \?\? defaultTarget;/);
  assert.match(page, /onMouseEnter: \(\) => onPreview\(target\)/);
  assert.match(page, /onMouseLeave: \(\) => onPreview\(null\)/);
  assert.match(page, /onClick=\{\(\) => \{ setPinnedTarget\(inspection\); setHoverTarget\(null\);/);
  assert.match(page, /pinned=\{Boolean\(pinnedInspection\)\}/);
  assert.match(page, /if \(next\.handoff \|\| next\.activePlayer !== game\.activePlayer\) \{\s*setPinnedInspection\(null\);\s*setHoverInspection\(null\);/);
});

test("uses optimized independent Biome backgrounds and rotates only the opponent artwork", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  for (const biome of ["tropical", "temperate", "cold", "arid", "aquatic"]) {
    const image = await readFile(new URL(`../public/biomes/${biome}.webp`, import.meta.url));
    assert.ok(image.length > 100_000, `${biome} background should contain production artwork`);
    assert.equal(image.subarray(0, 4).toString("ascii"), "RIFF");
    assert.equal(image.subarray(8, 12).toString("ascii"), "WEBP");
    assert.match(page, new RegExp(`${biome}: "/biomes/${biome}\\.webp"`));
  }
  assert.match(page, /className=\{`biome-board-half opponent-biome-half/);
  assert.match(page, /className=\{`biome-board-half player-biome-half/);
  assert.match(css, /\.biome-board-half::before\s*\{[^}]*background-size:\s*cover;/);
  assert.match(css, /\.opponent-biome-half::before\s*\{\s*transform:\s*rotate\(180deg\);\s*\}/);
  assert.doesNotMatch(css, /scaleX\(-1\)/);
  assert.match(css, /\.biome-board-half \.empty-niche\s*\{[^}]*background:\s*rgba\([^;]+\.06\);/);
  assert.match(css, /\.biome-board-half \.adaptation-slot\s*\{[^}]*background:\s*rgba\([^;]+\.05\);/);
});

test("renders Wildfire as a lane object rather than an Event Zone card", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(page, /className="wildfire-marker"/);
  assert.match(page, /legalWildfireLanes/);
  assert.match(page, /playWildfire/);
  assert.match(css, /\.wildfire-marker\s*\{/);
});

test("keeps mandatory Cranial Display choices inside the fixed control bar", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.doesNotMatch(page, /className="choice-banner"/);
  assert.match(page, /className="mandatory-control-prompt"/);
  assert.match(css, /\.mandatory-control-prompt\s*\{[^}]*position:\s*absolute;/);
  assert.match(page, /active\.allowances\.skipBattlePhase \? "End Turn · Battle skipped"/);
  assert.match(page, /legalHuntsAvailable \? "Enter Battle Phase" : "End Turn"/);
});

test("presents Semelparity's optional replacement and Battle skip clearly", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const register = JSON.parse(await readFile(new URL("../app/card-register.json", import.meta.url), "utf8"));
  const semelparity = register.supports.find((card) => card.key === "semelparity");
  assert.match(page, /"semelparity-replacement-card"/);
  assert.match(page, /"semelparity-replacement-lane"/);
  assert.match(page, /Battle skipped/);
  assert.match(semelparity.rules, /Draw 2 cards\./);
  assert.match(semelparity.rules, /does not count as your normal Creature play/);
  assert.match(semelparity.rules, /skip your Battle Phase this turn/);
  assert.doesNotMatch(semelparity.rules, /Draw 3 cards/);
});

test("formats Evolutionary Radiation as two effects and explains the double-effect Battle skip", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const register = JSON.parse(await readFile(new URL("../app/card-register.json", import.meta.url), "utf8"));
  const radiation = register.supports.find((card) => card.key === "evolutionary-radiation");
  assert.match(radiation.rules, /• If you control no Level 0 Creatures:/);
  assert.match(radiation.rules, /• If you control no Level 1 Creatures:/);
  assert.match(radiation.rules, /choose both if you meet both prerequisites/);
  assert.match(radiation.rules, /skip your Battle Phase this turn/);
  assert.match(radiation.rules, /Neither of these plays counts as your normal Creature play/);
  assert.match(page, /Choose one effect—or both/);
  assert.match(css, /\.support-inspection p\s*\{\s*white-space:\s*pre-line;/);
});

test("formats Abiogenesis as a two-effect choice with placement timing", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const register = JSON.parse(await readFile(new URL("../app/card-register.json", import.meta.url), "utf8"));
  const abiogenesis = register.supports.find((card) => card.key === "abiogenesis");
  assert.match(abiogenesis.rules, /Choose 1 of the following effects:/);
  assert.match(abiogenesis.rules, /• Search your deck for a Level 0 Creature/);
  assert.match(abiogenesis.rules, /• Play a Level 0 Creature from your hand/);
  assert.match(abiogenesis.rules, /does not count as your normal Creature play/);
  assert.match(abiogenesis.rules, /skip your Battle Phase this turn/);
  assert.match(page, /"abiogenesis-mode"/);
  assert.match(page, /"abiogenesis-placement-card"/);
  assert.match(page, /"abiogenesis-placement-lane"/);
});

test("exposes three playable 40-card decks beside a clearly non-playable General Pool", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /Not playable · Work in progress/);
  assert.match(page, /Deck 2: Herbivore Development/);
  assert.match(page, /complete 40-card singleton Herbivore and board-development deck/);
  assert.match(page, /DECK_2_DECK\.length/);
  assert.match(page, /group\("Deck 2 Creatures", DECK_2\)/);
  assert.match(page, /DECK_2_SUPPORTS/);
  assert.match(page, /Deck 3: Aquatic Carnivores/);
  assert.match(page, /complete 40-card singleton Aquatic Carnivore deck/);
  assert.match(page, /DECK_3_DECK\.length/);
  assert.match(page, /group\("Deck 3 Creatures", DECK_3\)/);
  assert.match(page, /DECK_3_SUPPORTS/);
  assert.match(page, /GENERAL_POOL\.length/);
  assert.match(page, /never enter either player’s deck/);
  assert.match(page, /aria-label="Player one deck"/);
  assert.match(page, /aria-label="Player two deck"/);
  assert.match(page, /Choose any 40-card deck independently/);
});

test("presents five complete Biome choices before opening hands", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const biomeData = await readFile(new URL("../app/biomes.ts", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  for (const name of ["Tropical", "Temperate", "Cold", "Arid", "Aquatic"]) {
    assert.match(biomeData, new RegExp(`name: "${name}"`));
  }
  assert.match(page, /className="biome-panel-grid"/);
  assert.match(page, /biome\.subBiomes\.map/);
  assert.match(page, /className="biome-ability-copy"/);
  assert.match(page, /className="biome-flavor"/);
  assert.match(page, /<i>\{biome\.flavor\}<\/i>/);
  assert.match(page, /Both selections are revealed before either opening hand is drawn/);
  assert.match(css, /\.biome-panel-grid\s*\{[^}]*grid-auto-columns:/);
});

test("animates opening hands and later draws one card at a time", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const engine = await readFile(new URL("../app/game-engine.ts", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(page, /function OpeningDealOverlay/);
  assert.match(page, /openingDeal\.dealt < 10 \? 170 : 500/);
  assert.match(page, /function DrawPresentation/);
  assert.match(page, /queue\.slice\(1\)\), 680/);
  assert.match(engine, /state\.drawEvents\.push/);
  assert.match(css, /\.drawn-card-motion\s*\{[^}]*animation:/);
});

test("opens a data-driven Learn Something Lesson around the canonical card renderer", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const lessons = await readFile(new URL("../app/lessons.ts", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(page, /function LessonExperience/);
  assert.match(page, /className="learn-something-button"/);
  assert.match(page, /<CardFace card=\{card\} \/>/);
  assert.match(page, /Back to Previous Lesson/);
  assert.match(page, /View All Sources/);
  assert.match(page, /Inspect Evidence/);
  assert.match(page, /Explore more related cards in this lesson\./);
  assert.match(page, /window\.sessionStorage/);
  assert.match(page, /window\.localStorage/);
  assert.match(lessons, /id: "amargasaurus"/);
  assert.match(lessons, /reviewedAt: "2026-09-03"/);
  assert.match(lessons, /glossaryId: "osteohistology"/);
  assert.match(lessons, /https:\/\/doi\.org\/10\.1111\/joa\.13659/);
  assert.match(css, /\.lesson-frame\s*\{[^}]*aspect-ratio:\s*16 \/ 9;[^}]*overflow:\s*hidden;/);
  assert.match(css, /@media \(max-width: 1279px\), \(max-height: 719px\)/);
  assert.match(css, /\.lesson-size-warning\s*\{/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("routes visible Learn Something leader lines without crossing the left-side callout order", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(page, /orderedAnnotations = useMemo/);
  assert.match(page, /left\.target\.yPercent - right\.target\.yPercent/);
  assert.match(page, /C \$\{firstControlX\} \$\{startY\}, \$\{secondControlX\} \$\{targetY\}, \$\{targetX\} \$\{targetY\}/);
  assert.match(page, /viewBox=\{`0 0 \$\{geometry\.width\} \$\{geometry\.height\}`\}/);
  assert.match(page, /className="lesson-leader-line-halo"/);
  assert.match(page, /className="lesson-leader-line"/);
  assert.match(css, /\.lesson-leader-line-halo\s*\{[^}]*stroke-width:\s*5;/);
  assert.match(css, /\.lesson-leader-line\s*\{[^}]*stroke-width:\s*1\.7;/);
});

test("uses the locked creature card faces everywhere cards render", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const deckTwo = await readFile(new URL("../app/deck-2.ts", import.meta.url), "utf8");
  const lessons = await readFile(new URL("../app/lessons.ts", import.meta.url), "utf8");
  const register = JSON.parse(await readFile(new URL("../app/card-register.json", import.meta.url), "utf8"));
  const nautilus = register.creatures.find((card) => card.key === "nautilus");
  const tyrannosaurus = register.creatures.find((card) => card.key === "tyrannosaurus-rex");

  assert.equal(nautilus.cardFace, "/card-faces/nautilus.png");
  assert.equal(tyrannosaurus.cardFace, "/card-faces/tyrannosaurus-rex.png");
  assert.match(deckTwo, /key: "amargasaurus"[\s\S]*?cardFace: "\/card-faces\/amargasaurus\.png"/);
  assert.match(page, /if \(creature\?\.cardFace\)/);
  assert.match(page, /className=\{`\$\{cardClassName\} canonical-card-face`\}/);
  assert.match(css, /\.game-card\.canonical-card-face\s*\{[^}]*aspect-ratio:\s*1462 \/ 2048;/);
  assert.match(lessons, /id: "amargasaurus"[\s\S]*?cardKey: "amargasaurus"/);
  assert.match(lessons, /target: \{ xPercent: 45\.4, yPercent: 52, label: "The card’s gameplay Taxon" \}/);
  assert.match(lessons, /target: \{ xPercent: 36\.4, yPercent: 19\.7, label: "Reconstructed neck spines" \}/);
  assert.match(lessons, /target: \{ xPercent: 28\.8, yPercent: 67\.3, label: "Spinal Sail Tag" \}/);

  for (const fileName of ["amargasaurus.png", "nautilus.png", "tyrannosaurus-rex.png"]) {
    const image = await readFile(new URL(`../public/card-faces/${fileName}`, import.meta.url));
    assert.equal(image.subarray(1, 4).toString("ascii"), "PNG");
    assert.equal(image.readUInt32BE(16), 1462);
    assert.equal(image.readUInt32BE(20), 2048);
  }
});

test("publishes the Revision 2.0 Aquatic, Specialized, placeholder, Spinal Sail, Sovereign, and apex records", async () => {
  const register = JSON.parse(await readFile(new URL("../app/card-register.json", import.meta.url), "utf8"));
  const pool = await readFile(new URL("../app/general-pool.ts", import.meta.url), "utf8");
  const deckThree = await readFile(new URL("../app/deck-3.ts", import.meta.url), "utf8");
  assert.equal(register.version, "2.0");
  assert.equal(register.tagRules["Spinal Sail"], "Event and Tag effects each apply 1 less Victory Level decrease to this Creature.");
  assert.match(register.tagRules.Aquatic, /Primary Taxa count as matching/);
  assert.match(register.tagRules.Aquatic, /already match, Aquatic supplies the Tag category instead/);
  assert.match(register.tagRules["Semi-Aquatic"], /Events and Concepts/);
  assert.match(register.tagRules["Semi-Aquatic"], /not for Adaptations or Aquatic's own effect/);
  assert.equal(register.tagRules.Diver, "Gets +1 Battle Level while attacking a Creature with the Aquatic Tag.");
  assert.match(register.tagRules.Sovereign, /battle level cannot be lowered/i);
  assert.match(register.tagRules.Sovereign, /Carnivore or Omnivore/);
  assert.match(register.tagRules.Sovereign, /Herbivore/);
  assert.equal(register.tagRules.Osteophagy, undefined);
  assert.equal(register.tagRules["Shearing Bite"], "Placeholder Tag, effect undecided.");
  assert.equal(register.tagRules.Retention, "Placeholder Tag, effect undecided.");
  assert.equal(register.tagRules["Filter Feeder"], "When this Creature enters play, look at the top 2 cards of your deck, then return them to the top in any order.");
  assert.match(register.tagRules.Specialized, /Double each numerical modifier or quantity/);
  assert.match(register.tagRules.Specialized, /conditions, thresholds, restrictions, or permissions/);
  assert.ok(register.creatures.every((card) => card.diet !== "Piscivore"));
  assert.deepEqual(register.creatures.find((card) => card.key === "tyrannosaurus-rex").tags, ["Apex Predator", "Sovereign", "Crushing Bite", "Durophagy"]);
  assert.match(pool, /tags: \["Semi-Aquatic", "Ambush", "Crushing Bite", "Apex Predator"\]/);
  assert.match(deckThree, /tags: \["Aquatic", "Apex Predator", "Specialized", "Crushing Bite"\]/);
  assert.match(deckThree, /key: "tiktaalik"/);
  assert.match(deckThree, /tags: \["Aquatic", "Transitional"\]/);
  assert.match(deckThree, /key: "blue-whale"/);
  assert.match(deckThree, /printedLevel: 4/);
  assert.match(deckThree, /tags: \["Aquatic", "Filter Feeder", "Specialized", "Gigantic"\]/);
  assert.match(deckThree, /key: "drought"/);
  assert.match(deckThree, /key: "island-dwarfism"/);
  assert.match(deckThree, /key: "geological-boundary"/);
  assert.match(deckThree, /eventType: "instant"/);
});

test("publishes Deck 2 inspection records and dedicated interaction controls", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const engine = await readFile(new URL("../app/game-engine.ts", import.meta.url), "utf8");
  const deckTwo = await readFile(new URL("../app/deck-2.ts", import.meta.url), "utf8");
  const register = JSON.parse(await readFile(new URL("../app/card-register.json", import.meta.url), "utf8"));

  for (const key of ["air-sacs", "thagomizer", "dental-battery", "facultative-quadrupedality", "genetic-mutations", "stampede"]) {
    assert.match(deckTwo, new RegExp(`key: "${key}"`));
  }
  assert.match(deckTwo, /key: "dreadnoughtus"/);
  assert.match(deckTwo, /printedLevel: 4/);
  assert.match(deckTwo, /tags: \["Herd", "Cranial Display", "Resonance"\]/);
  assert.equal(register.tagRules.Resonance, "Placeholder Tag, effect undecided.");
  assert.equal(register.tagRules.Graviportal.includes("cannot be moved"), true);
  assert.equal(register.tagRules.Armament.includes("attacking or defending"), true);
  assert.equal(register.tagRules["Tail Armament"], undefined);

  assert.match(page, /function EntryChoiceModal/);
  assert.match(page, /game\.pendingHerd \|\| game\.pendingNesting/);
  assert.match(page, /Use Facultative Movement/);
  assert.match(page, /isStampedeHunt/);
  assert.match(page, /Resolve Hunt/);
  assert.match(page, /a tie normally destroys neither Creature unless an effect says otherwise/);
  assert.match(engine, /function continueStampede/);
  assert.match(engine, /legalFacultativeDestinations/);
  assert.match(engine, /state\.pendingHerd/);
  assert.match(engine, /state\.pendingNesting/);
});

test("renders Deck 3 board objects and mandatory resolutions with dedicated controls", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  for (const name of ["FilterFeederModal", "GeologicalBoundaryModal", "EngulfModal"]) {
    assert.match(page, new RegExp(`function ${name}`));
  }
  assert.match(page, /className="drought-marker"/);
  assert.match(page, /lane\.engulfed \? `Engulfed/);
  assert.match(page, /playDrought/);
  assert.match(page, /playAdaptation\(game, selectedCard\.uid, laneIndex, playerId\)/);
  assert.match(css, /\.drought-marker\s*\{/);
  assert.match(css, /\.adaptation-slot\.engulfed\s*\{/);
  assert.match(css, /\.geological-boundary-modal, \.engulf-modal\s*\{/);
  assert.match(css, /\.period-choice-grid\s*\{/);
});

test("publishes Cold as a Gigantic Tag augmentation", async () => {
  const biomeData = await readFile(new URL("../app/biomes.ts", import.meta.url), "utf8");
  assert.match(biomeData, /The Gigantic Tag gains the following effect for Creatures you control/);
  assert.match(biomeData, /While this Creature is defending, it gets \+1 Battle Level unless the hunting Creature has Gigantic or Bruiser/);
});

test("keeps Charge in the Battle Phase and removes its Development prompt", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const engine = await readFile(new URL("../app/game-engine.ts", import.meta.url), "utf8");
  assert.doesNotMatch(page, /function ChargePrompt/);
  assert.doesNotMatch(page, /Optional Charge/);
  assert.doesNotMatch(engine, /pendingCharge/);
  assert.match(engine, /!attackerDef\.tags\.includes\("Charge"\)/);
  assert.match(engine, /attackerDef\.tags\.includes\("Charge"\) && attackerLane !== targetLane/);
});

test("defers Genetic Drift draw motion until its mandatory discard and suppresses Tropical filtering for multi-draw Starts", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const engine = await readFile(new URL("../app/game-engine.ts", import.meta.url), "utf8");
  assert.match(page, /const \[deferredDraws, setDeferredDraws\]/);
  assert.match(page, /next\.pendingConceptChoice\?\.kind === "genetic-drift-discard"/);
  assert.match(page, /game\.pendingConceptChoice\?\.kind === "genetic-drift-discard"/);
  assert.match(engine, /function scheduledStartPhaseDraws/);
  assert.match(engine, /scheduledStartPhaseDraws\(state\) === 1/);
});
