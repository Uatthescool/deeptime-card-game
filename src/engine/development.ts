import { type Period } from "../data/cards.ts";
import {
  addLog,
  clone,
  drawOne,
  makeCreatureInPlay,
  moveCardFromHand,
  moveLaneOccupant,
  nextTurnForPlayer,
  otherPlayer,
  PERIOD_SEQUENCE,
  sendCardToHistory,
  sendCreatureToHistory,
  takeDeckCard,
} from "./core.ts";
import { queueEntryEffects } from "./entry-effects.ts";
import { checkOverride } from "./override.ts";
import {
  canActivateCarnianPluvialEpisode,
  canPlayEvent,
  carnianPluvialCostOptions,
  carnianPluvialSearchOptions,
  legalAdaptationTargets,
  legalAquaticOverrideLanes,
  legalConnectedWaterwayDestinations,
  legalCreatureLanes,
  legalDroughtTargets,
  legalFacultativeDestinations,
  legalWildfireLanes,
} from "./queries.ts";
import { shuffle } from "./rng.ts";
import { continueStampede, endTurn, finishResolution } from "./turn.ts";
import type {
  AdaptationInstance,
  ChoiceOption,
  ConvergentCategory,
  CreatureInPlay,
  CreatureInstance,
  EventInstance,
  GameState,
  PlayerId,
} from "./types.ts";
import { resolveVictoryThreshold } from "./victory.ts";

/** Development Phase transitions: Creatures, Adaptations, Events, and board movement. */

// ---------------------------------------------------------------------------
// Creatures
// ---------------------------------------------------------------------------

function playCreatureWithSource(
  original: GameState,
  playerId: PlayerId,
  cardUid: string,
  laneIndex: number,
  source: "normal" | "aquatic",
  convergentChoice?: ConvergentCategory,
): GameState {
  const state = clone(original);
  const player = state.players[playerId];
  const card = player.hand.find((held) => held.uid === cardUid);
  if (!card || card.definition.kind !== "creature") return state;
  const legalLanes =
    source === "aquatic" ? legalAquaticOverrideLanes(state, card) : legalCreatureLanes(state, playerId, card);
  if (!legalLanes.includes(laneIndex)) return state;
  const definition = card.definition;

  const lane = player.lanes[laneIndex]!;
  const previous = lane.creature?.card.definition ?? null;
  const wasOccupied = Boolean(previous);
  // Dental Battery stays in the Niche when one Ornithischian overrides another.
  const dentalBattery =
    previous &&
    lane.attachment?.definition.key === "dental-battery" &&
    previous.taxa.includes("Ornithischian") &&
    definition.taxa.includes("Ornithischian")
      ? lane.attachment
      : null;
  const wasRapid = source === "normal" && player.allowances.rapidSpeciation;
  const wasPropulsion =
    source === "normal" && player.allowances.creaturePlayed && definition.tags.includes("Propulsion");
  const wasOpportunist =
    source === "normal" &&
    player.allowances.creaturePlayed &&
    definition.tags.includes("Opportunist") &&
    state.players[otherPlayer(playerId)].event?.definition.eventType === "continuous";

  if (wasOccupied && player.allowances.convergentEvolution && !convergentChoice) {
    const override = checkOverride(state, playerId, definition, laneIndex, wasRapid);
    if (override.convergentOptions.length) {
      state.pendingConvergentChoice = { playerId, cardUid, laneIndex, categories: override.convergentOptions, source };
      addLog(
        state,
        `Convergent Evolution must choose which missing category to supply for ${definition.name}'s override.`,
      );
      return state;
    }
  }

  const moved = moveCardFromHand(player, cardUid) as CreatureInstance;
  if (wasOccupied) {
    const oldName = previous!.name;
    if (dentalBattery) lane.attachment = null;
    sendCreatureToHistory(state, playerId, laneIndex, "override");
    player.allowances.overriddenLanes.push(laneIndex);
    addLog(
      state,
      `${definition.name} legally overrode ${oldName} in Niche ${laneIndex + 1}${source === "aquatic" ? " through Connected Waterways" : ""}.`,
    );
  } else {
    player.allowances.filledEmpty = true;
    addLog(state, `${player.name} filled Niche ${laneIndex + 1} with ${definition.name}.`);
  }

  lane.creature = makeCreatureInPlay(moved, state.turnNumber, nextTurnForPlayer(state, playerId));
  if (dentalBattery) {
    lane.attachment = dentalBattery;
    drawOne(state, playerId, "Dental Battery transfer");
    addLog(state, `Dental Battery transferred to ${moved.definition.name} and drew 1 card.`);
  }
  if (source === "normal" && !wasPropulsion) player.allowances.creaturePlayed = true;
  player.allowances.developmentActions += 1;

  if (source === "aquatic") {
    player.biome.freeOverrideUsed = true;
    player.biome.waterwaysConnected = false;
    player.allowances.aquaticOverrideLockedLane = laneIndex;
    addLog(
      state,
      `The free override disconnected ${player.name}'s waterways; Connected Waterways can no longer reposition Creatures.`,
    );
  }

  if (wasRapid) {
    player.allowances.rapidSpeciation = false;
    addLog(state, "Rapid Speciation completed its exactly-two-Level override.");
  }
  if (wasOccupied) {
    player.allowances.convergentEvolution = false;
    if (convergentChoice) {
      const label =
        convergentChoice === "taxon" ? "Primary Taxon" : convergentChoice === "period" ? "Time Period" : "Diet";
      addLog(state, `Convergent Evolution supplied the ${label} match.`);
    }
  }

  queueEntryEffects(state, playerId, laneIndex);
  if (wasPropulsion || wasOpportunist) {
    state.phase = "battle";
    addLog(
      state,
      `${moved.definition.name}'s ${wasOpportunist ? "Opportunist" : "Propulsion"} play ended the Development Phase.`,
    );
  }
  return finishResolution(state);
}

