/**
 * Play-data report: replays games recorded by the in-game watcher (src/ui/watcher.ts)
 * and measures them the same way the balance simulator measures its games.
 *
 *   npm run playlog                          # every .json file in reports/play-data/
 *   npm run playlog -- path/to/export.json   # specific exported files
 *
 * At each of the person's moves it also asks the Normal computer player what it
 * would have done, so places where people and the simulator play differently show up.
 * Writes CSVs to reports/playlog/ (the reports folder is not committed).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { aiRandom, chooseAction } from "../src/ai/ai.ts";
import { biomeByKey } from "../src/data/biomes.ts";
import { CARD_LIBRARY, DECK_LABELS } from "../src/data/cards.ts";
import {
  applyAction,
  createGame,
  type GameAction,
  type GameState,
  type PlayerId,
  victoryTotals,
} from "../src/engine/index.ts";
import type { RecordedGame } from "../src/ui/watcher.ts";
import {
  type CardBoardStats,
  createTracker,
  emptyBoardStats,
  ending,
  finishTracking,
  trackAction,
} from "./game-stats.ts";

const INPUT_DIR = "reports/play-data";
const OUTPUT_DIR = "reports/playlog";
/** Moves that aren't real decisions, or that the computer makes separately (rerolls). */
const UNCOMPARED = new Set<GameAction["type"]>(["acknowledgeHandoff", "rerollBattleCoin", "concede"]);

type Replay = {
  recording: RecordedGame;
  state: GameState;
  tracker: ReturnType<typeof createTracker>;
  /** "verified" when the replay ends exactly as the recorded game did. */
  status: "verified" | "diverged" | "unfinished";
  decisions: Decision[];
};

type Decision = { turn: number; phase: string; person: string; computer: string; same: boolean; type: string };

/** Every card instance in the game by uid, for naming the cards an action refers to. */
function cardNames(state: GameState) {
  const names = new Map<string, string>();
  for (const player of state.players) {
    for (const card of [...player.deck, ...player.hand, ...player.history]) names.set(card.uid, card.definition.name);
    for (const lane of player.lanes) {
      if (lane.creature) names.set(lane.creature.card.uid, lane.creature.card.definition.name);
      if (lane.attachment) names.set(lane.attachment.uid, lane.attachment.definition.name);
    }
    if (player.event) names.set(player.event.uid, player.event.definition.name);
  }
  return names;
}

/** An action in readable words, e.g. "playCreature Velociraptor, Niche 3". */
function describe(state: GameState, action: GameAction | null) {
  if (!action) return "nothing";
  const names = cardNames(state);
  const parts = Object.entries(action)
    .filter(([key]) => key !== "type")
    .map(([key, value]) => {
      if (typeof value === "string" && names.has(value)) return names.get(value)!;
      if (key === "laneIndex" || key === "sourceLane" || key === "destinationLane") return `Niche ${Number(value) + 1}`;
      if (key === "targetPlayer" || key === "playerId")
        return Number(value) === state.activePlayer ? "own" : "opponent's";
      return `${key} ${String(value)}`;
    });
  return [action.type, parts.join(", ")].filter(Boolean).join(" ");
}

