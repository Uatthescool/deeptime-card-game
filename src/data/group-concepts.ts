import type { ConceptCard } from "./types";

const STATUS = "Not playable · Work in progress" as const;

/** Placeholder rules for a Group Concept whose effect isn't designed yet. */
export const GROUP_CONCEPT_PLACEHOLDER = "No card effect or flavor text at this time.";

/**
 * Group Concepts: Concepts named for a group of animals, teaching the group's name and bringing in animals that
 * would never be Creature cards. They play and count as Concepts for every rule. They wait in the General Pool;
 * most are still placeholders. Origins of each term are in design/group-concepts.md.
 */
const GROUP_NAMES = [
  "Cauldron of Bats",
  "Murder of Crows",
  "Parliament of Owls",
  "Tower of Giraffes",
  "Dazzle of Zebras",
  "Conspiracy of Lemurs",
  "Flamboyance of Flamingos",
  "Crash of Rhinoceroses",
  "Kaleidoscope of Butterflies",
  "Murmuration of Starlings",
  "Skulk of Foxes",
  "Business of Ferrets",
];

const keyOf = (name: string) => name.toLowerCase().replace(/\s+/g, "-");

/** Group Concepts whose effects are designed and built. The rest show the placeholder. */
const GROUP_RULES: Record<string, string> = {
  "Parliament of Owls":
    "Draw 3 cards. Then shuffle one of the cards drawn this way into your deck and send another of them to your History Pile.",
  "Kaleidoscope of Butterflies":
    "Return a Creature on your side of the board to your hand. You may then play it as an extra Creature play. If you do, your Development Phase ends once that play's effects have resolved.",
  "Dazzle of Zebras": "Your opponent shuffles their hand into their deck, then draws 3 cards.",
  "Tower of Giraffes":
    "Search your deck for an Artiodactyl, reveal it, add it to your hand, then shuffle your deck. If it has Overreach, you may play it into a Niche as an extra Creature play, following normal Level rules.",
};

export const GROUP_CONCEPTS: ConceptCard[] = GROUP_NAMES.map((name) => ({
  key: keyOf(name),
  kind: "concept",
  group: true,
  name,
  rules: GROUP_RULES[name] ?? GROUP_CONCEPT_PLACEHOLDER,
  cardFace: `/card-faces/${keyOf(name)}.webp`,
  status: STATUS,
}));
