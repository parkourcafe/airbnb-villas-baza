import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Compile the workspace TypeScript packages instead of expecting prebuilt dist.
  transpilePackages: [
    "@bai/ui",
    "@bai/domain",
    "@bai/db",
    "@bai/import-engine",
    "@bai/snapshot-engine",
    "@bai/event-engine",
    "@bai/reporting",
    "@bai/source-sdk",
    "@bai/test-fixtures",
  ],
  // Linting runs as a dedicated `pnpm lint` task (flat config) rather than during build.
  eslint: { ignoreDuringBuilds: true },
  // Silence the monorepo lockfile-root inference warning.
  outputFileTracingRoot: repoRoot,
};

export default nextConfig;