export function playCreature(
  original: GameState,
  playerId: PlayerId,
  cardUid: string,
  laneIndex: number,
  convergentChoice?: ConvergentCategory,
): GameState {
  return playCreatureWithSource(original, playerId, cardUid, laneIndex, "normal", convergentChoice);
}

/** Aquatic Biome: once per game, a legal override that does not use the normal Creature play. */
export function playAquaticOverride(
  original: GameState,
  cardUid: string,
  laneIndex: number,
  convergentChoice?: ConvergentCategory,
): GameState {
  return playCreatureWithSource(original, original.activePlayer, cardUid, laneIndex, "aquatic", convergentChoice);
}

export function chooseConvergentCategory(original: GameState, category: ConvergentCategory): GameState {
  const pending = original.pendingConvergentChoice;
  if (!pending || !pending.categories.includes(category)) return clone(original);
  const state = clone(original);
  state.pendingConvergentChoice = null;
  return pending.source === "aquatic"
    ? playAquaticOverride(state, pending.cardUid, pending.laneIndex, category)
    : playCreature(state, pending.playerId, pending.cardUid, pending.laneIndex, category);
}

// ---------------------------------------------------------------------------
// Movement
// ---------------------------------------------------------------------------

/** Aquatic Biome: once per turn, move a Creature into an empty Niche without a fill trigger. */
export function repositionConnectedWaterway(
  original: GameState,
  sourceLane: number,
  destinationLane: number,
): GameState {
  const state = clone(original);
  if (!legalConnectedWaterwayDestinations(state, sourceLane).includes(destinationLane)) return state;
  const player = state.players[state.activePlayer];
  moveLaneOccupant(player.lanes[sourceLane]!, player.lanes[destinationLane]!);
  player.biome.waterwayRepositionTurn = state.turnNumber;
  addLog(
    state,
    `Connected Waterways repositioned ${player.lanes[destinationLane]!.creature!.card.definition.name} from Niche ${sourceLane + 1} to Niche ${destinationLane + 1} without triggering a fill effect.`,
  );
  return finishResolution(state);
}

export function moveFacultativeQuadrupedality(
  original: GameState,
  sourceLane: number,
  destinationLane: number,
): GameState {
  const state = clone(original);
  if (!legalFacultativeDestinations(state, sourceLane).includes(destinationLane)) return state;
  const player = state.players[state.activePlayer];
  const destination = player.lanes[destinationLane]!;
  moveLaneOccupant(player.lanes[sourceLane]!, destination);
  destination.creature!.facultativeMovedTurn = state.turnNumber;
  player.allowances.developmentActions += 1;
  addLog(
    state,
    `Facultative Quadrupedality moved ${destination.creature!.card.definition.name} from Niche ${sourceLane + 1} to adjacent Niche ${destinationLane + 1} without triggering entry effects.`,
  );
  return finishResolution(state);
}

// ---------------------------------------------------------------------------
// Adaptations
// ---------------------------------------------------------------------------

