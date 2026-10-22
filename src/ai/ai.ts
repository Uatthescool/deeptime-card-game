import {
  actingPlayer,
  applyAction,
  canRerollBattleCoin,
  type CardInstance,
  commitBattle,
  type Difficulty,
  type GameAction,
  type GameState,
  listLegalActions,
  otherPlayer,
  type PlayerId,
  HAND_LIMIT,
  victoryTotals,
  VICTORY_THRESHOLD,
} from "../engine/index.ts";

/**
 * The computer opponent.
 *
 * It chooses only from the engine's legal moves and judges positions from
 * public information plus its own hand. It never sees hidden information:
 * every decision is planned on a "determinized" copy of the game in which
 * everything the AI couldn't know (the opponent's hand, the order of both
 * decks, the random number generator) is re-dealt at random. Battle Coins are
 * never peeked at either; Hunts are judged by weighing every coin outcome by
 * its probability.
 */

export type { Difficulty } from "../engine/index.ts";

export const DIFFICULTY_NAMES: Record<Difficulty, string> = { easy: "Easy", normal: "Normal" };

export type AiOptions = {
  difficulty: Difficulty;
  /** Source of the AI's own randomness (tie-breaks, Easy mistakes, re-dealing hidden cards). */
  random: () => number;
};

/** Small deterministic generator for the AI's own choices. */
export function aiRandom(seed: number) {
  let value = seed >>> 0 || 0x2545f491;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Position evaluation: public information and the AI's own hand only
// ---------------------------------------------------------------------------

function boardValue(state: GameState, playerId: PlayerId) {
  return state.players[playerId].lanes.reduce((total, lane) => {
    if (!lane.creature) return total;
    const level = lane.creature.card.definition.printedLevel;
    return total + 1 + level * 1.5 + (lane.attachment ? 1.5 : 0) + (lane.engulfed ? 1 : 0);
  }, 0);
}

/** How good `state` is for `me`. Uses only what both players can see, plus card counts. */
export function evaluate(state: GameState, me: PlayerId): number {
  const opponent = otherPlayer(me);
  if (state.phase === "game-over") {
    if (state.winner === me) return 1_000_000;
    if (state.winner === opponent) return -1_000_000;
    return 0;
  }
  const totals = victoryTotals(state);
  const mine = totals[me];
  const theirs = totals[opponent];
  // Once both decks are empty the Victory totals decide the game, so they matter even more.
  const victoryWeight = typeof state.finalTurn === "number" ? 14 : 7;
  const closeToWinning = (total: number) => Math.max(0, total - (VICTORY_THRESHOLD - 3)) * 4;
  // Cards in hand help up to a point; a full hand blocks every draw.
  const hand = (playerId: PlayerId) => {
    const size = state.players[playerId].hand.length;
    return Math.min(size, 8) * 1.2 - (size >= HAND_LIMIT ? 3 : 0);
  };
  const event = (playerId: PlayerId) => (state.players[playerId].event ? 2 : 0);
  return (
    victoryWeight * (mine - theirs) +
    closeToWinning(mine) -
    closeToWinning(theirs) +
    boardValue(state, me) -
    boardValue(state, opponent) +
    hand(me) -
    hand(opponent) * 0.5 +
    event(me) -
    event(opponent)
  );
}

// ---------------------------------------------------------------------------
// Determinization: hide what the AI couldn't know
// ---------------------------------------------------------------------------

function shuffleInPlace<T>(items: T[], random: () => number) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [items[index], items[swap]] = [items[swap]!, items[index]!];
  }
  return items;
}

const byUid = (a: CardInstance, b: CardInstance) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0);

/**
 * A copy of the game as `me` could imagine it. Hidden zones are sorted first,
 * so the result depends only on what `me` knows (and on `seed`), never on the
 * true hidden order. Cards a top-of-deck effect has revealed stay in place.
 */
