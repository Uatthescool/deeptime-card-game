export type BiomeKey = "tropical" | "temperate" | "cold" | "arid" | "aquatic";

export type BiomeDefinition = {
  key: BiomeKey;
  name: string;
  abilityName: string;
  subBiomes: string[];
  rules: string;
  flavor: string;
  shortRules: string;
};

export const BIOMES: BiomeDefinition[] = [
  {
    key: "tropical",
    name: "Tropical",
    abilityName: "Biodiversity",
    subBiomes: [
      "Tropical rainforests",
      "Tropical seasonal and dry forests",
      "Savannas",
    ],
    rules:
      "At the start of each of your turns, before drawing any cards for the turn, you may look at the top two cards of your deck and return them to the top in either order. This ability does not trigger during a Start Phase in which an effect will cause you to draw multiple cards.",
    flavor:
      "Tropical ecosystems support exceptional species richness and intricate ecological interactions. Greater diversity creates more possible strategies for occupying every niche.",
    shortRules: "Order the top two cards before a single-card Start Phase draw.",
  },
  {
    key: "temperate",
    name: "Temperate",
    abilityName: "Seasonal Cycle",
    subBiomes: [
      "Chaparral",
      "Temperate forests and rainforests",
      "Temperate grasslands",
      "Steppes",
    ],
    rules:
      "This Biome begins the game with four Season counters. Once per turn, after you flip a coin, you may remove one Season counter from this Biome to reroll that coin. You must use the new result.",
    flavor:
      "Seasonal change governs phenology—the timing of growth, migration, reproduction, and dormancy. Temperate organisms endure by adjusting their lives as conditions turn.",
    shortRules: "Spend one of four Season counters to reroll a coin once per turn.",
  },
  {
    key: "cold",
    name: "Cold",
    abilityName: "Thermal Inertia",
    subBiomes: [
      "Taiga and boreal forests",
      "Arctic tundra",
      "Alpine tundra",
      "Polar environments",
    ],
    rules:
      "The Gigantic Tag gains the following effect for Creatures you control: \u201cWhile this Creature is defending, it gets +1 Battle Level unless the hunting Creature has Gigantic or Bruiser.\u201d",
    flavor:
      "As body size increases, surface area does not keep pace with volume. Gigantic animals therefore exchange heat more slowly with their surroundings, giving them greater thermal inertia in the cold.",
    shortRules: "Gigantic gains a conditional +1 defensive Battle Level effect.",
  },
  {
    key: "arid",
    name: "Arid",
    abilityName: "Tipping Point",
    subBiomes: [
      "Subtropical deserts",
      "Temperate deserts",
      "Cold deserts",
    ],
    rules:
      "At the start of your turn, if the game is on Turn 26 or later, you have 10 or more Victory Levels, and your opponent controls no Creatures, you win the game.",
    flavor:
      "Drylands can cross ecological thresholds. As vegetation disappears, runoff and erosion intensify, weakening the processes that might otherwise restore the ecosystem.",
    shortRules: "On Turn 26+, win at 10 Victory Levels against an empty opposing board.",
  },
  {
    key: "aquatic",
    name: "Aquatic",
    abilityName: "Connected Waterways",
    subBiomes: [
      "Oceans and coral reefs",
      "Estuaries and wetlands",
      "Rivers and streams",
      "Lakes and ponds",
    ],
    rules:
      "Once per turn during your Development Phase, you may reposition one Creature you control into an empty Niche. This does not use your normal Creature play, does not count as filling the destination Niche, and cannot activate effects triggered by filling a Niche. Once per game during your Development Phase, you may perform one legal override without using your normal Creature play. You cannot override the same Niche twice that turn. After that override resolves, you can no longer reposition Creatures with Connected Waterways.",
    flavor:
      "Currents, floods, and branching channels connect populations and carry organisms between habitats. As rivers migrate, a meander may be cut off; the resulting isolation reduces gene flow and can send populations down separate evolutionary paths.",
    shortRules: "Reposition once per turn, or permanently disconnect to gain one free override.",
  },
];

export const biomeByKey = (key: BiomeKey) => BIOMES.find((biome) => biome.key === key)!;
