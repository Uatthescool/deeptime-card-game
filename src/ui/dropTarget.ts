import type { PlayerId } from "../engine/index.ts";

/** Where a dragged card is let go: a Niche, or anywhere else on the board (for Events and Concepts). */
export type DropTarget = { kind: "lane"; playerId: PlayerId; laneIndex: number } | { kind: "board" };

export function dropTargetAt(x: number, y: number): DropTarget | null {
  const element = document.elementFromPoint(x, y);
  const lane = element?.closest<HTMLElement>("[data-drop-lane]");
  if (lane) {
    return {
      kind: "lane",
      playerId: Number(lane.dataset.dropPlayer) as PlayerId,
      laneIndex: Number(lane.dataset.dropLane),
    };
  }
  return element?.closest("[data-drop-board]") ? { kind: "board" } : null;
}