export function determinize(state: GameState, me: PlayerId, seed: number): GameState {
  const copy = structuredClone(state);
  const random = aiRandom(seed);
  const opponent = copy.players[otherPlayer(me)];
  const pool = [...opponent.hand, ...opponent.deck].sort(byUid);
  shuffleInPlace(pool, random);
  opponent.hand = pool.slice(0, opponent.hand.length);
  opponent.deck = pool.slice(opponent.hand.length);

  const own = copy.players[me];
  const revealed = copy.pendingBiodiversity?.playerId === me || copy.pendingFilterFeeder?.playerId === me ? 2 : 0;
  own.deck = [...own.deck.slice(0, revealed), ...shuffleInPlace(own.deck.slice(revealed).sort(byUid), random)];
  copy.rng = Math.floor(random() * 0xffffffff) >>> 0;
  return copy;
}

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

/** Expected value of committing the previewed Hunt, averaged over every Battle Coin outcome. */
function expectedHuntValue(preview: GameState, me: PlayerId) {
  const battle = preview.pendingBattle;
  if (!battle) return evaluate(preview, me);
  const offensive = battle.coinPlan.offensiveCount;
  const defensive = battle.coinPlan.defensiveCount;
  const coins = offensive + defensive;
  let total = 0;
  for (let mask = 0; mask < 1 << coins; mask += 1) {
    const flips = Array.from({ length: coins }, (_, bit) => Boolean(mask & (1 << bit)));
    const result = commitBattle(preview, { offensive: flips.slice(0, offensive), defensive: flips.slice(offensive) });
    total += evaluate(result, me);
  }
  return total / (1 << coins);
}

const PASSING = new Set<GameAction["type"]>(["advanceToBattle", "endTurn", "cancelHunt"]);

/** True when `me` must answer a follow-up choice (a Concept option, a Herd pick, and so on) before play goes on. */
function owesChoice(state: GameState, me: PlayerId) {
  if (state.phase === "game-over" || state.handoff || state.pendingBattle || actingPlayer(state) !== me) return false;
  const legal = listLegalActions(state);
  return legal.length > 0 && legal.every((action) => !PASSING.has(action.type));
}

/**
 * The value of taking `action` in the imagined game. Hunts use their expected
 * value over coin flips; a move that asks a follow-up choice is judged by its
 * best answer, so a Concept is worth what it can do, not just the card it costs.
 */
function actionValue(
  world: GameState,
  action: GameAction,
  me: PlayerId,
  lookahead: number,
  plan: number,
  depth = 0,
): number {
  const next = applyAction(world, action);
  if (action.type === "previewHunt") return expectedHuntValue(next, me);
  if (depth < lookahead && owesChoice(next, me)) {
    const options = listLegalActions(next).filter((option) => option.type !== "concede");
    return Math.max(...options.map((option) => actionValue(next, option, me, lookahead, plan, depth + 1)));
  }
  const here = evaluate(next, me);
  // Planning ahead: a Development move is also worth the best Development move it opens up.
  if (plan > 0 && next.phase === "development" && !next.handoff && actingPlayer(next) === me) {
    const followUps = listLegalActions(next).filter((option) => option.type !== "concede" && !PASSING.has(option.type));
    return followUps.reduce(
      (value, option) => Math.max(value, actionValue(next, option, me, lookahead, plan - 1, depth)),
      here,
    );
  }
  return here;
}

/** Reroll one of my own Battle Coins that came up against me, if the Temperate Biome allows it. */
export function chooseReroll(state: GameState, me: PlayerId): GameAction | null {
  const battle = state.pendingBattle;
  if (!battle?.coins) return null;
  const mine: Array<"offensive" | "defensive"> = [];
  if (battle.attackerPlayer === me) mine.push("offensive");
  if (battle.defenderPlayer === me) mine.push("defensive");
  for (const group of mine) {
    const index = (battle.coins[group] ?? []).findIndex((success) => !success);
    if (index >= 0 && canRerollBattleCoin(state, me, group, index)) {
      return { type: "rerollBattleCoin", playerId: me, group, index };
    }
  }
  return null;
}

