import nextPlugin from "@next/eslint-plugin-next";
import { reactConfig } from "./react.mjs";

/**
 * ESLint flat config for the Next.js application.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const nextConfig = [
  ...reactConfig,
  {
    files: ["**/*.{ts,tsx,jsx}"],
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },
];

export default nextConfig;
