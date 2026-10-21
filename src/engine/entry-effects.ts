import { tagEffectMultiplier } from "../data/cards.ts";
import {
  addLog,
  adjacentEmptyNiches,
  clone,
  findCreature,
  HAND_LIMIT,
  makeCreatureInPlay,
  moveCardFromHand,
  nextTurnForPlayer,
  otherPlayer,
  takeDeckCard,
} from "./core.ts";
import { shuffle } from "./rng.ts";
import { finishResolution, orderTopTwo } from "./turn.ts";
import type { ChoiceOption, CreatureInstance, GameState, PlayerId } from "./types.ts";

/**
 * Entry effects trigger when a Creature fills or overrides a Niche. Passive
 * ones (Deimatic, Overreach) apply immediately; choices (Herd, Nesting,
 * Cranial Display, Filter Feeder) are queued and resolved one at a time.
 */

export const DECLINE_HERD = "__decline-herd__";
export const DECLINE_NESTING = "__decline-nesting__";

function hasActiveEntryChoice(state: GameState) {
  return Boolean(state.pendingHerd || state.pendingNesting || state.pendingCranialDisplay || state.pendingFilterFeeder);
}

/** Opens the next queued entry choice that has a legal resolution; skips the rest with a log line. */
export function continueEntryEffects(state: GameState) {
  if (hasActiveEntryChoice(state)) return state;
  while (state.entryEffectQueue.length) {
    const effect = state.entryEffectQueue.shift()!;
    const source = findCreature(state, effect.sourceUid);
    if (!source || source.playerId !== effect.playerId) continue;
    const definition = source.creature.card.definition;
    const player = state.players[effect.playerId];

    if (effect.kind === "herd") {
      const eligibleUids = player.deck
        .filter(
          (card) =>
            card.definition.kind === "creature" &&
            card.definition.tags.includes("Herd") &&
            card.definition.printedLevel <= definition.printedLevel + 1,
        )
        .map((card) => card.uid);
      if (!eligibleUids.length || player.hand.length >= HAND_LIMIT) {
        addLog(state, `${definition.name}'s Herd found no eligible Creature to add.`);
        continue;
      }
      state.pendingHerd = { sourceUid: effect.sourceUid, playerId: effect.playerId, eligibleUids };
      addLog(state, `${definition.name}'s Herd may search for another eligible Herd Creature.`);
      return state;
    }

    if (effect.kind === "nesting") {
      const eligibleUids = player.hand
        .filter((card) => card.definition.kind === "creature" && card.definition.printedLevel === 0)
        .map((card) => card.uid);
      if (!eligibleUids.length || !adjacentEmptyNiches(state, effect.playerId, source.laneIndex).length) {
        addLog(state, `${definition.name}'s Nesting had no legal Level 0 placement.`);
        continue;
      }
      state.pendingNesting = { sourceUid: effect.sourceUid, playerId: effect.playerId, stage: "card", eligibleUids };
      addLog(state, `${definition.name}'s Nesting may place an adjacent Level 0 Creature.`);
      return state;
    }

    if (effect.kind === "cranial-display") {
      const eligibleTargetUids = state.players[otherPlayer(effect.playerId)].lanes
        .filter((lane) => lane.creature && lane.creature.card.definition.printedLevel <= definition.printedLevel)
        .map((lane) => lane.creature!.card.uid);
      if (!eligibleTargetUids.length) {
        addLog(state, `${definition.name} entered with no eligible Cranial Display target.`);
        continue;
      }
      state.pendingCranialDisplay = { sourceUid: effect.sourceUid, eligibleTargetUids };
      addLog(state, `${definition.name}'s Cranial Display must choose an eligible opposing Creature.`);
      return state;
    }

    // Filter Feeder
    if (player.deck.length < 2) {
      addLog(state, `${definition.name}'s Filter Feeder found fewer than two cards to reorder.`);
      continue;
    }
    state.pendingFilterFeeder = {
      playerId: effect.playerId,
      sourceUid: effect.sourceUid,
      cardUids: [player.deck[0]!.uid, player.deck[1]!.uid],
    };
    addLog(state, `${definition.name}'s Filter Feeder revealed the top two cards for ordering.`);
    return state;
  }
  return state;
}

