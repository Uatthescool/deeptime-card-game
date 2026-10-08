import {
  countsAsAquatic,
  DECKS,
  hasPrintedAquatic,
  tagEffectMultiplier,
  type AdaptationCard,
  type CardDefinition,
  type ConceptCard,
  type CreatureCard,
  type DeckKey,
  type EventCard,
  type Period,
} from "./game-data.ts";
import type { BiomeKey } from "./biomes.ts";

export type PlayerId = 0 | 1;
export type Phase = "handoff" | "start" | "development" | "battle" | "game-over";

export type CardInstance = {
  uid: string;
  owner: PlayerId;
  definition: CardDefinition;
  livingFossilUsed?: boolean;
};

export type AttackBarrier = {
  targetUid: string;
  expiresOnTurn: number;
};

export type CreatureInPlay = {
  card: CardInstance & { definition: CreatureCard };
  enteredTurn: number;
  lastAttackTurn: number | null;
  attackedTurn: number | null;
  elusiveUsedTurn: number | null;
  mobFeederTriggeredTurn: number | null;
  mobFeederBonusTurn: number | null;
  burrowedUntilTurn: number | null;
  cannotAttackOnTurn: number | null;
  cannotOverrideOnTurn: number | null;
  attackBarriers: AttackBarrier[];
  visualUsed?: boolean;
  deimaticProtectedThroughTurn: number | null;
  bastionDefendedTurn: number | null;
  bastionAttackedTurn: number | null;
  facultativeMovedTurn: number | null;
};

export type WildfireInPlay = {
  card: CardInstance & { definition: EventCard };
  expiresOnTurn: number;
};

export type DroughtInPlay = {
  card: CardInstance & { definition: EventCard };
  expiresOnTurn: number;
};

export type LaneState = {
  creature: CreatureInPlay | null;
  attachment: (CardInstance & { definition: AdaptationCard }) | null;
  engulfed?: (CardInstance & { definition: CreatureCard }) | null;
  wildfire?: WildfireInPlay | null;
  drought?: DroughtInPlay | null;
};

export type TurnAllowances = {
  creaturePlayed: boolean;
  adaptationPlayed: boolean;
  eventPlayed: boolean;
  conceptsPlayed: number;
  filledEmpty: boolean;
  developmentActions: number;
  convergentEvolution: boolean;
  rapidSpeciation: boolean;
  carnianPluvialUsed: boolean;
  radiationPlacements: number;
  skipBattlePhase: boolean;
  overriddenLanes: number[];
  aquaticOverrideLockedLane: number | null;
};

export type BiomeState = {
  key: BiomeKey | null;
  seasonCounters: number;
  temperateRerollTurn: number | null;
  waterwaysConnected: boolean;
  waterwayRepositionTurn: number | null;
  freeOverrideUsed: boolean;
};

export type PlayerState = {
  id: PlayerId;
  name: string;
  deckKey: DeckKey;
  deck: CardInstance[];
  hand: CardInstance[];
  history: CardInstance[];
  lanes: LaneState[];
  event: (CardInstance & { definition: EventCard }) | null;
  returnQueue: string[];
  fullHandMulliganUsed: boolean;
  turnsStarted: number;
  herdTriggeredTurn: number | null;
  overreachTriggeredTurn: number | null;
  overreachQueuedDraws: number;
  overreachDueTurn: number | null;
  allowances: TurnAllowances;
  biome: BiomeState;
};

export type DrawEvent = {
  id: number;
  playerId: PlayerId;
  cardUid: string;
  reason: string;
};

export type BattlePreview = {
  attackerUid: string;
  defenderUid: string;
  attackerPlayer: PlayerId;
  attackerLane: number;
  defenderPlayer: PlayerId;
  defenderLane: number;
  attackerLevel: number;
  attackerLevelMax: number;
  defenderLevel: number;
  attackerNotes: string[];
  defenderNotes: string[];
  coinPlan: BattleCoinPlan;
  origin: "battle-phase" | "stampede";
};

export type PendingEntryEffect = {
  kind: "herd" | "nesting" | "cranial-display" | "filter-feeder";
  sourceUid: string;
  playerId: PlayerId;
};

export type PendingHerd = {
  sourceUid: string;
  playerId: PlayerId;
  eligibleUids: string[];
};

export type PendingNesting = {
  sourceUid: string;
  playerId: PlayerId;
  stage: "card" | "lane";
  eligibleUids: string[];
  selectedCardUid?: string;
};

export type PendingStampede = {
  owner: PlayerId;
  order: string[];
  nextIndex: number;
};

export type BattleCoinPlan = {
  offensiveCount: number;
  offensiveReason: string | null;
  defensiveCount: number;
  defensiveReason: string | null;
};

export type BattleCoinResults = {
  offensive?: boolean[];
  defensive?: boolean[];
};

export type PendingConceptChoice = {
  card: CardInstance & { definition: ConceptCard };
  kind:
    | "evolutionary-radiation-card"
    | "evolutionary-radiation-lane"
    | "whale-fall"
    | "natural-selection-cost"
    | "natural-selection-search"
    | "genetic-drift-discard"
    | "dig-site"
    | "semelparity-cost"
    | "semelparity-replacement-card"
    | "semelparity-replacement-lane"
    | "obligate-migration-source"
    | "obligate-migration-destination"
    | "abiogenesis-mode"
    | "abiogenesis-search"
    | "abiogenesis-placement-card"
    | "abiogenesis-placement-lane";
  selectedCardUid?: string;
  sourceLane?: number;
  sourcePlayer?: PlayerId;
  eligibleUids?: string[];
  radiationRemainingLevels?: Array<0 | 1>;
  radiationPlacements?: number;
};

export type ConceptChoiceOption = {
  id: string;
  label: string;
  detail: string;
};

export type PendingCarnianPluvial = {
  kind: "cost" | "search";
  sourceEventUid: string;
};

export type HandoffState = {
  kind: "turn";
  to: PlayerId;
  title: string;
  detail: string;
};

export type GameState = {
  players: [PlayerState, PlayerState];
  activePlayer: PlayerId;
  turnNumber: number;
  phase: Phase;
  handoff: HandoffState | null;
  pendingBattle: BattlePreview | null;
  entryEffectQueue: PendingEntryEffect[];
  pendingHerd: PendingHerd | null;
  pendingNesting: PendingNesting | null;
  endTurnAfterEntryEffects: boolean;
  pendingStampede: PendingStampede | null;
  pendingCranialDisplay: { sourceUid: string; eligibleTargetUids: string[] } | null;
  pendingConvergentChoice: {
    playerId: PlayerId;
    cardUid: string;
    laneIndex: number;
    categories: Array<"diet" | "period" | "taxon">;
    source?: "normal" | "aquatic";
  } | null;
  pendingConceptChoice: PendingConceptChoice | null;
  pendingCarnianPluvial: PendingCarnianPluvial | null;
  pendingBiodiversity: { playerId: PlayerId; cardUids: [string, string] } | null;
  pendingFilterFeeder: { playerId: PlayerId; sourceUid: string; cardUids: [string, string] } | null;
  pendingGeologicalBoundary: { card: CardInstance & { definition: EventCard } } | null;
  pendingEngulf: { holderPlayer: PlayerId; holderLane: number; defeatedOwner: PlayerId; defeatedUid: string } | null;
  periodAuras: Array<{ owner: PlayerId; period: Period; expiresAtTurnStart: number }>;
  winner: PlayerId | null;
  winReason: string | null;
  log: string[];
  seedLabel: string;
  drawEvents: DrawEvent[];
  nextDrawEventId: number;
};

export type OverrideCheck = {
  legal: boolean;
  matches: { diet: boolean; period: boolean; taxon: boolean; tag: boolean };
  matchCount: number;
  levelLegal: boolean;
  convergentCategory: "diet" | "period" | "taxon" | null;
  convergentOptions: Array<"diet" | "period" | "taxon">;
  reasons: string[];
};

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
});

function createBiomeState(key: BiomeKey | null): BiomeState {
  return {
    key,
    seasonCounters: key === "temperate" ? 4 : 0,
    temperateRerollTurn: null,
    waterwaysConnected: key === "aquatic",
    waterwayRepositionTurn: null,
    freeOverrideUsed: false,
  };
}

const clone = (state: GameState): GameState => structuredClone(state);
const otherPlayer = (player: PlayerId): PlayerId => (player === 0 ? 1 : 0);

export function laneIsLocked(state: GameState, laneIndex: number) {
  return state.players.some((player) => Boolean(player.lanes[laneIndex]?.wildfire));
}

export function nicheIsLocked(state: GameState, playerId: PlayerId, laneIndex: number) {
  return laneIsLocked(state, laneIndex) || Boolean(state.players[playerId].lanes[laneIndex]?.drought);
}

function hasIslandDwarfism(lane: LaneState | undefined) {
  return lane?.attachment?.definition.key === "island-dwarfism";
}

function creatureCanMoveByEffect(lane: LaneState | undefined) {
  return Boolean(
    lane?.creature &&
    !hasIslandDwarfism(lane) &&
    !effectiveHasTag(lane.creature.card.definition, "Graviportal"),
  );
}

function islandDwarfismBlocksEntry(state: GameState, playerId: PlayerId, laneIndex: number) {
  const lanes = state.players[playerId].lanes;
  return hasIslandDwarfism(lanes[laneIndex - 1]) || hasIslandDwarfism(lanes[laneIndex + 1]);
}

