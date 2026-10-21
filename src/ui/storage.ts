/**
 * Browser storage that never throws. Private windows, blocked site data, and
 * full quotas all make Web Storage fail; the game must keep working regardless.
 */

type Area = "local" | "session";

function area(kind: Area): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readJson<T>(kind: Area, key: string, fallback: T): T {
  try {
    const raw = area(kind)?.getItem(key);
    return raw === null || raw === undefined ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeJson(kind: Area, key: string, value: unknown): boolean {
  try {
    area(kind)?.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(kind: Area, key: string) {
  try {
    area(kind)?.removeItem(key);
  } catch {
    // Storage unavailable: nothing to remove.
  }
}
