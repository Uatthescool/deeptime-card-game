import type { Continent, CreatureCard, Diet, Period } from "./types";

/** Deck 5 is still being designed: it can be inspected, but no player can select it yet. */
const STATUS = "Not playable · Work in progress" as const;

type DeckFiveCreature = {
  key: string;
  name: string;
  scientificName: string;
  printedLevel: 0 | 1 | 2 | 3 | 4;
  diet: Diet;
  period: Period;
  living?: boolean;
  continents?: Continent[];
  periodColor: string;
  gameplayTaxon: string;
  taxa: string[];
  tags: string[];
  flavorText: string;
  cardFace?: string;
};

const creature = (entry: DeckFiveCreature): CreatureCard => ({
  kind: "creature",
  status: STATUS,
  visualTags: [],
  ...entry,
});

/** Deck 5 is unfinished: it can be inspected, but it isn't in DECKS, so no player can select it. */
export const DECK_5_INFO = {
  number: 5,
  name: "Aerial",
  summary: "Fliers and gliders from many lineages, built around the Aerial Tag and the convergent evolution of wings.",
};

/** Deck 1 Creatures that Deck 5 also uses. */
export const DECK_5_SHARED_CREATURE_KEYS = ["microraptor", "hoatzin", "archaeopteryx", "pelagornis"] as const;

