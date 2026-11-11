import { type CSSProperties, type PointerEvent as ReactPointerEvent, useRef, useState } from "react";

import type { CardInstance, Verdict } from "../../engine/index.ts";
import { type DropTarget, dropTargetAt } from "../dropTarget.ts";
import { endHold, type InspectionTarget, type PinHandler, type PreviewHandler, startHold } from "../inspection.ts";
import { CardBack, CardFace } from "./CardFace.tsx";

/** Pixels a press must travel before it becomes a drag rather than a click. */
const DRAG_THRESHOLD = 8;

/** The offset, tilt and lift of card `index` of `count` in a fanned hand. */
function fanStyle(index: number, count: number, raised: boolean): CSSProperties {
  const middle = (count - 1) / 2;
  const offset = index - middle;
  // Cards overlap more as the hand grows, so ten still fit across the table.
  const spread = count <= 1 ? 0 : Math.min(62, 380 / (count - 1));
  return {
    "--fan-x": `${offset * spread}%`,
    "--fan-rotate": `${offset * (count > 6 ? 2.6 : 3.6)}deg`,
    "--fan-drop": `${Math.abs(offset) ** 1.7 * 1.4}%`,
    zIndex: raised ? 50 : index + 1,
  } as CSSProperties;
}

type HandProps = {
  cards: CardInstance[];
  verdicts: Map<string, Verdict> | null;
  selectedUid: string | null;
  /** Cards still flying in from the deck: drawn but not yet shown. */
  hiddenUids: ReadonlySet<string>;
  onSelect: (card: CardInstance) => void;
  onDragStart: (card: CardInstance) => void;
  onDragOver: (target: DropTarget | null) => void;
  onDrop: (card: CardInstance, target: DropTarget | null) => void;
  onPreview: PreviewHandler;
  onPin: PinHandler;
  /** True while the person may not play (the computer's turn): cards can be read but not dragged. */
  readOnly: boolean;
};

type Drag = { card: CardInstance; x: number; y: number };

/** The person's hand: overlapping cards in an arc. Drag one onto the board to play it, or click it to choose it. */
export function Hand({
  cards,
  verdicts,
  selectedUid,
  hiddenUids,
  onSelect,
  onDragStart,
  onDragOver,
  onDrop,
  onPreview,
  onPin,
  readOnly,
}: HandProps) {
  const press = useRef<{ card: CardInstance; x: number; y: number; pointer: string; dragging: boolean } | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [raisedUid, setRaisedUid] = useState<string | null>(null);

  const begin = (event: ReactPointerEvent, card: CardInstance) => {
    if (event.button !== 0) return;
    press.current = { card, x: event.clientX, y: event.clientY, pointer: event.pointerType, dragging: false };
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    if (event.pointerType !== "mouse") startHold({ definition: card.definition }, onPreview);
  };
  const move = (event: ReactPointerEvent) => {
    const current = press.current;
    if (!current) return;
    if (!current.dragging) {
      if (Math.hypot(event.clientX - current.x, event.clientY - current.y) < DRAG_THRESHOLD || readOnly) return;
      current.dragging = true;
      endHold(onPreview);
      onDragStart(current.card);
    }
    setDrag({ card: current.card, x: event.clientX, y: event.clientY });
    onDragOver(dropTargetAt(event.clientX, event.clientY));
  };
  const end = (event: ReactPointerEvent) => {
    const current = press.current;
    press.current = null;
    if (!current) return;
    if (current.pointer !== "mouse") endHold(onPreview);
    if (current.dragging) {
      setDrag(null);
      onDrop(current.card, dropTargetAt(event.clientX, event.clientY));
    } else {
      onSelect(current.card);
    }
  };
  const cancel = () => {
    if (press.current?.dragging) onDrop(press.current.card, null);
    press.current = null;
    setDrag(null);
    endHold(onPreview);
  };

  const visible = cards.filter((card) => !hiddenUids.has(card.uid));
  return (
    <>
      <div className="tbl-hand-fan">
        {visible.map((card, index) => {
          const verdict = verdicts?.get(card.uid);
          const blocked = verdict && !verdict.legal ? verdict.reasons[0]?.text : undefined;
          const target: InspectionTarget = { definition: card.definition };
          const raised = raisedUid === card.uid || selectedUid === card.uid;
          return (
            <button
              key={card.uid}
              className={`tbl-hand-card ${blocked ? "unplayable" : ""} ${raised ? "raised" : ""} ${drag?.card.uid === card.uid ? "dragging" : ""}`}
              style={fanStyle(index, visible.length, raised)}
              aria-pressed={selectedUid === card.uid}
              aria-description={blocked ? `Can't play now: ${blocked}` : undefined}
              title={blocked ? `Can't play now: ${blocked}` : undefined}
              data-inspection-card
              onPointerDown={(event) => begin(event, card)}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={cancel}
              onMouseEnter={() => {
                setRaisedUid(card.uid);
                if (!drag) onPreview(target);
              }}
              onMouseLeave={() => {
                setRaisedUid(null);
                onPreview(null);
              }}
              onFocus={() => onPreview(target)}
              onBlur={() => onPreview(null)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(card);
                }
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                if (press.current?.pointer !== "touch") onPin(target, true);
              }}
            >
              <CardFace card={card.definition} compact selected={selectedUid === card.uid} />
              {blocked && <span className="hand-card-note">Can't play now</span>}
            </button>
          );
        })}
      </div>
      {drag && (
        <div className="tbl-drag-ghost" style={{ left: drag.x, top: drag.y }} aria-hidden="true">
          <CardFace card={drag.card.definition} compact />
        </div>
      )}
    </>
  );
}

/** The covered hand at a handoff, or the opponent's hand: card backs in an arc. */
export function CardBackFan({ count, className }: { count: number; className: string }) {
  return (
    <div className={`tbl-hand-fan backs ${className}`} aria-label={`${count} cards in hand`}>
      {Array.from({ length: count }, (_, index) => (
        <span key={index} className="tbl-hand-card back" style={fanStyle(index, count, false)}>
          <CardBack />
        </span>
      ))}
    </div>
  );
}
