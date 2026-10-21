import {
  type CardInstance,
  type ChoiceOption,
  type ConvergentCategory,
  type DrawEvent,
  type GameAction,
  type GameState,
  geologicalBoundaryOptions,
  getCarnianPluvialOptions,
  getConceptChoiceOptions,
  getHerdOptions,
  getNestingOptions,
  victoryTotals,
} from "../../engine/index.ts";
import { CardBack, CardFace } from "./CardFace.tsx";
import { Dialog } from "./Dialog.tsx";

export type Dispatch = (action: GameAction) => void;

function ChoiceList({ options, onChoose }: { options: ChoiceOption[]; onChoose: (id: string) => void }) {
  return (
    <div className="choice-options">
      {options.map((option) => (
        <button key={option.id} onClick={() => onChoose(option.id)}>
          <strong>{option.label}</strong>
          <span>{option.detail}</span>
        </button>
      ))}
    </div>
  );
}

function ChoiceModal({
  label,
  eyebrow,
  title,
  copy,
  options,
  onChoose,
}: {
  label: string;
  eyebrow: string;
  title: string;
  copy: string;
  options: ChoiceOption[];
  onChoose: (id: string) => void;
}) {
  return (
    <Dialog label={label}>
      <div className="choice-modal">
        <div className="eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
        <p>{copy}</p>
        <ChoiceList options={options} onChoose={onChoose} />
      </div>
    </Dialog>
  );
}

function revealedCards(game: GameState, playerId: 0 | 1, uids: string[]) {
  const deck = game.players[playerId].deck;
  return uids.map((uid) => deck.find((card) => card.uid === uid)).filter((card): card is CardInstance => Boolean(card));
}

function TopTwoModal({
  label,
  eyebrow,
  title,
  copy,
  cards,
  buttonLabel,
  onChoose,
}: {
  label: string;
  eyebrow: string;
  title: string;
  copy: string;
  cards: CardInstance[];
  buttonLabel: string;
  onChoose: (uid: string) => void;
}) {
  return (
    <Dialog label={label} className="biodiversity-overlay">
      <section className="biodiversity-modal">
        <div className="eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
        <p>{copy}</p>
        <div className="biodiversity-choices">
          {cards.map((card) => (
            <button key={card.uid} onClick={() => onChoose(card.uid)}>
              <CardFace card={card.definition} compact />
              <span>{buttonLabel}</span>
            </button>
          ))}
        </div>
      </section>
    </Dialog>
  );
}

export function BiodiversityModal({ game, dispatch }: { game: GameState; dispatch: Dispatch }) {
  const pending = game.pendingBiodiversity!;
  return (
    <TopTwoModal
      label="Biodiversity draw ordering"
      eyebrow="Tropical · Biodiversity"
      title="Choose which card will be drawn first."
      copy="The other card remains on top of your deck beneath it. Any additional Start Phase draw may draw that second card immediately afterward."
      cards={revealedCards(game, pending.playerId, pending.cardUids)}
      buttonLabel="Place first"
      onChoose={(cardUid) => dispatch({ type: "chooseBiodiversityTop", cardUid })}
    />
  );
}

export function FilterFeederModal({ game, dispatch }: { game: GameState; dispatch: Dispatch }) {
  const pending = game.pendingFilterFeeder!;
  const source = game.players[pending.playerId].lanes
    .map((lane) => lane.creature)
    .find((creature) => creature?.card.uid === pending.sourceUid);
  return (
    <TopTwoModal
      label="Filter Feeder deck ordering"
      eyebrow={`${source?.card.definition.name ?? "Filter Feeder"} · Filter Feeder`}
      title="Choose which card remains on top."
      copy="The other card remains directly beneath it. Neither card is drawn by this effect."
      cards={revealedCards(game, pending.playerId, pending.cardUids)}
      buttonLabel="Place on top"
      onChoose={(cardUid) => dispatch({ type: "chooseFilterFeederTop", cardUid })}
    />
  );
}

export function GeologicalBoundaryModal({ game, dispatch }: { game: GameState; dispatch: Dispatch }) {
  return (
    <Dialog label="Declare a Geological Boundary">
      <section className="geological-boundary-modal">
        <div className="eyebrow">Geological Boundary · Instantaneous Event</div>
        <h2>Declare a Time Period.</h2>
        <p>
          All Creatures from that Period will enter History. The immediately succeeding Period receives +1 Battle Level
          until the start of your next turn.
        </p>
        <div className="period-choice-grid">
          {geologicalBoundaryOptions(game).map((period) => (
            <button key={period} onClick={() => dispatch({ type: "chooseGeologicalBoundary", period })}>
              {period}
            </button>
          ))}
        </div>
      </section>
    </Dialog>
  );
}

