export type LessonCopyPart = {
  text: string;
  glossaryId?: string;
  linkedLessonId?: string;
  emphasis?: boolean;
};

export type LessonAnnotation = {
  id: string;
  kicker: string;
  title: string;
  copy: LessonCopyPart[];
  target: {
    xPercent: number;
    yPercent: number;
    label: string;
  };
};

export type LessonInfoBox = {
  id: string;
  kicker: string;
  title: string;
  copy: LessonCopyPart[];
  tone?: "standard" | "uncertainty";
};

export type LessonEvidenceItem = {
  id: string;
  status: "Observed" | "Measured" | "Inferred";
  title: string;
  copy: LessonCopyPart[];
};

export type LessonSource = {
  id: string;
  shortTitle: string;
  citation: string;
  url: string;
  featured?: boolean;
};

export type LessonCardState = {
  cardKey: string;
  annotations: LessonAnnotation[];
  infoBoxes: LessonInfoBox[];
  evidenceTitle: string;
  evidenceIntro: LessonCopyPart[];
  evidenceItems: LessonEvidenceItem[];
  evidenceConclusion: LessonCopyPart[];
};

export type LessonDefinition = {
  id: string;
  title: string;
  hook: string;
  cards: LessonCardState[];
  sources: LessonSource[];
  reviewedAt: string;
};

export const LESSON_GLOSSARY: Record<string, { term: string; definition: string }> = {
  "neural-spine": {
    term: "neural spine",
    definition: "A bony projection rising from the top of a vertebra. Muscles, ligaments, and other tissues can attach around it.",
  },
  holotype: {
    term: "holotype",
    definition: "The single specimen formally used to define and name a new species.",
  },
  osteohistology: {
    term: "osteohistology",
    definition: "The study of bone tissue under a microscope. Its microscopic structure can record growth, remodeling, and where soft tissues attached.",
  },
  "sharpeys-fibres": {
    term: "Sharpey’s fibres",
    definition: "Bundles of collagen that anchor tendons, ligaments, or other connective tissues into bone and may leave microscopic traces after fossilization.",
  },
  "keratin-sheath": {
    term: "keratinized sheath",
    definition: "A hard outer covering made from keratin, like the material in claws, horns, hair, and fingernails.",
  },
  dicraeosaurid: {
    term: "dicraeosaurid",
    definition: "A member of Dicraeosauridae, a branch of sauropods known for relatively short necks and often tall or deeply split neural spines.",
  },
  inference: {
    term: "inference",
    definition: "An explanation drawn from evidence rather than something observed directly. Good inferences can be strongly supported without being absolute certainty.",
  },
  "presacral-vertebrae": {
    term: "presacral vertebrae",
    definition: "The vertebrae in front of the sacrum: the bones of the neck and trunk before the hips.",
  },
  "secondary-osteons": {
    term: "secondary osteons",
    definition: "Microscopic structures produced as living bone is broken down and rebuilt in response to growth, repair, or repeated mechanical loading.",
  },
};