export function queueEntryEffects(state: GameState, playerId: PlayerId, laneIndex: number) {
  const source = state.players[playerId].lanes[laneIndex]!.creature;
  if (!source) return;
  const definition = source.card.definition;
  const player = state.players[playerId];

  if (definition.tags.includes("Deimatic")) {
    const duration = tagEffectMultiplier(definition, "Deimatic");
    const firstOpposingTurn = state.activePlayer === playerId ? state.turnNumber + 1 : state.turnNumber;
    source.deimaticProtectedThroughTurn = firstOpposingTurn + (duration - 1) * 2;
    addLog(
      state,
      `${definition.name}'s Deimatic protection lasts through ${duration} opposing ${duration === 1 ? "turn" : "turns"}.`,
    );
  }

  if (definition.tags.includes("Overreach")) {
    if (player.overreachTriggeredTurn !== state.turnNumber) {
      const draws = tagEffectMultiplier(definition, "Overreach");
      player.overreachTriggeredTurn = state.turnNumber;
      player.overreachQueuedDraws += draws;
      player.overreachDueTurn = nextTurnForPlayer(state, playerId);
      addLog(
        state,
        `${definition.name}'s Overreach queued ${draws} additional Start-of-Turn ${draws === 1 ? "draw" : "draws"}.`,
      );
    } else {
      addLog(
        state,
        `${definition.name}'s Overreach did not trigger because Overreach already triggered for ${player.name} this turn.`,
      );
    }
  }

  for (const tag of definition.tags) {
    if (tag === "Herd" && player.herdTriggeredTurn !== state.turnNumber) {
      player.herdTriggeredTurn = state.turnNumber;
      state.entryEffectQueue.push({ kind: "herd", sourceUid: source.card.uid, playerId });
    }
    if (tag === "Cranial Display")
      state.entryEffectQueue.push({ kind: "cranial-display", sourceUid: source.card.uid, playerId });
    if (tag === "Filter Feeder")
      state.entryEffectQueue.push({ kind: "filter-feeder", sourceUid: source.card.uid, playerId });
  }
  if (definition.tags.includes("Nesting")) {
    state.entryEffectQueue.push({ kind: "nesting", sourceUid: source.card.uid, playerId });
  }
  continueEntryEffects(state);
}

// ---------------------------------------------------------------------------
// Herd
// ---------------------------------------------------------------------------

export function getHerdOptions(state: GameState): ChoiceOption[] {
  const pending = state.pendingHerd;
  if (!pending) return [];
  return [
    ...state.players[pending.playerId].deck
      .filter((card) => pending.eligibleUids.includes(card.uid))
      .map((card) => ({
        id: card.uid,
        label: card.definition.name,
        detail:
          card.definition.kind === "creature"
            ? `Level ${card.definition.printedLevel} · ${card.definition.period}`
            : "Creature",
      })),
    { id: DECLINE_HERD, label: "Decline Herd", detail: "Continue resolving this Creature's remaining entry effects." },
  ];
}

export function chooseHerd(original: GameState, optionId: string): GameState {
  const state = clone(original);
  const pending = state.pendingHerd;
  if (!pending || !getHerdOptions(state).some((option) => option.id === optionId)) return state;
  const player = state.players[pending.playerId];
  if (optionId !== DECLINE_HERD) {
    const card = takeDeckCard(player, optionId);
    if (!card) return state;
    player.hand.push(card);
    player.deck = shuffle(state, player.deck);
    addLog(state, `${player.name} revealed and added ${card.definition.name} with Herd, then shuffled.`);
  } else {
    addLog(state, `${player.name} declined the optional Herd search.`);
  }
  state.pendingHerd = null;
  continueEntryEffects(state);
  return finishResolution(state);
}

// ---------------------------------------------------------------------------
// Nesting
// ---------------------------------------------------------------------------

