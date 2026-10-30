import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "GitNova — Explore. Understand. Contribute.", description: "Your starting point for understanding and contributing to open source." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
