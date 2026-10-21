import { type CreatureCard, tagEffectMultiplier } from "../data/cards.ts";
import {
  activeCambrianExplosions,
  addLog,
  allCreatures,
  effectiveHasTag,
  findCreature,
  otherPlayer,
  VICTORY_THRESHOLD,
} from "./core.ts";
import type { CreatureInPlay, GameState, PlayerId } from "./types.ts";

function isStegosaur(definition: CreatureCard) {
  return definition.taxa.includes("Stegosaur") || definition.taxa.includes("Stegosaurid");
}

/** The Victory Levels a Creature in play currently contributes. */
export function cardVictoryLevel(state: GameState, creature: CreatureInPlay) {
  const definition = creature.card.definition;
  let value = definition.printedLevel;
  if (definition.tags.includes("Apex Predator")) {
    const apexCount = allCreatures(state).filter((entry) =>
      entry.card.definition.tags.includes("Apex Predator"),
    ).length;
    const otherApexPredators = Math.max(0, apexCount - 1);
    const protectedDecrease = definition.tags.includes("Spinal Sail")
      ? Math.max(0, otherApexPredators - 1)
      : otherApexPredators;
    value += Math.max(0, 2 - protectedDecrease);
  }
  if (effectiveHasTag(definition, "Gigantic")) value += tagEffectMultiplier(definition, "Gigantic");
  if (definition.printedLevel === 0) value += activeCambrianExplosions(state);

  const found = findCreature(state, creature.card.uid);
  if (found?.lane.engulfed) value += tagEffectMultiplier(definition, "Engulf");
  if (found?.lane.attachment?.definition.key === "thagomizer" && isStegosaur(definition)) value += 1;
  if (found?.lane.attachment?.definition.key === "island-dwarfism") {
    value += effectiveHasTag(definition, "Gigantic") ? 2 : 1;
  }
  if (found && state.players[otherPlayer(found.playerId)].lanes[found.laneIndex]!.drought) {
    value -= definition.tags.includes("Spinal Sail") ? 0 : 1;
  }

  return Math.max(0, value);
}

export function victoryTotals(state: GameState): [number, number] {
  const total = (playerId: PlayerId) =>
    state.players[playerId].lanes.reduce(
      (sum, lane) => sum + (lane.creature ? cardVictoryLevel(state, lane.creature) : 0),
      0,
    );
  return [total(0), total(1)];
}

/**
 * Ends the game if either player has reached the Victory threshold. When both
 * have, the higher total wins; an exact tie at or above the threshold continues.
 */
export function resolveVictoryThreshold(state: GameState) {
  const totals = victoryTotals(state);
  let winner: PlayerId | null = null;
  if (totals[0] >= VICTORY_THRESHOLD && totals[1] >= VICTORY_THRESHOLD) {
    if (totals[0] > totals[1]) winner = 0;
    if (totals[1] > totals[0]) winner = 1;
  } else if (totals[0] >= VICTORY_THRESHOLD) winner = 0;
  else if (totals[1] >= VICTORY_THRESHOLD) winner = 1;

  if (winner === null) return false;
  state.winner = winner;
  state.winReason = `${state.players[winner].name} reached ${totals[winner]} Victory Levels.`;
  state.phase = "game-over";
  state.handoff = null;
  addLog(state, `${state.players[winner].name} won with ${totals[winner]} Victory Levels.`);
  return true;
}
