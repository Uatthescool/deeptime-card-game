import { PENDING_ARTWORK_KEYS } from "./art.ts";
import registerJson from "./deck-1.json" with { type: "json" };
import {
  DECK_2_INHERITED_SUPPORT_KEYS,
  DECK_2_NEW_SUPPORTS,
  DECK_2_UNIQUE_CREATURES,
  DECK_2_UNIQUE_KEYS,
} from "./deck-2.ts";
import {
  DECK_3_INHERITED_SUPPORT_KEYS,
  DECK_3_NEW_SUPPORTS,
  DECK_3_UNIQUE_CREATURES,
  DECK_3_UNIQUE_KEYS,
} from "./deck-3.ts";
import { GENERAL_POOL_CANDIDATES } from "./general-pool.ts";
import type { CardDefinition, CreatureCard, DeckKey, ImplementationRegister, SupportCard } from "./types.ts";

export * from "./types.ts";
export { AI_PLACEHOLDER_ARTWORK_KEYS, artSource, type ArtSource, PENDING_ARTWORK_KEYS } from "./art.ts";

/**
 * Deck 1 is the canonical register: it also carries the shared Tag rules and
 * the accepted-change ledger. Decks 2 and 3 inherit selected cards from it.
 */
export const IMPLEMENTATION_REGISTER = registerJson as unknown as ImplementationRegister;
export const CREATURES = IMPLEMENTATION_REGISTER.creatures;
export const SUPPORTS = IMPLEMENTATION_REGISTER.supports;
export const TAG_RULES = IMPLEMENTATION_REGISTER.tagRules;
export const TAG_COMBOS = IMPLEMENTATION_REGISTER.tagCombos;

/** The Combos on `tag`, each marked active when `card` also has its partner Tag. */
export function tagCombos(card: CreatureCard, tag: string) {
  const tags = expandedTagNames(card);
  return (TAG_COMBOS[tag] ?? []).map((combo) => ({ ...combo, active: tags.includes(combo.with) }));
}

const byLevelThenName = (a: CreatureCard, b: CreatureCard) =>
  a.printedLevel - b.printedLevel || a.name.localeCompare(b.name);

export const DECK_1: CardDefinition[] = [...CREATURES, ...SUPPORTS];
/** @deprecated Use DECK_1. Kept for the rules-engine test suite's historical name. */
export const TEST_DECK = DECK_1;

const DECK_2_SHARED_KEYS = new Set(["hoatzin"]);
export const DECK_2: CreatureCard[] = [
  ...CREATURES.filter((card) => DECK_2_SHARED_KEYS.has(card.key)),
  ...DECK_2_UNIQUE_CREATURES,
].sort(byLevelThenName);
export const DECK_2_KEYS = new Set(DECK_2.map((card) => card.key));

const DECK_3_SHARED_KEYS = new Set(["horseshoe-crab", "nautilus"]);
export const DECK_3: CreatureCard[] = [
  ...CREATURES.filter((card) => DECK_3_SHARED_KEYS.has(card.key)),
  ...DECK_3_UNIQUE_CREATURES,
].sort(byLevelThenName);
export const DECK_3_KEYS = new Set(DECK_3.map((card) => card.key));

const deckThreeInheritedKeys = new Set<string>(DECK_3_INHERITED_SUPPORT_KEYS);
export const DECK_3_SUPPORTS: SupportCard[] = [
  ...SUPPORTS.filter((card) => deckThreeInheritedKeys.has(card.key)),
  ...DECK_3_NEW_SUPPORTS,
];
export const DECK_3_DECK: CardDefinition[] = [...DECK_3, ...DECK_3_SUPPORTS];

const deckTwoSupportSources: SupportCard[] = [...SUPPORTS, ...DECK_3_NEW_SUPPORTS];
export const DECK_2_SUPPORTS: SupportCard[] = [
  ...DECK_2_INHERITED_SUPPORT_KEYS.map((key) => {
    const card = deckTwoSupportSources.find((candidate) => candidate.key === key);
    if (!card) throw new Error(`Deck 2 inherits Support "${key}", which does not exist.`);
    return card;
  }),
  ...DECK_2_NEW_SUPPORTS,
];
export const DECK_2_DECK: CardDefinition[] = [...DECK_2, ...DECK_2_SUPPORTS];

export const DECKS: Record<DeckKey, CardDefinition[]> = {
  "deck-1": DECK_1,
  "deck-2": DECK_2_DECK,
  "deck-3": DECK_3_DECK,
};

export const DECK_KEYS = Object.keys(DECKS) as DeckKey[];

export const DECK_INFO: Record<DeckKey, { number: number; name: string; summary: string }> = {
  "deck-1": {
    number: 1,
    name: "Theropod Predators",
    summary: "Carnivore board control built around Apex Predators and decisive Hunts.",
  },
  "deck-2": {
    number: 2,
    name: "Herbivore Development",
    summary: "Armored Herbivores that develop the board and grow toward Dreadnoughtus.",
  },
  "deck-3": {
    number: 3,
    name: "Aquatic Carnivores",
    summary: "Marine hunters that use the closed Aquatic override ecosystem.",
  },
};

