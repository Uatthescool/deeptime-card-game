import {
  type CreatureCard,
  DEFENSIVE_ADAPTATION_KEYS,
  DEFENSIVE_TAGS,
  hasPrintedAquatic,
  tagEffectMultiplier,
} from "../data/cards.ts";
import {
  clone,
  countsAsCarnivore,
  effectiveHasTag,
  findCreature,
  hasNoAdjacentFriendly,
  huntedDiet,
  huntingDiet,
  huntingDiets,
  nicheIsFrozen,
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
  LaneState,
  PlayerId,
  Reason,
  Verdict,
} from "./types.ts";

/** Pure battle calculations: Hunt legality, Battle Power, and Battle Coin plans. */

/** Battle Power per Printed Level: Battle Power = Printed Level × 100 + modifiers. */
export const BATTLE_POWER_PER_LEVEL = 100;

function activeSuperpredators(state: GameState) {
  return state.players.some((player) => player.event?.definition.key === "superpredators");
}

function hasCrypticCamouflage(state: GameState, creature: CreatureInPlay, laneIndex: number) {
  return state.players[creature.card.owner].lanes[laneIndex]?.attachment?.definition.key === "cryptic-camouflage";
}

/** Echolocation: Hunts by the attached Creature ignore the defender's defensive Tags and Adaptations. */
export function huntIgnoresDefenses(state: GameState, playerId: PlayerId, laneIndex: number) {
  return state.players[playerId].lanes[laneIndex]?.attachment?.definition.key === "echolocation";
}

const defenseIgnored = (ignoreDefenses: boolean, tag: string) => ignoreDefenses && tag in DEFENSIVE_TAGS;

/** Whether a defending Creature has `tag` in this Hunt; a Hunt that ignores defenses removes every defensive Tag. */
export function defendsWithTag(creature: CreatureCard, tag: string, ignoreDefenses: boolean) {
  return !defenseIgnored(ignoreDefenses, tag) && effectiveHasTag(creature, tag);
}

