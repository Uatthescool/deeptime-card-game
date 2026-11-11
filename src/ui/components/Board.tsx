import type { CSSProperties } from "react";

import { artworkPath, type CardDefinition, type CreatureCard } from "../../data/cards.ts";
import { FACE_CROPS } from "../../data/face-crops.ts";
import {
  type CreatureInPlay,
  type GameState,
  liveBattlePower,
  nicheIsFrozen,
  nicheIsLocked,
  type PlayerId,
  victoryBreakdown,
} from "../../engine/index.ts";
import { assetUrl } from "../assets.ts";
import { type InspectionTarget, inspectionHandlers, type PinHandler, type PreviewHandler } from "../inspection.ts";
import type { LaneBadge } from "../legality.ts";
import { creatureMarkers, isBurrowed } from "../creatureStates.ts";

/** The close-up of a Creature's head, cropped from its artwork, or "No art". */
export function FaceArt({ card }: { card: CreatureCard }) {
  const crop = FACE_CROPS[card.key];
  const artwork = artworkPath(card);
  if (!crop || !artwork) {
    return (
      <span className="tbl-face no-art">
        <span>No art</span>
      </span>
    );
  }
  return (
    <span className="tbl-face">
      <img
        src={assetUrl(artwork)}
        alt=""
        draggable={false}
        decoding="async"
        style={{ width: `${100 / crop.w}%`, transform: `translate(-${crop.x * 100}%, -${crop.y * 100}%)` }}
      />
    </span>
  );
}

const periodTexture = (period: string) => ({
  backgroundImage: `url("${assetUrl(`/period-textures/${period.toLowerCase()}.webp`)}")`,
});

type BoardCardProps = {
  game: GameState;
  creature: CreatureInPlay;
  frozen: boolean;
  niche: number;
  selected: boolean;
  highlighted: boolean;
  onClick: () => boolean;
  onPreview: PreviewHandler;
  onPin: PinHandler;
};

/** A Creature in play: name, Diet, a close-up of its face, Printed Level and live Battle Power. */
function BoardCard({
  game,
  creature,
  frozen,
  niche,
  selected,
  highlighted,
  onClick,
  onPreview,
  onPin,
}: BoardCardProps) {
  const card = creature.card.definition;
  const victory = victoryBreakdown(game, creature).value;
  const live = liveBattlePower(game, creature.card.uid);
  const markers = creatureMarkers(creature, game.turnNumber);
  const burrowed = isBurrowed(creature, game.turnNumber);
  const target: InspectionTarget = { definition: card, uid: creature.card.uid };
  const shift = victory > card.printedLevel ? "+" : victory < card.printedLevel ? "−" : "";

  return (
    <button
      data-tutorial-target="creature"
      className={`tbl-card ${selected ? "selected" : ""} ${highlighted ? "legal-target" : ""}`}
      style={periodTexture(card.period)}
      onClick={() => {
        const acted = onClick();
        if (!acted) onPin(target);
      }}
      aria-label={`${card.name} in Niche ${niche}${highlighted ? ", available" : ""}`}
      aria-pressed={selected}
      {...inspectionHandlers(target, onPreview, onPin)}
    >
      <span className="tbl-card-name" style={{ "--name-length": card.name.length } as CSSProperties}>
        {card.name}
      </span>
      <span className="tbl-card-diet" aria-label={card.diet}>
        <img src={assetUrl(`/icons/diet-${card.diet.toLowerCase()}.webp`)} alt="" draggable={false} />
      </span>
      <FaceArt card={card} />
      <span className="tbl-card-level" aria-label={`Level ${card.printedLevel}, ${victory} Victory`}>
        <span className="tbl-level-number">{card.printedLevel}</span>
        {shift && <sup>{shift}</sup>}
      </span>
      <span className="tbl-card-power" aria-label={`${live?.power ?? 0} Battle Power`}>
        {live?.power ?? 0}
      </span>
      {markers.length > 0 && (
        <span className="tbl-card-markers">
          {markers.map((marker) => (
            <i key={marker.key} title={marker.title}>
              {marker.icon}
            </i>
          ))}
        </span>
      )}
      {burrowed && <span className="tbl-state burrowed" aria-label="Burrowed" />}
      {frozen && <span className="tbl-state frozen" aria-label="Frozen" />}
    </button>
  );
}

type NicheLaneProps = {
  game: GameState;
  playerId: PlayerId;
  laneIndex: number;
  opponentRow: boolean;
  selectedAttackerUid: string | null;
  highlighted: boolean;
  /** Returns true when the click took a game action. */
  onLaneClick: () => boolean;
  onPin: PinHandler;
  onPreview: PreviewHandler;
  /** Legality label shown while a card or hunter is selected. */
  badge?: LaneBadge | undefined;
  /** Called when the player points at or focuses this Niche, to explain the move there. */
  onExplain?: (() => void) | undefined;
};

