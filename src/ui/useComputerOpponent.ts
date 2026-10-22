import { useEffect } from "react";

import { aiRandom, chooseAction, chooseReroll } from "../ai/ai.ts";
import type { ThinkRequest } from "../ai/worker.ts";
import {
  actingPlayer,
  canRerollBattleCoin,
  type ComputerSeat,
  type GameAction,
  type GameState,
  otherPlayer,
} from "../engine/index.ts";

/** How long each of the computer's moves stays on screen, so a person can follow along. */
const PACE_MS = { move: 750, handoff: 450, huntPreview: 1300, coins: 1900, coinsWithHumanReroll: 3200 };

let worker: Worker | null | undefined;
let nextRequest = 1;
const waiting = new Map<number, (action: GameAction | null) => void>();

function getWorker() {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL("../ai/worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<{ id: number; action: GameAction | null }>) => {
      waiting.get(event.data.id)?.(event.data.action);
      waiting.delete(event.data.id);
    };
  } catch {
    worker = null;
  }
  return worker;
}

/** The computer's next move, worked out in a Web Worker where available (and on the main thread otherwise). */
function think(state: GameState, computer: ComputerSeat, seed: number): Promise<GameAction | null> {
  const thread = typeof Worker === "undefined" ? null : getWorker();
  if (!thread) {
    return Promise.resolve(
      chooseAction(state, computer.seat, { difficulty: computer.difficulty, random: aiRandom(seed) }),
    );
  }
  const id = nextRequest++;
  return new Promise((resolve) => {
    waiting.set(id, resolve);
    thread.postMessage({ id, state, computer, seed } satisfies ThinkRequest);
  });
}

function pace(game: GameState, computer: ComputerSeat) {
  if (game.handoff) return PACE_MS.handoff;
  const battle = game.pendingBattle;
  if (!battle) return PACE_MS.move;
  if (!battle.coins) return PACE_MS.huntPreview;
  // Give the person time to use a Temperate reroll on their own coin before the computer resolves the Hunt.
  const human = otherPlayer(computer.seat);
  const groups = (["offensive", "defensive"] as const).filter((group) =>
    (battle.coins?.[group] ?? []).some((_, index) => canRerollBattleCoin(game, human, group, index)),
  );
  return groups.length ? PACE_MS.coinsWithHumanReroll : PACE_MS.coins;
}

/**
 * Plays the computer's seat: its turns, its choices, and its rerolls when it
 * defends. Handoffs to the person are skipped, since nobody passes the device.
 * Returns true while the computer is the one to move.
 */
export function useComputerOpponent(game: GameState, dispatch: (action: GameAction) => void) {
  const computer = game.computer ?? null;
  const computerToMove = Boolean(computer && game.phase !== "game-over" && actingPlayer(game) === computer.seat);

  // Defending: decide on a reroll as soon as the coins land, before the person can resolve the Hunt.
  useEffect(() => {
    if (!computer || !game.pendingBattle?.coins || actingPlayer(game) === computer.seat) return;
    const reroll = chooseReroll(game, computer.seat);
    if (reroll) dispatch(reroll);
  }, [game, computer, dispatch]);

  useEffect(() => {
    if (!computer || game.phase === "game-over") return;
    if (game.handoff && game.handoff.to !== computer.seat) {
      dispatch({ type: "acknowledgeHandoff" });
      return;
    }
    if (!computerToMove) return;
    let cancelled = false;
    let timer: number | undefined;
    const started = performance.now();
    // Seeded from the game and how far it has gone, so a replayed game gets the same decisions.
    const seed = (game.seed ^ Math.imul(game.log.length + 1, 0x9e3779b1)) >>> 0;
    void think(game, computer, seed).then((action) => {
      if (cancelled || !action) return;
      const wait = Math.max(0, pace(game, computer) - (performance.now() - started));
      timer = window.setTimeout(() => {
        if (!cancelled) dispatch(action);
      }, wait);
    });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [game, computer, computerToMove, dispatch]);

  return computerToMove;
}
