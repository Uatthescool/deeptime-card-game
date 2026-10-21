import type { PointerEvent } from "react";

import type { CardDefinition } from "../data/cards.ts";

/** A card shown in the inspector, with optional live board context. */
export type InspectionTarget = {
  definition: CardDefinition;
  context?: string[];
  attachment?: string;
};

export type InspectorTab = "card" | "tags" | "state" | "log" | "history";

export type PinHandler = (target: InspectionTarget, openInspector?: boolean) => void;
export type PreviewHandler = (target: InspectionTarget | null) => void;

/** Hover/focus previews a card in the inspector; a touch press pins it and opens the drawer. */
export function inspectionHandlers(target: InspectionTarget, onPreview: PreviewHandler, onPin?: PinHandler) {
  return {
    "data-inspection-card": true,
    onMouseEnter: () => onPreview(target),
    onMouseLeave: () => onPreview(null),
    onFocus: () => onPreview(target),
    onBlur: () => onPreview(null),
    onPointerDown: (event: PointerEvent) => {
      if (event.pointerType !== "mouse") onPin?.(target, true);
    },
  };
}

export function typeLabel(card: CardDefinition) {
  if (card.kind === "creature") return card.gameplayTaxon;
  if (card.kind === "event") return `${card.eventType === "continuous" ? "Continuous" : "Instantaneous"} Event`;
  return card.kind[0]!.toUpperCase() + card.kind.slice(1);
}
