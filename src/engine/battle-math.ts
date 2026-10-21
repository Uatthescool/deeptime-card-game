import { hasPrintedAquatic, tagEffectMultiplier } from "../data/cards.ts";
import {
  clone,
  effectiveHasTag,
  findCreature,
  hasNoAdjacentFriendly,
  otherPlayer,
  overrideTags,
  resolutionBlocked,
} from "./core.ts";
import type { BattleCoinPlan, BattlePreview, CreatureInPlay, FoundCreature, GameState, PlayerId } from "./types.ts";

/** Pure battle calculations: Hunt legality, Battle Levels, and Battle Coin plans. */

function activeSuperpredators(state: GameState) {
  return state.players.some((player) => player.event?.definition.key === "superpredators");
}

function hasCrypticCamouflage(state: GameState, creature: CreatureInPlay, laneIndex: number) {
  return state.players[creature.card.owner].lanes[laneIndex]?.attachment?.definition.key === "cryptic-camouflage";
}

export function creatureCanAttackTarget(
  state: GameState,
  attacker: CreatureInPlay,
  attackerLane: number,
  target: CreatureInPlay,
  targetLane: number,
  options: { ignoreDiet?: boolean; ignoreEntryTurn?: boolean } = {},
) {
  const attackerDef = attacker.card.definition;
  const targetDef = target.card.definition;
  if (attacker.lastAttackTurn === state.turnNumber) return false;
  if (attacker.cannotAttackOnTurn === state.turnNumber) return false;
  if (state.players[attacker.card.owner].lanes[attackerLane]?.engulfed) return false;
  if (hasCrypticCamouflage(state, attacker, attackerLane) && attackerDef.diet === "Herbivore") return false;
  if (
    attacker.enteredTurn === state.turnNumber &&
    !options.ignoreEntryTurn &&
    !attackerDef.tags.includes("Ambush") &&
    !attackerDef.tags.includes("Charge")
  ) {
    return false;
  }
  if (attackerDef.tags.includes("Elusive") && targetDef.printedLevel >= 1) return false;
  if (effectiveHasTag(targetDef, "Gigantic") && attackerDef.printedLevel <= 1) return false;
  if (target.burrowedUntilTurn !== null && state.turnNumber < target.burrowedUntilTurn) return false;
  if (
    state.activePlayer !== target.card.owner &&
    target.deimaticProtectedThroughTurn !== null &&
    state.turnNumber <= target.deimaticProtectedThroughTurn
  ) {
    return false;
  }
  if (
    attacker.attackBarriers.some(
      (barrier) => barrier.targetUid === target.card.uid && barrier.expiresOnTurn === state.turnNumber,
    )
  ) {
    return false;
  }
  if (attackerDef.tags.includes("Charge") && attackerLane !== targetLane) return false;
  if (options.ignoreDiet) return true;
  if (attackerDef.tags.includes("Charge")) return true;
  if (effectiveHasTag(attackerDef, "Territorial") && attackerLane === targetLane) return true;
  if (activeSuperpredators(state) && (attackerDef.diet === "Carnivore" || attackerDef.diet === "Omnivore")) return true;
  if (attackerDef.diet === "Herbivore") return false;
  if (attackerDef.diet === "Omnivore") return targetDef.diet === "Herbivore";
  return targetDef.diet === "Herbivore" || targetDef.diet === "Omnivore";
}

export function legalAttackTargets(state: GameState, attackerUid: string): string[] {
  if (state.phase !== "battle" || resolutionBlocked(state) || state.winner !== null) return [];
  const found = findCreature(state, attackerUid);
  if (!found || found.playerId !== state.activePlayer) return [];
  const opponent = otherPlayer(state.activePlayer);
  return state.players[opponent].lanes.flatMap((lane, targetLane) =>
    lane.creature && creatureCanAttackTarget(state, found.creature, found.laneIndex, lane.creature, targetLane)
      ? [lane.creature.card.uid]
      : [],
  );
}