export function playAdaptation(
  original: GameState,
  cardUid: string,
  laneIndex: number,
  targetPlayer: PlayerId = original.activePlayer,
): GameState {
  const state = clone(original);
  const player = state.players[state.activePlayer];
  const card = player.hand.find((held) => held.uid === cardUid);
  if (!card || card.definition.kind !== "adaptation") return state;
  const legal = legalAdaptationTargets(state, card).some(
    (position) => position.playerId === targetPlayer && position.laneIndex === laneIndex,
  );
  if (!legal) return state;
  const moved = moveCardFromHand(player, cardUid) as AdaptationInstance;
  state.players[targetPlayer].lanes[laneIndex]!.attachment = moved;
  player.allowances.adaptationPlayed = true;
  player.allowances.developmentActions += 1;
  addLog(
    state,
    `${player.name} attached ${moved.definition.name} to ${state.players[targetPlayer].name}'s Creature in Niche ${laneIndex + 1}.`,
  );
  return finishResolution(state);
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export function playDrought(
  original: GameState,
  cardUid: string,
  targetPlayer: PlayerId,
  laneIndex: number,
): GameState {
  const state = clone(original);
  const player = state.players[state.activePlayer];
  const card = player.hand.find((held) => held.uid === cardUid);
  const legal =
    card &&
    legalDroughtTargets(state, card).some(
      (position) => position.playerId === targetPlayer && position.laneIndex === laneIndex,
    );
  if (!legal) return state;
  const targetLane = state.players[targetPlayer].lanes[laneIndex]!;
  const overriddenName = targetLane.creature?.card.definition.name ?? null;
  if (targetLane.creature) sendCreatureToHistory(state, targetPlayer, laneIndex, "override");
  const moved = moveCardFromHand(player, cardUid) as EventInstance;
  targetLane.drought = { card: moved, expiresOnTurn: nextTurnForPlayer(state, state.activePlayer) };
  player.allowances.eventPlayed = true;
  player.allowances.developmentActions += 1;
  addLog(state, `${player.name} placed Drought in ${state.players[targetPlayer].name}'s Niche ${laneIndex + 1}.`);
  if (overriddenName) addLog(state, `Drought overrode ${overriddenName}; normal override triggers applied.`);
  addLog(
    state,
    `That Niche is locked and its directly opposing Niche is suppressed through the end of ${player.name}'s next turn.`,
  );
  return finishResolution(state);
}

export function playWildfire(original: GameState, cardUid: string, laneIndex: number): GameState {
  const state = clone(original);
  const player = state.players[state.activePlayer];
  const card = player.hand.find((held) => held.uid === cardUid);
  if (!card || !legalWildfireLanes(state, card).includes(laneIndex)) return state;

  const ownLane = player.lanes[laneIndex]!;
  const opposingPlayer = otherPlayer(state.activePlayer);
  const opposingLane = state.players[opposingPlayer].lanes[laneIndex]!;
  const ownCreature = ownLane.creature?.card.definition.name;
  const opposingCreature = opposingLane.creature?.card.definition.name;

  if (ownLane.creature) sendCreatureToHistory(state, state.activePlayer, laneIndex, "override");
  if (opposingLane.creature) sendCreatureToHistory(state, opposingPlayer, laneIndex, "effect");

  const moved = moveCardFromHand(player, cardUid) as EventInstance;
  ownLane.wildfire = { card: moved, expiresOnTurn: nextTurnForPlayer(state, state.activePlayer) };
  player.allowances.eventPlayed = true;
  player.allowances.developmentActions += 1;

  addLog(state, `${player.name} played Wildfire into Niche ${laneIndex + 1} instead of the Event Zone.`);
  if (ownCreature) addLog(state, `Wildfire overrode ${ownCreature}; normal override triggers applied.`);
  if (opposingCreature) addLog(state, `Wildfire sent opposing ${opposingCreature} and its Adaptation to History.`);
  addLog(state, `Lane ${laneIndex + 1} is locked through the end of ${player.name}'s next turn.`);
  return finishResolution(state);
}

/** Plays an Event to the Event Zone, or resolves an instantaneous Event (Stampede, Geological Boundary). */
export function playEvent(original: GameState, cardUid: string): GameState {
  const state = clone(original);
  const player = state.players[state.activePlayer];
  const card = player.hand.find((held) => held.uid === cardUid);
  if (!card || card.definition.kind !== "event" || !canPlayEvent(state, card)) return state;

  const moved = moveCardFromHand(player, cardUid) as EventInstance;
  player.allowances.eventPlayed = true;
  player.allowances.developmentActions += 1;
  addLog(state, `${player.name} played ${moved.definition.name}.`);

  if (moved.definition.key === "geological-boundary") {
    state.pendingGeologicalBoundary = { card: moved };
    addLog(state, "Geological Boundary must declare a Time Period.");
    return state;
  }

  if (moved.definition.key === "stampede") {
    sendCardToHistory(state, moved, "Stampede began resolving");
    const opponent = otherPlayer(state.activePlayer);
    // Counter-clockwise: along the active player's row, then back along the opponent's.
    const order = [
      ...state.players[state.activePlayer].lanes.map((lane) => lane.creature),
      ...[...state.players[opponent].lanes].reverse().map((lane) => lane.creature),
    ]
      .filter((entry): entry is CreatureInPlay => entry?.card.definition.diet === "Herbivore")
      .map((entry) => entry.card.uid);
    state.pendingStampede = { owner: state.activePlayer, order, nextIndex: 0 };
    addLog(
      state,
      `Stampede began with ${order.length} participating ${order.length === 1 ? "Herbivore" : "Herbivores"}, proceeding counter-clockwise.`,
    );
    return continueStampede(state);
  }

  if (player.event) {
    addLog(state, `${player.event.definition.name} left ${player.name}'s Event Zone.`);
    sendCardToHistory(state, player.event, "Event replacement");
  }
  player.event = moved;
  if (
    moved.definition.key === "cambrian-explosion" &&
    player.lanes.some((lane) => lane.creature?.card.definition.printedLevel === 0)
  ) {
    drawOne(state, state.activePlayer, "Cambrian Explosion entry");
  }
  return finishResolution(state);
}

export function geologicalBoundaryOptions(state: GameState): Period[] {
  return state.pendingGeologicalBoundary ? [...PERIOD_SEQUENCE] : [];
}

export function chooseGeologicalBoundaryPeriod(original: GameState, period: Period): GameState {
  const state = clone(original);
  const pending = state.pendingGeologicalBoundary;
  if (!pending || !PERIOD_SEQUENCE.includes(period)) return state;
  const owner = pending.card.owner;
  let removed = 0;
  for (const playerId of [0, 1] as const) {
    state.players[playerId].lanes.forEach((lane, laneIndex) => {
      if (lane.creature?.card.definition.period === period) {
        sendCreatureToHistory(state, playerId, laneIndex, "effect");
        removed += 1;
      }
    });
  }
  for (const player of state.players) {
    if (player.event?.definition.eventType === "continuous") {
      const ended = player.event;
      sendCardToHistory(state, ended, "Geological Boundary");
      player.event = null;
      addLog(state, `${ended.definition.name} ended at the Geological Boundary.`);
    }
  }
  const succeeding = PERIOD_SEQUENCE[PERIOD_SEQUENCE.indexOf(period) + 1];
  if (succeeding) {
    state.periodAuras.push({ owner, period: succeeding, expiresAtTurnStart: nextTurnForPlayer(state, owner) });
  }
  sendCardToHistory(state, pending.card, "Geological Boundary resolved");
  state.pendingGeologicalBoundary = null;
  addLog(
    state,
    `Geological Boundary declared ${period} and removed ${removed} ${removed === 1 ? "Creature" : "Creatures"}.`,
  );
  if (succeeding) {
    addLog(
      state,
      `${succeeding} Creatures get +1 Battle Level until the start of ${state.players[owner].name}'s next turn.`,
    );
  } else {
    addLog(state, "Quaternary has no succeeding Time Period and created no Battle Level modifier.");
  }
  addLog(state, `${state.players[owner].name}'s turn ends without a Battle Phase.`);
  if (resolveVictoryThreshold(state)) return state;
  return endTurn(state);
}

// ---------------------------------------------------------------------------
// Carnian Pluvial Episode
// ---------------------------------------------------------------------------

export function activateCarnianPluvialEpisode(original: GameState): GameState {
  const state = clone(original);
  if (!canActivateCarnianPluvialEpisode(state)) return state;
  const player = state.players[state.activePlayer];
  player.allowances.carnianPluvialUsed = true;
  player.allowances.developmentActions += 1;
  state.pendingCarnianPluvial = { kind: "cost", sourceEventUid: player.event!.uid };
  addLog(state, `${player.name} activated Carnian Pluvial Episode.`);
  return state;
}

export function getCarnianPluvialOptions(state: GameState): ChoiceOption[] {
  if (!state.pendingCarnianPluvial) return [];
  return state.pendingCarnianPluvial.kind === "cost"
    ? carnianPluvialCostOptions(state)
    : carnianPluvialSearchOptions(state);
}

export function chooseCarnianPluvialOption(original: GameState, optionId: string): GameState {
  const state = clone(original);
  const pending = state.pendingCarnianPluvial;
  if (!pending || !getCarnianPluvialOptions(state).some((option) => option.id === optionId)) return state;
  const player = state.players[state.activePlayer];

  if (pending.kind === "cost") {
    const laneIndex = player.lanes.findIndex((lane) => lane.creature?.card.uid === optionId);
    if (laneIndex < 0) return state;
    const name = player.lanes[laneIndex]!.creature!.card.definition.name;
    sendCreatureToHistory(state, state.activePlayer, laneIndex, "effect");
    pending.kind = "search";
    addLog(state, `${name} was sent to History for Carnian Pluvial Episode.`);
    return state;
  }

  const card = takeDeckCard(player, optionId);
  if (!card || card.definition.kind !== "creature") return state;
  player.hand.push(card);
  player.deck = shuffle(state, player.deck);
  state.pendingCarnianPluvial = null;
  addLog(state, `Carnian Pluvial Episode found and revealed ${card.definition.name}; the deck was shuffled.`);
  return finishResolution(state);
}