const PLAN_WIDTH = 6;

/**
 * The AI's next move for seat `me`, or null when it isn't the AI's move. Over
 * a turn, the AI keeps taking whichever action most improves its position and
 * moves on to Battle (or ends the turn) once nothing helps.
 */
export function chooseAction(state: GameState, me: PlayerId, options: AiOptions): GameAction | null {
  if (state.phase === "game-over") return null;
  if (state.handoff) return state.handoff.to === me ? { type: "acknowledgeHandoff" } : null;
  if (actingPlayer(state) !== me) return null;
  const legal = listLegalActions(state);
  if (!legal.length) return null;
  const { random, difficulty } = options;
  const easy = difficulty === "easy";

  // A Hunt the AI has committed to: flip, reroll a bad coin if it can, then resolve.
  const battle = state.pendingBattle;
  if (battle) {
    if (!battle.coins && legal.some((action) => action.type === "flipBattleCoins")) return { type: "flipBattleCoins" };
    return chooseReroll(state, me) ?? { type: "commitHunt" };
  }

  const world = determinize(state, me, Math.floor(random() * 0xffffffff));
  const noise = () => (easy ? (random() - 0.5) * 8 : (random() - 0.5) * 0.2);
  // Easy judges a card by its first step only; Normal follows its choices through.
  const lookahead = easy ? 0 : 3;
  // Sorted first, so ties never break on the hidden order of cards (Herd options follow deck order, for one).
  const scored = legal
    .filter((action) => action.type !== "concede")
    .map((action) => ({ action, key: JSON.stringify(action) }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map(({ action }) => ({ action, value: actionValue(world, action, me, lookahead, 0) + noise() }));
  // Normal then plans a second Development move, from its most promising first moves only (to stay quick).
  if (!easy && state.phase === "development" && scored.some((entry) => PASSING.has(entry.action.type))) {
    const promising = scored
      .filter((entry) => !PASSING.has(entry.action.type))
      .sort((a, b) => b.value - a.value)
      .slice(0, PLAN_WIDTH);
    for (const entry of promising) {
      entry.value = Math.max(entry.value, actionValue(world, entry.action, me, lookahead, 1));
    }
  }

  // A forced choice (a Concept option, Herd, Engulf, and so on): take the best one.
  const voluntary = state.phase === "development" || state.phase === "battle";
  const isChoice = !voluntary || scored.every((entry) => !PASSING.has(entry.action.type));
  if (isChoice) return best(scored).action;

  const baseline = evaluate(world, me);
  const moves = scored.filter((entry) => !PASSING.has(entry.action.type));
  // Passing with a full hand would freeze the game (no draws, so the decks never run out): play something.
  const handFull = state.players[me].hand.length >= HAND_LIMIT;
  if (handFull && state.phase === "development" && moves.length) return best(moves).action;
  // Easy players sometimes miss a good move, or settle for a merely acceptable one.
  if (easy && random() < 0.35) {
    const acceptable = moves.filter((entry) => entry.value >= baseline - 1);
    if (acceptable.length && random() < 0.5) return acceptable[Math.floor(random() * acceptable.length)]!.action;
    return pass(legal);
  }
  const top = moves.length ? best(moves) : null;
  const margin = top?.action.type === "previewHunt" ? 0.5 : 0.25;
  return top && top.value > baseline + margin ? top.action : pass(legal);
}

function best<T extends { value: number }>(entries: T[]): T {
  return entries.reduce((a, b) => (b.value > a.value ? b : a));
}

/** Move on: to Battle from Development, or end the turn. */
function pass(legal: GameAction[]): GameAction {
  return (
    legal.find((action) => action.type === "advanceToBattle") ??
    legal.find((action) => action.type === "endTurn") ??
    legal[0]!
  );
}
