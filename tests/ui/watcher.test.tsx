// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vitest";

import { aiRandom, chooseAction, chooseReroll } from "../../src/ai/ai.ts";
import { actingPlayer, applyAction, createGame, type GameState, otherPlayer } from "../../src/engine/index.ts";
import { WatcherPanel } from "../../src/ui/components/WatcherPanel.tsx";
import {
  applyWatcherSwitch,
  recordAction,
  recordedGames,
  startRecording,
  watcherEnabled,
} from "../../src/ui/watcher.ts";

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
});
afterEach(cleanup);

const SETUP = { players: ["You", "Computer"] as [string, string], biomes: ["arid", "aquatic"] as const };

function newGame(computer = true) {
  return createGame(SETUP.players[0], SETUP.players[1], [...SETUP.biomes], ["deck-1", "deck-3"], {
    seed: 4242,
    computer: computer ? { seat: 1, difficulty: "easy" } : null,
  });
}

/** Plays a whole game with the Easy computer in both seats, recording every action. */
function playRecorded(start: GameState) {
  let state = start;
  const randoms = [aiRandom(1), aiRandom(2)] as const;
  for (let step = 0; step < 6000 && state.phase !== "game-over"; step += 1) {
    const defender = state.pendingBattle?.coins ? otherPlayer(actingPlayer(state)) : null;
    const reroll = defender === null ? null : chooseReroll(state, defender);
    const seat = reroll ? defender! : actingPlayer(state);
    const action = reroll ?? chooseAction(state, seat, { difficulty: "easy", random: randoms[seat] });
    if (!action) break;
    const next = applyAction(state, action);
    recordAction(state, action, next);
    state = next;
  }
  return state;
}

test("the watcher is off and hidden unless switched on from the address", () => {
  expect(watcherEnabled()).toBe(false);
  const { container } = render(<WatcherPanel />);
  expect(container).toBeEmptyDOMElement();
  const game = newGame();
  startRecording(game, { players: SETUP.players, biomes: [...SETUP.biomes], decks: ["deck-1", "deck-3"] });
  expect(recordedGames()).toEqual([]);

  window.history.replaceState(null, "", "/?watcher=on&seed=1");
  applyWatcherSwitch();
  expect(watcherEnabled()).toBe(true);
  expect(window.location.search).toBe("?seed=1");

  window.history.replaceState(null, "", "/?watcher=off");
  applyWatcherSwitch();
  expect(watcherEnabled()).toBe(false);
  expect(window.location.search).toBe("");
});

// A whole game is played, which can take a while when the simulation suites are using every core.
test("a recorded game replays to exactly the same ending", { timeout: 120_000 }, () => {
  window.history.replaceState(null, "", "/?watcher=on");
  applyWatcherSwitch();
  // Games without a computer opponent are never recorded.
  startRecording(newGame(false), { players: SETUP.players, biomes: [...SETUP.biomes], decks: ["deck-1", "deck-3"] });
  expect(recordedGames()).toEqual([]);

  const start = newGame();
  startRecording(start, { players: SETUP.players, biomes: [...SETUP.biomes], decks: ["deck-1", "deck-3"] });
  const end = playRecorded(start);
  expect(end.phase).toBe("game-over");

  const [recording] = recordedGames();
  expect(recordedGames()).toHaveLength(1);
  expect(recording!.result).toMatchObject({ turnNumber: end.turnNumber, winner: end.winner, rng: end.rng });
  expect(new Set(recording!.actions.map(({ by }) => by))).toEqual(new Set(["person", "computer"]));

  const { setup } = recording!;
  let replayed = createGame(setup.players[0], setup.players[1], setup.biomes, setup.decks, {
    seed: setup.seed,
    computer: setup.computer,
  });
  for (const { action } of recording!.actions) replayed = applyAction(replayed, action);
  expect(replayed.phase).toBe("game-over");
  expect([replayed.turnNumber, replayed.winner, replayed.rng]).toEqual([end.turnNumber, end.winner, end.rng]);

  render(<WatcherPanel />);
  expect(screen.getByText("1 game recorded · 1 finished")).toBeInTheDocument();
});
