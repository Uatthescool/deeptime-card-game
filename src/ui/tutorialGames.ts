import { applyAction, createGame, type GameState } from "../engine/index.ts";

/**
 * A real game, staged: Player Two (Aquatic) went first and filled a Niche, and it is now Player One’s (Temperate) second
 * turn, just after their Start Phase draw. The first seed that stages cleanly is used, so it is the same every time.
 */
export function boardTutorialGame(): GameState {
  for (let seed = 1; seed < 1000; seed += 1) {
    let game = createGame("Player One", "Player Two", ["temperate", "aquatic"], ["deck-1", "deck-1"], { seed });
    if (game.activePlayer !== 1) continue;
    game = applyAction(game, { type: "acknowledgeHandoff" });
    const starter = game.players[1].hand.find(
      (card) => card.definition.kind === "creature" && card.definition.printedLevel === 0,
    );
    if (!starter || game.phase !== "development") continue;
    game = applyAction(game, { type: "playCreature", cardUid: starter.uid, laneIndex: 2 });
    if (!game.players[1].lanes[2]!.creature) continue;
    game = applyAction(game, { type: "endTurn" });
    game = applyAction(game, { type: "acknowledgeHandoff" });
    if (game.activePlayer === 0 && game.phase === "development" && !game.handoff) return game;
  }
  throw new Error("No seed staged the board tutorial.");
}
