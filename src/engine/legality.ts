import {
  islandDwarfismBlocksEntry,
  laneIsLocked,
  nicheIsLocked,
  otherPlayer,
  playerHolds,
  resolutionBlocked,
  isGameOver,
} from "./core.ts";
import { checkOverride } from "./override.ts";
import type { CardInstance, GameState, OverrideCheck, PlacementVerdict, PlayerId, Reason } from "./types.ts";

/**
 * Creature placement verdicts. These are the single source of truth for where
 * a Creature may be played: `legalCreatureLanes` and `legalAquaticOverrideLanes`
 * are derived from them, so an explanation can never disagree with the rules.
 */

const reason = (code: string, text: string): Reason => ({ code, text });

function verdict(reasons: Reason[], override: OverrideCheck | null = null): PlacementVerdict {
  return { legal: reasons.length === 0, reasons, override, hints: [] };
}

/** Reasons the player can't take any Development Phase action right now. */
export function developmentGate(state: GameState, playerId: PlayerId): Reason[] {
  if (isGameOver(state)) return [reason("game-over", "The game is over.")];
  if (state.activePlayer !== playerId) return [reason("not-your-turn", "It isn't your turn.")];
  if (resolutionBlocked(state)) return [reason("pending-choice", "Finish the choice in progress first.")];
  if (state.phase !== "development") {
    return [reason("wrong-phase", "Cards are played during your Development Phase.")];
  }
  return [];
}

/** Why a Creature can't enter this Niche at all, regardless of what occupies it. */
export function entryBlockers(state: GameState, playerId: PlayerId, laneIndex: number): Reason[] {
  if (laneIsLocked(state, laneIndex)) return [reason("wildfire", "Wildfire locks this entire lane.")];
  if (nicheIsLocked(state, playerId, laneIndex)) return [reason("drought", "Drought locks this Niche.")];
  if (islandDwarfismBlocksEntry(state, playerId, laneIndex)) {
    return [
      reason("island-dwarfism-adjacent", "Island Dwarfism next door prevents a Creature from entering this Niche."),
    ];
  }
  return [];
}

const AQUATIC_LANE_USED = reason("aquatic-lane-used", "You used the free override in this Niche this turn.");

/** Whether `card` may be played into `laneIndex` with the normal Creature play (or an extra play). */
export function explainCreatureLane(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  laneIndex: number,
): PlacementVerdict {
  const gate = developmentGate(state, playerId);
  if (gate.length) return verdict(gate);
  if (card.definition.kind !== "creature") return verdict([reason("not-a-creature", "Only Creatures fill Niches.")]);
  const player = state.players[playerId];
  if (!playerHolds(player, card.uid)) return verdict([reason("not-in-hand", "That card isn't in your hand.")]);
  const creature = card.definition;
  const lane = player.lanes[laneIndex]!;
  const allowances = player.allowances;

  // Rapid Speciation: the next Creature must override exactly two Levels up.
  if (allowances.rapidSpeciation) {
    if (nicheIsLocked(state, playerId, laneIndex)) return verdict(entryBlockers(state, playerId, laneIndex));
    if (allowances.aquaticOverrideLockedLane === laneIndex) return verdict([AQUATIC_LANE_USED]);
    if (!lane.creature) {
      return verdict([reason("rapid-needs-occupied", "Rapid Speciation must override an occupied Niche.")]);
    }
    const override = checkOverride(state, playerId, creature, laneIndex, true);
    return verdict(override.legal ? [] : override.blockers, override);
  }

  const opportunistActive =
    creature.tags.includes("Opportunist") &&
    state.players[otherPlayer(playerId)].event?.definition.eventType === "continuous";
  const extraPlay = allowances.creaturePlayed;
  if (extraPlay && !creature.tags.includes("Propulsion") && !opportunistActive) {
    return verdict([reason("creature-already-played", "You've already played a Creature this turn.")]);
  }

  const blockedEntry = entryBlockers(state, playerId, laneIndex);
  if (blockedEntry.length) return verdict(blockedEntry);

  if (!lane.creature) {
    const reasons: Reason[] = [];
    if (creature.printedLevel > 1) {
      reasons.push(
        reason(
          "empty-needs-low-level",
          `Empty Niches take only Level 0 or 1 Creatures; ${creature.name} is Level ${creature.printedLevel}.`,
        ),
      );
    }
    // The normal play may fill only one empty Niche per turn; Propulsion and Opportunist extra plays may fill another.
    if (!extraPlay && allowances.filledEmpty) {
      reasons.push(reason("already-filled-empty", "You've already filled an empty Niche this turn."));
    }
    return verdict(reasons);
  }

  const override = checkOverride(state, playerId, creature, laneIndex);
  const reasons: Reason[] = [];
  if (allowances.aquaticOverrideLockedLane === laneIndex) reasons.push(AQUATIC_LANE_USED);
  if (extraPlay) {
    if (!opportunistActive) {
      reasons.push(reason("propulsion-empty-only", "Propulsion's extra play can only fill an empty Niche."));
    } else if (creature.printedLevel !== 1 && creature.printedLevel !== 2) {
      reasons.push(reason("opportunist-level", "Opportunist's extra override works only for Level 1 or 2 Creatures."));
    }
  }
  if (!override.legal) reasons.push(...override.blockers);
  return verdict(reasons, override);
}

/** Whether `card` may use the Aquatic Biome's once-per-game free override in `laneIndex`. */
export function explainAquaticOverrideLane(state: GameState, card: CardInstance, laneIndex: number): PlacementVerdict {
  const playerId = state.activePlayer;
  const gate = developmentGate(state, playerId);
  if (gate.length) return verdict(gate);
  const player = state.players[playerId];
  const biome = player.biome;
  if (biome.key !== "aquatic")
    return verdict([reason("no-aquatic-biome", "Only the Aquatic Biome has a free override.")]);
  if (!biome.waterwaysConnected || biome.freeOverrideUsed) {
    return verdict([reason("free-override-used", "You've already used your free override this game.")]);
  }
  if (player.allowances.rapidSpeciation) {
    return verdict([reason("rapid-pending", "Resolve Rapid Speciation's override first.")]);
  }
  if (card.definition.kind !== "creature") return verdict([reason("not-a-creature", "Only Creatures fill Niches.")]);
  if (!playerHolds(player, card.uid)) return verdict([reason("not-in-hand", "That card isn't in your hand.")]);
  const lane = player.lanes[laneIndex]!;
  if (!lane.creature) {
    return verdict([reason("aquatic-needs-occupied", "The free override must replace a Creature already in play.")]);
  }
  if (nicheIsLocked(state, playerId, laneIndex)) return verdict(entryBlockers(state, playerId, laneIndex));
  if (player.allowances.overriddenLanes.includes(laneIndex)) {
    return verdict([reason("lane-already-overridden", "You already overrode this Niche this turn.")]);
  }
  const override = checkOverride(state, playerId, card.definition, laneIndex);
  return verdict(override.legal ? [] : override.blockers, override);
}
