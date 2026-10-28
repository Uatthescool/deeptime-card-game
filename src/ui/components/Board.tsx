import {
  cardVictoryLevel,
  type CreatureInPlay,
  type GameState,
  nicheIsLocked,
  type PlayerId,
} from "../../engine/index.ts";
import { type InspectionTarget, inspectionHandlers, type PinHandler, type PreviewHandler } from "../inspection.ts";
import type { LaneBadge } from "../legality.ts";

/** Short status markers describing a Creature's temporary state this turn. */
function creatureMarkers(creature: CreatureInPlay, turnNumber: number) {
  const card = creature.card.definition;
  const markers: string[] = [];
  if (creature.enteredTurn === turnNumber && !card.tags.includes("Ambush") && !card.tags.includes("Charge")) {
    markers.push("Entered this turn");
  }
  if (creature.lastAttackTurn === turnNumber) markers.push("Hunt spent");
  if (creature.cannotAttackOnTurn === turnNumber) markers.push("Hunt locked");
  if (creature.cannotOverrideOnTurn === turnNumber) markers.push("Override locked");
  if (creature.burrowedUntilTurn && creature.burrowedUntilTurn > turnNumber) markers.push("Burrowed");
  if (creature.mobFeederBonusTurn === turnNumber) markers.push("Mob Feeder +1 ready");
  if (card.tags.includes("Visual") && creature.visualUsed) markers.push("Visual spent");
  if (creature.deimaticProtectedThroughTurn !== null && creature.deimaticProtectedThroughTurn >= turnNumber) {
    markers.push(`Deimatic through Turn ${creature.deimaticProtectedThroughTurn}`);
  }
  if (creature.bastionDefendedTurn === turnNumber) markers.push("Bastion defense spent");
  if (creature.facultativeMovedTurn === turnNumber) markers.push("Facultative move spent");
  return markers;
}

type BoardCreatureProps = {
  creature: CreatureInPlay;
  lane: number;
  victory: number;
  selected: boolean;
  highlighted: boolean;
  onClick: () => void;
  turnNumber: number;
  attachment?: string;
  onPin: PinHandler;
  onPreview: PreviewHandler;
};

