import { describe, expect, test } from "vitest";

import type { BiomeKey } from "../../src/data/biomes.ts";
import { DECK_KEYS, type DeckKey } from "../../src/data/cards.ts";
import {
  applyAction,
  checkInvariants,
  createGame,
  listLegalActions,
  type GameAction,
  type GameState,
} from "../../src/engine/index.ts";

/**
 * Plays complete games with a seeded random policy over the legal-action
 * generator, checking structural invariants after every single action. This
 * exercises card interactions no hand-written test anticipates.
 */

const BIOMES: Array<BiomeKey | null> = [null, "tropical", "temperate", "cold", "arid", "aquatic"];
/** Far more actions than any real game needs; the deck exhaustion rule guarantees every game ends. */
const MAX_ACTIONS = 3000;

function policyRandom(seed: number) {
  let value = seed >>> 0 || 1;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) / 4294967296;
  };
}

/** Prefers progress over ending the turn so games actually develop. */
function pickAction(actions: GameAction[], random: () => number): GameAction {
  const progressing = actions.filter((action) => action.type !== "endTurn" && action.type !== "cancelHunt");
  const pool = progressing.length && random() < 0.9 ? progressing : actions;
  return pool[Math.floor(random() * pool.length)]!;
}

function simulate(seed: number, decks: [DeckKey, DeckKey], biomes: [BiomeKey | null, BiomeKey | null]) {
  const random = policyRandom(seed * 7919);
  let state: GameState = createGame("North", "South", biomes, decks, { seed });
  const history: GameAction[] = [];
  for (let step = 0; step < MAX_ACTIONS && state.phase !== "game-over"; step += 1) {
    const legal = listLegalActions(state);
    if (!legal.length) {
      throw new Error(`Game ${seed} is stuck on turn ${state.turnNumber} (${state.phase}) with no legal action.`);
    }
    const action = pickAction(legal, random);
    const next = applyAction(state, action);
    if (JSON.stringify(next) === JSON.stringify(state)) {
      throw new Error(`Game ${seed}: listed action ${JSON.stringify(action)} had no effect.`);
    }
    const problems = checkInvariants(next);
    if (problems.length) {
      throw new Error(`Game ${seed} after ${JSON.stringify(action)} (turn ${next.turnNumber}): ${problems.join(" ")}`);
    }
    history.push(action);
    state = next;
  }
  return { state, history };
}

const matchups: Array<[DeckKey, DeckKey]> = DECK_KEYS.flatMap((a) =>
  DECK_KEYS.map((b) => [a, b] as [DeckKey, DeckKey]),
);

// Each matchup plays six full games with invariant checks after every action; allow for slow CI machines.
const MATCHUP_TIMEOUT_MS = 120_000;

describe("simulated games", () => {
  test.each(matchups)(
    "%s vs %s always ends without breaking invariants",
    { timeout: MATCHUP_TIMEOUT_MS },
    (deckA, deckB) => {
      for (let game = 0; game < 6; game += 1) {
        const seed = 1000 + matchups.findIndex(([a, b]) => a === deckA && b === deckB) * 100 + game;
        const biomes: [BiomeKey | null, BiomeKey | null] = [
          BIOMES[game % BIOMES.length]!,
          BIOMES[(game + 3) % BIOMES.length]!,
        ];
        const { state } = simulate(seed, [deckA, deckB], biomes);
        expect(state.phase, `game ${seed} reaches a win or a draw`).toBe("game-over");
      }
    },
  );
});
