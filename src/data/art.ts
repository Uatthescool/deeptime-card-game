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
