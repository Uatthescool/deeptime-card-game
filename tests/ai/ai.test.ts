import { describe, expect, test } from "vitest";

import { aiRandom, chooseAction, chooseReroll, type Difficulty } from "../../src/ai/ai.ts";
import type { BiomeKey } from "../../src/data/biomes.ts";
import { DECK_KEYS, type DeckKey } from "../../src/data/cards.ts";
import {
  actingPlayer,
  applyAction,
  checkInvariants,
  createGame,
  type GameAction,
  type GameState,
  listLegalActions,
  otherPlayer,
  type PlayerId,
} from "../../src/engine/index.ts";
import { inPlay } from "../fixtures.ts";

type Seat = Difficulty | "random";

const BIOMES: Array<BiomeKey | null> = [null, "tropical", "temperate", "cold", "arid", "aquatic"];

/** Plays one full game between two seats, checking every move is legal and the state stays sound. */
function playGame(
  seed: number,
  seats: [Seat, Seat],
  decks: [DeckKey, DeckKey],
  biomes: [BiomeKey | null, BiomeKey | null],
) {
  let state: GameState = createGame("North", "South", biomes, decks, { seed });
  const randoms = [aiRandom(seed * 31 + 1), aiRandom(seed * 31 + 2)] as const;
  for (let step = 0; step < 5000 && state.phase !== "game-over"; step += 1) {
    const legal = listLegalActions(state);
    // A defender may reroll its own coin before the attacker resolves the Hunt.
    const defender = state.pendingBattle?.coins ? otherPlayer(actingPlayer(state)) : null;
    const reroll = defender !== null && seats[defender] !== "random" ? chooseReroll(state, defender) : null;
    const seat = reroll ? defender! : actingPlayer(state);
    const kind = seats[seat];
    const action: GameAction | null =
      reroll ??
      (kind === "random"
        ? (legal[Math.floor(randoms[seat]() * legal.length)] ?? null)
        : chooseAction(state, seat, { difficulty: kind, random: randoms[seat] }));
    expect(action, `seed ${seed}: a move is chosen`).not.toBeNull();
    expect(legal, `seed ${seed}: the chosen move is legal`).toContainEqual(action);
    state = applyAction(state, action!);
    const problems = checkInvariants(state);
    expect(problems, `seed ${seed}`).toEqual([]);
  }
  expect(state.phase, `seed ${seed}: the game finishes`).toBe("game-over");
  return state;
}

// Each test plays many full AI games, and Deck 1 games can run past 50 turns, so allow plenty of time.
const AI_GAMES_TIMEOUT_MS = 900_000;

const decksFor = (game: number): [DeckKey, DeckKey] => [DECK_KEYS[game % 3]!, DECK_KEYS[(game + 1) % 3]!];
const biomesFor = (game: number): [BiomeKey | null, BiomeKey | null] => [BIOMES[game % 6]!, BIOMES[(game + 2) % 6]!];

describe("computer opponent", () => {
  test("AI games always finish, using only legal moves", { timeout: AI_GAMES_TIMEOUT_MS }, () => {
    for (let game = 0; game < 9; game += 1) {
      const seats: [Seat, Seat] =
        game % 3 === 0 ? ["normal", "normal"] : game % 3 === 1 ? ["easy", "normal"] : ["normal", "easy"];
      playGame(4000 + game, seats, decksFor(game), biomesFor(game));
    }
  });

  test("Normal clearly beats random play", { timeout: AI_GAMES_TIMEOUT_MS }, () => {
    let wins = 0;
    const games = 12;
    for (let game = 0; game < games; game += 1) {
      const aiSeat: PlayerId = game % 2 === 0 ? 0 : 1;
      const seats: [Seat, Seat] = aiSeat === 0 ? ["normal", "random"] : ["random", "normal"];
      if (playGame(5000 + game, seats, decksFor(game), biomesFor(game)).winner === aiSeat) wins += 1;
    }
    expect(wins / games).toBeGreaterThanOrEqual(0.75);
  });

  test("Normal beats Easy more often than not", { timeout: AI_GAMES_TIMEOUT_MS }, () => {
    let wins = 0;
    const games = 12;
    for (let game = 0; game < games; game += 1) {
      const normalSeat: PlayerId = game % 2 === 0 ? 0 : 1;
      const seats: [Seat, Seat] = normalSeat === 0 ? ["normal", "easy"] : ["easy", "normal"];
      if (playGame(6000 + game, seats, decksFor(game), biomesFor(game)).winner === normalSeat) wins += 1;
    }
    expect(wins / games).toBeGreaterThan(0.5);
  });
});

