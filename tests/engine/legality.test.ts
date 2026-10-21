import { describe, expect, test } from "vitest";

import type { BiomeKey } from "../../src/data/biomes.ts";
import { DECK_KEYS } from "../../src/data/cards.ts";
import {
  applyAction,
  createGame,
  emptyAllowances,
  explainCard,
  explainCreatureLane,
  explainHunt,
  explainHunter,
  explainPlacement,
  type GameAction,
  type GameState,
  legalCreatureLanes,
  listLegalActions,
} from "../../src/engine/index.ts";
import { inPlay, takeFromLibrary } from "../fixtures.ts";

const BIOMES: Array<BiomeKey | null> = [null, "tropical", "temperate", "cold", "arid", "aquatic"];

/** Card uids that some listed legal action plays from hand. */
function playableUids(actions: GameAction[]) {
  return new Set(actions.flatMap((action) => ("cardUid" in action ? [action.cardUid] : [])));
}

describe("explanations agree with the legal-move list", () => {
  test(
    "in every state of simulated games, a move is explained exactly when it is illegal",
    { timeout: 180_000 },
    () => {
      let cardChecks = 0;
      let laneChecks = 0;
      let huntChecks = 0;
      let hintChecks = 0;
      for (let game = 0; game < 18; game += 1) {
        let value = (game * 2654435761 + 11) >>> 0 || 1;
        const random = () => {
          value ^= value << 13;
          value ^= value >>> 17;
          value ^= value << 5;
          return (value >>> 0) / 4294967296;
        };
        let state: GameState = createGame(
          "A",
          "B",
          [BIOMES[game % 6]!, BIOMES[(game + 2) % 6]!],
          [DECK_KEYS[game % 3]!, DECK_KEYS[(game + 1) % 3]!],
          { seed: 3000 + game },
        );
        for (let step = 0; step < 300 && state.winner === null; step += 1) {
          const legal = listLegalActions(state);
          if (!legal.length) break;
          const active = state.activePlayer;
          const playable = playableUids(legal);

          if (state.phase === "development") {
            for (const card of state.players[active].hand) {
              const verdict = explainCard(state, card);
              cardChecks += 1;
              expect(verdict.legal, `${card.definition.name} playability`).toBe(playable.has(card.uid));
              expect(verdict.legal ? verdict.reasons.length === 0 : verdict.reasons.length > 0).toBe(true);

              if (card.definition.kind !== "creature") continue;
              const lanes = new Set(
                legal.flatMap((action) =>
                  action.type === "playCreature" && action.cardUid === card.uid ? [action.laneIndex] : [],
                ),
              );
              state.players[active].lanes.forEach((_, laneIndex) => {
                const placement = explainPlacement(state, active, card, laneIndex);
                laneChecks += 1;
                expect(placement.legal).toBe(lanes.has(laneIndex));
                expect(placement.legal ? placement.reasons.length === 0 : placement.reasons.length > 0).toBe(true);
                for (const hint of placement.hints) {
                  // Playing the suggested Concept must really make this placement legal.
                  const after = applyAction(state, { type: "playConcept", cardUid: hint.cardUid });
                  hintChecks += 1;
                  expect(legalCreatureLanes(after, active, card), hint.text).toContain(laneIndex);
                }
              });
            }
          }

          if (state.phase === "battle" && !state.pendingBattle) {
            const hunts = new Set(
              legal.flatMap((action) =>
                action.type === "previewHunt" ? [`${action.attackerUid}>${action.defenderUid}`] : [],
              ),
            );
            for (const lane of state.players[active].lanes) {
              if (!lane.creature) continue;
              const attackerUid = lane.creature.card.uid;
              let anyTarget = false;
              for (const target of state.players[active === 0 ? 1 : 0].lanes) {
                if (!target.creature) continue;
                const verdict = explainHunt(state, attackerUid, target.creature.card.uid);
                huntChecks += 1;
                const listed = hunts.has(`${attackerUid}>${target.creature.card.uid}`);
                anyTarget ||= listed;
                expect(verdict.legal).toBe(listed);
                expect(verdict.legal ? verdict.reasons.length === 0 : verdict.reasons.length > 0).toBe(true);
              }
              expect(explainHunter(state, attackerUid).length === 0).toBe(anyTarget);
            }
          }

          const progressing = legal.filter((action) => action.type !== "endTurn");
          const pool = progressing.length && random() < 0.9 ? progressing : legal;
          state = applyAction(state, pool[Math.floor(random() * pool.length)]!);
        }
      }
      expect(cardChecks).toBeGreaterThan(1000);
      expect(laneChecks).toBeGreaterThan(1000);
      expect(huntChecks).toBeGreaterThan(100);
      expect(hintChecks, "simulated games exercise near-miss hints").toBeGreaterThan(0);
    },
  );
});

