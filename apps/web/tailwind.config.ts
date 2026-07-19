import type { Config } from "tailwindcss";
import { baiTailwindPreset } from "@bai/ui/tailwind-preset";

const config: Config = {
  presets: [baiTailwindPreset],
  content: [
    "./src/**/*.{ts,tsx}",
    // Include the shared UI package so its utility classes are generated.
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
};

export default config;
