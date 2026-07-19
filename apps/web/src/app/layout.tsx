import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@bai/ui/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Bali Accommodation Intelligence",
    template: "%s | Bali Accommodation Intelligence",
  },
  description:
    "Source-agnostic, evidence-backed historical analytics for the Bali accommodation market. Observation language only - never a legal conclusion.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