function creatureCanEnterNiche(state: GameState, playerId: PlayerId, laneIndex: number) {
  return !nicheIsLocked(state, playerId, laneIndex) && !islandDwarfismBlocksEntry(state, playerId, laneIndex);
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function makeDeck(owner: PlayerId, deckKey: DeckKey): CardInstance[] {
  return shuffle(
    DECKS[deckKey].map((definition) => ({
      uid: `${owner}-${definition.key}`,
      owner,
      definition,
      livingFossilUsed: false,
    })),
  );
}

function hasStarter(hand: CardInstance[]) {
  return hand.some(
    (card) =>
      card.definition.kind === "creature" &&
      card.definition.printedLevel <= 1,
  );
}

function drawOpeningHand(player: PlayerState) {
  for (let attempts = 0; attempts < 50; attempts += 1) {
    player.deck = shuffle([...player.deck, ...player.hand]);
    player.hand = player.deck.splice(0, 5);
    if (hasStarter(player.hand)) return;
  }
}

export function createGame(
  playerOne: string,
  playerTwo: string,
  biomes: [BiomeKey | null, BiomeKey | null] = [null, null],
  decks: [DeckKey, DeckKey] = ["deck-1", "deck-1"],
): GameState {
  const first = (Math.random() < 0.5 ? 0 : 1) as PlayerId;
  const makePlayer = (id: PlayerId, name: string): PlayerState => ({
    id,
    name: name.trim() || `Player ${id + 1}`,
    deckKey: decks[id],
    deck: makeDeck(id, decks[id]),
    hand: [],
    history: [],
    lanes: Array.from({ length: 5 }, () => ({ creature: null, attachment: null, engulfed: null, wildfire: null, drought: null })),
    event: null,
    returnQueue: [],
    fullHandMulliganUsed: false,
    turnsStarted: 0,
    herdTriggeredTurn: null,
    overreachTriggeredTurn: null,
    overreachQueuedDraws: 0,
    overreachDueTurn: null,
    allowances: emptyAllowances(),
    biome: createBiomeState(biomes[id]),
  });
  const players: [PlayerState, PlayerState] = [
    makePlayer(0, playerOne),
    makePlayer(1, playerTwo),
  ];

  drawOpeningHand(players[0]);
  drawOpeningHand(players[1]);

  return {
    players,
    activePlayer: first,
    turnNumber: 1,
    phase: "handoff",
    handoff: {
      kind: "turn",
      to: first,
      title: `${players[first].name} goes first`,
      detail: "Pass the device without showing either opening hand.",
    },
    pendingBattle: null,
    entryEffectQueue: [],
    pendingHerd: null,
    pendingNesting: null,
    endTurnAfterEntryEffects: false,
    pendingStampede: null,
    pendingCranialDisplay: null,
    pendingConvergentChoice: null,
    pendingConceptChoice: null,
    pendingCarnianPluvial: null,
    pendingBiodiversity: null,
    pendingFilterFeeder: null,
    pendingGeologicalBoundary: null,
    pendingEngulf: null,
    periodAuras: [],
    winner: null,
    winReason: null,
    log: [
      `${players[first].name} won the opening roll.`,
      "Both players drew legal five-card opening hands from their selected 40-card decks.",
    ],
    seedLabel: Math.random().toString(36).slice(2, 8).toUpperCase(),
    drawEvents: [],
    nextDrawEventId: 1,
  };
}

function addLog(state: GameState, message: string) {
  state.log.push(message);
  if (state.log.length > 100) state.log.splice(0, state.log.length - 100);
}

function drawOne(state: GameState, playerId: PlayerId, reason: string): CardInstance | null {
  const player = state.players[playerId];
  if (player.hand.length >= 10) {
    addLog(state, `${player.name}'s ${reason} draw failed because their hand is full.`);
    return null;
  }
  const card = player.deck.shift();
  if (!card) {
    addLog(state, `${player.name}'s ${reason} draw did nothing because their deck is empty.`);
    return null;
  }
  player.hand.push(card);
  state.drawEvents.push({
    id: state.nextDrawEventId,
    playerId,
    cardUid: card.uid,
    reason,
  });
  state.nextDrawEventId += 1;
  if (state.drawEvents.length > 60) state.drawEvents.splice(0, state.drawEvents.length - 60);
  addLog(state, `${player.name} drew a card (${reason}).`);
  return card;
}

function sendCardToHistory(state: GameState, card: CardInstance, reason = "effect") {
  state.players[card.owner].history.push(card);
  if (card.definition.key === "dental-battery") {
    drawOne(state, card.owner, "Dental Battery");
    addLog(state, `${state.players[card.owner].name} drew 1 card because Dental Battery entered History (${reason}).`);
  }
}

function activeCambrianExplosions(state: GameState) {
  return state.players.filter(
    (player) => player.event?.definition.key === "cambrian-explosion",
  ).length;
}

function scheduledStartPhaseDraws(state: GameState) {
  const player = state.players[state.activePlayer];
  const overreach = player.overreachDueTurn !== null && player.overreachDueTurn <= state.turnNumber
    ? player.overreachQueuedDraws
    : 0;
  return 1 + activeCambrianExplosions(state) + overreach;
}

function returnLivingFossils(state: GameState, playerId: PlayerId) {
  const player = state.players[playerId];
  const remaining: string[] = [];
  for (const uid of player.returnQueue) {
    if (player.hand.length >= 10) {
      remaining.push(uid);
      continue;
    }
    const historyIndex = player.history.findIndex((card) => card.uid === uid);
    if (historyIndex < 0) continue;
    const [card] = player.history.splice(historyIndex, 1);
    player.hand.push(card);
    addLog(state, `${card.definition.name} returned from History to ${player.name}'s hand.`);
  }
  player.returnQueue = remaining;
}

function beginTurn(state: GameState) {
  const player = state.players[state.activePlayer];
  const expiredAuras = state.periodAuras.filter(
    (aura) => aura.owner === state.activePlayer && aura.expiresAtTurnStart <= state.turnNumber,
  );
  if (expiredAuras.length) {
    state.periodAuras = state.periodAuras.filter(
      (aura) => !(aura.owner === state.activePlayer && aura.expiresAtTurnStart <= state.turnNumber),
    );
    addLog(state, `${player.name}'s Geological Boundary modifier ended at the start of the turn.`);
  }
  player.turnsStarted += 1;
  player.allowances = emptyAllowances();

  for (const lane of player.lanes) {
    if (lane.creature?.burrowedUntilTurn === state.turnNumber) {
      lane.creature.burrowedUntilTurn = null;
    }
    if (lane.creature) {
      lane.creature.attackBarriers = lane.creature.attackBarriers.filter(
        (barrier) => barrier.expiresOnTurn >= state.turnNumber,
      );
    }
  }

  addLog(state, `Turn ${state.turnNumber}: ${player.name}'s Start Phase began.`);

  if (
    player.biome.key === "arid" &&
    state.turnNumber >= 26 &&
    victoryTotals(state)[state.activePlayer] >= 10 &&
    state.players[otherPlayer(state.activePlayer)].lanes.every((lane) => !lane.creature)
  ) {
    state.winner = state.activePlayer;
    state.winReason = `${player.name} crossed the Arid Tipping Point with 10 or more Victory Levels against an empty ecosystem.`;
    state.phase = "game-over";
    state.handoff = null;
    addLog(state, `${player.name} won through the Arid Tipping Point.`);
    return;
  }

  drawOne(state, state.activePlayer, "normal Start Phase");
  returnLivingFossils(state, state.activePlayer);

  const cambrians = activeCambrianExplosions(state);
  for (let draw = 0; draw < cambrians; draw += 1) {
    drawOne(state, state.activePlayer, "Cambrian Explosion");
  }

  if (player.overreachDueTurn !== null && player.overreachDueTurn <= state.turnNumber) {
    const queued = player.overreachQueuedDraws;
    player.overreachQueuedDraws = 0;
    player.overreachDueTurn = null;
    for (let draw = 0; draw < queued; draw += 1) {
      drawOne(state, state.activePlayer, "Overreach");
    }
    if (queued) addLog(state, `${player.name} resolved ${queued} queued Overreach ${queued === 1 ? "draw" : "draws"}.`);
  }

  state.phase = "development";
  state.handoff = null;
  addLog(state, `${player.name} entered the Development Phase.`);

  if (
    player.fullHandMulliganUsed &&
    player.hand.length === 10 &&
    !hasAnyLegalTurnAction(state, state.activePlayer)
  ) {
    const winner = otherPlayer(state.activePlayer);
    state.winner = winner;
    state.winReason = `${player.name} suffered Hand-Lock Extinction.`;
    state.phase = "game-over";
    addLog(state, `${state.players[winner].name} won by Hand-Lock Extinction.`);
  }
}

export function acknowledgeHandoff(original: GameState): GameState {
  const state = clone(original);
  if (!state.handoff) return state;
  state.handoff = null;
  const player = state.players[state.activePlayer];
  if (
    player.biome.key === "tropical" &&
    scheduledStartPhaseDraws(state) === 1 &&
    player.deck.length >= 2
  ) {
    state.phase = "start";
    state.pendingBiodiversity = {
      playerId: state.activePlayer,
      cardUids: [player.deck[0].uid, player.deck[1].uid],
    };
    addLog(state, `${player.name}'s Biodiversity revealed two possible next draws.`);
    return state;
  }
  beginTurn(state);
  return state;
}

export function chooseBiodiversityTop(original: GameState, cardUid: string): GameState {
  const state = clone(original);
  const pending = state.pendingBiodiversity;
  if (!pending || !pending.cardUids.includes(cardUid)) return state;
  const player = state.players[pending.playerId];
  const first = player.deck[0];
  const second = player.deck[1];
  if (!first || !second || !pending.cardUids.includes(first.uid) || !pending.cardUids.includes(second.uid)) return state;
  if (second.uid === cardUid) [player.deck[0], player.deck[1]] = [second, first];
  addLog(state, `${player.name} used Biodiversity to order the next two cards.`);
  state.pendingBiodiversity = null;
  beginTurn(state);
  return state;
}

export function effectiveHasTag(creature: CreatureCard, tag: string) {
  if (creature.tags.includes(tag)) return true;
  if (!creature.tags.includes("Sovereign")) return false;
  if (tag === "Gigantic") return true;
  return tag === "Territorial" && creature.diet !== "Herbivore";
}

function overrideTags(creature: CreatureCard) {
  const tags = new Set(creature.tags);
  if (tags.has("Glider")) tags.add("Aerial");
  if (tags.has("Dermal Armor")) {
    tags.add("Shell");
    tags.add("Osteoderm");
  }
  if (tags.has("Sovereign")) {
    tags.add("Gigantic");
    if (creature.diet !== "Herbivore") tags.add("Territorial");
  }
  // Aquatic supplies exactly one override category: Taxon when the printed
  // Primary Taxa differ, or Tag when those Primary Taxa already match.
  tags.delete("Aquatic");
  tags.delete("Semi-Aquatic");
  tags.delete("Specialized");
  tags.delete("Herd");
  return tags;
}

function eligibleTagIntersection(a: CreatureCard, b: CreatureCard) {
  const excluded = new Set(["Apex Predator", "Aquatic", "Semi-Aquatic", "Generalist", "Herd", "Living Fossil", "Transitional", "Specialized"]);
  const aTags = overrideTags(a);
  const bTags = overrideTags(b);
  return [...aTags].some((tag) => bTags.has(tag) && !excluded.has(tag));
}

export function checkOverride(
  state: GameState,
  playerId: PlayerId,
  incoming: CreatureCard,
  laneIndex: number,
  rapid = false,
  convergentChoice?: "diet" | "period" | "taxon",
): OverrideCheck {
  const lane = state.players[playerId].lanes[laneIndex];
  const current = lane?.creature?.card.definition;
  const reasons: string[] = [];
  if (nicheIsLocked(state, playerId, laneIndex)) {
    return {
      legal: false,
      matches: { diet: false, period: false, taxon: false, tag: false },
      matchCount: 0,
      levelLegal: false,
      convergentCategory: null,
      convergentOptions: [],
      reasons: [lane?.drought ? "Drought locks this Niche." : "Wildfire locks this entire lane."],
    };
  }
  if (!current || !lane.creature) {
    return {
      legal: false,
      matches: { diet: false, period: false, taxon: false, tag: false },
      matchCount: 0,
      levelLegal: false,
      convergentCategory: null,
      convergentOptions: [],
      reasons: ["The Niche is empty."],
    };
  }

  if (lane.creature.cannotOverrideOnTurn === state.turnNumber) {
    reasons.push("Raptorial prevents this Creature from being overridden this turn.");
  }
  if (islandDwarfismBlocksEntry(state, playerId, laneIndex)) {
    reasons.push("Island Dwarfism prevents a Creature from entering this adjacent Niche.");
  }
  if (hasIslandDwarfism(lane) && effectiveHasTag(incoming, "Gigantic")) {
    reasons.push("Island Dwarfism prevents a Creature with Gigantic from overriding this Creature.");
  }

  const incomingTags = overrideTags(incoming);
  const currentTags = overrideTags(current);
  const difference = incoming.printedLevel - current.printedLevel;
  const airSacsAttached = lane.attachment?.definition.key === "air-sacs";
  const airSacsJump = Boolean(
    airSacsAttached &&
    difference === 2 &&
    current.taxa.includes("Saurischian") &&
    incoming.taxa.includes("Saurischian") &&
    (effectiveHasTag(current, "Gigantic") || effectiveHasTag(incoming, "Gigantic")),
  );
  const levelLegal = rapid
    ? difference === 2
    : (difference >= 0 && difference <= 1) || airSacsJump;
  if (!levelLegal) {
    reasons.push(
      rapid
        ? "Rapid Speciation requires exactly two Levels of progression."
        : "The Level progression is not legal.",
    );
  }

  let diet = incoming.diet === "Omnivore"
    ? true
    : incoming.diet === "Carnivore"
      ? current.diet === "Carnivore" || current.diet === "Omnivore"
      : current.diet === "Herbivore";

  const baseTaxon = incoming.gameplayTaxon === current.gameplayTaxon;
  const incomingAquatic = incoming.tags.includes("Aquatic");
  const currentAquatic = current.tags.includes("Aquatic");
  const incomingSemiAquatic = incoming.tags.includes("Semi-Aquatic");
  const currentSemiAquatic = current.tags.includes("Semi-Aquatic");
  const incomingCountsAsAquatic = incomingAquatic || incomingSemiAquatic;
  const currentCountsAsAquatic = currentAquatic || currentSemiAquatic;
  const aquaticGateLegal =
    (!incomingAquatic || currentCountsAsAquatic) &&
    (!currentAquatic || incomingCountsAsAquatic);
  if (!aquaticGateLegal) reasons.push("A printed Aquatic Creature can interact in an override only with a Creature that counts as Aquatic.");

  // The occupied Creature's bridge identity determines which category is supplied.
  const aquaticTaxonMatch = currentAquatic && incomingCountsAsAquatic && !baseTaxon;
  const aquaticTagMatch = currentAquatic && incomingCountsAsAquatic && baseTaxon;
  const semiAquaticTagMatch = currentSemiAquatic && incomingCountsAsAquatic;
  let taxon = baseTaxon || aquaticTaxonMatch;

  const livingFossil =
    current.tags.includes("Living Fossil") || incoming.tags.includes("Living Fossil");
  const transitional =
    (current.tags.includes("Transitional") || incoming.tags.includes("Transitional")) &&
    baseTaxon;
  let period =
    incoming.period === current.period ||
    livingFossil ||
    transitional;

  let tag = aquaticTagMatch || semiAquaticTagMatch || [...incomingTags].some((value) => currentTags.has(value));
  if (!tag && current.tags.includes("Generalist")) {
    const otherMatches = [diet, period, taxon].filter(Boolean).length;
    if (otherMatches >= 2) tag = true;
  }

  let convergentCategory: OverrideCheck["convergentCategory"] = null;
  let convergentOptions: OverrideCheck["convergentOptions"] = [];
  if (
    state.players[playerId].allowances.convergentEvolution &&
    eligibleTagIntersection(incoming, current) &&
    [diet, period, taxon].some(Boolean)
  ) {
    convergentOptions = [
      ...(!taxon ? ["taxon" as const] : []),
      ...(!diet ? ["diet" as const] : []),
      ...(!period ? ["period" as const] : []),
    ];
    const selected = convergentChoice && convergentOptions.includes(convergentChoice)
      ? convergentChoice
      : convergentOptions[0];
    if (selected === "taxon") {
      taxon = true;
      convergentCategory = "taxon";
    } else if (selected === "diet") {
      diet = true;
      convergentCategory = "diet";
    } else if (selected === "period") {
      period = true;
      convergentCategory = "period";
    }
  }

  const matches = { diet, period, taxon, tag };
  const matchCount = Object.values(matches).filter(Boolean).length;
  if (matchCount < 3) reasons.push(`Only ${matchCount} of 4 override categories match.`);

  return {
    legal:
      levelLegal &&
      aquaticGateLegal &&
      matchCount >= 3 &&
      lane.creature.cannotOverrideOnTurn !== state.turnNumber &&
      !islandDwarfismBlocksEntry(state, playerId, laneIndex) &&
      !(hasIslandDwarfism(lane) && effectiveHasTag(incoming, "Gigantic")),
    matches,
    matchCount,
    levelLegal,
    convergentCategory,
    convergentOptions,
    reasons,
  };
}

function resolutionBlocked(state: GameState) {
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
    state.pendingEngulf,
  );
}

export function legalCreatureLanes(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
): number[] {
  if (
    state.phase !== "development" ||
    state.activePlayer !== playerId ||
    resolutionBlocked(state) ||
    state.winner !== null ||
    card.definition.kind !== "creature"
  ) return [];

  const player = state.players[playerId];
  if (!player.hand.some((held) => held.uid === card.uid)) return [];
  const creature = card.definition;
  if (player.allowances.rapidSpeciation) {
    return player.lanes
      .map((lane, index) => (
        !nicheIsLocked(state, playerId, index) &&
        player.allowances.aquaticOverrideLockedLane !== index &&
        lane.creature &&
        checkOverride(state, playerId, creature, index, true).legal
          ? index
          : -1
      ))
      .filter((index) => index >= 0);
  }

  if (!player.allowances.creaturePlayed) {
    return player.lanes
      .map((lane, index) => {
        if (!creatureCanEnterNiche(state, playerId, index)) return -1;
        if (!lane.creature) {
          return creature.printedLevel <= 1 && !player.allowances.filledEmpty ? index : -1;
        }
        if (player.allowances.aquaticOverrideLockedLane === index) return -1;
        return checkOverride(state, playerId, creature, index).legal ? index : -1;
      })
      .filter((index) => index >= 0);
  }

  const opportunistActive =
    creature.tags.includes("Opportunist") &&
    state.players[otherPlayer(playerId)].event?.definition.eventType === "continuous";
  if (creature.tags.includes("Propulsion") || opportunistActive) {
    return player.lanes
      .map((lane, index) => {
        if (!creatureCanEnterNiche(state, playerId, index)) return -1;
        if (!lane.creature) return creature.printedLevel <= 1 ? index : -1;
        if (player.allowances.aquaticOverrideLockedLane === index) return -1;
        return opportunistActive && (creature.printedLevel === 1 || creature.printedLevel === 2) &&
          checkOverride(state, playerId, creature, index).legal
          ? index
          : -1;
      })
      .filter((index) => index >= 0);
  }

  return [];
}

export function legalConnectedWaterwaySources(state: GameState): number[] {
  const player = state.players[state.activePlayer];
  if (
    state.phase !== "development" ||
    resolutionBlocked(state) ||
    state.winner !== null ||
    player.biome.key !== "aquatic" ||
    !player.biome.waterwaysConnected ||
    player.biome.waterwayRepositionTurn === state.turnNumber ||
    !player.lanes.some((lane, index) => !lane.creature && creatureCanEnterNiche(state, state.activePlayer, index))
  ) return [];
  return player.lanes
    .map((lane, index) => creatureCanMoveByEffect(lane) ? index : -1)
    .filter((index) => index >= 0);
}

export function legalConnectedWaterwayDestinations(state: GameState, sourceLane: number): number[] {
  if (!legalConnectedWaterwaySources(state).includes(sourceLane)) return [];
  return state.players[state.activePlayer].lanes
    .map((lane, index) => index !== sourceLane && !lane.creature && creatureCanEnterNiche(state, state.activePlayer, index) ? index : -1)
    .filter((index) => index >= 0);
}

