import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  format: ["esm"],
  target: "node24",
  platform: "node",
  clean: true,
  sourcemap: true,
  // Bundle the workspace TS packages; keep `playwright` external (loaded lazily,
  // only when the live collector flag is enabled).
  noExternal: [/^@bai\//],
  external: ["playwright"],
});