function BoardCreature({
  creature,
  lane,
  victory,
  selected,
  highlighted,
  onClick,
  turnNumber,
  attachment,
  onPin,
  onPreview,
}: BoardCreatureProps) {
  const card = creature.card.definition;
  const markers = creatureMarkers(creature, turnNumber);
  const target: InspectionTarget = {
    definition: card,
    context: [`Niche ${lane}`, `Victory contribution: ${victory}`, ...markers],
    ...(attachment ? { attachment } : {}),
  };

  return (
    <button
      data-tutorial-target="creature"
      className={`board-creature period-${card.period.toLowerCase()} ${selected ? "selected" : ""} ${highlighted ? "legal-target" : ""}`}
      onClick={() => {
        onPin(target);
        onClick();
      }}
      aria-label={`${card.name} in Niche ${lane}${highlighted ? ", available" : ""}`}
      aria-pressed={selected}
      {...inspectionHandlers(target, onPreview, onPin)}
    >
      <span className="board-card-stripe" />
      <span className="board-card-top">
        <small>{card.gameplayTaxon}</small>
        <b>{card.printedLevel}</b>
      </span>
      <strong>{card.name}</strong>
      <span className="board-card-meta">
        {card.diet} · {card.period}
      </span>
      <span className="board-tags">{card.tags.join(" · ")}</span>
      <span className="board-values">
        <i>Victory {victory}</i>
        <i>Level {card.printedLevel}</i>
      </span>
      {markers.length > 0 && <span className="state-markers">{markers.join(" · ")}</span>}
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
  onLaneClick: () => void;
  onPin: PinHandler;
  onPreview: PreviewHandler;
  /** Legality label shown while a card or hunter is selected. */
  badge?: LaneBadge | undefined;
  /** Called when the player points at or focuses this Niche, to explain the move there. */
  onExplain?: (() => void) | undefined;
};

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
  const niche = laneIndex + 1;

  let content;
  if (lane.wildfire) {
    const target: InspectionTarget = {
      definition: lane.wildfire.card.definition,
      context: [
        `Niche ${niche}`,
        "Both sides of this lane are locked.",
        `Expires after Turn ${lane.wildfire.expiresOnTurn}`,
      ],
    };
    content = (
      <button
        className="wildfire-marker"
        onClick={() => onPin(target)}
        {...inspectionHandlers(target, onPreview, onPin)}
      >
        <span>Instantaneous Event</span>
        <strong>Wildfire</strong>
        <small>Lane locked through Turn {lane.wildfire.expiresOnTurn}</small>
      </button>
    );
  } else if (lane.drought) {
    const target: InspectionTarget = {
      definition: lane.drought.card.definition,
      context: [
        `${player.name}'s Niche ${niche}`,
        "Only this Niche is locked.",
        "The directly opposing Niche receives -1 Battle Level and -1 Victory Level.",
        `Expires after Turn ${lane.drought.expiresOnTurn}`,
      ],
    };
    content = (
      <button
        className="drought-marker"
        onClick={() => onPin(target)}
        {...inspectionHandlers(target, onPreview, onPin)}
      >
        <span>Instantaneous Event</span>
        <strong>Drought</strong>
        <small>Niche locked through Turn {lane.drought.expiresOnTurn}</small>
      </button>
    );
  } else if (lane.creature) {
    const attachment = lane.attachment
      ? `${lane.attachment.definition.name}: ${lane.attachment.definition.rules}`
      : lane.engulfed
        ? `Engulfed ${lane.engulfed.definition.name}: contributes no Victory Levels and has no active effects while inside this slot.`
        : undefined;
    content = (
      <BoardCreature
        creature={lane.creature}
        lane={niche}
        victory={cardVictoryLevel(game, lane.creature)}
        selected={selectedAttackerUid === lane.creature.card.uid}
        highlighted={highlighted}
        onClick={onLaneClick}
        turnNumber={game.turnNumber}
        {...(attachment ? { attachment } : {})}
        onPin={onPin}
        onPreview={onPreview}
      />
    );
  } else {
    content = (
      <button
        data-tutorial-target="empty-niche"
        className={`empty-niche ${highlighted ? "legal-target" : ""} ${locked ? "lane-locked" : ""}`}
        onClick={onLaneClick}
        aria-label={`${opponentRow ? "Opponent" : "Your"} Niche ${niche}${locked ? ", locked" : ", empty"}${highlighted ? ", available" : ""}`}
      >
        <span>{locked ? (lane.drought ? "Drought" : "Wildfire") : `Niche ${niche}`}</span>
        <small>{locked ? (lane.drought ? "Niche locked" : "Lane locked") : "Empty"}</small>
      </button>
    );
  }

  const slotTarget: InspectionTarget | null = lane.attachment
    ? { definition: lane.attachment.definition }
    : lane.engulfed
      ? {
          definition: lane.engulfed.definition,
          context: [
            "Engulfed in this Creature's Adaptation Slot.",
            "Its printed effects and Victory Levels are inactive.",
          ],
        }
      : null;
  const slotLabel = lane.attachment
    ? lane.attachment.definition.name
    : lane.engulfed
      ? `Engulfed · ${lane.engulfed.definition.name}`
      : locked
        ? lane.drought
          ? "Niche locked"
          : "Lane locked"
        : "Adaptation";
  const slotClass = `adaptation-slot ${slotTarget ? "occupied" : ""} ${lane.engulfed ? "engulfed" : ""} ${locked ? "lane-locked" : ""}`;

  return (
    <div className="niche-lane" onMouseEnter={onExplain} onFocusCapture={onExplain}>
      {badge && (
        <span className={`lane-badge ${badge.tone}`}>
          <span className="sr-only">Niche {niche}: </span>
          {badge.label}
        </span>
      )}
      {content}
      {slotTarget ? (
        <button
          className={slotClass}
          data-tutorial-target="adaptation-slot"
          onClick={() => onPin(slotTarget)}
          {...inspectionHandlers(slotTarget, onPreview, onPin)}
        >
          {slotLabel}
        </button>
      ) : (
        <div className={slotClass} data-tutorial-target="adaptation-slot">
          {slotLabel}
        </div>
      )}
    </div>
  );
}

type EventZoneProps = { game: GameState; playerId: PlayerId; onPin: PinHandler; onPreview: PreviewHandler };

export function EventZone({ game, playerId, onPin, onPreview }: EventZoneProps) {
  const event = game.players[playerId].event;
  if (!event) {
    return (
      <div className="event-slot">
        <span>Event Zone</span>
        <small>Empty</small>
      </div>
    );
  }
  const target: InspectionTarget = { definition: event.definition };
  return (
    <button
      className="event-slot occupied"
      onClick={() => onPin(target)}
      {...inspectionHandlers(target, onPreview, onPin)}
    >
      <span>{event.definition.name}</span>
      <small>Continuous Event</small>
    </button>
  );
}
