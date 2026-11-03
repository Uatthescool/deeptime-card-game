import { useEffect, useState } from "react";

import type { BiomeKey } from "../data/biomes.ts";
import { deckBiome } from "../data/cards.ts";
import { createGame, type GameState } from "../engine/index.ts";
import { Credits } from "./components/Credits.tsx";
import { DeckBrowser } from "./components/DeckBrowser.tsx";
import { GameScreen } from "./components/GameScreen.tsx";
import { LessonExperience } from "./components/Lesson.tsx";
import { BiomeReveal, OpeningDealOverlay, type PregameState } from "./components/Pregame.tsx";
import { type SetupChoices, SetupScreen } from "./components/SetupScreen.tsx";
import { TutorialsMenu } from "./components/Tutorials.tsx";
import { clearSavedGame, loadSavedGame, savedGameSummary } from "./save.ts";
import { startRecording } from "./watcher.ts";

type Screen =
  | { kind: "setup" }
  | { kind: "pregame"; pregame: PregameState }
  | { kind: "game"; game: GameState; resumed: boolean; gameId: number };

type Overlay = "cards" | "lesson" | "credits" | "tutorials" | null;

type OpeningDeal = { players: [string, string]; decks: PregameState["decks"]; dealt: number };

const OPENING_CARDS = 10;

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: "setup" });
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [choices, setChoices] = useState<SetupChoices>({
    players: ["Player One", "Player Two"],
    decks: ["deck-1", "deck-1"],
    seed: null,
    opponent: "person",
  });
  const [savedGame, setSavedGame] = useState(savedGameSummary);
  const [deal, setDeal] = useState<OpeningDeal | null>(null);

  useEffect(() => {
    if (!deal) return;
    const timer = window.setTimeout(
      () => setDeal(deal.dealt < OPENING_CARDS ? { ...deal, dealt: deal.dealt + 1 } : null),
      deal.dealt < OPENING_CARDS ? 170 : 500,
    );
    return () => window.clearTimeout(timer);
  }, [deal]);

  const toSetup = () => {
    setScreen({ kind: "setup" });
    setDeal(null);
    setSavedGame(savedGameSummary());
  };

  if (screen.kind === "game") {
    return (
      <>
        <GameScreen key={screen.gameId} initialGame={screen.game} resumed={screen.resumed} onExit={toSetup} />
        {deal && <OpeningDealOverlay players={deal.players} decks={deal.decks} dealt={deal.dealt} />}
      </>
    );
  }

  if (screen.kind === "pregame") {
    const pregame = screen.pregame;
    return (
      <BiomeReveal
        state={pregame}
        onBack={toSetup}
        onDeal={() => {
          const biomes: [BiomeKey, BiomeKey] = [deckBiome(pregame.decks[0]), deckBiome(pregame.decks[1])];
          const game = createGame(pregame.players[0], pregame.players[1], biomes, pregame.decks, {
            ...(pregame.seed === null ? {} : { seed: pregame.seed }),
            computer: pregame.opponent === "person" ? null : { seat: 1, difficulty: pregame.opponent },
          });
          startRecording(game, { players: pregame.players, biomes, decks: pregame.decks });
          setScreen({ kind: "game", game, resumed: false, gameId: game.seed + Date.now() });
          setDeal({ players: pregame.players, decks: pregame.decks, dealt: 0 });
        }}
      />
    );
  }

  return (
    <>
      <SetupScreen
        initial={choices}
        savedGame={savedGame}
        onStart={(next) => {
          setChoices(next);
          setScreen({ kind: "pregame", pregame: next });
        }}
        onResume={() => {
          const game = loadSavedGame();
          if (game) setScreen({ kind: "game", game, resumed: true, gameId: Date.now() });
          else setSavedGame(null);
        }}
        onDiscardSave={() => {
          clearSavedGame();
          setSavedGame(null);
        }}
        onInspectCards={() => setOverlay("cards")}
        onTutorials={() => setOverlay("tutorials")}
        onLearn={() => setOverlay("lesson")}
        onCredits={() => setOverlay("credits")}
      />
      {overlay === "cards" && <DeckBrowser onClose={() => setOverlay(null)} />}
      {overlay === "lesson" && <LessonExperience onClose={() => setOverlay(null)} />}
      {overlay === "credits" && <Credits onClose={() => setOverlay(null)} />}
      {overlay === "tutorials" && <TutorialsMenu onClose={() => setOverlay(null)} />}
    </>
  );
}
