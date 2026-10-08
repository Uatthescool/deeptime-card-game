import register from "./card-register.json" with { type: "json" };
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

export type Diet = "Carnivore" | "Herbivore" | "Omnivore";

export type Period =
  | "Cambrian"
  | "Ordovician"
  | "Silurian"
  | "Devonian"
  | "Carboniferous"
  | "Permian"
  | "Triassic"
  | "Jurassic"
  | "Cretaceous"
  | "Paleogene"
  | "Neogene"
  | "Quaternary";

export type CardStatus = "Locked" | "Not playable · Work in progress";
export type DeckKey = "deck-1" | "deck-2" | "deck-3";

export type CreatureCard = {
  key: string;
  kind: "creature";
  name: string;
  scientificName: string | null;
  printedLevel: 0 | 1 | 2 | 3 | 4;
  diet: Diet;
  period: Period;
  periodColor: string;
  gameplayTaxon: string;
  taxa: string[];
  tags: string[];
  visualTags: string[];
  role: string;
  flavorText: string;
  status: CardStatus;
  artwork?: string;
  cardFace?: string;
};

export type EventCard = {
  key: string;
  kind: "event";
  eventType: "continuous" | "instant";
  name: string;
  rules: string;
  note?: string;
  artwork?: string;
  status: CardStatus;
};

export type AdaptationCard = {
  key: string;
  kind: "adaptation";
  name: string;
  rules: string;
  note?: string;
  eligibility:
    | "aquatic-or-lepidosaur"
    | "raptorial-claws"
    | "level-2-or-lower"
    | "saurischian"
    | "herbivore-armament-retaliation"
    | "ornithischian"
    | "any";
  artwork?: string;
  status: CardStatus;
};

export type ConceptCard = {
  key: string;
  kind: "concept";
  name: string;
  rules: string;
  note?: string;
  artwork?: string;
  status: CardStatus;
};

export type CardDefinition =
  | CreatureCard
  | EventCard
  | AdaptationCard
  | ConceptCard;

export type ImplementationRegister = {
  version: string;
  title: string;
  deck: {
    size: number;
    identity: string;
    creatureCount: number;
    supportCount: number;
    curve: Record<string, number>;
    supportSplit: Record<string, number>;
  };
  rulesChanges: Array<{ title: string; rule: string }>;
  tagRules: Record<string, string>;
  creatures: CreatureCard[];
  supports: Array<EventCard | AdaptationCard | ConceptCard>;
  generalPool: CardDefinition[];
};

export const IMPLEMENTATION_REGISTER = register as unknown as ImplementationRegister;
export const CREATURES = IMPLEMENTATION_REGISTER.creatures;
export const SUPPORTS = IMPLEMENTATION_REGISTER.supports;
export const TEST_DECK: CardDefinition[] = [...CREATURES, ...SUPPORTS];
const DECK_2_SHARED_KEYS = new Set(["hoatzin"]);
export const DECK_2: CreatureCard[] = [
  ...CREATURES.filter((card) => DECK_2_SHARED_KEYS.has(card.key)),
  ...DECK_2_UNIQUE_CREATURES,
].sort((a, b) => a.printedLevel - b.printedLevel || a.name.localeCompare(b.name));
export const DECK_2_KEYS = new Set(DECK_2.map((card) => card.key));
const DECK_3_SHARED_KEYS = new Set(["horseshoe-crab", "nautilus"]);
export const DECK_3: CreatureCard[] = [
  ...CREATURES.filter((card) => DECK_3_SHARED_KEYS.has(card.key)),
  ...DECK_3_UNIQUE_CREATURES,
].sort((a, b) => a.printedLevel - b.printedLevel || a.name.localeCompare(b.name));
export const DECK_3_KEYS = new Set(DECK_3.map((card) => card.key));
const deckThreeInheritedKeySet = new Set<string>(DECK_3_INHERITED_SUPPORT_KEYS);
export const DECK_3_SUPPORTS: Array<EventCard | AdaptationCard | ConceptCard> = [
  ...SUPPORTS.filter((card) => deckThreeInheritedKeySet.has(card.key)),
  ...DECK_3_NEW_SUPPORTS,
];
export const DECK_3_DECK: CardDefinition[] = [...DECK_3, ...DECK_3_SUPPORTS];
const deckTwoSupportSources = [...SUPPORTS, ...DECK_3_NEW_SUPPORTS];
export const DECK_2_SUPPORTS: Array<EventCard | AdaptationCard | ConceptCard> = [
  ...DECK_2_INHERITED_SUPPORT_KEYS.map((key) => {
    const card = deckTwoSupportSources.find((candidate) => candidate.key === key);
    if (!card) throw new Error(`Deck 2 inherited Support ${key} is missing.`);
    return card;
  }),
  ...DECK_2_NEW_SUPPORTS,
];
export const DECK_2_DECK: CardDefinition[] = [...DECK_2, ...DECK_2_SUPPORTS];
export const DECKS: Record<DeckKey, CardDefinition[]> = {
  "deck-1": TEST_DECK,
  "deck-2": DECK_2_DECK,
  "deck-3": DECK_3_DECK,
};
export const DECK_LABELS: Record<DeckKey, string> = {
  "deck-1": "Deck 1 · Theropod Predators",
  "deck-2": "Deck 2 · Herbivore Development",
  "deck-3": "Deck 3 · Aquatic Carnivores",
};
export const GENERAL_POOL: CardDefinition[] = [
  ...IMPLEMENTATION_REGISTER.generalPool,
  ...GENERAL_POOL_CANDIDATES,
].filter((card) => !DECK_2_UNIQUE_KEYS.has(card.key) && !DECK_3_UNIQUE_KEYS.has(card.key));
export const TAG_RULES = IMPLEMENTATION_REGISTER.tagRules;
export const PENDING_ARTWORK_KEYS = new Set<string>();

