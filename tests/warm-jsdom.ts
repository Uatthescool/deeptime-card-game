import { createRequire } from "node:module";

/**
 * Vitest global setup: loads jsdom once in the main process before any test worker starts.
 *
 * A jsdom test worker must load jsdom's ~700 files inside Vitest's fixed 60-second worker start
 * timeout. When those files have dropped out of the disk cache (memory pressure evicts it, and
 * antivirus scans each file again on first read), that load is far slower than its usual second.
 * Reading them here, where no timeout applies, leaves the worker only the work of evaluating files
 * that are already cached.
 */
export default function warmJsdom() {
  // jsdom ships no types, and only the side effect of loading it matters here.
  const { JSDOM } = createRequire(import.meta.url)("jsdom") as {
    JSDOM: new (html: string) => { window: { close(): void } };
  };
  new JSDOM("<!DOCTYPE html>").window.close();
}
