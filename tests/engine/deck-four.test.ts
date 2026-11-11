import { test } from "vitest";
import assert from "node:assert/strict";

import {
  CARD_LIBRARY,
  type CreatureCard,
  DECK_4_DECK,
  DECK_INFO,
  DECK_KEYS,
  deckBiome,
  DECKS,
  type DeckKey,
} from "../../src/data/cards.ts";
import {
  applyAction,
  cardVictoryLevel,
  checkOverride,
  createGame,
  emptyAllowances,
  explainEvent,
  feedbackLoopsReturnCards,
  getConceptChoiceOptions,
  effectiveHasTag,
  inspectBattlePower,
  legalAttackTargets,
  legalCreatureLanes,
  type CardInstance,
  type GameState,
  type PlayerId,
} from "../../src/engine/index.ts";

function readyGame(decks: [DeckKey, DeckKey] = ["deck-4", "deck-4"]): GameState {
  const game = createGame("Alpha", "Beta", [null, null], decks, { seed: 7 });
  game.activePlayer = 0;
  game.turnNumber = 3;
  game.phase = "development";
  game.handoff = null;
  for (const player of game.players) {
    player.lanes = Array.from({ length: 5 }, () => ({
      creature: null,
      attachment: null,
      engulfed: null,
      wildfire: null,
      drought: null,
    }));
    player.event = null;
    player.allowances = emptyAllowances();
  }
  return game;
}

/** Takes a card out of a player's deck, hand or History, or makes one from the card library. */
function takeCard(game: GameState, playerId: PlayerId, key: string): CardInstance {
  const player = game.players[playerId];
  for (const zone of [player.hand, player.deck, player.history]) {
    const index = zone.findIndex((card) => card.definition.key === key);
    if (index >= 0) return zone.splice(index, 1)[0]!;
  }
  return { uid: `${playerId}-library-${key}`, owner: playerId, definition: CARD_LIBRARY.get(key)! };
}

function place(game: GameState, playerId: PlayerId, lane: number, key: string, overrides: Partial<CreatureCard> = {}) {
  const card = takeCard(game, playerId, key);
  card.definition = { ...(card.definition as CreatureCard), ...overrides };
  game.players[playerId].lanes[lane]!.creature = {
    card: card as CardInstance & { definition: CreatureCard },
    enteredTurn: 1,
    lastAttackTurn: null,
    attackedTurn: null,
    elusiveUsedTurn: null,
    mobFeederTriggeredTurn: null,
    mobFeederBonusTurn: null,
    burrowedUntilTurn: null,
    cannotAttackOnTurn: null,
    cannotOverrideOnTurn: null,
    attackBarriers: [],
    deimaticProtectedThroughTurn: null,
    bastionDefendedTurn: null,
    bastionAttackedTurn: null,
    facultativeMovedTurn: null,
  };
  return game.players[playerId].lanes[lane]!.creature!;
}

function toHand(game: GameState, playerId: PlayerId, key: string) {
  const card = takeCard(game, playerId, key);
  game.players[playerId].hand.push(card);
  return card;
}

function setEvent(game: GameState, playerId: PlayerId, key: string) {
  game.players[playerId].event = takeCard(game, playerId, key) as GameState["players"][0]["event"] & object;
}

test("Deck 4 is selectable and always played in the Cold Biome", () => {
  assert.ok("deck-4" in DECKS);
  assert.equal(DECK_INFO["deck-4"].biome, "cold");
  assert.equal(DECK_4_DECK.length, 40);
  assert.ok(DECK_4_DECK.every((card) => card.status === "Locked"));
  assert.ok(DECK_KEYS.includes("deck-4"), "setup offers it");
  assert.equal(deckBiome("deck-4"), "cold");
  const game = createGame("A", "B", [deckBiome("deck-4"), deckBiome("deck-1")], ["deck-4", "deck-1"], { seed: 3 });
  assert.equal(game.players[0].biome.key, "cold");
});

