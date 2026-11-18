export type Diet = "Carnivore" | "Herbivore" | "Omnivore";

export const PERIODS = [
  "Cambrian",
  "Ordovician",
  "Silurian",
  "Devonian",
  "Carboniferous",
  "Permian",
  "Triassic",
  "Jurassic",
  "Cretaceous",
  "Paleogene",
  "Neogene",
  "Quaternary",
] as const;

export type Period = (typeof PERIODS)[number];

/** The seven continents, as present-day landmasses where a Creature's fossils have been found. */
export const CONTINENTS = [
  "North America",
  "South America",
  "Europe",
  "Africa",
  "Asia",
  "Oceania",
  "Antarctica",
] as const;
export type Continent = (typeof CONTINENTS)[number];

/** A Creature found on three or more continents is Widespread: one place of its own, shown as the globe. */
export const WIDESPREAD = "Widespread" as const;
export type ContinentFlag = Continent | typeof WIDESPREAD;

/**
 * The places a Creature counts as: its continents when it has one or two, otherwise only Widespread, which
 * counts as none of its continents.
 */
export function continentFlags(card: { continents?: readonly Continent[] }): ContinentFlag[] {
  const continents = card.continents ?? [];
  return continents.length >= 3 ? [WIDESPREAD] : [...continents];
}

export type CardStatus = "Locked" | "Not playable · Work in progress";
export type DeckKey = "deck-1" | "deck-2" | "deck-3" | "deck-4";

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
  flavorText: string;
  /** True for a species alive today. Its continents then cover where it lives as well as its fossils. */
  living?: boolean;
  /** Present-day continents where its fossils have been found (and, for a living species, where it lives); shown as the continent mark. Not yet recorded for every Creature. */
  continents?: Continent[];
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
  cardFace?: string;
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
    | "aerial-or-aquatic-synapsid-carnivore"
    | "any";
  artwork?: string;
  cardFace?: string;
  status: CardStatus;
};

export type ConceptCard = {
  key: string;
  kind: "concept";
  /** A Group Concept, named for a group of animals ("Concept · Group"). */
  group?: boolean;
  name: string;
  rules: string;
  note?: string;
  artwork?: string;
  cardFace?: string;
  status: CardStatus;
};

export type SupportCard = EventCard | AdaptationCard | ConceptCard;
export type CardDefinition = CreatureCard | SupportCard;

export type TagCombo = { with: string; rule: string };

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
  /** Combos: extra effects a Tag has only while the Creature also has the partner Tag (`with`). */
  tagCombos: Record<string, TagCombo[]>;
  creatures: CreatureCard[];
  supports: SupportCard[];
  generalPool: CardDefinition[];
};
