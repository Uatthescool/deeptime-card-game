import type { CreatureCard, Diet } from "../data/cards.ts";
import { effectiveHasTag, hasIslandDwarfism, islandDwarfismBlocksEntry, nicheIsLocked, overrideTags } from "./core.ts";
import type { ConvergentCategory, GameState, OverrideCheck, PlayerId, Reason } from "./types.ts";

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

const blocked = (reason: Reason): OverrideCheck => ({
  legal: false,
  matches: { diet: false, period: false, taxon: false, tag: false },
  matchCount: 0,
  levelLegal: false,
  convergentCategory: null,
  convergentOptions: [],
  reasons: [reason.text],
  blockers: [reason],
  explanations: null,
});

/** Which Diets an incoming Creature may replace. Diet matching is directional. */
function dietMatches(incoming: Diet, current: Diet) {
  if (incoming === "Omnivore") return true;
  if (incoming === "Carnivore") return current === "Carnivore" || current === "Omnivore";
  return current === "Herbivore";
}

function dietExplanation(incoming: Diet, current: Diet, matched: boolean) {
  if (incoming === "Omnivore") return "Omnivores can replace any Diet";
  if (matched) return `${incoming} can replace ${current}`;
  return incoming === "Carnivore"
    ? "Carnivores can replace only Carnivores or Omnivores"
    : "Herbivores can replace only Herbivores";
}

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
  const blockers: Reason[] = [];
  const block = (code: string, text: string) => blockers.push({ code, text });
  if (nicheIsLocked(state, playerId, laneIndex)) {
    return blocked(
      lane?.drought
        ? { code: "drought", text: "Drought locks this Niche." }
        : { code: "wildfire", text: "Wildfire locks this entire lane." },
    );
  }
  if (!current || !lane?.creature) return blocked({ code: "empty-niche", text: "The Niche is empty." });

  if (lane.creature.cannotOverrideOnTurn === state.turnNumber) {
    block("raptorial", "Raptorial prevents this Creature from being overridden this turn.");
  }
  if (islandDwarfismBlocksEntry(state, playerId, laneIndex)) {
    block("island-dwarfism-adjacent", "Island Dwarfism prevents a Creature from entering this adjacent Niche.");
  }
  if (hasIslandDwarfism(lane) && effectiveHasTag(incoming, "Gigantic")) {
    block(
      "island-dwarfism-gigantic",
      "Island Dwarfism prevents a Creature with Gigantic from overriding this Creature.",
    );
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
  const step = `Level ${current.printedLevel} → ${incoming.printedLevel}`;
  const levelText = rapid
    ? levelLegal
      ? `${step}, the two Levels Rapid Speciation requires`
      : `Rapid Speciation needs exactly two Levels up; this is ${step}`
    : airSacsJump
      ? `${step}: Air Sacs allows a two-Level jump`
      : levelLegal
        ? `${step} is a legal step`
        : difference < 0
          ? `${step}: a Creature can't be replaced by a lower Level`
          : `${step} skips too far; an override may rise at most one Level`;
  if (!levelLegal) block("level", levelText + ".");

  let diet = dietMatches(incoming.diet, current.diet);

  const baseTaxon = incoming.gameplayTaxon === current.gameplayTaxon;
  const incomingAquatic = incoming.tags.includes("Aquatic");
  const currentAquatic = current.tags.includes("Aquatic");
  const incomingCountsAsAquatic = incomingAquatic || incoming.tags.includes("Semi-Aquatic");
  const currentSemiAquatic = current.tags.includes("Semi-Aquatic");
  const currentCountsAsAquatic = currentAquatic || currentSemiAquatic;
  const aquaticGateLegal = (!incomingAquatic || currentCountsAsAquatic) && (!currentAquatic || incomingCountsAsAquatic);
  if (!aquaticGateLegal) {
    block(
      "aquatic-gate",
      "A printed Aquatic Creature can interact in an override only with a Creature that counts as Aquatic.",
    );
  }

  // The occupied Creature's bridge identity determines which category is supplied.
  const aquaticTaxonMatch = currentAquatic && incomingCountsAsAquatic && !baseTaxon;
  const aquaticTagMatch = currentAquatic && incomingCountsAsAquatic && baseTaxon;
  const semiAquaticTagMatch = currentSemiAquatic && incomingCountsAsAquatic;
  let taxon = baseTaxon || aquaticTaxonMatch;

  const livingFossil = current.tags.includes("Living Fossil") || incoming.tags.includes("Living Fossil");
  const transitional = (current.tags.includes("Transitional") || incoming.tags.includes("Transitional")) && baseTaxon;
  let period = incoming.period === current.period || livingFossil || transitional;

  const sharedTag = [...incomingTags].find((value) => currentTags.has(value));
  let tag = aquaticTagMatch || semiAquaticTagMatch || Boolean(sharedTag);
  let generalistTag = false;
  if (!tag && current.tags.includes("Generalist")) {
    const otherMatches = [diet, period, taxon].filter(Boolean).length;
    if (otherMatches >= 2) tag = generalistTag = true;
  }

  const explanations: NonNullable<OverrideCheck["explanations"]> = {
    diet: dietExplanation(incoming.diet, current.diet, diet),
    period:
      incoming.period === current.period
        ? `Both ${current.period}`
        : livingFossil
          ? "Living Fossil bridges Time Periods"
          : transitional
            ? "Transitional bridges Time Periods within a Primary Taxon"
            : `${incoming.period} vs. ${current.period}`,
    taxon: baseTaxon
      ? `Both ${current.gameplayTaxon}`
      : aquaticTaxonMatch
        ? "Aquatic supplies the Primary Taxon match"
        : `${incoming.gameplayTaxon} vs. ${current.gameplayTaxon}`,
    tag: aquaticTagMatch
      ? "Aquatic supplies the Tag match"
      : semiAquaticTagMatch
        ? "Semi-Aquatic supplies the Tag match"
        : sharedTag
          ? `Both have ${sharedTag}`
          : generalistTag
            ? "Generalist supplies the Tag match"
            : "No shared Tag",
    level: levelText,
  };

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
    if (convergentCategory) explanations[convergentCategory] = "Supplied by Convergent Evolution";
  }

  const matches = { diet, period, taxon, tag };
  const matchCount = Object.values(matches).filter(Boolean).length;
  if (matchCount < 3)
    block("too-few-matches", `Only ${matchCount} of 4 override categories match; an override needs 3.`);

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
    reasons: blockers.map((blocker) => blocker.text),
    blockers,
    explanations,
  };
}
