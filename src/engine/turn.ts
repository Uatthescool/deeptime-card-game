import type { BiomeKey } from "../data/biomes.ts";
import { DECKS, type DeckKey } from "../data/cards.ts";
import { createBattlePreview, creatureCanAttackTarget } from "./battle-math.ts";
import {
  activeCambrianExplosions,
  addLog,
  clone,
  drawOne,
  emptyAllowances,
  emptyLane,
  findCreature,
  HAND_LIMIT,
  LANE_COUNT,
  otherPlayer,
  resolutionBlocked,
  sendCardToHistory,
  isGameOver,
} from "./core.ts";
import { canPerformFullHandMulligan, hasAnyLegalTurnAction } from "./queries.ts";
import { hasLegalHunts } from "./battle-math.ts";
import { randomInt, randomSeed, type RngHolder, seedLabel, shuffle } from "./rng.ts";
import {
  GAME_STATE_VERSION,
  type BiomeState,
  type CardInstance,
  type ComputerSeat,
  type GameState,
  type PlayerId,
  type PlayerState,
} from "./types.ts";
import { resolveVictoryThreshold, victoryTotals } from "./victory.ts";

const OPENING_HAND_SIZE = 5;
const ARID_TIPPING_POINT_TURN = 26;
const ARID_TIPPING_POINT_VICTORY = 10;

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

function makeDeck(rng: RngHolder, owner: PlayerId, deckKey: DeckKey): CardInstance[] {
  return shuffle(
    rng,
    DECKS[deckKey].map((definition) => ({
      uid: `${owner}-${definition.key}`,
      owner,
      definition,
      livingFossilUsed: false,
    })),
  );
}

const hasStarter = (hand: CardInstance[]) =>
  hand.some((card) => card.definition.kind === "creature" && card.definition.printedLevel <= 1);

/** Reshuffles until the five-card hand contains a Level 0 or Level 1 Creature. */
function drawOpeningHand(rng: RngHolder, player: PlayerState) {
  for (let attempts = 0; attempts < 50; attempts += 1) {
    player.deck = shuffle(rng, [...player.deck, ...player.hand]);
    player.hand = player.deck.splice(0, OPENING_HAND_SIZE);
    if (hasStarter(player.hand)) return;
  }
}

export type CreateGameOptions = {
  /** Fixes the game's randomness. Omit for a fresh random game. */
  seed?: number;
  /** A seat for the computer opponent. */
  computer?: ComputerSeat | null;
};