test("Ice Age: Paleogene, Neogene and Quaternary Synapsids match every Time Period for overrides", () => {
  const game = readyGame();
  place(game, 0, 0, "hyaenodon");
  const smilodon = CARD_LIBRARY.get("smilodon") as CreatureCard;
  assert.equal(checkOverride(game, 0, smilodon, 0).matches.period, false, "Paleogene vs. Quaternary without Ice Age");
  setEvent(game, 1, "ice-age");
  const withIceAge = checkOverride(game, 0, smilodon, 0);
  assert.equal(withIceAge.matches.period, true, "either player's Ice Age counts");
  assert.match(withIceAge.explanations!.period, /Ice Age/);
  // Not between older Synapsids: Lystrosaurus is Permian, Thrinaxodon Triassic.
  const older = readyGame();
  setEvent(older, 0, "ice-age");
  place(older, 0, 0, "lystrosaurus");
  assert.equal(checkOverride(older, 0, CARD_LIBRARY.get("thrinaxodon") as CreatureCard, 0).matches.period, false);
});

test("Ice Age: Cambrian, Triassic, Jurassic and Cretaceous Creatures contribute 1 less Victory Level", () => {
  const game = readyGame();
  const jurassic = place(game, 0, 0, "hyaenodon", { period: "Jurassic", printedLevel: 2, tags: [] });
  const sail = place(game, 0, 1, "hyaenodon", { period: "Cretaceous", printedLevel: 2, tags: ["Spinal Sail"] });
  const quaternary = place(game, 1, 0, "steppe-bison");
  assert.equal(cardVictoryLevel(game, jurassic), 2);
  setEvent(game, 1, "ice-age");
  assert.equal(cardVictoryLevel(game, jurassic), 1);
  assert.equal(cardVictoryLevel(game, sail), 2, "Spinal Sail takes 1 off an Event's Victory Level decrease");
  assert.equal(cardVictoryLevel(game, quaternary), 1, "younger Creatures are unaffected");
});

test("Ice Age leaving its owner's Event Zone silences their Victory Levels through their third turn after", () => {
  let game = readyGame();
  setEvent(game, 0, "ice-age");
  const bison = place(game, 0, 0, "steppe-bison");
  const rival = place(game, 1, 0, "steppe-bison");
  // Replacing it with another Continuous Event is one way it leaves; this turn is 3, so the third is Turn 9.
  const superpredators = toHand(game, 0, "superpredators");
  game = applyAction(game, { type: "playEvent", cardUid: superpredators.uid });
  assert.equal(game.players[0].iceAgeAftermathThroughTurn, 9);
  const at = (turnNumber: number) => {
    const copy = structuredClone(game);
    copy.turnNumber = turnNumber;
    return copy;
  };
  assert.equal(cardVictoryLevel(at(9), at(9).players[0].lanes[0]!.creature!), 0);
  assert.equal(cardVictoryLevel(at(10), at(10).players[0].lanes[0]!.creature!), bison.card.definition.printedLevel);
  assert.equal(cardVictoryLevel(game, game.players[1].lanes[0]!.creature!), rival.card.definition.printedLevel);
});

test("PETM needs a Level 0 or 1 Creature on the board to send to History", () => {
  const game = readyGame();
  const petm = toHand(game, 0, "paleocene-eocene-thermal-maximum");
  place(game, 1, 0, "mastodon");
  assert.equal(explainEvent(game, petm).legal, false);
  place(game, 1, 1, "steppe-bison");
  assert.equal(explainEvent(game, petm).legal, true);
});

