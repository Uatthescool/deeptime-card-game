import { type CreatureCard, PERIODS, tagEffectMultiplier } from "../data/cards.ts";
import type {
  CardInstance,
  CreatureInPlay,
  CreatureInstance,
  FoundCreature,
  GameState,
  LaneState,
  PlayerId,
  PlayerState,
  TurnAllowances,
} from "./types.ts";

export const LANE_COUNT = 5;
export const HAND_LIMIT = 10;
export const VICTORY_THRESHOLD = 12;
/** Ending this many of your own turns in a row with a full hand forfeits the game. */
export const FULL_HAND_FORFEIT_TURNS = 2;
export const PERIOD_SEQUENCE = PERIODS;

const LOG_LIMIT = 100;
const DRAW_EVENT_LIMIT = 60;

export const otherPlayer = (player: PlayerId): PlayerId => (player === 0 ? 1 : 0);

/** Every transition works on a deep copy so callers' states are never mutated. */
export const clone = (state: GameState): GameState => structuredClone(state);

export const emptyAllowances = (): TurnAllowances => ({
  creaturePlayed: false,
  adaptationPlayed: false,
  eventPlayed: false,
  conceptsPlayed: 0,
  filledEmpty: false,
  developmentActions: 0,
  convergentEvolution: false,
  rapidSpeciation: false,
  carnianPluvialUsed: false,
  radiationPlacements: 0,
  skipBattlePhase: false,
  overriddenLanes: [],
  aquaticOverrideLockedLane: null,
  ancestorPlayUsed: false,
});

export const emptyLane = (): LaneState => ({
  creature: null,
  attachment: null,
  engulfed: null,
  wildfire: null,
  drought: null,
});

