import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import {
  artworkPath,
  countsAsAquatic,
  CREATURES,
  DECK_2,
  DECK_2_DECK,
  DECK_2_SUPPORTS,
  DECK_3,
  DECK_3_DECK,
  DECK_3_SUPPORTS,
  DECKS,
  GENERAL_POOL,
  hasPrintedAquatic,
  IMPLEMENTATION_REGISTER,
  PENDING_ARTWORK_KEYS,
  SUPPORTS,
  tagEffectMultiplier,
  TAG_RULES,
  TEST_DECK,
  type AdaptationCard,
  type CreatureCard,
  type DeckKey,
  type EventCard,
} from "../app/game-data.ts";
import {
  acknowledgeHandoff,
  activateCarnianPluvialEpisode,
  advanceToBattleOrEndTurn,
  adaptationEligible,
  battleCoinPlan,
  battleNeedsElusiveFlip,
  canActivateCarnianPluvialEpisode,
  canPlayConcept,
  canUseTemperateReroll,
  cancelBattlePreview,
  cardVictoryLevel,
  checkOverride,
  chooseEngulf,
  chooseFilterFeederTop,
  chooseHerd,
  chooseNesting,
  chooseGeologicalBoundaryPeriod,
  chooseConceptOption,
  chooseBiodiversityTop,
  chooseCarnianPluvialOption,
  chooseConvergentCategory,
  chooseCranialDisplayTarget,
  commitBattle,
  conceptAllowance,
  createGame,
  emptyAllowances,
  endTurn,
  effectiveHasTag,
  getConceptChoiceOptions,
  getHerdOptions,
  getNestingOptions,
  getCarnianPluvialOptions,
  geologicalBoundaryOptions,
  hasLegalHunts,
  inspectBattleLevel,
  laneIsLocked,
  legalAdaptationTargets,
  legalAttackTargets,
  legalAquaticOverrideLanes,
  legalConnectedWaterwayDestinations,
  legalConnectedWaterwaySources,
  legalCreatureLanes,
  legalDroughtTargets,
  legalFacultativeDestinations,
  legalFacultativeSources,
  legalWildfireLanes,
  nicheIsLocked,
  playAdaptation,
  playDrought,
  playEvent,
  playConcept,
  playCreature,
  playAquaticOverride,
  playWildfire,
  previewBattle,
  moveFacultativeQuadrupedality,
  repositionConnectedWaterway,
  spendTemperateReroll,
  victoryTotals,
  type CardInstance,
  type CreatureInPlay,
  type GameState,
  type PlayerId,
} from "../app/game-engine.ts";

function readyGame(decks: [DeckKey, DeckKey] = ["deck-1", "deck-1"]): GameState {
  const game = createGame("Alpha", "Beta", [null, null], decks);
  game.activePlayer = 0;
  game.turnNumber = 1;
  game.phase = "development";
  game.handoff = null;
  game.pendingBattle = null;
  game.pendingCranialDisplay = null;
  game.pendingConvergentChoice = null;
  game.pendingConceptChoice = null;
  game.winner = null;
  for (const player of game.players) {
    player.lanes = Array.from({ length: 5 }, () => ({ creature: null, attachment: null, engulfed: null, wildfire: null, drought: null }));
    player.event = null;
    player.returnQueue = [];
    player.turnsStarted = 2;
    player.allowances = emptyAllowances();
  }
  return game;
}

function takeCard(game: GameState, playerId: PlayerId, key: string): CardInstance {
  const player = game.players[playerId];
  for (const zone of [player.hand, player.deck, player.history]) {
    const index = zone.findIndex((card) => card.definition.key === key);
    if (index >= 0) return zone.splice(index, 1)[0];
  }
  if (player.event?.definition.key === key) {
    const card = player.event;
    player.event = null;
    return card;
  }
  throw new Error(`Could not find ${key} for player ${playerId}`);
}

function creatureInPlay(card: CardInstance, enteredTurn = 0): CreatureInPlay {
  assert.equal(card.definition.kind, "creature");
  return {
    card: card as CardInstance & { definition: CreatureCard },
    enteredTurn,
    lastAttackTurn: null,
    attackedTurn: null,
    elusiveUsedTurn: null,
    mobFeederTriggeredTurn: null,
    mobFeederBonusTurn: null,
    burrowedUntilTurn: null,
    cannotAttackOnTurn: null,
    cannotOverrideOnTurn: null,
    attackBarriers: [],
    visualUsed: false,
    deimaticProtectedThroughTurn: null,
    bastionDefendedTurn: null,
    bastionAttackedTurn: null,
    facultativeMovedTurn: null,
  };
}

function placeCreature(game: GameState, playerId: PlayerId, lane: number, key: string) {
  const card = takeCard(game, playerId, key);
  game.players[playerId].lanes[lane].creature = creatureInPlay(card);
  return game.players[playerId].lanes[lane].creature!;
}

function putInHand(game: GameState, playerId: PlayerId, key: string) {
  const card = takeCard(game, playerId, key);
  game.players[playerId].hand.push(card);
  return card;
}

function putGeneralCreatureInHand(
  game: GameState,
  playerId: PlayerId,
  key: string,
  overrides: Partial<CreatureCard> = {},
) {
  const definition = GENERAL_POOL.find((card) => card.key === key);
  assert.equal(definition?.kind, "creature");
  const card: CardInstance = {
    uid: `${playerId}-general-${key}-${game.players[playerId].hand.length}`,
    owner: playerId,
    definition: { ...(definition as CreatureCard), ...overrides },
    livingFossilUsed: false,
  };
  game.players[playerId].hand.push(card);
  return card;
}

function putDeckThreeCreatureInHand(
  game: GameState,
  playerId: PlayerId,
  key: string,
  overrides: Partial<CreatureCard> = {},
) {
  const definition = DECK_3.find((card) => card.key === key);
  assert.ok(definition, `Deck 3 is missing ${key}`);
  const card: CardInstance = {
    uid: `${playerId}-deck-3-${key}-${game.players[playerId].hand.length}`,
    owner: playerId,
    definition: { ...definition, ...overrides },
    livingFossilUsed: false,
  };
  game.players[playerId].hand.push(card);
  return card;
}

function placeDeckThreeCreature(
  game: GameState,
  playerId: PlayerId,
  lane: number,
  key: string,
  overrides: Partial<CreatureCard> = {},
) {
  const card = putDeckThreeCreatureInHand(game, playerId, key, overrides);
  game.players[playerId].hand = game.players[playerId].hand.filter((held) => held.uid !== card.uid);
  game.players[playerId].lanes[lane].creature = creatureInPlay(card);
  return game.players[playerId].lanes[lane].creature!;
}

function setEvent(game: GameState, playerId: PlayerId, key: string) {
  const card = takeCard(game, playerId, key);
  assert.equal(card.definition.kind, "event");
  game.players[playerId].event = card as CardInstance & { definition: EventCard };
}

function attachAdaptation(game: GameState, playerId: PlayerId, lane: number, key: string) {
  const card = takeCard(game, playerId, key);
  assert.equal(card.definition.kind, "adaptation");
  game.players[playerId].lanes[lane].attachment = card as CardInstance & { definition: AdaptationCard };
  return card;
}

test("all Revision 2.0 decks contain 40 singleton cards and can be selected independently", () => {
  const game = createGame("Alpha", "Beta");
  assert.equal(IMPLEMENTATION_REGISTER.version, "2.0");
  assert.equal(TEST_DECK.length, 40);
  assert.equal(CREATURES.length, 22);
  assert.equal(SUPPORTS.length, 18);
  assert.deepEqual(
    ["event", "adaptation", "concept"].map((kind) => SUPPORTS.filter((card) => card.kind === kind).length),
    [4, 3, 11],
  );
  assert.equal(SUPPORTS.some((card) => card.key === "ghost-lineage"), false);
  assert.equal(SUPPORTS.some((card) => card.key === "cryptic-camouflage"), true);
  assert.deepEqual([0, 1, 2, 3].map((level) => CREATURES.filter((card) => card.printedLevel === level).length), [5, 6, 8, 3]);
  assert.equal(CREATURES.some((card) => card.key === "inostrancevia"), false);
  assert.equal(SUPPORTS.some((card) => card.key === "carnian-pluvial-episode"), true);
  assert.equal(SUPPORTS.some((card) => card.key === "competitive-exclusion-principle"), false);
  assert.equal(SUPPORTS.some((card) => card.key === "wildfire"), true);
  assert.equal(GENERAL_POOL.length, 19);
  assert.ok(["competitive-exclusion-principle", "lystrosaurus", "purussaurus", "dire-wolf"].every((key) => GENERAL_POOL.some((card) => card.key === key)));
  assert.ok(GENERAL_POOL.every((card) => card.status === "Not playable · Work in progress"));
  assert.equal(DECK_3.length, 22);
  assert.equal(DECK_3_SUPPORTS.length, 18);
  assert.equal(DECK_3_DECK.length, 40);
  assert.deepEqual([0, 1, 2, 3, 4].map((level) => DECK_3.filter((card) => card.printedLevel === level).length), [7, 6, 5, 3, 1]);
  assert.ok(["tiktaalik", "hyneria", "megalodon", "blue-whale"].every((key) => DECK_3.some((card) => card.key === key)));
  assert.ok(DECK_3.every((card) => card.kind === "creature"));
  assert.equal(DECK_3.some((card) => (card.kind as string) === "concept"), false);
  assert.equal(DECK_3.some((card) => GENERAL_POOL.some((poolCard) => poolCard.key === card.key)), false);
  assert.ok(["superpredators", "dig-site-excavation", "drought", "island-dwarfism", "geological-boundary"].every((key) => DECK_3_SUPPORTS.some((card) => card.key === key)));
  assert.equal(DECK_3_SUPPORTS.find((card) => card.key === "geological-boundary")?.kind, "event");
  assert.equal((DECK_3_SUPPORTS.find((card) => card.key === "geological-boundary") as EventCard).eventType, "instant");
  assert.equal(DECK_2.length, 23);
  assert.equal(DECK_2_SUPPORTS.length, 17);
  assert.equal(DECK_2_DECK.length, 40);
  assert.deepEqual([0, 1, 2, 3, 4].map((level) => DECK_2.filter((card) => card.printedLevel === level).length), [3, 8, 7, 4, 1]);
  assert.deepEqual(
    ["adaptation", "concept", "event"].map((kind) => DECK_2_SUPPORTS.filter((card) => card.kind === kind).length),
    [5, 8, 4],
  );
  assert.deepEqual(
    Object.fromEntries(["Triassic", "Jurassic", "Cretaceous", "Quaternary"].map((period) => [period, DECK_2.filter((card) => card.period === period).length])),
    { Triassic: 1, Jurassic: 7, Cretaceous: 13, Quaternary: 2 },
  );
  assert.ok(["hoatzin", "mussaurus", "parasaurolophus", "triceratops", "dreadnoughtus"].every((key) => DECK_2.some((card) => card.key === key)));
  assert.ok(["air-sacs", "thagomizer", "dental-battery", "facultative-quadrupedality", "genetic-mutations", "stampede"].every((key) => DECK_2_SUPPORTS.some((card) => card.key === key)));
  assert.ok(DECK_2_SUPPORTS.filter((card) => card.kind === "event").every((card) => card.eventType === "instant"));
  assert.equal(DECK_2_DECK.some((card) => ["cambrian-explosion", "evolutionary-radiation", "semelparity", "whale-fall", "convergent-evolution", "superpredators", "carnian-pluvial-episode", "raptorial-claws", "autotomy", "island-dwarfism"].includes(card.key)), false);
  for (const player of game.players) {
    assert.equal(player.deck.length + player.hand.length, 40);
    assert.equal(new Set([...player.deck, ...player.hand].map((card) => card.definition.key)).size, 40);
    assert.ok(player.hand.some((card) => card.definition.kind === "creature" && card.definition.printedLevel <= 1));
  }
  const mixed = createGame("Aquatic", "Theropod", [null, null], ["deck-3", "deck-1"]);
  assert.deepEqual(mixed.players.map((player) => player.deckKey), ["deck-3", "deck-1"]);
  for (const player of mixed.players) {
    const manifest = [...player.hand, ...player.deck].map((card) => card.definition.key);
    assert.deepEqual(new Set(manifest), new Set(DECKS[player.deckKey].map((card) => card.key)));
    assert.equal(manifest.length, 40);
    assert.equal(new Set(manifest).size, 40);
  }
  const deckTwoMirror = createGame("Herbivore A", "Herbivore B", [null, null], ["deck-2", "deck-2"]);
  for (const player of deckTwoMirror.players) {
    const manifest = [...player.hand, ...player.deck].map((card) => card.definition.key);
    assert.deepEqual(new Set(manifest), new Set(DECK_2_DECK.map((card) => card.key)));
    assert.equal(manifest.length, 40);
    assert.equal(new Set(manifest).size, 40);
  }
  assert.equal(TEST_DECK.some((card) => card.key === "bottleneck" || card.key.includes("placeholder")), false);
});

test("every inspectable card resolves to a local artwork file", () => {
  assert.equal(PENDING_ARTWORK_KEYS.size, 0);
  const inspectableCards = [
    ...new Map(
      [...Object.values(DECKS).flat(), ...GENERAL_POOL].map((card) => [card.key, card]),
    ).values(),
  ];
  assert.equal(inspectableCards.length, 110);
  for (const card of inspectableCards) {
    const artwork = artworkPath(card);
    assert.equal(artwork, `/artwork/${card.key}.webp`);
    assert.equal(existsSync(new URL(`../public${artwork}`, import.meta.url)), true, `Missing artwork for ${card.name}`);
  }
  assert.equal(artworkPath(GENERAL_POOL.find((card) => card.key === "inostrancevia")!), "/artwork/inostrancevia.webp");
  assert.equal(artworkPath(DECK_2.find((card) => card.key === "stegosaurus")!), "/artwork/stegosaurus.webp");
  assert.equal(artworkPath(GENERAL_POOL.find((card) => card.key === "eoraptor")!), "/artwork/eoraptor.webp");
});

test("all 22 playable Creatures carry final flavor text and corrected records", () => {
  assert.ok(CREATURES.every((card) => card.flavorText.length > 70));
  assert.equal(CREATURES.find((card) => card.key === "baryonyx")?.diet, "Carnivore");
  assert.equal(CREATURES.find((card) => card.key === "diplocaulus")?.period, "Permian");
  assert.deepEqual(CREATURES.find((card) => card.key === "yutyrannus")?.tags, ["Cranial Display", "Pack Hunter"]);
  assert.deepEqual(CREATURES.find((card) => card.key === "dilophosaurus")?.tags, ["Raptorial", "Cranial Display"]);
  assert.deepEqual(CREATURES.find((card) => card.key === "tyrannosaurus-rex")?.tags, ["Apex Predator", "Sovereign", "Crushing Bite", "Durophagy"]);
  assert.ok([...CREATURES, ...DECK_3, ...GENERAL_POOL.filter((card): card is CreatureCard => card.kind === "creature")]
    .every((card) => (card.diet as string) !== "Piscivore"));
});