export const DECK_5_UNIQUE_CREATURES: CreatureCard[] = [
  creature({
    key: "hatzegopteryx",
    name: "Hatzegopteryx",
    scientificName: "Hatzegopteryx thambema",
    printedLevel: 3,
    diet: "Carnivore",
    period: "Cretaceous",
    continents: ["Europe"],
    periodColor: "Lime Green",
    gameplayTaxon: "Archosaur",
    taxa: ["Vertebrate", "Amniote", "Archosaur", "Pterosaur", "Pterodactyloid", "Azhdarchid"],
    tags: ["Aerial", "Sovereign", "Apex Predator"],
    flavorText:
      "Hațeg Island had no large predatory dinosaurs, so this giant azhdarchid, with wings spanning roughly 10 meters, may have been its top predator. Its short, massively built neck could bear the strain of prey too large for its long-necked relatives.",
    cardFace: "/card-faces/hatzegopteryx.webp",
  }),
  creature({
    key: "quetzalcoatlus",
    name: "Quetzalcoatlus",
    scientificName: "Quetzalcoatlus northropi",
    printedLevel: 3,
    diet: "Carnivore",
    period: "Cretaceous",
    continents: ["North America"],
    periodColor: "Lime Green",
    gameplayTaxon: "Archosaur",
    taxa: ["Vertebrate", "Amniote", "Archosaur", "Pterosaur", "Pterodactyloid", "Azhdarchid"],
    tags: ["Aerial", "Gigantic", "Small Game Hunter"],
    flavorText:
      "Named for the Aztec feathered-serpent god, Quetzalcoatlus had wings spanning about 10 to 11 meters. Rather than skimming fish from water, it probably stalked open ground on all fours like a giant stork, picking off small animals with its long, stiff neck.",
    cardFace: "/card-faces/quetzalcoatlus.webp",
  }),
  creature({
    key: "argentavis",
    name: "Argentavis",
    scientificName: "Argentavis magnificens",
    printedLevel: 2,
    diet: "Carnivore",
    period: "Neogene",
    continents: ["South America"],
    periodColor: "Golden Ochre",
    gameplayTaxon: "Archosaur",
    taxa: [
      "Vertebrate",
      "Amniote",
      "Archosaur",
      "Dinosaur",
      "Saurischian",
      "Theropod",
      "Tetanuran",
      "Coelurosaur",
      "Paravian",
      "Avialan",
      "Bird",
      "Teratornithid",
    ],
    tags: ["Aerial", "Gigantic", "Scavenger", "Small Game Hunter"],
    flavorText:
      "The heaviest flying bird known, Argentavis weighed an estimated 65 to 120 kilograms and spread wings about 6 meters across. It likely soared on rising air over Miocene Argentina; whether it hunted or scavenged is still debated.",
    cardFace: "/card-faces/argentavis.webp",
  }),
  creature({
    key: "haasts-eagle",
    name: "Haast's Eagle",
    scientificName: "Hieraaetus moorei",
    printedLevel: 2,
    diet: "Carnivore",
    period: "Quaternary",
    continents: ["Oceania"],
    periodColor: "Ice White",
    gameplayTaxon: "Archosaur",
    taxa: [
      "Vertebrate",
      "Amniote",
      "Archosaur",
      "Dinosaur",
      "Saurischian",
      "Theropod",
      "Tetanuran",
      "Coelurosaur",
      "Paravian",
      "Avialan",
      "Bird",
      "Accipitrid",
    ],
    tags: ["Aerial", "Apex Predator", "Ambush", "Raptorial"],
    flavorText:
      "The largest eagle known, Haast's eagle killed moa many times its own weight, diving from a high perch and striking from behind; puncture wounds in moa hip bones record its attacks. It vanished around 1400, soon after people hunted the moa to extinction.",
    cardFace: "/card-faces/haasts-eagle.webp",
  }),
  creature({
    key: "pteranodon",
    name: "Pteranodon",
    scientificName: "Pteranodon longiceps",
    printedLevel: 1,
    diet: "Carnivore",
    period: "Cretaceous",
    continents: ["North America"],
    periodColor: "Lime Green",
    gameplayTaxon: "Archosaur",
    taxa: ["Vertebrate", "Amniote", "Archosaur", "Pterosaur", "Pterodactyloid", "Pteranodontid"],
    tags: ["Aerial", "Diver", "Cranial Display"],
    flavorText:
      "Pteranodon fished far out over the inland sea that split Cretaceous North America; fish bones lie in the stomach region of one specimen. Adults came in two sizes: large, tall-crested individuals thought to be males, and smaller, low-crested females.",
    cardFace: "/card-faces/pteranodon.webp",
  }),
  creature({
    key: "pterodaustro",
    name: "Pterodaustro",
    scientificName: "Pterodaustro guinazui",
    printedLevel: 1,
    diet: "Carnivore",
    period: "Cretaceous",
    continents: ["South America"],
    periodColor: "Lime Green",
    gameplayTaxon: "Archosaur",
    taxa: ["Vertebrate", "Amniote", "Archosaur", "Pterosaur", "Pterodactyloid", "Ctenochasmatid"],
    tags: ["Aerial", "Specialized", "Filter Feeder", "Nesting"],
    flavorText:
      "Pterodaustro strained food from Early Cretaceous lakes in Argentina through a lower jaw lined with about a thousand bristle-like teeth, much as flamingos do today. More than 750 specimens, including an embryo still in its egg, come from a single site.",
    cardFace: "/card-faces/pterodaustro.webp",
  }),
  creature({
    key: "meganeura",
    name: "Meganeura",
    scientificName: "Meganeura monyi",
    printedLevel: 0,
    diet: "Carnivore",
    period: "Carboniferous",
    continents: ["Europe"],
    periodColor: "Navy Blue",
    gameplayTaxon: "Pancrustacean",
    taxa: [
      "Invertebrate",
      "Protostome",
      "Ecdysozoan",
      "Euarthropod",
      "Mandibulate",
      "Pancrustacean",
      "Insect",
      "Odonatopteran",
      "Meganeurid",
    ],
    tags: ["Aerial", "Raptorial", "Elusive"],
    flavorText:
      "With wings spanning about 65 to 70 centimeters, Meganeura was among the largest insects ever. This griffinfly, an early relative of dragonflies, hunted other insects through Carboniferous forests, probably snatching them with its spiny legs.",
    cardFace: "/card-faces/meganeura.webp",
  }),
  creature({
    key: "ambopteryx",
    name: "Ambopteryx",
    scientificName: "Ambopteryx longibrachium",
    printedLevel: 0,
    diet: "Omnivore",
    period: "Jurassic",
    continents: ["Asia"],
    periodColor: "Logo Red",
    gameplayTaxon: "Archosaur",
    taxa: [
      "Vertebrate",
      "Amniote",
      "Archosaur",
      "Dinosaur",
      "Saurischian",
      "Theropod",
      "Tetanuran",
      "Coelurosaur",
      "Scansoriopterygid",
    ],
    tags: ["Glider", "Elusive", "Dead End"],
    flavorText:
      "Its name means “both wings”: this pigeon-sized dinosaur had feathers and bat-like wings of skin stretched over a long, rod-like wrist bone. Gizzard stones and bone fragments preserved in its stomach suggest it ate both plants and animals.",
    cardFace: "/card-faces/ambopteryx.webp",
  }),
  creature({
    key: "weigeltisaurus",
    name: "Weigeltisaurus",
    scientificName: "Weigeltisaurus jaekeli",
    printedLevel: 0,
    diet: "Carnivore",
    period: "Permian",
    continents: ["Europe"],
    periodColor: "Slate Gray",
    gameplayTaxon: "Diapsid",
    taxa: ["Vertebrate", "Amniote", "Diapsid", "Weigeltisaurid"],
    tags: ["Glider", "Cranial Display", "Dead End"],
    flavorText:
      "One of the earliest known gliding vertebrates, Weigeltisaurus spread a membrane of skin over long, hollow rods of bone along its flanks. Its skull bristled with horns, including a horned frill at the back of its head.",
    cardFace: "/card-faces/weigeltisaurus.webp",
  }),
];

export const DECK_5_UNIQUE_KEYS = new Set(DECK_5_UNIQUE_CREATURES.map((card) => card.key));