/** Whether the player could initiate any Hunt if they entered the Battle Phase now. */
export function hasLegalHunts(state: GameState, playerId: PlayerId = state.activePlayer) {
  if (state.activePlayer !== playerId || state.winner !== null) return false;
  if (state.players[playerId].allowances.skipBattlePhase) return false;
  const battleState = clone(state);
  battleState.phase = "battle";
  return battleState.players[playerId].lanes.some(
    (lane) => lane.creature && legalAttackTargets(battleState, lane.creature.card.uid).length > 0,
  );
}

export type BattleNumbers = {
  attackerLevel: number;
  defenderLevel: number;
  /** Portion of the attacker's level that comes from a survival-clause defensive Tag (Stampede only). */
  attackerOwnReactiveBonus: number;
  /** Portion of the defender's level that comes from a survival-clause defensive Tag. */
  defenderOwnReactiveBonus: number;
  attackerNotes: string[];
  defenderNotes: string[];
};

function adjacentHighBastionCount(state: GameState, playerId: PlayerId, laneIndex: number) {
  const lanes = state.players[playerId].lanes;
  return [lanes[laneIndex - 1], lanes[laneIndex + 1]].filter(
    (lane) =>
      lane?.creature?.card.definition.tags.includes("Bastion") && lane.creature.card.definition.printedLevel >= 2,
  ).length;
}

