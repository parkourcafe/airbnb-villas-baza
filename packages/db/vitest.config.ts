import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Database (PGlite) tests run under the dedicated `test:db` config.
    exclude: ["src/**/*.db.test.ts", "node_modules/**"],
  },
});
