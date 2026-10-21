import { tagEffectMultiplier } from "../data/cards.ts";
import {
  calculateBattleCoinPlan,
  calculateBattleNumbers,
  createBattlePreview,
  legalAttackTargets,
} from "./battle-math.ts";
import {
  adaptationSlotEmpty,
  addLog,
  clone,
  drawOne,
  findCreature,
  nextTurnForPlayer,
  sendCardToHistory,
  sendCreatureToHistory,
} from "./core.ts";
import { flipCoin } from "./rng.ts";
import { finishResolution } from "./turn.ts";
import type {
  BattleCoinResults,
  CardInstance,
  CoinGroup,
  CreatureInstance,
  FoundCreature,
  GameState,
  PlayerId,
} from "./types.ts";

/** Hunt lifecycle: preview → (flip coins → optional rerolls) → commit. */

export function previewBattle(original: GameState, attackerUid: string, defenderUid: string): GameState {
  const state = clone(original);
  if (!legalAttackTargets(state, attackerUid).includes(defenderUid)) return state;
  createBattlePreview(state, findCreature(state, attackerUid)!, findCreature(state, defenderUid)!, "battle-phase");
  return state;
}

/** Cancels an uncommitted Hunt. Stampede Hunts are mandatory and cannot be canceled. */
export function cancelBattlePreview(original: GameState): GameState {
  const state = clone(original);
  if (state.pendingBattle?.origin === "stampede" || state.pendingBattle?.coins) return state;
  state.pendingBattle = null;
  return state;
}

// ---------------------------------------------------------------------------
// Battle Coins
// ---------------------------------------------------------------------------

/** Flips every Battle Coin the pending Hunt requires. The Hunt is then committed to. */
export function flipBattleCoins(original: GameState): GameState {
  const state = clone(original);
  const pending = state.pendingBattle;
  if (!pending || pending.coins) return state;
  const { offensiveCount, defensiveCount } = pending.coinPlan;
  if (offensiveCount + defensiveCount === 0) return state;
  pending.coins = {
    offensive: Array.from({ length: offensiveCount }, () => flipCoin(state)),
    defensive: Array.from({ length: defensiveCount }, () => flipCoin(state)),
  };
  return state;
}

/** Temperate Seasonal Cycle: once per turn, a player in the Hunt may spend a Season counter to reroll a coin. */
export function canUseTemperateReroll(state: GameState, playerId: PlayerId) {
  const player = state.players[playerId];
  const battle = state.pendingBattle;
  return Boolean(
    battle &&
    state.winner === null &&
    (battle.attackerPlayer === playerId || battle.defenderPlayer === playerId) &&
    player.biome.key === "temperate" &&
    player.biome.seasonCounters > 0 &&
    player.biome.temperateRerollTurn !== state.turnNumber,
  );
}

export function spendTemperateReroll(original: GameState, playerId: PlayerId): GameState {
  const state = clone(original);
  if (!canUseTemperateReroll(state, playerId)) return state;
  const player = state.players[playerId];
  player.biome.seasonCounters -= 1;
  player.biome.temperateRerollTurn = state.turnNumber;
  addLog(state, `${player.name} spent a Season counter to reroll a Battle Coin; the new result must be used.`);
  return state;
}

/** The player whose effect caused a coin group to be flipped. */
export function coinGroupOwner(state: GameState, group: CoinGroup): PlayerId | null {
  const battle = state.pendingBattle;
  if (!battle) return null;
  return group === "offensive" ? battle.attackerPlayer : battle.defenderPlayer;
}

export function canRerollBattleCoin(state: GameState, playerId: PlayerId, group: CoinGroup, index: number) {
  const coins = state.pendingBattle?.coins?.[group];
  return Boolean(
    coins &&
    index >= 0 &&
    index < coins.length &&
    coinGroupOwner(state, group) === playerId &&
    canUseTemperateReroll(state, playerId),
  );
}

