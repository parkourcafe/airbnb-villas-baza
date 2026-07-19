import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.db.test.ts"],
    // PGlite boots an in-process Postgres (WASM); give it room.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