export function artworkPath(card: CardDefinition): string | undefined {
  if (card.artwork) return card.artwork;
  return `/artwork/${card.key}.webp`;
}

if (
  CREATURES.length !== IMPLEMENTATION_REGISTER.deck.creatureCount ||
  SUPPORTS.length !== IMPLEMENTATION_REGISTER.deck.supportCount ||
  TEST_DECK.length !== IMPLEMENTATION_REGISTER.deck.size ||
  GENERAL_POOL.some((card) => TEST_DECK.some((playable) => playable.key === card.key)) ||
  DECK_2.length !== 23 ||
  DECK_2_SUPPORTS.length !== 17 ||
  DECK_2_DECK.length !== 40 ||
  new Set(DECK_2_DECK.map((card) => card.key)).size !== DECK_2_DECK.length ||
  DECK_2_INHERITED_SUPPORT_KEYS.some((key) => !deckTwoSupportSources.some((card) => card.key === key)) ||
  new Set(DECK_2.map((card) => card.key)).size !== DECK_2.length ||
  GENERAL_POOL.some((card) => DECK_2_KEYS.has(card.key)) ||
  DECK_3.length !== 22 ||
  DECK_3_SUPPORTS.length !== 18 ||
  DECK_3_DECK.length !== 40 ||
  new Set(DECK_3_DECK.map((card) => card.key)).size !== DECK_3_DECK.length ||
  DECK_3_INHERITED_SUPPORT_KEYS.some((key) => !SUPPORTS.some((card) => card.key === key)) ||
  new Set(DECK_3.map((card) => card.key)).size !== DECK_3.length ||
  GENERAL_POOL.some((card) => DECK_3_KEYS.has(card.key))
) {
  throw new Error("A playable deck register or the General Pool is inconsistent.");
}

export function expandedTagNames(card: CreatureCard): string[] {
  const names = [...card.tags];
  if (card.tags.includes("Sovereign")) {
    names.push("Gigantic");
    if (card.diet !== "Herbivore") names.push("Territorial");
  }
  return [...new Set(names)];
}

export function countsAsAquatic(card: CreatureCard): boolean {
  // This helper is intentionally limited to Event and Concept effects.
  return card.tags.includes("Aquatic") || card.tags.includes("Semi-Aquatic");
}

export function hasPrintedAquatic(card: CreatureCard): boolean {
  return card.tags.includes("Aquatic");
}

export function tagEffectMultiplier(card: CreatureCard, tag: string): number {
  return card.tags.some((listedTag, index) => listedTag === tag && card.tags[index - 1] === "Specialized") ? 2 : 1;
}
