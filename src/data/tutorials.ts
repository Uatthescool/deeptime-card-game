/**
 * Tutorials: short guided tours. Each step lights one part of its scene, dims the rest, and explains the lit part.
 * A step's `target` names an element in the scene marked with a matching `data-tutorial-target`.
 */

export type TutorialGroup = "science" | "play";

/** A paragraph, or a term with its explanation (shown as a list). */
export type TutorialCopy = string | { term: string; text: string };

/** What a tutorial plays over: a card, the Biome choice screen, or a staged game board. */
export type TutorialScene = "card-anatomy" | "biome-choice" | "board";

export type TutorialStep = {
  /** The lit part: a `data-tutorial-target` name, or names separated by spaces for a part inside another part. */
  target: string;
  /** The scene for this step, when it differs from the tutorial's. */
  scene?: TutorialScene;
  title: string;
  body: TutorialCopy[];
};

export type TutorialDefinition = {
  id: string;
  group: TutorialGroup;
  title: string;
  summary: string;
  /** Which scene the tutorial plays over. */
  scene: TutorialScene;
  steps: TutorialStep[];
};

export const TUTORIAL_GROUPS: Record<TutorialGroup, { title: string; summary: string }> = {
  science: { title: "Learn the science", summary: "What the cards say about real animals." },
  play: { title: "How to play", summary: "The rules, one idea at a time." },
};

