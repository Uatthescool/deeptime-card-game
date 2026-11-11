import { useEffect, useState } from "react";

import { expandedTagNames, TAG_RULES } from "../../data/cards.ts";
import { findCreature, type GameState, liveBattlePower, nicheIsFrozen, victoryBreakdown } from "../../engine/index.ts";
import type { InspectionTarget } from "../inspection.ts";
import { creatureMarkers, isBurrowed } from "../creatureStates.ts";
import { CardFace } from "./CardFace.tsx";

/** How long the pointer rests on a card before its blow-up opens, so sweeping across the hand stays calm. */
const HOVER_DELAY_MS = 260;

type Bubble = { key: string; title: string; lines: string[]; tone?: "victory" | "power" | "state" | "tag" };

const signed = (amount: number) => (amount > 0 ? `+${amount}` : amount < 0 ? `−${Math.abs(amount)}` : "±0");

/** Everything a card's blow-up explains: Tags, and for a Creature in play its Victory, Battle Power and states. */
function bubblesFor(game: GameState, target: InspectionTarget): Bubble[] {
  const card = target.definition;
  const bubbles: Bubble[] = [];
  const found = target.uid ? findCreature(game, target.uid) : null;

  if (card.kind === "creature" && found) {
    const victory = victoryBreakdown(game, found.creature);
    bubbles.push({
      key: "victory",
      tone: "victory",
      title: `Victory Level ${victory.value}`,
      lines: [
        `Printed Level ${card.printedLevel}`,
        ...victory.sources.map((source) => `${source.label} ${signed(source.amount)}`),
      ],
    });
    const live = liveBattlePower(game, target.uid!);
    if (live) {
      bubbles.push({
        key: "power",
        tone: "power",
        title: `Battle Power ${live.power}`,
        lines: [
          `Printed Level × 100 = ${live.base}`,
          ...live.sources.map((source) => `${source.label} ${signed(source.amount)}`),
          "Bonuses that apply only while attacking or defending show in the Hunt preview.",
        ],
      });
    }
    if (isBurrowed(found.creature, game.turnNumber)) {
      bubbles.push({
        key: "burrowed",
        tone: "state",
        title: "Burrowed",
        lines: [
          "While Burrowed, it can't be interacted with. It stays Burrowed until its controller's next turn or until it Hunts.",
        ],
      });
    }
    if (nicheIsFrozen(found.lane)) {
      bubbles.push({
        key: "frozen",
        tone: "state",
        title: "Frozen",
        lines: [
          `This Niche is Frozen through Turn ${found.lane.frozenUntilTurn}.`,
          card.tags.includes("Underwool")
            ? "Frozen Niches and their Creatures can't be interacted with, but Underwool keeps this Creature's Victory Levels, and another Underwool Creature may override it."
            : "Frozen Niches and their Creatures can't be interacted with and contribute no Victory Levels.",
        ],
      });
    }
    for (const marker of creatureMarkers(found.creature, game.turnNumber)) {
      bubbles.push({ key: marker.key, tone: "state", title: marker.title, lines: [marker.text] });
    }
    if (found.lane.attachment) {
      bubbles.push({
        key: "attachment",
        title: `Adaptation · ${found.lane.attachment.definition.name}`,
        lines: [found.lane.attachment.definition.rules],
      });
    }
    if (found.lane.engulfed) {
      bubbles.push({
        key: "engulfed",
        tone: "state",
        title: `Engulfed · ${found.lane.engulfed.definition.name}`,
        lines: ["Held in this Creature's Adaptation slot. Its printed effects and Victory Levels are inactive."],
      });
    }
  }

  if (card.kind === "creature") {
    for (const tag of expandedTagNames(card)) {
      bubbles.push({
        key: `tag-${tag}`,
        tone: "tag",
        title: tag,
        lines: [
          tag === "Bastion" && card.tags.includes("Circle Defense")
            ? "Granted by Circle Defense, which changes how this Creature's Bastion works."
            : (TAG_RULES[tag] ?? "No inherent effect is currently assigned."),
        ],
      });
    }
  }
  if (target.context?.length) bubbles.push({ key: "context", tone: "state", title: "In play", lines: target.context });
  return bubbles;
}

/**
 * The enlarged card face for whatever card is being pointed at (or held, on touch), with text bubbles
 * explaining its Tags and, for a Creature in play, its Victory Level, Battle Power and states.
 */
export function CardBlowup({ game, target }: { game: GameState; target: InspectionTarget | null }) {
  const key = target ? `${target.uid ?? ""}|${target.definition.key}` : "";
  const [shownKey, setShownKey] = useState("");
  useEffect(() => {
    if (!key) return;
    const timer = window.setTimeout(() => setShownKey(key), HOVER_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [key]);
  if (!target || shownKey !== key) return null;

  const bubbles = bubblesFor(game, target);
  // The live numbers sit on the left; Tags and the rest on the right, nearer the card's own Tag box.
  const left = bubbles.filter((bubble) => bubble.tone === "victory" || bubble.tone === "power");
  const right = bubbles.filter((bubble) => bubble.tone !== "victory" && bubble.tone !== "power");
  const balanced = left.length === 0 ? right.splice(0, Math.floor(right.length / 2)) : left;

  return (
    <div className="tbl-blowup" aria-hidden="true">
      <div className="tbl-blowup-column left">
        {balanced.map((bubble) => (
          <BubbleBox key={bubble.key} bubble={bubble} side="left" />
        ))}
      </div>
      <div className="tbl-blowup-card">
        <CardFace card={target.definition} />
      </div>
      <div className="tbl-blowup-column right">
        {right.map((bubble) => (
          <BubbleBox key={bubble.key} bubble={bubble} side="right" />
        ))}
      </div>
    </div>
  );
}

function BubbleBox({ bubble, side }: { bubble: Bubble; side: "left" | "right" }) {
  return (
    <section className={`tbl-bubble ${side} ${bubble.tone ?? ""}`}>
      <strong>{bubble.title}</strong>
      {bubble.lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </section>
  );
}
