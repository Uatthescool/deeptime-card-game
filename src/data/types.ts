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
