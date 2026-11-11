import { type CreatureCard, tagEffectMultiplier } from "../data/cards.ts";
import {
  activeCambrianExplosions,
  addLog,
  effectiveHasTag,
  findCreature,
  ICE_AGE_DIMINISHED_PERIODS,
  iceAgeInPlay,
  inIceAgeAftermath,
  nicheIsFrozen,
  otherPlayer,
  VICTORY_THRESHOLD,
} from "./core.ts";
import type { CreatureInPlay, GameState, PlayerId } from "./types.ts";

function isStegosaur(definition: CreatureCard) {
  return definition.taxa.includes("Stegosaur") || definition.taxa.includes("Stegosaurid");
}

/** One named contribution to a Creature's Victory Levels, for showing players where the total comes from. */
export type VictorySource = { label: string; amount: number };

/** The Victory Levels a Creature in play contributes, with every source that moved it from its Printed Level. */
export function victoryBreakdown(state: GameState, creature: CreatureInPlay) {
  const definition = creature.card.definition;
  const found = findCreature(state, creature.card.uid);
  const sources: VictorySource[] = [];
  if (found && nicheIsFrozen(found.lane) && !definition.tags.includes("Underwool")) {
    return {
      value: 0,
      sources: [{ label: "Frozen: contributes no Victory Levels", amount: -definition.printedLevel }],
    };
  }
  if (found && inIceAgeAftermath(state, found.playerId)) {
    const throughTurn = state.players[found.playerId].iceAgeAftermathThroughTurn;
    return {
      value: 0,
      sources: [
        {
          label: `Ice Age left play: contributes no Victory Levels through Turn ${throughTurn}`,
          amount: -definition.printedLevel,
        },
      ],
    };
  }
  let value = definition.printedLevel;
  const add = (label: string, amount: number) => {
    value += amount;
    if (amount !== 0) sources.push({ label, amount });
  };
  if (definition.tags.includes("Apex Predator")) {
    const apexCount = state.players
      .flatMap((player) => player.lanes)
      .filter((lane) => !nicheIsFrozen(lane) && lane.creature?.card.definition.tags.includes("Apex Predator")).length;
    const otherApexPredators = Math.max(0, apexCount - 1);
    const protectedDecrease = definition.tags.includes("Spinal Sail")
      ? Math.max(0, otherApexPredators - 1)
      : otherApexPredators;
    add("Apex Predator", Math.max(0, 2 - protectedDecrease));
  }
  if (effectiveHasTag(definition, "Gigantic")) add("Gigantic", tagEffectMultiplier(definition, "Gigantic"));
  if (definition.printedLevel === 0) add("Cambrian Explosion", activeCambrianExplosions(state));

  if (found?.lane.engulfed) add("Engulf", tagEffectMultiplier(definition, "Engulf"));
  if (found?.lane.attachment?.definition.key === "thagomizer" && isStegosaur(definition)) add("Thagomizer", 1);
  if (found?.lane.attachment?.definition.key === "island-dwarfism") {
    add("Island Dwarfism", effectiveHasTag(definition, "Gigantic") ? 2 : 1);
  }
  // Spinal Sail takes 1 off each Event's Victory Level decrease, so it ignores Ice Age's as it does Drought's.
  if (iceAgeInPlay(state) && ICE_AGE_DIMINISHED_PERIODS.has(definition.period)) {
    add("Ice Age", definition.tags.includes("Spinal Sail") ? 0 : -1);
  }
  if (found && state.players[otherPlayer(found.playerId)].lanes[found.laneIndex]!.drought) {
    add("Drought", definition.tags.includes("Spinal Sail") ? 0 : -1);
  }

  if (value < 0) sources.push({ label: "Can't fall below 0", amount: -value });
  return { value: Math.max(0, value), sources };
}

/** The Victory Levels a Creature in play currently contributes. */
export function cardVictoryLevel(state: GameState, creature: CreatureInPlay) {
  return victoryBreakdown(state, creature).value;
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