test("the three apex bosses have their locked differentiated builds", () => {
  const purussaurus = GENERAL_POOL.find((card) => card.key === "purussaurus") as CreatureCard;
  const megalodon = DECK_3.find((card) => card.key === "megalodon") as CreatureCard;
  assert.deepEqual(purussaurus.tags, ["Semi-Aquatic", "Ambush", "Crushing Bite", "Apex Predator"]);
  assert.deepEqual(megalodon.tags, ["Aquatic", "Apex Predator", "Specialized", "Crushing Bite"]);
  assert.equal(tagEffectMultiplier(megalodon, "Crushing Bite"), 2);
  assert.equal(tagEffectMultiplier(megalodon, "Apex Predator"), 1);
  assert.match(megalodon.flavorText, /marine mammals/i);
});

test("every visible Creature Tag has an inspection definition", () => {
  const creatures = [...CREATURES, ...DECK_2, ...DECK_3, ...GENERAL_POOL.filter((card): card is CreatureCard => card.kind === "creature")];
  for (const creature of creatures) {
    assert.ok(creature.flavorText.trim().length > 70, `${creature.name} is missing complete flavor text`);
    for (const tag of creature.tags) {
      assert.ok(TAG_RULES[tag], `${creature.name} is missing an inspection rule for ${tag}`);
    }
  }
});

test("Cynognathus reaches Triassic Carnivores but is not universal", () => {
  const game = readyGame();
  placeCreature(game, 0, 0, "cynognathus");
  const gojirasaurus = putInHand(game, 0, "gojirasaurus");
  const baryonyx = putInHand(game, 0, "baryonyx");
  assert.equal(gojirasaurus.definition.kind, "creature");
  assert.equal(baryonyx.definition.kind, "creature");
  assert.equal(checkOverride(game, 0, gojirasaurus.definition, 0).legal, true);
  assert.equal(checkOverride(game, 0, baryonyx.definition, 0).legal, false);
});

test("Aquatic and Semi-Aquatic use normal progression while Rapid Speciation retains exactly +2", () => {
  const game = readyGame();
  placeDeckThreeCreature(game, 0, 0, "tiktaalik");
  const hyneria = putDeckThreeCreatureInHand(game, 0, "hyneria");
  assert.equal(hyneria.definition.kind, "creature");
  assert.equal(checkOverride(game, 0, hyneria.definition, 0).legal, true);

  game.players[0].lanes[0].creature = null;
  placeCreature(game, 0, 0, "natovenator");
  const spinosaurus = putInHand(game, 0, "spinosaurus");
  assert.equal(spinosaurus.definition.kind, "creature");
  const result = checkOverride(game, 0, spinosaurus.definition, 0);
  assert.equal(result.legal, false);
  assert.equal(result.levelLegal, false);
  const rapid = checkOverride(game, 0, spinosaurus.definition, 0, true);
  assert.equal(rapid.legal, true);
  assert.equal(rapid.levelLegal, true);
});

test("Aquatic and Semi-Aquatic substitute exactly their specified override categories", () => {
  let game = readyGame();
  placeDeckThreeCreature(game, 0, 0, "tiktaalik");
  const helicoprion = putDeckThreeCreatureInHand(game, 0, "helicoprion");
  assert.equal(helicoprion.definition.kind, "creature");
  let result = checkOverride(game, 0, helicoprion.definition, 0);
  assert.deepEqual(result.matches, { diet: true, period: false, taxon: true, tag: false });
  assert.equal(result.legal, false, "Aquatic supplies Taxon, not Tag, and does not activate Transitional");

  for (const currentKey of ["edestus", "helicoprion"]) {
    game = readyGame();
    placeDeckThreeCreature(game, 0, 0, currentKey);
    const ptychodus = putDeckThreeCreatureInHand(game, 0, "ptychodus");
    assert.equal(ptychodus.definition.kind, "creature");
    result = checkOverride(game, 0, ptychodus.definition, 0);
    assert.deepEqual(result.matches, { diet: true, period: false, taxon: true, tag: true });
    assert.equal(result.legal, true, "matching Aquatic Primary Taxa cause Aquatic to supply Tag instead");
  }

  game = readyGame();
  placeDeckThreeCreature(game, 0, 0, "ptychodus");
  const megalodon = putDeckThreeCreatureInHand(game, 0, "megalodon");
  assert.equal(megalodon.definition.kind, "creature");
  result = checkOverride(game, 0, megalodon.definition, 0);
  assert.deepEqual(result.matches, { diet: true, period: false, taxon: true, tag: true });
  assert.equal(result.legal, true);

  game = readyGame();
  placeDeckThreeCreature(game, 0, 0, "black-swallower");
  const xiphactinus = putDeckThreeCreatureInHand(game, 0, "xiphactinus");
  assert.equal(xiphactinus.definition.kind, "creature");
  result = checkOverride(game, 0, xiphactinus.definition, 0, true);
  assert.deepEqual(result.matches, { diet: true, period: false, taxon: true, tag: true });
  assert.equal(result.legal, true, "Aquatic supplies Taxon while Engulf independently supplies Tag");

  game = readyGame();
  placeCreature(game, 0, 0, "diplocaulus");
  const baryonyx = putInHand(game, 0, "baryonyx");
  assert.equal(baryonyx.definition.kind, "creature");
  result = checkOverride(game, 0, baryonyx.definition, 0);
  assert.equal(result.matches.taxon, true);
  assert.equal(result.matches.tag, false, "an occupied Aquatic card controls the substitution and supplies Taxon");

  game = readyGame();
  placeCreature(game, 0, 0, "natovenator");
  const syntheticSemiAquatic: CreatureCard = {
    ...(CREATURES.find((card) => card.key === "baryonyx") as CreatureCard),
    period: "Jurassic",
    gameplayTaxon: "Synthetic Taxon",
  };
  result = checkOverride(game, 0, syntheticSemiAquatic, 0);
  assert.equal(result.matches.taxon, false);
  assert.equal(result.matches.tag, true, "two Semi-Aquatic Creatures supply only Tag when their printed Taxa differ");
});

test("Blue Whale is the playable Level 4 capstone with locked normal and Rapid Speciation routes", () => {
  const blueWhale = DECK_3.find((card) => card.key === "blue-whale") as CreatureCard;
  assert.ok(blueWhale);
  assert.equal(blueWhale.printedLevel, 4);
  assert.equal(blueWhale.period, "Quaternary");
  assert.equal(blueWhale.periodColor, "Ice White");
  assert.equal(blueWhale.diet, "Carnivore");
  assert.equal(blueWhale.gameplayTaxon, "Mammal");
  assert.deepEqual(blueWhale.tags, ["Aquatic", "Filter Feeder", "Specialized", "Gigantic"]);
  assert.deepEqual(blueWhale.visualTags, ["Baleen", "Ventral Grooves", "Paired Blowholes", "Flippers", "Tail Flukes"]);
  assert.equal(tagEffectMultiplier(blueWhale, "Gigantic"), 2);
  assert.match(blueWhale.flavorText, /largest animal known to have ever lived/i);
  assert.equal(artworkPath(blueWhale), "/artwork/blue-whale.webp");

  for (const currentKey of ["leedsichthys", "livyatan"]) {
    const game = readyGame();
    placeDeckThreeCreature(game, 0, 0, currentKey);
    assert.equal(checkOverride(game, 0, blueWhale, 0).legal, true, `${currentKey} should normally reach Blue Whale`);
  }

  let game = readyGame();
  placeDeckThreeCreature(game, 0, 0, "megalodon");
  assert.equal(checkOverride(game, 0, blueWhale, 0).legal, false);

  for (const currentKey of ["orca", "xiphactinus", "jaekelopterus"]) {
    game = readyGame();
    placeDeckThreeCreature(game, 0, 0, currentKey);
    assert.equal(checkOverride(game, 0, blueWhale, 0, true).legal, true, `${currentKey} should reach Blue Whale through Rapid Speciation`);
  }

  game = readyGame();
  const heldBlueWhale = putDeckThreeCreatureInHand(game, 0, "blue-whale");
  assert.deepEqual(legalCreatureLanes(game, 0, heldBlueWhale), [], "Level 4 cannot fill an empty Niche");
  game.players[0].biome.key = "aquatic";
  game.players[0].biome.waterwaysConnected = true;
  placeDeckThreeCreature(game, 0, 0, "livyatan");
  assert.ok(legalAquaticOverrideLanes(game, heldBlueWhale).includes(0));
});

test("Raptorial Claws uses exactly the nine locked hidden Visual Tags", () => {
  const expected = ["allosaurus", "baryonyx", "dilophosaurus", "herrerasaurus", "microraptor", "spinosaurus", "torvosaurus", "utahraptor", "velociraptor"];
  assert.deepEqual(CREATURES.filter((card) => card.visualTags.includes("Raptorial Claws")).map((card) => card.key).sort(), expected);
  const adaptation = SUPPORTS.find((card) => card.key === "raptorial-claws") as AdaptationCard;
  assert.equal(adaptationEligible(adaptation, CREATURES.find((card) => card.key === "allosaurus")!), true);
  assert.equal(adaptationEligible(adaptation, CREATURES.find((card) => card.key === "carnotaurus")!), false);
});

test("Semi-Aquatic does not qualify for Autotomy", () => {
  const autotomy = SUPPORTS.find((card) => card.key === "autotomy") as AdaptationCard;
  assert.equal(adaptationEligible(autotomy, CREATURES.find((card) => card.key === "natovenator")!), false);
  assert.equal(adaptationEligible(autotomy, CREATURES.find((card) => card.key === "diplocaulus")!), true);
});

test("Semi-Aquatic counts as Aquatic only for Event and Concept effects", () => {
  const game = readyGame();
  game.phase = "battle";
  const ordinary = placeCreature(game, 0, 0, "allosaurus");
  const aquaticTarget = placeCreature(game, 1, 1, "diplocaulus");
  setEvent(game, 0, "superpredators");
  assert.ok(legalAttackTargets(game, ordinary.card.uid).includes(aquaticTarget.card.uid), "Aquatic has no Hunt protection");

  const natovenator = CREATURES.find((card) => card.key === "natovenator")!;
  assert.equal(countsAsAquatic(natovenator), true);
  assert.equal(hasPrintedAquatic(natovenator), false);
});

test("Diver recognizes printed Aquatic defenders but not Semi-Aquatic defenders", () => {
  let game = readyGame();
  game.phase = "battle";
  const diver = placeCreature(game, 0, 0, "natovenator");
  const defender = placeCreature(game, 1, 0, "baryonyx");
  setEvent(game, 0, "superpredators");
  game = previewBattle(game, diver.card.uid, defender.card.uid);
  assert.equal(game.pendingBattle?.attackerNotes.includes("Diver +1") ?? false, false);

  game = readyGame();
  game.phase = "battle";
  const diverAgain = placeCreature(game, 0, 0, "natovenator");
  const aquaticDefender = placeCreature(game, 1, 0, "diplocaulus");
  setEvent(game, 0, "superpredators");
  game = previewBattle(game, diverAgain.card.uid, aquaticDefender.card.uid);
  assert.ok(game.pendingBattle?.attackerNotes.includes("Diver +1"));
});

test("Spinal Sail mitigates each Creature's Apex Predator crowding decrease by one", () => {
  const game = readyGame();
  const dimetrodon = placeCreature(game, 0, 0, "dimetrodon");
  assert.equal(cardVictoryLevel(game, dimetrodon), 4);
  placeCreature(game, 1, 0, "tyrannosaurus-rex");
  assert.equal(cardVictoryLevel(game, dimetrodon), 4);
  placeCreature(game, 1, 1, "torvosaurus");
  assert.equal(cardVictoryLevel(game, dimetrodon), 3);
  placeCreature(game, 0, 1, "spinosaurus");
  assert.equal(cardVictoryLevel(game, dimetrodon), 2);
});

test("Cryptic Camouflage accepts Level 2 or lower and rejects Level 3", () => {
  const camouflage = SUPPORTS.find((card) => card.key === "cryptic-camouflage") as AdaptationCard;
  assert.equal(adaptationEligible(camouflage, CREATURES.find((card) => card.key === "hoatzin")!), true);
  assert.equal(adaptationEligible(camouflage, CREATURES.find((card) => card.key === "carnotaurus")!), true);
  assert.equal(adaptationEligible(camouflage, CREATURES.find((card) => card.key === "tyrannosaurus-rex")!), false);
});

test("Resourceful permits two independent Concepts but never stacks", () => {
  let game = readyGame();
  placeCreature(game, 0, 0, "hoatzin");
  assert.equal(conceptAllowance(game, 0), 2);
  const biogenesis = putInHand(game, 0, "biogenesis");
  game = playConcept(game, biogenesis.uid);
  assert.equal(game.players[0].allowances.conceptsPlayed, 1);
  const abiogenesis = putInHand(game, 0, "abiogenesis");
  assert.equal(canPlayConcept(game, abiogenesis), true);
  game = playConcept(game, abiogenesis.uid);
  assert.equal(game.players[0].allowances.conceptsPlayed, 2);
  assert.ok(game.pendingConceptChoice);
});

test("Opportunist grants one conditional extra Creature play and ends Development", () => {
  let game = readyGame();
  setEvent(game, 1, "superpredators");
  const normal = putInHand(game, 0, "hoatzin");
  game = playCreature(game, 0, normal.uid, 0);
  const lystrosaurus = putGeneralCreatureInHand(game, 0, "lystrosaurus");

  assert.ok(legalCreatureLanes(game, 0, lystrosaurus).includes(1));
  game = playCreature(game, 0, lystrosaurus.uid, 1);
  assert.equal(game.players[0].lanes[1].creature?.card.definition.key, "lystrosaurus");
  assert.equal(game.phase, "battle");
  assert.ok(game.log.some((line) => line.includes("Opportunist play ended")));
});

test("Opportunist can legally override at Level 1 or 2 but cannot bypass normal restrictions", () => {
  let game = readyGame();
  setEvent(game, 1, "superpredators");
  placeCreature(game, 0, 0, "herrerasaurus");
  const normal = putInHand(game, 0, "hoatzin");
  game = playCreature(game, 0, normal.uid, 1);
  const opportunist = putGeneralCreatureInHand(game, 0, "thrinaxodon", {
    printedLevel: 1,
    tags: ["Opportunist", "Transitional"],
  });
  assert.ok(legalCreatureLanes(game, 0, opportunist).includes(0));

  game.players[0].lanes[0].creature!.cannotOverrideOnTurn = game.turnNumber;
  assert.equal(legalCreatureLanes(game, 0, opportunist).includes(0), false, "Raptorial still stops the override");

  game.players[0].lanes[0].creature!.cannotOverrideOnTurn = null;
  game.players[1].event = null;
  assert.equal(legalCreatureLanes(game, 0, opportunist).length, 0, "the opposing Continuous Event is required");
});

