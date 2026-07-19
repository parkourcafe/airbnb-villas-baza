import { baseConfig } from "@bai/config/eslint/base";

/**
 * Root ESLint flat config. Each app/package provides its own eslint.config.mjs
 * that extends the appropriate shared preset; this root config lints
 * repository-level scripts and configuration files.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export default [
  ...baseConfig,
  {
    ignores: ["apps/**", "packages/**", "docs/**"],
  },
];
