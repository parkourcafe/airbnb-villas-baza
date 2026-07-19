import { nextConfig } from "@bai/config/eslint/next";

export default [
  ...nextConfig,
  {
    ignores: [".next/**", "next-env.d.ts"],
  },
];
