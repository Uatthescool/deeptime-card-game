import { useEffect, useState } from "react";

import type { BiomeKey } from "../data/biomes.ts";
import { createGame, type GameState } from "../engine/index.ts";
import { Credits } from "./components/Credits.tsx";
import { DeckBrowser } from "./components/DeckBrowser.tsx";
import { GameScreen } from "./components/GameScreen.tsx";
import { LessonExperience } from "./components/Lesson.tsx";
import { BiomePregame, OpeningDealOverlay, type PregameState } from "./components/Pregame.tsx";
import { type SetupChoices, SetupScreen } from "./components/SetupScreen.tsx";
import { clearSavedGame, loadSavedGame, savedGameSummary } from "./save.ts";

type Screen =
  | { kind: "setup" }
  | { kind: "pregame"; pregame: PregameState }
  | { kind: "game"; game: GameState; resumed: boolean; gameId: number };

type Overlay = "cards" | "lesson" | "credits" | null;

type OpeningDeal = {
  players: [string, string];
  decks: PregameState["decks"];
  choices: [BiomeKey | null, BiomeKey | null];
  dealt: number;
};

const OPENING_CARDS = 10;

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: "setup" });
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [choices, setChoices] = useState<SetupChoices>({
    players: ["Player One", "Player Two"],
    decks: ["deck-1", "deck-1"],
    seed: null,
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
        {deal && (
          <OpeningDealOverlay players={deal.players} decks={deal.decks} choices={deal.choices} dealt={deal.dealt} />
        )}
      </>
    );
  }

  if (screen.kind === "pregame") {
    const pregame = screen.pregame;
    const update = (next: Partial<PregameState>) => setScreen({ kind: "pregame", pregame: { ...pregame, ...next } });
    return (
      <BiomePregame
        state={pregame}
        onSelect={(biome) => update({ selected: biome })}
        onConfirm={() => {
          if (!pregame.selected) return;
          const picked: PregameState["choices"] = [...pregame.choices];
          picked[pregame.chooser] = pregame.selected;
          update({ choices: picked, selected: null, stage: pregame.chooser === 0 ? "handoff" : "reveal" });
        }}
        onContinue={() => update({ chooser: 1, selected: null, stage: "select" })}
        onBack={toSetup}
        onDeal={() => {
          const game = createGame(
            pregame.players[0],
            pregame.players[1],
            pregame.choices,
            pregame.decks,
            pregame.seed === null ? {} : { seed: pregame.seed },
          );
          setScreen({ kind: "game", game, resumed: false, gameId: game.seed + Date.now() });
          setDeal({ players: pregame.players, decks: pregame.decks, choices: pregame.choices, dealt: 0 });
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
          setScreen({
            kind: "pregame",
            pregame: { ...next, chooser: 0, choices: [null, null], selected: null, stage: "select" },
          });
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
        onLearn={() => setOverlay("lesson")}
        onCredits={() => setOverlay("credits")}
      />
      {overlay === "cards" && <DeckBrowser onClose={() => setOverlay(null)} />}
      {overlay === "lesson" && <LessonExperience onClose={() => setOverlay(null)} />}
      {overlay === "credits" && <Credits onClose={() => setOverlay(null)} />}
    </>
  );
}