test("PETM on your own Creature searches for up to two that share two of its taxa after its Primary Taxon", () => {
  let game = readyGame();
  const petm = toHand(game, 0, "paleocene-eocene-thermal-maximum");
  place(game, 0, 0, "pakicetus");
  place(game, 1, 0, "steppe-bison");
  game = applyAction(game, { type: "playEvent", cardUid: petm.uid });
  assert.deepEqual(
    getConceptChoiceOptions(game).map((option) => option.id),
    ["0:0", "1:0"],
    "Level 0 and 1 Creatures on either side",
  );
  game = applyAction(game, { type: "chooseConceptOption", optionId: "0:0" });
  assert.equal(game.players[0].lanes[0]!.creature, null);
  // Pakicetus's taxa after Synapsid: Mammal, Artiodactyl, Cetacean, Pakicetid.
  const keys = getConceptChoiceOptions(game)
    .map((option) => game.players[0].deck.find((card) => card.uid === option.id)?.definition.key ?? option.id)
    .sort();
  assert.ok(keys.includes("ambulocetus") && keys.includes("basilosaurus") && keys.includes("hippopotamus"));
  assert.ok(!keys.includes("mastodon"), "Mammal alone is one shared taxon, not two");
  const first = getConceptChoiceOptions(game).find((option) => option.label === "Ambulocetus")!;
  game = applyAction(game, { type: "chooseConceptOption", optionId: first.id });
  const second = getConceptChoiceOptions(game).find((option) => option.label === "Orca")!;
  game = applyAction(game, { type: "chooseConceptOption", optionId: second.id });
  assert.equal(game.pendingConceptChoice, null, "two searches end it");
  assert.ok(["ambulocetus", "orca"].every((key) => game.players[0].hand.some((card) => card.definition.key === key)));
  assert.ok(game.players[0].history.some((card) => card.definition.key === "paleocene-eocene-thermal-maximum"));
});

test("PETM on an opponent's Creature sends your own Event to History, starting Ice Age's aftermath", () => {
  let game = readyGame();
  setEvent(game, 0, "ice-age");
  const petm = toHand(game, 0, "paleocene-eocene-thermal-maximum");
  place(game, 1, 2, "glyptodon");
  game = applyAction(game, { type: "playEvent", cardUid: petm.uid });
  game = applyAction(game, { type: "chooseConceptOption", optionId: "1:2" });
  assert.equal(game.players[1].lanes[2]!.creature, null);
  assert.equal(game.players[0].event, null);
  assert.ok(game.players[0].history.some((card) => card.definition.key === "ice-age"));
  assert.equal(game.players[0].iceAgeAftermathThroughTurn, 9);
  assert.equal(game.pendingConceptChoice, null);
});

test("Feedback Loops searches for a card it names, and returns from History when you send one", () => {
  let game = readyGame();
  const loops = toHand(game, 0, "feedback-loops");
  game = applyAction(game, { type: "playConcept", cardUid: loops.uid });
  const named = getConceptChoiceOptions(game).map((option) => option.label);
  assert.ok(named.length > 0);
  assert.ok(
    named.every((name) =>
      ["Ice Age", "Paleocene–Eocene Thermal Maximum", "Drought", "Snowball Earth", "The Great Dying"].includes(name),
    ),
  );
  game = applyAction(game, { type: "chooseConceptOption", optionId: getConceptChoiceOptions(game)[0]!.id });
  assert.equal(game.pendingConceptChoice, null);
  assert.ok(game.players[0].history.some((card) => card.definition.key === "feedback-loops"));

  const drought = game.players[0].hand.find((card) => card.definition.name === "Drought") ?? toHand(game, 0, "drought");
  assert.ok(feedbackLoopsReturnCards(game).some((card) => card.uid === drought.uid));
  game = applyAction(game, { type: "returnFeedbackLoops", cardUid: drought.uid });
  assert.ok(game.players[0].hand.some((card) => card.definition.key === "feedback-loops"));
  assert.ok(game.players[0].history.some((card) => card.uid === drought.uid));
  assert.equal(feedbackLoopsReturnCards(game).length, 0, "it is back in hand, so it can't return again");
});

/** Freezes a lane on both sides through `throughTurn`, as Snowball Earth does to the edge lanes. */
function freeze(game: GameState, laneIndex: number, throughTurn: number) {
  for (const player of game.players) player.lanes[laneIndex]!.frozenUntilTurn = throughTurn;
}

