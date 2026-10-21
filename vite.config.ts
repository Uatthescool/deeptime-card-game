/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
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
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
  },
});
