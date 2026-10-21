/** Anything that carries generator state — a GameState, or a bare holder during setup. */
export type RngHolder = { rng: number };

/**
 * Seeded randomness. The generator state lives inside GameState, so every
 * transition stays a pure function of (state, input): the same seed and the
 * same sequence of actions always produce the same game.
 *
 * The generator is mulberry32 — small, fast, and statistically adequate for
 * shuffles and coin flips.
 */

/** Advances the generator stored on `state` and returns a float in [0, 1). */
export function nextRandom(state: RngHolder): number {
  state.rng = (state.rng + 0x6d2b79f5) >>> 0;
  let value = state.rng;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

/** An integer in [0, maxExclusive). */
export function randomInt(state: RngHolder, maxExclusive: number): number {
  return Math.floor(nextRandom(state) * maxExclusive);
}

export function flipCoin(state: RngHolder): boolean {
  return nextRandom(state) < 0.5;
}

/** Fisher–Yates shuffle into a new array. */
export function shuffle<T>(state: RngHolder, items: readonly T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = randomInt(state, index + 1);
    [result[index], result[swap]] = [result[swap]!, result[index]!];
  }
  return result;
}

/** A fresh seed from the platform's entropy source. Used only when a game is created. */
export function randomSeed(): number {
  const crypto = globalThis.crypto;
  if (crypto?.getRandomValues) return crypto.getRandomValues(new Uint32Array(1))[0]!;
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

/** Short human-readable label for a seed, e.g. for bug reports. */
export function seedLabel(seed: number): string {
  return (seed >>> 0).toString(36).toUpperCase().padStart(7, "0");
}

/** Parses a label produced by {@link seedLabel}. Returns null for invalid input. */
export function parseSeedLabel(label: string): number | null {
  const trimmed = label.trim().toLowerCase();
  if (!/^[0-9a-z]{1,7}$/.test(trimmed)) return null;
  const value = parseInt(trimmed, 36);
  return Number.isSafeInteger(value) && value <= 0xffffffff ? value >>> 0 : null;
}
