import { test } from "vitest";
import assert from "node:assert/strict";

import {
  CARD_LIBRARY,
  type CreatureCard,
  DECK_5,
  DECK_5_DECK,
  DECKS,
  GENERAL_POOL,
  IMPLEMENTATION_REGISTER,
} from "../../src/data/cards.ts";
import { sendCardToHistory, sendCreatureToHistory } from "../../src/engine/core.ts";
import {
  actingPlayer,
  applyAction,
  createGame,
  DECLINE_DEAD_END,
  emptyAllowances,
  getDeadEndOptions,
  listLegalActions,
  pendingDeadEnd,
  type CardInstance,
  type GameState,
  type PlayerId,
} from "../../src/engine/index.ts";
import { typeLabel } from "../../src/ui/inspection.ts";

function readyGame(): GameState {
  const game = createGame("Alpha", "Beta", [null, null], ["deck-4", "deck-4"], { seed: 11 });
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
    player.history = [];
    player.allowances = emptyAllowances();
  }
  return game;
}

let made = 0;
/** Takes a card out of a player's deck or hand, or makes one from the card library. */
function takeCard(game: GameState, playerId: PlayerId, key: string): CardInstance {
  const player = game.players[playerId];
  for (const zone of [player.hand, player.deck]) {
    const index = zone.findIndex((card) => card.definition.key === key);
    if (index >= 0) return zone.splice(index, 1)[0]!;
  }
  made += 1;
  return { uid: `${playerId}-made-${key}-${made}`, owner: playerId, definition: CARD_LIBRARY.get(key)! };
}

const toHand = (game: GameState, playerId: PlayerId, key: string) => {
  const card = takeCard(game, playerId, key);
  game.players[playerId].hand.push(card);
  return card;
};
const toHistory = (game: GameState, playerId: PlayerId, key: string) => {
  const card = takeCard(game, playerId, key);
  game.players[playerId].history.push(card);
  return card;
};

function place(game: GameState, playerId: PlayerId, lane: number, key: string) {
  const card = takeCard(game, playerId, key) as CardInstance & { definition: CreatureCard };
  game.players[playerId].lanes[lane]!.creature = {
    card,
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
  return card;
}

test("Dead End is a Tag with a rule, on Smilodon, Ambopteryx and Weigeltisaurus", () => {
  assert.match(IMPLEMENTATION_REGISTER.tagRules["Dead End"]!, /once per turn/);
  for (const key of ["smilodon", "ambopteryx", "weigeltisaurus"]) {
    assert.ok((CARD_LIBRARY.get(key) as CreatureCard).tags.includes("Dead End"), key);
  }
});

test("discarding a Dead End Creature as a cost returns a Concept, but never the one being played", () => {
  let game = readyGame();
  const selection = toHand(game, 0, "natural-selection");
  const smilodon = toHand(game, 0, "smilodon");
  const biogenesis = toHistory(game, 0, "biogenesis");
  game = applyAction(game, { type: "playConcept", cardUid: selection.uid });
  assert.equal(game.pendingConceptChoice?.kind, "natural-selection-cost");
  game = applyAction(game, { type: "chooseConceptOption", optionId: smilodon.uid });

  // Dead End resolves before Natural Selection's search continues.
  assert.deepEqual(pendingDeadEnd(game)?.conceptUids, [biogenesis.uid]);
  const options = getDeadEndOptions(game).map((option) => option.id);
  assert.deepEqual(options, [biogenesis.uid, DECLINE_DEAD_END]);
  assert.ok(listLegalActions(game).every((action) => action.type === "chooseDeadEnd"));
  const blocked = applyAction(game, { type: "chooseConceptOption", optionId: "anything" });
  assert.equal(blocked, game, "nothing else resolves while Dead End waits");

  game = applyAction(game, { type: "chooseDeadEnd", optionId: biogenesis.uid });
  assert.equal(pendingDeadEnd(game), null);
  assert.ok(game.players[0].hand.some((card) => card.uid === biogenesis.uid));
  assert.ok(!game.players[0].history.some((card) => card.uid === biogenesis.uid));
  assert.equal(game.pendingConceptChoice?.kind, "natural-selection-search", "Natural Selection then carries on");
});

test("Dead End triggers once per turn, and only when there is a Concept to choose", () => {
  const game = readyGame();
  const first = place(game, 0, 0, "smilodon");
  const second = place(game, 0, 1, "ambopteryx");
  sendCreatureToHistory(game, 0, 0, "battle");
  assert.equal(pendingDeadEnd(game), null, "no Concept in History: nothing to choose");
  assert.equal(game.players[0].deadEndUsedTurn ?? null, null, "and the once-per-turn use isn't spent");

  toHistory(game, 0, "genetic-drift");
  sendCreatureToHistory(game, 0, 1, "effect");
  assert.equal(pendingDeadEnd(game)?.sourceName, "Ambopteryx");
  assert.equal(game.players[0].deadEndUsedTurn, 3);

  game.deadEndQueue = [];
  sendCardToHistory(game, { ...first, uid: "again" });
  assert.equal(pendingDeadEnd(game), null, "a second Dead End this turn doesn't trigger");
  game.turnNumber = 4;
  sendCardToHistory(game, { ...second, uid: "next-turn" });
  assert.equal(pendingDeadEnd(game)?.playerId, 0, "it can trigger again next turn");
});

test("the owner of a Hunted Dead End Creature chooses, even on the other player's turn, and may decline", () => {
  let game = readyGame();
  place(game, 1, 2, "smilodon");
  toHistory(game, 1, "whale-fall");
  sendCreatureToHistory(game, 1, 2, "battle");
  assert.equal(actingPlayer(game), 1);
  game = applyAction(game, { type: "chooseDeadEnd", optionId: DECLINE_DEAD_END });
  assert.equal(pendingDeadEnd(game), null);
  assert.ok(
    game.players[1].history.some((card) => card.definition.key === "whale-fall"),
    "nothing returned",
  );
  assert.equal(actingPlayer(game), 0);
});

test("Deck 5 can be inspected but not selected, and shares four Deck 1 Creatures", () => {
  assert.equal("deck-5" in DECKS, false);
  assert.equal(DECK_5.length, 13);
  assert.equal(DECK_5_DECK.length, 13);
  const shared = ["microraptor", "hoatzin", "archaeopteryx", "pelagornis"];
  for (const card of DECK_5) {
    if (shared.includes(card.key)) assert.equal(card.status, "Locked", `${card.name} stays a playable Deck 1 card`);
    else assert.equal(card.status, "Not playable · Work in progress", card.name);
    assert.ok(CARD_LIBRARY.has(card.key));
  }
  assert.deepEqual((CARD_LIBRARY.get("archaeopteryx") as CreatureCard).tags, [
    "Small Game Hunter",
    "Divergent",
    "Aerial",
  ]);
});

test("the twelve Group Concepts wait in the General Pool; those without an effect show the placeholder", () => {
  const groups = GENERAL_POOL.filter((card) => card.kind === "concept" && card.group);
  assert.equal(groups.length, 12);
  const built = ["Parliament of Owls", "Kaleidoscope of Butterflies", "Dazzle of Zebras", "Tower of Giraffes"];
  for (const card of groups) {
    assert.equal(typeLabel(card), "Concept · Group");
    const placeholder = card.kind === "concept" && card.rules === "No card effect or flavor text at this time.";
    assert.equal(placeholder, !built.includes(card.name), card.name);
    assert.equal(card.status, "Not playable · Work in progress");
  }
  assert.ok(groups.some((card) => card.name === "Cauldron of Bats"));
});
