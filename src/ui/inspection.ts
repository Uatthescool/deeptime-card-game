import type { MouseEvent, PointerEvent } from "react";

import type { CardDefinition } from "../data/cards.ts";

/** A card shown in the inspector, with optional live board context. */
export type InspectionTarget = {
  definition: CardDefinition;
  context?: string[];
  attachment?: string;
  /** The Creature in play this card is, so its blow-up can show live Victory, Battle Power and states. */
  uid?: string;
};

export type InspectorTab = "card" | "tags" | "state" | "log" | "history";

export type PinHandler = (target: InspectionTarget, openInspector?: boolean) => void;
export type PreviewHandler = (target: InspectionTarget | null) => void;

/** How long a touch must be held before the card's blow-up appears. */
export const HOLD_MS = 420;
let holdTimer: number | undefined;
/** The kind of pointer that last pressed a card: a touch long-press also fires a context menu, which is ignored. */
let lastPointerType = "mouse";

/** Starts a press-and-hold that previews the target once held; any release cancels it. */
export function startHold(target: InspectionTarget, onPreview: PreviewHandler) {
  window.clearTimeout(holdTimer);
  holdTimer = window.setTimeout(() => onPreview(target), HOLD_MS);
}
export function endHold(onPreview: PreviewHandler) {
  window.clearTimeout(holdTimer);
  onPreview(null);
}

/** Hover or focus previews a card (its blow-up); on touch, pressing and holding does. */
export function inspectionHandlers(target: InspectionTarget, onPreview: PreviewHandler, onPin?: PinHandler) {
  return {
    "data-inspection-card": true,
    onMouseEnter: () => onPreview(target),
    onMouseLeave: () => onPreview(null),
    onFocus: () => onPreview(target),
    onBlur: () => onPreview(null),
    onPointerDown: (event: PointerEvent) => {
      lastPointerType = event.pointerType;
      if (event.pointerType !== "mouse") startHold(target, onPreview);
    },
    onPointerUp: (event: PointerEvent) => {
      if (event.pointerType !== "mouse") endHold(onPreview);
    },
    onPointerCancel: () => endHold(onPreview),
    // Right-click opens the card in the Inspector, for cards whose click plays them.
    onContextMenu: (event: MouseEvent) => {
      if (!onPin) return;
      event.preventDefault();
      if (lastPointerType === "mouse") onPin(target, true);
    },
  };
}

export function typeLabel(card: CardDefinition) {
  if (card.kind === "creature") return card.gameplayTaxon;
  if (card.kind === "event") return `${card.eventType === "continuous" ? "Continuous" : "Instantaneous"} Event`;
  return card.kind[0]!.toUpperCase() + card.kind.slice(1);
}
