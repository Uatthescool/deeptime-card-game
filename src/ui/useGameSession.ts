import { useCallback, useEffect, useRef, useState } from "react";

import { applyAction, checkInvariants, type DrawEvent, type GameAction, type GameState } from "../engine/index.ts";
import { saveGame } from "./save.ts";

const DRAW_ANIMATION_MS = 680;

/**
 * Owns the live GameState for one game. Every change goes through
 * `dispatch(action)`, which runs the engine, queues draw animations, and
 * autosaves so a refresh never loses a game in progress.
 */
export function useGameSession(initial: GameState) {
  const [game, setGame] = useState(initial);
  const gameRef = useRef(initial);
  const [drawQueue, setDrawQueue] = useState<DrawEvent[]>([]);
  // Genetic Drift's mandatory discard resolves before its five draws animate.
  const deferredDraws = useRef<DrawEvent[]>([]);

  const dispatch = useCallback((action: GameAction) => {
    const current = gameRef.current;
    const next = applyAction(current, action);

    if (import.meta.env.DEV) {
      const problems = checkInvariants(next);
      if (problems.length) console.error("Game invariant violated after", action, problems);
    }

    const latestDrawId = current.drawEvents.at(-1)?.id ?? 0;
    const newDraws = next.drawEvents.filter((event) => event.id > latestDrawId);
    const driftPending = next.pendingConceptChoice?.kind === "genetic-drift-discard";
    if (newDraws.length) {
      if (driftPending) deferredDraws.current.push(...newDraws);
      else setDrawQueue((queue) => [...queue, ...newDraws]);
    }
    if (
      current.pendingConceptChoice?.kind === "genetic-drift-discard" &&
      !driftPending &&
      deferredDraws.current.length
    ) {
      const released = deferredDraws.current;
      deferredDraws.current = [];
      setDrawQueue((queue) => [...queue, ...released]);
    }

    gameRef.current = next;
    setGame(next);
  }, []);

  useEffect(() => {
    if (!drawQueue.length) return;
    const timer = window.setTimeout(() => setDrawQueue((queue) => queue.slice(1)), DRAW_ANIMATION_MS);
    return () => window.clearTimeout(timer);
  }, [drawQueue]);

  useEffect(() => saveGame(game), [game]);

  return { game, dispatch, currentDraw: drawQueue[0] ?? null };
}
