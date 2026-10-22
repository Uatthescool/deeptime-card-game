import { describe, expect, test } from "vitest";

import {
  applyAction,
  commitBattle,
  createGame,
  flipBattleCoins,
  listLegalActions,
  parseSeedLabel,
  replay,
  seedLabel,
  type GameAction,
  type GameState,
} from "../../src/engine/index.ts";
import { elusiveHunt } from "../fixtures.ts";

function playScripted(state: GameState, steps: number) {
  const actions: GameAction[] = [];
  let current = state;
  for (let step = 0; step < steps && current.phase !== "game-over"; step += 1) {
    const legal = listLegalActions(current);
    if (!legal.length) break;
    // A fixed, non-random policy: take the middle option.
    const action = legal[Math.floor(legal.length / 2)]!;
    actions.push(action);
    current = applyAction(current, action);
  }
  return { actions, final: current };
}

describe("seeded randomness", () => {
  test("the same seed deals the same game", () => {
    const a = createGame("A", "B", ["tropical", "cold"], ["deck-1", "deck-2"], { seed: 1234 });
    const b = createGame("A", "B", ["tropical", "cold"], ["deck-1", "deck-2"], { seed: 1234 });
    expect(b).toEqual(a);
  });

  test("different seeds deal different games", () => {
    const a = createGame("A", "B", [null, null], ["deck-1", "deck-1"], { seed: 1 });
    const b = createGame("A", "B", [null, null], ["deck-1", "deck-1"], { seed: 2 });
    expect(b.players[0].deck.map((card) => card.uid)).not.toEqual(a.players[0].deck.map((card) => card.uid));
  });

  test("a recorded action list replays to the identical final state", () => {
    const start = createGame("A", "B", ["arid", "aquatic"], ["deck-3", "deck-2"], { seed: 98765 });
    const { actions, final } = playScripted(start, 400);
    expect(actions.length).toBeGreaterThan(50);
    expect(replay(start, actions)).toEqual(final);
  });

  test("seed labels round-trip", () => {
    for (const seed of [0, 1, 42, 0xdeadbeef, 0xffffffff]) {
      expect(parseSeedLabel(seedLabel(seed))).toBe(seed >>> 0);
    }
    expect(parseSeedLabel("not a seed!")).toBeNull();
    expect(createGame("A", "B", [null, null], ["deck-1", "deck-1"], { seed: 77 }).seedLabel).toBe(seedLabel(77));
  });
});

describe("purity", () => {
  test("transitions never mutate their input", () => {
    let state = createGame("A", "B", ["temperate", "tropical"], ["deck-2", "deck-1"], { seed: 5 });
    for (let step = 0; step < 300 && state.phase !== "game-over"; step += 1) {
      const legal = listLegalActions(state);
      if (!legal.length) break;
      const snapshot = structuredClone(state);
      const next = applyAction(state, legal[step % legal.length]!);
      expect(state).toEqual(snapshot);
      state = next;
    }
  });
});

describe("Battle Coins", () => {
  test("flipped coins are stored, cannot be canceled, and decide the committed Hunt", () => {
    const state = elusiveHunt();
    expect(state.pendingBattle?.coinPlan.defensiveCount).toBe(1);
    expect(listLegalActions(state).map((action) => action.type)).toEqual(["flipBattleCoins", "cancelHunt"]);
    const flipped = flipBattleCoins(state);
    const coins = flipped.pendingBattle!.coins!;
    const plan = flipped.pendingBattle!.coinPlan;
    expect(coins.offensive).toHaveLength(plan.offensiveCount);
    expect(coins.defensive).toHaveLength(plan.defensiveCount);
    expect(listLegalActions(flipped).some((action) => action.type === "cancelHunt")).toBe(false);
    expect(flipBattleCoins(flipped)).toEqual(flipped);
    expect(commitBattle(flipped)).toEqual(commitBattle(flipped, coins));
  });

  test("a Temperate player may reroll their own coin once per turn, spending a Season counter", () => {
    const flipped = flipBattleCoins(elusiveHunt());
    const rerolls = listLegalActions(flipped).filter((action) => action.type === "rerollBattleCoin");
    expect(rerolls).toEqual([{ type: "rerollBattleCoin", playerId: 1, group: "defensive", index: 0 }]);
    const rerolled = applyAction(flipped, rerolls[0]!);
    expect(rerolled.players[1].biome.seasonCounters).toBe(3);
    expect(listLegalActions(rerolled).some((action) => action.type === "rerollBattleCoin")).toBe(false);
  });
});
