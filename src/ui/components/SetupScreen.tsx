import { useState } from "react";

import {
  CARD_LIBRARY,
  DECK_INFO,
  DECK_KEYS,
  DECK_LABELS,
  type DeckKey,
  IMPLEMENTATION_REGISTER,
} from "../../data/cards.ts";
import { DIFFICULTY_NAMES } from "../../ai/ai.ts";
import { type Difficulty, parseSeedLabel } from "../../engine/index.ts";
import type { SavedGameSummary } from "../save.ts";
import { CardFace } from "./CardFace.tsx";

/** Who plays the second seat: another person at the same device, or the computer at a difficulty. */
export type Opponent = "person" | Difficulty;

export type SetupChoices = {
  players: [string, string];
  decks: [DeckKey, DeckKey];
  seed: number | null;
  opponent: Opponent;
};

const OPPONENTS: Array<{ value: Opponent; label: string; detail: string }> = [
  { value: "person", label: "Another person", detail: "Pass the device between turns" },
  { value: "easy", label: `Computer · ${DIFFICULTY_NAMES.easy}`, detail: "Learning the game" },
  { value: "normal", label: `Computer · ${DIFFICULTY_NAMES.normal}`, detail: "A real contest" },
];

type SetupScreenProps = {
  initial: SetupChoices;
  savedGame: SavedGameSummary | null;
  onStart: (choices: SetupChoices) => void;
  onResume: () => void;
  onDiscardSave: () => void;
  onInspectCards: () => void;
  onLearn: () => void;
  onCredits: () => void;
};

const featured = CARD_LIBRARY.get("nautilus");

export function SetupScreen({
  initial,
  savedGame,
  onStart,
  onResume,
  onDiscardSave,
  onInspectCards,
  onLearn,
  onCredits,
}: SetupScreenProps) {
  const [names, setNames] = useState(initial.players);
  const [decks, setDecks] = useState(initial.decks);
  const [opponent, setOpponent] = useState<Opponent>(initial.opponent);
  const vsComputer = opponent !== "person";
  const [seedText, setSeedText] = useState("");
  const seed = seedText.trim() ? parseSeedLabel(seedText) : null;
  const seedInvalid = Boolean(seedText.trim()) && seed === null;

  const setName = (index: 0 | 1, value: string) =>
    setNames((current) => (index === 0 ? [value, current[1]] : [current[0], value]));
  const setDeck = (index: 0 | 1, value: DeckKey) =>
    setDecks((current) => (index === 0 ? [value, current[1]] : [current[0], value]));

  const start = () =>
    onStart({
      players: [names[0].trim() || "Player One", vsComputer ? "Computer" : names[1].trim() || "Player Two"],
      decks,
      seed,
      opponent,
    });

  return (
    <main className="setup-page">
      <section className="setup-shell">
        <div className="eyebrow">
          A two-player card game of evolution · Rules revision {IMPLEMENTATION_REGISTER.version}
        </div>
        <h1>
          Deep
          <br />
          <span>Time</span>
        </h1>
        <p className="setup-copy">
          Build an ecosystem across five Niches, replace its occupants through shared traits, and reach 12 Victory
          Levels before your rival.
        </p>

        {savedGame && (
          <section className="resume-banner" aria-label="Saved game">
            <div>
              <small>Game in progress</small>
              <strong>
                {savedGame.players[0]} vs. {savedGame.players[1]} · Turn {savedGame.turnNumber}
              </strong>
            </div>
            <div className="resume-actions">
              <button className="primary-button" onClick={onResume}>
                Resume
              </button>
              <button className="text-button" onClick={onDiscardSave}>
                Discard
              </button>
            </div>
          </section>
        )}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!seedInvalid) start();
          }}
        >
          <fieldset className="opponent-choice">
            <legend>Opponent</legend>
            {OPPONENTS.map((option) => (
              <label key={option.value} className={opponent === option.value ? "selected" : ""}>
                <input
                  type="radio"
                  name="opponent"
                  value={option.value}
                  checked={opponent === option.value}
                  onChange={() => setOpponent(option.value)}
                />
                <strong>{option.label}</strong>
                <small>{option.detail}</small>
              </label>
            ))}
          </fieldset>
          <div className="setup-grid">
            {([0, 1] as const).map((index) => (
              <label key={index}>
                <span>
                  {index === 0 ? (vsComputer ? "You" : "Player one") : vsComputer ? "Computer" : "Player two"}
                </span>
                {index === 1 && vsComputer ? (
                  <input value="Computer" readOnly aria-readonly="true" tabIndex={-1} className="computer-name" />
                ) : (
                  <input
                    value={names[index]}
                    onChange={(event) => setName(index, event.target.value)}
                    maxLength={24}
                    autoComplete="off"
                  />
                )}
                <select
                  aria-label={`${index === 0 ? (vsComputer ? "Your" : "Player one") : vsComputer ? "Computer" : "Player two"} deck`}
                  value={decks[index]}
                  onChange={(event) => setDeck(index, event.target.value as DeckKey)}
                >
                  {DECK_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {DECK_LABELS[key]}
                    </option>
                  ))}
                </select>
                <small className="deck-summary">{DECK_INFO[decks[index]].summary}</small>
              </label>
            ))}
          </div>
          <details className="setup-advanced">
            <summary>Advanced</summary>
            <label>
              <span>Game seed</span>
              <input
                value={seedText}
                onChange={(event) => setSeedText(event.target.value)}
                placeholder="Random"
                maxLength={7}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={seedInvalid}
                aria-describedby="seed-help"
              />
            </label>
            <p id="seed-help">
              {seedInvalid
                ? "Seeds are up to seven letters and digits."
                : "Enter a seed from a previous game’s log to replay the same shuffle and coin flips."}
            </p>
          </details>
          <div className="setup-actions">
            <button className="primary-button" type="submit" disabled={seedInvalid}>
              Continue to Biomes
            </button>
            <button className="quiet-button" type="button" onClick={onInspectCards}>
              Inspect Cards
            </button>
            <button className="learn-something-button" type="button" onClick={onLearn}>
              <span>Learn Something</span>
              <small>Open a random Lesson</small>
            </button>
          </div>
        </form>
        <div className="setup-foot">
          <span>Created by Merrick McMorris</span>
          <span>{vsComputer ? "1 player vs. the computer" : "2 players · one device"}</span>
          <span>Choose any 40-card deck independently</span>
          <span>{vsComputer ? "The computer never sees your hand" : "Hands hidden on handoff"}</span>
          <button className="link-button" type="button" onClick={onCredits}>
            Artwork credits
          </button>
        </div>
      </section>
      <aside className="sample-card-wrap" aria-hidden="true">
        {featured && <CardFace card={featured} />}
      </aside>
    </main>
  );
}
