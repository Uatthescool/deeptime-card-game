import { hasPrintedAquatic, tagEffectMultiplier } from "../data/cards.ts";
import {
  clone,
  effectiveHasTag,
  findCreature,
  hasNoAdjacentFriendly,
  huntingDiet,
  otherPlayer,
  overrideTags,
  resolutionBlocked,
  isGameOver,
} from "./core.ts";
import type {
  BattleCoinPlan,
  BattlePreview,
  CreatureInPlay,
  FoundCreature,
  GameState,
  PlayerId,
  Reason,
  Verdict,
} from "./types.ts";

/** Pure battle calculations: Hunt legality, Battle Levels, and Battle Coin plans. */

function activeSuperpredators(state: GameState) {
  return state.players.some((player) => player.event?.definition.key === "superpredators");
}

function hasCrypticCamouflage(state: GameState, creature: CreatureInPlay, laneIndex: number) {
  return state.players[creature.card.owner].lanes[laneIndex]?.attachment?.definition.key === "cryptic-camouflage";
}

type HuntOptions = { ignoreDiet?: boolean; ignoreEntryTurn?: boolean };

const reason = (code: string, text: string): Reason => ({ code, text });

/** Reasons this Creature can't initiate any Hunt right now, whatever the target. */
export function hunterBlockers(
  state: GameState,
  attacker: CreatureInPlay,
  attackerLane: number,
  options: HuntOptions = {},
): Reason[] {
  const name = attacker.card.definition.name;
  const definition = attacker.card.definition;
  const blockers: Reason[] = [];
  if (attacker.lastAttackTurn === state.turnNumber) {
    blockers.push(reason("already-hunted", `${name} has already Hunted this turn.`));
  }
  if (attacker.cannotAttackOnTurn === state.turnNumber) {
    blockers.push(reason("hunt-locked", `${name} can't Hunt this turn.`));
  }
  if (state.players[attacker.card.owner].lanes[attackerLane]?.engulfed) {
    blockers.push(reason("engulfed", `${name} is holding an Engulfed Creature and can't Hunt until its slot clears.`));
  }
  if (hasCrypticCamouflage(state, attacker, attackerLane) && definition.diet === "Herbivore") {
    blockers.push(reason("camouflage-herbivore", "Cryptic Camouflage keeps a Herbivore from Hunting."));
  }
  if (
    attacker.enteredTurn === state.turnNumber &&
    !options.ignoreEntryTurn &&
    !definition.tags.includes("Ambush") &&
    !definition.tags.includes("Charge")
  ) {
    blockers.push(
      reason("entered-this-turn", `${name} entered play this turn; only Ambush or Charge Creatures Hunt right away.`),
    );
  }
  return blockers;
}

/** Reasons this attacker can't Hunt this particular target, beyond the attacker's own readiness. */
function targetBlockers(
  state: GameState,
  attacker: CreatureInPlay,
  attackerLane: number,
  target: CreatureInPlay,
  targetLane: number,
  options: HuntOptions,
): Reason[] {
  const attackerDef = attacker.card.definition;
  const targetDef = target.card.definition;
  const blockers: Reason[] = [];
  if (attackerDef.tags.includes("Elusive") && targetDef.printedLevel >= 1) {
    blockers.push(reason("elusive-attacker", `${attackerDef.name} is Elusive, so it can Hunt only Level 0 Creatures.`));
  }
  if (effectiveHasTag(targetDef, "Gigantic") && attackerDef.printedLevel <= 1) {
    blockers.push(
      reason("gigantic-target", `${targetDef.name} is Gigantic: only Level 2 or higher Creatures can Hunt it.`),
    );
  }
  if (target.burrowedUntilTurn !== null && state.turnNumber < target.burrowedUntilTurn) {
    blockers.push(reason("burrowed", `${targetDef.name} is Burrowed until Turn ${target.burrowedUntilTurn}.`));
  }
  if (
    state.activePlayer !== target.card.owner &&
    target.deimaticProtectedThroughTurn !== null &&
    state.turnNumber <= target.deimaticProtectedThroughTurn
  ) {
    blockers.push(
      reason(
        "deimatic",
        `${targetDef.name}'s Deimatic display protects it through Turn ${target.deimaticProtectedThroughTurn}.`,
      ),
    );
  }
  if (
    attacker.attackBarriers.some(
      (barrier) => barrier.targetUid === target.card.uid && barrier.expiresOnTurn === state.turnNumber,
    )
  ) {
    blockers.push(
      reason("cranial-display", `Cranial Display deters ${attackerDef.name} from Hunting ${targetDef.name} this turn.`),
    );
  }
  const charge = attackerDef.tags.includes("Charge");
  if (charge && attackerLane !== targetLane) {
    blockers.push(reason("charge-lane", "Charge Creatures Hunt only the Creature directly opposite them."));
  }
  // Filter Feeders are Hunted as Herbivores. Combo with Gigantic: it may Hunt Herbivores of Level 1 or below.
  const attackerDiet = huntingDiet(attackerDef);
  const targetDiet = huntingDiet(targetDef);
  const giganticFilterFeeder = attackerDef.tags.includes("Filter Feeder") && effectiveHasTag(attackerDef, "Gigantic");
  const filterFeederPrey = giganticFilterFeeder && targetDiet === "Herbivore" && targetDef.printedLevel <= 1;
  const dietWaived =
    options.ignoreDiet ||
    charge ||
    filterFeederPrey ||
    (effectiveHasTag(attackerDef, "Territorial") && attackerLane === targetLane) ||
    (activeSuperpredators(state) && (attackerDiet === "Carnivore" || attackerDiet === "Omnivore"));
  if (!dietWaived) {
    if (attackerDiet === "Herbivore") {
      blockers.push(
        attackerDef.diet === "Herbivore"
          ? reason("herbivore-hunt", "Herbivores don't Hunt, except during a Stampede or with Charge or Territorial.")
          : reason(
              "filter-feeder-hunt",
              giganticFilterFeeder
                ? `${attackerDef.name} is a Gigantic Filter Feeder: it can Hunt only Herbivores of Level 1 or below, unless it has Charge or Territorial.`
                : `${attackerDef.name} is a Filter Feeder, which Hunts as a Herbivore: it can't Hunt without Charge or Territorial.`,
            ),
      );
    } else if (attackerDiet === "Omnivore" && targetDiet !== "Herbivore") {
      blockers.push(reason("diet-omnivore", "Omnivores can Hunt only Herbivores."));
    } else if (attackerDiet === "Carnivore" && targetDiet === "Carnivore") {
      blockers.push(reason("diet-carnivore", "Carnivores can Hunt only Herbivores or Omnivores."));
    }
  }
  return blockers;
}