function replay(recording: RecordedGame, { compare = true } = {}): Replay {
  const { setup } = recording;
  let state = createGame(setup.players[0], setup.players[1], setup.biomes, setup.decks, {
    seed: setup.seed,
    computer: setup.computer,
  });
  const tracker = createTracker();
  const decisions: Decision[] = [];
  recording.actions.forEach(({ seat, by, action }, index) => {
    if (compare && by === "person" && !UNCOMPARED.has(action.type)) {
      const suggestion = chooseAction(state, seat, { difficulty: "normal", random: aiRandom(setup.seed + index) });
      decisions.push({
        turn: state.turnNumber,
        phase: state.phase,
        person: describe(state, action),
        computer: describe(state, suggestion),
        same: JSON.stringify(suggestion) === JSON.stringify(action),
        type: action.type,
      });
    }
    const next = applyAction(state, action);
    trackAction(tracker, state, seat, action, next);
    state = next;
  });
  finishTracking(tracker, state);
  const result = recording.result;
  const status = !result
    ? "unfinished"
    : result.turnNumber === state.turnNumber && result.winner === state.winner && result.rng === state.rng
      ? "verified"
      : "diverged";
  return { recording, state, tracker, status, decisions };
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

const csvCell = (value: string | number) =>
  /[",\n]/.test(`${value}`) ? `"${`${value}`.replace(/"/g, '""')}"` : `${value}`;
const csv = (rows: Array<Record<string, string | number>>) => {
  const lines = [Object.keys(rows[0] ?? {}), ...rows.map((row) => Object.values(row))];
  return `${lines.map((cells) => cells.map(csvCell).join(",")).join("\n")}\n`;
};
const round = (value: number) => Math.round(value * 1000) / 1000;
const per = (count: number, of: number) => (of ? round(count / of) : "");

const personSeat = (recording: RecordedGame): PlayerId => (recording.setup.computer.seat === 0 ? 1 : 0);
const sideName = (recording: RecordedGame, seat: PlayerId) => (seat === personSeat(recording) ? "You" : "Computer");

function gamesCsv(replays: Replay[]) {
  return csv(
    replays.map(({ recording, state, status }) => {
      const you = personSeat(recording);
      const them = recording.setup.computer.seat;
      const finished = state.phase === "game-over";
      return {
        started: recording.startedAt,
        status,
        difficulty: recording.setup.computer.difficulty,
        your_deck: DECK_LABELS[recording.setup.decks[you]],
        computer_deck: DECK_LABELS[recording.setup.decks[them]],
        your_biome: recording.setup.biomes[you] ? biomeByKey(recording.setup.biomes[you]!).name : "",
        computer_biome: recording.setup.biomes[them] ? biomeByKey(recording.setup.biomes[them]!).name : "",
        you_went_first: recording.actions[0]?.seat === you ? "yes" : "no",
        result: !finished ? "unfinished" : state.winner === null ? "draw" : state.winner === you ? "win" : "loss",
        ending: ending(state.winReason, finished, state.winner),
        turns: state.turnNumber,
        your_victory: victoryTotals(state)[you],
        computer_victory: victoryTotals(state)[them],
        rules_version: recording.rulesVersion,
      };
    }),
  );
}

function cardsCsv(replays: Replay[]) {
  const stats = new Map<
    string,
    { side: string; deck: string; key: string; games: number; played: number; board: CardBoardStats }
  >();
  for (const { recording, tracker } of replays) {
    for (const seat of [0, 1] as const) {
      const side = sideName(recording, seat);
      const deck = recording.setup.decks[seat];
      const keys = new Set([...tracker.played[seat], ...Object.keys(tracker.board[seat])]);
      for (const key of keys) {
        const id = `${side}|${deck}|${key}`;
        if (!stats.has(id)) stats.set(id, { side, deck, key, games: 0, played: 0, board: emptyBoardStats() });
        const entry = stats.get(id)!;
        entry.games += 1;
        entry.played += tracker.played[seat].filter((played) => played === key).length;
        const line = tracker.board[seat][key];
        if (line)
          for (const field of Object.keys(line) as Array<keyof CardBoardStats>) entry.board[field] += line[field];
      }
    }
  }
  return csv(
    [...stats.values()]
      .sort((a, b) => a.side.localeCompare(b.side) || a.deck.localeCompare(b.deck) || b.played - a.played)
      .map(({ side, deck, key, games, played, board }) => ({
        side,
        deck: DECK_LABELS[deck as keyof typeof DECK_LABELS],
        card: CARD_LIBRARY.get(key)?.name ?? key,
        kind: CARD_LIBRARY.get(key)?.kind ?? "",
        games_seen: games,
        times_played: played,
        entered: board.entered,
        hunts: board.hunts,
        hunt_win_rate: per(board.huntWins, board.hunts),
        hunted: board.hunted,
        survived_hunt_rate: per(board.survivedHunts, board.hunted),
        lost_to_hunt: board.lostToHunt,
        lost_hunting: board.lostHunting,
        lost_to_override: board.lostToOverride,
        lost_to_effect: board.lostToEffect,
        turns_in_play_per_entry: per(board.turnsInPlay, board.entered),
        ended_in_play: board.endedInPlay,
        final_victory_when_ended_in_play: per(board.finalVictory, board.endedInPlay),
      })),
  );
}

function curveCsv(replays: Replay[]) {
  return csv(
    replays.flatMap(({ recording, tracker }) =>
      tracker.timeline.map((point) => ({
        started: recording.startedAt,
        turn: point.turn,
        whose_turn: sideName(recording, point.active),
        your_victory: point.victory[personSeat(recording)],
        computer_victory: point.victory[recording.setup.computer.seat],
        your_creatures: point.creatures[personSeat(recording)],
        computer_creatures: point.creatures[recording.setup.computer.seat],
      })),
    ),
  );
}

function decisionsCsv(replays: Replay[]) {
  return csv(
    replays.flatMap(({ recording, decisions }) =>
      decisions
        .filter((decision) => !decision.same)
        .map((decision) => ({
          started: recording.startedAt,
          turn: decision.turn,
          phase: decision.phase,
          you_did: decision.person,
          normal_computer_would: decision.computer,
        })),
    ),
  );
}

/** Recorded games from exported files, each game once even if it appears in several exports. */
function loadRecordings(paths: string[]) {
  const seen = new Map<string, RecordedGame>();
  for (const path of paths) {
    const file = JSON.parse(readFileSync(path, "utf8")) as { games?: RecordedGame[] };
    for (const game of file.games ?? []) {
      const id = `${game.setup.seed}|${game.startedAt}`;
      // A later export of the same game may have more of it recorded.
      if ((seen.get(id)?.actions.length ?? -1) < game.actions.length) seen.set(id, game);
    }
  }
  return [...seen.values()].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const paths = args.length
  ? args
  : existsSync(INPUT_DIR)
    ? readdirSync(INPUT_DIR)
        .filter((name) => name.endsWith(".json"))
        .map((name) => join(INPUT_DIR, name))
    : [];

if (!paths.length) {
  console.log(`No play data found. Download it from the game's menu and put the file in ${INPUT_DIR}/.`);
} else {
  const replays = loadRecordings(paths).map((recording) => replay(recording));
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(`${OUTPUT_DIR}/games.csv`, gamesCsv(replays));
  writeFileSync(`${OUTPUT_DIR}/cards.csv`, cardsCsv(replays));
  writeFileSync(`${OUTPUT_DIR}/victory-curve.csv`, curveCsv(replays));
  writeFileSync(`${OUTPUT_DIR}/decisions.csv`, decisionsCsv(replays));

  const finished = replays.filter(({ state }) => state.phase === "game-over");
  const wins = finished.filter(({ recording, state }) => state.winner === personSeat(recording)).length;
  const diverged = replays.filter(({ status }) => status === "diverged").length;
  console.log(`${replays.length} recorded games: ${finished.length} finished, ${wins} won by you.`);
  if (diverged) {
    console.log(`${diverged} replayed differently from how they were played, likely because the rules changed since.`);
  }
  const byType = new Map<string, { same: number; total: number }>();
  for (const decision of replays.flatMap(({ decisions }) => decisions)) {
    const entry = byType.get(decision.type) ?? { same: 0, total: 0 };
    entry.total += 1;
    if (decision.same) entry.same += 1;
    byType.set(decision.type, entry);
  }
  console.log("How often the Normal computer would have made your move:");
  console.table(
    Object.fromEntries(
      [...byType].map(([type, { same, total }]) => [
        type,
        { moves: total, same: `${Math.round((100 * same) / total)}%` },
      ]),
    ),
  );
  console.log(`Reports in ${OUTPUT_DIR}/.`);
}
