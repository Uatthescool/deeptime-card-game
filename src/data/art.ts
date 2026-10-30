/**
 * Where each card's artwork came from. Every card falls into exactly one
 * category; a test keeps this registry, the files in public/artwork, and the
 * attribution manifest in agreement.
 *
 * All current artwork is temporary. Commissioned and fan-submitted art will
 * replace it card by card; when a piece arrives, add the file and move its key
 * into a new category with the artist's credit.
 */

export type ArtSource =
  /** Reused under an open license; credited in public/artwork/attribution-manifest.json. */
  | "licensed"
  /** Generated with ChatGPT's image generator as a stand-in until commissioned art replaces it. */
  | "ai-placeholder"
  /** No artwork yet: the card shows the "Artwork pending" frame. */
  | "pending";

/**
 * Removed from the site: these images were sourced from the web without a
 * recorded license. They show the "Artwork pending" frame until replaced.
 */
export const PENDING_ARTWORK_KEYS: ReadonlySet<string> = new Set([
  "abiogenesis",
  "allosaurus",
  "autotomy",
  "baryonyx",
  "biogenesis",
  "cambrian-explosion",
  "carnian-pluvial-episode",
  "competitive-exclusion-principle",
  "compsognathus",
  "convergent-evolution",
  "cynognathus",
  "dig-site-excavation",
  "genetic-drift",
  "hoatzin",
  "inostrancevia",
  "microraptor",
  "natovenator",
  "rapid-speciation",
  "superpredators",
  "torvosaurus",
  "tyrannosaurus-rex",
  "utahraptor",
  "velociraptor",
  "yutyrannus",
]);

export const AI_PLACEHOLDER_ARTWORK_KEYS: ReadonlySet<string> = new Set([
  "archaeopteryx",
  "carnotaurus",
  "cryptic-camouflage",
  "dilophosaurus",
  "dimetrodon",
  "diplocaulus",
  "evolutionary-radiation",
  "gojirasaurus",
  "herrerasaurus",
  "horseshoe-crab",
  "natural-selection",
  "nautilus",
  "obligate-migration",
  "raptorial-claws",
  "semelparity",
  "spinosaurus",
  "whale-fall",
]);

export function artSource(cardKey: string): ArtSource {
  if (PENDING_ARTWORK_KEYS.has(cardKey)) return "pending";
  if (AI_PLACEHOLDER_ARTWORK_KEYS.has(cardKey)) return "ai-placeholder";
  return "licensed";
}

/** One entry of public/artwork/attribution-manifest.json. */
export type ArtworkCredit = {
  cardKey: string;
  cardName: string;
  creator: string | null;
  credit: string | null;
  license: string;
  licenseUrl: string | null;
  sourcePage: string;
  modifications: string | null;
};

/** A manifest creator as it reads on a card: no web addresses or wiki signature timestamps. */
function shortCreatorName(creator: string) {
  return creator
    .replace(/\s*\(\s*https?:\/\/[^)]*\)/g, "")
    .replace(/\s*https?:\/\/\S+/g, "")
    .replace(/^--\s*/, "")
    .replace(/\s+\d{1,2}:\d{2},.*\(UTC\)$/, "")
    .replace(/\s+,/g, ",")
    .trim();
}

/**
 * The short credit shown on screen wherever a card's artwork is, or null where no artwork shows. `on` says
 * which: the artwork itself, or a finished card face. Faces leave out CC BY-SA art (a placeholder face ships
 * until that license is settled), so those faces carry no credit. Licensed credits wait on the manifest.
 */
export function artCreditLine(
  cardKey: string,
  credits: readonly ArtworkCredit[] | null,
  on: "artwork" | "face",
): string | null {
  switch (artSource(cardKey)) {
    case "pending":
      return null;
    case "ai-placeholder":
      return "Placeholder art · AI-generated";
    case "licensed": {
      const credit = credits?.find((asset) => asset.cardKey === cardKey);
      if (!credit || (on === "face" && /BY-SA/i.test(credit.license))) return null;
      return `Art: ${credit.creator ? shortCreatorName(credit.creator) : "Unknown artist"} · ${credit.license}`;
    }
  }
}