export function repositionConnectedWaterway(
  original: GameState,
  sourceLane: number,
  destinationLane: number,
): GameState {
  const state = clone(original);
  if (!legalConnectedWaterwayDestinations(state, sourceLane).includes(destinationLane)) return state;
  const player = state.players[state.activePlayer];
  const source = player.lanes[sourceLane];
  const destination = player.lanes[destinationLane];
  destination.creature = source.creature;
  destination.attachment = source.attachment;
  destination.engulfed = source.engulfed;
  source.creature = null;
  source.attachment = null;
  source.engulfed = null;
  player.biome.waterwayRepositionTurn = state.turnNumber;
  addLog(state, `Connected Waterways repositioned ${destination.creature!.card.definition.name} from Niche ${sourceLane + 1} to Niche ${destinationLane + 1} without triggering a fill effect.`);
  return finishResolution(state);
}

export function legalFacultativeSources(state: GameState): number[] {
  const player = state.players[state.activePlayer];
  if (state.phase !== "development" || resolutionBlocked(state) || state.winner !== null) return [];
  return player.lanes
    .map((lane, laneIndex) =>
      lane.attachment?.definition.key === "facultative-quadrupedality" &&
      creatureCanMoveByEffect(lane) &&
      lane.creature?.facultativeMovedTurn !== state.turnNumber &&
      adjacentEmptyNiches(state, state.activePlayer, laneIndex).length
        ? laneIndex
        : -1,
    )
    .filter((laneIndex) => laneIndex >= 0);
}

export function legalFacultativeDestinations(state: GameState, sourceLane: number): number[] {
  return legalFacultativeSources(state).includes(sourceLane)
    ? adjacentEmptyNiches(state, state.activePlayer, sourceLane)
    : [];
}

export function moveFacultativeQuadrupedality(
  original: GameState,
  sourceLane: number,
  destinationLane: number,
): GameState {
  const state = clone(original);
  if (!legalFacultativeDestinations(state, sourceLane).includes(destinationLane)) return state;
  const player = state.players[state.activePlayer];
  const source = player.lanes[sourceLane];
  const destination = player.lanes[destinationLane];
  destination.creature = source.creature;
  destination.attachment = source.attachment;
  destination.engulfed = source.engulfed;
  source.creature = null;
  source.attachment = null;
  source.engulfed = null;
  destination.creature!.facultativeMovedTurn = state.turnNumber;
  player.allowances.developmentActions += 1;
  addLog(state, `Facultative Quadrupedality moved ${destination.creature!.card.definition.name} from Niche ${sourceLane + 1} to adjacent Niche ${destinationLane + 1} without triggering entry effects.`);
  return finishResolution(state);
}

export function legalAquaticOverrideLanes(state: GameState, card: CardInstance): number[] {
  const player = state.players[state.activePlayer];
  if (
    state.phase !== "development" ||
    resolutionBlocked(state) ||
    state.winner !== null ||
    player.biome.key !== "aquatic" ||
    !player.biome.waterwaysConnected ||
    player.biome.freeOverrideUsed ||
    player.allowances.rapidSpeciation ||
    card.definition.kind !== "creature" ||
    !player.hand.some((held) => held.uid === card.uid)
  ) return [];
  return player.lanes
    .map((lane, index) => {
      if (!lane.creature || nicheIsLocked(state, state.activePlayer, index)) return -1;
      if (player.allowances.overriddenLanes.includes(index)) return -1;
      return checkOverride(state, state.activePlayer, card.definition as CreatureCard, index).legal ? index : -1;
    })
    .filter((index) => index >= 0);
}

export function canUseAquaticOverride(state: GameState) {
  return state.players[state.activePlayer].hand.some((card) => legalAquaticOverrideLanes(state, card).length > 0);
}

