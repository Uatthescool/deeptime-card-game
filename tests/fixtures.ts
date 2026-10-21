import {
  applyAction,
  type CardInstance,
  createGame,
  type CreatureInPlay,
  type CreatureInstance,
  type EventInstance,
  type GameState,
  listLegalActions,
  type PlayerId,
} from "../src/engine/index.ts";

/** Removes a card (by key) from a player's deck or hand. */
export function takeFromLibrary(state: GameState, playerId: PlayerId, key: string): CardInstance {
  const player = state.players[playerId];
  const card = [...player.deck, ...player.hand].find((entry) => entry.definition.key === key);
  if (!card) throw new Error(`Player ${playerId} has no ${key}.`);
  player.deck = player.deck.filter((entry) => entry !== card);
  player.hand = player.hand.filter((entry) => entry !== card);
  return card;
}

export function inPlay(card: CardInstance, enteredTurn = 0): CreatureInPlay {
  return {
    card: card as CreatureInstance,
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
    deimaticProtectedThroughTurn: null,
    bastionDefendedTurn: null,
    bastionAttackedTurn: null,
    facultativeMovedTurn: null,
  };
}

/**
 * A previewed Hunt that needs one evasion coin: Allosaurus (allowed to Hunt a
 * Carnivore by Superpredators) attacks an Elusive Microraptor. Both players
 * are Temperate, so the defender may reroll.
 */
export function elusiveHunt(): GameState {
  const state = createGame("A", "B", ["temperate", "temperate"], ["deck-1", "deck-1"], { seed: 3 });
  Object.assign(state, { activePlayer: 0, turnNumber: 3, phase: "battle", handoff: null });
  state.players[0].lanes[0]!.creature = inPlay(takeFromLibrary(state, 0, "allosaurus"));
  state.players[1].lanes[0]!.creature = inPlay(takeFromLibrary(state, 1, "microraptor"));
  state.players[0].event = takeFromLibrary(state, 0, "superpredators") as EventInstance;
  const hunt = listLegalActions(state).find((action) => action.type === "previewHunt");
  if (!hunt) throw new Error("Allosaurus should be able to Hunt Microraptor.");
  return applyAction(state, hunt);
}
