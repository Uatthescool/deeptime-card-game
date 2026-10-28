/**
 * Tutorials: short guided tours. Each step lights one part of its scene, dims the rest, and explains the lit part.
 * A step's `target` names an element in the scene marked with a matching `data-tutorial-target`.
 */

export type TutorialGroup = "science" | "play";

/** A paragraph, or a term with its explanation (shown as a list). */
export type TutorialCopy = string | { term: string; text: string };

export type TutorialStep = {
  target: string;
  title: string;
  body: TutorialCopy[];
};

export type TutorialDefinition = {
  id: string;
  group: TutorialGroup;
  title: string;
  summary: string;
  /** Which scene the tutorial plays over. */
  scene: "card-anatomy";
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
        title: "The bold Taxon",
        body: [
          "On every card, one taxon is bold and underlined. Here it is Mollusk.",
          "It is the card’s main group in play, used when one creature evolves into another. Animals that share it are close enough relatives for the game to connect them.",
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
        title: "The science",
        body: [
          "The text at the bottom is a real fact about the animal: how it lived, what its fossils show, or why it matters to scientists.",
        ],
      },
      {
        target: "level",
        title: "Level",
        body: [
          "The Level is a game number, not a biological one. Level 0 creatures start a line of evolution in play, and each step of evolution climbs a Level.",
          "It does not mean an animal is more or less evolved. Every species alive today has been evolving for exactly as long as every other.",
        ],
      },
      {
        target: "period",
        title: "When it lived",
        body: [
          "The footer gives the period the animal lived in: here, the Early Paleogene.",
          "The Paleogene Period ran from about 66 to 23 million years ago, beginning just after the extinction that ended the non-bird dinosaurs. Early, Middle or Late narrows it down. Cards for animals still alive today show the period alone.",
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
];

export const TUTORIALS_BY_ID: ReadonlyMap<string, TutorialDefinition> = new Map(TUTORIALS.map((t) => [t.id, t]));
