import { addLog, clone } from "./core.ts";
import { finishResolution } from "./turn.ts";
import type { ChoiceOption, GameState, PendingDeadEnd } from "./types.ts";

export const DECLINE_DEAD_END = "decline-dead-end";

/** The Dead End choice that must resolve next, if any. */
export const pendingDeadEnd = (state: GameState): PendingDeadEnd | null => state.deadEndQueue?.[0] ?? null;

/** The Concepts the waiting Dead End may return (still in History), and declining. */
export function getDeadEndOptions(state: GameState): ChoiceOption[] {
  const pending = pendingDeadEnd(state);
  if (!pending) return [];
  const history = state.players[pending.playerId].history;
  const concepts = pending.conceptUids.flatMap((uid) => {
    const card = history.find((entry) => entry.uid === uid);
    return card ? [{ id: card.uid, label: card.definition.name, detail: "Concept · History Pile" }] : [];
  });
  return [...concepts, { id: DECLINE_DEAD_END, label: "Return nothing", detail: "Leave the History Pile as it is." }];
}

/** Resolves the waiting Dead End: returns the chosen Concept from History to its owner's hand, or nothing. */
export function chooseDeadEnd(original: GameState, optionId: string): GameState {
  const pending = pendingDeadEnd(original);
  if (!pending || !getDeadEndOptions(original).some((option) => option.id === optionId)) return original;
  const state = clone(original);
  const player = state.players[pending.playerId];
  state.deadEndQueue = state.deadEndQueue!.slice(1);
  if (optionId === DECLINE_DEAD_END) {
    addLog(state, `${player.name} returned nothing with ${pending.sourceName}'s Dead End.`);
  } else {
    const index = player.history.findIndex((card) => card.uid === optionId);
    const [card] = player.history.splice(index, 1);
    player.hand.push(card!);
    addLog(state, `${pending.sourceName}'s Dead End returned ${card!.definition.name} to ${player.name}'s hand.`);
  }
  return finishResolution(state);
}
