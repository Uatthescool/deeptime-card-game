/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { availableParallelism } from "node:os";

import { defineConfig } from "vite";

// GitHub Pages serves a project site from /<repository>/. The deploy workflow
// sets BASE_PATH; local development and custom domains use the root.
const base = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    target: "es2022",
    sourcemap: true,
    // All card, deck, and Lesson data ships in the main bundle so the game needs no further loading
    // (about 150 kB gzipped). Revisit with code splitting if it grows much past this.
    chunkSizeWarningLimit: 650,
  },
  // The computer opponent thinks in a module Web Worker.
  worker: { format: "es" },
  test: {
    environment: "node",
    // The simulation suites keep a core busy for minutes each; leaving headroom stops them from starving
    // other test workers past Vitest's fixed 60-second start timeout.
    maxWorkers: Math.max(2, Math.floor(availableParallelism() / 2)),
    // Worker threads start in well under a second; forked processes sometimes missed that timeout on Windows.
    pool: "threads",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
  },
});