export function calculateBattleNumbers(
  state: GameState,
  attackerFound: FoundCreature,
  defenderFound: FoundCreature,
  targetAlreadyAttacked: boolean,
  offensiveCrypticBonus = 0,
  origin: BattlePreview["origin"] = "battle-phase",
): BattleNumbers {
  const attacker = attackerFound.creature;
  const defender = defenderFound.creature;
  const attackerDef = attacker.card.definition;
  const defenderDef = defender.card.definition;
  let attackerLevel: number = attackerDef.printedLevel;
  let defenderLevel: number = defenderDef.printedLevel;
  let attackerOwnReactiveBonus = 0;
  let defenderOwnReactiveBonus = 0;
  const attackerNotes: string[] = [];
  const defenderNotes: string[] = [];
  const sameLane = attackerFound.laneIndex === defenderFound.laneIndex;

  if (
    attackerDef.tags.includes("Solitary") &&
    hasNoAdjacentFriendly(state, attackerFound.playerId, attackerFound.laneIndex)
  ) {
    attackerLevel += 1;
    attackerNotes.push("Solitary +1");
  }
  if (
    defenderDef.tags.includes("Solitary") &&
    hasNoAdjacentFriendly(state, defenderFound.playerId, defenderFound.laneIndex)
  ) {
    defenderLevel += 1;
    defenderNotes.push("Solitary +1");
  }
  if (attackerDef.tags.includes("Bruiser") && defenderDef.printedLevel >= 2) {
    attackerLevel += 1;
    attackerNotes.push("Bruiser +1");
  }
  if (attackerDef.tags.includes("Small Game Hunter") && defenderDef.printedLevel === 0) {
    attackerLevel += 1;
    attackerNotes.push("Small Game Hunter +1");
  }
  if (attackerDef.tags.includes("Pack Hunter") && targetAlreadyAttacked) {
    attackerLevel += 1;
    attackerNotes.push("Pack Hunter +1");
  }
  if (attackerDef.tags.includes("Diver") && hasPrintedAquatic(defenderDef)) {
    const diverBonus = tagEffectMultiplier(attackerDef, "Diver");
    attackerLevel += diverBonus;
    attackerNotes.push(`Diver +${diverBonus}`);
  }
  if (attacker.mobFeederBonusTurn === state.turnNumber) {
    attackerLevel += 1;
    attackerNotes.push("Mob Feeder +1");
  }
  if (attackerDef.tags.includes("Rivalry") && sameLane) {
    const bonus = tagEffectMultiplier(attackerDef, "Rivalry");
    attackerLevel += bonus;
    attackerNotes.push(`Rivalry +${bonus}`);
  }
  if (defenderDef.tags.includes("Rivalry") && sameLane) {
    const bonus = tagEffectMultiplier(defenderDef, "Rivalry");
    defenderLevel += bonus;
    defenderNotes.push(`Rivalry +${bonus}`);
  }
  if (attackerDef.tags.includes("Armament")) {
    const bonus = tagEffectMultiplier(attackerDef, "Armament");
    attackerLevel += bonus;
    attackerNotes.push(`Armament +${bonus}`);
  }
  if (defenderDef.tags.includes("Armament")) {
    const bonus = tagEffectMultiplier(defenderDef, "Armament");
    defenderLevel += bonus;
    defenderNotes.push(`Armament +${bonus}`);
  }
  if (attackerDef.tags.includes("Visual") && !attacker.visualUsed) {
    attackerLevel += 1;
    attackerNotes.push("Visual +1");
  }
  if (defenderDef.tags.includes("Visual") && !defender.visualUsed) {
    defenderLevel += 1;
    defenderNotes.push("Visual +1");
  }
  const attackerPeriodBonus = state.periodAuras.filter((aura) => aura.period === attackerDef.period).length;
  const defenderPeriodBonus = state.periodAuras.filter((aura) => aura.period === defenderDef.period).length;
  if (attackerPeriodBonus) {
    attackerLevel += attackerPeriodBonus;
    attackerNotes.push(`Geological Boundary +${attackerPeriodBonus}`);
  }
  if (defenderPeriodBonus) {
    defenderLevel += defenderPeriodBonus;
    defenderNotes.push(`Geological Boundary +${defenderPeriodBonus}`);
  }
  if (
    state.players[defenderFound.playerId].biome.key === "cold" &&
    effectiveHasTag(defenderDef, "Gigantic") &&
    !effectiveHasTag(attackerDef, "Gigantic") &&
    !attackerDef.tags.includes("Bruiser")
  ) {
    const thermalInertia = tagEffectMultiplier(defenderDef, "Gigantic");
    defenderLevel += thermalInertia;
    defenderNotes.push(`Thermal Inertia +${thermalInertia}`);
  }
  if (
    origin === "stampede" &&
    state.players[attackerFound.playerId].biome.key === "cold" &&
    effectiveHasTag(attackerDef, "Gigantic") &&
    !effectiveHasTag(defenderDef, "Gigantic") &&
    !defenderDef.tags.includes("Bruiser")
  ) {
    const thermalInertia = tagEffectMultiplier(attackerDef, "Gigantic");
    attackerLevel += thermalInertia;
    attackerNotes.push(`Stampede Thermal Inertia +${thermalInertia}`);
  }
  if (attackerFound.lane.attachment?.definition.key === "raptorial-claws") {
    attackerLevel += 1;
    attackerNotes.push("Raptorial Claws +1");
  }
  if (defenderFound.lane.attachment?.definition.key === "raptorial-claws") {
    defenderLevel += 1;
    defenderNotes.push("Raptorial Claws +1");
  }

  if (
    defenderDef.tags.includes("Aerial") &&
    !overrideTags(attackerDef).has("Aerial") &&
    !attackerDef.tags.includes("Ambush") &&
    !attackerDef.tags.includes("Sovereign")
  ) {
    attackerLevel -= 1;
    attackerNotes.push("Aerial defense -1");
  }

  if (offensiveCrypticBonus > 0) {
    attackerLevel += offensiveCrypticBonus;
    attackerNotes.push(`Cryptic Camouflage +${offensiveCrypticBonus}`);
  }

  // Reactive defense Tags. Crushing Bite reduces only this pool.
  let defenderTagDefenseBonus = 0;
  if (defenderDef.tags.includes("Shell") || defenderDef.tags.includes("Dermal Armor")) {
    defenderOwnReactiveBonus += 1;
    defenderTagDefenseBonus += 1;
    defenderNotes.push(`${defenderDef.tags.includes("Shell") ? "Shell" : "Dermal Armor"} +1`);
  }
  if (defenderDef.tags.includes("Osteoderm")) {
    const bonus = 2 * tagEffectMultiplier(defenderDef, "Osteoderm");
    defenderTagDefenseBonus += bonus;
    defenderNotes.push(`Osteoderm +${bonus}`);
  }
  if (
    defenderDef.tags.includes("Bastion") &&
    defenderDef.printedLevel <= 1 &&
    defender.bastionDefendedTurn !== state.turnNumber
  ) {
    const bonus = 2 * tagEffectMultiplier(defenderDef, "Bastion");
    defenderOwnReactiveBonus += bonus;
    defenderTagDefenseBonus += bonus;
    defenderNotes.push(`Bastion +${bonus}`);
  }
  const defenderBastions =
    defenderDef.printedLevel <= 1
      ? adjacentHighBastionCount(state, defenderFound.playerId, defenderFound.laneIndex)
      : 0;
  if (defenderBastions) {
    defenderTagDefenseBonus += defenderBastions;
    defenderNotes.push(`Adjacent Bastion +${defenderBastions}`);
  }
  if (defenderFound.lane.attachment?.definition.key === "thagomizer") {
    defenderLevel += 1;
    defenderNotes.push("Thagomizer +1");
  }
  if (attackerDef.tags.includes("Crushing Bite") && defenderTagDefenseBonus > 0) {
    if (defenderDef.tags.includes("Sovereign")) {
      defenderNotes.push("Sovereign prevented Crushing Bite");
    } else {
      const reduction = tagEffectMultiplier(attackerDef, "Crushing Bite");
      const applied = Math.min(defenderTagDefenseBonus, reduction);
      defenderTagDefenseBonus -= applied;
      defenderOwnReactiveBonus = Math.max(0, defenderOwnReactiveBonus - applied);
      attackerNotes.push(`Crushing Bite reduced reactive defense by up to ${reduction}`);
    }
  }
  defenderLevel += defenderTagDefenseBonus;

  // Stampede inverts defensive Tags: a stampeding Herbivore attacks with them.
  if (origin === "stampede") {
    if (attackerDef.tags.includes("Shell") || attackerDef.tags.includes("Dermal Armor")) {
      attackerOwnReactiveBonus += 1;
      attackerLevel += 1;
      attackerNotes.push(`Stampede ${attackerDef.tags.includes("Shell") ? "Shell" : "Dermal Armor"} +1`);
    }
    if (attackerDef.tags.includes("Osteoderm")) {
      const bonus = 2 * tagEffectMultiplier(attackerDef, "Osteoderm");
      attackerLevel += bonus;
      attackerNotes.push(`Stampede Osteoderm +${bonus}`);
    }
    if (
      attackerDef.tags.includes("Bastion") &&
      attackerDef.printedLevel <= 1 &&
      attacker.bastionAttackedTurn !== state.turnNumber
    ) {
      const bonus = 2 * tagEffectMultiplier(attackerDef, "Bastion");
      attackerOwnReactiveBonus += bonus;
      attackerLevel += bonus;
      attackerNotes.push(`Stampede Bastion +${bonus}`);
    }
    const attackerBastions =
      attackerDef.printedLevel <= 1
        ? adjacentHighBastionCount(state, attackerFound.playerId, attackerFound.laneIndex)
        : 0;
    if (attackerBastions) {
      attackerLevel += attackerBastions;
      attackerNotes.push(`Stampede adjacent Bastion +${attackerBastions}`);
    }
  }

  if (attackerFound.lane.attachment?.definition.key === "island-dwarfism") {
    const penalty = effectiveHasTag(attackerDef, "Gigantic") ? 2 : 1;
    attackerLevel -= penalty;
    attackerNotes.push(`Island Dwarfism -${penalty}`);
  }
  if (defenderFound.lane.attachment?.definition.key === "island-dwarfism") {
    const penalty = effectiveHasTag(defenderDef, "Gigantic") ? 2 : 1;
    defenderLevel -= penalty;
    defenderNotes.push(`Island Dwarfism -${penalty}`);
  }
  if (state.players[otherPlayer(attackerFound.playerId)].lanes[attackerFound.laneIndex]!.drought) {
    attackerLevel -= 1;
    attackerNotes.push("Drought -1");
  }
  if (state.players[otherPlayer(defenderFound.playerId)].lanes[defenderFound.laneIndex]!.drought) {
    defenderLevel -= 1;
    defenderNotes.push("Drought -1");
  }

  return {
    attackerLevel: Math.max(0, attackerLevel),
    defenderLevel: Math.max(0, defenderLevel),
    attackerOwnReactiveBonus,
    defenderOwnReactiveBonus,
    attackerNotes,
    defenderNotes,
  };
}

