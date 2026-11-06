import type { Metadata, Viewport } from "next";
import { Poppins, Space_Mono, Dela_Gothic_One } from "next/font/google";
import "./globals.css";
import { films, siteUrl, youtube } from "../lib/content";

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-sora" });
const mono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-mono" });
const dela = Dela_Gothic_One({ subsets: ["latin"], weight: "400", variable: "--font-dela" });

const title = "Toreto | Video Editor for Films, Car Edits, Reels and Motion Graphics";
const description =
  "Toreto is a video editor for film edits, car edits, motion graphics, colour grades and viral reels. Watch the work and start your project.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  applicationName: "Toreto",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  verification: { google: "JdibmJ0DBdst4--AMCoTYnRfe3ULtlirgdHJVY00B1Q" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Toreto",
    title,
    description,
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "Toreto, video editor" }],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/og.jpg"] },
};

// Tells search engines who this site is about and what work it shows.
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", "@id": `${siteUrl}/#website`, url: `${siteUrl}/`, name: "Toreto", inLanguage: "en" },
    {
      "@type": "Person",
      "@id": `${siteUrl}/#toreto`,
      name: "Toreto",
      jobTitle: "Video Editor",
      url: `${siteUrl}/`,
      image: `${siteUrl}/og.jpg`,
      sameAs: [youtube],
      knowsAbout: ["Video editing", "Motion graphics", "Colour grading", "Short-form video"],
    },
    {
      "@type": "ItemList",
      name: "Video edits by Toreto",
      itemListElement: films.map((f, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: { "@type": "CreativeWork", name: f.title, description: f.note, genre: f.discipline, creator: { "@id": `${siteUrl}/#toreto` } },
      })),
    },
  ],
};

export const viewport: Viewport = { themeColor: "#08080c", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${poppins.variable} ${mono.variable} ${dela.variable}`}>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
        {children}
      </body>
    </html>
  );
}
