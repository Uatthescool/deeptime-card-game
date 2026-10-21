import type { AdaptationCard } from "../data/cards.ts";
import { clone, hasNoAdjacentFriendly, playerHolds } from "./core.ts";
import { developmentGate, explainAquaticOverrideLane, explainCreatureLane } from "./legality.ts";
import {
  adaptationEligible,
  canPlayConcept,
  explainConcept,
  explainEvent,
  legalAdaptationTargets,
  legalAquaticOverrideLanes,
  legalCreatureLanes,
  legalDroughtTargets,
  legalWildfireLanes,
} from "./queries.ts";
import type {
  CardInstance,
  ConvergentCategory,
  GameState,
  LegalityHint,
  PlacementVerdict,
  PlayerId,
  Reason,
  Verdict,
} from "./types.ts";

/**
 * Player-facing explanations of legality. Everything here is derived from the
 * engine's own legality checks, so an explanation can't disagree with the rules.
 */

const reason = (code: string, text: string): Reason => ({ code, text });

const CATEGORY_NAMES: Record<ConvergentCategory, string> = {
  diet: "Diet",
  period: "Time Period",
  taxon: "Primary Taxon",
};

/**
 * Concept cards in hand that would make this placement legal if played first.
 * Each hint is checked by applying the Concept's effect to a copy of the game
 * and re-running the real placement rules.
 */
function placementHints(state: GameState, playerId: PlayerId, card: CardInstance, laneIndex: number): LegalityHint[] {
  const player = state.players[playerId];
  const lane = player.lanes[laneIndex];
  if (!lane?.creature || card.definition.kind !== "creature") return [];
  const hints: LegalityHint[] = [];
  for (const helper of player.hand) {
    if (helper.uid === card.uid || !canPlayConcept(state, helper)) continue;
    if (helper.definition.key === "convergent-evolution") {
      const trial = clone(state);
      trial.players[playerId].allowances.convergentEvolution = true;
      const result = explainCreatureLane(trial, playerId, card, laneIndex);
      const supplied = result.override?.convergentCategory;
      if (result.legal && supplied) {
        hints.push({
          cardUid: helper.uid,
          cardName: helper.definition.name,
          text: `Play ${helper.definition.name} first: it can supply the ${CATEGORY_NAMES[supplied]} match.`,
        });
      }
    }
    if (helper.definition.key === "rapid-speciation") {
      const trial = clone(state);
      trial.players[playerId].allowances.rapidSpeciation = true;
      if (explainCreatureLane(trial, playerId, card, laneIndex).legal) {
        hints.push({
          cardUid: helper.uid,
          cardName: helper.definition.name,
          text: `Play ${helper.definition.name} first: it allows this exact two-Level jump.`,
        });
      }
    }
  }
  return hints;
}

/** Whether `card` may be played into this Niche, why not, and what in hand could change that. */
export function explainPlacement(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  laneIndex: number,
  options: { aquaticOverride?: boolean } = {},
): PlacementVerdict {
  const result = options.aquaticOverride
    ? explainAquaticOverrideLane(state, card, laneIndex)
    : explainCreatureLane(state, playerId, card, laneIndex);
  if (result.legal) return result;
  return { ...result, hints: placementHints(state, playerId, card, laneIndex) };
}

const ELIGIBILITY_TEXT: Record<AdaptationCard["eligibility"], string> = {
  any: "Attaches to any Creature.",
  "aquatic-or-lepidosaur": "Attaches only to an Aquatic Creature or a Lepidosaur.",
  "raptorial-claws": "Attaches only to a Creature with Raptorial Claws.",
  "level-2-or-lower": "Attaches only to a Creature of Level 2 or lower.",
  saurischian: "Attaches only to a Saurischian Creature.",
  ornithischian: "Attaches only to an Ornithischian Creature.",
  "herbivore-armament-retaliation": "Attaches only to a Herbivore with Armament or Retaliation.",
};

function explainAdaptationCard(state: GameState, card: CardInstance & { definition: AdaptationCard }): Reason[] {
  const player = state.players[state.activePlayer];
  if (player.allowances.adaptationPlayed) {
    return [reason("adaptation-played", "You've already played an Adaptation this turn.")];
  }
  const islandDwarfism = card.definition.key === "island-dwarfism";
  const sides: PlayerId[] = islandDwarfism ? [0, 1] : [state.activePlayer];
  const creatures = sides.flatMap((playerId) =>
    state.players[playerId].lanes.flatMap((lane, laneIndex) => (lane.creature ? [{ playerId, laneIndex, lane }] : [])),
  );
  if (!creatures.length) {
    return [
      reason(
        "no-creature-to-adapt",
        islandDwarfism
          ? "There's no Creature in play to attach it to."
          : "You have no Creature in play to attach it to.",
      ),
    ];
  }
  const eligible = creatures.filter(({ lane }) => adaptationEligible(card.definition, lane.creature!.card.definition));
  if (!eligible.length) return [reason("no-eligible-creature", ELIGIBILITY_TEXT[card.definition.eligibility])];
  const open = eligible.filter(({ lane }) => !lane.attachment && !lane.engulfed);
  if (!open.length) {
    return [reason("adaptation-slots-full", "Every eligible Creature's Adaptation Slot is already occupied.")];
  }
  if (islandDwarfism && !open.some(({ playerId, laneIndex }) => hasNoAdjacentFriendly(state, playerId, laneIndex))) {
    return [
      reason(
        "island-dwarfism-isolation",
        "Island Dwarfism attaches only to a Creature with no Creature in either neighboring Niche.",
      ),
    ];
  }
  return [reason("no-adaptation-target", "There's no legal Creature to attach it to.")];
}

