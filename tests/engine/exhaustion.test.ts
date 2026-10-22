import { describe, expect, test } from "vitest";

import {
  applyAction,
  checkInvariants,
  createGame,
  endTurn,
  type GameState,
  listLegalActions,
  type PlayerId,
  victoryTotals,
} from "../../src/engine/index.ts";
import { inPlay, takeFromLibrary } from "../fixtures.ts";

/** A Development Phase game on `turnNumber` with both decks emptied into History and the given Creatures in play. */
function exhaustedGame(turnNumber: number, boards: [string[], string[]]): GameState {
  const state = createGame("Ada", "Grace", [null, null], ["deck-1", "deck-1"], { seed: 12 });
  // Turn 1 belongs to the first player, so odd turns are Player 0's in this setup.
  Object.assign(state, {
    activePlayer: (turnNumber % 2 === 1 ? 0 : 1) as PlayerId,
    turnNumber,
    phase: "development",
    handoff: null,
  });
  for (const playerId of [0, 1] as const) {
    const player = state.players[playerId];
    player.lanes = player.lanes.map(() => ({
      creature: null,
      attachment: null,
      engulfed: null,
      wildfire: null,
      drought: null,
    }));
    boards[playerId].forEach((key, laneIndex) => {
      player.lanes[laneIndex]!.creature = inPlay(takeFromLibrary(state, playerId, key));
    });
    player.history.push(...player.deck.splice(0));
  }
  return state;
}

describe("deck exhaustion", () => {
  test("decks emptied on the first player's turn give the second player one final turn", () => {
    let state = exhaustedGame(7, [["allosaurus"], ["compsognathus"]]);
    state = endTurn(state);
    expect(state.finalTurn).toBe(8);
    expect(state.phase).toBe("handoff");
    expect(state.winner).toBeNull();

    state = applyAction(state, { type: "acknowledgeHandoff" });
    state = endTurn(state);
    expect(state.phase).toBe("game-over");
    expect(state.winner).toBe(0);
    expect(state.winReason).toMatch(/Both decks ran out; Ada led \d+ to \d+/);
    expect(checkInvariants(state)).toEqual([]);
  });

  test("decks emptied on the second player's turn end the game at once", () => {
    let state = exhaustedGame(8, [["compsognathus"], ["allosaurus"]]);
    state = endTurn(state);
    expect(state.finalTurn).toBe(8);
    expect(state.phase).toBe("game-over");
    expect(state.winner).toBe(1);
  });

  test("equal totals are a draw, and a drawn game accepts no further moves", () => {
    let state = exhaustedGame(8, [["allosaurus"], ["allosaurus"]]);
    const [a, b] = victoryTotals(state);
    expect(a).toBe(b);
    state = endTurn(state);
    expect(state.phase).toBe("game-over");
    expect(state.drawn).toBe(true);
    expect(state.winner).toBeNull();
    expect(listLegalActions(state)).toEqual([]);
    expect(endTurn(state)).toEqual(state);
    expect(checkInvariants(state)).toEqual([]);
  });

  test("only one empty deck starts no countdown", () => {
    let state = exhaustedGame(7, [["allosaurus"], ["compsognathus"]]);
    state.players[1].deck.push(state.players[1].history.pop()!);
    state = endTurn(state);
    expect(state.finalTurn ?? null).toBeNull();
    expect(state.phase).toBe("handoff");
  });

  test("reaching 12 Victory Levels still wins outright during the final round", () => {
    let state = exhaustedGame(7, [["allosaurus"], ["compsognathus"]]);
    state = endTurn(state);
    expect(state.finalTurn).toBe(8);
    state = applyAction(state, { type: "acknowledgeHandoff" });
    // Grace's board jumps past the threshold before the round ends.
    for (const [laneIndex, key] of ["torvosaurus", "tyrannosaurus-rex", "spinosaurus", "dimetrodon"].entries()) {
      const card = state.players[1].history.find((entry) => entry.definition.key === key)!;
      state.players[1].history = state.players[1].history.filter((entry) => entry !== card);
      state.players[1].lanes[laneIndex + 1]!.creature = inPlay(card);
    }
    expect(victoryTotals(state)[1]).toBeGreaterThanOrEqual(12);
    state = endTurn(state);
    expect(state.winner).toBe(1);
    expect(state.winReason).toMatch(/reached \d+ Victory Levels/);
  });
});