test("a pending Convergent Evolution prevents Rapid Speciation from combining", () => {
  let game = readyGame();
  placeCreature(game, 0, 0, "hoatzin");
  placeCreature(game, 0, 1, "natovenator");
  putInHand(game, 0, "spinosaurus");
  const convergent = putInHand(game, 0, "convergent-evolution");
  const rapid = putInHand(game, 0, "rapid-speciation");
  game = playConcept(game, convergent.uid);
  assert.equal(game.players[0].allowances.convergentEvolution, true);
  assert.equal(canPlayConcept(game, rapid), false);
});

test("Convergent Evolution supplies one missing non-Tag category after a shared Tag and one other match", () => {
  let game = readyGame();
  placeCreature(game, 0, 0, "archaeopteryx");
  const dimetrodon = putInHand(game, 0, "dimetrodon");
  assert.equal(dimetrodon.definition.kind, "creature");
  assert.equal(checkOverride(game, 0, dimetrodon.definition, 0).legal, false);
  game.players[0].allowances.convergentEvolution = true;
  const result = checkOverride(game, 0, dimetrodon.definition, 0);
  assert.equal(result.legal, true);
  assert.equal(result.matchCount, 3);
  assert.equal(result.convergentCategory, "taxon");
  game = playCreature(game, 0, dimetrodon.uid, 0);
  assert.deepEqual(game.pendingConvergentChoice?.categories, ["taxon", "period"]);
  assert.equal(game.players[0].lanes[0].creature?.card.definition.key, "archaeopteryx");
  game = chooseConvergentCategory(game, "period");
  assert.equal(game.pendingConvergentChoice, null);
  assert.equal(game.players[0].lanes[0].creature?.card.definition.key, "dimetrodon");
  assert.ok(game.log.some((line) => line.includes("Time Period match")));
});

test("Convergent Evolution cannot use Generalist as its shared eligible Tag", () => {
  const game = readyGame();
  placeCreature(game, 0, 0, "microraptor");
  const thrinaxodon = putGeneralCreatureInHand(game, 0, "thrinaxodon");
  assert.equal(thrinaxodon.definition.kind, "creature");

  game.players[0].allowances.convergentEvolution = true;
  const result = checkOverride(game, 0, thrinaxodon.definition, 0);

  assert.equal(result.matches.diet, true);
  assert.equal(result.matches.tag, true, "Generalist still provides an ordinary shared Tag match");
  assert.deepEqual(result.convergentOptions, []);
  assert.equal(result.convergentCategory, null);
  assert.equal(result.legal, false);
});

test("Wildfire occupies a friendly Niche, processes a friendly override, and clears both sides", () => {
  let game = readyGame();
  setEvent(game, 0, "superpredators");
  const own = placeCreature(game, 0, 0, "nautilus");
  attachAdaptation(game, 0, 0, "autotomy");
  const opposing = placeCreature(game, 1, 0, "horseshoe-crab");
  attachAdaptation(game, 1, 0, "autotomy");
  const wildfire = putInHand(game, 0, "wildfire");
  const deckBefore = game.players[0].deck.length;

  assert.ok(legalWildfireLanes(game, wildfire).includes(0));
  game = playWildfire(game, wildfire.uid, 0);

  assert.equal(game.players[0].event?.definition.key, "superpredators", "Wildfire never replaces the Event Zone");
  assert.equal(game.players[0].lanes[0].creature, null);
  assert.equal(game.players[1].lanes[0].creature, null);
  assert.equal(game.players[0].lanes[0].wildfire?.card.definition.key, "wildfire");
  assert.equal(game.players[0].lanes[0].wildfire?.expiresOnTurn, 3);
  assert.equal(game.players[0].allowances.eventPlayed, true);
  assert.equal(game.players[0].allowances.creaturePlayed, false);
  assert.equal(game.players[0].deck.length, deckBefore - 1, "Autotomy draws when its Creature is overridden");
  assert.ok(game.players[0].history.some((card) => card.definition.key === "autotomy"));
  assert.ok(game.players[1].history.some((card) => card.definition.key === "autotomy"));
  assert.ok(game.players[0].returnQueue.includes(own.card.uid));
  assert.ok(game.players[1].returnQueue.includes(opposing.card.uid));
  assert.equal(laneIsLocked(game, 0), true);
});

test("Raptorial stops only Wildfire's friendly override and a locked lane rejects Creatures", () => {
  let game = readyGame();
  const protectedCreature = placeCreature(game, 0, 0, "herrerasaurus");
  protectedCreature.cannotOverrideOnTurn = game.turnNumber;
  const wildfire = putInHand(game, 0, "wildfire");
  assert.equal(legalWildfireLanes(game, wildfire).includes(0), false);
  assert.ok(legalWildfireLanes(game, wildfire).includes(1), "an empty friendly Niche remains legal");

  game = playWildfire(game, wildfire.uid, 1);
  game.activePlayer = 1;
  game.turnNumber = 2;
  game.phase = "development";
  const incoming = putInHand(game, 1, "hoatzin");
  assert.equal(legalCreatureLanes(game, 1, incoming).includes(1), false);
});

test("Wildfire keeps the lane locked for the opponent's turn and its controller's next full turn", () => {
  let game = readyGame();
  const wildfire = putInHand(game, 0, "wildfire");
  game = playWildfire(game, wildfire.uid, 0);

  game = endTurn(game);
  game.handoff = null;
  game.phase = "development";
  assert.equal(game.turnNumber, 2);
  assert.equal(laneIsLocked(game, 0), true);

  game = endTurn(game);
  game.handoff = null;
  game.phase = "development";
  assert.equal(game.turnNumber, 3);
  assert.equal(laneIsLocked(game, 0), true);

  game = endTurn(game);
  assert.equal(laneIsLocked(game, 0), false);
  assert.ok(game.players[0].history.some((card) => card.definition.key === "wildfire"));
});

test("Cambrian Explosion replaces itself on entry only when its controller has a Level 0 Creature", () => {
  let game = readyGame();
  placeCreature(game, 0, 0, "hoatzin");
  const cambrian = putInHand(game, 0, "cambrian-explosion");
  const handBefore = game.players[0].hand.length;
  const deckBefore = game.players[0].deck.length;
  game = playEvent(game, cambrian.uid);
  assert.equal(game.players[0].event?.definition.key, "cambrian-explosion");
  assert.equal(game.players[0].hand.length, handBefore);
  assert.equal(game.players[0].deck.length, deckBefore - 1);
  assert.ok(game.log.some((line) => line.includes("Cambrian Explosion entry")));

  game = readyGame();
  const unsupportedCambrian = putInHand(game, 0, "cambrian-explosion");
  const unsupportedHand = game.players[0].hand.length;
  const unsupportedDeck = game.players[0].deck.length;
  game = playEvent(game, unsupportedCambrian.uid);
  assert.equal(game.players[0].hand.length, unsupportedHand - 1);
  assert.equal(game.players[0].deck.length, unsupportedDeck);
});

test("Carnian Pluvial Episode converts a controlled non-Dinosaur into a Level 2-or-lower Dinosaur tutor", () => {
  let game = readyGame();
  setEvent(game, 0, "carnian-pluvial-episode");
  const nautilus = placeCreature(game, 0, 0, "nautilus");
  const hoatzin = placeCreature(game, 0, 1, "hoatzin");
  const carnotaurus = takeCard(game, 0, "carnotaurus");
  game.players[0].deck.push(carnotaurus);

  assert.equal(canActivateCarnianPluvialEpisode(game), true);
  game = activateCarnianPluvialEpisode(game);
  const costOptions = getCarnianPluvialOptions(game);
  assert.ok(costOptions.some((option) => option.id === nautilus.card.uid));
  assert.equal(costOptions.some((option) => option.id === hoatzin.card.uid), false, "Birds have Dinosaur in their Taxa");

  game = chooseCarnianPluvialOption(game, nautilus.card.uid);
  assert.equal(game.players[0].lanes[0].creature, null);
  assert.ok(game.players[0].returnQueue.includes(nautilus.card.uid));
  assert.ok(getCarnianPluvialOptions(game).some((option) => option.id === carnotaurus.uid));

  game = chooseCarnianPluvialOption(game, carnotaurus.uid);
  assert.equal(game.pendingCarnianPluvial, null);
  assert.ok(game.players[0].hand.some((card) => card.uid === carnotaurus.uid));
  assert.equal(game.players[0].allowances.carnianPluvialUsed, true);
  assert.equal(canActivateCarnianPluvialEpisode(game), false);
});

test("the Development control ends the turn when no legal Hunt exists and enters Battle when one does", () => {
  let game = readyGame();
  assert.equal(hasLegalHunts(game), false);
  game = advanceToBattleOrEndTurn(game);
  assert.equal(game.phase, "handoff");
  assert.equal(game.activePlayer, 1);
  assert.ok(game.log.some((line) => line.includes("had no legal Hunts")));

  game = readyGame();
  placeCreature(game, 0, 0, "velociraptor");
  placeCreature(game, 1, 0, "hoatzin");
  assert.equal(hasLegalHunts(game), true);
  game = advanceToBattleOrEndTurn(game);
  assert.equal(game.phase, "battle");
  assert.equal(game.activePlayer, 0);
});

test("Cranial Display uses the consolidated Tag and creates its barrier", () => {
  let game = readyGame();
  placeCreature(game, 0, 0, "velociraptor");
  const target = placeCreature(game, 1, 0, "archaeopteryx");
  const yutyrannus = putInHand(game, 0, "yutyrannus");
  game = playCreature(game, 0, yutyrannus.uid, 0);
  assert.ok(game.pendingCranialDisplay?.eligibleTargetUids.includes(target.card.uid));
  game = chooseCranialDisplayTarget(game, target.card.uid);
  assert.equal(game.pendingCranialDisplay, null);
  assert.deepEqual(game.players[1].lanes[0].creature?.attackBarriers, [{ targetUid: "0-yutyrannus", expiresOnTurn: 2 }]);
});

test("Charge waits for Battle, ignores Diet only in the facing Niche, and stays lane-locked", () => {
  let game = readyGame();
  placeCreature(game, 0, 0, "herrerasaurus");
  const facing = placeCreature(game, 1, 0, "allosaurus");
  const offLane = placeCreature(game, 1, 1, "hoatzin");
  const carnotaurus = putInHand(game, 0, "carnotaurus");
  game = playCreature(game, 0, carnotaurus.uid, 0);
  assert.equal(game.phase, "development");
  assert.deepEqual(legalAttackTargets(game, carnotaurus.uid), []);

  game = advanceToBattleOrEndTurn(game);
  assert.equal(game.phase, "battle");
  assert.deepEqual(legalAttackTargets(game, carnotaurus.uid), [facing.card.uid]);
  assert.equal(legalAttackTargets(game, carnotaurus.uid).includes(offLane.card.uid), false);

  game.turnNumber += 2;
  game.players[0].lanes[0].creature!.lastAttackTurn = null;
  assert.deepEqual(legalAttackTargets(game, carnotaurus.uid), [facing.card.uid]);
});

test("Rivalry adds +1 while attacking or defending only in facing Niches", () => {
  let game = readyGame();
  game.phase = "battle";
  const carnotaurus = placeCreature(game, 0, 0, "carnotaurus");
  const defender = placeCreature(game, 1, 0, "allosaurus");
  setEvent(game, 0, "superpredators");
  game = previewBattle(game, carnotaurus.card.uid, defender.card.uid);
  assert.equal(game.pendingBattle?.attackerLevel, 3);
  assert.ok(game.pendingBattle?.attackerNotes.includes("Rivalry +1"));

  game = readyGame();
  game.phase = "battle";
  const attacker = placeCreature(game, 0, 0, "allosaurus");
  const rivalDefender = placeCreature(game, 1, 0, "carnotaurus");
  setEvent(game, 0, "superpredators");
  game = previewBattle(game, attacker.card.uid, rivalDefender.card.uid);
  assert.equal(game.pendingBattle?.defenderLevel, 3);
  assert.ok(game.pendingBattle?.defenderNotes.includes("Rivalry +1"));
});

test("ordinary Hunt preview can be canceled without spending the attacker", () => {
  let game = readyGame();
  game.phase = "battle";
  const attacker = placeCreature(game, 0, 0, "velociraptor");
  const defender = placeCreature(game, 1, 0, "archaeopteryx");
  setEvent(game, 0, "superpredators");
  game = previewBattle(game, attacker.card.uid, defender.card.uid);
  assert.ok(game.pendingBattle);
  assert.equal(game.players[0].lanes[0].creature?.lastAttackTurn, null);
  game = cancelBattlePreview(game);
  assert.equal(game.pendingBattle, null);
  assert.equal(game.players[0].lanes[0].creature?.lastAttackTurn, null);
});

test("Elusive red Rex forces a tie and black reverse resolves normally", () => {
  let game = readyGame();
  game.phase = "battle";
  const attacker = placeCreature(game, 0, 0, "velociraptor");
  const elusive = placeCreature(game, 1, 0, "microraptor");
  setEvent(game, 0, "superpredators");
  game = previewBattle(game, attacker.card.uid, elusive.card.uid);
  assert.equal(battleNeedsElusiveFlip(game), true);
  game = commitBattle(game, true);
  assert.ok(game.players[1].lanes[0].creature);
  assert.ok(game.log.some((line) => line.includes("red Rex — success")));

  game = readyGame();
  game.phase = "battle";
  const attacker2 = placeCreature(game, 0, 0, "velociraptor");
  const elusive2 = placeCreature(game, 1, 0, "microraptor");
  setEvent(game, 0, "superpredators");
  game = previewBattle(game, attacker2.card.uid, elusive2.card.uid);
  game = commitBattle(game, false);
  assert.equal(game.players[1].lanes[0].creature, null);
  assert.ok(game.log.some((line) => line.includes("black reverse — failure")));
});

test("Aerial reduces ordinary attackers but Ambush and Glider bypass the penalty", () => {
  let game = readyGame();
  game.phase = "battle";
  const allosaurus = placeCreature(game, 0, 0, "allosaurus");
  const hoatzin = placeCreature(game, 1, 0, "hoatzin");
  game = previewBattle(game, allosaurus.card.uid, hoatzin.card.uid);
  assert.equal(game.pendingBattle?.attackerLevel, 1);
  assert.ok(game.pendingBattle?.attackerNotes.includes("Aerial defense -1"));

  game = readyGame();
  game.phase = "battle";
  const velociraptor = placeCreature(game, 0, 0, "velociraptor");
  const hoatzin2 = placeCreature(game, 1, 0, "hoatzin");
  game = previewBattle(game, velociraptor.card.uid, hoatzin2.card.uid);
  assert.equal(game.pendingBattle?.attackerLevel, 2);
  assert.equal(game.pendingBattle?.attackerNotes.includes("Aerial defense -1"), false);

  game = readyGame();
  game.phase = "battle";
  const microraptor = placeCreature(game, 0, 0, "microraptor");
  const hoatzin3 = placeCreature(game, 1, 0, "hoatzin");
  game = previewBattle(game, microraptor.card.uid, hoatzin3.card.uid);
  assert.equal(game.pendingBattle?.attackerLevel, 0);
  assert.equal(game.pendingBattle?.attackerNotes.includes("Aerial defense -1"), false);
});

