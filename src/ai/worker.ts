/// <reference lib="webworker" />
import type { ComputerSeat, GameState } from "../engine/index.ts";
import { aiRandom, chooseAction } from "./ai.ts";

export type ThinkRequest = { id: number; state: GameState; computer: ComputerSeat; seed: number };

/** Runs the computer's decisions off the main thread so the page never stalls while it thinks. */
self.onmessage = (event: MessageEvent<ThinkRequest>) => {
  const { id, state, computer, seed } = event.data;
  const action = chooseAction(state, computer.seat, { difficulty: computer.difficulty, random: aiRandom(seed) });
  self.postMessage({ id, action });
};
