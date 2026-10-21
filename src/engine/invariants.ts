import { DECKS } from "../data/cards.ts";
import { LANE_COUNT } from "./core.ts";
import type { CardInstance, GameState, PlayerId } from "./types.ts";

/** Every card instance currently anywhere in the game, including cards mid-resolution. */
function everyCard(state: GameState): CardInstance[] {
  const cards: CardInstance[] = [];
  for (const player of state.players) {
    cards.push(...player.deck, ...player.hand, ...player.history);
    if (player.event) cards.push(player.event);
    for (const lane of player.lanes) {
      if (lane.creature) cards.push(lane.creature.card);
      if (lane.attachment) cards.push(lane.attachment);
      if (lane.engulfed) cards.push(lane.engulfed);
      if (lane.wildfire) cards.push(lane.wildfire.card);
      if (lane.drought) cards.push(lane.drought.card);
    }
  }
  if (state.pendingConceptChoice) cards.push(state.pendingConceptChoice.card);
  if (state.pendingGeologicalBoundary) cards.push(state.pendingGeologicalBoundary.card);
  return cards;
}

/**
 * Structural invariants that must hold after every transition. Returns a list
 * of violations (empty when the state is sound). Used by the simulation tests,
 * and cheap enough to run in development builds after every action.
 */
export function checkInvariants(state: GameState): string[] {
  const problems: string[] = [];
  const cards = everyCard(state);

  const seen = new Set<string>();
  for (const card of cards) {
    if (seen.has(card.uid)) problems.push(`Card ${card.uid} exists in more than one place.`);
    seen.add(card.uid);
  }
  for (const playerId of [0, 1] as PlayerId[]) {
    const player = state.players[playerId];
    const owned = cards.filter((card) => card.owner === playerId).length;
    const expected = DECKS[player.deckKey].length;
    if (owned !== expected) problems.push(`${player.name} owns ${owned} cards in play; expected ${expected}.`);
    if (player.lanes.length !== LANE_COUNT) problems.push(`${player.name} has ${player.lanes.length} Niches.`);
    player.lanes.forEach((lane, index) => {
      if (lane.creature && lane.creature.card.owner !== playerId) {
        problems.push(`${player.name}'s Niche ${index + 1} holds a Creature owned by the opponent.`);
      }
      if (lane.creature && (lane.wildfire || lane.drought)) {
        problems.push(`${player.name}'s Niche ${index + 1} holds a Creature and a Niche Event at once.`);
      }
      if ((lane.attachment || lane.engulfed) && !lane.creature) {
        problems.push(`${player.name}'s Niche ${index + 1} has an occupied Adaptation Slot but no Creature.`);
      }
      if (lane.attachment && lane.engulfed) {
        problems.push(`${player.name}'s Niche ${index + 1} has both an Adaptation and an Engulfed Creature.`);
      }
    });
  }
  if ((state.winner !== null) !== (state.phase === "game-over")) {
    problems.push(`Winner is ${state.winner} but phase is ${state.phase}.`);
  }
  if (state.handoff && state.phase !== "handoff")
    problems.push(`A handoff is pending during the ${state.phase} phase.`);
  return problems;
}
