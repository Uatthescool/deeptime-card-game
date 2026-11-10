/**
 * Deck balance report: plays many games between two Normal computer players
 * and summarizes how decks, Biomes, and turn order fare.
 *
 *   npm run balance                     # 1080 games, split across CPU cores (about an hour)
 *   npm run balance -- --games 180      # a quicker, rougher pass
 *   npm run balance -- --random-biomes  # random Biomes and mirror matches, instead of each deck in its own Biome
 *
 * Writes every game to reports/balance-games.jsonl and the summary to
 * reports/balance-summary.json (the reports folder is not committed). The same
 * game count always plays the same games, so results are reproducible.
 */
import { spawn } from "node:child_process";
import { availableParallelism } from "node:os";
import { appendFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

import { aiRandom, chooseAction, chooseReroll } from "../src/ai/ai.ts";
import { biomeByKey, BIOMES, type BiomeKey } from "../src/data/biomes.ts";
import { CARD_LIBRARY, DECK_INFO, DECK_KEYS, DECK_LABELS, type DeckKey, DECKS } from "../src/data/cards.ts";
import {
  actingPlayer,
  applyAction,
  createGame,
  otherPlayer,
  type PlayerId,
  victoryTotals,
} from "../src/engine/index.ts";
import {
  type CardBoardStats,
  createTracker,
  emptyBoardStats,
  type Ending,
  ending,
  finishTracking,
  type GameTracker,
  trackAction,
} from "./game-stats.ts";

const REPORTS = "reports";
const GAMES_FILE = `${REPORTS}/balance-games.jsonl`;
const SUMMARY_FILE = `${REPORTS}/balance-summary.json`;
const GAMES_CSV = `${REPORTS}/balance-games.csv`;
const CARDS_CSV = `${REPORTS}/balance-cards.csv`;
const CURVE_CSV = `${REPORTS}/balance-victory-curve.csv`;
const BASE_SEED = 50_000;
const MAX_STEPS = 6000;

/** Each deck plays in its own Biome, as in the game, unless `--random-biomes` asks for the old mixed runs. */
const lockedBiomes = !process.argv.includes("--random-biomes");
/** `--niche-unlock` plays the Niche-unlock trial rule (see GameRules). */
const nicheUnlock = process.argv.includes("--niche-unlock");
/** Ordered deck pairings to cycle through; a locked run skips mirrors, which always split evenly. */
const PAIRINGS = DECK_KEYS.flatMap((north) =>
  DECK_KEYS.filter((south) => !lockedBiomes || south !== north).map((south): [DeckKey, DeckKey] => [north, south]),
);

export type GameRecord = {
  game: number;
  seed: number;
  decks: [DeckKey, DeckKey];
  biomes: [BiomeKey, BiomeKey];
  first: PlayerId;
  winner: PlayerId | null;
  ending: Ending;
  turns: number;
  totals: [number, number];
  /** Keys of the cards each player played from hand. */
  played: [string[], string[]];
  board?: GameTracker["board"];
  timeline?: GameTracker["timeline"];
  ms: number;
};

/** Game `index` of the run: every ordered deck pairing equally often, Biomes at random unless locked. */
function configure(index: number) {
  const decks = PAIRINGS[index % PAIRINGS.length]!;
  if (lockedBiomes) {
    return {
      seed: BASE_SEED + index,
      decks,
      biomes: [DECK_INFO[decks[0]].biome, DECK_INFO[decks[1]].biome] as [BiomeKey, BiomeKey],
    };
  }
  // Neighbouring seeds start this generator in similar places, so scramble the index and discard a few draws.
  const random = aiRandom(Math.imul(BASE_SEED + index + 1, 0x9e3779b1) ^ 0x85ebca6b);
  for (let warm = 0; warm < 8; warm += 1) random();
  const pick = () => BIOMES[Math.floor(random() * BIOMES.length)]!.key;
  return { seed: BASE_SEED + index, decks, biomes: [pick(), pick()] as [BiomeKey, BiomeKey] };
}

export function playOne(index: number): GameRecord {
  const started = performance.now();
  const { seed, decks, biomes } = configure(index);
  let state = createGame("North", "South", biomes, decks, { seed, ...(nicheUnlock ? { rules: { nicheUnlock } } : {}) });
  const first = state.activePlayer;
  const randoms = [aiRandom(seed * 31 + 1), aiRandom(seed * 31 + 2)] as const;
  const tracker = createTracker();
  for (let step = 0; step < MAX_STEPS && state.phase !== "game-over"; step += 1) {
    // A defender may reroll its own coin before the attacker resolves the Hunt.
    const defender = state.pendingBattle?.coins ? otherPlayer(actingPlayer(state)) : null;
    const reroll = defender === null ? null : chooseReroll(state, defender);
    const seat = reroll ? defender! : actingPlayer(state);
    const action = reroll ?? chooseAction(state, seat, { difficulty: "normal", random: randoms[seat] });
    if (!action) break;
    const next = applyAction(state, action);
    trackAction(tracker, state, seat, action, next);
    state = next;
  }
  finishTracking(tracker, state);
  const finished = state.phase === "game-over";
  return {
    game: index,
    seed,
    decks,
    biomes,
    first,
    winner: state.winner,
    ending: ending(state.winReason, finished, state.winner),
    turns: state.turnNumber,
    totals: victoryTotals(state),
    ...tracker,
    ms: Math.round(performance.now() - started),
  };
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

type Tally = { games: number; wins: number; draws: number };
const tally = (): Tally => ({ games: 0, wins: 0, draws: 0 });
/** Win rate counting a draw as half a win. */
const rate = (t: Tally) => (t.games ? (t.wins + t.draws / 2) / t.games : null);
/** 95% margin of error for a win rate over `games` games. */
const margin = (games: number) => (games ? 1.96 * Math.sqrt(0.25 / games) : null);

function record(t: Tally, result: "win" | "loss" | "draw") {
  t.games += 1;
  if (result === "win") t.wins += 1;
  if (result === "draw") t.draws += 1;
}

const resultFor = (game: GameRecord, seat: PlayerId) =>
  game.winner === null ? "draw" : game.winner === seat ? "win" : "loss";

const quantile = (sorted: number[], q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;

export function summarize(games: GameRecord[]) {
  const finished = games.filter((game) => game.ending !== "unfinished");
  const firstPlayer = tally();
  const decks = Object.fromEntries(DECK_KEYS.map((key) => [key, tally()])) as Record<DeckKey, Tally>;
  const matchups: Record<string, Tally> = {};
  const biomes: Record<string, Tally> = {};
  const deckBiomes: Record<string, Tally> = {};
  const endings: Record<string, number> = {};
  const endingsByDeckPair: Record<string, Record<string, number>> = {};
  const cards: Record<string, { deck: DeckKey; inDeck: Tally; played: Tally; notPlayed: Tally }> = {};

  for (const game of finished) {
    endings[game.ending] = (endings[game.ending] ?? 0) + 1;
    const pairKey = [...game.decks].sort().join(" v ");
    (endingsByDeckPair[pairKey] ??= {})[game.ending] = (endingsByDeckPair[pairKey]![game.ending] ?? 0) + 1;
    record(firstPlayer, resultFor(game, game.first));
    for (const seat of [0, 1] as const) {
      const other = otherPlayer(seat);
      const result = resultFor(game, seat);
      const deck = game.decks[seat];
      const biome = game.biomes[seat];
      // Mirror matches always split evenly, so they say nothing about relative strength.
      if (deck !== game.decks[other]) {
        record(decks[deck], result);
        record((matchups[`${deck}|${game.decks[other]}`] ??= tally()), result);
      }
      if (biome !== game.biomes[other]) record((biomes[biome] ??= tally()), result);
      record((deckBiomes[`${deck}|${biome}`] ??= tally()), result);
      const playedHere = new Set(game.played[seat]);
      for (const key of new Set(DECKS[deck].map((card) => card.key))) {
        const card = (cards[`${deck}|${key}`] ??= { deck, inDeck: tally(), played: tally(), notPlayed: tally() });
        record(card.inDeck, result);
        record(playedHere.has(key) ? card.played : card.notPlayed, result);
      }
    }
  }

  const turns = finished.map((game) => game.turns).sort((a, b) => a - b);
  const view = (t: Tally) => ({ ...t, winRate: rate(t), margin: margin(t.games) });
  return {
    generated: new Date().toISOString(),
    games: games.length,
    unfinished: games.length - finished.length,
    averageMs: Math.round(games.reduce((sum, game) => sum + game.ms, 0) / Math.max(1, games.length)),
    firstPlayer: view(firstPlayer),
    decks: Object.fromEntries(Object.entries(decks).map(([key, t]) => [key, view(t)])),
    matchups: Object.fromEntries(Object.entries(matchups).map(([key, t]) => [key, view(t)])),
    biomes: Object.fromEntries(Object.entries(biomes).map(([key, t]) => [key, view(t)])),
    deckBiomes: Object.fromEntries(Object.entries(deckBiomes).map(([key, t]) => [key, view(t)])),
    endings,
    endingsByDeckPair,
    turns: { median: quantile(turns, 0.5), p10: quantile(turns, 0.1), p90: quantile(turns, 0.9) },
    cards: Object.entries(cards).map(([key, card]) => ({
      deck: card.deck,
      key: key.split("|")[1]!,
      playRate: card.played.games / Math.max(1, card.inDeck.games),
      winRateWhenPlayed: rate(card.played),
      winRateWhenNotPlayed: rate(card.notPlayed),
      deckWinRate: rate(card.inDeck),
      playedGames: card.played.games,
      notPlayedGames: card.notPlayed.games,
    })),
  };
}

// ---------------------------------------------------------------------------
// CSV exports, for spreadsheets and the published report
// ---------------------------------------------------------------------------

const csvCell = (value: string | number) =>
  /[",\n]/.test(`${value}`) ? `"${`${value}`.replace(/"/g, '""')}"` : `${value}`;
const csv = (rows: Array<Record<string, string | number>>) => {
  const lines = [Object.keys(rows[0] ?? {}), ...rows.map((row) => Object.values(row))];
  return `${lines.map((cells) => cells.map(csvCell).join(",")).join("\n")}\n`;
};

const SEATS = ["North", "South"] as const;

/** One row per game, in readable names. */
function gamesCsv(records: GameRecord[]) {
  return csv(
    records.map((game) => ({
      game: game.game,
      seed: game.seed,
      north_deck: DECK_LABELS[game.decks[0]],
      south_deck: DECK_LABELS[game.decks[1]],
      north_biome: biomeByKey(game.biomes[0]).name,
      south_biome: biomeByKey(game.biomes[1]).name,
      first: SEATS[game.first],
      winner: game.winner === null ? "Draw" : SEATS[game.winner],
      ending: game.ending,
      turns: game.turns,
      north_victory: game.totals[0],
      south_victory: game.totals[1],
    })),
  );
}

/** One row per card in each deck: how often it was played, and how its player fared with and without it. */
function cardsCsv(records: GameRecord[]) {
  const stats = new Map<
    string,
    { deck: DeckKey; key: string; inDeck: Tally; played: Tally; notPlayed: Tally; board: CardBoardStats }
  >();
  for (const game of records) {
    if (game.ending === "unfinished") continue;
    for (const seat of [0, 1] as const) {
      const deck = game.decks[seat];
      const result = resultFor(game, seat);
      const playedHere = new Set(game.played[seat]);
      for (const key of new Set(DECKS[deck].map((card) => card.key))) {
        const id = `${deck}|${key}`;
        if (!stats.has(id)) {
          stats.set(id, { deck, key, inDeck: tally(), played: tally(), notPlayed: tally(), board: emptyBoardStats() });
        }
        const entry = stats.get(id)!;
        record(entry.inDeck, result);
        record(playedHere.has(key) ? entry.played : entry.notPlayed, result);
        const line = game.board?.[seat][key];
        if (line)
          for (const field of Object.keys(line) as Array<keyof CardBoardStats>) entry.board[field] += line[field];
      }
    }
  }
  const round = (value: number | null) => (value === null ? "" : Math.round(value * 1000) / 1000);
  const per = (count: number, of: number) => (of ? round(count / of) : "");
  return csv(
    [...stats.values()].map(({ board, ...entry }) => ({
      deck: DECK_LABELS[entry.deck],
      card: CARD_LIBRARY.get(entry.key)?.name ?? entry.key,
      kind: CARD_LIBRARY.get(entry.key)?.kind ?? "",
      games: entry.inDeck.games,
      played_games: entry.played.games,
      play_rate: round(entry.played.games / Math.max(1, entry.inDeck.games)),
      win_rate_played: round(rate(entry.played)),
      win_rate_not_played: round(rate(entry.notPlayed)),
      entered_per_game: per(board.entered, entry.inDeck.games),
      hunts_per_entry: per(board.hunts, board.entered),
      hunt_win_rate: per(board.huntWins, board.hunts),
      hunted_per_entry: per(board.hunted, board.entered),
      survived_hunt_rate: per(board.survivedHunts, board.hunted),
      lost_to_hunt: per(board.lostToHunt, board.entered),
      lost_hunting: per(board.lostHunting, board.entered),
      lost_to_override: per(board.lostToOverride, board.entered),
      lost_to_effect: per(board.lostToEffect, board.entered),
      turns_in_play_per_entry: per(board.turnsInPlay, board.entered),
      ended_in_play_per_entry: per(board.endedInPlay, board.entered),
      final_victory_when_ended_in_play: per(board.finalVictory, board.endedInPlay),
    })),
  );
}

/** Each deck's average Victory total and Creature count at the end of each turn, for games still going. */
function curveCsv(records: GameRecord[]) {
  const sums = new Map<
    string,
    { deck: DeckKey; turn: number; games: number; victory: number; creatures: number; wins: number }
  >();
  for (const game of records) {
    if (game.ending === "unfinished") continue;
    for (const point of game.timeline ?? []) {
      for (const seat of [0, 1] as const) {
        const deck = game.decks[seat];
        if (deck === game.decks[otherPlayer(seat)]) continue;
        const id = `${deck}|${point.turn}`;
        if (!sums.has(id)) sums.set(id, { deck, turn: point.turn, games: 0, victory: 0, creatures: 0, wins: 0 });
        const entry = sums.get(id)!;
        entry.games += 1;
        entry.victory += point.victory[seat];
        entry.creatures += point.creatures[seat];
        if (game.winner === seat) entry.wins += 1;
      }
    }
  }
  const round = (value: number) => Math.round(value * 100) / 100;
  return csv(
    [...sums.values()]
      .sort((a, b) => a.deck.localeCompare(b.deck) || a.turn - b.turn)
      .map((entry) => ({
        deck: DECK_LABELS[entry.deck],
        turn: entry.turn,
        games_still_going: entry.games,
        average_victory: round(entry.victory / entry.games),
        average_creatures: round(entry.creatures / entry.games),
        eventual_win_rate: round(entry.wins / entry.games),
      })),
  );
}

function writeReports(records: GameRecord[]) {
  const summary = summarize(records);
  writeFileSync(SUMMARY_FILE, JSON.stringify(summary, null, 2));
  writeFileSync(GAMES_CSV, gamesCsv(records));
  writeFileSync(CARDS_CSV, cardsCsv(records));
  writeFileSync(CURVE_CSV, curveCsv(records));
  return summary;
}

// ---------------------------------------------------------------------------
// Command line: a coordinator that splits the games across worker processes
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const option = (name: string, fallback: number) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? Number(args[index + 1]) : fallback;
};
const games = option("games", 1080);

if (args.includes("--summarize")) {
  // Re-summarize the last run without playing it again.
  const records = readFileSync(GAMES_FILE, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as GameRecord);
  writeReports(records);
  console.log(`Summarized ${records.length} games into ${SUMMARY_FILE}, ${GAMES_CSV} and ${CARDS_CSV}.`);
} else if (args.includes("--shard")) {
  const shard = option("shard", 0);
  const of = option("of", 1);
  const file = `${REPORTS}/balance-shard-${shard}.jsonl`;
  rmSync(file, { force: true });
  for (let index = shard; index < games; index += of) appendFileSync(file, `${JSON.stringify(playOne(index))}\n`);
} else {
  const workers = option("workers", Math.max(1, availableParallelism() - 1));
  mkdirSync(REPORTS, { recursive: true });
  console.log(
    `Playing ${games} Normal-vs-Normal games${lockedBiomes ? " with each deck in its own Biome" : " with random Biomes"} across ${workers} processes…`,
  );
  const started = Date.now();
  await Promise.all(
    Array.from(
      { length: workers },
      (_, shard) =>
        new Promise<void>((resolve, reject) => {
          const child = spawn(
            `npx vite-node tools/balance.ts -- --shard ${shard} --of ${workers} --games ${games}${lockedBiomes ? "" : " --random-biomes"}${nicheUnlock ? " --niche-unlock" : ""}`,
            {
              shell: true,
              stdio: "inherit",
            },
          );
          child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`shard ${shard} exited ${code}`))));
        }),
    ),
  );
  const records = Array.from({ length: workers }, (_, shard) =>
    readFileSync(`${REPORTS}/balance-shard-${shard}.jsonl`, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as GameRecord),
  )
    .flat()
    .sort((a, b) => a.game - b.game);
  writeFileSync(GAMES_FILE, `${records.map((game) => JSON.stringify(game)).join("\n")}\n`);
  for (let shard = 0; shard < workers; shard += 1) rmSync(`${REPORTS}/balance-shard-${shard}.jsonl`, { force: true });
  const summary = writeReports(records);
  console.log(`Done in ${Math.round((Date.now() - started) / 60000)} min. Summary in ${SUMMARY_FILE}.`);
  console.table(summary.decks);
  console.log("First player:", summary.firstPlayer);
  console.log("Endings:", summary.endings);
}