export function getNestingOptions(state: GameState): ChoiceOption[] {
  const pending = state.pendingNesting;
  if (!pending) return [];
  const player = state.players[pending.playerId];
  if (pending.stage === "card") {
    return [
      ...player.hand
        .filter((card) => pending.eligibleUids.includes(card.uid))
        .map((card) => ({
          id: card.uid,
          label: card.definition.name,
          detail: card.definition.kind === "creature" ? `Level 0 · ${card.definition.period}` : "Level 0 Creature",
        })),
      { id: DECLINE_NESTING, label: "Decline Nesting", detail: "Continue your turn normally." },
    ];
  }
  const source = findCreature(state, pending.sourceUid);
  if (!source) return [];
  return adjacentEmptyNiches(state, pending.playerId, source.laneIndex).map((laneIndex) => ({
    id: String(laneIndex),
    label: `Niche ${laneIndex + 1}`,
    detail: "Empty adjacent friendly Niche",
  }));
}

export function chooseNesting(original: GameState, optionId: string): GameState {
  const state = clone(original);
  const pending = state.pendingNesting;
  if (!pending || !getNestingOptions(state).some((option) => option.id === optionId)) return state;
  if (pending.stage === "card") {
    if (optionId === DECLINE_NESTING) {
      state.pendingNesting = null;
      addLog(state, `${state.players[pending.playerId].name} declined the optional Nesting placement.`);
      continueEntryEffects(state);
      return finishResolution(state);
    }
    pending.selectedCardUid = optionId;
    pending.stage = "lane";
    return state;
  }

  const laneIndex = Number(optionId);
  const player = state.players[pending.playerId];
  const selected = player.hand.find((card) => card.uid === pending.selectedCardUid);
  if (!selected || selected.definition.kind !== "creature" || selected.definition.printedLevel !== 0) return state;
  const card = moveCardFromHand(player, selected.uid) as CreatureInstance;
  player.lanes[laneIndex]!.creature = makeCreatureInPlay(
    card,
    state.turnNumber,
    nextTurnForPlayer(state, pending.playerId),
  );
  state.pendingNesting = null;
  state.endTurnAfterEntryEffects = true;
  addLog(
    state,
    `Nesting placed ${card.definition.name} into adjacent Niche ${laneIndex + 1}; the turn will end after its entry effects resolve.`,
  );
  queueEntryEffects(state, pending.playerId, laneIndex);
  continueEntryEffects(state);
  return finishResolution(state);
}

// ---------------------------------------------------------------------------
// Filter Feeder and Cranial Display
// ---------------------------------------------------------------------------

export function chooseFilterFeederTop(original: GameState, cardUid: string): GameState {
  const state = clone(original);
  const pending = state.pendingFilterFeeder;
  if (!pending || !pending.cardUids.includes(cardUid)) return state;
  if (!orderTopTwo(state, pending.playerId, pending.cardUids, cardUid)) return state;
  const source = findCreature(state, pending.sourceUid);
  addLog(
    state,
    `${source?.creature.card.definition.name ?? "Filter Feeder"} ordered the top two cards of ${state.players[pending.playerId].name}'s deck.`,
  );
  state.pendingFilterFeeder = null;
  continueEntryEffects(state);
  return finishResolution(state);
}

export function chooseCranialDisplayTarget(original: GameState, targetUid: string): GameState {
  const state = clone(original);
  const pending = state.pendingCranialDisplay;
  if (!pending || !pending.eligibleTargetUids.includes(targetUid)) return state;
  const source = findCreature(state, pending.sourceUid);
  const target = findCreature(state, targetUid);
  if (!source || !target) return state;
  target.creature.attackBarriers.push({
    targetUid: pending.sourceUid,
    expiresOnTurn: nextTurnForPlayer(state, target.playerId),
  });
  addLog(
    state,
    `${target.creature.card.definition.name} is deterred from Hunting ${source.creature.card.definition.name} through its next turn.`,
  );
  state.pendingCranialDisplay = null;
  continueEntryEffects(state);
  return finishResolution(state);
}