export function addLog(state: GameState, message: string) {
  state.log.push(message);
  if (state.log.length > LOG_LIMIT) state.log.splice(0, state.log.length - LOG_LIMIT);
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

/** Printed Tags plus those granted by Sovereign and Divergent. */
export function effectiveHasTag(creature: CreatureCard, tag: string) {
  if (creature.tags.includes(tag)) return true;
  if ((tag === "Transitional" || tag === "Ancestor") && creature.tags.includes("Divergent")) return true;
  if (!creature.tags.includes("Sovereign")) return false;
  if (tag === "Gigantic") return true;
  return tag === "Territorial" && creature.diet !== "Herbivore";
}

/** The Diet a Creature Hunts and is Hunted as: Filter Feeders count as Herbivores in Hunting checks. */
export function huntingDiet(creature: CreatureCard): CreatureCard["diet"] {
  return creature.tags.includes("Filter Feeder") ? "Herbivore" : creature.diet;
}

/** The Tag set a Creature contributes to an override comparison. */
export function overrideTags(creature: CreatureCard) {
  const tags = new Set(creature.tags);
  if (tags.has("Glider")) tags.add("Aerial");
  if (tags.has("Dermal Armor")) {
    tags.add("Shell");
    tags.add("Osteoderm");
  }
  // Scavenger counts as Mob Feeder for overrides only; it gains none of Mob Feeder's Hunt bonus.
  if (tags.has("Scavenger")) tags.add("Mob Feeder");
  if (tags.has("Sovereign")) {
    tags.add("Gigantic");
    if (creature.diet !== "Herbivore") tags.add("Territorial");
  }
  if (tags.has("Divergent")) {
    tags.add("Transitional");
    tags.add("Ancestor");
  }
  // Aquatic supplies exactly one override category: Taxon when the printed
  // Primary Taxa differ, or Tag when those Primary Taxa already match.
  tags.delete("Aquatic");
  tags.delete("Semi-Aquatic");
  tags.delete("Specialized");
  tags.delete("Herd");
  return tags;
}

// ---------------------------------------------------------------------------
// Board geometry and locks
// ---------------------------------------------------------------------------

/** Snowball Earth: a Frozen Niche and its Creature cannot be interacted with. */
export function nicheIsFrozen(lane: LaneState | undefined) {
  return typeof lane?.frozenUntilTurn === "number";
}

export function laneIsFrozen(state: GameState, laneIndex: number) {
  return state.players.some((player) => nicheIsFrozen(player.lanes[laneIndex]));
}

/** Whether nothing can be done with or to this Niche's Creature: it is Frozen or Burrowed. */
export function creatureIsUntouchable(lane: LaneState | undefined) {
  return nicheIsFrozen(lane) || typeof lane?.creature?.burrowedUntilTurn === "number";
}

export function laneIsLocked(state: GameState, laneIndex: number) {
  return laneIsFrozen(state, laneIndex) || state.players.some((player) => Boolean(player.lanes[laneIndex]?.wildfire));
}

export function nicheIsLocked(state: GameState, playerId: PlayerId, laneIndex: number) {
  return laneIsLocked(state, laneIndex) || Boolean(state.players[playerId].lanes[laneIndex]?.drought);
}

export function hasIslandDwarfism(lane: LaneState | undefined) {
  return lane?.attachment?.definition.key === "island-dwarfism";
}

export function creatureCanMoveByEffect(lane: LaneState | undefined) {
  return Boolean(
    lane?.creature &&
    !creatureIsUntouchable(lane) &&
    !hasIslandDwarfism(lane) &&
    !effectiveHasTag(lane.creature.card.definition, "Graviportal"),
  );
}

export function islandDwarfismBlocksEntry(state: GameState, playerId: PlayerId, laneIndex: number) {
  const lanes = state.players[playerId].lanes;
  return hasIslandDwarfism(lanes[laneIndex - 1]) || hasIslandDwarfism(lanes[laneIndex + 1]);
}

export function creatureCanEnterNiche(state: GameState, playerId: PlayerId, laneIndex: number) {
  return !nicheIsLocked(state, playerId, laneIndex) && !islandDwarfismBlocksEntry(state, playerId, laneIndex);
}

/**
 * Niche-unlock trial rule: whether an empty Niche is open to a Level 1 Creature. Without the rule every
 * empty Niche is open.
 */
export function nicheIsOpenToLevelOne(state: GameState, playerId: PlayerId, laneIndex: number) {
  if (!state.rules?.nicheUnlock) return true;
  const lanes = state.players[playerId].lanes;
  return Boolean(
    lanes[laneIndex]?.settled ||
    lanes[laneIndex - 1]?.creature ||
    lanes[laneIndex + 1]?.creature ||
    state.players[otherPlayer(playerId)].lanes[laneIndex]?.creature,
  );
}

/** Niche-unlock trial rule: marks every occupied Niche as one a Creature has lived in. */
export function markSettledNiches(state: GameState) {
  if (!state.rules?.nicheUnlock) return;
  for (const player of state.players) for (const lane of player.lanes) if (lane.creature) lane.settled = true;
}

export function hasEnterableEmptyNiche(state: GameState, playerId: PlayerId) {
  return state.players[playerId].lanes.some(
    (lane, index) => !lane.creature && creatureCanEnterNiche(state, playerId, index),
  );
}

export function enterableEmptyNiches(state: GameState, playerId: PlayerId) {
  return state.players[playerId].lanes.flatMap((lane, index) =>
    !lane.creature && creatureCanEnterNiche(state, playerId, index) ? [index] : [],
  );
}

export function adjacentEmptyNiches(state: GameState, playerId: PlayerId, laneIndex: number) {
  return [laneIndex - 1, laneIndex + 1].filter(
    (index) =>
      index >= 0 &&
      index < state.players[playerId].lanes.length &&
      !state.players[playerId].lanes[index]!.creature &&
      creatureCanEnterNiche(state, playerId, index),
  );
}

export function hasNoAdjacentFriendly(state: GameState, playerId: PlayerId, laneIndex: number) {
  const lanes = state.players[playerId].lanes;
  return !lanes[laneIndex - 1]?.creature && !lanes[laneIndex + 1]?.creature;
}

export function adaptationSlotEmpty(lane: LaneState) {
  return !lane.attachment && !lane.engulfed;
}

/** Moves a Creature, its Adaptation Slot, and any Engulfed card between lanes on one side. */
export function moveLaneOccupant(source: LaneState, destination: LaneState) {
  destination.creature = source.creature;
  destination.attachment = source.attachment;
  destination.engulfed = source.engulfed;
  source.creature = null;
  source.attachment = null;
  source.engulfed = null;
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export function findCreature(state: GameState, uid: string): FoundCreature | null {
  for (const playerId of [0, 1] as const) {
    const laneIndex = state.players[playerId].lanes.findIndex((lane) => lane.creature?.card.uid === uid);
    if (laneIndex >= 0) {
      const lane = state.players[playerId].lanes[laneIndex]!;
      return { playerId, laneIndex, lane, creature: lane.creature! };
    }
  }
  return null;
}

export function allCreatures(state: GameState) {
  return state.players.flatMap((player) => player.lanes.flatMap((lane) => (lane.creature ? [lane.creature] : [])));
}

export function handCardByUid(state: GameState, playerId: PlayerId, uid: string | null) {
  if (!uid) return null;
  return state.players[playerId].hand.find((card) => card.uid === uid) ?? null;
}

/** A full hand with cards still to draw: ending a turn like this counts toward the full-hand forfeit. */
export function handStalled(player: PlayerState) {
  return player.hand.length >= HAND_LIMIT && player.deck.length > 0;
}

/** True when ending the current turn as things stand would forfeit the game for the active player. */
export function endingTurnForfeits(state: GameState) {
  const player = state.players[state.activePlayer];
  return handStalled(player) && (player.fullHandTurns ?? 0) + 1 >= FULL_HAND_FORFEIT_TURNS;
}

export function playerHolds(player: PlayerState, uid: string) {
  return player.hand.some((held) => held.uid === uid);
}

/** Whether Ice Age is in either player's Event Zone; like other Continuous Events, it affects the whole board. */
export function iceAgeInPlay(state: GameState) {
  return state.players.some((player) => player.event?.definition.key === "ice-age");
}

/** Ice Age's Synapsids: from the Paleogene, Neogene or Quaternary, they match every Time Period for overrides. */
export const ICE_AGE_SYNAPSID_PERIODS: ReadonlySet<string> = new Set(["Paleogene", "Neogene", "Quaternary"]);
/** Ice Age's older Creatures: from these Periods, they contribute 1 less Victory Level. */
export const ICE_AGE_DIMINISHED_PERIODS: ReadonlySet<string> = new Set([
  "Cambrian",
  "Triassic",
  "Jurassic",
  "Cretaceous",
]);

/**
 * Sends a player's Event out of their Event Zone to History. When Ice Age leaves its owner's Event Zone, that
 * player's Creatures contribute no Victory Levels until the end of the owner's third turn after it left.
 */
export function removeEventFromZone(state: GameState, playerId: PlayerId, reason: string) {
  const player = state.players[playerId];
  const event = player.event;
  if (!event) return null;
  player.event = null;
  sendCardToHistory(state, event, reason);
  if (event.definition.key === "ice-age") {
    const throughTurn = nextTurnForPlayer(state, playerId) + 4;
    player.iceAgeAftermathThroughTurn = throughTurn;
    addLog(
      state,
      `Ice Age left ${player.name}'s Event Zone: ${player.name}'s Creatures contribute no Victory Levels through Turn ${throughTurn}.`,
    );
  }
  return event;
}

/** Whether a player is still in Ice Age's aftermath, when their Creatures contribute no Victory Levels. */
export function inIceAgeAftermath(state: GameState, playerId: PlayerId) {
  const throughTurn = state.players[playerId].iceAgeAftermathThroughTurn;
  return typeof throughTurn === "number" && state.turnNumber <= throughTurn;
}

export function activeCambrianExplosions(state: GameState) {
  return state.players.filter((player) => player.event?.definition.key === "cambrian-explosion").length;
}

/** The turn number on which `playerId` next begins a turn. */
export function nextTurnForPlayer(state: GameState, playerId: PlayerId) {
  return state.activePlayer === playerId ? state.turnNumber + 2 : state.turnNumber + 1;
}

// ---------------------------------------------------------------------------
// Zone movement
// ---------------------------------------------------------------------------

export function moveCardFromHand(player: PlayerState, uid: string) {
  const index = player.hand.findIndex((card) => card.uid === uid);
  if (index < 0) return null;
  return player.hand.splice(index, 1)[0]!;
}

export function takeDeckCard(player: PlayerState, uid: string) {
  const index = player.deck.findIndex((card) => card.uid === uid);
  if (index < 0) return null;
  return player.deck.splice(index, 1)[0]!;
}

export function drawOne(state: GameState, playerId: PlayerId, reason: string): CardInstance | null {
  const player = state.players[playerId];
  if (player.hand.length >= HAND_LIMIT) {
    addLog(state, `${player.name}'s ${reason} draw failed because their hand is full.`);
    return null;
  }
  const card = player.deck.shift();
  if (!card) {
    addLog(state, `${player.name}'s ${reason} draw did nothing because their deck is empty.`);
    return null;
  }
  player.hand.push(card);
  state.drawEvents.push({ id: state.nextDrawEventId, playerId, cardUid: card.uid, reason });
  state.nextDrawEventId += 1;
  if (state.drawEvents.length > DRAW_EVENT_LIMIT)
    state.drawEvents.splice(0, state.drawEvents.length - DRAW_EVENT_LIMIT);
  addLog(state, `${player.name} drew a card (${reason}).`);
  return card;
}

export function sendCardToHistory(state: GameState, card: CardInstance, reason = "effect") {
  state.players[card.owner].history.push(card);
  if (card.definition.key === "dental-battery") {
    drawOne(state, card.owner, "Dental Battery");
    addLog(state, `${state.players[card.owner].name} drew 1 card because Dental Battery entered History (${reason}).`);
  }
}

function moveAdaptationSlotToHistory(state: GameState, lane: LaneState) {
  const attachment = lane.attachment ?? null;
  if (attachment) {
    sendCardToHistory(state, attachment, "attached Creature left play");
    lane.attachment = null;
  }
  if (lane.engulfed) {
    const engulfed = lane.engulfed;
    sendCardToHistory(state, engulfed, "Engulf slot left play");
    lane.engulfed = null;
    addLog(state, `${engulfed.definition.name} left an Engulf slot and entered its owner's History Pile.`);
  }
  return attachment;
}

/**
 * Sends the Creature in a Niche to its owner's History Pile. `huntInitiatorUid` is the Creature that
 * initiated the Hunt this happened in, if any; Scavenger ignores a departure its own Hunt caused.
 */
export function sendCreatureToHistory(
  state: GameState,
  playerId: PlayerId,
  laneIndex: number,
  reason: "battle" | "override" | "effect",
  huntInitiatorUid: string | null = null,
) {
  const player = state.players[playerId];
  const lane = player.lanes[laneIndex]!;
  if (!lane.creature) return null;
  const attachment = moveAdaptationSlotToHistory(state, lane);
  const card = lane.creature.card;
  sendCardToHistory(state, card, reason);
  lane.creature = null;

  if (reason === "override" && attachment?.definition.key === "autotomy") {
    addLog(state, `Autotomy entered History when ${card.definition.name} was overridden.`);
    drawOne(state, playerId, "Autotomy override");
  }

  if (reason !== "battle" && card.definition.tags.includes("Living Fossil") && !card.livingFossilUsed) {
    card.livingFossilUsed = true;
    player.returnQueue.push(card.uid);
    addLog(state, `${card.definition.name} was marked for its once-per-game Living Fossil return.`);
  }
  resolveScavenger(state, playerId, laneIndex, huntInitiatorUid);
  return card;
}

/** Scavenger: the opposing Creature facing one that left play draws, unless that came from its own Hunt. */
function resolveScavenger(
  state: GameState,
  departedOwner: PlayerId,
  laneIndex: number,
  huntInitiatorUid: string | null,
) {
  const scavengerPlayer = otherPlayer(departedOwner);
  const lane = state.players[scavengerPlayer].lanes[laneIndex];
  const scavenger = lane?.creature;
  if (!scavenger || !scavenger.card.definition.tags.includes("Scavenger") || nicheIsFrozen(lane)) return;
  if (scavenger.card.uid === huntInitiatorUid) return;
  const draws = tagEffectMultiplier(scavenger.card.definition, "Scavenger");
  addLog(state, `${scavenger.card.definition.name}'s Scavenger drew ${draws} ${draws === 1 ? "card" : "cards"}.`);
  for (let index = 0; index < draws; index += 1) drawOne(state, scavengerPlayer, "Scavenger");
}

export function makeCreatureInPlay(card: CreatureInstance, turnNumber: number, ownerNextTurn: number): CreatureInPlay {
  return {
    card,
    enteredTurn: turnNumber,
    lastAttackTurn: null,
    attackedTurn: null,
    elusiveUsedTurn: null,
    mobFeederTriggeredTurn: null,
    mobFeederBonusTurn: null,
    burrowedUntilTurn: card.definition.tags.includes("Burrower") ? ownerNextTurn : null,
    cannotAttackOnTurn: null,
    cannotOverrideOnTurn: null,
    attackBarriers: [],
    visualUsed: false,
    deimaticProtectedThroughTurn: null,
    bastionDefendedTurn: null,
    bastionAttackedTurn: null,
    facultativeMovedTurn: null,
  };
}

/** Places a Creature from hand into an empty Niche outside the normal Creature play. */
export function placeCreatureFromHand(state: GameState, playerId: PlayerId, cardUid: string, laneIndex: number) {
  const player = state.players[playerId];
  const card = moveCardFromHand(player, cardUid);
  if (!card || card.definition.kind !== "creature") return null;
  player.lanes[laneIndex]!.creature = makeCreatureInPlay(
    card as CreatureInstance,
    state.turnNumber,
    nextTurnForPlayer(state, playerId),
  );
  return card as CreatureInstance;
}

// ---------------------------------------------------------------------------
// Resolution status
// ---------------------------------------------------------------------------

/** True while a choice or confirmation must be resolved before normal play continues. */
export function resolutionBlocked(state: GameState) {
  return Boolean(
    state.handoff ||
    state.pendingBattle ||
    state.pendingHerd ||
    state.pendingNesting ||
    state.entryEffectQueue.length ||
    state.pendingCranialDisplay ||
    state.pendingConvergentChoice ||
    state.pendingConceptChoice ||
    state.pendingCarnianPluvial ||
    state.pendingBiodiversity ||
    state.pendingFilterFeeder ||
    state.pendingGeologicalBoundary ||
    state.pendingGreatDying ||
    state.pendingEngulf,
  );
}

/** True once the game has ended, by a win or a draw. */
export function isGameOver(state: GameState) {
  return state.phase === "game-over";
}

/** True when the active player may take an ordinary Development Phase action. */
export function canActInDevelopment(state: GameState) {
  return state.phase === "development" && !resolutionBlocked(state) && !isGameOver(state);
}