test("Sovereign prevents opposing Tag and Adaptation reductions during a Hunt", () => {
  let game = readyGame();
  game.phase = "battle";
  const tyrannosaurus = placeCreature(game, 0, 0, "tyrannosaurus-rex");
  const aerial = placeCreature(game, 1, 0, "hoatzin");
  game = previewBattle(game, tyrannosaurus.card.uid, aerial.card.uid);
  assert.equal(game.pendingBattle?.attackerLevel, 3);
  assert.equal(game.pendingBattle?.attackerNotes.includes("Aerial defense -1"), false);

  game = readyGame();
  game.phase = "battle";
  const crushing = placeCreature(game, 0, 0, "tyrannosaurus-rex");
  const sovereignShell = placeCreature(game, 1, 0, "tyrannosaurus-rex");
  sovereignShell.card.definition = {
    ...sovereignShell.card.definition,
    tags: [...sovereignShell.card.definition.tags, "Shell"],
  };
  setEvent(game, 0, "superpredators");
  game = previewBattle(game, crushing.card.uid, sovereignShell.card.uid);
  assert.equal(game.pendingBattle?.defenderLevel, 4);
  assert.ok(game.pendingBattle?.defenderNotes.includes("Sovereign prevented Crushing Bite"));
});

test("Specialized doubles Megalodon's immediately following Crushing Bite value", () => {
  let game = readyGame();
  game.phase = "battle";
  const megalodon = placeDeckThreeCreature(game, 0, 0, "megalodon");
  const nautilus = placeCreature(game, 1, 0, "nautilus");
  setEvent(game, 0, "superpredators");
  game = previewBattle(game, megalodon.card.uid, nautilus.card.uid);
  assert.ok(game.pendingBattle?.attackerNotes.includes("Crushing Bite reduced reactive defense by up to 2"));
  assert.equal(game.pendingBattle?.defenderLevel, 0);
});

test("former Piscivores are Carnivores and use Cryptic Camouflage's offensive branch", () => {
  let game = readyGame();
  game.phase = "battle";
  const natovenator = placeCreature(game, 0, 0, "natovenator");
  const diplocaulus = placeCreature(game, 1, 0, "diplocaulus");
  assert.equal(natovenator.card.definition.diet, "Carnivore");
  setEvent(game, 0, "superpredators");
  assert.ok(legalAttackTargets(game, natovenator.card.uid).includes(diplocaulus.card.uid));
  attachAdaptation(game, 0, 0, "cryptic-camouflage");
  game = previewBattle(game, natovenator.card.uid, diplocaulus.card.uid);
  assert.equal(game.pendingBattle?.coinPlan.offensiveCount, 1);
  assert.equal(game.pendingBattle?.coinPlan.defensiveCount, 0);
});

test("Cryptic Camouflage defensive coins force a tie and combine with existing Elusive", () => {
  let game = readyGame();
  game.phase = "battle";
  const allosaurus = placeCreature(game, 0, 0, "allosaurus");
  const hoatzin = placeCreature(game, 1, 0, "hoatzin");
  attachAdaptation(game, 1, 0, "cryptic-camouflage");
  game = previewBattle(game, allosaurus.card.uid, hoatzin.card.uid);
  assert.equal(battleCoinPlan(game).defensiveCount, 1);
  game = commitBattle(game, { defensive: [true] });
  assert.ok(game.players[0].lanes[0].creature);
  assert.ok(game.players[1].lanes[0].creature);

  game = readyGame();
  game.phase = "battle";
  const allosaurus2 = placeCreature(game, 0, 0, "allosaurus");
  const doubleEvasion = placeCreature(game, 1, 0, "hoatzin");
  doubleEvasion.card.definition = {
    ...doubleEvasion.card.definition,
    tags: [...doubleEvasion.card.definition.tags, "Elusive"],
  };
  attachAdaptation(game, 1, 0, "cryptic-camouflage");
  game = previewBattle(game, allosaurus2.card.uid, doubleEvasion.card.uid);
  assert.equal(battleCoinPlan(game).defensiveCount, 2);
  game = commitBattle(game, { defensive: [false, true] });
  assert.ok(game.players[1].lanes[0].creature);
});

test("Cryptic Camouflage gives Ambush predators two offensive coin flips", () => {
  let game = readyGame();
  game.phase = "battle";
  const velociraptor = placeCreature(game, 0, 0, "velociraptor");
  const hoatzin = placeCreature(game, 1, 0, "hoatzin");
  attachAdaptation(game, 0, 0, "cryptic-camouflage");
  game = previewBattle(game, velociraptor.card.uid, hoatzin.card.uid);
  assert.equal(game.pendingBattle?.coinPlan.offensiveCount, 2);
  assert.equal(game.pendingBattle?.attackerLevel, 2);
  assert.equal(game.pendingBattle?.attackerLevelMax, 4);
  game = commitBattle(game, { offensive: [true, true] });
  assert.equal(game.players[1].lanes[0].creature, null);
  assert.ok(game.log.some((line) => line.includes("+2 Battle Level")));
});

test("Raptorial Claws contributes +1 while attacking and defending", () => {
  let game = readyGame();
  game.phase = "battle";
  const attacker = placeCreature(game, 0, 0, "allosaurus");
  const defender = placeCreature(game, 1, 0, "utahraptor");
  const clawsA = takeCard(game, 0, "raptorial-claws");
  const clawsD = takeCard(game, 1, "raptorial-claws");
  game.players[0].lanes[0].attachment = clawsA as CardInstance & { definition: AdaptationCard };
  game.players[1].lanes[0].attachment = clawsD as CardInstance & { definition: AdaptationCard };
  setEvent(game, 0, "superpredators");
  game = previewBattle(game, attacker.card.uid, defender.card.uid);
  assert.ok(game.pendingBattle?.attackerNotes.includes("Raptorial Claws +1"));
  assert.ok(game.pendingBattle?.defenderNotes.includes("Raptorial Claws +1"));
});

test("Autotomy draws only when its Creature is overridden", () => {
  let game = readyGame();
  placeCreature(game, 0, 0, "nautilus");
  attachAdaptation(game, 0, 0, "autotomy");
  const endoceras = putDeckThreeCreatureInHand(game, 0, "endoceras");
  const deckBeforeOverride = game.players[0].deck.length;
  game = playCreature(game, 0, endoceras.uid, 0);
  assert.equal(game.players[0].deck.length, deckBeforeOverride - 1);
  assert.equal(game.players[0].lanes[0].creature?.card.definition.key, "endoceras");
  assert.ok(game.players[0].history.some((card) => card.definition.key === "autotomy"));

  game = readyGame();
  game.phase = "battle";
  const allosaurus = placeCreature(game, 0, 0, "allosaurus");
  const diplocaulus = placeCreature(game, 1, 0, "diplocaulus");
  attachAdaptation(game, 1, 0, "autotomy");
  setEvent(game, 0, "superpredators");
  const deckBeforeBattle = game.players[1].deck.length;
  game = previewBattle(game, allosaurus.card.uid, diplocaulus.card.uid);
  game = commitBattle(game);
  assert.equal(game.players[1].deck.length, deckBeforeBattle);
  assert.ok(game.players[1].lanes[0].creature);
  assert.equal(game.players[1].lanes[0].attachment, null);
});

test("Evolutionary Radiation can resolve both effects, preserve the normal Creature play, and skip Battle", () => {
  let game = readyGame();
  placeCreature(game, 0, 0, "allosaurus");
  const hoatzin = putInHand(game, 0, "hoatzin");
  const archaeopteryx = putInHand(game, 0, "archaeopteryx");
  const radiation = putInHand(game, 0, "evolutionary-radiation");
  game = playConcept(game, radiation.uid);
  assert.ok(getConceptChoiceOptions(game).some((option) => option.id === hoatzin.uid));
  assert.ok(getConceptChoiceOptions(game).some((option) => option.id === archaeopteryx.uid));
  game = chooseConceptOption(game, hoatzin.uid);
  game = chooseConceptOption(game, "1");
  assert.equal(game.pendingConceptChoice?.kind, "evolutionary-radiation-card");
  game = chooseConceptOption(game, archaeopteryx.uid);
  game = chooseConceptOption(game, "2");
  assert.equal(game.players[0].lanes[1].creature?.card.definition.key, "hoatzin");
  assert.equal(game.players[0].lanes[2].creature?.card.definition.key, "archaeopteryx");
  assert.equal(game.players[0].allowances.creaturePlayed, false);
  assert.equal(game.players[0].allowances.radiationPlacements, 2);
  assert.equal(game.players[0].allowances.skipBattlePhase, true);
  assert.equal(game.pendingConceptChoice, null);

  const normal = putInHand(game, 0, "cynognathus");
  game = playCreature(game, 0, normal.uid, 3);
  assert.equal(game.players[0].lanes.filter((lane) => lane.creature).length, 4);
  assert.equal(game.players[0].allowances.creaturePlayed, true);
  assert.equal(game.phase, "development");
  game = advanceToBattleOrEndTurn(game);
  assert.equal(game.phase, "handoff");
  assert.equal(game.activePlayer, 1);
  assert.ok(game.log.some((line) => line.includes("skipped the Battle Phase as required")));
});

test("Evolutionary Radiation offers only the missing Level when one low Level is already represented", () => {
  let game = readyGame();
  placeCreature(game, 0, 0, "hoatzin");
  const archaeopteryx = putInHand(game, 0, "archaeopteryx");
  const radiation = putInHand(game, 0, "evolutionary-radiation");
  game = playConcept(game, radiation.uid);
  const options = getConceptChoiceOptions(game);
  assert.ok(options.some((option) => option.id === archaeopteryx.uid));
  assert.ok(options.every((option) => {
    const card = game.players[0].hand.find((entry) => entry.uid === option.id);
    return card?.definition.kind === "creature" && card.definition.printedLevel === 1;
  }));
});

test("Evolutionary Radiation is unavailable on each player's first turn", () => {
  const game = readyGame();
  game.players[0].turnsStarted = 1;
  putInHand(game, 0, "hoatzin");
  const radiation = putInHand(game, 0, "evolutionary-radiation");
  assert.equal(canPlayConcept(game, radiation), false);
  game.players[0].turnsStarted = 2;
  assert.equal(canPlayConcept(game, radiation), true);
});

test("Evolutionary Radiation may stop after its first of two available placements", () => {
  let game = readyGame();
  const hoatzin = putInHand(game, 0, "hoatzin");
  putInHand(game, 0, "archaeopteryx");
  const radiation = putInHand(game, 0, "evolutionary-radiation");
  game = playConcept(game, radiation.uid);
  game = chooseConceptOption(game, hoatzin.uid);
  game = chooseConceptOption(game, "0");
  assert.ok(getConceptChoiceOptions(game).some((option) => option.id === "__finish-radiation__"));
  game = chooseConceptOption(game, "__finish-radiation__");
  assert.equal(game.pendingConceptChoice, null);
  assert.equal(game.players[0].allowances.radiationPlacements, 1);
  assert.equal(game.players[0].allowances.skipBattlePhase, false);
});

test("Whale Fall treats Semi-Aquatic as Aquatic for its third draw", () => {
  let game = readyGame();
  const baryonyx = putInHand(game, 0, "baryonyx");
  const whale = putInHand(game, 0, "whale-fall");
  const deckBefore = game.players[0].deck.length;
  game = playConcept(game, whale.uid);
  game = chooseConceptOption(game, baryonyx.uid);
  assert.equal(game.players[0].deck.length, deckBefore - 3);
  assert.ok(game.players[0].history.some((card) => card.definition.key === "baryonyx"));
});

test("Natural Selection pays a Creature and searches the deck", () => {
  let game = readyGame();
  const cost = putInHand(game, 0, "microraptor");
  const natural = putInHand(game, 0, "natural-selection");
  const target = takeCard(game, 0, "tyrannosaurus-rex");
  game.players[0].deck.push(target);
  game = playConcept(game, natural.uid);
  game = chooseConceptOption(game, cost.uid);
  game = chooseConceptOption(game, target.uid);
  assert.ok(game.players[0].hand.some((card) => card.definition.key === "tyrannosaurus-rex"));
  assert.ok(game.players[0].history.some((card) => card.definition.key === "microraptor"));
});

test("Genetic Drift exposes its discard choice after recording all five draws", () => {
  let game = readyGame();
  putInHand(game, 0, "microraptor");
  const drift = putInHand(game, 0, "genetic-drift");
  game = playConcept(game, drift.uid);
  const options = getConceptChoiceOptions(game);
  assert.equal(options.length, 5);
  assert.equal(game.pendingConceptChoice?.kind, "genetic-drift-discard");
  assert.equal(game.drawEvents.filter((event) => event.reason === "Genetic Drift").length, 5);
  const discardedUid = options[0].id;
  game = chooseConceptOption(game, options[0].id);
  assert.equal(game.players[0].hand.length, 4);
  assert.ok(game.players[0].history.some((card) => card.uid === discardedUid));
  assert.ok(game.players[0].history.some((card) => card.definition.key === "genetic-drift"));
});

test("Dig Site Excavation retrieves a public History card", () => {
  let game = readyGame();
  const recovered = takeCard(game, 0, "microraptor");
  game.players[0].history.push(recovered);
  const dig = putInHand(game, 0, "dig-site-excavation");
  game = playConcept(game, dig.uid);
  game = chooseConceptOption(game, recovered.uid);
  assert.ok(game.players[0].hand.some((card) => card.uid === recovered.uid));
});

test("Semelparity draws two and offers no replacement when its cost comes from hand", () => {
  let game = readyGame();
  const cost = putInHand(game, 0, "hoatzin");
  const semelparity = putInHand(game, 0, "semelparity");
  const deckBefore = game.players[0].deck.length;
  game = playConcept(game, semelparity.uid);
  game = chooseConceptOption(game, `hand:${cost.uid}`);
  assert.equal(game.players[0].deck.length, deckBefore - 2);
  assert.equal(game.log.filter((line) => line.includes("drew a card (Semelparity)")).length, 2);
  assert.equal(game.pendingConceptChoice, null);
  assert.equal(game.players[0].allowances.skipBattlePhase, false);
  assert.ok(game.players[0].history.some((card) => card.uid === cost.uid));
  assert.ok(game.players[0].history.some((card) => card.uid === semelparity.uid));
});

