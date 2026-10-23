import { useCallback, useState } from "react";

import {
  type CardDefinition,
  cardFacePath,
  DECK_1,
  DECK_2,
  DECK_2_DECK,
  DECK_2_SUPPORTS,
  DECK_3,
  DECK_3_DECK,
  DECK_3_SUPPORTS,
  DECK_INFO,
  type DeckKey,
  GENERAL_POOL,
} from "../../data/cards.ts";
import { CardFace, CardLightbox } from "./CardFace.tsx";
import { type InspectionTarget, inspectionHandlers, type InspectorTab } from "../inspection.ts";
import { Inspector } from "./Inspector.tsx";

type Section = {
  deck: DeckKey;
  className: string;
  creatures: CardDefinition[];
  supports: CardDefinition[];
  total: number;
};

const SECTIONS: Section[] = [
  {
    deck: "deck-1",
    className: "playable-pool",
    creatures: DECK_1.filter((card) => card.kind === "creature"),
    supports: DECK_1.filter((card) => card.kind !== "creature"),
    total: DECK_1.length,
  },
  {
    deck: "deck-2",
    className: "deck-two-pool",
    creatures: DECK_2,
    supports: DECK_2_SUPPORTS,
    total: DECK_2_DECK.length,
  },
  {
    deck: "deck-3",
    className: "deck-three-pool",
    creatures: DECK_3,
    supports: DECK_3_SUPPORTS,
    total: DECK_3_DECK.length,
  },
];

/** Read-only browser of every deck and the work-in-progress General Pool. */
export function DeckBrowser({ onClose }: { onClose: () => void }) {
  const [pinned, setPinned] = useState<InspectionTarget | null>(null);
  const [hover, setHover] = useState<InspectionTarget | null>(null);
  const [tab, setTab] = useState<InspectorTab>("card");
  // A clicked card with a finished face is also shown enlarged in the middle of the screen.
  const [enlarged, setEnlarged] = useState<CardDefinition | null>(null);
  const closeEnlarged = useCallback(() => setEnlarged(null), []);
  const target = pinned ?? hover ?? { definition: DECK_1[0]! };

  const pin = (next: InspectionTarget) => {
    setPinned(next);
    setHover(null);
    setTab("card");
  };

  const group = (title: string, cards: CardDefinition[]) => (
    <section className="deck-browser-group">
      <header>
        <h2>{title}</h2>
        <span>{cards.length} cards</span>
      </header>
      <div className="deck-browser-grid">
        {cards.map((card) => {
          const inspection = { definition: card };
          const selected = pinned?.definition.key === card.key;
          return (
            <button
              className={`deck-browser-card ${selected ? "selected" : ""}`}
              key={card.key}
              aria-pressed={selected}
              onClick={() => {
                pin(inspection);
                if (cardFacePath(card)) setEnlarged(card);
              }}
              {...inspectionHandlers(
                inspection,
                (next) => {
                  setHover(next);
                  if (!pinned) setTab("card");
                },
                pin,
              )}
            >
              <CardFace card={card} compact />
            </button>
          );
        })}
      </div>
    </section>
  );

  return (
    <div className="deck-browser-overlay" role="dialog" aria-modal="true" aria-label="Inspect cards">
      <div className="deck-browser-shell">
        <section className="deck-browser-list">
          <header className="deck-browser-header">
            <div>
              <div className="eyebrow">Read-only card register</div>
              <h1>Inspect Cards</h1>
            </div>
            <button className="quiet-button" onClick={onClose} autoFocus>
              Return to setup
            </button>
          </header>
          {SECTIONS.map((section) => {
            const info = DECK_INFO[section.deck];
            return (
              <section key={section.deck} className={`pool-section ${section.className}`}>
                <header className="pool-section-header">
                  <div>
                    <small>Playable</small>
                    <h2>
                      Deck {info.number}: {info.name}
                    </h2>
                    <p>{info.summary} A complete 40-card singleton deck; either player may select it during setup.</p>
                  </div>
                  <span>{section.total} cards</span>
                </header>
                {group(`Deck ${info.number} Creatures`, section.creatures)}
                {group(`Deck ${info.number} Supports`, section.supports)}
              </section>
            );
          })}
          <section className="pool-section general-pool">
            <header className="pool-section-header">
              <div>
                <small>Not playable · Work in progress</small>
                <h2>General Pool</h2>
                <p>
                  Candidate cards outside the three playable decks. They are available for inspection but never enter
                  either player’s deck.
                </p>
              </div>
              <span>{GENERAL_POOL.length} cards</span>
            </header>
            {group("Candidate cards outside playable decks", GENERAL_POOL)}
          </section>
        </section>
        <aside className="deck-browser-sidewall">
          <Inspector target={target} activeTab={tab} onTabChange={setTab} onClose={onClose} pinned={Boolean(pinned)} />
        </aside>
      </div>
      {enlarged && <CardLightbox card={enlarged} onClose={closeEnlarged} />}
    </div>
  );
}
