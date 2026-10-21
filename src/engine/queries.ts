import { type AdaptationCard, type CardDefinition, countsAsAquatic, type CreatureCard } from "../data/cards.ts";
import { hasLegalHunts } from "./battle-math.ts";
import {
  adjacentEmptyNiches,
  canActInDevelopment,
  creatureCanEnterNiche,
  creatureCanMoveByEffect,
  hasEnterableEmptyNiche,
  hasNoAdjacentFriendly,
  HAND_LIMIT,
  nicheIsLocked,
  playerHolds,
  adaptationSlotEmpty,
} from "./core.ts";
import { developmentGate, explainAquaticOverrideLane, explainCreatureLane } from "./legality.ts";
import { checkOverride } from "./override.ts";
import type { BoardPosition, CardInstance, ChoiceOption, GameState, PlayerId, Reason, Verdict } from "./types.ts";

/**
 * Read-only legality queries. Nothing here mutates state; every transition
 * re-checks the matching query before acting, so the UI can never perform an
 * illegal move even if it asks for one.
 */

// ---------------------------------------------------------------------------
// Creatures
// ---------------------------------------------------------------------------

/** Niches where `card` may be played now. Derived from {@link explainCreatureLane}, the source of truth. */
export function legalCreatureLanes(state: GameState, playerId: PlayerId, card: CardInstance): number[] {
  if (state.activePlayer !== playerId || card.definition.kind !== "creature") return [];
  return state.players[playerId].lanes.flatMap((_, index) =>
    explainCreatureLane(state, playerId, card, index).legal ? [index] : [],
  );
}

// ---------------------------------------------------------------------------
// Aquatic Biome: Connected Waterways
// ---------------------------------------------------------------------------

export function legalConnectedWaterwaySources(state: GameState): number[] {
  const player = state.players[state.activePlayer];
  if (
    !canActInDevelopment(state) ||
    player.biome.key !== "aquatic" ||
    !player.biome.waterwaysConnected ||
    player.biome.waterwayRepositionTurn === state.turnNumber ||
    !hasEnterableEmptyNiche(state, state.activePlayer)
  ) {
    return [];
  }
  return player.lanes.flatMap((lane, index) => (creatureCanMoveByEffect(lane) ? [index] : []));
}

export function legalConnectedWaterwayDestinations(state: GameState, sourceLane: number): number[] {
  if (!legalConnectedWaterwaySources(state).includes(sourceLane)) return [];
  return state.players[state.activePlayer].lanes.flatMap((lane, index) =>
    index !== sourceLane && !lane.creature && creatureCanEnterNiche(state, state.activePlayer, index) ? [index] : [],
  );
}

/** Niches where `card` may take the free Aquatic override. Derived from {@link explainAquaticOverrideLane}. */
export function legalAquaticOverrideLanes(state: GameState, card: CardInstance): number[] {
  if (card.definition.kind !== "creature") return [];
  return state.players[state.activePlayer].lanes.flatMap((_, index) =>
    explainAquaticOverrideLane(state, card, index).legal ? [index] : [],
  );
}

export function canUseAquaticOverride(state: GameState) {
  return state.players[state.activePlayer].hand.some((card) => legalAquaticOverrideLanes(state, card).length > 0);
}

// ---------------------------------------------------------------------------
// Facultative Quadrupedality
// ---------------------------------------------------------------------------

export function legalFacultativeSources(state: GameState): number[] {
  if (!canActInDevelopment(state)) return [];
  return state.players[state.activePlayer].lanes.flatMap((lane, laneIndex) =>
    lane.attachment?.definition.key === "facultative-quadrupedality" &&
    creatureCanMoveByEffect(lane) &&
    lane.creature?.facultativeMovedTurn !== state.turnNumber &&
    adjacentEmptyNiches(state, state.activePlayer, laneIndex).length
      ? [laneIndex]
      : [],
  );
}

export function legalFacultativeDestinations(state: GameState, sourceLane: number): number[] {
  return legalFacultativeSources(state).includes(sourceLane)
    ? adjacentEmptyNiches(state, state.activePlayer, sourceLane)
    : [];
}

// ---------------------------------------------------------------------------
// Adaptations
// ---------------------------------------------------------------------------

