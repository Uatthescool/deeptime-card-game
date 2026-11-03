/**
 * What happened in one game, gathered action by action. Shared by the balance
 * simulator (tools/balance.ts) and the play-data replayer (tools/playlog.ts), so
 * computer-vs-computer games and recorded games are measured the same way.
 */
import {
  cardVictoryLevel,
  type GameAction,
  type GameState,
  type PlayerId,
  victoryTotals,
} from "../src/engine/index.ts";

export type Ending =
  "victory" | "tipping-point" | "exhaustion" | "forfeit" | "hand-lock" | "concede" | "other" | "unfinished";

export function ending(reason: string | null, finished: boolean, winner: PlayerId | null): Ending {
  if (!finished) return "unfinished";
  if (!reason) return "other";
  if (/reached \d+ Victory Levels/.test(reason)) return "victory";
  if (/Tipping Point/.test(reason)) return "tipping-point";
  if (/Both decks ran out/.test(reason)) return "exhaustion";
  if (/forfeited/.test(reason)) return "forfeit";
  if (/Hand-Lock/.test(reason)) return "hand-lock";
  if (/conceded/.test(reason)) return "concede";
  return winner === null ? "exhaustion" : "other";
}

export type CardBoardStats = {
  entered: number;
  hunts: number;
  huntWins: number;
  hunted: number;
  survivedHunts: number;
  /** Destroyed as the defender of a Hunt. */
  lostToHunt: number;
  /** Destroyed while Hunting (Retaliation and the like). */
  lostHunting: number;
  lostToOverride: number;
  lostToEffect: number;
  /** Turn ends spent on the board, both players' turns counted. */
  turnsInPlay: number;
  endedInPlay: number;
  finalVictory: number;
};

export const emptyBoardStats = (): CardBoardStats => ({
  entered: 0,
  hunts: 0,
  huntWins: 0,
  hunted: 0,
  survivedHunts: 0,
  lostToHunt: 0,
  lostHunting: 0,
  lostToOverride: 0,
  lostToEffect: 0,
  turnsInPlay: 0,
  endedInPlay: 0,
  finalVictory: 0,
});

export type TimelinePoint = { turn: number; active: PlayerId; victory: [number, number]; creatures: [number, number] };

export type GameTracker = {
  /** Keys of the cards each player played from hand. */
  played: [string[], string[]];
  /** What each player's Creatures did on the board, by card key. */
  board: [Record<string, CardBoardStats>, Record<string, CardBoardStats>];
  /** Both Victory totals and Creature counts at the end of every turn. */
  timeline: TimelinePoint[];
};

export const createTracker = (): GameTracker => ({ played: [[], []], board: [{}, {}], timeline: [] });

const PLAYS = new Set<GameAction["type"]>([
  "playCreature",
  "playAquaticOverride",
  "playAdaptation",
  "playEvent",
  "playWildfire",
  "playDrought",
  "playConcept",
]);

/** Every Creature on the board by uid, with its seat and card key. */
function creaturesOnBoard(state: GameState) {
  const found = new Map<string, { seat: PlayerId; key: string }>();
  for (const player of state.players) {
    for (const lane of player.lanes) {
      if (lane.creature) found.set(lane.creature.card.uid, { seat: player.id, key: lane.creature.card.definition.key });
    }
  }
  return found;
}

/** Records what one action did: cards played, entries, Hunts, each Creature that left and why, and turn ends. */
export function trackAction(
  tracker: GameTracker,
  before: GameState,
  seat: PlayerId,
  action: GameAction,
  after: GameState,
) {
  const { board } = tracker;
  const stats = (owner: PlayerId, key: string) => (board[owner][key] ??= emptyBoardStats());
  if (PLAYS.has(action.type) && "cardUid" in action) {
    const card = before.players[seat].hand.find((entry) => entry.uid === action.cardUid);
    if (card) tracker.played[seat].push(card.definition.key);
  }
  const was = creaturesOnBoard(before);
  const now = creaturesOnBoard(after);
  const hunt = before.pendingBattle;
  const resolved =
    hunt &&
    action.type !== "cancelHunt" &&
    (!after.pendingBattle ||
      after.pendingBattle.attackerUid !== hunt.attackerUid ||
      after.pendingBattle.defenderUid !== hunt.defenderUid);
  if (hunt && resolved) {
    const attacker = was.get(hunt.attackerUid);
    const defender = was.get(hunt.defenderUid);
    if (attacker && defender) {
      stats(attacker.seat, attacker.key).hunts += 1;
      stats(defender.seat, defender.key).hunted += 1;
      if (now.has(hunt.defenderUid)) stats(defender.seat, defender.key).survivedHunts += 1;
      else stats(attacker.seat, attacker.key).huntWins += 1;
    }
  }
  for (const [uid, { seat: owner, key }] of now) if (!was.has(uid)) stats(owner, key).entered += 1;
  for (const [uid, { seat: owner, key }] of was) {
    if (now.has(uid)) continue;
    const entry = stats(owner, key);
    if (resolved && uid === hunt.defenderUid) entry.lostToHunt += 1;
    else if (resolved && uid === hunt.attackerUid) entry.lostHunting += 1;
    else if (action.type === "playCreature" || action.type === "playAquaticOverride") entry.lostToOverride += 1;
    else entry.lostToEffect += 1;
  }
  // Turns end through several actions, so snapshot whenever the turn number moves on.
  if (after.turnNumber !== before.turnNumber || after.phase === "game-over") {
    for (const [, { seat: owner, key }] of now) stats(owner, key).turnsInPlay += 1;
    tracker.timeline.push({
      turn: before.turnNumber,
      active: before.activePlayer,
      victory: victoryTotals(after),
      creatures: [0, 1].map((side) => after.players[side]!.lanes.filter((lane) => lane.creature).length) as [
        number,
        number,
      ],
    });
  }
}

/** Records the Creatures still on the board when the game ends, and the Victory Levels they hold. */
export function finishTracking(tracker: GameTracker, state: GameState) {
  for (const player of state.players) {
    for (const lane of player.lanes) {
      if (!lane.creature) continue;
      const entry = (tracker.board[player.id][lane.creature.card.definition.key] ??= emptyBoardStats());
      entry.endedInPlay += 1;
      entry.finalVictory += cardVictoryLevel(state, lane.creature);
    }
  }
}
