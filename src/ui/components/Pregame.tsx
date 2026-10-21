import { biomeByKey, BIOMES, type BiomeKey } from "../../data/biomes.ts";
import { DECK_LABELS, type DeckKey } from "../../data/cards.ts";
import type { PlayerId } from "../../engine/index.ts";
import { CardBack } from "./CardFace.tsx";

export type PregameState = {
  players: [string, string];
  decks: [DeckKey, DeckKey];
  seed: number | null;
  chooser: PlayerId;
  choices: [BiomeKey | null, BiomeKey | null];
  selected: BiomeKey | null;
  stage: "select" | "handoff" | "reveal";
};

type BiomePanelProps = { biomeKey: BiomeKey; selected: boolean; onSelect?: () => void };

export function BiomePanel({ biomeKey, selected, onSelect }: BiomePanelProps) {
  const biome = biomeByKey(biomeKey);
  return (
    <article className={`biome-panel biome-${biome.key} ${selected ? "selected" : ""}`}>
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

type BiomePregameProps = {
  state: PregameState;
  onSelect: (biome: BiomeKey) => void;
  onConfirm: () => void;
  onContinue: () => void;
  onDeal: () => void;
  onBack: () => void;
};

/** Each player privately picks a Biome; both are revealed before opening hands are dealt. */
export function BiomePregame({ state, onSelect, onConfirm, onContinue, onDeal, onBack }: BiomePregameProps) {
  if (state.stage === "handoff") {
    return (
      <main className="biome-pregame biome-handoff-screen">
        <section className="biome-handoff-card">
          <div className="eyebrow">Biome choice sealed</div>
          <h1>Pass to {state.players[1]}</h1>
          <p>{state.players[0]}’s selection will remain hidden until both players have chosen.</p>
          <button className="primary-button" onClick={onContinue} autoFocus>
            I am {state.players[1]} — choose my Biome
          </button>
        </section>
      </main>
    );
  }

  if (state.stage === "reveal") {
    return (
      <main className="biome-pregame biome-reveal-screen">
        <header className="biome-selection-header">
          <div>
            <div className="eyebrow">Selections revealed</div>
            <h1>The ecosystems are set.</h1>
          </div>
          <p>Opening hands will now be dealt one card at a time.</p>
        </header>
        <section className="biome-reveal-grid">
          {state.choices.map((choice, playerId) =>
            choice ? (
              <article key={playerId} className={`biome-reveal-choice biome-${choice}`}>
                <small>{state.players[playerId as PlayerId]}</small>
                <h2>{biomeByKey(choice).name}</h2>
                <span className="revealed-deck">{DECK_LABELS[state.decks[playerId as PlayerId]]}</span>
                <strong>{biomeByKey(choice).abilityName}</strong>
                <p>{biomeByKey(choice).shortRules}</p>
              </article>
            ) : null,
          )}
        </section>
        <button className="primary-button biome-deal-button" onClick={onDeal} autoFocus>
          Draw opening hands
        </button>
      </main>
    );
  }

  return (
    <main className="biome-pregame biome-selection-screen">
      <header className="biome-selection-header">
        <div>
          <div className="eyebrow">Pregame · private selection</div>
          <h1>{state.players[state.chooser]}, choose a Biome.</h1>
        </div>
        <p>
          Your Biome changes the rules for your side of the ecosystem. Both selections are revealed before either
          opening hand is drawn.
        </p>
      </header>
      <section className="biome-panel-grid">
        {BIOMES.map((biome) => (
          <BiomePanel
            key={biome.key}
            biomeKey={biome.key}
            selected={state.selected === biome.key}
            onSelect={() => onSelect(biome.key)}
          />
        ))}
      </section>
      <footer className="biome-selection-footer">
        <span>
          {state.selected
            ? `${biomeByKey(state.selected).name} · ${biomeByKey(state.selected).abilityName}`
            : "Choose one of the five Biomes."}
        </span>
        <div className="biome-footer-actions">
          {state.chooser === 0 && (
            <button className="quiet-button" onClick={onBack}>
              Back to setup
            </button>
          )}
          <button className="primary-button" disabled={!state.selected} onClick={onConfirm}>
            Confirm selection
          </button>
        </div>
      </footer>
    </main>
  );
}

type OpeningDealProps = {
  players: [string, string];
  decks: [DeckKey, DeckKey];
  choices: [BiomeKey | null, BiomeKey | null];
  dealt: number;
};

export function OpeningDealOverlay({ players, decks, choices, dealt }: OpeningDealProps) {
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
                {players[playerId]} · {DECK_LABELS[decks[playerId]]}
                {choices[playerId] ? ` · ${biomeByKey(choices[playerId]).name}` : ""}
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