export function adaptationEligible(card: AdaptationCard, creature: CreatureCard) {
  switch (card.eligibility) {
    case "any":
      return true;
    case "raptorial-claws":
      return creature.visualTags.includes("Raptorial Claws");
    case "level-2-or-lower":
      return creature.printedLevel <= 2;
    case "saurischian":
      return creature.taxa.includes("Saurischian");
    case "ornithischian":
      return creature.taxa.includes("Ornithischian");
    case "herbivore-armament-retaliation":
      return (
        creature.diet === "Herbivore" && (creature.tags.includes("Armament") || creature.tags.includes("Retaliation"))
      );
    case "aquatic-or-lepidosaur":
      return creature.tags.includes("Aquatic") || creature.taxa.includes("Lepidosaur");
  }
}

export function legalAdaptationTargets(state: GameState, card: CardInstance): BoardPosition[] {
  if (!canActInDevelopment(state) || card.definition.kind !== "adaptation") return [];
  const player = state.players[state.activePlayer];
  if (player.allowances.adaptationPlayed || !playerHolds(player, card.uid)) return [];
  const adaptation = card.definition;
  // Island Dwarfism may be attached to either player's Creature.
  const targetPlayers: PlayerId[] = adaptation.key === "island-dwarfism" ? [0, 1] : [state.activePlayer];
  return targetPlayers.flatMap((playerId) =>
    state.players[playerId].lanes.flatMap((lane, laneIndex) => {
      if (!lane.creature || !adaptationSlotEmpty(lane)) return [];
      if (!adaptationEligible(adaptation, lane.creature.card.definition)) return [];
      if (adaptation.key === "island-dwarfism" && !hasNoAdjacentFriendly(state, playerId, laneIndex)) return [];
      return [{ playerId, laneIndex }];
    }),
  );
}

