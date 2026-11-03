/**
 * The play-data watcher: records games against the computer so they can be
 * replayed and analyzed later with `npm run playlog`.
 *
 * It is hidden. Nothing is recorded, and no controls appear, unless this browser
 * was switched on by opening the site with `?watcher=on` (`?watcher=off` switches
 * it off again). Recorded games stay in this browser until they are downloaded.
 *
 * A game is recorded as the arguments it was created with plus every action in
 * order. The engine is deterministic, so replaying those actions rebuilds the
 * whole game; the result is stored too, so a replay can tell if it went astray.
 */
import type { BiomeKey } from "../data/biomes.ts";
import { IMPLEMENTATION_REGISTER } from "../data/cards.ts";
import type { DeckKey } from "../data/types.ts";
import {
  actingPlayer,
  type ComputerSeat,
  GAME_STATE_VERSION,
  type GameAction,
  type GameState,
  type PlayerId,
  victoryTotals,
} from "../engine/index.ts";
import { readJson, removeKey, writeJson } from "./storage.ts";

const ENABLED_KEY = "pcg.watcher.enabled";
const CURRENT_KEY = "pcg.watcher.current";
const GAMES_KEY = "pcg.watcher.games";
const SWITCH_PARAM = "watcher";

export type RecordedSetup = {
  players: [string, string];
  biomes: [BiomeKey | null, BiomeKey | null];
  decks: [DeckKey, DeckKey];
  seed: number;
  computer: ComputerSeat;
};

export type RecordedAction = { seat: PlayerId; by: "person" | "computer"; action: GameAction };

export type RecordedResult = {
  turnNumber: number;
  winner: PlayerId | null;
  winReason: string | null;
  totals: [number, number];
  rng: number;
};

export type RecordedGame = {
  format: 1;
  rulesVersion: string;
  stateVersion: number;
  startedAt: string;
  finishedAt: string | null;
  setup: RecordedSetup;
  actions: RecordedAction[];
  /** Null while the game is unfinished. */
  result: RecordedResult | null;
};

export function watcherEnabled() {
  return readJson<unknown>("local", ENABLED_KEY, false) === true;
}

/**
 * Applies `?watcher=on` or `?watcher=off` from the page address, then removes it
 * from the address bar so it isn't bookmarked or shared by accident.
 */
export function applyWatcherSwitch() {
  try {
    const url = new URL(window.location.href);
    const value = url.searchParams.get(SWITCH_PARAM);
    if (value === null) return;
    if (value === "on") writeJson("local", ENABLED_KEY, true);
    if (value === "off") removeKey("local", ENABLED_KEY);
    url.searchParams.delete(SWITCH_PARAM);
    window.history.replaceState(window.history.state, "", url);
  } catch {
    // No address to read: leave the watcher as it was.
  }
}

export function setWatcherEnabled(enabled: boolean) {
  if (enabled) writeJson("local", ENABLED_KEY, true);
  else removeKey("local", ENABLED_KEY);
}

const currentRecording = () => readJson<RecordedGame | null>("local", CURRENT_KEY, null);

/** Finished and abandoned games, oldest first. */
export function storedGames() {
  return readJson<RecordedGame[]>("local", GAMES_KEY, []);
}

/** Moves a recording into the stored games; false if storage is full. */
function store(game: RecordedGame) {
  const saved = writeJson("local", GAMES_KEY, [...storedGames(), game]);
  if (saved) removeKey("local", CURRENT_KEY);
  return saved;
}

/** Starts recording a new game against the computer. An unfinished recording is kept as abandoned. */
export function startRecording(game: GameState, setup: Omit<RecordedSetup, "seed" | "computer">) {
  if (!watcherEnabled() || !game.computer) return;
  const previous = currentRecording();
  if (previous) store(previous);
  writeJson("local", CURRENT_KEY, {
    format: 1,
    rulesVersion: IMPLEMENTATION_REGISTER.version,
    stateVersion: GAME_STATE_VERSION,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    setup: { ...setup, seed: game.seed, computer: game.computer },
    actions: [],
    result: null,
  } satisfies RecordedGame);
}

/** Records one action of the game being recorded, and stores the game once it is over. */
export function recordAction(before: GameState, action: GameAction, after: GameState) {
  if (!before.computer || !watcherEnabled()) return;
  const recording = currentRecording();
  // A resumed game continues its recording; any other game isn't being recorded.
  if (!recording || recording.setup.seed !== before.seed || recording.result) return;
  if (after === before) return;
  const seat = action.type === "rerollBattleCoin" ? action.playerId : actingPlayer(before);
  recording.actions.push({ seat, by: seat === before.computer.seat ? "computer" : "person", action });
  if (after.phase === "game-over") {
    recording.finishedAt = new Date().toISOString();
    recording.result = {
      turnNumber: after.turnNumber,
      winner: after.winner,
      winReason: after.winReason,
      totals: victoryTotals(after),
      rng: after.rng,
    };
    if (store(recording)) return;
  }
  writeJson("local", CURRENT_KEY, recording);
}

/** Every recorded game, including the one in progress. */
export function recordedGames() {
  const current = currentRecording();
  return current ? [...storedGames(), current] : storedGames();
}

export function clearRecordedGames() {
  removeKey("local", GAMES_KEY);
  removeKey("local", CURRENT_KEY);
}

/** Saves every recorded game to one JSON file. */
export function downloadPlayData() {
  const games = recordedGames();
  const blob = new Blob([JSON.stringify({ format: 1, exportedAt: new Date().toISOString(), games })], {
    type: "application/json",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `deep-time-play-data-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
