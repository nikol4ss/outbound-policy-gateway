import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Call Policy — Outbound calling controls", template: "%s | Call Policy" },
  description: "Apply your outbound calling policy before every AI call. Centralize consent, opt-outs, and decision evidence across Vapi and Retell.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body><a className="skip-link" href="#main">Skip to content</a>{children}</body></html>;
}