export function createGame(
  playerOne: string,
  playerTwo: string,
  biomes: [BiomeKey | null, BiomeKey | null] = [null, null],
  decks: [DeckKey, DeckKey] = ["deck-1", "deck-1"],
  options: CreateGameOptions = {},
): GameState {
  const seed = (options.seed ?? randomSeed()) >>> 0;
  const rng: RngHolder = { rng: seed };
  const first = randomInt(rng, 2) as PlayerId;
  const makePlayer = (id: PlayerId, name: string): PlayerState => ({
    id,
    name: name.trim() || `Player ${id + 1}`,
    deckKey: decks[id],
    deck: makeDeck(rng, id, decks[id]),
    hand: [],
    history: [],
    lanes: Array.from({ length: LANE_COUNT }, emptyLane),
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
  const players: [PlayerState, PlayerState] = [makePlayer(0, playerOne), makePlayer(1, playerTwo)];
  drawOpeningHand(rng, players[0]);
  drawOpeningHand(rng, players[1]);

  return {
    version: GAME_STATE_VERSION,
    seed,
    rng: rng.rng,
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
    seedLabel: seedLabel(seed),
    computer: options.computer ?? null,
    drawEvents: [],
    nextDrawEventId: 1,
  };
}

function overreachDue(state: GameState, player: PlayerState) {
  return player.overreachDueTurn !== null && player.overreachDueTurn <= state.turnNumber;
}

function scheduledStartPhaseDraws(state: GameState) {
  const player = state.players[state.activePlayer];
  return 1 + activeCambrianExplosions(state) + (overreachDue(state, player) ? player.overreachQueuedDraws : 0);
}

function returnLivingFossils(state: GameState, playerId: PlayerId) {
  const player = state.players[playerId];
  const remaining: string[] = [];
  for (const uid of player.returnQueue) {
    if (player.hand.length >= HAND_LIMIT) {
      remaining.push(uid);
      continue;
    }
    const historyIndex = player.history.findIndex((card) => card.uid === uid);
    if (historyIndex < 0) continue;
    const [card] = player.history.splice(historyIndex, 1);
    player.hand.push(card!);
    addLog(state, `${card!.definition.name} returned from History to ${player.name}'s hand.`);
  }
  player.returnQueue = remaining;
}

function declareWinner(state: GameState, winner: PlayerId, reason: string, logMessage: string) {
  state.winner = winner;
  state.winReason = reason;
  state.phase = "game-over";
  state.handoff = null;
  addLog(state, logMessage);
}

/** The last turn of the round in progress. Turn 1 is the first player's, so every round ends on an even turn. */
const endOfRound = (turnNumber: number) => (turnNumber % 2 === 0 ? turnNumber : turnNumber + 1);

/**
 * Deck exhaustion: once both decks are empty, the game ends at the end of that
 * round, so both players have taken the same number of turns. The higher
 * Victory total wins; equal totals are a draw. Called at the end of each turn.
 */
function resolveExhaustion(state: GameState) {
  if ((state.finalTurn ?? null) === null && state.players.every((player) => player.deck.length === 0)) {
    state.finalTurn = endOfRound(state.turnNumber);
    addLog(
      state,
      state.finalTurn === state.turnNumber
        ? "Both decks are empty: the game ends now, and the higher Victory total wins."
        : `Both decks are empty: Turn ${state.finalTurn} is the final turn, and then the higher Victory total wins.`,
    );
  }
  if (state.finalTurn === null || state.finalTurn === undefined || state.turnNumber < state.finalTurn) return false;

  const totals = victoryTotals(state);
  if (totals[0] === totals[1]) {
    state.drawn = true;
    state.winReason = `Both decks ran out with the Victory totals tied at ${totals[0]}.`;
    state.phase = "game-over";
    state.handoff = null;
    addLog(state, `The game is a draw: both decks ran out with ${totals[0]} Victory Levels each.`);
    return true;
  }
  const winner: PlayerId = totals[0] > totals[1] ? 0 : 1;
  const loser = otherPlayer(winner);
  declareWinner(
    state,
    winner,
    `Both decks ran out; ${state.players[winner].name} led ${totals[winner]} to ${totals[loser]} in Victory Levels.`,
    `${state.players[winner].name} won with the higher Victory total after both decks ran out.`,
  );
  return true;
}

function beginTurn(state: GameState) {
  const player = state.players[state.activePlayer];
  const expiring = (aura: GameState["periodAuras"][number]) =>
    aura.owner === state.activePlayer && aura.expiresAtTurnStart <= state.turnNumber;
  if (state.periodAuras.some(expiring)) {
    state.periodAuras = state.periodAuras.filter((aura) => !expiring(aura));
    addLog(state, `${player.name}'s Geological Boundary modifier ended at the start of the turn.`);
  }
  player.turnsStarted += 1;
  player.allowances = emptyAllowances();

  for (const lane of player.lanes) {
    if (lane.creature?.burrowedUntilTurn === state.turnNumber) lane.creature.burrowedUntilTurn = null;
    if (lane.creature) {
      lane.creature.attackBarriers = lane.creature.attackBarriers.filter(
        (barrier) => barrier.expiresOnTurn >= state.turnNumber,
      );
    }
  }

  addLog(state, `Turn ${state.turnNumber}: ${player.name}'s Start Phase began.`);

  if (
    player.biome.key === "arid" &&
    state.turnNumber >= ARID_TIPPING_POINT_TURN &&
    victoryTotals(state)[state.activePlayer] >= ARID_TIPPING_POINT_VICTORY &&
    state.players[otherPlayer(state.activePlayer)].lanes.every((lane) => !lane.creature)
  ) {
    declareWinner(
      state,
      state.activePlayer,
      `${player.name} crossed the Arid Tipping Point with 10 or more Victory Levels against an empty ecosystem.`,
      `${player.name} won through the Arid Tipping Point.`,
    );
    return;
  }

  drawOne(state, state.activePlayer, "normal Start Phase");
  returnLivingFossils(state, state.activePlayer);

  const cambrians = activeCambrianExplosions(state);
  for (let draw = 0; draw < cambrians; draw += 1) drawOne(state, state.activePlayer, "Cambrian Explosion");

  if (overreachDue(state, player)) {
    const queued = player.overreachQueuedDraws;
    player.overreachQueuedDraws = 0;
    player.overreachDueTurn = null;
    for (let draw = 0; draw < queued; draw += 1) drawOne(state, state.activePlayer, "Overreach");
    if (queued) addLog(state, `${player.name} resolved ${queued} queued Overreach ${queued === 1 ? "draw" : "draws"}.`);
  }

  state.phase = "development";
  state.handoff = null;
  addLog(state, `${player.name} entered the Development Phase.`);

  if (
    player.fullHandMulliganUsed &&
    player.hand.length === HAND_LIMIT &&
    !hasAnyLegalTurnAction(state, state.activePlayer)
  ) {
    const winner = otherPlayer(state.activePlayer);
    declareWinner(
      state,
      winner,
      `${player.name} suffered Hand-Lock Extinction.`,
      `${state.players[winner].name} won by Hand-Lock Extinction.`,
    );
  }
}

/** The incoming player confirms the handoff; their Start Phase begins. */
export function acknowledgeHandoff(original: GameState): GameState {
  const state = clone(original);
  if (!state.handoff) return state;
  state.handoff = null;
  const player = state.players[state.activePlayer];
  // Tropical Biodiversity: order the top two cards before a single-card Start Phase draw.
  if (player.biome.key === "tropical" && scheduledStartPhaseDraws(state) === 1 && player.deck.length >= 2) {
    state.phase = "start";
    state.pendingBiodiversity = { playerId: state.activePlayer, cardUids: [player.deck[0]!.uid, player.deck[1]!.uid] };
    addLog(state, `${player.name}'s Biodiversity revealed two possible next draws.`);
    return state;
  }
  beginTurn(state);
  return state;
}

/** Puts `cardUid` on top of the two cards a top-of-deck ordering effect revealed. */
export function orderTopTwo(state: GameState, playerId: PlayerId, cardUids: [string, string], cardUid: string) {
  const player = state.players[playerId];
  const [first, second] = player.deck;
  if (!first || !second || !cardUids.includes(first.uid) || !cardUids.includes(second.uid)) return false;
  if (second.uid === cardUid) [player.deck[0], player.deck[1]] = [second, first];
  return true;
}

export function chooseBiodiversityTop(original: GameState, cardUid: string): GameState {
  const state = clone(original);
  const pending = state.pendingBiodiversity;
  if (!pending || !pending.cardUids.includes(cardUid)) return state;
  if (!orderTopTwo(state, pending.playerId, pending.cardUids, cardUid)) return state;
  addLog(state, `${state.players[pending.playerId].name} used Biodiversity to order the next two cards.`);
  state.pendingBiodiversity = null;
  beginTurn(state);
  return state;
}

/**
 * Called after every completed action. Checks for victory, then advances any
 * multi-step sequence (Stampede, Nesting turn end, mandatory Battle skip).
 */
export function finishResolution(state: GameState): GameState {
  if (isGameOver(state) || resolutionBlocked(state)) return state;
  if (resolveVictoryThreshold(state)) return state;
  if (state.pendingStampede) return continueStampede(state);
  if (state.endTurnAfterEntryEffects) {
    state.endTurnAfterEntryEffects = false;
    addLog(state, `${state.players[state.activePlayer].name}'s turn ends after Nesting resolved all entry effects.`);
    return endTurn(state);
  }
  if (state.phase === "battle" && state.players[state.activePlayer].allowances.skipBattlePhase) {
    addLog(
      state,
      `${state.players[state.activePlayer].name} skipped the Battle Phase as required by a Development effect.`,
    );
    return endTurn(state);
  }
  return state;
}

/** Stampede: each Herbivore, counter-clockwise, must Hunt the Creature directly opposite it. */
export function continueStampede(state: GameState): GameState {
  const pending = state.pendingStampede;
  if (!pending || state.pendingBattle || resolutionBlocked(state)) return state;
  while (pending.nextIndex < pending.order.length) {
    const uid = pending.order[pending.nextIndex]!;
    pending.nextIndex += 1;
    const attacker = findCreature(state, uid);
    if (!attacker || attacker.creature.card.definition.diet !== "Herbivore") continue;
    const target = state.players[otherPlayer(attacker.playerId)].lanes[attacker.laneIndex]!.creature;
    if (!target) {
      addLog(state, `${attacker.creature.card.definition.name} had no Creature in its opposing Niche during Stampede.`);
      continue;
    }
    const defender = findCreature(state, target.card.uid);
    if (
      !defender ||
      !creatureCanAttackTarget(state, attacker.creature, attacker.laneIndex, defender.creature, defender.laneIndex, {
        ignoreDiet: true,
        ignoreEntryTurn: true,
      })
    ) {
      addLog(
        state,
        `${attacker.creature.card.definition.name} could not Hunt ${target.card.definition.name} during Stampede because of a non-Diet restriction.`,
      );
      continue;
    }
    createBattlePreview(state, attacker, defender, "stampede");
    addLog(
      state,
      `Stampede requires ${attacker.creature.card.definition.name} to Hunt ${target.card.definition.name}.`,
    );
    return state;
  }
  state.pendingStampede = null;
  addLog(state, `${state.players[pending.owner].name}'s Stampede finished; their turn ends without a Battle Phase.`);
  return endTurn(state);
}

export function endTurn(original: GameState): GameState {
  const state = clone(original);
  if (resolutionBlocked(state) || isGameOver(state)) return state;
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
      if (lane.drought && lane.drought.card.owner === active.id && lane.drought.expiresOnTurn <= state.turnNumber) {
        const expired = lane.drought.card;
        sendCardToHistory(state, expired, "Drought expired");
        lane.drought = null;
        addLog(state, `${expired.definition.name} left ${side.name}'s Niche; that individual Niche is unlocked.`);
      }
    }
  }
  if (resolveVictoryThreshold(state)) return state;
  if (resolveExhaustion(state)) return state;
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

export function advanceToBattle(original: GameState): GameState {
  const state = clone(original);
  const allowances = state.players[state.activePlayer].allowances;
  if (state.phase !== "development" || resolutionBlocked(state) || allowances.rapidSpeciation) return state;
  if (allowances.skipBattlePhase) {
    addLog(
      state,
      `${state.players[state.activePlayer].name} skipped the Battle Phase as required by a Development effect.`,
    );
    return endTurn(state);
  }
  state.phase = "battle";
  addLog(state, `${state.players[state.activePlayer].name} entered the Battle Phase.`);
  return state;
}

/** Enters the Battle Phase, or ends the turn directly when no Hunt is possible. */
export function advanceToBattleOrEndTurn(original: GameState): GameState {
  if (original.phase !== "development" || resolutionBlocked(original) || isGameOver(original)) return clone(original);
  const battleState = advanceToBattle(original);
  if (battleState.phase !== "battle" || hasLegalHunts(battleState, battleState.activePlayer)) return battleState;
  addLog(battleState, `${battleState.players[battleState.activePlayer].name} had no legal Hunts.`);
  return endTurn(battleState);
}

/** Once per game, with a full hand and before any other action: shuffle the hand in and draw nine. */
export function performFullHandMulligan(original: GameState): GameState {
  const state = clone(original);
  if (!canPerformFullHandMulligan(state)) return state;
  const player = state.players[state.activePlayer];
  player.deck = shuffle(state, [...player.deck, ...player.hand]);
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
  if (isGameOver(state)) return state;
  const loser = state.activePlayer;
  const winner = otherPlayer(loser);
  const reason = `${state.players[loser].name} conceded by Extinction.`;
  declareWinner(state, winner, reason, `${state.players[winner].name} won: ${reason}`);
  return state;
}