export const TUTORIALS: TutorialDefinition[] = [
  {
    id: "card-anatomy",
    group: "science",
    title: "Anatomy of a card",
    summary: "Every part of a creature card, using the Nautilus.",
    scene: "card-anatomy",
    steps: [
      {
        target: "card",
        title: "Meet a creature card",
        body: [
          "Every creature card is a small field-guide entry for a real animal: what it is called, where it sits on the tree of life, what it ate, and when it lived.",
          "This one is the Nautilus. Let’s go through it part by part.",
        ],
      },
      {
        target: "common-name",
        title: "Common name",
        body: [
          "Nautilus is the animal’s everyday name. Common names are easy to say and remember, but they can be vague: “nautilus” is used for several different species, living and extinct.",
        ],
      },
      {
        target: "scientific-name",
        title: "Scientific name",
        body: [
          "Nautilus praepompilius is its scientific name. The first word is the genus, always capitalised; the second is the species, always lower case. Both are written in italics.",
          "Every species has exactly one scientific name, used by scientists everywhere, in every language. This species is known only from fossils. Its name means “before pompilius”, after the living chambered nautilus, Nautilus pompilius.",
        ],
      },
      {
        target: "diet",
        title: "Diet",
        body: [
          "The icon shows what the animal ate. A drumstick means Carnivore, a leaf means Herbivore, and a burger, with both meat and greens, means Omnivore.",
          "The Nautilus is a Carnivore. Living nautiluses hunt and scavenge, tracking down crabs, shrimp and carcasses mostly by smell.",
        ],
      },
      {
        target: "art",
        title: "Art",
        body: [
          "The picture shows the animal as it may have looked when it was alive.",
          "Fossils mostly preserve hard parts such as shells, bones and teeth, so artists work out the soft tissue and colour from the fossils and from living relatives. The Nautilus is a lucky case: living nautiluses show us almost exactly what it looked like.",
        ],
      },
      {
        target: "taxa",
        title: "Taxa: its place on the tree of life",
        body: [
          "The Taxa line places the animal among its relatives, from the broadest group to the narrowest, like an address that goes from country down to street.",
          {
            term: "Invertebrate",
            text: "An animal without a backbone. It is a handy label rather than one true branch of the tree.",
          },
          { term: "Protostome", text: "A huge branch of animals that includes insects, worms and mollusks." },
          { term: "Mollusk", text: "Soft-bodied animals, often with a shell, such as snails, clams and octopuses." },
          {
            term: "Cephalopod",
            text: "“Head-foot”: mollusks whose arms grow from their heads, such as squid, octopuses, cuttlefish and nautiluses.",
          },
          { term: "Nautilid", text: "The nautilus branch, with coiled, chambered shells." },
        ],
      },
      {
        target: "gameplay-taxon",
        title: "The Primary Taxon",
        body: [
          "On every card, one taxon is bold and underlined: the Primary Taxon. Here it is Mollusk.",
          "It marks a broad branch of the tree of life, chosen at a similar level on every card: big groups such as mollusks, cartilaginous fishes and archosaurs.",
          "It also plays a part in the game, which the How to Play tutorials will cover.",
        ],
      },
      {
        target: "tags",
        title: "Tags",
        body: [
          "Tags name the animal’s traits and way of life. The Nautilus has four.",
          {
            term: "Living Fossil",
            text: "Its lineage has changed little over a very long time; nautiloids go back nearly 500 million years.",
          },
          {
            term: "Shell",
            text: "Its coiled shell is divided into gas-filled chambers that it uses to float at the right depth.",
          },
          { term: "Aquatic", text: "It lives in water." },
          { term: "Propulsion", text: "It swims by jetting water out of a funnel." },
          "Each Tag also does something in play. The How to Play tutorials cover that.",
        ],
      },
      {
        target: "flavor",
        title: "Flavor text",
        body: [
          "The flavor text at the bottom is a real fact about the animal: how it lived, or what its fossils show.",
        ],
      },
      {
        target: "level",
        title: "Level",
        body: [
          "The Level is a game number, not a biological one. An empty Niche takes a Level 0 or 1 Creature, and an override can rise at most one Level at a time. A Creature’s Level also counts toward the 12 Victory Levels that win the game.",
          "It does not rank animals. A Level 3 animal is not more advanced than a Level 0 one: every species alive today has an ancestry exactly as long as every other’s.",
        ],
      },
      {
        target: "period",
        title: "When it lived",
        body: [
          "The footer gives the period the animal lived in: here, the Early Paleogene.",
          "The Paleogene Period ran from about 66 to 23 million years ago, beginning just after the extinction that ended the non-avian dinosaurs. Early, Middle or Late narrows it down. Cards for animals still alive today show the period alone.",
        ],
      },
      {
        target: "card",
        title: "Border",
        body: [
          "The border’s colour and texture mark the period too, so you can tell at a glance when a card’s animal lived. Every Paleogene card shares this magenta border.",
        ],
      },
      {
        target: "card",
        title: "That’s the whole card",
        body: [
          "Name, place on the tree of life, diet, traits, time and a real fact: every creature card carries the same parts.",
          "To read more about the animals, open Learn Something from the main screen at any time.",
        ],
      },
    ],
  },
  {
    id: "the-table",
    group: "play",
    title: "The table",
    summary: "Biomes, the board, your hand and when you draw: everything before your first play.",
    scene: "board",
    steps: [
      {
        scene: "biome-choice",
        target: "biome-grid",
        title: "Choose your Biome",
        body: [
          "Before any cards are dealt, each player secretly chooses one of five Biomes. Yours changes the rules on your side of the table for the whole game.",
        ],
      },
      {
        scene: "biome-choice",
        target: "biome-temperate",
        title: "Reading a Biome",
        body: [
          "Each Biome lists the real environments it stands for, its ability, and the science behind that ability.",
          "Temperate’s Seasonal Cycle, for example, gives you four Season counters. Once per turn, after you flip a coin, you may spend one to flip that coin again.",
        ],
      },
      {
        scene: "biome-choice",
        target: "biome-confirm",
        title: "Lock it in",
        body: [
          "Confirm your choice. With two players on one device, you then pass it over so the other player can choose in private. Against the computer, it chooses without seeing yours.",
          "Both Biomes are revealed together, and then the opening hands are dealt.",
        ],
      },
      {
        target: "table",
        title: "The table",
        body: [
          "This is the table during your turn. Your side is the bottom half; your opponent’s is the top half.",
          "Here you are Player One. Player Two went first, and it is now your turn.",
        ],
      },
      {
        target: "player-half",
        title: "Your Biome, on the board",
        body: [
          "Each half of the table shows its owner’s Biome as a landscape behind the Niches. Yours is Temperate woodland; your opponent’s is Aquatic.",
          "The badge beside each player’s name says which Biome they chose.",
        ],
      },
      {
        target: "biome-control",
        title: "Your Biome’s status",
        body: [
          "Your Biome’s ability and how much of it is left are shown here: for Temperate, how many Season counters remain.",
          "Biomes with an ability you use by choice, such as Aquatic, put its buttons here too.",
        ],
      },
      {
        target: "player-niches",
        title: "Your five Niches",
        body: [
          "Your side has five Niches, the places in your ecosystem where your Creatures live. Each Niche holds one Creature at a time.",
          "Creature cards are played into your Niches.",
        ],
      },
      {
        target: "player-niches adaptation-slot",
        title: "Adaptation slots",
        body: [
          "Under each Niche is an Adaptation slot. An Adaptation card is played here, attached to the Creature in that Niche, and stays with it.",
        ],
      },
      {
        target: "player-ribbon event-zone",
        title: "Event Zone",
        body: [
          "A Continuous Event is played here and keeps working while it stays in play.",
          "Instantaneous Events take effect at once instead. A few, such as Wildfire and Drought, lock a Niche for a while.",
          "Concepts also take effect at once, then go to your History.",
        ],
      },
      {
        target: "opponent-niches creature",
        title: "A Creature in play",
        body: [
          "Your opponent has played a Creature. On the board, a Creature shows its Primary Taxon and Level at the top, then its name, Diet and Period, and its Tags.",
          "At the bottom is how many Victory Levels it is worth right now. Point at it to read the whole card.",
        ],
      },
      {
        target: "centerline",
        title: "Facing Niches",
        body: [
          "Each of your Niches faces your opponent’s Niche directly across the centre line. That matters when Creatures Hunt, which a later tutorial covers.",
        ],
      },
      {
        target: "player-ribbon victory",
        title: "Victory",
        body: [
          "Your Victory total: the Victory Levels of all your Creatures in play, added together.",
          "The first player to reach 12 wins.",
        ],
      },
      {
        target: "player-ribbon piles",
        title: "Deck, Hand and History",
        body: [
          { term: "Deck", text: "How many cards you have left to draw." },
          { term: "Hand", text: "How many cards you are holding." },
          {
            term: "History",
            text: "Your discard pile. Creatures that leave the board, and Concepts and Events once they are done, go here. Click it to look through it.",
          },
        ],
      },
      {
        target: "turn-summary",
        title: "Turn and phase",
        body: [
          "The top of the screen shows the turn number and whose phase it is.",
          "Every turn has three phases: the Start Phase, when you draw; the Development Phase, when you play cards; and the Battle Phase, when your Creatures can Hunt.",
        ],
      },
      {
        target: "hand",
        title: "Your hand",
        body: [
          "Your cards are here, at the bottom of the screen. Point at one to read it, or click it to choose it.",
          "Each player starts with five cards, always including at least one Level 0 or Level 1 Creature, so every player can fill a Niche on their first turn.",
          "With two players on one device, your hand is covered whenever the device is passed, until the next player confirms it is them.",
        ],
      },
      {
        target: "player-ribbon piles",
        title: "When you draw",
        body: [
          "At the start of each of your turns, in the Start Phase, you draw one card. You started with five and drew one, so you now hold six.",
          "You can hold at most 10 cards. A full hand blocks your draws, and ending two of your turns in a row with a full hand, while your deck still has cards, forfeits the game.",
        ],
      },
      {
        target: "allowances",
        title: "What you can play",
        body: [
          "In your Development Phase you may play one Creature, one Adaptation, one Event and one Concept, in any order. These markers show what you have used this turn.",
          "Playing a card is the next tutorial.",
        ],
      },
      {
        target: "inspector",
        title: "The Inspector",
        body: [
          "Point at any card, on the board or in your hand, and the Inspector shows it in full.",
          "It also keeps the game log: a record of everything that has happened so far.",
          "On smaller screens, open it with the Inspector button at the top.",
        ],
      },
      {
        target: "header-controls",
        title: "Rules and menu",
        body: [
          "Rules opens a quick reference at any time. Main menu leaves the game; it is saved, so you can resume it later.",
        ],
      },
      {
        target: "table",
        title: "Ready to play",
        body: ["That is everything on the table before your first play. Next: playing a card."],
      },
    ],
  },
];

export const TUTORIALS_BY_ID: ReadonlyMap<string, TutorialDefinition> = new Map(TUTORIALS.map((t) => [t.id, t]));
