import type { CreatureInPlay } from "../engine/index.ts";

/** A rule marker on a Creature in play: a small icon on its card, explained in its blow-up. */
export type CreatureMarker = { key: string; icon: string; title: string; text: string };

/** The temporary states on a Creature in play, as markers. Burrowed and Frozen also cover the card. */
export function creatureMarkers(creature: CreatureInPlay, turnNumber: number): CreatureMarker[] {
  const card = creature.card.definition;
  const markers: CreatureMarker[] = [];
  if (creature.enteredTurn === turnNumber && !card.tags.includes("Ambush") && !card.tags.includes("Charge")) {
    markers.push({
      key: "entered",
      icon: "✦",
      title: "Entered this turn",
      text: "It can't Hunt until your next turn.",
    });
  }
  if (creature.lastAttackTurn === turnNumber) {
    markers.push({ key: "hunted", icon: "✓", title: "Hunt spent", text: "It has already Hunted this turn." });
  }
  if (creature.cannotAttackOnTurn === turnNumber) {
    markers.push({ key: "hunt-locked", icon: "⊘", title: "Can't Hunt", text: "An effect stops it Hunting this turn." });
  }
  if (creature.cannotOverrideOnTurn === turnNumber) {
    markers.push({
      key: "override-locked",
      icon: "⛓",
      title: "Can't be overridden",
      text: "Raptorial stops this Creature being overridden this turn.",
    });
  }
  if (creature.mobFeederBonusTurn === turnNumber) {
    markers.push({
      key: "mob-feeder",
      icon: "⚑",
      title: "Mob Feeder ready",
      text: "It gets +100 Battle Power in its next Hunt this turn.",
    });
  }
  if (creature.deimaticProtectedThroughTurn !== null && creature.deimaticProtectedThroughTurn >= turnNumber) {
    markers.push({
      key: "deimatic",
      icon: "◉",
      title: "Deimatic display",
      text: `Opposing Creatures can't Hunt it through Turn ${creature.deimaticProtectedThroughTurn}.`,
    });
  }
  if (creature.attackBarriers.some((barrier) => barrier.expiresOnTurn === turnNumber)) {
    markers.push({
      key: "deterred",
      icon: "⚠",
      title: "Deterred",
      text: "A Cranial Display stops it Hunting that Creature this turn.",
    });
  }
  return markers;
}

/** Whether a Creature in play is Burrowed right now. */
export const isBurrowed = (creature: CreatureInPlay, turnNumber: number) =>
  creature.burrowedUntilTurn !== null && turnNumber < creature.burrowedUntilTurn;
