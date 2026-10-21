import type { CreatureCard } from "../data/cards.ts";
import { effectiveHasTag, hasIslandDwarfism, islandDwarfismBlocksEntry, nicheIsLocked, overrideTags } from "./core.ts";
import type { ConvergentCategory, GameState, OverrideCheck, PlayerId } from "./types.ts";

const CONVERGENT_EXCLUDED_TAGS = new Set([
  "Apex Predator",
  "Aquatic",
  "Semi-Aquatic",
  "Generalist",
  "Herd",
  "Living Fossil",
  "Transitional",
  "Specialized",
]);

function eligibleTagIntersection(a: CreatureCard, b: CreatureCard) {
  const aTags = overrideTags(a);
  const bTags = overrideTags(b);
  return [...aTags].some((tag) => bTags.has(tag) && !CONVERGENT_EXCLUDED_TAGS.has(tag));
}

const blocked = (reason: string): OverrideCheck => ({
  legal: false,
  matches: { diet: false, period: false, taxon: false, tag: false },
  matchCount: 0,
  levelLegal: false,
  convergentCategory: null,
  convergentOptions: [],
  reasons: [reason],
});

/**
 * Whether `incoming` may override the Creature in `laneIndex`. An override needs
 * three of four category matches (Diet, Time Period, Primary Taxon, Tag) and a
 * legal Level progression, subject to the Aquatic gate and board restrictions.
 */
export function checkOverride(
  state: GameState,
  playerId: PlayerId,
  incoming: CreatureCard,
  laneIndex: number,
  rapid = false,
  convergentChoice?: ConvergentCategory,
): OverrideCheck {
  const lane = state.players[playerId].lanes[laneIndex];
  const current = lane?.creature?.card.definition;
  const reasons: string[] = [];
  if (nicheIsLocked(state, playerId, laneIndex)) {
    return blocked(lane?.drought ? "Drought locks this Niche." : "Wildfire locks this entire lane.");
  }
  if (!current || !lane?.creature) return blocked("The Niche is empty.");

  if (lane.creature.cannotOverrideOnTurn === state.turnNumber) {
    reasons.push("Raptorial prevents this Creature from being overridden this turn.");
  }
  if (islandDwarfismBlocksEntry(state, playerId, laneIndex)) {
    reasons.push("Island Dwarfism prevents a Creature from entering this adjacent Niche.");
  }
  if (hasIslandDwarfism(lane) && effectiveHasTag(incoming, "Gigantic")) {
    reasons.push("Island Dwarfism prevents a Creature with Gigantic from overriding this Creature.");
  }

  const incomingTags = overrideTags(incoming);
  const currentTags = overrideTags(current);
  const difference = incoming.printedLevel - current.printedLevel;
  const airSacsJump = Boolean(
    lane.attachment?.definition.key === "air-sacs" &&
    difference === 2 &&
    current.taxa.includes("Saurischian") &&
    incoming.taxa.includes("Saurischian") &&
    (effectiveHasTag(current, "Gigantic") || effectiveHasTag(incoming, "Gigantic")),
  );
  const levelLegal = rapid ? difference === 2 : (difference >= 0 && difference <= 1) || airSacsJump;
  if (!levelLegal) {
    reasons.push(
      rapid ? "Rapid Speciation requires exactly two Levels of progression." : "The Level progression is not legal.",
    );
  }

  // Diet matching is directional.
  let diet =
    incoming.diet === "Omnivore"
      ? true
      : incoming.diet === "Carnivore"
        ? current.diet === "Carnivore" || current.diet === "Omnivore"
        : current.diet === "Herbivore";

  const baseTaxon = incoming.gameplayTaxon === current.gameplayTaxon;
  const incomingAquatic = incoming.tags.includes("Aquatic");
  const currentAquatic = current.tags.includes("Aquatic");
  const incomingCountsAsAquatic = incomingAquatic || incoming.tags.includes("Semi-Aquatic");
  const currentSemiAquatic = current.tags.includes("Semi-Aquatic");
  const currentCountsAsAquatic = currentAquatic || currentSemiAquatic;
  const aquaticGateLegal = (!incomingAquatic || currentCountsAsAquatic) && (!currentAquatic || incomingCountsAsAquatic);
  if (!aquaticGateLegal) {
    reasons.push("A printed Aquatic Creature can interact in an override only with a Creature that counts as Aquatic.");
  }

  // The occupied Creature's bridge identity determines which category is supplied.
  const aquaticTaxonMatch = currentAquatic && incomingCountsAsAquatic && !baseTaxon;
  const aquaticTagMatch = currentAquatic && incomingCountsAsAquatic && baseTaxon;
  const semiAquaticTagMatch = currentSemiAquatic && incomingCountsAsAquatic;
  let taxon = baseTaxon || aquaticTaxonMatch;

  const livingFossil = current.tags.includes("Living Fossil") || incoming.tags.includes("Living Fossil");
  const transitional = (current.tags.includes("Transitional") || incoming.tags.includes("Transitional")) && baseTaxon;
  let period = incoming.period === current.period || livingFossil || transitional;

  let tag = aquaticTagMatch || semiAquaticTagMatch || [...incomingTags].some((value) => currentTags.has(value));
  if (!tag && current.tags.includes("Generalist")) {
    const otherMatches = [diet, period, taxon].filter(Boolean).length;
    if (otherMatches >= 2) tag = true;
  }

  let convergentCategory: ConvergentCategory | null = null;
  let convergentOptions: ConvergentCategory[] = [];
  if (
    state.players[playerId].allowances.convergentEvolution &&
    eligibleTagIntersection(incoming, current) &&
    [diet, period, taxon].some(Boolean)
  ) {
    convergentOptions = [
      ...(!taxon ? (["taxon"] as const) : []),
      ...(!diet ? (["diet"] as const) : []),
      ...(!period ? (["period"] as const) : []),
    ];
    const selected =
      convergentChoice && convergentOptions.includes(convergentChoice) ? convergentChoice : convergentOptions[0];
    if (selected === "taxon") taxon = true;
    else if (selected === "diet") diet = true;
    else if (selected === "period") period = true;
    convergentCategory = selected ?? null;
  }

  const matches = { diet, period, taxon, tag };
  const matchCount = Object.values(matches).filter(Boolean).length;
  if (matchCount < 3) reasons.push(`Only ${matchCount} of 4 override categories match.`);

  return {
    legal:
      levelLegal &&
      aquaticGateLegal &&
      matchCount >= 3 &&
      lane.creature.cannotOverrideOnTurn !== state.turnNumber &&
      !islandDwarfismBlocksEntry(state, playerId, laneIndex) &&
      !(hasIslandDwarfism(lane) && effectiveHasTag(incoming, "Gigantic")),
    matches,
    matchCount,
    levelLegal,
    convergentCategory,
    convergentOptions,
    reasons,
  };
}
