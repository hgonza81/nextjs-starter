import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { GeistSans } from "geist/font/sans";
import type { ReactNode } from "react";
import { PRODUCT_NAME } from "@/components/brand/wordmark";
import { Toaster } from "@/components/ui/sonner";
import { assertFaultInjection } from "@/lib/fault-injection";
import "./globals.css";

export const metadata: Metadata = {
  title: PRODUCT_NAME,
};

// Lets the browser paint the canvas in the right theme before any CSS applies
// (design system 2.1). The theme itself comes from the tokens in globals.css.
export const viewport: Viewport = {
  colorScheme: "light dark",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  // PH-FR-15: opts every page into dynamic rendering so Next can stamp the
  // per-request CSP nonce on its scripts (ADR 0014).
  await connection();
  // PH-FR-23: test-only seam, a no-op unless DESIGN_PAGE_ENABLED is on.
  await assertFaultInjection();
  return (
    <html lang="en" className={GeistSans.variable}>
      <body>
        {children}
        {/* The only Toaster in the app (design system 4.9). */}
        <Toaster />
      </body>
    </html>
  );
}
