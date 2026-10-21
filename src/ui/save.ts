import { CARD_LIBRARY } from "../data/cards.ts";
import { checkInvariants, GAME_STATE_VERSION, type GameState } from "../engine/index.ts";
import { readJson, removeKey, writeJson } from "./storage.ts";

const SAVE_KEY = "pcg.savedGame";

type SaveFile = { version: number; savedAt: string; game: GameState };

export type SavedGameSummary = { savedAt: Date; players: [string, string]; turnNumber: number };

export function saveGame(game: GameState) {
  if (game.winner !== null) {
    clearSavedGame();
    return;
  }
  writeJson("local", SAVE_KEY, {
    version: GAME_STATE_VERSION,
    savedAt: new Date().toISOString(),
    game,
  } satisfies SaveFile);
}

export function clearSavedGame() {
  removeKey("local", SAVE_KEY);
}

/**
 * Re-links every saved card to the current card library so a save always uses
 * today's card text. Returns null if the save references a card that no longer exists.
 */
function relinkDefinitions(game: GameState): GameState | null {
  let missing = false;
  const relinked = JSON.parse(JSON.stringify(game), (_key, value) => {
    if (value && typeof value === "object" && "uid" in value && "owner" in value && "definition" in value) {
      const definition = CARD_LIBRARY.get(value.definition?.key);
      if (!definition) missing = true;
      return { ...value, definition };
    }
    return value;
  }) as GameState;
  return missing ? null : relinked;
}

/** Loads the saved game, discarding it if it is from an incompatible build or fails validation. */
export function loadSavedGame(): GameState | null {
  const file = readJson<SaveFile | null>("local", SAVE_KEY, null);
  if (!file || file.version !== GAME_STATE_VERSION || file.game?.version !== GAME_STATE_VERSION) return null;
  try {
    const game = relinkDefinitions(file.game);
    if (!game || game.winner !== null || checkInvariants(game).length) {
      clearSavedGame();
      return null;
    }
    return game;
  } catch {
    clearSavedGame();
    return null;
  }
}

export function savedGameSummary(): SavedGameSummary | null {
  const file = readJson<SaveFile | null>("local", SAVE_KEY, null);
  if (!file || file.version !== GAME_STATE_VERSION || !file.game?.players) return null;
  return {
    savedAt: new Date(file.savedAt),
    players: [file.game.players[0].name, file.game.players[1].name],
    turnNumber: file.game.turnNumber,
  };
}
