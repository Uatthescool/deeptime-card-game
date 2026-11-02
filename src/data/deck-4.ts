import type { AdaptationCard, ConceptCard, CreatureCard, Diet, EventCard, Period } from "./types";

/** Deck 4 is still being designed: it can be inspected, but no player can select it yet. */
const STATUS = "Not playable · Work in progress" as const;

type DeckFourCreature = {
  key: string;
  name: string;
  scientificName: string;
  printedLevel: 0 | 1 | 2 | 3 | 4;
  diet: Diet;
  period: Period;
  periodColor: string;
  taxa: string[];
  tags: string[];
  flavorText: string;
  cardFace?: string;
};

const MAMMAL = ["Vertebrate", "Amniote", "Synapsid", "Mammal"];

const creature = ({ taxa, ...entry }: DeckFourCreature): CreatureCard => ({
  kind: "creature",
  status: STATUS,
  gameplayTaxon: "Synapsid",
  taxa: [...MAMMAL, ...taxa],
  visualTags: [],
  ...entry,
});

export const DECK_4_UNIQUE_CREATURES: CreatureCard[] = [
  creature({
    key: "pakicetus",
    name: "Pakicetus",
    scientificName: "Pakicetus attocki",
    printedLevel: 0,
    diet: "Carnivore",
    period: "Paleogene",
    periodColor: "Magenta",
    taxa: ["Artiodactyl", "Cetacean", "Pakicetid"],
    tags: ["Semi-Aquatic", "Transitional"],
    flavorText:
      "Named for Pakistan, where its fossils were found, Pakicetus was one of the earliest whales, yet it lived mostly on land, wading in shallow streams with its eyes set high on its skull like a crocodile’s.",
    cardFace: "/card-faces/pakicetus.webp",
  }),
  creature({
    key: "phiomia",
    name: "Phiomia",
    scientificName: "Phiomia serridens",
    printedLevel: 1,
    diet: "Herbivore",
    period: "Paleogene",
    periodColor: "Magenta",
    taxa: ["Proboscidean", "Elephantiform"],
    tags: ["Transitional"],
    flavorText:
      "Named for Egypt’s Fayum, home to many early elephant relatives, Phiomia had a short trunk and tusks in both jaws.",
    cardFace: "/card-faces/phiomia.webp",
  }),
  creature({
    key: "steppe-bison",
    name: "Steppe Bison",
    scientificName: "Bison priscus",
    printedLevel: 1,
    diet: "Herbivore",
    period: "Quaternary",
    periodColor: "Ice Blue",
    taxa: ["Artiodactyl", "Bovid", "Bovine"],
    tags: ["Herd"],
    flavorText:
      "Painted by Ice Age artists on the walls of caves like Altamira and Lascaux, steppe bison roamed from Europe across Beringia into North America.",
    cardFace: "/card-faces/steppe-bison.webp",
  }),
  creature({
    key: "castoroides",
    name: "Castoroides",
    scientificName: "Castoroides ohioensis",
    printedLevel: 1,
    diet: "Herbivore",
    period: "Quaternary",
    periodColor: "Ice Blue",
    taxa: ["Rodent", "Castorid"],
    tags: ["Semi-Aquatic", "Generalist"],
    flavorText:
      "Castoroides was a beaver nearly the size of a black bear, but its bones show it ate water plants rather than trees, so it likely never felled trees or built dams.",
    cardFace: "/card-faces/castoroides.webp",
  }),
  creature({
    key: "glyptodon",
    name: "Glyptodon",
    scientificName: "Glyptodon clavipes",
    printedLevel: 1,
    diet: "Herbivore",
    period: "Quaternary",
    periodColor: "Ice Blue",
    taxa: ["Xenarthran", "Cingulate", "Glyptodont"],
    tags: ["Osteoderm"],
    flavorText:
      "A giant armadillo, as ancient DNA confirms, Glyptodon wore a shell of more than a thousand bony plates fused into a single dome.",
    cardFace: "/card-faces/glyptodon.webp",
  }),
  creature({
    key: "hyaenodon",
    name: "Hyaenodon",
    scientificName: "Hyaenodon horridus",
    printedLevel: 1,
    diet: "Carnivore",
    period: "Paleogene",
    periodColor: "Magenta",
    taxa: ["Hyaenodont", "Hyaenodontid"],
    tags: ["Apex Predator", "Mob Feeder"],
    flavorText:
      "Actually neither hyena nor dog, the wolf-like Hyaenodon belonged to an extinct group of predators and had several pairs of scissor-like slicing teeth, where cats and dogs have only one.",
    cardFace: "/card-faces/hyaenodon.webp",
  }),
  creature({
    key: "ambulocetus",
    name: "Ambulocetus",
    scientificName: "Ambulocetus natans",
    printedLevel: 1,
    diet: "Carnivore",
    period: "Paleogene",
    periodColor: "Magenta",
    taxa: ["Artiodactyl", "Cetacean", "Ambulocetid"],
    tags: ["Semi-Aquatic", "Ambush"],
    flavorText:
      "Its name means “walking whale that swims.” Ambulocetus could still walk on land, swam with large hind feet, and likely hunted from ambush in shallow water like a crocodile.",
    cardFace: "/card-faces/ambulocetus.webp",
  }),
  creature({
    key: "mastodon",
    name: "Mastodon",
    scientificName: "Mammut americanum",
    printedLevel: 2,
    diet: "Herbivore",
    period: "Quaternary",
    periodColor: "Ice Blue",
    taxa: ["Proboscidean", "Mammutid"],
    tags: ["Gigantic", "Herd"],
    flavorText:
      "A bone point lodged in a mastodon rib from Washington State suggests people hunted mastodons about 13,800 years ago; Thomas Jefferson later thought they might still roam the unexplored West, and in 1801 Charles Willson Peale mounted one dug up in New York as America’s first displayed fossil skeleton.",
    cardFace: "/card-faces/mastodon.webp",
  }),
  creature({
    key: "hippopotamus",
    name: "Hippopotamus",
    scientificName: "Hippopotamus amphibius",
    printedLevel: 2,
    diet: "Herbivore",
    period: "Quaternary",
    periodColor: "Ice Blue",
    taxa: ["Artiodactyl", "Hippopotamid"],
    tags: ["Semi-Aquatic", "Territorial", "Herd"],
    flavorText:
      "Hippos are the closest living relatives of whales, and about 125,000 years ago, during a warm spell between ice ages, they wallowed in the Thames where London now stands.",
    cardFace: "/card-faces/hippopotamus.webp",
  }),
  creature({
    key: "woolly-rhino",
    name: "Woolly Rhino",
    scientificName: "Coelodonta antiquitatis",
    printedLevel: 2,
    diet: "Herbivore",
    period: "Quaternary",
    periodColor: "Ice Blue",
    taxa: ["Perissodactyl", "Rhinocerotoid", "Rhinocerotid"],
    tags: ["Charge", "Solitary"],
    flavorText:
      "Painted in Chauvet Cave more than 30,000 years ago, woolly rhinos grew their front horns in yearly bands like tree rings, flattened side to side, possibly for sweeping snow off buried grass.",
    cardFace: "/card-faces/woolly-rhino.webp",
  }),
  creature({
    key: "basilosaurus",
    name: "Basilosaurus",
    scientificName: "Basilosaurus isis",
    printedLevel: 2,
    diet: "Carnivore",
    period: "Paleogene",
    periodColor: "Magenta",
    taxa: ["Artiodactyl", "Cetacean", "Basilosaurid"],
    tags: ["Aquatic", "Apex Predator"],
    flavorText:
      "Named “king lizard” by a discoverer who mistook it for a marine reptile, Basilosaurus was a whale that still kept tiny hind legs, far too small to walk on.",
    cardFace: "/card-faces/basilosaurus.webp",
  }),
];