export function legalAdaptationLanes(state: GameState, card: CardInstance): number[] {
  return legalAdaptationTargets(state, card)
    .filter((position) => position.playerId === state.activePlayer)
    .map((position) => position.laneIndex);
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/** Events that are placed into a Niche rather than played to the Event Zone. */
export const NICHE_EVENT_KEYS = new Set(["wildfire", "drought"]);

const EVENT_PLAYED: Reason = { code: "event-played", text: "You've already played an Event this turn." };

/** Whether an Event can be played to the Event Zone (or resolved, if instantaneous), and why not. */
export function explainEvent(state: GameState, card: CardInstance): Verdict {
  const player = state.players[state.activePlayer];
  const reasons = [...developmentGate(state, state.activePlayer)];
  if (!reasons.length) {
    if (card.definition.kind !== "event") reasons.push({ code: "not-an-event", text: "That card isn't an Event." });
    else if (NICHE_EVENT_KEYS.has(card.definition.key)) {
      reasons.push({
        code: "niche-event",
        text: `${card.definition.name} is played into a Niche, not the Event Zone.`,
      });
    } else if (!playerHolds(player, card.uid)) {
      reasons.push({ code: "not-in-hand", text: "That card isn't in your hand." });
    } else if (player.allowances.eventPlayed) reasons.push(EVENT_PLAYED);
  }
  return { legal: reasons.length === 0, reasons };
}

export function canPlayEvent(state: GameState, card: CardInstance) {
  return explainEvent(state, card).legal;
}

function canPlayNicheEvent(state: GameState, card: CardInstance, key: string) {
  const player = state.players[state.activePlayer];
  return (
    canActInDevelopment(state) &&
    card.definition.kind === "event" &&
    card.definition.key === key &&
    playerHolds(player, card.uid) &&
    !player.allowances.eventPlayed
  );
}

export function legalDroughtTargets(state: GameState, card: CardInstance): BoardPosition[] {
  if (!canPlayNicheEvent(state, card, "drought")) return [];
  return ([0, 1] as const).flatMap((playerId) =>
    state.players[playerId].lanes.flatMap((lane, laneIndex) => {
      if (nicheIsLocked(state, playerId, laneIndex)) return [];
      if (!lane.creature) return [{ playerId, laneIndex }];
      if (!countsAsAquatic(lane.creature.card.definition)) return [];
      if (lane.creature.cannotOverrideOnTurn === state.turnNumber) return [];
      return [{ playerId, laneIndex }];
    }),
  );
}

export function legalWildfireLanes(state: GameState, card: CardInstance): number[] {
  if (!canPlayNicheEvent(state, card, "wildfire")) return [];
  return state.players[state.activePlayer].lanes.flatMap((lane, index) => {
    if (nicheIsLocked(state, state.activePlayer, index)) return [];
    if (lane.creature?.cannotOverrideOnTurn === state.turnNumber) return [];
    return [index];
  });
}

// ---------------------------------------------------------------------------
// Carnian Pluvial Episode
// ---------------------------------------------------------------------------

function hasDinosaurTaxon(card: CardDefinition) {
  return card.kind === "creature" && card.taxa.includes("Dinosaur");
}

export function carnianPluvialCostOptions(state: GameState): ChoiceOption[] {
  return state.players[state.activePlayer].lanes.flatMap((lane, index) => {
    const creature = lane.creature;
    if (!creature || hasDinosaurTaxon(creature.card.definition)) return [];
    return [
      {
        id: creature.card.uid,
        label: creature.card.definition.name,
        detail: `Level ${creature.card.definition.printedLevel} · Niche ${index + 1} · Non-Dinosaur`,
      },
    ];
  });
}

export function carnianPluvialSearchOptions(state: GameState): ChoiceOption[] {
  return state.players[state.activePlayer].deck.flatMap((card) =>
    card.definition.kind === "creature" && hasDinosaurTaxon(card.definition) && card.definition.printedLevel <= 2
      ? [
          {
            id: card.uid,
            label: card.definition.name,
            detail: `Level ${card.definition.printedLevel} · ${card.definition.period}`,
          },
        ]
      : [],
  );
}

export function canActivateCarnianPluvialEpisode(state: GameState) {
  const player = state.players[state.activePlayer];
  return (
    canActInDevelopment(state) &&
    player.event?.definition.key === "carnian-pluvial-episode" &&
    !player.allowances.carnianPluvialUsed &&
    player.hand.length < HAND_LIMIT &&
    carnianPluvialCostOptions(state).length > 0 &&
    carnianPluvialSearchOptions(state).length > 0
  );
}

// ---------------------------------------------------------------------------
// Concepts
// ---------------------------------------------------------------------------

/** Resourceful raises the Concept allowance to two; multiple instances do not stack. */
export function conceptAllowance(state: GameState, playerId: PlayerId) {
  return state.players[playerId].lanes.some((lane) => lane.creature?.card.definition.tags.includes("Resourceful"))
    ? 2
    : 1;
}

function hasPendingConceptEffect(state: GameState, playerId: PlayerId) {
  const allowances = state.players[playerId].allowances;
  return Boolean(state.pendingConceptChoice || allowances.convergentEvolution || allowances.rapidSpeciation);
}

function hasRapidTarget(state: GameState, playerId: PlayerId) {
  const player = state.players[playerId];
  return player.hand.some(
    (card) =>
      card.definition.kind === "creature" &&
      player.lanes.some(
        (lane, index) =>
          lane.creature && checkOverride(state, playerId, card.definition as CreatureCard, index, true).legal,
      ),
  );
}

/** Levels (0 and/or 1) Evolutionary Radiation may place: unrepresented on the board and held in hand. */
export function evolutionaryRadiationLevels(state: GameState, playerId: PlayerId): Array<0 | 1> {
  const player = state.players[playerId];
  const represented = new Set(
    player.lanes.flatMap((lane) => (lane.creature ? [lane.creature.card.definition.printedLevel] : [])),
  );
  return ([0, 1] as const).filter(
    (level) =>
      !represented.has(level) &&
      player.hand.some((card) => card.definition.kind === "creature" && card.definition.printedLevel === level),
  );
}

const isLevelZeroCreature = (card: CardInstance) =>
  card.definition.kind === "creature" && card.definition.printedLevel === 0;

export function abiogenesisModes(state: GameState) {
  const player = state.players[state.activePlayer];
  return {
    canSearch: player.deck.some(isLevelZeroCreature),
    canPlace: player.hand.some(isLevelZeroCreature) && hasEnterableEmptyNiche(state, state.activePlayer),
  };
}

/**
 * Concepts with a mandatory choice may be played only when that choice can be
 * made. Returns why it can't, or null when the choice is available.
 */
function missingRequiredChoice(state: GameState, key: string): Reason | null {
  const player = state.players[state.activePlayer];
  const missing = (text: string): Reason => ({ code: `${key}-unavailable`, text });
  switch (key) {
    case "evolutionary-radiation":
      return hasEnterableEmptyNiche(state, state.activePlayer) &&
        evolutionaryRadiationLevels(state, state.activePlayer).length > 0
        ? null
        : missing(
            "Needs an empty Niche and a Level 0 or 1 Creature in hand whose Level isn't already on your side of the board.",
          );
    case "whale-fall":
      return player.hand.some((card) => card.definition.kind === "creature" && card.definition.printedLevel >= 2)
        ? null
        : missing("Needs a Level 2 or higher Creature in your hand to send to History.");
    case "natural-selection":
      return player.hand.some((card) => card.definition.kind === "creature") &&
        player.deck.some((card) => card.definition.kind === "creature")
        ? null
        : missing("Needs a Creature in your hand to pay its cost and one in your deck to find.");
    case "dig-site-excavation":
      return player.history.some((card) => card.definition.key !== "dig-site-excavation")
        ? null
        : missing("Your History Pile has no card to excavate.");
    case "semelparity":
      return player.hand.some(isLevelZeroCreature) ||
        player.lanes.some((lane) => lane.creature?.card.definition.printedLevel === 0)
        ? null
        : missing("Needs a Level 0 Creature in your hand or on your side of the board.");
    case "obligate-migration":
      return state.players.some(
        (side) => side.lanes.some((lane) => creatureCanMoveByEffect(lane)) && hasEnterableEmptyNiche(state, side.id),
      )
        ? null
        : missing("Needs a Creature that can move and an empty Niche on the same side of the board.");
    case "abiogenesis": {
      const { canSearch, canPlace } = abiogenesisModes(state);
      return canSearch || canPlace
        ? null
        : missing("Needs a Level 0 Creature in your deck, or one in your hand and an empty Niche.");
    }
    default:
      return null;
  }
}

/** Whether a Concept can be played now, and why not. */
export function explainConcept(state: GameState, card: CardInstance): Verdict {
  const fail = (code: string, text: string): Verdict => ({ legal: false, reasons: [{ code, text }] });
  const gate = developmentGate(state, state.activePlayer);
  if (gate.length) return { legal: false, reasons: gate };
  const player = state.players[state.activePlayer];
  if (card.definition.kind !== "concept") return fail("not-a-concept", "That card isn't a Concept.");
  if (!playerHolds(player, card.uid)) return fail("not-in-hand", "That card isn't in your hand.");
  const allowance = conceptAllowance(state, state.activePlayer);
  if (player.allowances.conceptsPlayed >= allowance) {
    return allowance === 1
      ? fail("concept-limit", "You've already played a Concept this turn.")
      : fail("concept-limit", "You've already played both Concepts Resourceful allows this turn.");
  }
  if (hasPendingConceptEffect(state, state.activePlayer)) {
    return player.allowances.convergentEvolution
      ? fail("concept-pending", "Convergent Evolution is waiting for this turn's next override; make it first.")
      : player.allowances.rapidSpeciation
        ? fail("concept-pending", "Rapid Speciation's override must be made first.")
        : fail("concept-pending", "Finish resolving your current Concept first.");
  }
  if (card.definition.key === "rapid-speciation") {
    if (player.allowances.creaturePlayed) {
      return fail("rapid-after-creature", "Rapid Speciation must be played before your Creature play this turn.");
    }
    return hasRapidTarget(state, state.activePlayer)
      ? { legal: true, reasons: [] }
      : fail(
          "rapid-no-target",
          "Needs a Creature in your hand that could override one of yours exactly two Levels below it.",
        );
  }
  if (card.definition.key === "evolutionary-radiation" && player.turnsStarted <= 1) {
    return fail("radiation-first-turn", "Evolutionary Radiation can't be played on your first turn.");
  }
  const missing = missingRequiredChoice(state, card.definition.key);
  return missing ? { legal: false, reasons: [missing] } : { legal: true, reasons: [] };
}

export function canPlayConcept(state: GameState, card: CardInstance) {
  return explainConcept(state, card).legal;
}

// ---------------------------------------------------------------------------
// Turn-level
// ---------------------------------------------------------------------------

export function canPerformFullHandMulligan(state: GameState) {
  const player = state.players[state.activePlayer];
  return (
    canActInDevelopment(state) &&
    player.hand.length === HAND_LIMIT &&
    !player.fullHandMulliganUsed &&
    player.allowances.developmentActions === 0
  );
}

/** Used for Hand-Lock Extinction: does the player have anything legal to do this turn? */
export function hasAnyLegalTurnAction(state: GameState, playerId: PlayerId) {
  const player = state.players[playerId];
  if (playerId === state.activePlayer && canActivateCarnianPluvialEpisode(state)) return true;
  for (const card of player.hand) {
    const { kind, key } = card.definition;
    if (kind === "creature" && legalCreatureLanes(state, playerId, card).length) return true;
    if (kind === "adaptation" && legalAdaptationTargets(state, card).length) return true;
    if (key === "wildfire" && legalWildfireLanes(state, card).length) return true;
    if (key === "drought" && legalDroughtTargets(state, card).length) return true;
    if (kind === "event" && canPlayEvent(state, card)) return true;
    if (kind === "concept" && canPlayConcept(state, card)) return true;
  }
  return hasLegalHunts(state, playerId);
}