const NO_COINS: BattleCoinPlan = { offensiveCount: 0, offensiveReason: null, defensiveCount: 0, defensiveReason: null };

export function calculateBattleCoinPlan(
  state: GameState,
  attacker: FoundCreature,
  defender: FoundCreature,
): BattleCoinPlan {
  const attackerDef = attacker.creature.card.definition;
  const defenderDef = defender.creature.card.definition;
  const offensiveCamouflage =
    attacker.lane.attachment?.definition.key === "cryptic-camouflage" &&
    (attackerDef.diet === "Carnivore" || attackerDef.diet === "Omnivore");
  const defensiveCamouflage =
    defender.lane.attachment?.definition.key === "cryptic-camouflage" && defenderDef.diet === "Herbivore";
  const nativeElusive = defenderDef.tags.includes("Elusive");
  const evasionAvailable = defender.creature.elusiveUsedTurn !== state.turnNumber;
  const evades = evasionAvailable && (nativeElusive || defensiveCamouflage);

  return {
    offensiveCount: offensiveCamouflage ? (attackerDef.tags.includes("Ambush") ? 2 : 1) : 0,
    offensiveReason: offensiveCamouflage ? "Cryptic Camouflage attack" : null,
    defensiveCount: evades ? (nativeElusive && defensiveCamouflage ? 2 : 1) : 0,
    defensiveReason: evades
      ? nativeElusive && defensiveCamouflage
        ? "Elusive + Cryptic Camouflage evasion"
        : nativeElusive
          ? "Elusive evasion"
          : "Cryptic Camouflage evasion"
      : null,
  };
}