export const DECK_LABELS: Record<DeckKey, string> = Object.fromEntries(
  DECK_KEYS.map((key) => [key, `Deck ${DECK_INFO[key].number} · ${DECK_INFO[key].name}`]),
) as Record<DeckKey, string>;

/** Candidate cards outside the playable decks: inspectable, never dealt. */
export const GENERAL_POOL: CardDefinition[] = [
  ...IMPLEMENTATION_REGISTER.generalPool,
  ...GENERAL_POOL_CANDIDATES,
].filter((card) => !DECK_2_UNIQUE_KEYS.has(card.key) && !DECK_3_UNIQUE_KEYS.has(card.key));

/** Every distinct card definition the game knows about, keyed by card key. */
export const CARD_LIBRARY: ReadonlyMap<string, CardDefinition> = new Map(
  [...DECK_1, ...DECK_2_DECK, ...DECK_3_DECK, ...GENERAL_POOL].map((card) => [card.key, card]),
);

/**
 * Site-root path of a card's artwork, e.g. "/artwork/stegosaurus.webp", or
 * undefined while its artwork is pending. Resolve with `assetUrl` before use.
 */
export function artworkPath(card: CardDefinition): string | undefined {
  if (PENDING_ARTWORK_KEYS.has(card.key)) return undefined;
  return card.artwork ?? `/artwork/${card.key}.webp`;
}

export function expandedTagNames(card: CreatureCard): string[] {
  const names = [...card.tags];
  if (card.tags.includes("Sovereign")) {
    names.push("Gigantic");
    if (card.diet !== "Herbivore") names.push("Territorial");
  }
  return [...new Set(names)];
}

/** Counts as Aquatic for Event and Concept effects only. */
export function countsAsAquatic(card: CreatureCard): boolean {
  return card.tags.includes("Aquatic") || card.tags.includes("Semi-Aquatic");
}

export function hasPrintedAquatic(card: CreatureCard): boolean {
  return card.tags.includes("Aquatic");
}

/** Specialized doubles the effect of the Tag printed immediately after it. */
export function tagEffectMultiplier(card: CreatureCard, tag: string): number {
  return card.tags.some((listedTag, index) => listedTag === tag && card.tags[index - 1] === "Specialized") ? 2 : 1;
}

/**
 * Structural checks on the deck registers. Every problem is reported by name so
 * a bad data edit fails loudly at startup instead of corrupting a game.
 */
export function validateCardData(): string[] {
  const problems: string[] = [];
  const expect = (condition: boolean, message: string) => {
    if (!condition) problems.push(message);
  };
  const unique = (cards: CardDefinition[]) => new Set(cards.map((card) => card.key)).size === cards.length;
  const register = IMPLEMENTATION_REGISTER.deck;

  expect(
    CREATURES.length === register.creatureCount,
    `Deck 1 has ${CREATURES.length} Creatures; the register specifies ${register.creatureCount}.`,
  );
  expect(
    SUPPORTS.length === register.supportCount,
    `Deck 1 has ${SUPPORTS.length} Supports; the register specifies ${register.supportCount}.`,
  );
  expect(
    DECK_1.length === register.size,
    `Deck 1 has ${DECK_1.length} cards; the register specifies ${register.size}.`,
  );
  expect(DECK_2.length === 23, `Deck 2 has ${DECK_2.length} Creatures; expected 23.`);
  expect(DECK_2_SUPPORTS.length === 17, `Deck 2 has ${DECK_2_SUPPORTS.length} Supports; expected 17.`);
  expect(DECK_3.length === 22, `Deck 3 has ${DECK_3.length} Creatures; expected 22.`);
  expect(DECK_3_SUPPORTS.length === 18, `Deck 3 has ${DECK_3_SUPPORTS.length} Supports; expected 18.`);
  for (const key of DECK_KEYS) {
    const deck = DECKS[key];
    expect(deck.length === 40, `${DECK_LABELS[key]} has ${deck.length} cards; every deck must have 40.`);
    expect(unique(deck), `${DECK_LABELS[key]} contains a duplicate card; decks are singleton.`);
    for (const card of deck) {
      expect(card.status === "Locked", `${DECK_LABELS[key]} includes ${card.name}, which is not marked Locked.`);
      if (GENERAL_POOL.some((candidate) => candidate.key === card.key)) {
        problems.push(`${card.name} is in ${DECK_LABELS[key]} and also in the General Pool.`);
      }
    }
  }
  for (const [tag, combos] of Object.entries(TAG_COMBOS)) {
    expect(tag in TAG_RULES, `A Combo is listed for "${tag}", which has no Tag rule.`);
    for (const combo of combos) {
      expect(combo.with in TAG_RULES, `The ${tag} Combo names "${combo.with}", which has no Tag rule.`);
    }
  }
  for (const key of DECK_3_INHERITED_SUPPORT_KEYS) {
    expect(
      SUPPORTS.some((card) => card.key === key),
      `Deck 3 inherits Support "${key}", which Deck 1 does not define.`,
    );
  }
  return problems;
}

const dataProblems = validateCardData();
if (dataProblems.length) {
  throw new Error(`Card data is inconsistent:\n- ${dataProblems.join("\n- ")}`);
}