test("Semelparity can replace an in-play cost without using the normal Creature play, then skips Battle", () => {
  let game = readyGame();
  placeCreature(game, 0, 0, "nautilus");
  placeCreature(game, 0, 1, "velociraptor");
  placeCreature(game, 1, 1, "hoatzin");
  const replacement = putInHand(game, 0, "horseshoe-crab");
  const normalPlay = putInHand(game, 0, "archaeopteryx");
  const semelparity = putInHand(game, 0, "semelparity");
  game = playConcept(game, semelparity.uid);
  game = chooseConceptOption(game, "lane:0");
  assert.ok(getConceptChoiceOptions(game).some((option) => option.id === replacement.uid));
  assert.ok(getConceptChoiceOptions(game).some((option) => option.id === "__decline-semelparity__"));
  game = chooseConceptOption(game, replacement.uid);
  assert.ok(getConceptChoiceOptions(game).some((option) => option.id === "0"));
  game = chooseConceptOption(game, "0");
  assert.equal(game.players[0].lanes[0].creature?.card.uid, replacement.uid);
  assert.ok(game.players[0].returnQueue.includes("0-nautilus"));
  assert.equal(game.players[0].allowances.creaturePlayed, false);
  assert.equal(game.players[0].allowances.filledEmpty, false);
  assert.equal(game.players[0].allowances.skipBattlePhase, true);
  assert.ok(legalCreatureLanes(game, 0, normalPlay).includes(2));

  game = playCreature(game, 0, normalPlay.uid, 2);
  assert.equal(game.players[0].lanes[2].creature?.card.uid, normalPlay.uid);
  assert.equal(game.players[0].allowances.creaturePlayed, true);
  assert.equal(hasLegalHunts(game), false);

  game = advanceToBattleOrEndTurn(game);
  assert.equal(game.phase, "handoff");
  assert.equal(game.activePlayer, 1);
  assert.ok(game.log.some((line) => line.includes("skipped the Battle Phase as required")));
  assert.ok(!game.log.some((line) => line.includes("had no legal Hunts")));
});

test("declining Semelparity's in-play replacement preserves the Battle Phase", () => {
  let game = readyGame();
  placeCreature(game, 0, 0, "nautilus");
  putInHand(game, 0, "hoatzin");
  const semelparity = putInHand(game, 0, "semelparity");
  game = playConcept(game, semelparity.uid);
  game = chooseConceptOption(game, "lane:0");
  game = chooseConceptOption(game, "__decline-semelparity__");
  assert.equal(game.pendingConceptChoice, null);
  assert.equal(game.players[0].lanes[0].creature, null);
  assert.equal(game.players[0].allowances.skipBattlePhase, false);
  assert.ok(game.log.some((line) => line.includes("declined Semelparity's optional replacement")));
});

test("Obligate Migration moves either side and carries the attached Adaptation without an entry trigger", () => {
  let game = readyGame();
  placeCreature(game, 1, 0, "diplocaulus");
  attachAdaptation(game, 1, 0, "autotomy");
  const migration = putInHand(game, 0, "obligate-migration");
  game = playConcept(game, migration.uid);
  assert.ok(getConceptChoiceOptions(game).some((option) => option.id === "1:0"));
  game = chooseConceptOption(game, "1:0");
  game = chooseConceptOption(game, "1:1");
  assert.equal(game.players[1].lanes[0].creature, null);
  assert.equal(game.players[1].lanes[1].creature?.card.definition.key, "diplocaulus");
  assert.equal(game.players[1].lanes[1].attachment?.definition.key, "autotomy");
  assert.equal(game.pendingCranialDisplay, null);
});

test("Abiogenesis preserves its Level 0 search as one selectable effect", () => {
  let game = readyGame();
  const abiogenesis = putInHand(game, 0, "abiogenesis");
  game = playConcept(game, abiogenesis.uid);
  assert.equal(game.pendingConceptChoice?.kind, "abiogenesis-mode");
  assert.ok(getConceptChoiceOptions(game).some((option) => option.id === "__abiogenesis-search__"));
  game = chooseConceptOption(game, "__abiogenesis-search__");
  assert.equal(game.pendingConceptChoice?.kind, "abiogenesis-search");
  const options = getConceptChoiceOptions(game);
  assert.ok(options.length > 0);
  assert.ok(options.every((option) => {
    const card = game.players[0].deck.find((entry) => entry.uid === option.id);
    return card?.definition.kind === "creature" && card.definition.printedLevel === 0;
  }));
  game = chooseConceptOption(game, options[0].id);
  assert.ok(game.players[0].hand.some((card) => card.uid === options[0].id));
  assert.equal(game.pendingConceptChoice, null);
  assert.equal(game.players[0].allowances.creaturePlayed, false);
  assert.equal(game.players[0].allowances.skipBattlePhase, false);
  assert.equal(game.phase, "development");
});

test("Abiogenesis places a Level 0 from hand, preserves the normal Creature play, and skips Battle", () => {
  let game = readyGame();
  const abiogenesis = putInHand(game, 0, "abiogenesis");
  const horseshoeCrab = putInHand(game, 0, "horseshoe-crab");
  const microraptor = putInHand(game, 0, "microraptor");

  game = playConcept(game, abiogenesis.uid);
  assert.ok(getConceptChoiceOptions(game).some((option) => option.id === "__abiogenesis-place__"));
  game = chooseConceptOption(game, "__abiogenesis-place__");
  assert.equal(game.pendingConceptChoice?.kind, "abiogenesis-placement-card");
  assert.ok(getConceptChoiceOptions(game).some((option) => option.id === horseshoeCrab.uid));
  game = chooseConceptOption(game, horseshoeCrab.uid);
  assert.equal(game.pendingConceptChoice?.kind, "abiogenesis-placement-lane");
  game = chooseConceptOption(game, "0");

  assert.equal(game.players[0].lanes[0].creature?.card.uid, horseshoeCrab.uid);
  assert.equal(game.pendingConceptChoice, null);
  assert.equal(game.players[0].allowances.creaturePlayed, false);
  assert.equal(game.players[0].allowances.filledEmpty, false);
  assert.equal(game.players[0].allowances.skipBattlePhase, true);
  assert.equal(game.phase, "development");
  assert.ok(legalCreatureLanes(game, 0, microraptor).includes(1));

  game = playCreature(game, 0, microraptor.uid, 1);
  assert.equal(game.players[0].lanes[1].creature?.card.uid, microraptor.uid);
  assert.equal(game.players[0].allowances.creaturePlayed, true);
  assert.equal(game.phase, "development");
  game = advanceToBattleOrEndTurn(game);
  assert.equal(game.phase, "handoff");
  assert.ok(game.log.some((line) => line.includes("skipped the Battle Phase")));
});

test("Abiogenesis remains playable for its placement effect when no Level 0 remains in the deck", () => {
  let game = readyGame();
  const abiogenesis = putInHand(game, 0, "abiogenesis");
  const hoatzin = putInHand(game, 0, "hoatzin");
  const isLevel0 = (card: CardInstance) =>
    card.definition.kind === "creature" && card.definition.printedLevel === 0;
  game.players[0].deck = game.players[0].deck.filter((card) => !isLevel0(card));
  game.players[0].hand = game.players[0].hand.filter(
    (card) => card.uid === abiogenesis.uid || card.uid === hoatzin.uid || !isLevel0(card),
  );

  assert.equal(canPlayConcept(game, abiogenesis), true);
  game = playConcept(game, abiogenesis.uid);
  assert.deepEqual(
    getConceptChoiceOptions(game).map((option) => option.id),
    ["__abiogenesis-place__"],
  );
});

test("Tropical Biodiversity orders the top two cards before a one-card Start Phase draw", () => {
  let game = createGame("Alpha", "Beta", ["tropical", "cold"]);
  game.activePlayer = 0;
  game.phase = "handoff";
  game.handoff = { kind: "turn", to: 0, title: "Alpha's turn", detail: "Private handoff" };
  const first = game.players[0].deck[0];
  const second = game.players[0].deck[1];
  const handBefore = game.players[0].hand.length;

  game = acknowledgeHandoff(game);
  assert.equal(game.phase, "start");
  assert.deepEqual(game.pendingBiodiversity?.cardUids, [first.uid, second.uid]);
  assert.equal(game.players[0].hand.length, handBefore);

  game = chooseBiodiversityTop(game, second.uid);
  assert.equal(game.pendingBiodiversity, null);
  assert.equal(game.phase, "development");
  assert.equal(game.players[0].hand.at(-1)?.uid, second.uid);
  assert.equal(game.players[0].deck[0]?.uid, first.uid);
  assert.deepEqual(game.drawEvents.at(-1), {
    id: 1,
    playerId: 0,
    cardUid: second.uid,
    reason: "normal Start Phase",
  });
});

test("Tropical Biodiversity is suppressed when Cambrian Explosion schedules multiple Start draws", () => {
  let game = createGame("Alpha", "Beta", ["tropical", "cold"]);
  game.activePlayer = 0;
  game.phase = "handoff";
  game.handoff = { kind: "turn", to: 0, title: "Alpha's turn", detail: "Private handoff" };
  setEvent(game, 1, "cambrian-explosion");
  const handBefore = game.players[0].hand.length;

  game = acknowledgeHandoff(game);
  assert.equal(game.pendingBiodiversity, null);
  assert.equal(game.phase, "development");
  assert.equal(game.players[0].hand.length, handBefore + 2);
  assert.deepEqual(game.drawEvents.map((event) => event.reason), ["normal Start Phase", "Cambrian Explosion"]);
});

test("Temperate Seasonal Cycle provides four mandatory rerolls at most once per turn", () => {
  let game = readyGame();
  game.players[0].biome = {
    key: "temperate",
    seasonCounters: 4,
    temperateRerollTurn: null,
    waterwaysConnected: false,
    waterwayRepositionTurn: null,
    freeOverrideUsed: false,
  };
  game.pendingBattle = {
    attackerUid: "attacker",
    defenderUid: "defender",
    attackerPlayer: 0,
    attackerLane: 0,
    defenderPlayer: 1,
    defenderLane: 0,
    attackerLevel: 1,
    attackerLevelMax: 2,
    defenderLevel: 1,
    attackerNotes: [],
    defenderNotes: [],
    coinPlan: { offensiveCount: 1, offensiveReason: "test", defensiveCount: 0, defensiveReason: null },
    origin: "battle-phase",
  };

  assert.equal(canUseTemperateReroll(game, 0), true);
  game = spendTemperateReroll(game, 0);
  assert.equal(game.players[0].biome.seasonCounters, 3);
  assert.equal(game.players[0].biome.temperateRerollTurn, 1);
  assert.equal(canUseTemperateReroll(game, 0), false);
  assert.equal(spendTemperateReroll(game, 0).players[0].biome.seasonCounters, 3);

  game.turnNumber = 2;
  assert.equal(canUseTemperateReroll(game, 0), true);
});

test("Cold Thermal Inertia treats Sovereign as Gigantic and respects both counters", () => {
  const game = readyGame();
  game.players[1].biome.key = "cold";
  const defender = placeCreature(game, 1, 0, "tyrannosaurus-rex");
  const ordinaryHunter = placeCreature(game, 0, 0, "carnotaurus");
  assert.equal(inspectBattleLevel(game, defender.card.uid, "defender", ordinaryHunter.card.uid), 4);

  game.players[0].lanes[0].creature = null;
  const bruiser = placeCreature(game, 0, 0, "allosaurus");
  assert.equal(inspectBattleLevel(game, defender.card.uid, "defender", bruiser.card.uid), 3);

  game.players[0].lanes[0].creature = null;
  const giganticHunter = placeCreature(game, 0, 0, "tyrannosaurus-rex");
  assert.equal(inspectBattleLevel(game, defender.card.uid, "defender", giganticHunter.card.uid), 3);
});

test("Cold augments Gigantic itself, so Specialized doubles only the granted numerical modifier", () => {
  let game = readyGame();
  game.players[1].biome.key = "cold";
  const ordinaryGigantic = placeDeckThreeCreature(game, 1, 0, "leedsichthys");
  const ordinaryHunter = placeCreature(game, 0, 0, "carnotaurus");
  assert.equal(inspectBattleLevel(game, ordinaryGigantic.card.uid, "defender", ordinaryHunter.card.uid), 4);

  game = readyGame();
  game.players[1].biome.key = "cold";
  const blueWhale = placeDeckThreeCreature(game, 1, 0, "blue-whale");
  const blueHunter = placeCreature(game, 0, 0, "carnotaurus");
  assert.equal(inspectBattleLevel(game, blueWhale.card.uid, "defender", blueHunter.card.uid), 6);
  assert.equal(cardVictoryLevel(game, blueWhale), 6);

  game.players[0].lanes[0].creature = null;
  const bruiser = placeCreature(game, 0, 0, "allosaurus");
  assert.equal(inspectBattleLevel(game, blueWhale.card.uid, "defender", bruiser.card.uid), 4);

  game.players[0].lanes[0].creature = null;
  const giganticHunter = placeCreature(game, 0, 0, "tyrannosaurus-rex");
  assert.equal(inspectBattleLevel(game, blueWhale.card.uid, "defender", giganticHunter.card.uid), 4);

  game = readyGame();
  game.phase = "battle";
  const protectedBlueWhale = placeDeckThreeCreature(game, 1, 0, "blue-whale");
  const levelTwoHunter = placeCreature(game, 0, 0, "carnotaurus");
  assert.ok(legalAttackTargets(game, levelTwoHunter.card.uid).includes(protectedBlueWhale.card.uid));
  game.players[0].lanes[0].creature = null;
  const levelOneHunter = placeCreature(game, 0, 0, "cynognathus");
  assert.equal(legalAttackTargets(game, levelOneHunter.card.uid).includes(protectedBlueWhale.card.uid), false);
});

test("Arid Tipping Point wins at the start of Turn 26 with 10+ Victory Levels and an empty opposing board", () => {
  let game = readyGame();
  game.players[0].biome.key = "arid";
  placeCreature(game, 0, 0, "tyrannosaurus-rex");
  placeCreature(game, 0, 1, "spinosaurus");
  placeCreature(game, 0, 2, "dimetrodon");
  placeCreature(game, 0, 3, "allosaurus");
  assert.ok(victoryTotals(game)[0] >= 10);
  assert.ok(game.players[1].lanes.every((lane) => !lane.creature));
  game.turnNumber = 26;
  game.phase = "handoff";
  game.handoff = { kind: "turn", to: 0, title: "Alpha's turn", detail: "Private handoff" };

  game = acknowledgeHandoff(game);
  assert.equal(game.winner, 0);
  assert.equal(game.phase, "game-over");
  assert.match(game.winReason ?? "", /Arid Tipping Point/);
  assert.equal(game.drawEvents.length, 0);
});

