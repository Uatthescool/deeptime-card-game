import { useState } from "react";

import {
  CARD_LIBRARY,
  DECK_INFO,
  DECK_KEYS,
  DECK_LABELS,
  type DeckKey,
  IMPLEMENTATION_REGISTER,
} from "../../data/cards.ts";
import { parseSeedLabel } from "../../engine/index.ts";
import type { SavedGameSummary } from "../save.ts";
import { CardFace } from "./CardFace.tsx";

export type SetupChoices = { players: [string, string]; decks: [DeckKey, DeckKey]; seed: number | null };

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
  const [seedText, setSeedText] = useState("");
  const seed = seedText.trim() ? parseSeedLabel(seedText) : null;
  const seedInvalid = Boolean(seedText.trim()) && seed === null;

  const setName = (index: 0 | 1, value: string) =>
    setNames((current) => (index === 0 ? [value, current[1]] : [current[0], value]));
  const setDeck = (index: 0 | 1, value: DeckKey) =>
    setDecks((current) => (index === 0 ? [value, current[1]] : [current[0], value]));

  const start = () =>
    onStart({
      players: [names[0].trim() || "Player One", names[1].trim() || "Player Two"],
      decks,
      seed,
    });

  return (
    <main className="setup-page">
      <section className="setup-shell">
        <div className="eyebrow">
          A two-player card game of evolution · Rules revision {IMPLEMENTATION_REGISTER.version}
        </div>
        <h1>Lineage</h1>
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
          <div className="setup-grid">
            {([0, 1] as const).map((index) => (
              <label key={index}>
                <span>Player {index === 0 ? "one" : "two"}</span>
                <input
                  value={names[index]}
                  onChange={(event) => setName(index, event.target.value)}
                  maxLength={24}
                  autoComplete="off"
                />
                <select
                  aria-label={`Player ${index === 0 ? "one" : "two"} deck`}
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
          <span>2 players · one device</span>
          <span>Choose any 40-card deck independently</span>
          <span>Hands hidden on handoff</span>
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