export function EngulfModal({ game, dispatch }: { game: GameState; dispatch: Dispatch }) {
  const pending = game.pendingEngulf!;
  const holder = game.players[pending.holderPlayer].lanes[pending.holderLane]!.creature;
  const defeated = game.players[pending.defeatedOwner].history.find((card) => card.uid === pending.defeatedUid);
  return (
    <Dialog label="Resolve Engulf">
      <section className="engulf-modal">
        <div className="eyebrow">Engulf · Optional</div>
        <h2>Engulf {defeated?.definition.name ?? "the defeated Creature"}?</h2>
        <p>
          {holder?.card.definition.name ?? "This Creature"} will place it in the Adaptation Slot, gain Engulf’s Victory
          bonus, and become unable to initiate Hunts until that slot is cleared.
        </p>
        <div className="modal-actions">
          <button className="quiet-button" onClick={() => dispatch({ type: "chooseEngulf", accept: false })}>
            Send it to History
          </button>
          <button className="primary-button" onClick={() => dispatch({ type: "chooseEngulf", accept: true })}>
            Engulf Creature
          </button>
        </div>
      </section>
    </Dialog>
  );
}

const CONCEPT_PROMPTS: Record<string, { title: string; copy: string }> = {
  "evolutionary-radiation-card": {
    title: "Choose one effect—or both",
    copy: "Select a Level 0 or Level 1 Creature for a prerequisite you met when this Concept began resolving. After the first play, you may finish or resolve the other effect and skip Battle.",
  },
  "evolutionary-radiation-lane": {
    title: "Choose an empty Niche",
    copy: "If you resolve both effects, the Creatures must use different Niches. Neither play uses your normal Creature play.",
  },
  "whale-fall": {
    title: "Choose the fallen Creature",
    copy: "Send a Level 2 or Level 3 Creature from hand to History.",
  },
  "natural-selection-cost": {
    title: "Pay Natural Selection’s cost",
    copy: "Send one Creature from your hand to History.",
  },
  "natural-selection-search": {
    title: "Search for a Creature",
    copy: "Choose one Creature from your deck, reveal it, and add it to your hand.",
  },
  "genetic-drift-discard": {
    title: "Complete Genetic Drift",
    copy: "Choose one of the five cards just drawn and send it to History.",
  },
  "dig-site": { title: "Excavate a card", copy: "Choose a card from your History Pile to return to your hand." },
  "semelparity-cost": {
    title: "Pay Semelparity’s cost",
    copy: "Choose a Level 0 Creature from hand or your side of the board.",
  },
  "semelparity-replacement-card": {
    title: "Optional Level 0 replacement",
    copy: "Because the Creature you sent to History was in play, you may play a Level 0 Creature from hand without using your normal Creature play. Doing so makes you skip this turn’s Battle Phase.",
  },
  "semelparity-replacement-lane": {
    title: "Choose an empty Niche",
    copy: "Place the Level 0 Creature into an empty, unlocked Niche, or go back and decline the replacement.",
  },
  "obligate-migration-source": {
    title: "Choose a migrating Creature",
    copy: "Select one Creature on either side that has an empty destination on the same side.",
  },
  "obligate-migration-destination": {
    title: "Choose its destination",
    copy: "Select one empty Niche on that Creature’s current side. This move creates no entry trigger.",
  },
  "abiogenesis-mode": {
    title: "Choose one effect",
    copy: "Search your deck for a Level 0 Creature, or place one from your hand and skip this turn’s Battle Phase.",
  },
  "abiogenesis-search": {
    title: "Search for a Level 0 Creature",
    copy: "Choose one Level 0 Creature from your deck, add it to your hand, then shuffle.",
  },
  "abiogenesis-placement-card": {
    title: "Choose a Level 0 Creature from your hand",
    copy: "This placement does not use your normal Creature play and does not end your Development Phase.",
  },
  "abiogenesis-placement-lane": {
    title: "Choose an empty Niche",
    copy: "Place the selected Creature into an empty, unlocked Niche. You must skip your Battle Phase this turn.",
  },
};

export function ConceptChoiceModal({ game, dispatch }: { game: GameState; dispatch: Dispatch }) {
  const pending = game.pendingConceptChoice!;
  const prompt = CONCEPT_PROMPTS[pending.kind] ?? { title: "Make a choice", copy: "" };
  return (
    <ChoiceModal
      label={`${pending.card.definition.name} choice`}
      eyebrow={pending.card.definition.name}
      title={prompt.title}
      copy={prompt.copy}
      options={getConceptChoiceOptions(game)}
      onChoose={(optionId) => dispatch({ type: "chooseConceptOption", optionId })}
    />
  );
}

export function EntryChoiceModal({ game, dispatch }: { game: GameState; dispatch: Dispatch }) {
  const herd = game.pendingHerd;
  const nesting = game.pendingNesting;
  if (herd) {
    return (
      <ChoiceModal
        label="Herd choice"
        eyebrow="Herd"
        title="Choose another Herd Creature"
        copy="You may reveal an eligible Herd Creature from your deck and add it to your hand, or decline the search."
        options={getHerdOptions(game)}
        onChoose={(optionId) => dispatch({ type: "chooseHerd", optionId })}
      />
    );
  }
  const cardStage = nesting?.stage === "card";
  return (
    <ChoiceModal
      label="Nesting choice"
      eyebrow="Nesting"
      title={cardStage ? "Choose a Level 0 Creature" : "Choose an adjacent Niche"}
      copy={
        cardStage
          ? "You may place one Level 0 Creature from your hand with Nesting, or decline and continue your turn."
          : "Place the selected Level 0 in an empty adjacent friendly Niche. Your turn ends after all of its entry effects resolve."
      }
      options={getNestingOptions(game)}
      onChoose={(optionId) => dispatch({ type: "chooseNesting", optionId })}
    />
  );
}