test("Aquatic Connected Waterways repositions a Creature and attachment without consuming a play or fill", () => {
  let game = readyGame();
  game.players[0].biome.key = "aquatic";
  game.players[0].biome.waterwaysConnected = true;
  const creature = placeCreature(game, 0, 0, "diplocaulus");
  const attachment = attachAdaptation(game, 0, 0, "autotomy");

  assert.deepEqual(legalConnectedWaterwaySources(game), [0]);
  assert.ok(legalConnectedWaterwayDestinations(game, 0).includes(2));
  game = repositionConnectedWaterway(game, 0, 2);
  assert.equal(game.players[0].lanes[0].creature, null);
  assert.equal(game.players[0].lanes[2].creature?.card.uid, creature.card.uid);
  assert.equal(game.players[0].lanes[2].attachment?.uid, attachment.uid);
  assert.equal(game.players[0].allowances.creaturePlayed, false);
  assert.equal(game.players[0].allowances.filledEmpty, false);
  assert.equal(game.players[0].biome.waterwayRepositionTurn, game.turnNumber);
  assert.deepEqual(legalConnectedWaterwaySources(game), []);
});

test("Aquatic's once-per-game free override preserves the normal Creature play and disconnects movement", () => {
  let game = readyGame();
  game.players[0].biome.key = "aquatic";
  game.players[0].biome.waterwaysConnected = true;
  placeCreature(game, 0, 0, "natovenator");
  const baryonyx = putInHand(game, 0, "baryonyx");
  const hoatzin = putInHand(game, 0, "hoatzin");

  assert.ok(legalAquaticOverrideLanes(game, baryonyx).includes(0));
  game = playAquaticOverride(game, baryonyx.uid, 0);
  assert.equal(game.players[0].lanes[0].creature?.card.uid, baryonyx.uid);
  assert.equal(game.players[0].allowances.creaturePlayed, false);
  assert.equal(game.players[0].biome.freeOverrideUsed, true);
  assert.equal(game.players[0].biome.waterwaysConnected, false);
  assert.equal(game.players[0].allowances.aquaticOverrideLockedLane, 0);
  assert.deepEqual(legalConnectedWaterwaySources(game), []);
  assert.deepEqual(legalAquaticOverrideLanes(game, hoatzin), []);
  assert.ok(legalCreatureLanes(game, 0, hoatzin).includes(1));

  game = playCreature(game, 0, hoatzin.uid, 1);
  assert.equal(game.players[0].lanes[1].creature?.card.uid, hoatzin.uid);
  assert.equal(game.players[0].allowances.creaturePlayed, true);
});

test("Drought can fill either side, selectively override Aquatic identities, suppress the facing Niche, and expire on schedule", () => {
  let game = readyGame(["deck-3", "deck-1"]);
  const facing = placeCreature(game, 0, 2, "xiphactinus");
  placeCreature(game, 1, 0, "natovenator");
  placeCreature(game, 1, 1, "hoatzin");
  const aquaticTarget = placeCreature(game, 1, 2, "diplocaulus");
  const drought = putInHand(game, 0, "drought");

  const targets = legalDroughtTargets(game, drought);
  assert.ok(targets.some((target) => target.playerId === 0 && target.laneIndex === 4), "Drought may fill an empty friendly Niche");
  assert.ok(targets.some((target) => target.playerId === 1 && target.laneIndex === 4), "Drought may fill an empty opposing Niche");
  assert.equal(targets.some((target) => target.playerId === 1 && target.laneIndex === 1), false, "Drought cannot override a non-Aquatic Creature");
  assert.ok(targets.some((target) => target.playerId === 1 && target.laneIndex === 0), "Drought may override a Semi-Aquatic Creature through its Event identity");
  assert.ok(targets.some((target) => target.playerId === 1 && target.laneIndex === 2), "Drought may override an Aquatic Creature");

  game = playDrought(game, drought.uid, 1, 2);
  assert.equal(game.players[1].lanes[2].creature, null);
  assert.equal(game.players[1].lanes[2].drought?.card.definition.key, "drought");
  assert.ok(game.players[1].history.some((card) => card.uid === aquaticTarget.card.uid));
  assert.equal(nicheIsLocked(game, 1, 2), true);
  assert.equal(nicheIsLocked(game, 0, 2), false, "Drought locks only its occupied Niche");
  assert.equal(cardVictoryLevel(game, facing), 2, "the directly opposing Niche loses one Victory Level");
  assert.equal(game.players[0].allowances.creaturePlayed, false, "Drought never consumes the normal Creature play");

  const protectedSpinalSail = placeCreature(game, 1, 4, "dimetrodon");
  const droughtDefinition = DECK_3_SUPPORTS.find((card) => card.key === "drought");
  assert.ok(droughtDefinition);
  const secondDrought: CardInstance = { uid: "0-drought-spinal-sail-check", owner: 0, definition: droughtDefinition };
  game.players[0].hand.push(secondDrought);
  game.players[0].allowances.eventPlayed = false;
  game = playDrought(game, secondDrought.uid, 0, 4);
  assert.equal(cardVictoryLevel(game, protectedSpinalSail), 4, "Spinal Sail mitigates Drought's Event-based Victory decrease by 1");

  const opposing = placeCreature(game, 1, 3, "cynognathus");
  assert.equal(inspectBattleLevel(game, facing.card.uid, "attacker", opposing.card.uid), 1, "the directly opposing Niche loses one Battle Level");

  game = endTurn(game);
  assert.ok(game.players[1].lanes[2].drought, "Drought remains for the opponent's turn");
  game = acknowledgeHandoff(game);
  game = endTurn(game);
  game = acknowledgeHandoff(game);
  assert.ok(game.players[1].lanes[2].drought, "Drought remains through its controller's next turn");
  game = endTurn(game);
  assert.equal(game.players[1].lanes[2].drought, null);
  assert.ok(game.players[0].history.some((card) => card.definition.key === "drought"));
});

test("Island Dwarfism attaches on either side and enforces its isolation, movement, Gigantic, Battle, and Victory rulings", () => {
  let game = readyGame(["deck-3", "deck-3"]);
  const ordinary = placeCreature(game, 0, 0, "anomalocaris");
  const gigantic = placeCreature(game, 1, 2, "leedsichthys");
  const island = putInHand(game, 0, "island-dwarfism");
  const targets = legalAdaptationTargets(game, island);
  assert.ok(targets.some((target) => target.playerId === 0 && target.laneIndex === 0));
  assert.ok(targets.some((target) => target.playerId === 1 && target.laneIndex === 2));

  game = playAdaptation(game, island.uid, 2, 1);
  assert.equal(game.players[1].lanes[2].attachment?.owner, 0, "the Adaptation remains owned by the player who played it");
  assert.equal(cardVictoryLevel(game, gigantic), 6, "Gigantic doubles Island Dwarfism's Victory modifier to +2");
  assert.equal(inspectBattleLevel(game, gigantic.card.uid, "defender", ordinary.card.uid), 1, "Gigantic doubles Island Dwarfism's Battle penalty to -2");

  game.activePlayer = 1;
  game.players[1].allowances = emptyAllowances();
  const adjacentStarter = putInHand(game, 1, "tiktaalik");
  assert.equal(legalCreatureLanes(game, 1, adjacentStarter).includes(1), false);
  assert.equal(legalCreatureLanes(game, 1, adjacentStarter).includes(3), false);
  game.players[1].biome.key = "aquatic";
  game.players[1].biome.waterwaysConnected = true;
  assert.equal(legalConnectedWaterwaySources(game).includes(2), false, "the attached Creature cannot move through Connected Waterways");

  const blueWhale = putInHand(game, 1, "blue-whale");
  const override = checkOverride(game, 1, blueWhale.definition as CreatureCard, 2);
  assert.equal(override.legal, false);
  assert.ok(override.reasons.some((reason) => reason.includes("Gigantic")));
});

test("Geological Boundary is instantaneous, clears its Period and Continuous Events, grants the successor aura, and ends the turn", () => {
  let game = readyGame(["deck-3", "deck-1"]);
  const dollocaris = placeCreature(game, 0, 0, "dollocaris");
  const xiphactinus = placeCreature(game, 0, 2, "xiphactinus");
  const allosaurus = placeCreature(game, 1, 0, "allosaurus");
  const tyrannosaurus = placeCreature(game, 1, 2, "tyrannosaurus-rex");
  setEvent(game, 0, "cambrian-explosion");
  setEvent(game, 1, "cambrian-explosion");
  const boundary = putInHand(game, 0, "geological-boundary");

  game = playEvent(game, boundary.uid);
  assert.equal(game.pendingGeologicalBoundary?.card.uid, boundary.uid);
  assert.deepEqual(geologicalBoundaryOptions(game), [
    "Cambrian", "Ordovician", "Silurian", "Devonian", "Carboniferous", "Permian",
    "Triassic", "Jurassic", "Cretaceous", "Paleogene", "Neogene", "Quaternary",
  ]);

  game = chooseGeologicalBoundaryPeriod(game, "Jurassic");
  assert.equal(game.phase, "handoff");
  assert.equal(game.activePlayer, 1);
  assert.equal(game.turnNumber, 2);
  assert.ok(game.players[0].history.some((card) => card.uid === dollocaris.card.uid));
  assert.ok(game.players[1].history.some((card) => card.uid === allosaurus.card.uid));
  assert.equal(game.players[0].event, null);
  assert.equal(game.players[1].event, null);
  assert.ok(game.players[0].history.some((card) => card.uid === boundary.uid));
  assert.deepEqual(game.periodAuras.map((aura) => aura.period), ["Cretaceous"]);
  assert.equal(inspectBattleLevel(game, xiphactinus.card.uid, "attacker", tyrannosaurus.card.uid), 3);
  assert.equal(inspectBattleLevel(game, tyrannosaurus.card.uid, "defender", xiphactinus.card.uid), 4);

  game = acknowledgeHandoff(game);
  game = endTurn(game);
  game = acknowledgeHandoff(game);
  assert.deepEqual(game.periodAuras, []);
  assert.equal(inspectBattleLevel(game, xiphactinus.card.uid, "attacker", tyrannosaurus.card.uid), 2);
});

test("Geological Boundary resolves Victory changes from global Apex Predator crowding before handoff", () => {
  let game = readyGame(["deck-1", "deck-3"]);
  placeCreature(game, 0, 0, "tyrannosaurus-rex");
  placeCreature(game, 0, 1, "torvosaurus");
  placeCreature(game, 0, 2, "dimetrodon");
  placeCreature(game, 0, 3, "allosaurus");
  placeCreature(game, 1, 4, "megalodon");
  assert.deepEqual(victoryTotals(game), [11, 3]);

  const boundaryDefinition = DECK_3_SUPPORTS.find((card) => card.key === "geological-boundary");
  assert.ok(boundaryDefinition);
  const boundary: CardInstance = {
    uid: "0-geological-boundary-victory-check",
    owner: 0,
    definition: boundaryDefinition,
  };
  game.players[0].hand.push(boundary);
  game = playEvent(game, boundary.uid);
  game = chooseGeologicalBoundaryPeriod(game, "Neogene");

  assert.equal(game.players[1].lanes[4].creature, null);
  assert.equal(victoryTotals(game)[0], 12);
  assert.equal(game.winner, 0);
  assert.equal(game.phase, "game-over");
  assert.equal(game.handoff, null);
});

test("Drought expiration restores Victory and checks the win threshold before handoff", () => {
  let game = readyGame(["deck-1", "deck-3"]);
  placeCreature(game, 0, 0, "tyrannosaurus-rex");
  placeCreature(game, 0, 1, "torvosaurus");
  placeCreature(game, 0, 2, "dimetrodon");
  placeCreature(game, 0, 3, "allosaurus");

  const droughtDefinition = DECK_3_SUPPORTS.find((card) => card.key === "drought");
  assert.ok(droughtDefinition);
  game.players[1].lanes[0].drought = {
    card: { uid: "0-expiring-drought-victory-check", owner: 0, definition: droughtDefinition },
    expiresOnTurn: game.turnNumber,
  };
  assert.equal(victoryTotals(game)[0], 11);

  game = endTurn(game);
  assert.equal(game.players[1].lanes[0].drought, null);
  assert.equal(victoryTotals(game)[0], 12);
  assert.equal(game.winner, 0);
  assert.equal(game.phase, "game-over");
  assert.equal(game.handoff, null);
});

test("Geological Boundary may declare Quaternary and creates no successor aura", () => {
  let game = readyGame(["deck-3", "deck-1"]);
  const orca = placeCreature(game, 0, 0, "orca");
  const boundary = putInHand(game, 0, "geological-boundary");

  game = playEvent(game, boundary.uid);
  game = chooseGeologicalBoundaryPeriod(game, "Quaternary");

  assert.ok(game.players[0].history.some((card) => card.uid === orca.card.uid));
  assert.deepEqual(game.periodAuras, []);
  assert.equal(game.phase, "handoff");
  assert.equal(game.activePlayer, 1);
});

test("Filter Feeder reorders exactly the top two cards without drawing them", () => {
  let game = readyGame(["deck-3", "deck-1"]);
  placeCreature(game, 0, 0, "xiphactinus");
  const leedsichthys = putInHand(game, 0, "leedsichthys");
  const [first, second] = game.players[0].deck.slice(0, 2);
  const handBefore = game.players[0].hand.length;
  const deckBefore = game.players[0].deck.length;

  game = playCreature(game, 0, leedsichthys.uid, 0);
  assert.deepEqual(game.pendingFilterFeeder?.cardUids, [first.uid, second.uid]);
  game = chooseFilterFeederTop(game, second.uid);
  assert.deepEqual(game.players[0].deck.slice(0, 2).map((card) => card.uid), [second.uid, first.uid]);
  assert.equal(game.players[0].deck.length, deckBefore);
  assert.equal(game.players[0].hand.length, handBefore - 1);
});

test("Rapid Speciation can place Blue Whale and still resolves Filter Feeder exactly once", () => {
  let game = readyGame(["deck-3", "deck-1"]);
  placeCreature(game, 0, 0, "orca");
  const blueWhale = putInHand(game, 0, "blue-whale");
  const rapidSpeciation = putInHand(game, 0, "rapid-speciation");
  const [first, second] = game.players[0].deck.slice(0, 2);

  game = playConcept(game, rapidSpeciation.uid);
  assert.equal(game.players[0].allowances.rapidSpeciation, true);
  game = playCreature(game, 0, blueWhale.uid, 0);

  assert.equal(game.players[0].lanes[0].creature?.card.uid, blueWhale.uid);
  assert.equal(game.players[0].allowances.rapidSpeciation, false);
  assert.deepEqual(game.pendingFilterFeeder?.cardUids, [first.uid, second.uid]);
  game = chooseFilterFeederTop(game, first.uid);
  assert.equal(game.pendingFilterFeeder, null);
  assert.deepEqual(game.players[0].deck.slice(0, 2).map((card) => card.uid), [first.uid, second.uid]);
});