function moveCardFromHand(player: PlayerState, uid: string) {
  const index = player.hand.findIndex((card) => card.uid === uid);
  if (index < 0) return null;
  return player.hand.splice(index, 1)[0];
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

function sendCreatureToHistory(
  state: GameState,
  playerId: PlayerId,
  laneIndex: number,
  reason: "battle" | "override" | "effect",
) {
  const player = state.players[playerId];
  const lane = player.lanes[laneIndex];
  if (!lane.creature) return null;
  const attachment = moveAdaptationSlotToHistory(state, lane);
  const card = lane.creature.card;
  sendCardToHistory(state, card, reason);
  lane.creature = null;

  if (reason === "override" && attachment?.definition.key === "autotomy") {
    addLog(state, `Autotomy entered History when ${card.definition.name} was overridden.`);
    drawOne(state, playerId, "Autotomy override");
  }

  if (
    reason !== "battle" &&
    card.definition.tags.includes("Living Fossil") &&
    !card.livingFossilUsed
  ) {
    card.livingFossilUsed = true;
    player.returnQueue.push(card.uid);
    addLog(state, `${card.definition.name} was marked for its once-per-game Living Fossil return.`);
  }
  return card;
}

function makeCreatureInPlay(
  card: CardInstance & { definition: CreatureCard },
  turnNumber: number,
  ownerNextTurn: number,
): CreatureInPlay {
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

function nextTurnForPlayer(state: GameState, playerId: PlayerId) {
  return state.activePlayer === playerId ? state.turnNumber + 2 : state.turnNumber + 1;
}

export function findCreature(
  state: GameState,
  uid: string,
): { playerId: PlayerId; laneIndex: number; lane: LaneState; creature: CreatureInPlay } | null {
  for (const playerId of [0, 1] as PlayerId[]) {
    const laneIndex = state.players[playerId].lanes.findIndex(
      (lane) => lane.creature?.card.uid === uid,
    );
    if (laneIndex >= 0) {
      const lane = state.players[playerId].lanes[laneIndex];
      return { playerId, laneIndex, lane, creature: lane.creature! };
    }
  }
  return null;
}

function hasActiveEntryChoice(state: GameState) {
  return Boolean(state.pendingHerd || state.pendingNesting || state.pendingCranialDisplay || state.pendingFilterFeeder);
}

function adjacentEmptyNiches(state: GameState, playerId: PlayerId, laneIndex: number) {
  return [laneIndex - 1, laneIndex + 1].filter((index) =>
    index >= 0 &&
    index < state.players[playerId].lanes.length &&
    !state.players[playerId].lanes[index].creature &&
    creatureCanEnterNiche(state, playerId, index),
  );
}

function continueEntryEffects(state: GameState) {
  if (hasActiveEntryChoice(state)) return state;
  while (state.entryEffectQueue.length) {
    const effect = state.entryEffectQueue.shift()!;
    const source = findCreature(state, effect.sourceUid);
    if (!source || source.playerId !== effect.playerId) continue;
    const definition = source.creature.card.definition;

    if (effect.kind === "herd") {
      const eligibleUids = state.players[effect.playerId].deck
        .filter((card) =>
          card.definition.kind === "creature" &&
          card.definition.tags.includes("Herd") &&
          card.definition.printedLevel <= definition.printedLevel + 1,
        )
        .map((card) => card.uid);
      if (!eligibleUids.length || state.players[effect.playerId].hand.length >= 10) {
        addLog(state, `${definition.name}'s Herd found no eligible Creature to add.`);
        continue;
      }
      state.pendingHerd = { sourceUid: effect.sourceUid, playerId: effect.playerId, eligibleUids };
      addLog(state, `${definition.name}'s Herd may search for another eligible Herd Creature.`);
      return state;
    }

    if (effect.kind === "nesting") {
      const eligibleUids = state.players[effect.playerId].hand
        .filter((card) => card.definition.kind === "creature" && card.definition.printedLevel === 0)
        .map((card) => card.uid);
      if (!eligibleUids.length || !adjacentEmptyNiches(state, effect.playerId, source.laneIndex).length) {
        addLog(state, `${definition.name}'s Nesting had no legal Level 0 placement.`);
        continue;
      }
      state.pendingNesting = {
        sourceUid: effect.sourceUid,
        playerId: effect.playerId,
        stage: "card",
        eligibleUids,
      };
      addLog(state, `${definition.name}'s Nesting may place an adjacent Level 0 Creature.`);
      return state;
    }

    if (effect.kind === "cranial-display") {
      const eligibleTargetUids = state.players[otherPlayer(effect.playerId)].lanes
        .filter((targetLane) =>
          targetLane.creature &&
          targetLane.creature.card.definition.printedLevel <= definition.printedLevel,
        )
        .map((targetLane) => targetLane.creature!.card.uid);
      if (!eligibleTargetUids.length) {
        addLog(state, `${definition.name} entered with no eligible Cranial Display target.`);
        continue;
      }
      state.pendingCranialDisplay = { sourceUid: effect.sourceUid, eligibleTargetUids };
      addLog(state, `${definition.name}'s Cranial Display must choose an eligible opposing Creature.`);
      return state;
    }

    const deck = state.players[effect.playerId].deck;
    if (deck.length < 2) {
      addLog(state, `${definition.name}'s Filter Feeder found fewer than two cards to reorder.`);
      continue;
    }
    state.pendingFilterFeeder = {
      playerId: effect.playerId,
      sourceUid: effect.sourceUid,
      cardUids: [deck[0].uid, deck[1].uid],
    };
    addLog(state, `${definition.name}'s Filter Feeder revealed the top two cards for ordering.`);
    return state;
  }
  return state;
}

function queueEntryEffects(state: GameState, playerId: PlayerId, laneIndex: number) {
  const lane = state.players[playerId].lanes[laneIndex];
  if (!lane.creature) return;
  const source = lane.creature;
  const definition = source.card.definition;

  if (definition.tags.includes("Deimatic")) {
    const duration = tagEffectMultiplier(definition, "Deimatic");
    const firstOpposingTurn = state.activePlayer === playerId ? state.turnNumber + 1 : state.turnNumber;
    source.deimaticProtectedThroughTurn = firstOpposingTurn + (duration - 1) * 2;
    addLog(state, `${definition.name}'s Deimatic protection lasts through ${duration} opposing ${duration === 1 ? "turn" : "turns"}.`);
  }

  if (definition.tags.includes("Overreach")) {
    const player = state.players[playerId];
    if (player.overreachTriggeredTurn !== state.turnNumber) {
      const draws = tagEffectMultiplier(definition, "Overreach");
      player.overreachTriggeredTurn = state.turnNumber;
      player.overreachQueuedDraws += draws;
      player.overreachDueTurn = nextTurnForPlayer(state, playerId);
      addLog(state, `${definition.name}'s Overreach queued ${draws} additional Start-of-Turn ${draws === 1 ? "draw" : "draws"}.`);
    } else {
      addLog(state, `${definition.name}'s Overreach did not trigger because Overreach already triggered for ${state.players[playerId].name} this turn.`);
    }
  }

  for (const tag of definition.tags) {
    if (tag === "Herd" && state.players[playerId].herdTriggeredTurn !== state.turnNumber) {
      state.players[playerId].herdTriggeredTurn = state.turnNumber;
      state.entryEffectQueue.push({ kind: "herd", sourceUid: source.card.uid, playerId });
    }
    if (tag === "Cranial Display") state.entryEffectQueue.push({ kind: "cranial-display", sourceUid: source.card.uid, playerId });
    if (tag === "Filter Feeder") state.entryEffectQueue.push({ kind: "filter-feeder", sourceUid: source.card.uid, playerId });
  }
  if (definition.tags.includes("Nesting")) {
    state.entryEffectQueue.push({ kind: "nesting", sourceUid: source.card.uid, playerId });
  }
  continueEntryEffects(state);
}

export function getHerdOptions(state: GameState): ConceptChoiceOption[] {
  const pending = state.pendingHerd;
  if (!pending) return [];
  const player = state.players[pending.playerId];
  return [
    ...player.deck
      .filter((card) => pending.eligibleUids.includes(card.uid))
      .map((card) => ({
        id: card.uid,
        label: card.definition.name,
        detail: card.definition.kind === "creature" ? `Level ${card.definition.printedLevel} · ${card.definition.period}` : "Creature",
      })),
    { id: "__decline-herd__", label: "Decline Herd", detail: "Continue resolving this Creature's remaining entry effects." },
  ];
}

export function chooseHerd(original: GameState, optionId: string): GameState {
  const state = clone(original);
  const pending = state.pendingHerd;
  if (!pending || !getHerdOptions(state).some((option) => option.id === optionId)) return state;
  const player = state.players[pending.playerId];
  if (optionId !== "__decline-herd__") {
    const card = takeDeckCard(player, optionId);
    if (!card) return state;
    player.hand.push(card);
    player.deck = shuffle(player.deck);
    addLog(state, `${player.name} revealed and added ${card.definition.name} with Herd, then shuffled.`);
  } else {
    addLog(state, `${player.name} declined the optional Herd search.`);
  }
  state.pendingHerd = null;
  continueEntryEffects(state);
  return finishResolution(state);
}

export function getNestingOptions(state: GameState): ConceptChoiceOption[] {
  const pending = state.pendingNesting;
  if (!pending) return [];
  const player = state.players[pending.playerId];
  if (pending.stage === "card") {
    return [
      ...player.hand
        .filter((card) => pending.eligibleUids.includes(card.uid))
        .map((card) => ({ id: card.uid, label: card.definition.name, detail: card.definition.kind === "creature" ? `Level 0 · ${card.definition.period}` : "Level 0 Creature" })),
      { id: "__decline-nesting__", label: "Decline Nesting", detail: "Continue your turn normally." },
    ];
  }
  const source = findCreature(state, pending.sourceUid);
  if (!source) return [];
  return adjacentEmptyNiches(state, pending.playerId, source.laneIndex)
    .map((laneIndex) => ({ id: String(laneIndex), label: `Niche ${laneIndex + 1}`, detail: "Empty adjacent friendly Niche" }));
}

export function chooseNesting(original: GameState, optionId: string): GameState {
  const state = clone(original);
  const pending = state.pendingNesting;
  if (!pending || !getNestingOptions(state).some((option) => option.id === optionId)) return state;
  if (pending.stage === "card") {
    if (optionId === "__decline-nesting__") {
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
  const card = moveCardFromHand(player, pending.selectedCardUid!);
  if (!card || card.definition.kind !== "creature" || card.definition.printedLevel !== 0) return state;
  player.lanes[laneIndex].creature = makeCreatureInPlay(
    card as CardInstance & { definition: CreatureCard },
    state.turnNumber,
    nextTurnForPlayer(state, pending.playerId),
  );
  state.pendingNesting = null;
  state.endTurnAfterEntryEffects = true;
  addLog(state, `Nesting placed ${card.definition.name} into adjacent Niche ${laneIndex + 1}; the turn will end after its entry effects resolve.`);
  queueEntryEffects(state, pending.playerId, laneIndex);
  continueEntryEffects(state);
  return finishResolution(state);
}

export function chooseFilterFeederTop(original: GameState, cardUid: string): GameState {
  const state = clone(original);
  const pending = state.pendingFilterFeeder;
  if (!pending || !pending.cardUids.includes(cardUid)) return state;
  const player = state.players[pending.playerId];
  const first = player.deck[0];
  const second = player.deck[1];
  if (!first || !second || !pending.cardUids.includes(first.uid) || !pending.cardUids.includes(second.uid)) return state;
  if (second.uid === cardUid) [player.deck[0], player.deck[1]] = [second, first];
  const source = findCreature(state, pending.sourceUid);
  addLog(state, `${source?.creature.card.definition.name ?? "Filter Feeder"} ordered the top two cards of ${player.name}'s deck.`);
  state.pendingFilterFeeder = null;
  continueEntryEffects(state);
  return finishResolution(state);
}

function playCreatureWithSource(
  original: GameState,
  playerId: PlayerId,
  cardUid: string,
  laneIndex: number,
  source: "normal" | "aquatic",
  convergentChoice?: "diet" | "period" | "taxon",
): GameState {
  const state = clone(original);
  const player = state.players[playerId];
  const card = player.hand.find((held) => held.uid === cardUid);
  if (!card || card.definition.kind !== "creature") return state;
  const legalLanes = source === "aquatic"
    ? legalAquaticOverrideLanes(state, card)
    : legalCreatureLanes(state, playerId, card);
  if (!legalLanes.includes(laneIndex)) return state;

  const lane = player.lanes[laneIndex];
  const wasOccupied = Boolean(lane.creature);
  const previousDefinition = lane.creature?.card.definition ?? null;
  const transferableDentalBattery = Boolean(
    wasOccupied &&
    lane.attachment?.definition.key === "dental-battery" &&
    previousDefinition?.taxa.includes("Ornithischian") &&
    card.definition.taxa.includes("Ornithischian"),
  );
  const dentalBattery = transferableDentalBattery ? lane.attachment : null;
  const wasRapid = source === "normal" && player.allowances.rapidSpeciation;
  const wasPropulsion = source === "normal" && player.allowances.creaturePlayed && card.definition.tags.includes("Propulsion");
  const wasOpportunist =
    source === "normal" &&
    player.allowances.creaturePlayed &&
    card.definition.tags.includes("Opportunist") &&
    state.players[otherPlayer(playerId)].event?.definition.eventType === "continuous";
  if (wasOccupied && player.allowances.convergentEvolution && !convergentChoice) {
    const override = checkOverride(state, playerId, card.definition, laneIndex, wasRapid);
    if (override.convergentOptions.length) {
      state.pendingConvergentChoice = {
        playerId,
        cardUid,
        laneIndex,
        categories: override.convergentOptions,
        source,
      };
      addLog(state, `Convergent Evolution must choose which missing category to supply for ${card.definition.name}'s override.`);
      return state;
    }
  }
  const moved = moveCardFromHand(player, cardUid) as CardInstance & { definition: CreatureCard };
  if (wasOccupied) {
    const oldName = lane.creature!.card.definition.name;
    if (transferableDentalBattery) lane.attachment = null;
    sendCreatureToHistory(state, playerId, laneIndex, "override");
    player.allowances.overriddenLanes.push(laneIndex);
    addLog(state, `${card.definition.name} legally overrode ${oldName} in Niche ${laneIndex + 1}${source === "aquatic" ? " through Connected Waterways" : ""}.`);
  } else {
    player.allowances.filledEmpty = true;
    addLog(state, `${player.name} filled Niche ${laneIndex + 1} with ${card.definition.name}.`);
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
    addLog(state, `The free override disconnected ${player.name}'s waterways; Connected Waterways can no longer reposition Creatures.`);
  }

  if (wasRapid) {
    player.allowances.rapidSpeciation = false;
    addLog(state, "Rapid Speciation completed its exactly-two-Level override.");
  }
  if (wasOccupied) {
    player.allowances.convergentEvolution = false;
    if (convergentChoice) {
      addLog(state, `Convergent Evolution supplied the ${convergentChoice === "taxon" ? "Primary Taxon" : convergentChoice === "period" ? "Time Period" : "Diet"} match.`);
    }
  }

  queueEntryEffects(state, playerId, laneIndex);
  if (wasPropulsion || wasOpportunist) {
    state.phase = "battle";
    addLog(state, `${moved.definition.name}'s ${wasOpportunist ? "Opportunist" : "Propulsion"} play ended the Development Phase.`);
  }
  return finishResolution(state);
}

export function playCreature(
  original: GameState,
  playerId: PlayerId,
  cardUid: string,
  laneIndex: number,
  convergentChoice?: "diet" | "period" | "taxon",
): GameState {
  return playCreatureWithSource(original, playerId, cardUid, laneIndex, "normal", convergentChoice);
}

export function playAquaticOverride(
  original: GameState,
  cardUid: string,
  laneIndex: number,
  convergentChoice?: "diet" | "period" | "taxon",
): GameState {
  return playCreatureWithSource(original, original.activePlayer, cardUid, laneIndex, "aquatic", convergentChoice);
}

export function chooseConvergentCategory(
  original: GameState,
  category: "diet" | "period" | "taxon",
): GameState {
  const pending = original.pendingConvergentChoice;
  if (!pending || !pending.categories.includes(category)) return clone(original);
  const state = clone(original);
  state.pendingConvergentChoice = null;
  return pending.source === "aquatic"
    ? playAquaticOverride(state, pending.cardUid, pending.laneIndex, category)
    : playCreature(state, pending.playerId, pending.cardUid, pending.laneIndex, category);
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
  addLog(state, `${target.creature.card.definition.name} is deterred from Hunting ${source.creature.card.definition.name} through its next turn.`);
  state.pendingCranialDisplay = null;
  continueEntryEffects(state);
  return finishResolution(state);
}

export function adaptationEligible(card: AdaptationCard, creature: CreatureCard) {
  if (card.eligibility === "any") return true;
  if (card.eligibility === "raptorial-claws") return creature.visualTags.includes("Raptorial Claws");
  if (card.eligibility === "level-2-or-lower") return creature.printedLevel <= 2;
  if (card.eligibility === "saurischian") return creature.taxa.includes("Saurischian");
  if (card.eligibility === "ornithischian") return creature.taxa.includes("Ornithischian");
  if (card.eligibility === "herbivore-armament-retaliation") {
    return creature.diet === "Herbivore" && (creature.tags.includes("Armament") || creature.tags.includes("Retaliation"));
  }
  return creature.tags.includes("Aquatic") || creature.taxa.includes("Lepidosaur");
}

function adaptationSlotEmpty(lane: LaneState) {
  return !lane.attachment && !lane.engulfed;
}

export function legalAdaptationTargets(
  state: GameState,
  card: CardInstance,
): Array<{ playerId: PlayerId; laneIndex: number }> {
  if (
    state.phase !== "development" ||
    resolutionBlocked(state) ||
    state.winner !== null ||
    card.definition.kind !== "adaptation"
  ) return [];
  const player = state.players[state.activePlayer];
  if (player.allowances.adaptationPlayed || !player.hand.some((held) => held.uid === card.uid)) return [];
  const targetPlayers: PlayerId[] = card.definition.key === "island-dwarfism" ? [0, 1] : [state.activePlayer];
  return targetPlayers.flatMap((playerId) => state.players[playerId].lanes
    .map((lane, laneIndex) => {
      if (!lane.creature || !adaptationSlotEmpty(lane)) return null;
      if (!adaptationEligible(card.definition as AdaptationCard, lane.creature.card.definition)) return null;
      if (card.definition.key === "island-dwarfism" && !hasNoAdjacentFriendly(state, playerId, laneIndex)) return null;
      return { playerId, laneIndex };
    })
    .filter((position): position is { playerId: PlayerId; laneIndex: number } => Boolean(position)));
}

export function legalAdaptationLanes(state: GameState, card: CardInstance): number[] {
  return legalAdaptationTargets(state, card)
    .filter((position) => position.playerId === state.activePlayer)
    .map((position) => position.laneIndex);
}

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
  if (!legalAdaptationTargets(state, card).some((position) => position.playerId === targetPlayer && position.laneIndex === laneIndex)) return state;
  const moved = moveCardFromHand(player, cardUid) as CardInstance & { definition: AdaptationCard };
  state.players[targetPlayer].lanes[laneIndex].attachment = moved;
  player.allowances.adaptationPlayed = true;
  player.allowances.developmentActions += 1;
  addLog(state, `${player.name} attached ${moved.definition.name} to ${state.players[targetPlayer].name}'s Creature in Niche ${laneIndex + 1}.`);
  return finishResolution(state);
}

export function canPlayEvent(state: GameState, card: CardInstance) {
  const player = state.players[state.activePlayer];
  return (
    state.phase === "development" &&
    !resolutionBlocked(state) &&
    state.winner === null &&
    card.definition.kind === "event" &&
    !["wildfire", "drought"].includes(card.definition.key) &&
    player.hand.some((held) => held.uid === card.uid) &&
    !player.allowances.eventPlayed
  );
}

export function legalDroughtTargets(
  state: GameState,
  card: CardInstance,
): Array<{ playerId: PlayerId; laneIndex: number }> {
  const player = state.players[state.activePlayer];
  if (
    state.phase !== "development" ||
    resolutionBlocked(state) ||
    state.winner !== null ||
    card.definition.kind !== "event" ||
    card.definition.key !== "drought" ||
    !player.hand.some((held) => held.uid === card.uid) ||
    player.allowances.eventPlayed
  ) return [];
  return ([0, 1] as PlayerId[]).flatMap((playerId) => state.players[playerId].lanes
    .map((lane, laneIndex) => {
      if (nicheIsLocked(state, playerId, laneIndex)) return null;
      if (!lane.creature) return { playerId, laneIndex };
      if (!countsAsAquatic(lane.creature.card.definition)) return null;
      if (lane.creature.cannotOverrideOnTurn === state.turnNumber) return null;
      return { playerId, laneIndex };
    })
    .filter((position): position is { playerId: PlayerId; laneIndex: number } => Boolean(position)));
}

export function playDrought(
  original: GameState,
  cardUid: string,
  targetPlayer: PlayerId,
  laneIndex: number,
): GameState {
  const state = clone(original);
  const player = state.players[state.activePlayer];
  const card = player.hand.find((held) => held.uid === cardUid);
  if (!card || !legalDroughtTargets(state, card).some((position) => position.playerId === targetPlayer && position.laneIndex === laneIndex)) return state;
  const targetLane = state.players[targetPlayer].lanes[laneIndex];
  const overriddenName = targetLane.creature?.card.definition.name ?? null;
  if (targetLane.creature) sendCreatureToHistory(state, targetPlayer, laneIndex, "override");
  const moved = moveCardFromHand(player, cardUid) as CardInstance & { definition: EventCard };
  targetLane.drought = {
    card: moved,
    expiresOnTurn: nextTurnForPlayer(state, state.activePlayer),
  };
  player.allowances.eventPlayed = true;
  player.allowances.developmentActions += 1;
  addLog(state, `${player.name} placed Drought in ${state.players[targetPlayer].name}'s Niche ${laneIndex + 1}.`);
  if (overriddenName) addLog(state, `Drought overrode ${overriddenName}; normal override triggers applied.`);
  addLog(state, `That Niche is locked and its directly opposing Niche is suppressed through the end of ${player.name}'s next turn.`);
  return finishResolution(state);
}

export function legalWildfireLanes(state: GameState, card: CardInstance): number[] {
  const player = state.players[state.activePlayer];
  if (
    state.phase !== "development" ||
    resolutionBlocked(state) ||
    state.winner !== null ||
    card.definition.kind !== "event" ||
    card.definition.key !== "wildfire" ||
    !player.hand.some((held) => held.uid === card.uid) ||
    player.allowances.eventPlayed
  ) return [];

  return player.lanes
    .map((lane, index) => {
      if (nicheIsLocked(state, state.activePlayer, index)) return -1;
      if (lane.creature?.cannotOverrideOnTurn === state.turnNumber) return -1;
      return index;
    })
    .filter((index) => index >= 0);
}

export function playWildfire(original: GameState, cardUid: string, laneIndex: number): GameState {
  const state = clone(original);
  const player = state.players[state.activePlayer];
  const card = player.hand.find((held) => held.uid === cardUid);
  if (!card || !legalWildfireLanes(state, card).includes(laneIndex)) return state;

  const ownLane = player.lanes[laneIndex];
  const opposingPlayer = otherPlayer(state.activePlayer);
  const opposingLane = state.players[opposingPlayer].lanes[laneIndex];
  const ownCreature = ownLane.creature?.card.definition.name;
  const opposingCreature = opposingLane.creature?.card.definition.name;

  if (ownLane.creature) sendCreatureToHistory(state, state.activePlayer, laneIndex, "override");
  if (opposingLane.creature) sendCreatureToHistory(state, opposingPlayer, laneIndex, "effect");

  const moved = moveCardFromHand(player, cardUid) as CardInstance & { definition: EventCard };
  ownLane.wildfire = {
    card: moved,
    expiresOnTurn: nextTurnForPlayer(state, state.activePlayer),
  };
  player.allowances.eventPlayed = true;
  player.allowances.developmentActions += 1;

  addLog(state, `${player.name} played Wildfire into Niche ${laneIndex + 1} instead of the Event Zone.`);
  if (ownCreature) addLog(state, `Wildfire overrode ${ownCreature}; normal override triggers applied.`);
  if (opposingCreature) addLog(state, `Wildfire sent opposing ${opposingCreature} and its Adaptation to History.`);
  addLog(state, `Lane ${laneIndex + 1} is locked through the end of ${player.name}'s next turn.`);
  return finishResolution(state);
}

export function playEvent(original: GameState, cardUid: string): GameState {
  const state = clone(original);
  const player = state.players[state.activePlayer];
  const card = player.hand.find((held) => held.uid === cardUid);
  if (!card || card.definition.kind !== "event" || !canPlayEvent(state, card)) return state;

  const moved = moveCardFromHand(player, cardUid) as CardInstance & { definition: EventCard };
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
    const order = [
      ...state.players[state.activePlayer].lanes.map((lane) => lane.creature),
      ...[...state.players[opponent].lanes].reverse().map((lane) => lane.creature),
    ]
      .filter((entry): entry is CreatureInPlay => Boolean(entry?.card.definition.diet === "Herbivore"))
      .map((entry) => entry.card.uid);
    state.pendingStampede = { owner: state.activePlayer, order, nextIndex: 0 };
    addLog(state, `Stampede began with ${order.length} participating ${order.length === 1 ? "Herbivore" : "Herbivores"}, proceeding counter-clockwise.`);
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

function continueStampede(state: GameState): GameState {
  const pending = state.pendingStampede;
  if (!pending || state.pendingBattle || resolutionBlocked(state)) return state;
  while (pending.nextIndex < pending.order.length) {
    const uid = pending.order[pending.nextIndex];
    pending.nextIndex += 1;
    const attacker = findCreature(state, uid);
    if (!attacker || attacker.creature.card.definition.diet !== "Herbivore") continue;
    const targetPlayer = otherPlayer(attacker.playerId);
    const target = state.players[targetPlayer].lanes[attacker.laneIndex].creature;
    if (!target) {
      addLog(state, `${attacker.creature.card.definition.name} had no Creature in its opposing Niche during Stampede.`);
      continue;
    }
    const defender = findCreature(state, target.card.uid);
    if (!defender || !creatureCanAttackTarget(state, attacker.creature, attacker.laneIndex, defender.creature, defender.laneIndex, {
      ignoreDiet: true,
      ignoreEntryTurn: true,
    })) {
      addLog(state, `${attacker.creature.card.definition.name} could not Hunt ${target.card.definition.name} during Stampede because of a non-Diet restriction.`);
      continue;
    }
    createBattlePreview(state, attacker, defender, "stampede");
    addLog(state, `Stampede requires ${attacker.creature.card.definition.name} to Hunt ${target.card.definition.name}.`);
    return state;
  }
  state.pendingStampede = null;
  addLog(state, `${state.players[pending.owner].name}'s Stampede finished; their turn ends without a Battle Phase.`);
  return endTurn(state);
}

const PERIOD_SEQUENCE: Period[] = [
  "Cambrian",
  "Ordovician",
  "Silurian",
  "Devonian",
  "Carboniferous",
  "Permian",
  "Triassic",
  "Jurassic",
  "Cretaceous",
  "Paleogene",
  "Neogene",
  "Quaternary",
];

export function geologicalBoundaryOptions(state: GameState): Period[] {
  return state.pendingGeologicalBoundary ? PERIOD_SEQUENCE : [];
}

export function chooseGeologicalBoundaryPeriod(original: GameState, period: Period): GameState {
  const state = clone(original);
  const pending = state.pendingGeologicalBoundary;
  if (!pending || !PERIOD_SEQUENCE.includes(period)) return state;
  const owner = pending.card.owner;
  let removed = 0;
  for (const playerId of [0, 1] as PlayerId[]) {
    for (let laneIndex = 0; laneIndex < state.players[playerId].lanes.length; laneIndex += 1) {
      const creature = state.players[playerId].lanes[laneIndex].creature;
      if (creature?.card.definition.period === period) {
        sendCreatureToHistory(state, playerId, laneIndex, "effect");
        removed += 1;
      }
    }
  }
  for (const player of state.players) {
    if (player.event?.definition.eventType === "continuous") {
      const ended = player.event;
      sendCardToHistory(state, ended, "Geological Boundary");
      player.event = null;
      addLog(state, `${ended.definition.name} ended at the Geological Boundary.`);
    }
  }
  const periodIndex = PERIOD_SEQUENCE.indexOf(period);
  const succeeding = PERIOD_SEQUENCE[periodIndex + 1];
  if (succeeding) {
    state.periodAuras.push({
      owner,
      period: succeeding,
      expiresAtTurnStart: nextTurnForPlayer(state, owner),
    });
  }
  sendCardToHistory(state, pending.card, "Geological Boundary resolved");
  state.pendingGeologicalBoundary = null;
  addLog(state, `Geological Boundary declared ${period} and removed ${removed} ${removed === 1 ? "Creature" : "Creatures"}.`);
  if (succeeding) addLog(state, `${succeeding} Creatures get +1 Battle Level until the start of ${state.players[owner].name}'s next turn.`);
  else addLog(state, "Quaternary has no succeeding Time Period and created no Battle Level modifier.");
  addLog(state, `${state.players[owner].name}'s turn ends without a Battle Phase.`);
  if (resolveVictoryThreshold(state)) return state;
  return endTurn(state);
}

function hasDinosaurTaxon(card: CardDefinition) {
  return card.kind === "creature" && card.taxa.includes("Dinosaur");
}

function carnianPluvialCostOptions(state: GameState): ConceptChoiceOption[] {
  const player = state.players[state.activePlayer];
  return player.lanes
    .map((lane, index) => {
      const creature = lane.creature;
      if (!creature || hasDinosaurTaxon(creature.card.definition)) return null;
      return {
        id: creature.card.uid,
        label: creature.card.definition.name,
        detail: `Level ${creature.card.definition.printedLevel} · Niche ${index + 1} · Non-Dinosaur`,
      };
    })
    .filter((option): option is ConceptChoiceOption => Boolean(option));
}

function carnianPluvialSearchOptions(state: GameState): ConceptChoiceOption[] {
  return state.players[state.activePlayer].deck
    .filter((card) =>
      card.definition.kind === "creature" &&
      hasDinosaurTaxon(card.definition) &&
      card.definition.printedLevel <= 2,
    )
    .map((card) => ({
      id: card.uid,
      label: card.definition.name,
      detail: `Level ${card.definition.kind === "creature" ? card.definition.printedLevel : "?"} · ${card.definition.kind === "creature" ? card.definition.period : "Creature"}`,
    }));
}

export function canActivateCarnianPluvialEpisode(state: GameState) {
  const player = state.players[state.activePlayer];
  return (
    state.phase === "development" &&
    !resolutionBlocked(state) &&
    state.winner === null &&
    player.event?.definition.key === "carnian-pluvial-episode" &&
    !player.allowances.carnianPluvialUsed &&
    player.hand.length < 10 &&
    carnianPluvialCostOptions(state).length > 0 &&
    carnianPluvialSearchOptions(state).length > 0
  );
}

export function activateCarnianPluvialEpisode(original: GameState): GameState {
  const state = clone(original);
  if (!canActivateCarnianPluvialEpisode(state)) return state;
  const player = state.players[state.activePlayer];
  player.allowances.carnianPluvialUsed = true;
  player.allowances.developmentActions += 1;
  state.pendingCarnianPluvial = {
    kind: "cost",
    sourceEventUid: player.event!.uid,
  };
  addLog(state, `${player.name} activated Carnian Pluvial Episode.`);
  return state;
}

export function getCarnianPluvialOptions(state: GameState): ConceptChoiceOption[] {
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
    const name = player.lanes[laneIndex].creature!.card.definition.name;
    sendCreatureToHistory(state, state.activePlayer, laneIndex, "effect");
    pending.kind = "search";
    addLog(state, `${name} was sent to History for Carnian Pluvial Episode.`);
    return state;
  }

  const card = takeDeckCard(player, optionId);
  if (!card || card.definition.kind !== "creature") return state;
  player.hand.push(card);
  player.deck = shuffle(player.deck);
  state.pendingCarnianPluvial = null;
  addLog(state, `Carnian Pluvial Episode found and revealed ${card.definition.name}; the deck was shuffled.`);
  return finishResolution(state);
}

export function conceptAllowance(state: GameState, playerId: PlayerId) {
  return state.players[playerId].lanes.some(
    (lane) => lane.creature?.card.definition.tags.includes("Resourceful"),
  ) ? 2 : 1;
}

function hasPendingConceptEffect(state: GameState, playerId: PlayerId) {
  const allowances = state.players[playerId].allowances;
  return Boolean(
    state.pendingConceptChoice ||
    allowances.convergentEvolution ||
    allowances.rapidSpeciation,
  );
}

function hasRapidTarget(state: GameState, playerId: PlayerId) {
  const player = state.players[playerId];
  return player.hand.some(
    (card) =>
      card.definition.kind === "creature" &&
      player.lanes.some(
        (lane, index) => lane.creature && checkOverride(state, playerId, card.definition as CreatureCard, index, true).legal,
      ),
  );
}

function evolutionaryRadiationLevels(state: GameState, playerId: PlayerId) {
  const player = state.players[playerId];
  const represented = new Set(
    player.lanes.flatMap((lane) => lane.creature ? [lane.creature.card.definition.printedLevel] : []),
  );
  return ([0, 1] as const).filter((level) =>
    !represented.has(level) &&
    player.hand.some((card) => card.definition.kind === "creature" && card.definition.printedLevel === level),
  );
}

function conceptHasRequiredChoice(state: GameState, key: string) {
  const player = state.players[state.activePlayer];
  if (key === "evolutionary-radiation") {
    return player.lanes.some((lane, index) => !lane.creature && creatureCanEnterNiche(state, state.activePlayer, index)) &&
      evolutionaryRadiationLevels(state, state.activePlayer).length > 0;
  }
  if (key === "whale-fall") {
    return player.hand.some((card) => card.definition.kind === "creature" && card.definition.printedLevel >= 2);
  }
  if (key === "natural-selection") {
    return player.hand.some((card) => card.definition.kind === "creature") &&
      player.deck.some((card) => card.definition.kind === "creature");
  }
  if (key === "dig-site-excavation") {
    return player.history.some((card) => card.definition.key !== "dig-site-excavation");
  }
  if (key === "semelparity") {
    return player.hand.some((card) => card.definition.kind === "creature" && card.definition.printedLevel === 0) ||
      player.lanes.some((lane) => lane.creature?.card.definition.printedLevel === 0);
  }
  if (key === "obligate-migration") {
    return state.players.some(
      (side) => side.lanes.some((lane) => creatureCanMoveByEffect(lane)) &&
        side.lanes.some((lane, index) => !lane.creature && creatureCanEnterNiche(state, side.id, index)),
    );
  }
  if (key === "abiogenesis") {
    const canSearch = player.deck.some(
      (card) => card.definition.kind === "creature" && card.definition.printedLevel === 0,
    );
    const canPlace =
      player.hand.some((card) => card.definition.kind === "creature" && card.definition.printedLevel === 0) &&
      player.lanes.some((lane, index) => !lane.creature && creatureCanEnterNiche(state, state.activePlayer, index));
    return canSearch || canPlace;
  }
  return true;
}

export function canPlayConcept(state: GameState, card: CardInstance) {
  const player = state.players[state.activePlayer];
  if (
    state.phase !== "development" ||
    resolutionBlocked(state) ||
    state.winner !== null ||
    card.definition.kind !== "concept" ||
    !player.hand.some((held) => held.uid === card.uid) ||
    player.allowances.conceptsPlayed >= conceptAllowance(state, state.activePlayer) ||
    hasPendingConceptEffect(state, state.activePlayer)
  ) return false;
  if (card.definition.key === "rapid-speciation") {
    return !player.allowances.creaturePlayed && hasRapidTarget(state, state.activePlayer);
  }
  if (card.definition.key === "evolutionary-radiation" && player.turnsStarted <= 1) {
    return false;
  }
  return conceptHasRequiredChoice(state, card.definition.key);
}

function completeConcept(state: GameState, card: CardInstance & { definition: ConceptCard }) {
  sendCardToHistory(state, card, "Concept resolved");
  state.pendingConceptChoice = null;
  return finishResolution(state);
}

export function playConcept(original: GameState, cardUid: string): GameState {
  const state = clone(original);
  const player = state.players[state.activePlayer];
  const card = player.hand.find((held) => held.uid === cardUid);
  if (!card || card.definition.kind !== "concept" || !canPlayConcept(state, card)) return state;
  const moved = moveCardFromHand(player, cardUid) as CardInstance & { definition: ConceptCard };
  player.allowances.conceptsPlayed += 1;
  player.allowances.developmentActions += 1;
  addLog(state, `${player.name} played ${moved.definition.name}.`);

  switch (moved.definition.key) {
    case "convergent-evolution":
      sendCardToHistory(state, moved, "Concept resolved");
      player.allowances.convergentEvolution = true;
      addLog(state, "Convergent Evolution is waiting for this turn's next override; no other Concept may be played until it resolves.");
      return state;
    case "rapid-speciation":
      sendCardToHistory(state, moved, "Concept resolved");
      player.allowances.rapidSpeciation = true;
      addLog(state, "Choose a Creature and occupied Niche for Rapid Speciation's mandatory override.");
      return state;
    case "biogenesis": {
      const filled = player.lanes.filter((lane) => lane.creature).length;
      for (let index = 0; index < filled; index += 1) drawOne(state, state.activePlayer, "Biogenesis");
      addLog(state, `Biogenesis counted ${filled} filled ${filled === 1 ? "Niche" : "Niches"}.`);
      return completeConcept(state, moved);
    }
    case "genetic-drift": {
      player.deck = shuffle([...player.deck, ...player.hand]);
      player.hand = [];
      const drawn = Array.from({ length: 5 }, () => drawOne(state, state.activePlayer, "Genetic Drift"))
        .filter((entry): entry is CardInstance => Boolean(entry));
      if (!drawn.length) return completeConcept(state, moved);
      state.pendingConceptChoice = {
        card: moved,
        kind: "genetic-drift-discard",
        eligibleUids: drawn.map((entry) => entry.uid),
      };
      return state;
    }
    case "genetic-mutations": {
      const adaptations = player.deck.filter((candidate) => candidate.definition.kind === "adaptation");
      if (adaptations.length) {
        const selected = adaptations[Math.floor(Math.random() * adaptations.length)];
        const found = takeDeckCard(player, selected.uid);
        if (found) {
          player.hand.push(found);
          addLog(state, `Genetic Mutations added the random Adaptation ${found.definition.name} to ${player.name}'s hand.`);
        }
      } else {
        addLog(state, "Genetic Mutations found no Adaptation remaining in the deck.");
      }
      player.deck = shuffle(player.deck);
      return completeConcept(state, moved);
    }
    case "evolutionary-radiation":
      state.pendingConceptChoice = {
        card: moved,
        kind: "evolutionary-radiation-card",
        radiationRemainingLevels: evolutionaryRadiationLevels(state, state.activePlayer),
        radiationPlacements: 0,
      };
      return state;
    case "whale-fall":
      state.pendingConceptChoice = { card: moved, kind: "whale-fall" };
      return state;
    case "natural-selection":
      state.pendingConceptChoice = { card: moved, kind: "natural-selection-cost" };
      return state;
    case "dig-site-excavation":
      state.pendingConceptChoice = { card: moved, kind: "dig-site" };
      return state;
    case "semelparity":
      state.pendingConceptChoice = { card: moved, kind: "semelparity-cost" };
      return state;
    case "obligate-migration":
      state.pendingConceptChoice = { card: moved, kind: "obligate-migration-source" };
      return state;
    case "abiogenesis":
      state.pendingConceptChoice = { card: moved, kind: "abiogenesis-mode" };
      return state;
    default:
      return completeConcept(state, moved);
  }
}

export function getConceptChoiceOptions(state: GameState): ConceptChoiceOption[] {
  const pending = state.pendingConceptChoice;
  if (!pending) return [];
  const player = state.players[state.activePlayer];
  const creatureOption = (card: CardInstance): ConceptChoiceOption => ({
    id: card.uid,
    label: card.definition.name,
    detail: card.definition.kind === "creature"
      ? `Level ${card.definition.printedLevel} · ${card.definition.period} · ${card.definition.diet}`
      : card.definition.kind,
  });

  switch (pending.kind) {
    case "evolutionary-radiation-card":
      return [
        ...player.hand
        .filter((card) =>
          card.definition.kind === "creature" &&
          (pending.radiationRemainingLevels ?? []).includes(card.definition.printedLevel as 0 | 1),
        )
        .map(creatureOption),
        ...(pending.radiationPlacements
          ? [{ id: "__finish-radiation__", label: "Finish Radiation", detail: "Keep the first play, finish resolving this Concept, and retain your Battle Phase." }]
          : []),
      ];
    case "evolutionary-radiation-lane":
      return player.lanes
        .map((lane, index) => !lane.creature && creatureCanEnterNiche(state, state.activePlayer, index)
          ? ({ id: String(index), label: `Niche ${index + 1}`, detail: "Empty, unlocked destination" })
          : null)
        .filter((entry): entry is ConceptChoiceOption => Boolean(entry));
    case "whale-fall":
      return player.hand
        .filter((card) => card.definition.kind === "creature" && card.definition.printedLevel >= 2)
        .map(creatureOption);
    case "natural-selection-cost":
      return player.hand.filter((card) => card.definition.kind === "creature").map(creatureOption);
    case "natural-selection-search":
      return player.deck.filter((card) => card.definition.kind === "creature").map(creatureOption);
    case "genetic-drift-discard":
      return player.hand
        .filter((card) => pending.eligibleUids?.includes(card.uid))
        .map(creatureOption);
    case "dig-site":
      return player.history
        .filter((card) => card.definition.key !== "dig-site-excavation")
        .map(creatureOption);
    case "semelparity-cost": {
      const hand = player.hand
        .filter((card) => card.definition.kind === "creature" && card.definition.printedLevel === 0)
        .map((card) => ({ ...creatureOption(card), id: `hand:${card.uid}`, detail: `${creatureOption(card).detail} · Hand` }));
      const board = player.lanes
        .map((lane, index) => lane.creature?.card.definition.printedLevel === 0
          ? ({ id: `lane:${index}`, label: lane.creature.card.definition.name, detail: `Level 0 · Niche ${index + 1}` })
          : null)
        .filter((entry): entry is ConceptChoiceOption => Boolean(entry));
      return [...hand, ...board];
    }
    case "semelparity-replacement-card":
      return [
        ...player.hand
          .filter((card) => card.definition.kind === "creature" && card.definition.printedLevel === 0)
          .map(creatureOption),
        {
          id: "__decline-semelparity__",
          label: "Decline replacement",
          detail: "Finish resolving Semelparity and keep your Battle Phase.",
        },
      ];
    case "semelparity-replacement-lane":
      return [
        ...player.lanes
          .map((lane, index) => !lane.creature && creatureCanEnterNiche(state, state.activePlayer, index)
            ? ({ id: String(index), label: `Niche ${index + 1}`, detail: "Empty, unlocked destination" })
            : null)
          .filter((entry): entry is ConceptChoiceOption => Boolean(entry)),
        {
          id: "__decline-semelparity__",
          label: "Decline replacement",
          detail: "Return to the card choice without playing a Creature.",
        },
      ];
    case "obligate-migration-source":
      return state.players.flatMap((side) => {
        if (!side.lanes.some((lane, index) => !lane.creature && creatureCanEnterNiche(state, side.id, index))) return [];
        return side.lanes
          .map((lane, index) => creatureCanMoveByEffect(lane)
            ? ({
                id: `${side.id}:${index}`,
                label: lane.creature!.card.definition.name,
                detail: `${side.id === state.activePlayer ? "Your" : `${side.name}'s`} Niche ${index + 1}`,
              })
            : null)
          .filter((entry): entry is ConceptChoiceOption => Boolean(entry));
      });
    case "obligate-migration-destination": {
      const sourcePlayer = pending.sourcePlayer;
      if (sourcePlayer === undefined) return [];
      return state.players[sourcePlayer].lanes
        .map((lane, index) => !lane.creature && creatureCanEnterNiche(state, sourcePlayer, index)
          ? ({ id: `${sourcePlayer}:${index}`, label: `Niche ${index + 1}`, detail: `Empty, unlocked destination on ${state.players[sourcePlayer].name}'s side` })
          : null)
        .filter((entry): entry is ConceptChoiceOption => Boolean(entry));
    }
    case "abiogenesis-mode": {
      const canSearch = player.deck.some(
        (card) => card.definition.kind === "creature" && card.definition.printedLevel === 0,
      );
      const canPlace =
        player.hand.some((card) => card.definition.kind === "creature" && card.definition.printedLevel === 0) &&
        player.lanes.some((lane, index) => !lane.creature && creatureCanEnterNiche(state, state.activePlayer, index));
      return [
        ...(canSearch
          ? [{
              id: "__abiogenesis-search__",
              label: "Search your deck",
              detail: "Add one Level 0 Creature from your deck to your hand, then shuffle.",
            }]
          : []),
        ...(canPlace
          ? [{
              id: "__abiogenesis-place__",
              label: "Fill an empty Niche",
              detail: "Place one Level 0 Creature from your hand without using your normal Creature play; skip Battle.",
            }]
          : []),
      ];
    }
    case "abiogenesis-search":
      return player.deck
        .filter((card) => card.definition.kind === "creature" && card.definition.printedLevel === 0)
        .map(creatureOption);
    case "abiogenesis-placement-card":
      return player.hand
        .filter((card) => card.definition.kind === "creature" && card.definition.printedLevel === 0)
        .map(creatureOption);
    case "abiogenesis-placement-lane":
      return player.lanes
        .map((lane, index) => !lane.creature && creatureCanEnterNiche(state, state.activePlayer, index)
          ? ({ id: String(index), label: `Niche ${index + 1}`, detail: "Empty, unlocked destination" })
          : null)
        .filter((entry): entry is ConceptChoiceOption => Boolean(entry));
  }
}

function takeDeckCard(player: PlayerState, uid: string) {
  const index = player.deck.findIndex((card) => card.uid === uid);
  if (index < 0) return null;
  return player.deck.splice(index, 1)[0];
}

export function chooseConceptOption(original: GameState, optionId: string): GameState {
  const state = clone(original);
  const pending = state.pendingConceptChoice;
  if (!pending || !getConceptChoiceOptions(state).some((option) => option.id === optionId)) return state;
  const player = state.players[state.activePlayer];

  switch (pending.kind) {
    case "evolutionary-radiation-card":
      if (optionId === "__finish-radiation__") {
        addLog(state, `Evolutionary Radiation finished after ${pending.radiationPlacements} placement${pending.radiationPlacements === 1 ? "" : "s"}.`);
        return completeConcept(state, pending.card);
      }
      pending.selectedCardUid = optionId;
      pending.kind = "evolutionary-radiation-lane";
      return state;
    case "evolutionary-radiation-lane": {
      const laneIndex = Number(optionId);
      const card = moveCardFromHand(player, pending.selectedCardUid!);
      if (!card || card.definition.kind !== "creature") return state;
      const placedLevel = card.definition.printedLevel as 0 | 1;
      player.lanes[laneIndex].creature = makeCreatureInPlay(
        card as CardInstance & { definition: CreatureCard },
        state.turnNumber,
        nextTurnForPlayer(state, state.activePlayer),
      );
      player.allowances.radiationPlacements += 1;
      pending.radiationPlacements = (pending.radiationPlacements ?? 0) + 1;
      pending.radiationRemainingLevels = (pending.radiationRemainingLevels ?? []).filter((level) => level !== placedLevel);
      addLog(state, `Evolutionary Radiation placed ${card.definition.name} into Niche ${laneIndex + 1} without using the normal Creature play.`);
      if (pending.radiationPlacements === 2) {
        player.allowances.skipBattlePhase = true;
        addLog(state, `${player.name} resolved both Evolutionary Radiation effects and must skip the Battle Phase this turn.`);
      }
      queueEntryEffects(state, state.activePlayer, laneIndex);
      const canPlaceAnother =
        pending.radiationRemainingLevels.length > 0 &&
        player.lanes.some((lane, index) => !lane.creature && creatureCanEnterNiche(state, state.activePlayer, index)) &&
        player.hand.some((held) =>
          held.definition.kind === "creature" &&
          pending.radiationRemainingLevels!.includes(held.definition.printedLevel as 0 | 1),
        );
      if (canPlaceAnother) {
        pending.selectedCardUid = undefined;
        pending.kind = "evolutionary-radiation-card";
        addLog(state, "Evolutionary Radiation may resolve its other eligible effect; doing so will skip the Battle Phase this turn.");
        return state;
      }
      addLog(state, `Evolutionary Radiation completed ${pending.radiationPlacements} placement${pending.radiationPlacements === 1 ? "" : "s"}.`);
      return completeConcept(state, pending.card);
    }
    case "whale-fall": {
      const card = moveCardFromHand(player, optionId);
      if (!card || card.definition.kind !== "creature") return state;
      sendCardToHistory(state, card, "Whale Fall");
      const aquatic = countsAsAquatic(card.definition);
      const draws = aquatic ? 3 : 2;
      for (let index = 0; index < draws; index += 1) drawOne(state, state.activePlayer, "Whale Fall");
      addLog(state, `Whale Fall sent ${card.definition.name} to History and drew ${draws}.`);
      return completeConcept(state, pending.card);
    }
    case "natural-selection-cost": {
      const card = moveCardFromHand(player, optionId);
      if (!card) return state;
      sendCardToHistory(state, card, "Natural Selection cost");
      addLog(state, `${card.definition.name} was paid as Natural Selection's additional cost.`);
      pending.kind = "natural-selection-search";
      return state;
    }
    case "natural-selection-search": {
      const card = takeDeckCard(player, optionId);
      if (!card) return state;
      player.hand.push(card);
      player.deck = shuffle(player.deck);
      addLog(state, `Natural Selection found and revealed ${card.definition.name}; the deck was shuffled.`);
      return completeConcept(state, pending.card);
    }
    case "genetic-drift-discard": {
      const card = moveCardFromHand(player, optionId);
      if (!card) return state;
      sendCardToHistory(state, card, "Genetic Drift discard");
      addLog(state, `${card.definition.name} was sent to History to complete ${pending.card.definition.name}.`);
      return completeConcept(state, pending.card);
    }
    case "dig-site": {
      const index = player.history.findIndex((card) => card.uid === optionId);
      if (index < 0) return state;
      const [card] = player.history.splice(index, 1);
      player.hand.push(card);
      addLog(state, `Dig Site Excavation returned ${card.definition.name} to ${player.name}'s hand.`);
      return completeConcept(state, pending.card);
    }
    case "semelparity-cost": {
      let paidFromPlay = false;
      if (optionId.startsWith("hand:")) {
        const card = moveCardFromHand(player, optionId.slice(5));
        if (!card) return state;
        sendCardToHistory(state, card, "Semelparity cost");
        addLog(state, `${card.definition.name} was paid from hand for Semelparity.`);
      } else {
        const laneIndex = Number(optionId.slice(5));
        const name = player.lanes[laneIndex].creature?.card.definition.name;
        sendCreatureToHistory(state, state.activePlayer, laneIndex, "effect");
        addLog(state, `${name} was paid from Niche ${laneIndex + 1} for Semelparity.`);
        paidFromPlay = true;
      }
      for (let index = 0; index < 2; index += 1) drawOne(state, state.activePlayer, "Semelparity");
      const replacementAvailable =
        paidFromPlay &&
        player.hand.some((card) => card.definition.kind === "creature" && card.definition.printedLevel === 0) &&
        player.lanes.some((lane, index) => !lane.creature && creatureCanEnterNiche(state, state.activePlayer, index));
      if (!replacementAvailable) return completeConcept(state, pending.card);
      pending.kind = "semelparity-replacement-card";
      addLog(state, "Semelparity may replace the Creature paid from play with a Level 0 Creature from hand.");
      return state;
    }
    case "semelparity-replacement-card":
      if (optionId === "__decline-semelparity__") {
        addLog(state, `${player.name} declined Semelparity's optional replacement and kept their Battle Phase.`);
        return completeConcept(state, pending.card);
      }
      pending.selectedCardUid = optionId;
      pending.kind = "semelparity-replacement-lane";
      return state;
    case "semelparity-replacement-lane": {
      if (optionId === "__decline-semelparity__") {
        pending.selectedCardUid = undefined;
        pending.kind = "semelparity-replacement-card";
        return state;
      }
      const laneIndex = Number(optionId);
      const card = moveCardFromHand(player, pending.selectedCardUid!);
      if (!card || card.definition.kind !== "creature" || card.definition.printedLevel !== 0) return state;
      player.lanes[laneIndex].creature = makeCreatureInPlay(
        card as CardInstance & { definition: CreatureCard },
        state.turnNumber,
        nextTurnForPlayer(state, state.activePlayer),
      );
      player.allowances.skipBattlePhase = true;
      addLog(state, `Semelparity played ${card.definition.name} into Niche ${laneIndex + 1} without using the normal Creature play; ${player.name} must skip the Battle Phase this turn.`);
      queueEntryEffects(state, state.activePlayer, laneIndex);
      return completeConcept(state, pending.card);
    }
    case "obligate-migration-source": {
      const [sourcePlayer, sourceLane] = optionId.split(":").map(Number);
      pending.sourcePlayer = sourcePlayer as PlayerId;
      pending.sourceLane = sourceLane;
      pending.kind = "obligate-migration-destination";
      return state;
    }
    case "obligate-migration-destination": {
      const [destinationPlayer, destinationLane] = optionId.split(":").map(Number);
      if (pending.sourcePlayer === undefined || destinationPlayer !== pending.sourcePlayer) return state;
      const migratingPlayer = state.players[pending.sourcePlayer];
      const source = migratingPlayer.lanes[pending.sourceLane!];
      const destination = migratingPlayer.lanes[destinationLane];
      if (!creatureCanMoveByEffect(source) || !destination || destination.creature || !creatureCanEnterNiche(state, pending.sourcePlayer, destinationLane)) return state;
      const sourceLane = pending.sourceLane!;
      const migratingName = source.creature!.card.definition.name;
      destination.creature = source.creature;
      destination.attachment = source.attachment;
      destination.engulfed = source.engulfed;
      source.creature = null;
      source.attachment = null;
      source.engulfed = null;
      addLog(state, `Obligate Migration moved ${migratingName} on ${migratingPlayer.name}'s side from Niche ${sourceLane + 1} to Niche ${destinationLane + 1} without triggering a fill effect.`);
      return completeConcept(state, pending.card);
    }
    case "abiogenesis-mode":
      pending.kind = optionId === "__abiogenesis-search__"
        ? "abiogenesis-search"
        : "abiogenesis-placement-card";
      return state;
    case "abiogenesis-search": {
      const card = takeDeckCard(player, optionId);
      if (!card) return state;
      player.hand.push(card);
      player.deck = shuffle(player.deck);
      addLog(state, `Abiogenesis found ${card.definition.name}; the deck was shuffled.`);
      return completeConcept(state, pending.card);
    }
    case "abiogenesis-placement-card":
      pending.selectedCardUid = optionId;
      pending.kind = "abiogenesis-placement-lane";
      return state;
    case "abiogenesis-placement-lane": {
      const laneIndex = Number(optionId);
      const card = moveCardFromHand(player, pending.selectedCardUid!);
      if (!card || card.definition.kind !== "creature" || card.definition.printedLevel !== 0) return state;
      player.lanes[laneIndex].creature = makeCreatureInPlay(
        card as CardInstance & { definition: CreatureCard },
        state.turnNumber,
        nextTurnForPlayer(state, state.activePlayer),
      );
      player.allowances.skipBattlePhase = true;
      addLog(state, `Abiogenesis placed ${card.definition.name} into Niche ${laneIndex + 1} without using the normal Creature play; ${player.name} must skip the Battle Phase this turn.`);
      queueEntryEffects(state, state.activePlayer, laneIndex);
      return completeConcept(state, pending.card);
    }
  }
}

function activeSuperpredators(state: GameState) {
  return state.players.some((player) => player.event?.definition.key === "superpredators");
}

function hasCrypticCamouflage(
  state: GameState,
  creature: CreatureInPlay,
  laneIndex: number,
) {
  return state.players[creature.card.owner].lanes[laneIndex]?.attachment?.definition.key === "cryptic-camouflage";
}

function creatureCanAttackTarget(
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
  if (
    hasCrypticCamouflage(state, attacker, attackerLane) &&
    attackerDef.diet === "Herbivore"
  ) return false;
  if (
    attacker.enteredTurn === state.turnNumber &&
    !options.ignoreEntryTurn &&
    !attackerDef.tags.includes("Ambush") &&
    !attackerDef.tags.includes("Charge")
  ) return false;
  if (attackerDef.tags.includes("Elusive") && targetDef.printedLevel >= 1) return false;
  if (effectiveHasTag(targetDef, "Gigantic") && attackerDef.printedLevel <= 1) return false;
  if (target.burrowedUntilTurn !== null && state.turnNumber < target.burrowedUntilTurn) return false;
  if (
    state.activePlayer !== target.card.owner &&
    target.deimaticProtectedThroughTurn !== null &&
    state.turnNumber <= target.deimaticProtectedThroughTurn
  ) return false;
  if (attacker.attackBarriers.some((barrier) => barrier.targetUid === target.card.uid && barrier.expiresOnTurn === state.turnNumber)) return false;
  if (attackerDef.tags.includes("Charge") && attackerLane !== targetLane) return false;
  if (options.ignoreDiet) return true;
  if (attackerDef.tags.includes("Charge")) return true;
  if (effectiveHasTag(attackerDef, "Territorial") && attackerLane === targetLane) return true;
  if (activeSuperpredators(state) && (attackerDef.diet === "Carnivore" || attackerDef.diet === "Omnivore")) return true;
  if (attackerDef.diet === "Herbivore") return false;
  if (attackerDef.diet === "Omnivore") return targetDef.diet === "Herbivore";
  if (attackerDef.diet === "Carnivore") {
    return ["Herbivore", "Omnivore"].includes(targetDef.diet);
  }
  return false;
}

export function legalAttackTargets(state: GameState, attackerUid: string) {
  if (
    state.phase !== "battle" ||
    resolutionBlocked(state) ||
    state.winner !== null
  ) return [] as string[];
  const found = findCreature(state, attackerUid);
  if (!found || found.playerId !== state.activePlayer) return [] as string[];
  const opponent = otherPlayer(state.activePlayer);
  return state.players[opponent].lanes
    .filter(
      (lane, targetLane) =>
        lane.creature &&
        creatureCanAttackTarget(state, found.creature, found.laneIndex, lane.creature, targetLane),
    )
    .map((lane) => lane.creature!.card.uid);
}

type BattleNumbers = {
  attackerLevel: number;
  defenderLevel: number;
  attackerOwnReactiveBonus: number;
  defenderOwnReactiveBonus: number;
  attackerNotes: string[];
  defenderNotes: string[];
};

function hasNoAdjacentFriendly(state: GameState, playerId: PlayerId, laneIndex: number) {
  const lanes = state.players[playerId].lanes;
  return !lanes[laneIndex - 1]?.creature && !lanes[laneIndex + 1]?.creature;
}

function adjacentHighBastionCount(state: GameState, playerId: PlayerId, laneIndex: number) {
  const lanes = state.players[playerId].lanes;
  return [lanes[laneIndex - 1], lanes[laneIndex + 1]].filter((lane) =>
    lane?.creature?.card.definition.tags.includes("Bastion") &&
    lane.creature.card.definition.printedLevel >= 2,
  ).length;
}

function calculateBattleNumbers(
  state: GameState,
  attackerFound: NonNullable<ReturnType<typeof findCreature>>,
  defenderFound: NonNullable<ReturnType<typeof findCreature>>,
  targetAlreadyAttacked: boolean,
  offensiveCrypticBonus = 0,
  origin: BattlePreview["origin"] = "battle-phase",
): BattleNumbers {
  const attacker = attackerFound.creature;
  const defender = defenderFound.creature;
  const attackerDef = attacker.card.definition;
  const defenderDef = defender.card.definition;
  let attackerLevel = attackerDef.printedLevel;
  let defenderLevel = defenderDef.printedLevel;
  let attackerOwnReactiveBonus = 0;
  let defenderOwnReactiveBonus = 0;
  const attackerNotes: string[] = [];
  const defenderNotes: string[] = [];

  if (attackerDef.tags.includes("Solitary") && hasNoAdjacentFriendly(state, attackerFound.playerId, attackerFound.laneIndex)) {
    attackerLevel += 1;
    attackerNotes.push("Solitary +1");
  }
  if (defenderDef.tags.includes("Solitary") && hasNoAdjacentFriendly(state, defenderFound.playerId, defenderFound.laneIndex)) {
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
  if (attackerDef.tags.includes("Rivalry") && attackerFound.laneIndex === defenderFound.laneIndex) {
    const bonus = tagEffectMultiplier(attackerDef, "Rivalry");
    attackerLevel += bonus;
    attackerNotes.push(`Rivalry +${bonus}`);
  }
  if (defenderDef.tags.includes("Rivalry") && attackerFound.laneIndex === defenderFound.laneIndex) {
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
  const defenderBastions = defenderDef.printedLevel <= 1
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
  if (
    attackerDef.tags.includes("Crushing Bite") &&
    defenderTagDefenseBonus > 0 &&
    !defenderDef.tags.includes("Sovereign")
  ) {
    const reduction = tagEffectMultiplier(attackerDef, "Crushing Bite");
    const applied = Math.min(defenderTagDefenseBonus, reduction);
    defenderTagDefenseBonus -= applied;
    defenderOwnReactiveBonus = Math.max(0, defenderOwnReactiveBonus - applied);
    attackerNotes.push(`Crushing Bite reduced reactive defense by up to ${reduction}`);
  } else if (
    attackerDef.tags.includes("Crushing Bite") &&
    defenderTagDefenseBonus > 0 &&
    defenderDef.tags.includes("Sovereign")
  ) {
    defenderNotes.push("Sovereign prevented Crushing Bite");
  }
  defenderLevel += defenderTagDefenseBonus;

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
    const attackerBastions = attackerDef.printedLevel <= 1
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
  if (state.players[otherPlayer(attackerFound.playerId)].lanes[attackerFound.laneIndex].drought) {
    attackerLevel -= 1;
    attackerNotes.push("Drought -1");
  }
  if (state.players[otherPlayer(defenderFound.playerId)].lanes[defenderFound.laneIndex].drought) {
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

function calculateBattleCoinPlan(
  state: GameState,
  attacker: NonNullable<ReturnType<typeof findCreature>>,
  defender: NonNullable<ReturnType<typeof findCreature>>,
): BattleCoinPlan {
  const attackerDef = attacker.creature.card.definition;
  const defenderDef = defender.creature.card.definition;
  const offensiveCamouflage =
    attacker.lane.attachment?.definition.key === "cryptic-camouflage" &&
    (attackerDef.diet === "Carnivore" || attackerDef.diet === "Omnivore");
  const defensiveCamouflage =
    defender.lane.attachment?.definition.key === "cryptic-camouflage" &&
    defenderDef.diet === "Herbivore";
  const nativeElusive = defenderDef.tags.includes("Elusive");
  const evasionAvailable = defender.creature.elusiveUsedTurn !== state.turnNumber;

  return {
    offensiveCount: offensiveCamouflage ? (attackerDef.tags.includes("Ambush") ? 2 : 1) : 0,
    offensiveReason: offensiveCamouflage ? "Cryptic Camouflage attack" : null,
    defensiveCount: evasionAvailable && (nativeElusive || defensiveCamouflage)
      ? (nativeElusive && defensiveCamouflage ? 2 : 1)
      : 0,
    defensiveReason: evasionAvailable && (nativeElusive || defensiveCamouflage)
      ? nativeElusive && defensiveCamouflage
        ? "Elusive + Cryptic Camouflage evasion"
        : nativeElusive
          ? "Elusive evasion"
          : "Cryptic Camouflage evasion"
      : null,
  };
}

export function battleCoinPlan(state: GameState): BattleCoinPlan {
  const pending = state.pendingBattle;
  if (!pending) return { offensiveCount: 0, offensiveReason: null, defensiveCount: 0, defensiveReason: null };
  const attacker = findCreature(state, pending.attackerUid);
  const defender = findCreature(state, pending.defenderUid);
  if (!attacker || !defender) return { offensiveCount: 0, offensiveReason: null, defensiveCount: 0, defensiveReason: null };
  return calculateBattleCoinPlan(state, attacker, defender);
}

export function canUseTemperateReroll(state: GameState, playerId: PlayerId) {
  const player = state.players[playerId];
  const battle = state.pendingBattle;
  return Boolean(
    battle &&
    state.winner === null &&
    (battle.attackerPlayer === playerId || battle.defenderPlayer === playerId) &&
    player.biome.key === "temperate" &&
    player.biome.seasonCounters > 0 &&
    player.biome.temperateRerollTurn !== state.turnNumber
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

function createBattlePreview(
  state: GameState,
  attacker: NonNullable<ReturnType<typeof findCreature>>,
  defender: NonNullable<ReturnType<typeof findCreature>>,
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
    numbers.attackerNotes.push(`Cryptic Camouflage: +0 to +${coinPlan.offensiveCount} (${coinPlan.offensiveCount} ${coinPlan.offensiveCount === 1 ? "coin" : "coins"})`);
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
    ...numbers,
  };
}

export function previewBattle(original: GameState, attackerUid: string, defenderUid: string): GameState {
  const state = clone(original);
  if (!legalAttackTargets(state, attackerUid).includes(defenderUid)) return state;
  const attacker = findCreature(state, attackerUid)!;
  const defender = findCreature(state, defenderUid)!;
  createBattlePreview(state, attacker, defender, "battle-phase");
  return state;
}

export function cancelBattlePreview(original: GameState): GameState {
  const state = clone(original);
  if (state.pendingBattle?.origin === "stampede") return state;
  state.pendingBattle = null;
  return state;
}

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
      addLog(state, `${creature.card.definition.name}'s Mob Feeder bonus is ready for its next initiated Hunt this turn.`);
    }
  }
}

function tryAutotomy(state: GameState, found: NonNullable<ReturnType<typeof findCreature>>) {
  const attachment = found.lane.attachment;
  if (attachment?.definition.key !== "autotomy") return false;
  sendCardToHistory(state, attachment, "Autotomy prevention");
  found.lane.attachment = null;
  found.creature.cannotAttackOnTurn = nextTurnForPlayer(state, found.playerId);
  addLog(state, `Autotomy prevented ${found.creature.card.definition.name}'s destruction.`);
  return true;
}

function hasLethalThagomizer(found: NonNullable<ReturnType<typeof findCreature>>) {
  const definition = found.creature.card.definition;
  return (
    found.lane.attachment?.definition.key === "thagomizer" &&
    definition.tags.includes("Armament") &&
    definition.tags.includes("Retaliation")
  );
}

const HARD_DEFENSE_TAGS = new Set(["Shell", "Osteoderm", "Dermal Armor"]);

function resolveKillTags(
  state: GameState,
  killer: NonNullable<ReturnType<typeof findCreature>>,
  defeated: CardInstance & { definition: CreatureCard },
) {
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

export function chooseEngulf(original: GameState, accept: boolean): GameState {
  const state = clone(original);
  const pending = state.pendingEngulf;
  if (!pending) return state;
  const lane = state.players[pending.holderPlayer].lanes[pending.holderLane];
  const holder = lane.creature;
  const defeatedHistory = state.players[pending.defeatedOwner].history;
  const defeatedIndex = defeatedHistory.findIndex((card) => card.uid === pending.defeatedUid);
  if (accept && holder && adaptationSlotEmpty(lane) && defeatedIndex >= 0) {
    const [defeated] = defeatedHistory.splice(defeatedIndex, 1);
    if (defeated.definition.kind === "creature") {
      lane.engulfed = defeated as CardInstance & { definition: CreatureCard };
      addLog(state, `${holder.card.definition.name} Engulfed ${defeated.definition.name}; its Adaptation Slot is now occupied.`);
    }
  } else {
    addLog(state, `${holder?.card.definition.name ?? "The Creature"} declined Engulf.`);
  }
  state.pendingEngulf = null;
  return finishResolution(state);
}

export function battleNeedsElusiveFlip(state: GameState) {
  return battleCoinPlan(state).defensiveCount > 0;
}

function resolvedCoinResults(count: number, supplied?: boolean[]) {
  return Array.from({ length: count }, (_, index) => supplied?.[index] ?? Math.random() < 0.5);
}

function coinFaces(results: boolean[]) {
  return results.map((success) => success ? "red Rex" : "black reverse").join(", ");
}

export function commitBattle(
  original: GameState,
  suppliedResults?: boolean | BattleCoinResults,
): GameState {
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
  const normalized = typeof suppliedResults === "boolean"
    ? { defensive: [suppliedResults] }
    : suppliedResults ?? {};
  const offensiveResults = resolvedCoinResults(plan.offensiveCount, normalized.offensive);
  const defensiveResults = resolvedCoinResults(plan.defensiveCount, normalized.defensive);
  const offensiveBonus = offensiveResults.filter(Boolean).length;
  const numbers = calculateBattleNumbers(state, attacker, defender, targetAlreadyAttacked, offensiveBonus, pending.origin);
  if (defender.creature.card.definition.tags.includes("Bastion") && defender.creature.card.definition.printedLevel <= 1) {
    defender.creature.bastionDefendedTurn = state.turnNumber;
  }
  if (
    pending.origin === "stampede" &&
    attacker.creature.card.definition.tags.includes("Bastion") &&
    attacker.creature.card.definition.printedLevel <= 1
  ) {
    attacker.creature.bastionAttackedTurn = state.turnNumber;
  }
  if (attacker.creature.mobFeederBonusTurn === state.turnNumber) attacker.creature.mobFeederBonusTurn = null;
  if (attacker.creature.card.definition.tags.includes("Visual")) attacker.creature.visualUsed = true;
  if (defender.creature.card.definition.tags.includes("Visual")) defender.creature.visualUsed = true;

  if (offensiveResults.length) {
    addLog(state, `${attacker.creature.card.definition.name}'s Cryptic Camouflage ${offensiveResults.length === 1 ? "coin showed" : "coins showed"} ${coinFaces(offensiveResults)} — +${offensiveBonus} Battle Level.`);
  }

  const forcedTie = defensiveResults.some(Boolean);
  if (defensiveResults.length) {
    defender.creature.elusiveUsedTurn = state.turnNumber;
    addLog(state, `${defender.creature.card.definition.name}'s evasive ${defensiveResults.length === 1 ? "coin showed" : "coins showed"} ${coinFaces(defensiveResults)} — ${forcedTie ? "success" : "failure"}.`);
  }

  const attackerName = attacker.creature.card.definition.name;
  const defenderName = defender.creature.card.definition.name;
  const tied = forcedTie || numbers.attackerLevel === numbers.defenderLevel;
  addLog(state, `${attackerName} committed a Hunt against ${defenderName}.`);

  if (tied) {
    const retaliationDestroysAttacker = defender.creature.card.definition.tags.includes("Retaliation") || hasLethalThagomizer(defender);
    const stampedeRetaliationDestroysDefender = pending.origin === "stampede" && attacker.creature.card.definition.tags.includes("Retaliation");
    addLog(state, `${attackerName} ${numbers.attackerLevel} vs. ${defenderName} ${numbers.defenderLevel}: tie.`);
    if (attacker.creature.card.definition.tags.includes("Saboteur")) {
      defender.creature.cannotAttackOnTurn = nextTurnForPlayer(state, defender.playerId);
      addLog(state, `Saboteur prevents ${defenderName} from Hunting during its controller's next Battle Phase.`);
    }
    if (attacker.creature.card.definition.tags.includes("Raptorial")) {
      defender.creature.cannotOverrideOnTurn = nextTurnForPlayer(state, defender.playerId);
      addLog(state, `Raptorial prevents ${defenderName} from being overridden during its controller's next turn.`);
    }
    const attackerUid = attacker.creature.card.uid;
    const defenderUid = defender.creature.card.uid;
    if (retaliationDestroysAttacker) {
      const currentAttacker = findCreature(state, attackerUid);
      if (currentAttacker && !tryAutotomy(state, currentAttacker)) {
        const defeated = sendCreatureToHistory(state, currentAttacker.playerId, currentAttacker.laneIndex, "battle");
        addLog(state, `${defenderName}'s ${hasLethalThagomizer(defender) ? "Thagomizer" : "Retaliation"} destroyed ${attackerName} after the tied Hunt.`);
        const killer = findCreature(state, defenderUid);
        if (killer && defeated?.definition.kind === "creature") {
          triggerMobFeeders(state, killer.playerId, killer.creature.card.uid);
          resolveKillTags(state, killer, defeated as CardInstance & { definition: CreatureCard });
        }
      }
    }
    if (stampedeRetaliationDestroysDefender) {
      const currentDefender = findCreature(state, defenderUid);
      if (currentDefender && !tryAutotomy(state, currentDefender)) {
        const defeated = sendCreatureToHistory(state, currentDefender.playerId, currentDefender.laneIndex, "battle");
        addLog(state, `${attackerName}'s Stampede-inverted Retaliation destroyed ${defenderName} after the tied Hunt.`);
        const killer = findCreature(state, attackerUid);
        if (killer && defeated?.definition.kind === "creature") {
          triggerMobFeeders(state, killer.playerId, killer.creature.card.uid);
          resolveKillTags(state, killer, defeated as CardInstance & { definition: CreatureCard });
        }
      }
    }
    if (!retaliationDestroysAttacker && !stampedeRetaliationDestroysDefender) {
      addLog(state, "Neither Creature was destroyed.");
    }
  } else if (numbers.attackerLevel < numbers.defenderLevel) {
    const savedByDefense =
      !hasLethalThagomizer(defender) &&
      numbers.defenderOwnReactiveBonus > 0 &&
      numbers.attackerLevel >= numbers.defenderLevel - numbers.defenderOwnReactiveBonus;
    if (tryAutotomy(state, attacker)) {
      addLog(state, `${attackerName} survived a ${numbers.attackerLevel} to ${numbers.defenderLevel} loss.`);
    } else if (savedByDefense) {
      const defenseTag = defender.creature.card.definition.tags.includes("Shell")
        ? "Shell"
        : defender.creature.card.definition.tags.includes("Dermal Armor")
          ? "Dermal Armor"
          : "Bastion";
      addLog(state, `${attackerName} lost ${numbers.attackerLevel} to ${numbers.defenderLevel}, but the defender's ${defenseTag} clause spared it.`);
    } else {
      const defeated = sendCreatureToHistory(state, attacker.playerId, attacker.laneIndex, "battle");
      addLog(state, `${defenderName} destroyed ${attackerName} (${numbers.defenderLevel} to ${numbers.attackerLevel}).`);
      triggerMobFeeders(state, defender.playerId, defender.creature.card.uid);
      if (defeated?.definition.kind === "creature") {
        resolveKillTags(state, defender, defeated as CardInstance & { definition: CreatureCard });
      }
    }
  } else if (tryAutotomy(state, defender)) {
    addLog(state, `${defenderName} survived a ${numbers.defenderLevel} to ${numbers.attackerLevel} loss.`);
  } else if (
    pending.origin === "stampede" &&
    numbers.attackerOwnReactiveBonus > 0 &&
    numbers.defenderLevel >= numbers.attackerLevel - numbers.attackerOwnReactiveBonus
  ) {
    addLog(state, `${defenderName} lost ${numbers.defenderLevel} to ${numbers.attackerLevel}, but ${attackerName}'s inverted defensive-Tag survival clause spared it.`);
  } else {
    const defeated = sendCreatureToHistory(state, defender.playerId, defender.laneIndex, "battle");
    addLog(state, `${attackerName} destroyed ${defenderName} (${numbers.attackerLevel} to ${numbers.defenderLevel}).`);
    triggerMobFeeders(state, attacker.playerId, attacker.creature.card.uid);
    if (defeated?.definition.kind === "creature") {
      resolveKillTags(state, attacker, defeated as CardInstance & { definition: CreatureCard });
    }
  }

  state.pendingBattle = null;
  return finishResolution(state);
}

export function advanceToBattle(original: GameState): GameState {
  const state = clone(original);
  if (
    state.phase !== "development" ||
    resolutionBlocked(state) ||
    state.players[state.activePlayer].allowances.rapidSpeciation
  ) return state;
  if (state.players[state.activePlayer].allowances.skipBattlePhase) {
    addLog(state, `${state.players[state.activePlayer].name} skipped the Battle Phase as required by a Development effect.`);
    return endTurn(state);
  }
  state.phase = "battle";
  addLog(state, `${state.players[state.activePlayer].name} entered the Battle Phase.`);
  return state;
}

export function hasLegalHunts(state: GameState, playerId: PlayerId = state.activePlayer) {
  if (state.activePlayer !== playerId || state.winner !== null) return false;
  if (state.players[playerId].allowances.skipBattlePhase) return false;
  const battleState = clone(state);
  battleState.phase = "battle";
  return battleState.players[playerId].lanes.some(
    (lane) => lane.creature && legalAttackTargets(battleState, lane.creature.card.uid).length > 0,
  );
}

export function advanceToBattleOrEndTurn(original: GameState): GameState {
  if (original.phase !== "development" || resolutionBlocked(original) || original.winner !== null) return clone(original);
  const battleState = advanceToBattle(original);
  if (battleState.phase !== "battle" || hasLegalHunts(battleState, battleState.activePlayer)) return battleState;
  addLog(battleState, `${battleState.players[battleState.activePlayer].name} had no legal Hunts.`);
  return endTurn(battleState);
}

export function endTurn(original: GameState): GameState {
  const state = clone(original);
  if (resolutionBlocked(state) || state.winner !== null) return state;
  const active = state.players[state.activePlayer];
  active.allowances.convergentEvolution = false;
  active.allowances.rapidSpeciation = false;
  for (const lane of active.lanes) {
    if (lane.creature) {
      lane.creature.attackBarriers = lane.creature.attackBarriers.filter(
        (barrier) => barrier.expiresOnTurn > state.turnNumber,
      );
    }
    if (lane.wildfire && lane.wildfire.expiresOnTurn <= state.turnNumber) {
      const expired = lane.wildfire.card;
      sendCardToHistory(state, expired, "Wildfire expired");
      lane.wildfire = null;
      addLog(state, `${expired.definition.name} left its Niche; that lane is unlocked.`);
    }
  }
  for (const side of state.players) {
    for (const lane of side.lanes) {
      if (
        lane.drought &&
        lane.drought.card.owner === active.id &&
        lane.drought.expiresOnTurn <= state.turnNumber
      ) {
        const expired = lane.drought.card;
        sendCardToHistory(state, expired, "Drought expired");
        lane.drought = null;
        addLog(state, `${expired.definition.name} left ${side.name}'s Niche; that individual Niche is unlocked.`);
      }
    }
  }
  if (resolveVictoryThreshold(state)) return state;
  addLog(state, `${active.name} ended Turn ${state.turnNumber}.`);
  const next = otherPlayer(state.activePlayer);
  state.activePlayer = next;
  state.turnNumber += 1;
  state.phase = "handoff";
  state.handoff = {
    kind: "turn",
    to: next,
    title: `${state.players[next].name}'s turn`,
    detail: `Pass the device to ${state.players[next].name}. Their hand will remain hidden until they continue.`,
  };
  return state;
}

export function performFullHandMulligan(original: GameState): GameState {
  const state = clone(original);
  const player = state.players[state.activePlayer];
  if (
    state.phase !== "development" ||
    resolutionBlocked(state) ||
    player.hand.length !== 10 ||
    player.fullHandMulliganUsed ||
    player.allowances.developmentActions !== 0
  ) return state;
  player.deck = shuffle([...player.deck, ...player.hand]);
  player.hand = [];
  for (let draw = 0; draw < 9; draw += 1) {
    if (!drawOne(state, state.activePlayer, "Full-Hand Mulligan")) break;
  }
  player.fullHandMulliganUsed = true;
  player.allowances.developmentActions += 1;
  addLog(state, `${player.name} used the once-per-game Full-Hand Mulligan and drew nine cards.`);
  return state;
}

export function concedeByExtinction(original: GameState): GameState {
  const state = clone(original);
  if (state.winner !== null) return state;
  const loser = state.activePlayer;
  const winner = otherPlayer(loser);
  state.winner = winner;
  state.winReason = `${state.players[loser].name} conceded by Extinction.`;
  state.phase = "game-over";
  addLog(state, `${state.players[winner].name} won: ${state.winReason}`);
  return state;
}

function allCreatures(state: GameState) {
  return state.players.flatMap((player) =>
    player.lanes.flatMap((lane) => (lane.creature ? [lane.creature] : [])),
  );
}

function isStegosaur(definition: CreatureCard) {
  return definition.taxa.includes("Stegosaur") || definition.taxa.includes("Stegosaurid");
}

export function cardVictoryLevel(state: GameState, creature: CreatureInPlay) {
  const definition = creature.card.definition;
  const creatures = allCreatures(state);
  const apex = creatures.filter((entry) => entry.card.definition.tags.includes("Apex Predator"));
  let value = definition.printedLevel;
  if (definition.tags.includes("Apex Predator")) {
    const otherApexPredators = Math.max(0, apex.length - 1);
    const protectedDecrease = definition.tags.includes("Spinal Sail")
      ? Math.max(0, otherApexPredators - 1)
      : otherApexPredators;
    value += Math.max(0, 2 - protectedDecrease);
  }
  if (effectiveHasTag(definition, "Gigantic")) value += tagEffectMultiplier(definition, "Gigantic");
  if (definition.printedLevel === 0) value += activeCambrianExplosions(state);

  const found = findCreature(state, creature.card.uid);
  if (found?.lane.engulfed) value += tagEffectMultiplier(definition, "Engulf");
  if (found?.lane.attachment?.definition.key === "thagomizer" && isStegosaur(definition)) value += 1;
  if (found?.lane.attachment?.definition.key === "island-dwarfism") {
    value += effectiveHasTag(definition, "Gigantic") ? 2 : 1;
  }
  if (found && state.players[otherPlayer(found.playerId)].lanes[found.laneIndex].drought) {
    value -= definition.tags.includes("Spinal Sail") ? 0 : 1;
  }

  return Math.max(0, value);
}

export function victoryTotals(state: GameState): [number, number] {
  return [0, 1].map((playerId) =>
    state.players[playerId as PlayerId].lanes.reduce(
      (total, lane) => total + (lane.creature ? cardVictoryLevel(state, lane.creature) : 0),
      0,
    ),
  ) as [number, number];
}

function resolveVictoryThreshold(state: GameState) {
  const totals = victoryTotals(state);
  let winner: PlayerId | null = null;
  if (totals[0] >= 12 && totals[1] >= 12) {
    if (totals[0] > totals[1]) winner = 0;
    if (totals[1] > totals[0]) winner = 1;
  } else if (totals[0] >= 12) winner = 0;
  else if (totals[1] >= 12) winner = 1;

  if (winner === null) return false;
  state.winner = winner;
  state.winReason = `${state.players[winner].name} reached ${totals[winner]} Victory Levels.`;
  state.phase = "game-over";
  state.handoff = null;
  addLog(state, `${state.players[winner].name} won with ${totals[winner]} Victory Levels.`);
  return true;
}

function finishResolution(state: GameState) {
  if (state.winner !== null || resolutionBlocked(state)) return state;
  if (resolveVictoryThreshold(state)) return state;
  if (state.pendingStampede) return continueStampede(state);
  if (state.endTurnAfterEntryEffects) {
    state.endTurnAfterEntryEffects = false;
    addLog(state, `${state.players[state.activePlayer].name}'s turn ends after Nesting resolved all entry effects.`);
    return endTurn(state);
  }
  if (state.phase === "battle" && state.players[state.activePlayer].allowances.skipBattlePhase) {
    addLog(state, `${state.players[state.activePlayer].name} skipped the Battle Phase as required by a Development effect.`);
    return endTurn(state);
  }
  return state;
}

export function handCardByUid(state: GameState, playerId: PlayerId, uid: string | null) {
  if (!uid) return null;
  return state.players[playerId].hand.find((card) => card.uid === uid) ?? null;
}

function hasAnyLegalTurnAction(state: GameState, playerId: PlayerId) {
  const player = state.players[playerId];
  if (playerId === state.activePlayer && canActivateCarnianPluvialEpisode(state)) return true;
  for (const card of player.hand) {
    if (card.definition.kind === "creature" && legalCreatureLanes(state, playerId, card).length) return true;
    if (card.definition.kind === "adaptation" && legalAdaptationTargets(state, card).length) return true;
    if (card.definition.key === "wildfire" && legalWildfireLanes(state, card).length) return true;
    if (card.definition.key === "drought" && legalDroughtTargets(state, card).length) return true;
    if (card.definition.kind === "event" && canPlayEvent(state, card)) return true;
    if (card.definition.kind === "concept" && canPlayConcept(state, card)) return true;
  }
  return hasLegalHunts(state, playerId);
}

export function inspectBattleLevel(
  state: GameState,
  creatureUid: string,
  role: "attacker" | "defender",
  opposingUid: string,
) {
  const creature = findCreature(state, creatureUid);
  const opposing = findCreature(state, opposingUid);
  if (!creature || !opposing) return null;
  const numbers = role === "attacker"
    ? calculateBattleNumbers(state, creature, opposing, opposing.creature.attackedTurn === state.turnNumber)
    : calculateBattleNumbers(state, opposing, creature, creature.creature.attackedTurn === state.turnNumber);
  return role === "attacker" ? numbers.attackerLevel : numbers.defenderLevel;
}
