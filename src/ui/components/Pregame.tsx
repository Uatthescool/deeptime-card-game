import { biomeByKey, type BiomeKey } from "../../data/biomes.ts";
import { DECK_LABELS, deckBiome, type DeckKey } from "../../data/cards.ts";
import { CardBack } from "./CardFace.tsx";
import type { Opponent } from "./SetupScreen.tsx";

export type PregameState = {
  players: [string, string];
  decks: [DeckKey, DeckKey];
  seed: number | null;
  opponent: Opponent;
};

type BiomePanelProps = { biomeKey: BiomeKey; selected: boolean; onSelect?: () => void };

export function BiomePanel({ biomeKey, selected, onSelect }: BiomePanelProps) {
  const biome = biomeByKey(biomeKey);
  return (
    <article
      className={`biome-panel biome-${biome.key} ${selected ? "selected" : ""}`}
      data-tutorial-target={`biome-${biome.key}`}
    >
      <header>
        <small>Biome</small>
        <h2>{biome.name}</h2>
      </header>
      <section className="biome-subtypes">
        <h3>Represented environments</h3>
        <ul>
          {biome.subBiomes.map((entry) => (
            <li key={entry}>{entry}</li>
          ))}
        </ul>
      </section>
      <section className="biome-ability-copy">
        <h3>{biome.abilityName}</h3>
        <p>{biome.rules}</p>
      </section>
      <p className="biome-flavor">
        <i>{biome.flavor}</i>
      </p>
      {onSelect && (
        <button className={selected ? "primary-button" : "quiet-button"} aria-pressed={selected} onClick={onSelect}>
          {selected ? "Selected" : `Choose ${biome.name}`}
        </button>
      )}
    </article>
  );
}

type BiomeRevealProps = { state: PregameState; onDeal: () => void; onBack: () => void };

/** Before the deal: each player's Biome, which comes with their deck, shown side by side. */
export function BiomeReveal({ state, onDeal, onBack }: BiomeRevealProps) {
  return (
    <main className="biome-pregame biome-reveal-screen">
      <header className="biome-selection-header">
        <div>
          <div className="eyebrow">Pregame · Biomes</div>
          <h1>The ecosystems are set.</h1>
        </div>
        <p>
          Each deck comes with its own Biome, which changes the rules on its player’s side for the whole game. Opening
          hands are dealt next, one card at a time.
        </p>
      </header>
      <section className="biome-reveal-grid" data-tutorial-target="biome-grid">
        {([0, 1] as const).map((playerId) => (
          <div key={playerId} className="biome-reveal-seat">
            <small>
              {state.players[playerId]} · {DECK_LABELS[state.decks[playerId]]}
            </small>
            <BiomePanel biomeKey={deckBiome(state.decks[playerId])} selected={false} />
          </div>
        ))}
      </section>
      <footer className="biome-selection-footer" data-tutorial-target="biome-deal">
        <span>Both players can read each other’s Biome before the deal.</span>
        <div className="biome-footer-actions">
          <button className="quiet-button" onClick={onBack}>
            Back to setup
          </button>
          <button className="primary-button" onClick={onDeal} autoFocus>
            Draw opening hands
          </button>
        </div>
      </footer>
    </main>
  );
}

type OpeningDealProps = { players: [string, string]; decks: [DeckKey, DeckKey]; dealt: number };

export function OpeningDealOverlay({ players, decks, dealt }: OpeningDealProps) {
  const counts: [number, number] = [Math.min(5, Math.ceil(dealt / 2)), Math.min(5, Math.floor(dealt / 2))];
  return (
    <div
      className="screen-overlay opening-deal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Drawing opening hands"
    >
      <section className="opening-deal-card">
        <div className="eyebrow">Opening draw</div>
        <h2>Dealing one card at a time</h2>
        <div className="opening-deal-players">
          {([0, 1] as const).map((playerId) => (
            <article key={playerId}>
              <small>
                {players[playerId]} · {DECK_LABELS[decks[playerId]]} · {biomeByKey(deckBiome(decks[playerId])).name}
              </small>
              <div className="opening-card-stack" aria-label={`${counts[playerId]} of 5 cards dealt`}>
                {Array.from({ length: counts[playerId] }, (_, index) => (
                  <CardBack key={index} />
                ))}
              </div>
              <strong>{counts[playerId]} / 5</strong>
            </article>
          ))}
        </div>
        <p>Both hands remain private until the first-player handoff.</p>
      </section>
    </div>
  );
}
