import type { PlacementVerdict, Reason, Verdict } from "../engine/index.ts";

/** A compact label shown on a Niche while a card or hunter is selected. */
export type LaneBadge = { tone: "legal" | "blocked" | "locked"; label: string };

const LOCK_CODES = new Set(["wildfire", "drought", "island-dwarfism-adjacent"]);

const EMPTY_NICHE_LABELS: Record<string, string> = {
  "empty-needs-low-level": "Level 0–1 only",
  "already-filled-empty": "Already filled one",
  "rapid-needs-occupied": "Needs a Creature",
  "aquatic-needs-occupied": "Needs a Creature",
  "creature-already-played": "Creature play used",
};

export function placementBadge(verdict: PlacementVerdict, occupied: boolean): LaneBadge {
  const codes = verdict.reasons.map((reason) => reason.code);
  if (verdict.legal) {
    return { tone: "legal", label: occupied ? `${verdict.override?.matchCount ?? 3} of 4 · Replace` : "Fill" };
  }
  if (codes.some((code) => LOCK_CODES.has(code))) return { tone: "locked", label: "Locked" };
  const hint = verdict.hints.length ? " · idea" : "";
  if (verdict.override?.explanations) return { tone: "blocked", label: `${verdict.override.matchCount} of 4${hint}` };
  const label = codes.map((code) => EMPTY_NICHE_LABELS[code]).find(Boolean) ?? "Unavailable";
  return { tone: "blocked", label: label + hint };
}

const HUNT_LABELS: Record<string, string> = {
  "gigantic-target": "Gigantic",
  burrowed: "Burrowed",
  deimatic: "Deimatic",
  "cranial-display": "Deterred",
  "charge-lane": "Not opposite",
  "elusive-attacker": "Too big for Elusive",
  "diet-omnivore": "Wrong Diet",
  "diet-carnivore": "Wrong Diet",
  "herbivore-hunt": "Herbivores don't Hunt",
};

export function huntBadge(verdict: Verdict): LaneBadge {
  if (verdict.legal) return { tone: "legal", label: "Hunt" };
  const label = verdict.reasons.map((reason) => HUNT_LABELS[reason.code]).find(Boolean) ?? "Can't Hunt";
  return { tone: "blocked", label };
}

/** Everything the "why not?" panel needs to describe one move. */
export type Explanation = {
  title: string;
  legal: boolean;
  reasons: Reason[];
  placement?: PlacementVerdict;
};
