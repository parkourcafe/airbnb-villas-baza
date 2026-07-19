import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  format: ["esm"],
  target: "node24",
  platform: "node",
  clean: true,
  sourcemap: true,
  // Bundle the workspace TypeScript packages into the output so the built
  // artifact runs on plain Node without a TS loader.
  noExternal: [/^@bai\//],
});