/** A Development Phase game with empty boards, Player 0 to act on turn 3. */
function blankGame(): GameState {
  const state = createGame("A", "B", [null, null], ["deck-1", "deck-2"], { seed: 21 });
  Object.assign(state, { activePlayer: 0, turnNumber: 3, phase: "development", handoff: null });
  for (const player of state.players) {
    player.lanes = player.lanes.map(() => ({
      creature: null,
      attachment: null,
      engulfed: null,
      wildfire: null,
      drought: null,
    }));
    player.allowances = emptyAllowances();
    player.turnsStarted = 2;
  }
  return state;
}

describe("explanation wording", () => {
  test("an override breakdown names each category and the Level step", () => {
    const state = blankGame();
    const current = takeFromLibrary(state, 0, "velociraptor");
    state.players[0].lanes[1]!.creature = inPlay(current);
    const incoming = takeFromLibrary(state, 0, "allosaurus");
    state.players[0].hand.push(incoming);
    const verdict = explainCreatureLane(state, 0, incoming, 1);
    const explanations = verdict.override!.explanations!;
    expect(explanations.diet).toBe("Carnivore can replace Carnivore");
    expect(explanations.taxon).toBe("Both Archosaur");
    expect(explanations.level).toMatch(/Level \d → 2/);
    if (!verdict.legal) expect(verdict.reasons.length).toBeGreaterThan(0);
  });

  test("empty Niches explain the Level rule and the one-fill-per-turn rule", () => {
    const state = blankGame();
    const big = takeFromLibrary(state, 0, "allosaurus");
    state.players[0].hand.push(big);
    expect(explainCreatureLane(state, 0, big, 0).reasons.map((item) => item.code)).toEqual(["empty-needs-low-level"]);

    const small = takeFromLibrary(state, 0, "compsognathus");
    state.players[0].hand.push(small);
    state.players[0].allowances.filledEmpty = true;
    expect(explainCreatureLane(state, 0, small, 0).reasons.map((item) => item.code)).toEqual(["already-filled-empty"]);
    expect(explainCard(state, small).reasons.map((item) => item.code)).toContain("already-filled-empty");
  });

  test("Hunts explain Gigantic defenders and Creatures that just entered play", () => {
    const state = blankGame();
    state.phase = "battle";
    const hunter = inPlay(takeFromLibrary(state, 0, "compsognathus"));
    state.players[0].lanes[0]!.creature = hunter;
    const giant = inPlay(takeFromLibrary(state, 1, "dreadnoughtus"));
    state.players[1].lanes[0]!.creature = giant;
    expect(explainHunt(state, hunter.card.uid, giant.card.uid).reasons.map((item) => item.code)).toContain(
      "gigantic-target",
    );
    hunter.enteredTurn = state.turnNumber;
    expect(explainHunter(state, hunter.card.uid).map((item) => item.code)).toEqual(["entered-this-turn"]);
  });

  test("a second Creature play is explained", () => {
    const state = blankGame();
    state.players[0].allowances.creaturePlayed = true;
    const card = takeFromLibrary(state, 0, "allosaurus");
    state.players[0].hand.push(card);
    expect(explainCard(state, card).reasons).toEqual([
      { code: "creature-already-played", text: "You've already played a Creature this turn." },
    ]);
  });
});
