import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TekForge — CI/CD Platform",
  description: "A developer-friendly CI/CD control plane powered by Tekton.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