const amargasaurus: LessonDefinition = {
  id: "amargasaurus",
  title: "Amargasaurus",
  hook: "The bones are spectacular. The soft tissue is the mystery.",
  reviewedAt: "2026-09-03",
  cards: [
    {
      cardKey: "amargasaurus",
      annotations: [
        {
          id: "taxonomic-home",
          kicker: "Classification",
          title: "A distinctive sauropod branch",
          copy: [
            { text: "Amargasaurus was a " },
            { text: "dicraeosaurid", glossaryId: "dicraeosaurid" },
            { text: " sauropod. The card uses Archosaur as its gameplay Taxon, while its full lineage continues through Dinosaur, Saurischian, Sauropod, and Dicraeosauridae." },
          ],
          target: { xPercent: 45.4, yPercent: 52, label: "The card’s gameplay Taxon" },
        },
        {
          id: "paired-spines",
          kicker: "Anatomy",
          title: "The fossil preserves paired spines",
          copy: [
            { text: "Most neck vertebrae split into two extremely long " },
            { text: "neural spines", glossaryId: "neural-spine" },
            { text: ". Those bones are real; the outer shape reconstructed around them is not directly preserved." },
          ],
          target: { xPercent: 36.4, yPercent: 19.7, label: "Reconstructed neck spines" },
        },
        {
          id: "spinal-sail-tag",
          kicker: "Card translation",
          title: "Why the Tag says Spinal Sail",
          copy: [
            { text: "The Tag turns a debated reconstruction into game identity. Newer bone-tissue evidence favors connected soft tissue over separate horn-like sheaths, but it does not reveal the sail’s exact outline or purpose." },
          ],
          target: { xPercent: 28.8, yPercent: 67.3, label: "Spinal Sail Tag" },
        },
      ],
      infoBoxes: [
        {
          id: "card-art-caveat",
          kicker: "Reconstruction",
          title: "The artwork shows one hypothesis",
          copy: [
            { text: "The placeholder card art depicts separate spikes. A 2022 " },
            { text: "osteohistology", glossaryId: "osteohistology" },
            { text: " study did not support a horn-like " },
            { text: "keratinized sheath", glossaryId: "keratin-sheath" },
            { text: " and instead found evidence consistent with tissue linking successive spines." },
          ],
          tone: "uncertainty",
        },
        {
          id: "uncertainty",
          kicker: "Scientific uncertainty",
          title: "Support is not certainty",
          copy: [
            { text: "A sail or padded crest is currently better supported than isolated horns, but its thickness, color, full extent, and biological function remain unknown. That conclusion is a supported " },
            { text: "inference", glossaryId: "inference" },
            { text: ", not fossilized skin." },
          ],
          tone: "uncertainty",
        },
      ],
      evidenceTitle: "From skeleton to reconstruction",
      evidenceIntro: [
        { text: "Three different kinds of evidence build the modern picture. Each answers a different question." },
      ],
      evidenceItems: [
        {
          id: "holotype",
          status: "Observed",
          title: "MACN-N 15",
          copy: [
            { text: "The " },
            { text: "holotype", glossaryId: "holotype" },
            { text: " includes part of the skull and 22 articulated " },
            { text: "presacral vertebrae", glossaryId: "presacral-vertebrae" },
            { text: ", preserving much of the neck-and-back sequence." },
          ],
        },
        {
          id: "microstructure",
          status: "Measured",
          title: "Microscopic attachment traces",
          copy: [
            { text: "Researchers found " },
            { text: "Sharpey’s fibres", glossaryId: "sharpeys-fibres" },
            { text: " and unevenly distributed " },
            { text: "secondary osteons", glossaryId: "secondary-osteons" },
            { text: ", evidence of connective tissue and repeated mechanical loading." },
          ],
        },
        {
          id: "reconstruction",
          status: "Inferred",
          title: "A connected soft-tissue structure",
          copy: [
            { text: "The tissue traces and loading pattern support interspinous ligaments and a cervical sail or padded crest more strongly than separate keratin-covered horns." },
          ],
        },
      ],
      evidenceConclusion: [
        { text: "The fossil fixes the bones in place. Microscopic evidence narrows the soft-tissue possibilities. Reconstruction fills what neither can preserve directly." },
      ],
    },
  ],
  sources: [
    {
      id: "cerda-2022",
      shortTitle: "Cerda et al. 2022",
      citation: "Cerda, I. A., Salgado, L., Novas, F. E., & Carballido, J. L. (2022). Osteohistology of the hyperelongate hemispinous processes of Amargasaurus cazaui: Implications for soft tissue reconstruction and functional significance. Journal of Anatomy, 241, 1005-1019.",
      url: "https://doi.org/10.1111/joa.13659",
      featured: true,
    },
    {
      id: "salgado-bonaparte-1991",
      shortTitle: "Salgado & Bonaparte 1991",
      citation: "Salgado, L., & Bonaparte, J. F. (1991). A new dicraeosaurid sauropod, Amargasaurus cazaui gen. et sp. nov., from the La Amarga Formation, Neuquén Province, Argentina. Ameghiniana, 28(3-4), 333-346. English translation hosted by the Smithsonian Institution.",
      url: "https://naturalhistory.si.edu/sites/default/files/media/translated_publications/Salgado%26amp%3BBona_91.pdf",
      featured: true,
    },
    {
      id: "leanza-hugo",
      shortTitle: "Leanza & Hugo: La Amarga Formation",
      citation: "Leanza, H. A., & Hugo, C. A. The La Amarga and Lohan Cura formations in the Picún Leufú depocentre. Geological and stratigraphic context for the Early Cretaceous La Amarga Formation.",
      url: "https://rdi.uncoma.edu.ar/handle/uncomaid/17945",
    },
    {
      id: "nhm-overview",
      shortTitle: "Natural History Museum: Amargasaurus",
      citation: "Natural History Museum, London. Amargasaurus entry in the Dino Directory. General background and accessible further reading.",
      url: "https://www.nhm.ac.uk/discover/dino-directory/amargasaurus.html",
    },
  ],
};

export const LESSONS: LessonDefinition[] = [amargasaurus];

export const LESSONS_BY_ID = new Map(LESSONS.map((lesson) => [lesson.id, lesson]));