/** The key of a defender's Adaptation in this Hunt; a Hunt that ignores defenses skips defensive Adaptations. */
export function defendingAdaptationKey(lane: LaneState, ignoreDefenses: boolean) {
  const key = lane.attachment?.definition.key;
  return key && ignoreDefenses && DEFENSIVE_ADAPTATION_KEYS.has(key) ? undefined : key;
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
  if (nicheIsFrozen(state.players[attacker.card.owner].lanes[attackerLane])) {
    blockers.push(reason("frozen", `${name} is Frozen and can't Hunt.`));
  }
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
  const ignoreDefenses = huntIgnoresDefenses(state, attacker.card.owner, attackerLane);
  const blockers: Reason[] = [];
  if (nicheIsFrozen(state.players[target.card.owner].lanes[targetLane])) {
    blockers.push(reason("frozen-target", `${targetDef.name} is Frozen and can't be Hunted.`));
  }
  if (attackerDef.tags.includes("Elusive") && targetDef.printedLevel >= 1) {
    blockers.push(reason("elusive-attacker", `${attackerDef.name} is Elusive, so it can Hunt only Level 0 Creatures.`));
  }
  if (defendsWithTag(targetDef, "Gigantic", ignoreDefenses) && attackerDef.printedLevel <= 1) {
    blockers.push(
      reason("gigantic-target", `${targetDef.name} is Gigantic: only Level 2 or higher Creatures can Hunt it.`),
    );
  }
  if (
    !defenseIgnored(ignoreDefenses, "Burrower") &&
    target.burrowedUntilTurn !== null &&
    state.turnNumber < target.burrowedUntilTurn
  ) {
    blockers.push(reason("burrowed", `${targetDef.name} is Burrowed until Turn ${target.burrowedUntilTurn}.`));
  }
  if (
    !defenseIgnored(ignoreDefenses, "Deimatic") &&
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
    !defenseIgnored(ignoreDefenses, "Cranial Display") &&
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
  const attackerDiets = huntingDiets(attackerDef);
  const attackerDiet = huntingDiet(attackerDef);
  const targetDiet = huntedDiet(targetDef);
  const giganticFilterFeeder = attackerDef.tags.includes("Filter Feeder") && effectiveHasTag(attackerDef, "Gigantic");
  const filterFeederPrey = giganticFilterFeeder && targetDiet === "Herbivore" && targetDef.printedLevel <= 1;
  const dietWaived =
    options.ignoreDiet ||
    charge ||
    filterFeederPrey ||
    (effectiveHasTag(attackerDef, "Territorial") && attackerLane === targetLane) ||
    (activeSuperpredators(state) && (attackerDiets.has("Carnivore") || attackerDiets.has("Omnivore"))) ||
    (attacker.intraguildPredationTurn === state.turnNumber &&
      [...huntingDiets(targetDef)].some((diet) => attackerDiets.has(diet)));
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
    } else if (attackerDiets.has("Carnivore")) {
      // An Omnivore with Apex Predator Hunts as a Carnivore too: Herbivores and Omnivores.
      if (targetDiet === "Carnivore") {
        blockers.push(reason("diet-carnivore", "Carnivores can Hunt only Herbivores or Omnivores."));
      }
    } else if (attackerDiet === "Omnivore" && targetDiet !== "Herbivore") {
      blockers.push(reason("diet-omnivore", "Omnivores can Hunt only Herbivores."));
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
  attackerPower: number;
  defenderPower: number;
  /** Portion of the attacker's Battle Power that comes from a survival-clause defensive Tag (Stampede only). */
  attackerOwnReactiveBonus: number;
  /** Portion of the defender's Battle Power that comes from a survival-clause defensive Tag. */
  defenderOwnReactiveBonus: number;
  attackerNotes: string[];
  defenderNotes: string[];
};

/** Neighbours whose Bastion shields Level 0–1 Creatures: Level 2+ Bastion, or Circle Defense at any Level. */
function adjacentHighBastionCount(state: GameState, playerId: PlayerId, laneIndex: number) {
  const lanes = state.players[playerId].lanes;
  return [lanes[laneIndex - 1], lanes[laneIndex + 1]].filter((lane) => {
    const definition = lane?.creature?.card.definition;
    return (
      !nicheIsFrozen(lane) &&
      definition &&
      effectiveHasTag(definition, "Bastion") &&
      (definition.printedLevel >= 2 || definition.tags.includes("Circle Defense"))
    );
  }).length;
}

/**
 * Circle Defense's Bastion, each time its Creature is Hunted: +100 Battle Power per friendly Herd Creature in play,
 * itself included, and −50 per opposing Carnivore other than the hunter (−100 for a Pack Hunter); never below 0.
 */
function circleDefenseBonus(state: GameState, ownerId: PlayerId, hunterUid: string) {
  const herds = state.players[ownerId].lanes.filter(
    (lane) => lane.creature && effectiveHasTag(lane.creature.card.definition, "Herd"),
  ).length;
  let penalty = 0;
  for (const lane of state.players[otherPlayer(ownerId)].lanes) {
    const definition = lane.creature?.card.definition;
    if (!definition || lane.creature!.card.uid === hunterUid || !countsAsCarnivore(definition)) continue;
    penalty += definition.tags.includes("Pack Hunter") ? BATTLE_POWER_PER_LEVEL : BATTLE_POWER_PER_LEVEL / 2;
  }
  const bonus = Math.max(0, herds * BATTLE_POWER_PER_LEVEL - penalty);
  return {
    bonus,
    note: `Circle Defense +${bonus} (${herds} Herd${penalty ? `, −${penalty} for other Carnivores` : ""})`,
  };
}

export function calculateBattleNumbers(
  state: GameState,
  attackerFound: FoundCreature,
  defenderFound: FoundCreature,
  targetAlreadyAttacked: boolean,
  offensiveCoinSuccesses = 0,
  origin: BattlePreview["origin"] = "battle-phase",
): BattleNumbers {
  const attacker = attackerFound.creature;
  const defender = defenderFound.creature;
  const attackerDef = attacker.card.definition;
  const defenderDef = defender.card.definition;
  let attackerPower = attackerDef.printedLevel * BATTLE_POWER_PER_LEVEL;
  let defenderPower = defenderDef.printedLevel * BATTLE_POWER_PER_LEVEL;
  let attackerOwnReactiveBonus = 0;
  let defenderOwnReactiveBonus = 0;
  const attackerNotes: string[] = [];
  const defenderNotes: string[] = [];
  const sameLane = attackerFound.laneIndex === defenderFound.laneIndex;
  const ignoreDefenses = huntIgnoresDefenses(state, attackerFound.playerId, attackerFound.laneIndex);
  const defenderHas = (tag: string) => defendsWithTag(defenderDef, tag, ignoreDefenses);

  if (
    attackerDef.tags.includes("Solitary") &&
    hasNoAdjacentFriendly(state, attackerFound.playerId, attackerFound.laneIndex)
  ) {
    attackerPower += BATTLE_POWER_PER_LEVEL;
    attackerNotes.push("Solitary +100");
  }
  if (
    defenderDef.tags.includes("Solitary") &&
    hasNoAdjacentFriendly(state, defenderFound.playerId, defenderFound.laneIndex)
  ) {
    defenderPower += BATTLE_POWER_PER_LEVEL;
    defenderNotes.push("Solitary +100");
  }
  if (attackerDef.tags.includes("Bruiser") && defenderDef.printedLevel >= 2) {
    attackerPower += BATTLE_POWER_PER_LEVEL;
    attackerNotes.push("Bruiser +100");
  }
  if (attackerDef.tags.includes("Small Game Hunter") && defenderDef.printedLevel === 0) {
    attackerPower += BATTLE_POWER_PER_LEVEL;
    attackerNotes.push("Small Game Hunter +100");
  }
  if (attackerDef.tags.includes("Pack Hunter") && targetAlreadyAttacked) {
    attackerPower += BATTLE_POWER_PER_LEVEL;
    attackerNotes.push("Pack Hunter +100");
  }
  if (attackerDef.tags.includes("Diver") && hasPrintedAquatic(defenderDef)) {
    const diverBonus = tagEffectMultiplier(attackerDef, "Diver") * BATTLE_POWER_PER_LEVEL;
    attackerPower += diverBonus;
    attackerNotes.push(`Diver +${diverBonus}`);
  }
  if (attacker.mobFeederBonusTurn === state.turnNumber) {
    attackerPower += BATTLE_POWER_PER_LEVEL;
    attackerNotes.push("Mob Feeder +100");
  }
  if (attackerDef.tags.includes("Rivalry") && sameLane) {
    const bonus = tagEffectMultiplier(attackerDef, "Rivalry") * BATTLE_POWER_PER_LEVEL;
    attackerPower += bonus;
    attackerNotes.push(`Rivalry +${bonus}`);
  }
  if (defenderDef.tags.includes("Rivalry") && sameLane) {
    const bonus = tagEffectMultiplier(defenderDef, "Rivalry") * BATTLE_POWER_PER_LEVEL;
    defenderPower += bonus;
    defenderNotes.push(`Rivalry +${bonus}`);
  }
  if (attackerDef.tags.includes("Armament")) {
    const bonus = tagEffectMultiplier(attackerDef, "Armament") * BATTLE_POWER_PER_LEVEL;
    attackerPower += bonus;
    attackerNotes.push(`Armament +${bonus}`);
  }
  if (defenderDef.tags.includes("Armament")) {
    const bonus = tagEffectMultiplier(defenderDef, "Armament") * BATTLE_POWER_PER_LEVEL;
    defenderPower += bonus;
    defenderNotes.push(`Armament +${bonus}`);
  }
  if (attackerDef.tags.includes("Visual") && !attacker.visualUsed) {
    attackerPower += BATTLE_POWER_PER_LEVEL;
    attackerNotes.push("Visual +100");
  }
  if (defenderDef.tags.includes("Visual") && !defender.visualUsed) {
    defenderPower += BATTLE_POWER_PER_LEVEL;
    defenderNotes.push("Visual +100");
  }
  const attackerPeriodBonus =
    state.periodAuras.filter((aura) => aura.period === attackerDef.period).length * BATTLE_POWER_PER_LEVEL;
  const defenderPeriodBonus =
    state.periodAuras.filter((aura) => aura.period === defenderDef.period).length * BATTLE_POWER_PER_LEVEL;
  if (attackerPeriodBonus) {
    attackerPower += attackerPeriodBonus;
    attackerNotes.push(`Geological Boundary +${attackerPeriodBonus}`);
  }
  if (defenderPeriodBonus) {
    defenderPower += defenderPeriodBonus;
    defenderNotes.push(`Geological Boundary +${defenderPeriodBonus}`);
  }
  if (
    state.players[defenderFound.playerId].biome.key === "cold" &&
    defenderHas("Gigantic") &&
    !effectiveHasTag(attackerDef, "Gigantic") &&
    !attackerDef.tags.includes("Bruiser")
  ) {
    const thermalInertia = tagEffectMultiplier(defenderDef, "Gigantic") * BATTLE_POWER_PER_LEVEL;
    defenderPower += thermalInertia;
    defenderNotes.push(`Thermal Inertia +${thermalInertia}`);
  }
  if (
    origin === "stampede" &&
    state.players[attackerFound.playerId].biome.key === "cold" &&
    effectiveHasTag(attackerDef, "Gigantic") &&
    !effectiveHasTag(defenderDef, "Gigantic") &&
    !defenderDef.tags.includes("Bruiser")
  ) {
    const thermalInertia = tagEffectMultiplier(attackerDef, "Gigantic") * BATTLE_POWER_PER_LEVEL;
    attackerPower += thermalInertia;
    attackerNotes.push(`Stampede Thermal Inertia +${thermalInertia}`);
  }
  if (attackerFound.lane.attachment?.definition.key === "raptorial-claws") {
    attackerPower += BATTLE_POWER_PER_LEVEL;
    attackerNotes.push("Raptorial Claws +100");
  }
  if (defenderFound.lane.attachment?.definition.key === "raptorial-claws") {
    defenderPower += BATTLE_POWER_PER_LEVEL;
    defenderNotes.push("Raptorial Claws +100");
  }

  if (
    defenderHas("Aerial") &&
    !overrideTags(attackerDef).has("Aerial") &&
    !attackerDef.tags.includes("Ambush") &&
    !attackerDef.tags.includes("Sovereign")
  ) {
    attackerPower -= BATTLE_POWER_PER_LEVEL;
    attackerNotes.push("Aerial defense -100");
  }

  if (offensiveCoinSuccesses > 0) {
    const crypticBonus = offensiveCoinSuccesses * BATTLE_POWER_PER_LEVEL;
    attackerPower += crypticBonus;
    attackerNotes.push(`Cryptic Camouflage +${crypticBonus}`);
  }

  // Reactive defense Tags. Crushing Bite reduces only this pool.
  let defenderTagDefenseBonus = 0;
  if (defenderHas("Shell") || defenderHas("Dermal Armor")) {
    defenderOwnReactiveBonus += BATTLE_POWER_PER_LEVEL;
    defenderTagDefenseBonus += BATTLE_POWER_PER_LEVEL;
    defenderNotes.push(`${defenderHas("Shell") ? "Shell" : "Dermal Armor"} +100`);
  }
  if (defenderHas("Osteoderm")) {
    const bonus = 2 * tagEffectMultiplier(defenderDef, "Osteoderm") * BATTLE_POWER_PER_LEVEL;
    defenderTagDefenseBonus += bonus;
    defenderNotes.push(`Osteoderm +${bonus}`);
  }
  if (defenderHas("Bastion") && defenderDef.tags.includes("Circle Defense")) {
    const circle = circleDefenseBonus(state, defenderFound.playerId, attacker.card.uid);
    defenderOwnReactiveBonus += circle.bonus;
    defenderTagDefenseBonus += circle.bonus;
    defenderNotes.push(circle.note);
  } else if (
    defenderHas("Bastion") &&
    defenderDef.printedLevel <= 1 &&
    defender.bastionDefendedTurn !== state.turnNumber
  ) {
    const bonus = 2 * tagEffectMultiplier(defenderDef, "Bastion") * BATTLE_POWER_PER_LEVEL;
    defenderOwnReactiveBonus += bonus;
    defenderTagDefenseBonus += bonus;
    defenderNotes.push(`Bastion +${bonus}`);
  }
  const defenderBastions =
    defenderDef.printedLevel <= 1 && !defenseIgnored(ignoreDefenses, "Bastion")
      ? adjacentHighBastionCount(state, defenderFound.playerId, defenderFound.laneIndex) * BATTLE_POWER_PER_LEVEL
      : 0;
  if (defenderBastions) {
    defenderTagDefenseBonus += defenderBastions;
    defenderNotes.push(`Adjacent Bastion +${defenderBastions}`);
  }
  if (defendingAdaptationKey(defenderFound.lane, ignoreDefenses) === "thagomizer") {
    defenderPower += BATTLE_POWER_PER_LEVEL;
    defenderNotes.push("Thagomizer +100");
  }
  if (attackerDef.tags.includes("Crushing Bite") && defenderTagDefenseBonus > 0) {
    if (defenderDef.tags.includes("Sovereign")) {
      defenderNotes.push("Sovereign prevented Crushing Bite");
    } else {
      const reduction = tagEffectMultiplier(attackerDef, "Crushing Bite") * BATTLE_POWER_PER_LEVEL;
      const applied = Math.min(defenderTagDefenseBonus, reduction);
      defenderTagDefenseBonus -= applied;
      defenderOwnReactiveBonus = Math.max(0, defenderOwnReactiveBonus - applied);
      attackerNotes.push(`Crushing Bite reduced reactive defense by up to ${reduction}`);
    }
  }
  defenderPower += defenderTagDefenseBonus;

  // Stampede inverts defensive Tags: a stampeding Herbivore attacks with them.
  if (origin === "stampede") {
    if (attackerDef.tags.includes("Shell") || attackerDef.tags.includes("Dermal Armor")) {
      attackerOwnReactiveBonus += BATTLE_POWER_PER_LEVEL;
      attackerPower += BATTLE_POWER_PER_LEVEL;
      attackerNotes.push(`Stampede ${attackerDef.tags.includes("Shell") ? "Shell" : "Dermal Armor"} +100`);
    }
    if (attackerDef.tags.includes("Osteoderm")) {
      const bonus = 2 * tagEffectMultiplier(attackerDef, "Osteoderm") * BATTLE_POWER_PER_LEVEL;
      attackerPower += bonus;
      attackerNotes.push(`Stampede Osteoderm +${bonus}`);
    }
    if (attackerDef.tags.includes("Circle Defense")) {
      // Inverted for Stampede: its circle counts the opposing Carnivores other than the Creature it Hunts.
      const circle = circleDefenseBonus(state, attackerFound.playerId, defender.card.uid);
      attackerOwnReactiveBonus += circle.bonus;
      attackerPower += circle.bonus;
      attackerNotes.push(`Stampede ${circle.note}`);
    } else if (
      effectiveHasTag(attackerDef, "Bastion") &&
      attackerDef.printedLevel <= 1 &&
      attacker.bastionAttackedTurn !== state.turnNumber
    ) {
      const bonus = 2 * tagEffectMultiplier(attackerDef, "Bastion") * BATTLE_POWER_PER_LEVEL;
      attackerOwnReactiveBonus += bonus;
      attackerPower += bonus;
      attackerNotes.push(`Stampede Bastion +${bonus}`);
    }
    const attackerBastions =
      attackerDef.printedLevel <= 1
        ? adjacentHighBastionCount(state, attackerFound.playerId, attackerFound.laneIndex) * BATTLE_POWER_PER_LEVEL
        : 0;
    if (attackerBastions) {
      attackerPower += attackerBastions;
      attackerNotes.push(`Stampede adjacent Bastion +${attackerBastions}`);
    }
  }

  if (attackerFound.lane.attachment?.definition.key === "island-dwarfism") {
    const penalty = (effectiveHasTag(attackerDef, "Gigantic") ? 2 : 1) * BATTLE_POWER_PER_LEVEL;
    attackerPower -= penalty;
    attackerNotes.push(`Island Dwarfism -${penalty}`);
  }
  if (defenderFound.lane.attachment?.definition.key === "island-dwarfism") {
    const penalty = (effectiveHasTag(defenderDef, "Gigantic") ? 2 : 1) * BATTLE_POWER_PER_LEVEL;
    defenderPower -= penalty;
    defenderNotes.push(`Island Dwarfism -${penalty}`);
  }
  if (state.players[otherPlayer(attackerFound.playerId)].lanes[attackerFound.laneIndex]!.drought) {
    attackerPower -= BATTLE_POWER_PER_LEVEL;
    attackerNotes.push("Drought -100");
  }
  if (state.players[otherPlayer(defenderFound.playerId)].lanes[defenderFound.laneIndex]!.drought) {
    defenderPower -= BATTLE_POWER_PER_LEVEL;
    defenderNotes.push("Drought -100");
  }

  return {
    attackerPower: Math.max(0, attackerPower),
    defenderPower: Math.max(0, defenderPower),
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
  const ignoreDefenses = huntIgnoresDefenses(state, attacker.playerId, attacker.laneIndex);
  const offensiveCamouflage =
    attacker.lane.attachment?.definition.key === "cryptic-camouflage" &&
    (attackerDef.diet === "Carnivore" || attackerDef.diet === "Omnivore");
  const defensiveCamouflage =
    defendingAdaptationKey(defender.lane, ignoreDefenses) === "cryptic-camouflage" && defenderDef.diet === "Herbivore";
  const nativeElusive = defendsWithTag(defenderDef, "Elusive", ignoreDefenses);
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
      `Cryptic Camouflage: +0 to +${coinPlan.offensiveCount * BATTLE_POWER_PER_LEVEL} (${coinPlan.offensiveCount} ${coinPlan.offensiveCount === 1 ? "coin" : "coins"})`,
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
    attackerPowerMax: numbers.attackerPower + coinPlan.offensiveCount * BATTLE_POWER_PER_LEVEL,
    coinPlan,
    coins: null,
    attackerPower: numbers.attackerPower,
    defenderPower: numbers.defenderPower,
    attackerNotes: numbers.attackerNotes,
    defenderNotes: numbers.defenderNotes,
  };
}

/** One named always-on Battle Power modifier. */
export type PowerSource = { label: string; amount: number };

/**
 * Live Battle Power: Printed Level × 100 plus the modifiers that apply at all times, whoever it faces.
 * Bonuses that apply only while attacking or defending in a Hunt are left to the Hunt preview.
 */
export function liveBattlePower(state: GameState, creatureUid: string) {
  const found = findCreature(state, creatureUid);
  if (!found) return null;
  const definition = found.creature.card.definition;
  const sources: PowerSource[] = [];
  let power = definition.printedLevel * BATTLE_POWER_PER_LEVEL;
  const add = (label: string, amount: number) => {
    if (!amount) return;
    power += amount;
    sources.push({ label, amount });
  };
  if (definition.tags.includes("Solitary") && hasNoAdjacentFriendly(state, found.playerId, found.laneIndex)) {
    add("Solitary", BATTLE_POWER_PER_LEVEL);
  }
  add(
    "Geological Boundary",
    state.periodAuras.filter((aura) => aura.period === definition.period).length * BATTLE_POWER_PER_LEVEL,
  );
  if (found.lane.attachment?.definition.key === "island-dwarfism") {
    add("Island Dwarfism", -(effectiveHasTag(definition, "Gigantic") ? 2 : 1) * BATTLE_POWER_PER_LEVEL);
  }
  if (state.players[otherPlayer(found.playerId)].lanes[found.laneIndex]!.drought) {
    add("Drought", -BATTLE_POWER_PER_LEVEL);
  }
  return { power: Math.max(0, power), base: definition.printedLevel * BATTLE_POWER_PER_LEVEL, sources };
}

/** Projected Battle Power of a Creature in a hypothetical Hunt against `opposingUid`. */
export function inspectBattlePower(
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
      .attackerPower;
  }
  return calculateBattleNumbers(state, opposing, creature, creature.creature.attackedTurn === state.turnNumber)
    .defenderPower;
}