test("Visual applies only to the first committed Hunt involving its bearer", () => {
  let game = readyGame(["deck-3", "deck-1"]);
  game.phase = "battle";
  const dollocaris = placeCreature(game, 0, 0, "dollocaris");
  const nautilus = placeCreature(game, 1, 0, "nautilus");
  setEvent(game, 0, "superpredators");

  game = previewBattle(game, dollocaris.card.uid, nautilus.card.uid);
  assert.ok(game.pendingBattle?.attackerNotes.includes("Visual +1"));
  game = cancelBattlePreview(game);
  assert.equal(game.players[0].lanes[0].creature?.visualUsed, false, "canceling a preview does not spend Visual");
  game = previewBattle(game, dollocaris.card.uid, nautilus.card.uid);
  game = commitBattle(game);
  assert.equal(game.players[0].lanes[0].creature?.visualUsed, true);
  assert.ok(game.players[0].lanes[0].creature);
  assert.ok(game.players[1].lanes[0].creature);

  game.turnNumber = 2;
  game.activePlayer = 0;
  game.phase = "battle";
  game = previewBattle(game, dollocaris.card.uid, nautilus.card.uid);
  assert.equal(game.pendingBattle?.attackerNotes.includes("Visual +1"), false);
});

test("Dermal Armor bridges hard defenses and Durophagy rewards qualifying kills, including Specialized draws", () => {
  let game = readyGame(["deck-1", "deck-3"]);
  game.phase = "battle";
  const allosaurus = placeCreature(game, 0, 0, "allosaurus");
  const dunkleosteus = placeCreature(game, 1, 0, "dunkleosteus");
  setEvent(game, 0, "superpredators");
  game = previewBattle(game, allosaurus.card.uid, dunkleosteus.card.uid);
  assert.ok(game.pendingBattle?.defenderNotes.includes("Dermal Armor +1"));
  game = commitBattle(game);
  assert.ok(game.players[0].lanes[0].creature, "Dermal Armor's reactive clause spares an attacker that loses only to its bonus");
  assert.ok(game.players[1].lanes[0].creature);

  const shellBridge: CreatureCard = {
    ...(DECK_3.find((card) => card.key === "xiphactinus") as CreatureCard),
    tags: ["Aquatic", "Shell"],
  };
  assert.equal(checkOverride(game, 1, shellBridge, 0).matches.tag, true, "Dermal Armor matches Shell for overrides");

  game = readyGame();
  game.phase = "battle";
  const tyrannosaurus = placeCreature(game, 0, 0, "tyrannosaurus-rex");
  const shellPrey = placeCreature(game, 1, 0, "nautilus");
  setEvent(game, 0, "superpredators");
  const rexDeckBefore = game.players[0].deck.length;
  game = previewBattle(game, tyrannosaurus.card.uid, shellPrey.card.uid);
  game = commitBattle(game);
  assert.equal(game.players[0].deck.length, rexDeckBefore - 1);
  assert.ok(game.log.some((line) => line.includes("Tyrannosaurus rex's Durophagy drew 1 card")));

  game = readyGame(["deck-3", "deck-1"]);
  game.phase = "battle";
  const ptychodus = placeCreature(game, 0, 0, "ptychodus");
  const specializedPrey = placeCreature(game, 1, 0, "nautilus");
  setEvent(game, 0, "superpredators");
  const deckBefore = game.players[0].deck.length;
  game = previewBattle(game, ptychodus.card.uid, specializedPrey.card.uid);
  game = commitBattle(game);
  assert.equal(game.players[0].deck.length, deckBefore - 2);
  assert.ok(game.log.some((line) => line.includes("Ptychodus's Durophagy drew 2 cards")));
});

test("destruction prevention resolves before Durophagy and prevents its draw", () => {
  let game = readyGame();
  game.phase = "battle";
  const tyrannosaurus = placeCreature(game, 0, 0, "tyrannosaurus-rex");
  const nautilus = placeCreature(game, 1, 0, "nautilus");
  const autotomy = attachAdaptation(game, 1, 0, "autotomy");
  const deckBefore = game.players[0].deck.length;

  game = previewBattle(game, tyrannosaurus.card.uid, nautilus.card.uid);
  game = commitBattle(game);

  assert.ok(game.players[1].lanes[0].creature, "Autotomy keeps the hard-defense Creature in play");
  assert.equal(game.players[1].lanes[0].attachment, null);
  assert.ok(game.players[1].history.some((card) => card.uid === autotomy.uid));
  assert.equal(game.players[0].deck.length, deckBefore);
  assert.equal(game.log.some((line) => line.includes("Durophagy drew")), false);
});

test("Engulf is optional, occupies the Adaptation Slot, grants Victory, blocks Hunts, and cleans up with its holder", () => {
  let game = readyGame(["deck-3", "deck-1"]);
  game.phase = "battle";
  const xiphactinus = placeCreature(game, 0, 0, "xiphactinus");
  const nautilus = placeCreature(game, 1, 0, "nautilus");
  setEvent(game, 0, "superpredators");

  game = previewBattle(game, xiphactinus.card.uid, nautilus.card.uid);
  game = commitBattle(game);
  assert.equal(game.pendingEngulf?.defeatedUid, nautilus.card.uid);
  assert.ok(game.players[1].history.some((card) => card.uid === nautilus.card.uid));
  game = chooseEngulf(game, true);
  assert.equal(game.players[0].lanes[0].engulfed?.uid, nautilus.card.uid);
  assert.equal(game.players[1].history.some((card) => card.uid === nautilus.card.uid), false);
  assert.equal(cardVictoryLevel(game, xiphactinus), 4);

  game.turnNumber = 2;
  game.activePlayer = 0;
  game.phase = "battle";
  placeCreature(game, 1, 1, "hoatzin");
  assert.deepEqual(legalAttackTargets(game, xiphactinus.card.uid), []);

  game.phase = "development";
  game.players[0].allowances = emptyAllowances();
  const leedsichthys = putInHand(game, 0, "leedsichthys");
  game = playCreature(game, 0, leedsichthys.uid, 0);
  assert.equal(game.players[0].lanes[0].engulfed, null);
  assert.ok(game.players[1].history.some((card) => card.uid === nautilus.card.uid));
});

test("Aquatic is a closed override ecosystem while Semi-Aquatic remains an unrestricted directional bridge", () => {
  let game = readyGame();
  const compsognathus = CREATURES.find((card) => card.key === "compsognathus")!;
  placeCreature(game, 0, 0, "compsognathus");
  const aquaticCopy: CreatureCard = {
    ...compsognathus,
    key: "synthetic-aquatic-compsognathus",
    name: "Aquatic Compsognathus",
    tags: [...compsognathus.tags, "Aquatic"],
  };
  let result = checkOverride(game, 0, aquaticCopy, 0);
  assert.equal(result.matchCount >= 3, true);
  assert.equal(result.legal, false, "printed Aquatic cannot enter a non-Aquatic occupant");

  game = readyGame();
  const currentAquatic: CardInstance = { uid: "current-aquatic", owner: 0, definition: aquaticCopy };
  game.players[0].lanes[0].creature = creatureInPlay(currentAquatic);
  result = checkOverride(game, 0, compsognathus, 0);
  assert.equal(result.matchCount >= 3, true);
  assert.equal(result.legal, false, "non-Aquatic cannot enter a printed Aquatic occupant");

  const semiCopy: CreatureCard = {
    ...compsognathus,
    key: "synthetic-semi-compsognathus",
    name: "Semi-Aquatic Compsognathus",
    tags: [...compsognathus.tags, "Semi-Aquatic"],
  };
  result = checkOverride(game, 0, semiCopy, 0);
  assert.equal(result.legal, true, "Semi-Aquatic satisfies the Aquatic occupant's gate");
  assert.equal(result.matches.tag, true, "matching base Taxa make the occupied Aquatic identity supply Tag");

  game.players[0].lanes[0].creature = creatureInPlay({ uid: "current-semi", owner: 0, definition: semiCopy });
  result = checkOverride(game, 0, compsognathus, 0);
  assert.equal(result.legal, true, "a Semi-Aquatic occupant remains open to non-Aquatic incoming Creatures");
});

test("Diet matching is directional from the incoming Creature", () => {
  const base = CREATURES.find((card) => card.key === "hoatzin")!;
  const diets = ["Herbivore", "Omnivore", "Carnivore"] as const;
  const expected: Record<(typeof diets)[number], Record<(typeof diets)[number], boolean>> = {
    Herbivore: { Herbivore: true, Omnivore: false, Carnivore: false },
    Omnivore: { Herbivore: true, Omnivore: true, Carnivore: true },
    Carnivore: { Herbivore: false, Omnivore: true, Carnivore: true },
  };
  for (const currentDiet of diets) {
    for (const incomingDiet of diets) {
      const game = readyGame();
      const current: CreatureCard = { ...base, key: `current-${currentDiet}`, diet: currentDiet };
      const incoming: CreatureCard = { ...base, key: `incoming-${incomingDiet}`, diet: incomingDiet };
      game.players[0].lanes[0].creature = creatureInPlay({ uid: `current-${currentDiet}`, owner: 0, definition: current });
      assert.equal(checkOverride(game, 0, incoming, 0).matches.diet, expected[incomingDiet][currentDiet], `${incomingDiet} into ${currentDiet}`);
    }
  }
});

test("Deck 2 combat Tags apply their locked Battle modifiers", () => {
  let game = readyGame(["deck-2", "deck-2"]);
  const iguanodon = placeCreature(game, 0, 0, "iguanodon");
  const opposing = placeCreature(game, 1, 0, "yinlong");
  assert.equal(inspectBattleLevel(game, iguanodon.card.uid, "attacker", opposing.card.uid), 3, "Armament attacks at +1");

  const defendingIguanodon = placeCreature(game, 1, 1, "iguanodon");
  assert.equal(inspectBattleLevel(game, defendingIguanodon.card.uid, "defender", iguanodon.card.uid), 3, "Armament defends at +1");

  game = readyGame(["deck-2", "deck-2"]);
  const pachycephalosaurus = placeCreature(game, 0, 0, "pachycephalosaurus");
  const facing = placeCreature(game, 1, 0, "yinlong");
  assert.equal(inspectBattleLevel(game, pachycephalosaurus.card.uid, "attacker", facing.card.uid), 3, "Specialized doubles Rivalry to +2");
  game.players[1].lanes[1].creature = game.players[1].lanes[0].creature;
  game.players[1].lanes[0].creature = null;
  assert.equal(inspectBattleLevel(game, pachycephalosaurus.card.uid, "attacker", facing.card.uid), 1, "Rivalry still requires facing Niches");

  game = readyGame(["deck-2", "deck-2"]);
  const saltasaurus = placeCreature(game, 1, 0, "saltasaurus");
  const hunter = placeCreature(game, 0, 0, "hoatzin");
  assert.equal(inspectBattleLevel(game, saltasaurus.card.uid, "defender", hunter.card.uid), 4, "Osteoderm provides its existing +2 defense");
});

test("Herd resolves before Nesting, triggers once per player, and Nesting ends the turn after entry effects", () => {
  let game = readyGame(["deck-2", "deck-2"]);
  const mussaurus = putInHand(game, 0, "mussaurus");
  const protoceratops = putInHand(game, 0, "protoceratops");
  game.players[0].deck.push(takeCard(game, 0, "parasaurolophus"));
  game = playCreature(game, 0, mussaurus.uid, 2);
  assert.ok(game.pendingHerd);
  assert.equal(game.pendingNesting, null);
  const herdNames = getHerdOptions(game).map((option) => option.label);
  assert.ok(herdNames.includes("Parasaurolophus"));
  assert.equal(herdNames.includes("Shantungosaurus"), false, "Herd cannot search more than one Printed Level higher");

  game = chooseHerd(game, "__decline-herd__");
  assert.equal(game.pendingHerd, null);
  assert.equal(game.pendingNesting?.stage, "card");
  assert.ok(getNestingOptions(game).some((option) => option.id === protoceratops.uid));
  game = chooseNesting(game, protoceratops.uid);
  assert.equal(game.pendingNesting?.stage, "lane");
  game = chooseNesting(game, "1");
  assert.equal(game.players[0].lanes[1].creature?.card.definition.key, "protoceratops");
  assert.equal(game.pendingHerd, null, "the nested Herd bearer cannot trigger Herd a second time that turn");
  assert.equal(game.activePlayer, 1);
  assert.equal(game.phase, "handoff");
  assert.ok(game.log.some((line) => line.includes("turn ends after Nesting")));
});

test("Specialized Deimatic protects Therizinosaurus through two opposing turns", () => {
  let game = readyGame(["deck-2", "deck-2"]);
  placeCreature(game, 0, 0, "plateosaurus");
  const therizinosaurus = putInHand(game, 0, "therizinosaurus");
  game = playCreature(game, 0, therizinosaurus.uid, 0);
  const protectedCreature = game.players[0].lanes[0].creature!;
  assert.equal(protectedCreature.deimaticProtectedThroughTurn, 4);

  const hunter = placeDeckThreeCreature(game, 1, 1, "cladoselache", { printedLevel: 2 });
  game.activePlayer = 1;
  game.phase = "battle";
  game.turnNumber = 2;
  assert.equal(legalAttackTargets(game, hunter.card.uid).includes(protectedCreature.card.uid), false);
  game.turnNumber = 4;
  assert.equal(legalAttackTargets(game, hunter.card.uid).includes(protectedCreature.card.uid), false);
  game.turnNumber = 6;
  assert.equal(legalAttackTargets(game, hunter.card.uid).includes(protectedCreature.card.uid), true);
});

test("Overreach queues the next Start draw, Specialized doubles quantity, and Tropical filtering is suppressed", () => {
  let game = readyGame(["deck-2", "deck-2"]);
  placeCreature(game, 0, 0, "saltasaurus");
  const mamenchisaurus = putInHand(game, 0, "mamenchisaurus");
  game = playCreature(game, 0, mamenchisaurus.uid, 0);
  assert.equal(game.players[0].overreachQueuedDraws, 2);
  assert.equal(game.players[0].overreachDueTurn, 3);
  game.players[0].biome.key = "tropical";

  game = endTurn(game);
  game = acknowledgeHandoff(game);
  game = endTurn(game);
  const drawEventCount = game.drawEvents.length;
  game = acknowledgeHandoff(game);
  assert.equal(game.pendingBiodiversity, null, "multiple scheduled Start draws suppress Tropical filtering");
  assert.equal(game.drawEvents.length, drawEventCount + 3);
  assert.equal(game.drawEvents.slice(-3).filter((event) => event.reason === "Overreach").length, 2);
  assert.equal(game.players[0].overreachQueuedDraws, 0);

  game = readyGame(["deck-2", "deck-2"]);
  game.players[0].overreachTriggeredTurn = game.turnNumber;
  placeCreature(game, 0, 0, "saltasaurus");
  const brachiosaurus = putInHand(game, 0, "brachiosaurus");
  game = playCreature(game, 0, brachiosaurus.uid, 0);
  assert.equal(game.players[0].overreachQueuedDraws, 0, "Overreach cannot trigger a second time for that player during the turn");
});