test("Underwool: the cold-steppe Creatures and the Bactrian Camel carry it", () => {
  for (const key of ["woolly-mammoth", "woolly-rhino", "steppe-bison", "bactrian-camel"]) {
    assert.ok((CARD_LIBRARY.get(key) as CreatureCard).tags.includes("Underwool"), key);
  }
});

test("Underwool Creatures enter an empty Frozen Niche at 1 Level lower; the Mammoth can't", () => {
  const game = readyGame();
  freeze(game, 0, 5);
  const bison = toHand(game, 0, "steppe-bison");
  const rhino = toHand(game, 0, "woolly-rhino");
  const mammoth = toHand(game, 0, "woolly-mammoth");
  const pakicetus = toHand(game, 0, "pakicetus");
  assert.ok(legalCreatureLanes(game, 0, bison).includes(0), "Level 1 counts as 0");
  assert.ok(legalCreatureLanes(game, 0, rhino).includes(0), "Level 2 counts as 1");
  assert.ok(!legalCreatureLanes(game, 0, mammoth).includes(0), "Level 3 counts as 2, too high for an empty Niche");
  assert.ok(!legalCreatureLanes(game, 0, pakicetus).includes(0), "without Underwool, Frozen locks the Niche");
  assert.ok(!legalCreatureLanes(game, 1 as PlayerId, rhino).includes(0), "only on its own side");
});

test("Underwool: next turn the Mammoth may override a Creature in the still-Frozen Niche; others can't", () => {
  let game = readyGame();
  freeze(game, 0, 7);
  const rhino = toHand(game, 0, "woolly-rhino");
  game = applyAction(game, { type: "playCreature", cardUid: rhino.uid, laneIndex: 0 });
  assert.equal(game.players[0].lanes[0]!.creature?.card.definition.key, "woolly-rhino");
  assert.equal(
    cardVictoryLevel(game, game.players[0].lanes[0]!.creature!),
    2,
    "Underwool keeps its Victory Levels while Frozen",
  );

  game.turnNumber = 5;
  game.activePlayer = 0;
  game.phase = "development";
  game.players[0].allowances = emptyAllowances();
  const mammoth = toHand(game, 0, "woolly-mammoth");
  const mastodon = toHand(game, 0, "mastodon");
  const check = checkOverride(game, 0, mammoth.definition as CreatureCard, 0);
  assert.ok(check.legal, check.reasons.join(" "));
  assert.match(check.explanations!.level, /Underwool/);
  assert.ok(legalCreatureLanes(game, 0, mammoth).includes(0));
  assert.ok(
    !legalCreatureLanes(game, 0, mastodon).includes(0),
    "a Creature without Underwool can't override into the ice",
  );
});

test("A Frozen Creature without Underwool still contributes no Victory Levels", () => {
  const game = readyGame();
  freeze(game, 4, 5);
  const bison = place(game, 0, 4, "steppe-bison", { tags: ["Herd"] });
  assert.equal(cardVictoryLevel(game, bison), 0);
});

test("Deck 4 swaps Thrinaxodon for the Bactrian Camel, and the Steppe Bison gains Circle Defense", () => {
  assert.ok(!DECK_4_DECK.some((card) => card.key === "thrinaxodon"));
  const camel = DECK_4_DECK.find((card) => card.key === "bactrian-camel") as CreatureCard;
  assert.equal(camel.printedLevel, 1);
  assert.deepEqual(camel.tags, ["Herd", "Underwool", "Retention"]);
  assert.deepEqual((CARD_LIBRARY.get("steppe-bison") as CreatureCard).tags, ["Underwool", "Circle Defense"]);
});

test("Circle Defense counts as Herd and Bastion, so a Steppe Bison entering play searches for a Herd Creature", () => {
  const bison = CARD_LIBRARY.get("steppe-bison") as CreatureCard;
  assert.ok(effectiveHasTag(bison, "Herd") && effectiveHasTag(bison, "Bastion"));
  let game = readyGame();
  const card = toHand(game, 0, "steppe-bison");
  game = applyAction(game, { type: "playCreature", cardUid: card.uid, laneIndex: 1 });
  assert.ok(game.pendingHerd, "its Herd triggers");
});