/** The same position with everything the AI can't see changed: opponent's hand, both deck orders, the RNG. */
function scrambleHidden(state: GameState, me: PlayerId, seed: number): GameState {
  const copy = structuredClone(state);
  const random = aiRandom(seed);
  const shuffle = <T>(items: T[]) => {
    for (let index = items.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(random() * (index + 1));
      [items[index], items[swap]] = [items[swap]!, items[index]!];
    }
    return items;
  };
  const opponent = copy.players[otherPlayer(me)];
  const pool = shuffle([...opponent.hand, ...opponent.deck]);
  opponent.hand = pool.slice(0, opponent.hand.length);
  opponent.deck = pool.slice(opponent.hand.length);
  const own = copy.players[me];
  const revealed = copy.pendingBiodiversity?.playerId === me || copy.pendingFilterFeeder?.playerId === me ? 2 : 0;
  own.deck = [...own.deck.slice(0, revealed), ...shuffle(own.deck.slice(revealed))];
  copy.rng = Math.floor(random() * 0xffffffff) >>> 0;
  return copy;
}

describe("the AI plays fair", () => {
  test("its decisions never depend on information it couldn't see", { timeout: AI_GAMES_TIMEOUT_MS }, () => {
    let decisions = 0;
    for (let game = 0; game < 6; game += 1) {
      let state = createGame("North", "South", biomesFor(game), decksFor(game), { seed: 7000 + game });
      const random = aiRandom(game + 1);
      for (let step = 0; step < 600 && state.phase !== "game-over"; step += 1) {
        const me = actingPlayer(state);
        if (!state.handoff && step % 3 === 0) {
          for (const difficulty of ["normal", "easy"] as const) {
            const seed = 9000 + step;
            const original = chooseAction(state, me, { difficulty, random: aiRandom(seed) });
            for (const variant of [1, 2]) {
              const scrambled = chooseAction(scrambleHidden(state, me, seed * 7 + variant), me, {
                difficulty,
                random: aiRandom(seed),
              });
              expect(scrambled, `game ${game} step ${step} (${difficulty})`).toEqual(original);
            }
            decisions += 1;
          }
        }
        const action = chooseAction(state, me, { difficulty: "normal", random });
        if (!action) break;
        state = applyAction(state, action);
      }
    }
    expect(decisions).toBeGreaterThan(150);
  });
});

describe("Intraguild Predation", () => {
  /** Deck 1's Allosaurus facing two Deck 2 or Deck 3 Creatures, with Intraguild Predation as its only card. */
  function spot(opponentDeck: DeckKey, opposing: [string, string]): GameState {
    const game = createGame("A", "B", ["arid", "aquatic"], ["deck-1", opponentDeck], { seed: 3 });
    Object.assign(game, { activePlayer: 0, turnNumber: 5, phase: "development", handoff: null });
    const take = (playerId: PlayerId, key: string) => {
      const player = game.players[playerId];
      for (const zone of [player.deck, player.hand]) {
        const index = zone.findIndex((card) => card.definition.key === key);
        if (index >= 0) return zone.splice(index, 1)[0]!;
      }
      throw new Error(`No ${key}`);
    };
    game.players[0].lanes[0].creature = inPlay(take(0, "allosaurus"));
    game.players[1].lanes[0].creature = inPlay(take(1, opposing[0]));
    game.players[1].lanes[2].creature = inPlay(take(1, opposing[1]));
    const concept = take(0, "intraguild-predation");
    game.players[0].deck.push(...game.players[0].hand);
    game.players[0].hand = [concept];
    return game;
  }
  const choice = (game: GameState) => chooseAction(game, 0, { difficulty: "normal", random: aiRandom(1) });

  test("Normal plays it when it opens a Hunt on a Carnivore", () => {
    expect(choice(spot("deck-3", ["hyneria", "endoceras"]))?.type).toBe("playConcept");
  });

  test("Normal holds it when every opposing Creature can already be Hunted", () => {
    expect(choice(spot("deck-2", ["protoceratops", "kentrosaurus"]))?.type).not.toBe("playConcept");
  });
});
