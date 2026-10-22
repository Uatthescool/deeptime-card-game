import { describe, expect, test } from "vitest";

import {
  applyAction,
  checkInvariants,
  createGame,
  endingTurnForfeits,
  endTurn,
  type GameState,
  HAND_LIMIT,
  type PlayerId,
} from "../../src/engine/index.ts";

/** A Development Phase game on Ada's turn with her hand topped up to the limit from her deck. */
function fullHandGame(): GameState {
  const state = createGame("Ada", "Grace", [null, null], ["deck-1", "deck-1"], { seed: 21 });
  Object.assign(state, { activePlayer: 0 as PlayerId, turnNumber: 1, phase: "development", handoff: null });
  const ada = state.players[0];
  ada.hand.push(...ada.deck.splice(0, HAND_LIMIT - ada.hand.length));
  return state;
}

/** Ends the current turn, lets the other player end theirs, and returns to the start of the first player's turn. */
function passRound(state: GameState) {
  let next = applyAction(endTurn(state), { type: "acknowledgeHandoff" });
  next = applyAction(endTurn(next), { type: "acknowledgeHandoff" });
  return next;
}

describe("full-hand forfeit", () => {
  test("ending two turns in a row with a full hand forfeits", () => {
    let state = fullHandGame();
    expect(endingTurnForfeits(state)).toBe(false);

    state = passRound(state);
    expect(state.players[0].fullHandTurns).toBe(1);
    expect(state.log.some((line) => line.includes("doing so again next turn forfeits"))).toBe(true);
    expect(state.phase).toBe("development");
    expect(state.players[0].hand.length).toBe(HAND_LIMIT);
    expect(endingTurnForfeits(state)).toBe(true);

    state = endTurn(state);
    expect(state.phase).toBe("game-over");
    expect(state.winner).toBe(1);
    expect(state.winReason).toBe("Ada ended two turns in a row with a full hand and forfeited.");
    expect(checkInvariants(state)).toEqual([]);
  });

  test("ending a turn below the limit resets the count", () => {
    let state = passRound(fullHandGame());
    // Ada ends this turn with nine cards (one goes back on top of her deck).
    const ada = state.players[0];
    ada.deck.unshift(ada.hand.pop()!);
    expect(endingTurnForfeits(state)).toBe(false);

    state = passRound(state);
    expect(state.players[0].fullHandTurns).toBe(0);
    expect(state.phase).toBe("development");
  });

  test("a full hand with an empty deck stalls nothing and never forfeits", () => {
    let state = fullHandGame();
    const ada = state.players[0];
    ada.history.push(...ada.deck.splice(0));
    state = passRound(state);
    expect(endingTurnForfeits(state)).toBe(false);
    state = endTurn(state);
    expect(state.winner).toBeNull();
  });
});