/** The Battle Coins the pending Hunt will flip when committed. */
export function battleCoinPlan(state: GameState): BattleCoinPlan {
  const pending = state.pendingBattle;
  if (!pending) return { ...NO_COINS };
  const attacker = findCreature(state, pending.attackerUid);
  const defender = findCreature(state, pending.defenderUid);
  if (!attacker || !defender) return { ...NO_COINS };
  return calculateBattleCoinPlan(state, attacker, defender);
}

export function battleNeedsElusiveFlip(state: GameState) {
  return battleCoinPlan(state).defensiveCount > 0;
}

export function createBattlePreview(
  state: GameState,
  attacker: FoundCreature,
  defender: FoundCreature,
  origin: BattlePreview["origin"],
) {
  const numbers = calculateBattleNumbers(
    state,
    attacker,
    defender,
    defender.creature.attackedTurn === state.turnNumber,
    0,
    origin,
  );
  const coinPlan = calculateBattleCoinPlan(state, attacker, defender);
  if (coinPlan.offensiveCount) {
    numbers.attackerNotes.push(
      `Cryptic Camouflage: +0 to +${coinPlan.offensiveCount} (${coinPlan.offensiveCount} ${coinPlan.offensiveCount === 1 ? "coin" : "coins"})`,
    );
  }
  state.pendingBattle = {
    attackerUid: attacker.creature.card.uid,
    defenderUid: defender.creature.card.uid,
    attackerPlayer: attacker.playerId,
    attackerLane: attacker.laneIndex,
    defenderPlayer: defender.playerId,
    defenderLane: defender.laneIndex,
    origin,
    attackerLevelMax: numbers.attackerLevel + coinPlan.offensiveCount,
    coinPlan,
    coins: null,
    attackerLevel: numbers.attackerLevel,
    defenderLevel: numbers.defenderLevel,
    attackerNotes: numbers.attackerNotes,
    defenderNotes: numbers.defenderNotes,
  };
}

/** Projected Battle Level of a Creature in a hypothetical Hunt against `opposingUid`. */
export function inspectBattleLevel(
  state: GameState,
  creatureUid: string,
  role: "attacker" | "defender",
  opposingUid: string,
) {
  const creature = findCreature(state, creatureUid);
  const opposing = findCreature(state, opposingUid);
  if (!creature || !opposing) return null;
  if (role === "attacker") {
    return calculateBattleNumbers(state, creature, opposing, opposing.creature.attackedTurn === state.turnNumber)
      .attackerLevel;
  }
  return calculateBattleNumbers(state, opposing, creature, creature.creature.attackedTurn === state.turnNumber)
    .defenderLevel;
}