test("Bastion applies both branches on the correct first Hunt and inverts during Stampede", () => {
  let game = readyGame(["deck-2", "deck-2"]);
  const triceratops = placeCreature(game, 0, 1, "triceratops");
  const protoceratops = placeCreature(game, 0, 0, "protoceratops");
  const hunter = placeCreature(game, 1, 0, "hoatzin");
  assert.equal(inspectBattleLevel(game, protoceratops.card.uid, "defender", hunter.card.uid), 1);
  assert.equal(inspectBattleLevel(game, triceratops.card.uid, "defender", hunter.card.uid), 3);

  game = readyGame(["deck-1", "deck-2"]);
  game.phase = "battle";
  const firstHunter = placeCreature(game, 0, 0, "herrerasaurus");
  const secondHunter = placeCreature(game, 0, 1, "baryonyx");
  const lowBastion = placeCreature(game, 1, 0, "protoceratops");
  lowBastion.card.definition = { ...lowBastion.card.definition, tags: ["Bastion"] };

  game = previewBattle(game, firstHunter.card.uid, lowBastion.card.uid);
  assert.equal(game.pendingBattle?.defenderLevel, 2);
  game = commitBattle(game);
  assert.ok(game.players[0].lanes[0].creature, "Bastion's survival clause spares the first hunter");
  assert.ok(game.players[1].lanes[0].creature);

  game = previewBattle(game, secondHunter.card.uid, lowBastion.card.uid);
  assert.equal(game.pendingBattle?.defenderLevel, 0, "the low-Level Bastion bonus is spent after the first Hunt");
  game = commitBattle(game);
  assert.equal(game.players[1].lanes[0].creature, null);

  game = readyGame(["deck-2", "deck-1"]);
  const stampedingBastion = placeCreature(game, 0, 0, "protoceratops");
  stampedingBastion.card.definition = { ...stampedingBastion.card.definition, tags: ["Bastion"] };
  placeCreature(game, 1, 0, "herrerasaurus");
  const stampede = putInHand(game, 0, "stampede");
  game = playEvent(game, stampede.uid);
  assert.equal(game.pendingBattle?.attackerLevel, 2);
  game = commitBattle(game);
  assert.ok(game.players[0].lanes[0].creature);
  assert.ok(game.players[1].lanes[0].creature, "inverted Bastion spares the opposing Creature when its bonus alone would destroy it");
});

test("Air Sacs permits only exact +2 Saurischian progression with normal matches intact", () => {
  const game = readyGame(["deck-2", "deck-2"]);
  placeCreature(game, 0, 0, "saltasaurus");
  const dreadnoughtus = putInHand(game, 0, "dreadnoughtus");
  assert.equal(dreadnoughtus.definition.kind, "creature");
  assert.equal(checkOverride(game, 0, dreadnoughtus.definition, 0).levelLegal, false);
  attachAdaptation(game, 0, 0, "air-sacs");
  const result = checkOverride(game, 0, dreadnoughtus.definition, 0);
  assert.equal(result.levelLegal, true);
  assert.equal(result.matchCount >= 3, true);
  assert.equal(result.legal, true);

  const ornithischianCopy: CreatureCard = {
    ...dreadnoughtus.definition,
    key: "ornithischian-dreadnoughtus",
    taxa: dreadnoughtus.definition.taxa.filter((taxon) => taxon !== "Saurischian").concat("Ornithischian"),
  };
  assert.equal(checkOverride(game, 0, ornithischianCopy, 0).levelLegal, false, "Air Sacs never jumps into an Ornithischian");
});

test("Dental Battery transfers on Ornithischian override and draws again when it later enters History", () => {
  let game = readyGame(["deck-2", "deck-2"]);
  placeCreature(game, 0, 0, "ankylosaurus");
  const dentalBattery = attachAdaptation(game, 0, 0, "dental-battery");
  const iguanodon = putInHand(game, 0, "iguanodon");
  const deckBeforeTransfer = game.players[0].deck.length;
  game = playCreature(game, 0, iguanodon.uid, 0);
  assert.equal(game.players[0].lanes[0].attachment?.uid, dentalBattery.uid);
  assert.equal(game.players[0].history.some((card) => card.uid === dentalBattery.uid), false);
  assert.equal(game.players[0].deck.length, deckBeforeTransfer - 1);

  const wildfire = putInHand(game, 0, "wildfire");
  const deckBeforeHistory = game.players[0].deck.length;
  game = playWildfire(game, wildfire.uid, 0);
  assert.ok(game.players[0].history.some((card) => card.uid === dentalBattery.uid));
  assert.equal(game.players[0].deck.length, deckBeforeHistory - 1);

  game = readyGame(["deck-2", "deck-2"]);
  const drift = takeCard(game, 0, "genetic-drift");
  const dentalFromDeck = takeCard(game, 0, "dental-battery");
  const fillers = ["air-sacs", "thagomizer", "facultative-quadrupedality", "wildfire", "drought"].map((key) => takeCard(game, 0, key));
  game.players[0].hand = [drift];
  game.players[0].deck = [dentalFromDeck, ...fillers];
  const originalRandom = Math.random;
  Math.random = () => 0.999999;
  try {
    game = playConcept(game, drift.uid);
    assert.ok(game.pendingConceptChoice?.eligibleUids?.includes(dentalFromDeck.uid));
    const drawEventsBeforeDiscard = game.drawEvents.length;
    game = chooseConceptOption(game, dentalFromDeck.uid);
    assert.equal(game.drawEvents.length, drawEventsBeforeDiscard + 1, "discarding Dental Battery from hand triggers its broad History draw");
  } finally {
    Math.random = originalRandom;
  }
});

test("Facultative Quadrupedality moves once to an adjacent Niche, carries itself, and respects Graviportal", () => {
  let game = readyGame(["deck-2", "deck-2"]);
  const therizinosaurus = placeCreature(game, 0, 2, "therizinosaurus");
  therizinosaurus.deimaticProtectedThroughTurn = 4;
  const adaptation = attachAdaptation(game, 0, 2, "facultative-quadrupedality");
  assert.deepEqual(legalFacultativeSources(game), [2]);
  assert.deepEqual(legalFacultativeDestinations(game, 2), [1, 3]);
  game = moveFacultativeQuadrupedality(game, 2, 1);
  assert.equal(game.players[0].lanes[1].creature?.card.uid, therizinosaurus.card.uid);
  assert.equal(game.players[0].lanes[1].attachment?.uid, adaptation.uid);
  assert.equal(game.players[0].lanes[1].creature?.deimaticProtectedThroughTurn, 4, "movement suppresses entry effects");
  assert.deepEqual(legalFacultativeSources(game), []);

  game = readyGame(["deck-2", "deck-2"]);
  placeCreature(game, 0, 2, "shunosaurus");
  attachAdaptation(game, 0, 2, "facultative-quadrupedality");
  assert.deepEqual(legalFacultativeSources(game), [], "Graviportal blocks movement effects");
});

test("Thagomizer enforces eligibility, defense, lethal ties, and the Stegosaur Victory rider", () => {
  const thagomizer = DECK_2_SUPPORTS.find((card) => card.key === "thagomizer") as AdaptationCard;
  assert.equal(adaptationEligible(thagomizer, DECK_2.find((card) => card.key === "iguanodon")!), true);
  assert.equal(adaptationEligible(thagomizer, DECK_2.find((card) => card.key === "protoceratops")!), true);
  assert.equal(adaptationEligible(thagomizer, DECK_2.find((card) => card.key === "mussaurus")!), false);

  let game = readyGame(["deck-2", "deck-2"]);
  game.phase = "battle";
  const stegosaurus = placeCreature(game, 1, 0, "stegosaurus");
  attachAdaptation(game, 1, 0, "thagomizer");
  const attacker = placeDeckThreeCreature(game, 0, 0, "cladoselache", { printedLevel: 4 });
  assert.equal(cardVictoryLevel(game, stegosaurus), 3);
  game = previewBattle(game, attacker.card.uid, stegosaurus.card.uid);
  assert.equal(game.pendingBattle?.defenderLevel, 4);
  game = commitBattle(game);
  assert.equal(game.players[0].lanes[0].creature, null, "a tied successful defense destroys the attacker when both base Tags are present");
  assert.ok(game.players[1].lanes[0].creature);
});

test("Genetic Mutations chooses exactly one Adaptation currently remaining in the deck", () => {
  let game = readyGame(["deck-2", "deck-2"]);
  const mutations = putInHand(game, 0, "genetic-mutations");
  const airSacs = takeCard(game, 0, "air-sacs");
  const thagomizer = takeCard(game, 0, "thagomizer");
  const filler = takeCard(game, 0, "dreadnoughtus");
  game.players[0].deck = [airSacs, thagomizer, filler];
  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    game = playConcept(game, mutations.uid);
  } finally {
    Math.random = originalRandom;
  }
  assert.ok(game.players[0].hand.some((card) => card.uid === airSacs.uid));
  assert.equal(game.players[0].hand.some((card) => card.uid === thagomizer.uid), false);
  assert.equal(game.players[0].deck.length, 2);
  assert.ok(game.players[0].history.some((card) => card.uid === mutations.uid));
});

test("Stampede traverses both boards counter-clockwise, ignores Diet, permits new Herbivores, and inverts Tags but not Adaptations", () => {
  let game = readyGame(["deck-2", "deck-2"]);
  const protoceratops = placeCreature(game, 0, 0, "protoceratops");
  const yinlong = placeCreature(game, 1, 0, "yinlong");
  const stegosaurus = placeCreature(game, 1, 4, "stegosaurus");
  attachAdaptation(game, 1, 4, "thagomizer");
  const carnivore = placeDeckThreeCreature(game, 0, 4, "cladoselache", { printedLevel: 3 });
  for (const creature of [protoceratops, yinlong, stegosaurus, carnivore]) creature.enteredTurn = game.turnNumber;
  const stampede = putInHand(game, 0, "stampede");

  game = playEvent(game, stampede.uid);
  assert.equal(game.pendingBattle?.origin, "stampede");
  assert.equal(game.pendingBattle?.attackerUid, protoceratops.card.uid);
  assert.equal(game.pendingBattle?.defenderUid, yinlong.card.uid);
  assert.ok(game.players[0].history.some((card) => card.uid === stampede.uid));
  assert.ok(cancelBattlePreview(game).pendingBattle, "Stampede Hunts cannot be canceled out of the sequence");

  game = commitBattle(game);
  assert.equal(game.players[1].lanes[0].creature, null, "Stampede-inverted Retaliation destroys the defender on a tie");
  assert.equal(game.pendingBattle?.attackerUid, stegosaurus.card.uid, "the opposing rightmost Herbivore is next counter-clockwise");
  assert.equal(game.pendingBattle?.defenderUid, carnivore.card.uid);
  assert.equal(game.pendingBattle?.attackerLevel, 3, "Armament applies, but defensive Thagomizer is not inverted");
  assert.equal(game.pendingBattle?.attackerNotes.some((note) => note.includes("Thagomizer")), false);

  game = commitBattle(game);
  assert.equal(game.players[0].lanes[4].creature, null, "the opposing Herbivore Hunts despite its Herbivore Diet");
  assert.equal(game.pendingStampede, null);
  assert.equal(game.activePlayer, 1);
  assert.equal(game.phase, "handoff");
});

test("Sovereign branches by Diet and every Deck 2 Level 3 has a route to Dreadnoughtus", () => {
  const dreadnoughtus = DECK_2.find((card) => card.key === "dreadnoughtus")!;
  const tyrannosaurus = CREATURES.find((card) => card.key === "tyrannosaurus-rex")!;
  assert.equal(effectiveHasTag(dreadnoughtus, "Gigantic"), true);
  assert.equal(effectiveHasTag(dreadnoughtus, "Territorial"), false);
  assert.equal(effectiveHasTag(tyrannosaurus, "Gigantic"), true);
  assert.equal(effectiveHasTag(tyrannosaurus, "Territorial"), true);

  for (const currentKey of ["shantungosaurus", "brachiosaurus", "triceratops", "mamenchisaurus"]) {
    const game = readyGame(["deck-2", "deck-2"]);
    placeCreature(game, 0, 0, currentKey);
    assert.equal(checkOverride(game, 0, dreadnoughtus, 0).legal, true, `${currentKey} should reach Dreadnoughtus`);
  }

  const game = readyGame(["deck-2", "deck-2"]);
  const monument = placeCreature(game, 0, 0, "dreadnoughtus");
  const drought = takeCard(game, 1, "drought");
  assert.equal(drought.definition.kind, "event");
  game.players[1].lanes[0].drought = {
    card: drought as CardInstance & { definition: EventCard },
    expiresOnTurn: 3,
  };
  assert.equal(cardVictoryLevel(game, monument), 4, "Sovereign does not prevent an Event's Victory reduction");
});

test("Engulf triggers while defending and Specialized doubles only its Victory bonus", () => {
  let game = readyGame(["deck-1", "deck-3"]);
  game.phase = "battle";
  game.players[1].biome.key = "cold";
  const attacker = placeCreature(game, 0, 0, "baryonyx");
  const defendingXiphactinus = placeCreature(game, 1, 0, "xiphactinus");
  setEvent(game, 0, "superpredators");

  game = previewBattle(game, attacker.card.uid, defendingXiphactinus.card.uid);
  game = commitBattle(game);
  assert.equal(game.pendingEngulf?.defeatedUid, attacker.card.uid);
  game = chooseEngulf(game, true);
  assert.equal(game.players[1].lanes[0].engulfed?.uid, attacker.card.uid);
  assert.equal(cardVictoryLevel(game, defendingXiphactinus), 4);

  game = readyGame(["deck-3", "deck-1"]);
  game.phase = "battle";
  const blackSwallower = placeCreature(game, 0, 0, "black-swallower");
  const nautilus = placeCreature(game, 1, 0, "nautilus");
  game.periodAuras.push({ owner: 0, period: "Quaternary", expiresAtTurnStart: 3 });
  setEvent(game, 0, "superpredators");
  game = previewBattle(game, blackSwallower.card.uid, nautilus.card.uid);
  game = commitBattle(game);
  game = chooseEngulf(game, true);
  assert.equal(game.players[0].lanes[0].engulfed?.uid, nautilus.card.uid);
  assert.equal(cardVictoryLevel(game, blackSwallower), 2, "Specialized doubles Engulf's +1 Victory bonus to +2");
});
