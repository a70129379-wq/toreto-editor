import type { Metadata, Viewport } from "next";
import { Poppins, Space_Mono, Dela_Gothic_One } from "next/font/google";
import "./globals.css";

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-sora" });
const mono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-mono" });
const dela = Dela_Gothic_One({ subsets: ["latin"], weight: "400", variable: "--font-dela" });

export const metadata: Metadata = {
  title: "Toreto | Video Editor",
  description: "Toreto is a video editor. Film edits, car edits, motion graphics, colour grades and viral reels.",
};

export const viewport: Viewport = { themeColor: "#08080c", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${poppins.variable} ${mono.variable} ${dela.variable}`}>
      <body>{children}</body>
    </html>
  );
}