export function rerollBattleCoin(original: GameState, playerId: PlayerId, group: CoinGroup, index: number): GameState {
  if (!canRerollBattleCoin(original, playerId, group, index)) return clone(original);
  const state = spendTemperateReroll(original, playerId);
  state.pendingBattle!.coins![group]![index] = flipCoin(state);
  return state;
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

function triggerMobFeeders(state: GameState, winnerPlayer: PlayerId, killerUid: string) {
  for (const lane of state.players[winnerPlayer].lanes) {
    const creature = lane.creature;
    if (
      creature &&
      creature.card.uid !== killerUid &&
      creature.card.definition.tags.includes("Mob Feeder") &&
      creature.mobFeederTriggeredTurn !== state.turnNumber
    ) {
      creature.mobFeederTriggeredTurn = state.turnNumber;
      creature.mobFeederBonusTurn = state.turnNumber;
      addLog(
        state,
        `${creature.card.definition.name}'s Mob Feeder bonus is ready for its next initiated Hunt this turn.`,
      );
    }
  }
}

/** Autotomy sacrifices itself to prevent its Creature's destruction. */
function tryAutotomy(state: GameState, found: FoundCreature) {
  const attachment = found.lane.attachment;
  if (attachment?.definition.key !== "autotomy") return false;
  sendCardToHistory(state, attachment, "Autotomy prevention");
  found.lane.attachment = null;
  found.creature.cannotAttackOnTurn = nextTurnForPlayer(state, found.playerId);
  addLog(state, `Autotomy prevented ${found.creature.card.definition.name}'s destruction.`);
  return true;
}

function hasLethalThagomizer(found: FoundCreature) {
  const definition = found.creature.card.definition;
  return (
    found.lane.attachment?.definition.key === "thagomizer" &&
    definition.tags.includes("Armament") &&
    definition.tags.includes("Retaliation")
  );
}

const HARD_DEFENSE_TAGS = new Set(["Shell", "Osteoderm", "Dermal Armor"]);

function resolveKillTags(state: GameState, killer: FoundCreature, defeated: CreatureInstance) {
  const killerDefinition = killer.creature.card.definition;
  if (
    killerDefinition.tags.includes("Durophagy") &&
    defeated.definition.tags.some((tag) => HARD_DEFENSE_TAGS.has(tag))
  ) {
    const draws = tagEffectMultiplier(killerDefinition, "Durophagy");
    for (let index = 0; index < draws; index += 1) drawOne(state, killer.playerId, "Durophagy");
    addLog(state, `${killerDefinition.name}'s Durophagy drew ${draws} ${draws === 1 ? "card" : "cards"}.`);
  }
  if (
    killerDefinition.tags.includes("Engulf") &&
    defeated.definition.printedLevel <= killerDefinition.printedLevel &&
    adaptationSlotEmpty(killer.lane)
  ) {
    state.pendingEngulf = {
      holderPlayer: killer.playerId,
      holderLane: killer.laneIndex,
      defeatedOwner: defeated.owner,
      defeatedUid: defeated.uid,
    };
    addLog(state, `${killerDefinition.name} may Engulf ${defeated.definition.name}.`);
  }
}

/** Destroys `loserUid` in battle, logs `message`, then applies the killer's triggers. */
function destroyInBattle(state: GameState, loserUid: string, killerUid: string, message: string) {
  const loser = findCreature(state, loserUid);
  if (!loser) return null;
  const defeated = sendCreatureToHistory(state, loser.playerId, loser.laneIndex, "battle");
  addLog(state, message);
  const killer = findCreature(state, killerUid);
  if (killer && defeated?.definition.kind === "creature") {
    triggerMobFeeders(state, killer.playerId, killer.creature.card.uid);
    resolveKillTags(state, killer, defeated as CreatureInstance);
  }
  return defeated;
}

function resolvedCoinResults(state: GameState, count: number, supplied?: boolean[]) {
  return Array.from({ length: count }, (_, index) => supplied?.[index] ?? flipCoin(state));
}

const coinFaces = (results: boolean[]) => results.map((success) => (success ? "red Rex" : "black reverse")).join(", ");

/**
 * Resolves the pending Hunt. Coin results come from `suppliedResults`, then
 * from coins already flipped with {@link flipBattleCoins}, then fresh flips.
 */
export function commitBattle(original: GameState, suppliedResults?: boolean | BattleCoinResults): GameState {
  const state = clone(original);
  const pending = state.pendingBattle;
  if (!pending) return state;
  const attacker = findCreature(state, pending.attackerUid);
  const defender = findCreature(state, pending.defenderUid);
  if (!attacker || !defender) {
    state.pendingBattle = null;
    return finishResolution(state);
  }

  const targetAlreadyAttacked = defender.creature.attackedTurn === state.turnNumber;
  attacker.creature.lastAttackTurn = state.turnNumber;
  attacker.creature.burrowedUntilTurn = null;
  defender.creature.attackedTurn = state.turnNumber;
  const plan = calculateBattleCoinPlan(state, attacker, defender);
  const normalized: BattleCoinResults =
    typeof suppliedResults === "boolean" ? { defensive: [suppliedResults] } : (suppliedResults ?? pending.coins ?? {});
  const offensiveResults = resolvedCoinResults(state, plan.offensiveCount, normalized.offensive);
  const defensiveResults = resolvedCoinResults(state, plan.defensiveCount, normalized.defensive);
  const offensiveBonus = offensiveResults.filter(Boolean).length;
  const numbers = calculateBattleNumbers(
    state,
    attacker,
    defender,
    targetAlreadyAttacked,
    offensiveBonus,
    pending.origin,
  );
  const attackerDef = attacker.creature.card.definition;
  const defenderDef = defender.creature.card.definition;
  if (defenderDef.tags.includes("Bastion") && defenderDef.printedLevel <= 1) {
    defender.creature.bastionDefendedTurn = state.turnNumber;
  }
  if (pending.origin === "stampede" && attackerDef.tags.includes("Bastion") && attackerDef.printedLevel <= 1) {
    attacker.creature.bastionAttackedTurn = state.turnNumber;
  }
  if (attacker.creature.mobFeederBonusTurn === state.turnNumber) attacker.creature.mobFeederBonusTurn = null;
  if (attackerDef.tags.includes("Visual")) attacker.creature.visualUsed = true;
  if (defenderDef.tags.includes("Visual")) defender.creature.visualUsed = true;

  if (offensiveResults.length) {
    addLog(
      state,
      `${attackerDef.name}'s Cryptic Camouflage ${offensiveResults.length === 1 ? "coin showed" : "coins showed"} ${coinFaces(offensiveResults)} — +${offensiveBonus} Battle Level.`,
    );
  }

  const forcedTie = defensiveResults.some(Boolean);
  if (defensiveResults.length) {
    defender.creature.elusiveUsedTurn = state.turnNumber;
    addLog(
      state,
      `${defenderDef.name}'s evasive ${defensiveResults.length === 1 ? "coin showed" : "coins showed"} ${coinFaces(defensiveResults)} — ${forcedTie ? "success" : "failure"}.`,
    );
  }

  const attackerName = attackerDef.name;
  const defenderName = defenderDef.name;
  const attackerUid = attacker.creature.card.uid;
  const defenderUid = defender.creature.card.uid;
  const tied = forcedTie || numbers.attackerLevel === numbers.defenderLevel;
  addLog(state, `${attackerName} committed a Hunt against ${defenderName}.`);

  if (tied) {
    const thagomizerKill = hasLethalThagomizer(defender);
    const retaliationDestroysAttacker = defenderDef.tags.includes("Retaliation") || thagomizerKill;
    const stampedeRetaliationDestroysDefender =
      pending.origin === "stampede" && attackerDef.tags.includes("Retaliation");
    addLog(state, `${attackerName} ${numbers.attackerLevel} vs. ${defenderName} ${numbers.defenderLevel}: tie.`);
    if (attackerDef.tags.includes("Saboteur")) {
      defender.creature.cannotAttackOnTurn = nextTurnForPlayer(state, defender.playerId);
      addLog(state, `Saboteur prevents ${defenderName} from Hunting during its controller's next Battle Phase.`);
    }
    if (attackerDef.tags.includes("Raptorial")) {
      defender.creature.cannotOverrideOnTurn = nextTurnForPlayer(state, defender.playerId);
      addLog(state, `Raptorial prevents ${defenderName} from being overridden during its controller's next turn.`);
    }
    if (retaliationDestroysAttacker) {
      const currentAttacker = findCreature(state, attackerUid);
      if (currentAttacker && !tryAutotomy(state, currentAttacker)) {
        destroyInBattle(
          state,
          attackerUid,
          defenderUid,
          `${defenderName}'s ${thagomizerKill ? "Thagomizer" : "Retaliation"} destroyed ${attackerName} after the tied Hunt.`,
        );
      }
    }
    if (stampedeRetaliationDestroysDefender) {
      const currentDefender = findCreature(state, defenderUid);
      if (currentDefender && !tryAutotomy(state, currentDefender)) {
        destroyInBattle(
          state,
          defenderUid,
          attackerUid,
          `${attackerName}'s Stampede-inverted Retaliation destroyed ${defenderName} after the tied Hunt.`,
        );
      }
    }
    if (!retaliationDestroysAttacker && !stampedeRetaliationDestroysDefender)
      addLog(state, "Neither Creature was destroyed.");
  } else if (numbers.attackerLevel < numbers.defenderLevel) {
    // Shell, Dermal Armor, and Bastion spare a losing attacker that was within the defensive bonus.
    const savedByDefense =
      !hasLethalThagomizer(defender) &&
      numbers.defenderOwnReactiveBonus > 0 &&
      numbers.attackerLevel >= numbers.defenderLevel - numbers.defenderOwnReactiveBonus;
    if (tryAutotomy(state, attacker)) {
      addLog(state, `${attackerName} survived a ${numbers.attackerLevel} to ${numbers.defenderLevel} loss.`);
    } else if (savedByDefense) {
      const defenseTag = defenderDef.tags.includes("Shell")
        ? "Shell"
        : defenderDef.tags.includes("Dermal Armor")
          ? "Dermal Armor"
          : "Bastion";
      addLog(
        state,
        `${attackerName} lost ${numbers.attackerLevel} to ${numbers.defenderLevel}, but the defender's ${defenseTag} clause spared it.`,
      );
    } else {
      destroyInBattle(
        state,
        attackerUid,
        defenderUid,
        `${defenderName} destroyed ${attackerName} (${numbers.defenderLevel} to ${numbers.attackerLevel}).`,
      );
    }
  } else if (tryAutotomy(state, defender)) {
    addLog(state, `${defenderName} survived a ${numbers.defenderLevel} to ${numbers.attackerLevel} loss.`);
  } else if (
    pending.origin === "stampede" &&
    numbers.attackerOwnReactiveBonus > 0 &&
    numbers.defenderLevel >= numbers.attackerLevel - numbers.attackerOwnReactiveBonus
  ) {
    addLog(
      state,
      `${defenderName} lost ${numbers.defenderLevel} to ${numbers.attackerLevel}, but ${attackerName}'s inverted defensive-Tag survival clause spared it.`,
    );
  } else {
    destroyInBattle(
      state,
      defenderUid,
      attackerUid,
      `${attackerName} destroyed ${defenderName} (${numbers.attackerLevel} to ${numbers.defenderLevel}).`,
    );
  }

  state.pendingBattle = null;
  return finishResolution(state);
}

export function chooseEngulf(original: GameState, accept: boolean): GameState {
  const state = clone(original);
  const pending = state.pendingEngulf;
  if (!pending) return state;
  const lane = state.players[pending.holderPlayer].lanes[pending.holderLane]!;
  const holder = lane.creature;
  const defeatedHistory = state.players[pending.defeatedOwner].history;
  const defeatedIndex = defeatedHistory.findIndex((card) => card.uid === pending.defeatedUid);
  if (accept && holder && adaptationSlotEmpty(lane) && defeatedIndex >= 0) {
    const [defeated] = defeatedHistory.splice(defeatedIndex, 1) as [CardInstance];
    if (defeated.definition.kind === "creature") {
      lane.engulfed = defeated as CreatureInstance;
      addLog(
        state,
        `${holder.card.definition.name} Engulfed ${defeated.definition.name}; its Adaptation Slot is now occupied.`,
      );
    }
  } else {
    addLog(state, `${holder?.card.definition.name ?? "The Creature"} declined Engulf.`);
  }
  state.pendingEngulf = null;
  return finishResolution(state);
}