export function CarnianPluvialChoiceModal({ game, dispatch }: { game: GameState; dispatch: Dispatch }) {
  const cost = game.pendingCarnianPluvial!.kind === "cost";
  return (
    <ChoiceModal
      label="Carnian Pluvial Episode choice"
      eyebrow="Carnian Pluvial Episode"
      title={cost ? "Choose the displaced non-Dinosaur" : "Choose a Dinosaur from the deck"}
      copy={
        cost
          ? "Send one highlighted non-Dinosaur Creature you control to its owner’s History Pile."
          : "Find one Dinosaur with Printed Level 2 or lower, reveal it, add it to your hand, then shuffle."
      }
      options={getCarnianPluvialOptions(game)}
      onChoose={(optionId) => dispatch({ type: "chooseCarnianPluvial", optionId })}
    />
  );
}

const CONVERGENT_LABELS: Record<ConvergentCategory, [string, string]> = {
  diet: ["Diet", "Treat the two Diets as matching."],
  period: ["Time Period", "Treat the two Time Periods as matching."],
  taxon: ["Primary Taxon", "Treat the two Primary Taxa as matching."],
};

export function ConvergentChoiceModal({ game, dispatch }: { game: GameState; dispatch: Dispatch }) {
  const pending = game.pendingConvergentChoice!;
  return (
    <ChoiceModal
      label="Convergent Evolution category choice"
      eyebrow="Convergent Evolution"
      title="Choose the supplied third match."
      copy="The shared eligible Tag and one natural non-Tag match are already established. Select one missing category for this override."
      options={pending.categories.map((category) => ({
        id: category,
        label: CONVERGENT_LABELS[category][0],
        detail: CONVERGENT_LABELS[category][1],
      }))}
      onChoose={(category) => dispatch({ type: "chooseConvergentCategory", category: category as ConvergentCategory })}
    />
  );
}

export function HandoffOverlay({
  title,
  detail,
  playerName,
  onContinue,
}: {
  title: string;
  detail: string;
  playerName: string;
  onContinue: () => void;
}) {
  return (
    <Dialog label="Private handoff">
      <div className="handoff-card">
        <div className="handoff-icon">
          <span />
          <span />
          <span />
        </div>
        <div className="eyebrow">Private handoff</div>
        <h2>{title}</h2>
        <p>{detail}</p>
        <div className="handoff-player">
          <small>Next viewer</small>
          <strong>{playerName}</strong>
        </div>
        <button className="primary-button full" onClick={onContinue}>
          I am ready — begin my turn
        </button>
      </div>
    </Dialog>
  );
}

export function WinnerOverlay({ game, onRestart }: { game: GameState; onRestart: () => void }) {
  if (game.winner === null) return null;
  const winner = game.players[game.winner];
  const totals = victoryTotals(game);
  return (
    <Dialog label="Game over" className="winner-overlay">
      <div className="winner-card">
        <div className="eyebrow">Ecosystem established</div>
        <div className="winner-score">{totals[game.winner]}</div>
        <h2>{winner.name} wins</h2>
        <p>{game.winReason}</p>
        <button className="primary-button full" onClick={onRestart}>
          Start another game
        </button>
      </div>
    </Dialog>
  );
}

function findDrawnCard(game: GameState, event: DrawEvent) {
  const player = game.players[event.playerId];
  const laneCards = player.lanes.flatMap((lane) => {
    const cards: Array<CardInstance | null | undefined> = [
      lane.creature?.card,
      lane.attachment,
      lane.engulfed,
      lane.drought?.card,
      lane.wildfire?.card,
    ];
    return cards.filter((card): card is CardInstance => Boolean(card));
  });
  return (
    [...player.hand, ...player.history, ...player.deck, ...(player.event ? [player.event] : []), ...laneCards].find(
      (card) => card.uid === event.cardUid,
    ) ?? null
  );
}

/** A brief animation of a drawn card. The face is shown only to the player who drew it. */
export function DrawPresentation({ game, event }: { game: GameState; event: DrawEvent }) {
  const card = findDrawnCard(game, event);
  const visible = event.playerId === game.activePlayer && !game.handoff;
  return (
    <div className="draw-presentation" role="status" aria-live="polite">
      <section className="drawn-card-stage">
        <small>
          {game.players[event.playerId].name} draws · {event.reason}
        </small>
        <div className="drawn-card-motion">{card && visible ? <CardFace card={card.definition} /> : <CardBack />}</div>
      </section>
    </div>
  );
}
