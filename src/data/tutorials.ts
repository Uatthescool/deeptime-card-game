/**
 * Tutorials: short guided tours. Each step lights one part of its scene, dims the rest, and explains the lit part.
 * A step's `target` names an element in the scene marked with a matching `data-tutorial-target`.
 */

export type TutorialGroup = "science" | "play";

/** A paragraph, or a term with its explanation (shown as a list). */
export type TutorialCopy = string | { term: string; text: string };

/** What a tutorial plays over: a card, the Biomes shown before the deal, or a staged game board. */
export type TutorialScene = "card-anatomy" | "biome-reveal" | "board";

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
        scene: "biome-reveal",
        target: "biome-grid",
        title: "Your deck’s Biome",
        body: [
          "Every deck comes with its own Biome. Yours changes the rules on your side of the table for the whole game.",
          "Before any cards are dealt, both players’ Biomes are shown side by side.",
        ],
      },
      {
        scene: "biome-reveal",
        target: "biome-arid",
        title: "Reading a Biome",
        body: [
          "Each Biome lists the real environments it stands for, its ability, and the science behind that ability.",
          "Arid’s Tipping Point, for example, wins you the game at the start of your turn from Turn 26 onward if you have 10 or more Victory Levels and your opponent controls no Creatures.",
        ],
      },
      {
        scene: "biome-reveal",
        target: "biome-deal",
        title: "The deal",
        body: ["Once both players have read the Biomes, draw the opening hands."],
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
          "Each half of the table shows its owner’s Biome as a landscape behind the Niches. Yours is Arid; your opponent’s is Aquatic.",
        ],
      },
      {
        target: "biome-control",
        title: "Your Biome’s status",
        body: [
          "This small panel names your Biome and its ability, along with anything it has left to use, such as Temperate’s Season counters. Point at it to read the full rule.",
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
          "Under each of your Niches is an Adaptation slot; your opponent’s are above theirs. An Adaptation card is played here, attached to the Creature in that Niche, and stays with it.",
        ],
      },
      {
        target: "event-zone",
        title: "Event Zone",
        body: [
          "A Continuous Event is played here and keeps working while it stays in play. Your opponent’s Event Zone is at the top right.",
          "Instantaneous Events take effect at once instead. A few, such as Wildfire and Drought, lock a Niche for a while.",
          "Concepts also take effect at once, then go to your History.",
        ],
      },
      {
        target: "opponent-niches creature",
        title: "A Creature in play",
        body: [
          "Your opponent has played a Creature. On the board, a Creature shows its name and Diet at the top and a close-up of its face.",
          "The circle at the bottom left is its Printed Level. A small + or − beside it means it is contributing more or fewer Victory Levels than that. The number at the bottom right is its Battle Power.",
          "Point at it, or press and hold on a touch screen, to see the whole card with notes on its Tags, Victory Levels and Battle Power.",
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
        target: "victory",
        title: "Victory",
        body: [
          "Your Victory total and your opponent’s: the Victory Levels of each player’s Creatures in play, added together.",
          "The first player to reach 12 wins.",
        ],
      },
      {
        target: "piles",
        title: "Deck and History",
        body: [
          { term: "Deck", text: "Your face-down deck, at the right. Point at it to see how many cards are left." },
          {
            term: "History",
            text: "Your discard pile, just above it. Creatures that leave the board, and Concepts and Events once they are done, go here. Click it to look through it.",
          },
          "Your opponent’s deck and History are on the left.",
        ],
      },
      {
        target: "turn-summary",
        title: "Turn and phase",
        body: [
          "This panel shows the turn number, whose phase it is, and what to do next, with the button that moves the turn on.",
          "Every turn has three phases: the Start Phase, when you draw; the Development Phase, when you play cards; and the Battle Phase, when your Creatures can Hunt.",
        ],
      },
      {
        target: "hand",
        title: "Your hand",
        body: [
          "Your cards are here, at the bottom of the screen. Drag one onto the board to play it, or click it and then click where it goes. Point at one to see it up close.",
          "Each player starts with five cards, always including at least one Level 0 or Level 1 Creature, so every player can fill a Niche on their first turn.",
          "With two players on one device, your hand is covered whenever the device is passed, until the next player confirms it is them.",
        ],
      },
      {
        target: "piles",
        title: "When you draw",
        body: [
          "At the start of each of your turns, in the Start Phase, you draw one card from your deck. You started with five and drew one, so you now hold six.",
          "You can hold at most 10 cards. A full hand blocks your draws, and ending two of your turns in a row with a full hand, while your deck still has cards, forfeits the game.",
        ],
      },
      {
        target: "hand",
        title: "What you can play",
        body: [
          "In your Development Phase you may play one Creature, one Adaptation, one Event and one Concept, in any order. A card you can’t play right now is dimmed and says why.",
          "Playing a card is the next tutorial.",
        ],
      },
      {
        target: "inspector",
        title: "The game log",
        body: [
          "Game log opens a record of everything that has happened so far, and your History.",
          "Right-click any card to open it there in full.",
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
