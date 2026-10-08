import type { CreatureCard, Diet, Period } from "./game-data";

const STATUS = "Not playable · Work in progress" as const;

type Candidate = {
  key: string;
  name: string;
  scientificName: string;
  printedLevel: 0 | 1 | 2 | 3;
  diet: Diet;
  period: Period;
  periodColor: string;
  gameplayTaxon: string;
  taxa: string[];
  tags: string[];
  role: string;
  flavorText: string;
  visualTags?: string[];
};

const candidate = (entry: Candidate): CreatureCard => ({
  kind: "creature",
  status: STATUS,
  visualTags: [],
  ...entry,
});

export const GENERAL_POOL_CANDIDATES: CreatureCard[] = [
  candidate({
    key: "ankylosaurus", name: "Ankylosaurus", scientificName: "Ankylosaurus magniventris", printedLevel: 2, diet: "Herbivore", period: "Cretaceous", periodColor: "Lime Green", gameplayTaxon: "Archosaur",
    taxa: ["Vertebrate", "Amniote", "Archosaur", "Dinosaur", "Ornithischian", "Thyreophoran", "Ankylosaurid"], tags: ["Armament", "Retaliation"], visualTags: ["Armored", "Tail Club", "Beaked", "Quadrupedal"],
    role: "Durable reactive lane anchor and a second home for the tail-defense package.", flavorText: "Ankylosaurus combined a broad armored body with an enlarged bony tail club, giving a large predator a serious reason to approach its hindquarters cautiously.",
  }),
  candidate({
    key: "kentrosaurus", name: "Kentrosaurus", scientificName: "Kentrosaurus aethiopicus", printedLevel: 1, diet: "Herbivore", period: "Jurassic", periodColor: "Logo Red", gameplayTaxon: "Archosaur",
    taxa: ["Vertebrate", "Amniote", "Archosaur", "Dinosaur", "Ornithischian", "Thyreophoran", "Stegosaurid"], tags: ["Armament", "Retaliation"], visualTags: ["Plated", "Tail Spikes", "Beaked", "Quadrupedal"],
    role: "Lower-curve defensive bridge into Stegosaurus and other armored Herbivores.", flavorText: "Kentrosaurus carried plates over the front of its back and long paired spikes toward the hips and tail, concentrating its protection into a dangerous rear defense.",
  }),
  candidate({
    key: "pachycephalosaurus", name: "Pachycephalosaurus", scientificName: "Pachycephalosaurus wyomingensis", printedLevel: 1, diet: "Herbivore", period: "Cretaceous", periodColor: "Lime Green", gameplayTaxon: "Archosaur",
    taxa: ["Vertebrate", "Amniote", "Archosaur", "Dinosaur", "Ornithischian", "Pachycephalosaurid"], tags: ["Cranial Display", "Rivalry"], visualTags: ["Cranial Dome", "Bipedal"],
    role: "Mid-curve deterrent that establishes the herbivore Cranial Display branch.", flavorText: "Its greatly thickened skull roof was surrounded by knobs and spikes; whether used in direct impact, flank-butting, display, or several behaviors remains debated.",
  }),
  candidate({
    key: "protoceratops", name: "Protoceratops", scientificName: "Protoceratops andrewsi", printedLevel: 1, diet: "Herbivore", period: "Cretaceous", periodColor: "Lime Green", gameplayTaxon: "Archosaur",
    taxa: ["Vertebrate", "Amniote", "Archosaur", "Dinosaur", "Ornithischian", "Ceratopsian", "Protoceratopsid"], tags: ["Cranial Display", "Retaliation"], visualTags: ["Frill", "Beaked", "Quadrupedal"],
    role: "Compact ceratopsian bridge with defensive entry pressure.", flavorText: "Protoceratops lacked the enormous horns of later ceratopsids, but its deep beak and expanding neck frill made it a distinctive and well-protected desert herbivore.",
  }),
  candidate({
    key: "yinlong", name: "Yinlong", scientificName: "Yinlong downsi", printedLevel: 0, diet: "Herbivore", period: "Jurassic", periodColor: "Logo Red", gameplayTaxon: "Archosaur",
    taxa: ["Vertebrate", "Amniote", "Archosaur", "Dinosaur", "Ornithischian", "Ceratopsian"], tags: ["Transitional", "Cranial Display"], visualTags: ["Beaked", "Bipedal"],
    role: "Foundational ceratopsian starter that opens the Cranial Display curve early.", flavorText: "Small and lightly built, Yinlong preserves an early stage of ceratopsian evolution before the elaborate frills and horns of its much later relatives appeared.",
  }),
  candidate({
    key: "eoraptor", name: "Eoraptor", scientificName: "Eoraptor lunensis", printedLevel: 0, diet: "Omnivore", period: "Triassic", periodColor: "Slate Gray", gameplayTaxon: "Archosaur",
    taxa: ["Vertebrate", "Amniote", "Archosaur", "Dinosaur", "Saurischian", "Sauropodomorph"], tags: ["Transitional", "Generalist"], visualTags: ["Bipedal"],
    role: "Flexible Triassic starter connecting early dinosaurs to several later branches.", flavorText: "Eoraptor was a small early dinosaur with a mixed set of tooth shapes, an anatomy that suits a generalized diet and an early position near major saurischian branches.",
  }),
  candidate({
    key: "lystrosaurus", name: "Lystrosaurus", scientificName: "Lystrosaurus murrayi", printedLevel: 0, diet: "Herbivore", period: "Permian", periodColor: "Sandstone Tan", gameplayTaxon: "Synapsid",
    taxa: ["Vertebrate", "Amniote", "Synapsid", "Therapsid", "Dicynodont"], tags: ["Opportunist", "Burrower"], visualTags: ["Tusks", "Beaked", "Quadrupedal"],
    role: "Signature Opportunist starter that turns opposing Continuous Events into earned tempo.", flavorText: "Lystrosaurus crossed the Permian–Triassic boundary and became extraordinarily abundant afterward, making it a natural emblem of survival followed by rapid occupation of open niches.",
  }),
  candidate({
    key: "edaphosaurus", name: "Edaphosaurus", scientificName: "Edaphosaurus pogonias", printedLevel: 1, diet: "Herbivore", period: "Permian", periodColor: "Sandstone Tan", gameplayTaxon: "Synapsid",
    taxa: ["Vertebrate", "Amniote", "Synapsid", "Eupelycosaur", "Edaphosaurid"], tags: ["Spinal Sail"], visualTags: ["Spinal Sail", "Quadrupedal"],
    role: "Herbivorous Synapsid bridge that broadens the Spinal Sail package.", flavorText: "Unlike the predatory Dimetrodon, Edaphosaurus was a bulky plant-eater whose tall sail carried distinctive crossbars along its elongated vertebral spines.",
  }),
  candidate({
    key: "brachiosaurus", name: "Brachiosaurus", scientificName: "Brachiosaurus altithorax", printedLevel: 3, diet: "Herbivore", period: "Jurassic", periodColor: "Logo Red", gameplayTaxon: "Archosaur",
    taxa: ["Vertebrate", "Amniote", "Archosaur", "Dinosaur", "Saurischian", "Sauropodomorph", "Sauropod", "Brachiosaurid"], tags: ["Gigantic"], visualTags: ["Long Neck", "Quadrupedal"],
    role: "Straightforward gigantic herbivore finisher for the future Deck 2 core.", flavorText: "Brachiosaurus had forelimbs longer than its hind limbs, lifting the shoulders and long neck into a high browsing profile unlike that of many other sauropods.",
  }),
  candidate({
    key: "triceratops", name: "Triceratops", scientificName: "Triceratops horridus", printedLevel: 3, diet: "Herbivore", period: "Cretaceous", periodColor: "Lime Green", gameplayTaxon: "Archosaur",
    taxa: ["Vertebrate", "Amniote", "Archosaur", "Dinosaur", "Ornithischian", "Ceratopsian", "Ceratopsid"], tags: ["Gigantic", "Cranial Display", "Retaliation"], visualTags: ["Horns", "Frill", "Beaked", "Quadrupedal"],
    role: "Defensive boss that rewards building the ceratopsian branch to a protected endpoint.", flavorText: "A massive skull carried two long brow horns, a shorter nasal horn, and a broad solid frill, forming one of the most imposing defensive displays among dinosaurs.",
  }),
  candidate({
    key: "cotylorhynchus", name: "Cotylorhynchus", scientificName: "Cotylorhynchus romeri", printedLevel: 2, diet: "Herbivore", period: "Permian", periodColor: "Sandstone Tan", gameplayTaxon: "Synapsid",
    taxa: ["Vertebrate", "Amniote", "Synapsid", "Caseasaur", "Caseid"], tags: ["Gigantic"], visualTags: ["Quadrupedal"],
    role: "Large non-therapsid Synapsid endpoint with a clean Victory contribution.", flavorText: "Cotylorhynchus paired a remarkably small head with a huge barrel-shaped trunk, reflecting a digestive system suited to processing large amounts of fibrous vegetation.",
  }),
  candidate({
    key: "thrinaxodon", name: "Thrinaxodon", scientificName: "Thrinaxodon liorhinus", printedLevel: 0, diet: "Carnivore", period: "Triassic", periodColor: "Slate Gray", gameplayTaxon: "Synapsid",
    taxa: ["Vertebrate", "Amniote", "Synapsid", "Therapsid", "Cynodont"], tags: ["Burrower", "Generalist"], visualTags: ["Quadrupedal"],
    role: "Low-level Synapsid foundation that values shelter and broad override access.", flavorText: "Thrinaxodon was a small cynodont known from articulated skeletons preserved in burrows, evidence that sheltering underground was an important part of its ecology.",
  }),
  candidate({
    key: "anomalocaris", name: "Anomalocaris", scientificName: "Anomalocaris canadensis", printedLevel: 1, diet: "Carnivore", period: "Cambrian", periodColor: "Sky Blue", gameplayTaxon: "Arthropod",
    taxa: ["Invertebrate", "Protostome", "Arthropod", "Radiodont"], tags: ["Aquatic", "Ambush", "Small Game Hunter"], visualTags: ["Swimming Lobes"],
    role: "Early aquatic predator that pressures Level 0 boards without demanding a high curve.", flavorText: "Anomalocaris swam with a row of lateral flaps and seized prey using a pair of jointed frontal appendages positioned before its circular mouthparts.",
  }),
  candidate({
    key: "endoceras", name: "Endoceras", scientificName: "Endoceras giganteum", printedLevel: 2, diet: "Carnivore", period: "Ordovician", periodColor: "Amber Orange", gameplayTaxon: "Mollusc",
    taxa: ["Invertebrate", "Protostome", "Mollusc", "Cephalopod", "Nautiloid", "Endocerid"], tags: ["Aquatic", "Shell", "Apex Predator"], visualTags: ["External Shell", "Tentacles"],
    role: "Armored cephalopod apex that gives Aquatic decks a shell-based Level 2 endpoint.", flavorText: "Endocerid cephalopods carried long straight chambered shells; the largest forms rank among the most imposing mobile predators of Ordovician seas.",
  }),
  candidate({
    key: "jaekelopterus", name: "Jaekelopterus", scientificName: "Jaekelopterus rhenaniae", printedLevel: 2, diet: "Carnivore", period: "Devonian", periodColor: "Ocean Blue", gameplayTaxon: "Arthropod",
    taxa: ["Invertebrate", "Protostome", "Arthropod", "Chelicerate", "Eurypterid"], tags: ["Aquatic", "Ambush", "Apex Predator"], visualTags: ["Pincers"],
    role: "Large arthropod ambusher that advances early aquatic invertebrate lines.", flavorText: "A giant predatory eurypterid, Jaekelopterus is known from oversized grasping claws that imply an animal capable of seizing substantial prey in Devonian waterways.",
  }),
  candidate({
    key: "parapuzosia", name: "Parapuzosia", scientificName: "Parapuzosia seppenradensis", printedLevel: 2, diet: "Carnivore", period: "Cretaceous", periodColor: "Lime Green", gameplayTaxon: "Mollusc",
    taxa: ["Invertebrate", "Protostome", "Mollusc", "Cephalopod", "Ammonite", "Desmoceratid"], tags: ["Aquatic", "Shell", "Gigantic"], visualTags: ["External Shell", "Tentacles"],
    role: "Gigantic shell payoff for a future cephalopod and open-ocean branch.", flavorText: "Parapuzosia seppenradensis produced one of the largest known ammonite shells, with incomplete specimens indicating a diameter measured in meters rather than centimeters.",
  }),
  candidate({
    key: "helicoprion", name: "Helicoprion", scientificName: "Helicoprion davisii", printedLevel: 2, diet: "Carnivore", period: "Permian", periodColor: "Sandstone Tan", gameplayTaxon: "Chondrichthyan",
    taxa: ["Vertebrate", "Chondrichthyan", "Eugeneodont", "Helicoprionid"], tags: ["Aquatic", "Diver", "Apex Predator"], visualTags: ["Tooth Whorl"],
    role: "Distinctive Permian aquatic apex and a bridge between sharklike predator packages.", flavorText: "Helicoprion continuously added teeth to a spiral whorl housed in the lower jaw, creating a cutting surface unlike that of any living fish.",
  }),
  candidate({
    key: "edestus", name: "Edestus", scientificName: "Edestus heinrichi", printedLevel: 2, diet: "Carnivore", period: "Carboniferous", periodColor: "Navy Blue", gameplayTaxon: "Chondrichthyan",
    taxa: ["Vertebrate", "Chondrichthyan", "Eugeneodont", "Edestid"], tags: ["Aquatic", "Apex Predator", "Bruiser"], visualTags: ["Tooth Blades"],
    role: "Close-range aquatic bruiser built around unusual jaw armament.", flavorText: "Edestus retained rows of teeth in projecting upper and lower blades, producing a scissor-like feeding apparatus with no close modern counterpart.",
  }),
  candidate({
    key: "ichthyosaurus", name: "Ichthyosaurus", scientificName: "Ichthyosaurus communis", printedLevel: 1, diet: "Carnivore", period: "Jurassic", periodColor: "Logo Red", gameplayTaxon: "Reptile",
    taxa: ["Vertebrate", "Amniote", "Diapsid", "Ichthyosaur"], tags: ["Aquatic", "Diver", "Elusive"], visualTags: ["Flippers", "Tail Fluke"],
    role: "Mobile marine Carnivore bridge for dedicated aquatic development lines.", flavorText: "Ichthyosaurus had a streamlined body, paddlelike limbs, and a fish-shaped profile produced independently from dolphins through adaptation to fast swimming.",
  }),
  candidate({
    key: "shastasaurus", name: "Shastasaurus", scientificName: "Shastasaurus sikanniensis", printedLevel: 3, diet: "Carnivore", period: "Triassic", periodColor: "Slate Gray", gameplayTaxon: "Reptile",
    taxa: ["Vertebrate", "Amniote", "Diapsid", "Ichthyosaur", "Shastasaurid"], tags: ["Aquatic", "Gigantic"], visualTags: ["Flippers"],
    role: "High-end marine giant that wins through scale rather than predator keywords.", flavorText: "Giant shastasaurid ichthyosaurs reached whale-like lengths during the Triassic, demonstrating how quickly reptiles occupied enormous open-ocean body sizes.",
  }),
  candidate({
    key: "plesiosaurus", name: "Plesiosaurus", scientificName: "Plesiosaurus dolichodeirus", printedLevel: 2, diet: "Carnivore", period: "Jurassic", periodColor: "Logo Red", gameplayTaxon: "Reptile",
    taxa: ["Vertebrate", "Amniote", "Diapsid", "Sauropterygian", "Plesiosaur"], tags: ["Aquatic", "Diver"], visualTags: ["Long Neck", "Flippers"],
    role: "Stable Level 2 marine Carnivore connecting low aquatic reptiles to giant finishers.", flavorText: "Plesiosaurus propelled itself with four hydrofoil-like limbs while its compact body and long neck created a silhouette unlike that of ichthyosaurs or mosasaurs.",
  }),
  candidate({
    key: "mosasaurus", name: "Mosasaurus", scientificName: "Mosasaurus hoffmannii", printedLevel: 3, diet: "Carnivore", period: "Cretaceous", periodColor: "Lime Green", gameplayTaxon: "Reptile",
    taxa: ["Vertebrate", "Amniote", "Diapsid", "Lepidosaur", "Squamate", "Mosasaurid"], tags: ["Aquatic", "Apex Predator", "Gigantic"], visualTags: ["Flippers", "Tail Fluke"],
    role: "Marine reptile apex endpoint with both Aquatic and Lepidosaur connections.", flavorText: "Mosasaurus was a giant marine squamate with powerful jaws and a deep tail adapted for propulsion, occupying the top of Late Cretaceous food webs.",
  }),
  candidate({
    key: "purussaurus", name: "Purussaurus", scientificName: "Purussaurus brasiliensis", printedLevel: 3, diet: "Carnivore", period: "Neogene", periodColor: "Golden Ochre", gameplayTaxon: "Archosaur",
    taxa: ["Vertebrate", "Amniote", "Archosaur", "Crocodyliform", "Alligatorid", "Caiman"], tags: ["Semi-Aquatic", "Ambush", "Crushing Bite", "Apex Predator"], visualTags: ["Armored", "Quadrupedal"],
    role: "Explosive semi-aquatic ambush finisher with a heavily committed tag line.", flavorText: "Purussaurus was an enormous caiman from Miocene South America, combining a massive skull and robust teeth with the concealed approach of an aquatic ambush predator.",
  }),
  candidate({
    key: "dunkleosteus", name: "Dunkleosteus", scientificName: "Dunkleosteus terrelli", printedLevel: 3, diet: "Carnivore", period: "Devonian", periodColor: "Ocean Blue", gameplayTaxon: "Fish",
    taxa: ["Vertebrate", "Placoderm", "Arthrodire", "Dunkleosteid"], tags: ["Aquatic", "Crushing Bite", "Apex Predator"], visualTags: ["Armored Head"],
    role: "Armored Devonian finisher that converts defense-breaking into apex pressure.", flavorText: "Dunkleosteus bore articulated armor around its head and thorax and sharpened bony jaw plates that formed a powerful self-honing cutting edge.",
  }),
  candidate({
    key: "megalodon", name: "Megalodon", scientificName: "Otodus megalodon", printedLevel: 3, diet: "Carnivore", period: "Neogene", periodColor: "Golden Ochre", gameplayTaxon: "Chondrichthyan",
    taxa: ["Vertebrate", "Chondrichthyan", "Shark", "Lamniform", "Otodontid"], tags: ["Aquatic", "Apex Predator", "Specialized", "Crushing Bite"], visualTags: ["Serrated Teeth"],
    role: "Specialized marine anti-fortification boss whose extreme bite punishes stacked reactive defenses.", flavorText: "Otodus megalodon combined enormous jaw force with broad, thick, serrated teeth adapted to penetrate the flesh and bone of large marine mammals, creating a feeding apparatus specialized for catastrophic bites against massive prey.",
  }),
  candidate({
    key: "smilodon", name: "Smilodon", scientificName: "Smilodon fatalis", printedLevel: 2, diet: "Carnivore", period: "Quaternary", periodColor: "Ice Blue", gameplayTaxon: "Synapsid",
    taxa: ["Vertebrate", "Amniote", "Synapsid", "Mammal", "Carnivoran", "Felid", "Machairodont"], tags: ["Ambush", "Raptorial", "Apex Predator"], visualTags: ["Caniniform", "Retractable Claws"],
    role: "Terrestrial mammal ambusher that brings Raptorial pressure beyond dinosaurs.", flavorText: "Smilodon combined elongated upper canines with exceptionally powerful forelimbs, a build suited to restraining prey before delivering a carefully positioned bite.",
  }),
  candidate({
    key: "woolly-mammoth", name: "Woolly Mammoth", scientificName: "Mammuthus primigenius", printedLevel: 3, diet: "Herbivore", period: "Quaternary", periodColor: "Ice Blue", gameplayTaxon: "Synapsid",
    taxa: ["Vertebrate", "Amniote", "Synapsid", "Mammal", "Proboscidean", "Elephantid"], tags: ["Gigantic", "Retaliation"], visualTags: ["Tusks", "Hair", "Quadrupedal"],
    role: "Cold-adapted defensive giant and mammalian herbivore finisher.", flavorText: "Woolly mammoths combined dense hair, insulating fat, small ears, and long curved tusks to survive and forage across the cold steppe environments of the Pleistocene.",
  }),
  candidate({
    key: "paraceratherium", name: "Paraceratherium", scientificName: "Paraceratherium transouralicum", printedLevel: 3, diet: "Herbivore", period: "Paleogene", periodColor: "Magenta", gameplayTaxon: "Synapsid",
    taxa: ["Vertebrate", "Amniote", "Synapsid", "Mammal", "Perissodactyl", "Rhinocerotoid", "Paraceratheriid"], tags: ["Gigantic", "Solitary"], visualTags: ["Long Neck", "Quadrupedal"],
    role: "Non-dinosaur terrestrial giant that rewards isolated lane placement.", flavorText: "Paraceratherium was a hornless rhinocerotoid with a long neck and towering limbs, among the largest land mammals yet known from the fossil record.",
  }),
  candidate({
    key: "megatherium", name: "Megatherium", scientificName: "Megatherium americanum", printedLevel: 2, diet: "Herbivore", period: "Quaternary", periodColor: "Ice Blue", gameplayTaxon: "Synapsid",
    taxa: ["Vertebrate", "Amniote", "Synapsid", "Mammal", "Xenarthran", "Ground Sloth", "Megatheriid"], tags: ["Gigantic", "Retaliation"], visualTags: ["Large Claws", "Hair"],
    role: "Defensive mammal bruiser whose size and claws punish careless Hunts.", flavorText: "Megatherium was an elephant-sized ground sloth able to rear upright, using a powerful tail as support while its long foreclaws pulled vegetation within reach.",
  }),
  candidate({
    key: "arctotherium", name: "Arctotherium", scientificName: "Arctotherium angustidens", printedLevel: 3, diet: "Omnivore", period: "Quaternary", periodColor: "Ice Blue", gameplayTaxon: "Synapsid",
    taxa: ["Vertebrate", "Amniote", "Synapsid", "Mammal", "Carnivoran", "Ursid", "Tremarctine"], tags: ["Apex Predator", "Solitary", "Bruiser"], visualTags: ["Caniniform", "Large Claws"],
    role: "Flexible omnivore boss that is strongest when developed away from adjacent allies.", flavorText: "Arctotherium included some exceptionally large short-faced bears in Pleistocene South America, with a broad omnivorous anatomy capable of exploiting varied foods.",
  }),
  candidate({
    key: "epicyon", name: "Epicyon", scientificName: "Epicyon haydeni", printedLevel: 2, diet: "Carnivore", period: "Neogene", periodColor: "Golden Ochre", gameplayTaxon: "Synapsid",
    taxa: ["Vertebrate", "Amniote", "Synapsid", "Mammal", "Carnivoran", "Canid", "Borophagine"], tags: ["Crushing Bite", "Pack Hunter"], visualTags: ["Caniniform"],
    role: "Bone-cracking canid payoff for a coordinated mammalian predator line.", flavorText: "Epicyon was a massive borophagine canid with a deep skull and robust teeth adapted for forces far beyond those used by most living dogs.",
  }),
  candidate({
    key: "dire-wolf", name: "Dire Wolf", scientificName: "Aenocyon dirus", printedLevel: 1, diet: "Carnivore", period: "Quaternary", periodColor: "Ice Blue", gameplayTaxon: "Synapsid",
    taxa: ["Vertebrate", "Amniote", "Synapsid", "Mammal", "Carnivoran", "Canid", "Canine"], tags: ["Pack Hunter", "Mob Feeder"], visualTags: ["Caniniform"],
    role: "Efficient pack bridge that makes repeated Hunts matter without acting as a solo apex.", flavorText: "Dire wolves were robust New World canids whose remains occur in large numbers at some fossil sites, suggesting predators repeatedly drawn to concentrated prey resources.",
  }),
];
