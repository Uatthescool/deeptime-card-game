import { test } from "vitest";
import assert from "node:assert/strict";

import { CARD_LIBRARY, type CreatureCard, type DeckKey } from "../../src/data/cards.ts";
import {
  applyAction,
  createGame,
  emptyAllowances,
  getConceptChoiceOptions,
  listLegalActions,
  type CardInstance,
  type GameState,
  type PlayerId,
} from "../../src/engine/index.ts";
import { DECLINE_EXTRA_PLAY } from "../../src/engine/concepts.ts";

function readyGame(decks: [DeckKey, DeckKey] = ["deck-4", "deck-4"]): GameState {
  const game = createGame("Alpha", "Beta", [null, null], decks, { seed: 21 });
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

const inHistory = (game: GameState, playerId: PlayerId, uid: string) =>
  game.players[playerId].history.some((card) => card.uid === uid);

test("Parliament of Owls draws 3, shuffles one of them back and sends another to History", () => {
  let game = readyGame();
  const owls = toHand(game, 0, "parliament-of-owls");
  const handBefore = game.players[0].hand.length;
  const deckBefore = game.players[0].deck.length;
  game = applyAction(game, { type: "playConcept", cardUid: owls.uid });
  assert.equal(game.pendingConceptChoice?.kind, "owls-shuffle");
  const drawn = getConceptChoiceOptions(game).map((option) => option.id);
  assert.equal(drawn.length, 3, "only the three drawn cards are choices");

  game = applyAction(game, { type: "chooseConceptOption", optionId: drawn[0]! });
  assert.equal(game.pendingConceptChoice?.kind, "owls-history");
  assert.deepEqual(
    getConceptChoiceOptions(game).map((option) => option.id),
    drawn.slice(1),
  );
  game = applyAction(game, { type: "chooseConceptOption", optionId: drawn[1]! });

  assert.equal(game.pendingConceptChoice, null);
  assert.ok(
    game.players[0].deck.some((card) => card.uid === drawn[0]),
    "the first went back into the deck",
  );
  assert.ok(inHistory(game, 0, drawn[1]!), "the second went to History");
  assert.ok(
    game.players[0].hand.some((card) => card.uid === drawn[2]),
    "the third stays in hand",
  );
  assert.ok(inHistory(game, 0, owls.uid));
  assert.equal(game.players[0].hand.length, handBefore - 1 + 1, "one card ahead, less the Owls played");
  assert.equal(game.players[0].deck.length, deckBefore - 2);
});

test("Dazzle of Zebras shuffles the opponent's hand into their deck and they draw 3", () => {
  let game = readyGame();
  const zebras = toHand(game, 0, "dazzle-of-zebras");
  const opponent = game.players[1];
  while (opponent.hand.length < 6) opponent.hand.push(opponent.deck.shift()!);
  const total = opponent.hand.length + opponent.deck.length;
  const oldHand = opponent.hand.map((card) => card.uid);
  game = applyAction(game, { type: "playConcept", cardUid: zebras.uid });
  assert.equal(game.players[1].hand.length, 3);
  assert.equal(game.players[1].hand.length + game.players[1].deck.length, total, "no card is lost");
  assert.ok(
    oldHand.every(
      (uid) =>
        game.players[1].deck.some((card) => card.uid === uid) || game.players[1].hand.some((card) => card.uid === uid),
    ),
  );
  assert.ok(inHistory(game, 0, zebras.uid));
});

test("Kaleidoscope of Butterflies returns a Creature and replays it, then the Development Phase ends", () => {
  let game = readyGame(["deck-4", "deck-2"]);
  const glyptodon = place(game, 0, 0, "glyptodon");
  place(game, 0, 1, "saltasaurus");
  const butterflies = toHand(game, 0, "kaleidoscope-of-butterflies");
  game = applyAction(game, { type: "playConcept", cardUid: butterflies.uid });
  assert.equal(game.pendingConceptChoice?.kind, "butterflies-return");
  assert.deepEqual(
    getConceptChoiceOptions(game).map((option) => option.id),
    ["0"],
    "Graviportal Saltasaurus can't be returned by an effect",
  );

  game = applyAction(game, { type: "chooseConceptOption", optionId: "0" });
  const occupant = (state: GameState) => state.players[0].lanes[0]!.creature;
  assert.equal(occupant(game), null);
  assert.ok(game.players[0].hand.some((card) => card.uid === glyptodon.uid));
  assert.equal(game.pendingConceptChoice?.kind, "butterflies-replay");
  assert.ok(getConceptChoiceOptions(game).some((option) => option.id === DECLINE_EXTRA_PLAY));

  game = applyAction(game, { type: "chooseConceptOption", optionId: "0" });
  assert.equal(occupant(game)?.card.uid, glyptodon.uid);
  assert.equal(occupant(game)?.enteredTurn, 3, "it re-entered play this turn");
  assert.equal(game.players[0].allowances.creaturePlayed, false, "the extra play didn't use the normal play");
  assert.equal(game.phase, "battle", "the Development Phase ended");
  assert.ok(inHistory(game, 0, butterflies.uid));
});

test("Kaleidoscope of Butterflies can't be played without a Creature it could return", () => {
  const game = readyGame(["deck-4", "deck-2"]);
  place(game, 0, 1, "saltasaurus");
  const butterflies = toHand(game, 0, "kaleidoscope-of-butterflies");
  assert.ok(
    !listLegalActions(game).some((action) => action.type === "playConcept" && action.cardUid === butterflies.uid),
  );
});

test("Tower of Giraffes finds any Artiodactyl, whales included", () => {
  let game = readyGame();
  const giraffes = toHand(game, 0, "tower-of-giraffes");
  game = applyAction(game, { type: "playConcept", cardUid: giraffes.uid });
  assert.equal(game.pendingConceptChoice?.kind, "giraffes-search");
  const names = getConceptChoiceOptions(game).map((option) => option.label);
  assert.ok(names.includes("Blue Whale") && names.includes("Steppe Bison"));
  const whale = getConceptChoiceOptions(game).find((option) => option.label === "Blue Whale")!;
  game = applyAction(game, { type: "chooseConceptOption", optionId: whale.id });
  assert.equal(game.pendingConceptChoice, null, "no Overreach, so nothing more to do");
  assert.ok(game.players[0].hand.some((card) => card.uid === whale.id));
  assert.ok(inHistory(game, 0, giraffes.uid));
});

test("Tower of Giraffes may play an Artiodactyl with Overreach at once as an extra Creature play", () => {
  let game = readyGame();
  const pakicetus = game.players[0].deck.find((card) => card.definition.key === "pakicetus")!;
  pakicetus.definition = { ...(pakicetus.definition as CreatureCard), tags: ["Overreach"] };
  const giraffes = toHand(game, 0, "tower-of-giraffes");
  game = applyAction(game, { type: "playConcept", cardUid: giraffes.uid });
  game = applyAction(game, { type: "chooseConceptOption", optionId: pakicetus.uid });
  assert.equal(game.pendingConceptChoice?.kind, "giraffes-play");
  game = applyAction(game, { type: "chooseConceptOption", optionId: "2" });
  assert.equal(game.players[0].lanes[2]!.creature?.card.uid, pakicetus.uid);
  assert.equal(game.players[0].allowances.creaturePlayed, false, "the normal Creature play is still available");
  assert.equal(game.phase, "development");
});

test("Tower of Giraffes with no Artiodactyl in the deck just shuffles", () => {
  let game = readyGame(["deck-1", "deck-1"]);
  const giraffes = toHand(game, 0, "tower-of-giraffes");
  game = applyAction(game, { type: "playConcept", cardUid: giraffes.uid });
  assert.equal(game.pendingConceptChoice, null);
  assert.ok(inHistory(game, 0, giraffes.uid));
});