/** One Niche: its Creature (or what locks it) and its Adaptation slot, on the side away from the centre line. */
export function NicheLane({
  game,
  playerId,
  laneIndex,
  opponentRow,
  selectedAttackerUid,
  highlighted,
  onLaneClick,
  onPin,
  onPreview,
  badge,
  onExplain,
}: NicheLaneProps) {
  const player = game.players[playerId];
  const lane = player.lanes[laneIndex]!;
  const locked = nicheIsLocked(game, playerId, laneIndex);
  const frozen = nicheIsFrozen(lane);
  const niche = laneIndex + 1;

  let content;
  if (lane.wildfire) {
    const target: InspectionTarget = {
      definition: lane.wildfire.card.definition,
      context: [`Both sides of this lane are locked through Turn ${lane.wildfire.expiresOnTurn}.`],
    };
    content = (
      <button
        className="tbl-niche tbl-lock wildfire"
        onClick={onLaneClick}
        aria-label={`Niche ${niche}: Wildfire, locked through Turn ${lane.wildfire.expiresOnTurn}`}
        {...inspectionHandlers(target, onPreview, onPin)}
      >
        <span className="tbl-flames" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <strong>Wildfire</strong>
      </button>
    );
  } else if (lane.drought) {
    const target: InspectionTarget = {
      definition: lane.drought.card.definition,
      context: [
        `This Niche is locked through Turn ${lane.drought.expiresOnTurn}.`,
        "The Creature directly opposite gets -100 Battle Power and contributes 1 less Victory Level.",
      ],
    };
    content = (
      <button
        className="tbl-niche tbl-lock drought"
        onClick={onLaneClick}
        aria-label={`Niche ${niche}: Drought, locked through Turn ${lane.drought.expiresOnTurn}`}
        {...inspectionHandlers(target, onPreview, onPin)}
      >
        <span className="tbl-cracks" aria-hidden="true" />
        <strong>Drought</strong>
      </button>
    );
  } else if (lane.creature) {
    content = (
      <BoardCard
        game={game}
        creature={lane.creature}
        frozen={frozen}
        niche={niche}
        selected={selectedAttackerUid === lane.creature.card.uid}
        highlighted={highlighted}
        onClick={onLaneClick}
        onPreview={onPreview}
        onPin={onPin}
      />
    );
  } else {
    content = (
      <button
        data-tutorial-target="empty-niche"
        className={`tbl-niche empty ${highlighted ? "legal-target" : ""} ${locked ? "locked" : ""}`}
        onClick={onLaneClick}
        aria-label={`${opponentRow ? "Opponent" : "Your"} Niche ${niche}${locked ? ", locked" : ", empty"}${highlighted ? ", available" : ""}`}
      >
        <span>Niche {niche}</span>
        {frozen && <span className="tbl-state frozen" aria-hidden="true" />}
      </button>
    );
  }

  const slotCard: CardDefinition | null = lane.attachment?.definition ?? lane.engulfed?.definition ?? null;
  const slotTarget: InspectionTarget | null = lane.attachment
    ? { definition: lane.attachment.definition }
    : lane.engulfed
      ? {
          definition: lane.engulfed.definition,
          context: ["Engulfed: its printed effects and Victory Levels are inactive while it stays in this slot."],
        }
      : null;
  const slot = (
    <div
      className={`tbl-slot ${slotCard ? "occupied" : ""} ${lane.engulfed ? "engulfed" : ""}`}
      data-tutorial-target="adaptation-slot"
      {...(slotTarget ? inspectionHandlers(slotTarget, onPreview, onPin) : {})}
    >
      {lane.engulfed && <span className="tbl-engulf-bubble" aria-hidden="true" />}
      <span>{slotCard ? (lane.engulfed ? `Engulfed · ${slotCard.name}` : slotCard.name) : "Adaptation"}</span>
    </div>
  );

  return (
    <div
      className={`tbl-lane ${opponentRow ? "opponent" : "own"} ${highlighted ? "legal-target" : ""}`}
      data-drop-player={playerId}
      data-drop-lane={laneIndex}
      onMouseEnter={onExplain}
      onFocusCapture={onExplain}
    >
      {opponentRow && slot}
      <div className="tbl-niche-wrap">
        {badge && (
          <span className={`lane-badge ${badge.tone}`}>
            <span className="sr-only">Niche {niche}: </span>
            {badge.label}
          </span>
        )}
        {content}
      </div>
      {!opponentRow && slot}
    </div>
  );
}

type EventZoneProps = { game: GameState; playerId: PlayerId; onPin: PinHandler; onPreview: PreviewHandler };

/** A player's Event Zone, turned sideways: their Continuous Event's art alone; the full card shows on hover. */
export function EventZone({ game, playerId, onPin, onPreview }: EventZoneProps) {
  const event = game.players[playerId].event;
  if (!event) {
    return (
      <div className="tbl-pile tbl-event empty">
        <span>Event</span>
      </div>
    );
  }
  const target: InspectionTarget = { definition: event.definition };
  const artwork = artworkPath(event.definition);
  return (
    <button
      className="tbl-pile tbl-event"
      aria-label={`Event Zone: ${event.definition.name}`}
      onClick={() => onPin(target)}
      {...inspectionHandlers(target, onPreview, onPin)}
    >
      {artwork ? (
        <img src={assetUrl(artwork)} alt="" draggable={false} decoding="async" />
      ) : (
        <span className="tbl-event-name">{event.definition.name}</span>
      )}
    </button>
  );
}