/** The closest an un-playable Creature comes to a legal Niche, as one summary reason. */
function summarizeCreature(state: GameState, card: CardInstance): Reason[] {
  const playerId = state.activePlayer;
  const player = state.players[playerId];
  const verdicts = player.lanes.map((_, index) => explainCreatureLane(state, playerId, card, index));
  const codes = new Set(verdicts.flatMap((entry) => entry.reasons.map((item) => item.code)));
  if (codes.has("creature-already-played")) {
    return [reason("creature-already-played", "You've already played a Creature this turn.")];
  }
  const reasons: Reason[] = [];
  if (codes.has("empty-needs-low-level")) {
    reasons.push(reason("empty-needs-low-level", "Empty Niches take only Level 0 or 1 Creatures."));
  }
  if (codes.has("already-filled-empty")) {
    reasons.push(reason("already-filled-empty", "You've already filled an empty Niche this turn."));
  }
  const overrides = verdicts.flatMap((entry, laneIndex) =>
    entry.override?.explanations ? [{ laneIndex, check: entry.override }] : [],
  );
  if (!overrides.length && !player.lanes.some((lane) => lane.creature)) {
    if (!reasons.length) reasons.push(reason("nothing-to-override", "You have no Creature in play for it to replace."));
  } else if (overrides.length) {
    // The occupied Niche closest to legal, and the one thing that still stops it, goes first.
    const best = overrides.reduce((a, b) =>
      b.check.matchCount + Number(b.check.levelLegal) > a.check.matchCount + Number(a.check.levelLegal) ? b : a,
    );
    const niche = `Niche ${best.laneIndex + 1}`;
    const matches = `${best.check.matchCount} of 4 matches`;
    const otherBlocker = verdicts[best.laneIndex]!.reasons.find(
      (item) => item.code !== "too-few-matches" && item.code !== "level",
    );
    const text = !best.check.levelLegal
      ? `Closest override: ${niche}, ${matches}, but ${best.check.explanations!.level.replace(/^Level/, "the Level step")}.`
      : best.check.matchCount < 3
        ? `Closest override: ${niche}, only ${matches}; an override needs 3.`
        : `Closest override: ${niche}. ${otherBlocker?.text ?? ""}`.trim();
    reasons.unshift(reason("closest-override", text));
  }
  if (!reasons.length) {
    const first = verdicts.flatMap((entry) => entry.reasons)[0];
    reasons.push(first ?? reason("no-legal-niche", "No Niche can take this Creature right now."));
  }
  return reasons;
}

/**
 * Whether a card in the active player's hand can be played right now in any
 * way, and if not, a short explanation of why.
 */
export function explainCard(state: GameState, card: CardInstance): Verdict {
  const playerId = state.activePlayer;
  const gate = developmentGate(state, playerId);
  if (gate.length) return { legal: false, reasons: gate };
  if (!playerHolds(state.players[playerId], card.uid)) {
    return { legal: false, reasons: [reason("not-in-hand", "That card isn't in your hand.")] };
  }
  const definition = card.definition;
  switch (definition.kind) {
    case "creature": {
      const playable = legalCreatureLanes(state, playerId, card).length + legalAquaticOverrideLanes(state, card).length;
      return playable ? { legal: true, reasons: [] } : { legal: false, reasons: summarizeCreature(state, card) };
    }
    case "adaptation":
      return legalAdaptationTargets(state, card).length
        ? { legal: true, reasons: [] }
        : {
            legal: false,
            reasons: explainAdaptationCard(state, card as CardInstance & { definition: AdaptationCard }),
          };
    case "event": {
      if (definition.key === "wildfire" || definition.key === "drought") {
        const targets =
          definition.key === "wildfire"
            ? legalWildfireLanes(state, card).length
            : legalDroughtTargets(state, card).length;
        if (targets) return { legal: true, reasons: [] };
        if (state.players[playerId].allowances.eventPlayed) {
          return { legal: false, reasons: [reason("event-played", "You've already played an Event this turn.")] };
        }
        return {
          legal: false,
          reasons: [
            definition.key === "wildfire"
              ? reason("no-wildfire-lane", "Every Niche on your side is locked or protected by Raptorial.")
              : reason(
                  "no-drought-target",
                  "Drought needs an unlocked empty Niche, or an Aquatic Creature that can be overridden.",
                ),
          ],
        };
      }
      return explainEvent(state, card);
    }
    case "concept":
      return explainConcept(state, card);
  }
}