/** Every reason `attacker` can't Hunt `target`; empty when the Hunt is legal. */
export function huntBlockers(
  state: GameState,
  attacker: CreatureInPlay,
  attackerLane: number,
  target: CreatureInPlay,
  targetLane: number,
  options: HuntOptions = {},
): Reason[] {
  return [
    ...hunterBlockers(state, attacker, attackerLane, options),
    ...targetBlockers(state, attacker, attackerLane, target, targetLane, options),
  ];
}

export function creatureCanAttackTarget(
  state: GameState,
  attacker: CreatureInPlay,
  attackerLane: number,
  target: CreatureInPlay,
  targetLane: number,
  options: HuntOptions = {},
) {
  return huntBlockers(state, attacker, attackerLane, target, targetLane, options).length === 0;
}

function battleGate(state: GameState): Reason[] {
  if (isGameOver(state)) return [reason("game-over", "The game is over.")];
  if (resolutionBlocked(state)) return [reason("pending-choice", "Finish the choice in progress first.")];
  if (state.phase !== "battle") return [reason("wrong-phase", "Hunts happen in your Battle Phase.")];
  return [];
}

/** Whether the active player's `attackerUid` may Hunt `defenderUid`, and why not. */
export function explainHunt(state: GameState, attackerUid: string, defenderUid: string): Verdict {
  const gate = battleGate(state);
  if (gate.length) return { legal: false, reasons: gate };
  const attacker = findCreature(state, attackerUid);
  const defender = findCreature(state, defenderUid);
  if (!attacker || attacker.playerId !== state.activePlayer) {
    return { legal: false, reasons: [reason("not-your-creature", "Choose one of your own Creatures to Hunt with.")] };
  }
  if (!defender || defender.playerId === attacker.playerId) {
    return { legal: false, reasons: [reason("not-an-opponent", "Hunts target an opposing Creature.")] };
  }
  const reasons = huntBlockers(state, attacker.creature, attacker.laneIndex, defender.creature, defender.laneIndex);
  return { legal: reasons.length === 0, reasons };
}

/** Why the active player's Creature has no legal Hunt at all. Empty when it has at least one target. */
export function explainHunter(state: GameState, attackerUid: string): Reason[] {
  const gate = battleGate(state);
  if (gate.length) return gate;
  const attacker = findCreature(state, attackerUid);
  if (!attacker || attacker.playerId !== state.activePlayer) {
    return [reason("not-your-creature", "Choose one of your own Creatures to Hunt with.")];
  }
  if (legalAttackTargets(state, attackerUid).length) return [];
  const own = hunterBlockers(state, attacker.creature, attacker.laneIndex);
  if (own.length) return own;
  const targets = state.players[otherPlayer(state.activePlayer)].lanes.filter((lane) => lane.creature);
  if (!targets.length) return [reason("no-targets", "Your opponent has no Creatures to Hunt.")];
  return [reason("no-legal-target", "No opposing Creature can be Hunted by this Creature. Point at one to see why.")];
}

export function legalAttackTargets(state: GameState, attackerUid: string): string[] {
  if (battleGate(state).length) return [];
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
  if (state.activePlayer !== playerId || isGameOver(state)) return false;
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