test("Circle Defense: +100 per friendly Herd Creature, −50 per other opposing Carnivore (−100 for a Pack Hunter), never below 0", () => {
  const game = readyGame();
  const bison = place(game, 0, 1, "steppe-bison");
  place(game, 0, 3, "woolly-mammoth"); // a second Herd Creature
  const hunter = place(game, 1, 1, "smilodon");
  const at = () => inspectBattlePower(game, bison.card.uid, "defender", hunter.card.uid);
  assert.equal(at(), 100 + 200, "Level 1, plus two Herd Creatures");
  place(game, 1, 0, "hyaenodon"); // another Carnivore
  assert.equal(at(), 100 + 200 - 50);
  place(game, 1, 2, "dire-wolf"); // a Pack Hunter
  assert.equal(at(), 100 + 200 - 50 - 100);
  place(game, 1, 3, "orca"); // a Pack Hunter too
  place(game, 1, 4, "basilosaurus");
  assert.equal(at(), 100, "the bonus never goes below 0");
});

test("Circle Defense applies every Hunt and shields Level 0–1 neighbours at any Level", () => {
  const game = readyGame();
  const bison = place(game, 0, 1, "steppe-bison");
  bison.bastionDefendedTurn = game.turnNumber; // already Hunted this turn
  const neighbour = place(game, 0, 2, "castoroides", { tags: [] });
  const hunter = place(game, 1, 1, "smilodon");
  assert.equal(inspectBattlePower(game, bison.card.uid, "defender", hunter.card.uid), 200, "still +100 for itself");
  assert.equal(
    inspectBattlePower(game, neighbour.card.uid, "defender", hunter.card.uid),
    200,
    "Level 1 + 100 from its Level 1 neighbour",
  );
});

test("Apex Predator: an Omnivore with it also Hunts as a Carnivore, so it may Hunt Omnivores", () => {
  const game = readyGame();
  game.phase = "battle";
  const bear = place(game, 0, 0, "arctotherium");
  const plainOmnivore = place(game, 0, 1, "arctotherium", { tags: [] });
  const omnivorePrey = place(game, 1, 3, "arctotherium", { tags: [], printedLevel: 1 });
  assert.ok(legalAttackTargets(game, bear.card.uid).includes(omnivorePrey.card.uid));
  assert.ok(
    !legalAttackTargets(game, plainOmnivore.card.uid).includes(omnivorePrey.card.uid),
    "a plain Omnivore can't",
  );
});

test("Circle Defense counts an Omnivore with Apex Predator as a Carnivore", () => {
  const game = readyGame();
  const bison = place(game, 0, 1, "steppe-bison");
  const hunter = place(game, 1, 1, "smilodon");
  place(game, 1, 2, "arctotherium");
  assert.equal(inspectBattlePower(game, bison.card.uid, "defender", hunter.card.uid), 100 + 100 - 50);
});

test("Apex Predator: an Omnivore with it is Hunted as a Carnivore, so only Diet-waiving effects reach it", () => {
  const game = readyGame();
  game.phase = "battle";
  const smilodon = place(game, 0, 0, "smilodon");
  const omnivore = place(game, 0, 1, "arctotherium", { tags: [] });
  const bear = place(game, 1, 3, "arctotherium");
  assert.ok(!legalAttackTargets(game, smilodon.card.uid).includes(bear.card.uid), "a Carnivore can't Hunt it");
  assert.ok(!legalAttackTargets(game, omnivore.card.uid).includes(bear.card.uid), "nor can an Omnivore");
  const plainBear = place(game, 1, 2, "arctotherium", { tags: [] });
  assert.ok(
    legalAttackTargets(game, smilodon.card.uid).includes(plainBear.card.uid),
    "without Apex Predator it can be",
  );
});