/** Creatures Deck 4 borrows from Deck 3 and the General Pool candidates. */
export const DECK_4_SHARED_CREATURE_KEYS = [
  "lystrosaurus",
  "thrinaxodon",
  "dire-wolf",
  "megatherium",
  "smilodon",
  "orca",
  "woolly-mammoth",
  "paraceratherium",
  "arctotherium",
  "livyatan",
  "blue-whale",
] as const;

/** 12 of the deck's 18 Supports; with its 4 new ones that leaves 2 still to design. */
export const DECK_4_INHERITED_SUPPORT_KEYS = [
  "wildfire",
  "drought",
  "island-dwarfism",
  "cryptic-camouflage",
  "evolutionary-radiation",
  "whale-fall",
  "obligate-migration",
  "dig-site-excavation",
  "natural-selection",
  "rapid-speciation",
  "biogenesis",
  "genetic-drift",
] as const;

/** Climate events that are feedback loops or their results; some aren't cards yet. */
const FEEDBACK_LOOP_NAMES = [
  "Ice Age",
  "Paleocene–Eocene Thermal Maximum",
  "Drought",
  "Snowball Earth",
  "The Great Dying",
  "The Great Oxidation Event",
];

export const DECK_4_NEW_SUPPORTS: (EventCard | AdaptationCard | ConceptCard)[] = [
  {
    key: "ice-age",
    kind: "event",
    eventType: "continuous",
    name: "Ice Age",
    rules:
      "For overrides, Synapsids from the Paleogene, Neogene, or Quaternary match every Time Period. Creatures from the Cambrian, Triassic, Jurassic, or Cretaceous contribute 1 less Victory Level. When Ice Age leaves your Event Zone, your Creatures contribute no Victory Levels until the end of your third turn after it left.",
    note: "Working wording; its effects are not built into the game yet.",
    cardFace: "/card-faces/ice-age.webp",
    status: STATUS,
  },
  {
    key: "paleocene-eocene-thermal-maximum",
    kind: "event",
    eventType: "instant",
    name: "Paleocene–Eocene Thermal Maximum",
    rules:
      "Send a Level 0 or 1 Creature on the board to its owner’s History Pile. If it was yours, you may search your deck for up to two Creatures that share at least two taxa listed AFTER its Primary Taxon, reveal them, add them to your hand, then shuffle your deck. If it was your opponent’s, send the Event in your Event Zone, if any, to your History Pile.",
    note: "Working wording; its effects are not built into the game yet.",
    cardFace: "/card-faces/paleocene-eocene-thermal-maximum.webp",
    status: STATUS,
  },
  {
    key: "feedback-loops",
    kind: "concept",
    name: "Feedback Loops",
    rules: [
      "Search your deck for a card whose name appears below, reveal it, add it to your hand, then shuffle your deck.",
      "During your Development Phase, while Feedback Loops is in your History Pile, you may send a card whose name appears below from your hand to your History Pile. If you do, return Feedback Loops to your hand.",
      FEEDBACK_LOOP_NAMES.map((name) => `• ${name}`).join("\n"),
    ].join("\n\n"),
    note: "Working wording; its effects are not built into the game yet. Snowball Earth, The Great Dying and The Great Oxidation Event aren't cards yet.",
    cardFace: "/card-faces/feedback-loops.webp",
    status: STATUS,
  },
  {
    key: "echolocation",
    kind: "adaptation",
    name: "Echolocation",
    eligibility: "aerial-or-aquatic-synapsid-carnivore",
    rules:
      "Attach only to an Aerial or Aquatic Synapsid Carnivore that isn't a Filter Feeder. When the attached Creature Hunts, ignore the defending Creature's defensive Tags and defensive Adaptations.",
    note: "Defensive Tags: Shell, Dermal Armor, Osteoderm, Bastion, Retaliation, Elusive, Aerial, Burrower, Deimatic, Gigantic and Cranial Display. Defensive Adaptations: Cryptic Camouflage and Thagomizer. An ignored Tag has no effect during that Hunt, including its survival clause, an adjacent Bastion's bonus and Gigantic's Cold Biome bonus. Semi-Aquatic doesn't count as Aquatic for Adaptations, and Glider doesn't count as Aerial here.",
    cardFace: "/card-faces/echolocation.webp",
    status: STATUS,
  },
];

export const DECK_4_UNIQUE_KEYS = new Set([
  ...DECK_4_UNIQUE_CREATURES.map((card) => card.key),
  ...DECK_4_NEW_SUPPORTS.map((card) => card.key),
]);
