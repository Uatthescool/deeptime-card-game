import { useLayoutEffect, useRef } from "react";

import type { DrawEvent, GameState } from "../../engine/index.ts";
import { CardBack, CardFace } from "./CardFace.tsx";

/**
 * A drawn card flying from its owner's deck pile to their hand. The person's own draws turn face up on
 * the way; the opponent's stay face down. The draw queue moves on by itself, one draw at a time.
 */
export function DrawFlight({ game, event, faceVisible }: { game: GameState; event: DrawEvent; faceVisible: boolean }) {
  const flight = useRef<HTMLDivElement>(null);
  // Measure where the deck and hand are on screen, and start the flight from one to the other.
  useLayoutEffect(() => {
    const element = flight.current;
    if (!element) return;
    const from = document.querySelector(`[data-deck-pile="${event.playerId}"]`)?.getBoundingClientRect();
    const to = document.querySelector(`[data-hand-area="${event.playerId}"]`)?.getBoundingClientRect();
    if (!from || !to) {
      element.hidden = true;
      return;
    }
    element.style.setProperty("--from-x", `${from.left + from.width / 2}px`);
    element.style.setProperty("--from-y", `${from.top + from.height / 2}px`);
    element.style.setProperty("--to-x", `${to.left + to.width / 2}px`);
    element.style.setProperty("--to-y", `${to.top + to.height / 2}px`);
    element.style.setProperty("--card-h", `${from.height}px`);
    element.hidden = false;
  }, [event.id, event.playerId]);

  const player = game.players[event.playerId];
  const card = player.hand.find((instance) => instance.uid === event.cardUid);
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        {player.name} draws{faceVisible && card ? ` ${card.definition.name}` : " a card"} · {event.reason}
      </div>
      <div
        key={event.id}
        ref={flight}
        hidden
        className={`tbl-draw-flight ${faceVisible ? "face-up" : ""}`}
        aria-hidden="true"
      >
        <span className="tbl-draw-back">
          <CardBack />
        </span>
        {faceVisible && card && (
          <span className="tbl-draw-front">
            <CardFace card={card.definition} compact />
          </span>
        )}
      </div>
    </>
  );
}
