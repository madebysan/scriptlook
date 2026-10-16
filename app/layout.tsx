import type { Metadata } from "next";
import {
  Courier_Prime,
  DM_Sans,
  Instrument_Serif,
  Oswald,
  Space_Mono,
} from "next/font/google";
import { InteractionAudio } from "@/components/ui/interaction-audio";
import { ApiKeysProvider } from "@/lib/api-keys-context";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-display-serif",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: "400",
  display: "swap",
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

// Paper-form direction: Courier Prime is the typewriter body voice, Oswald is
// the stamped display voice. Both only take effect inside a `.paper` scope —
// the dark in-app report keeps DM Sans / Space Mono untouched.
const courierPrime = Courier_Prime({
  variable: "--font-courier-prime",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "Scriptlook",
    // Per-page titles become "Title — Scriptlook" automatically.
    template: "%s — Scriptlook",
  },
  description:
    "A workspace for filmmakers and creative teams turning scripts into decks, references, storyboards, posters, and release plans.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Scriptlook",
    description:
      "A workspace for filmmakers and creative teams turning scripts into decks, references, storyboards, posters, and release plans.",
    type: "website",
    url: "/",
    siteName: "Scriptlook",
  },
  twitter: {
    card: "summary",
    title: "Scriptlook",
    description:
      "A workspace for filmmakers and creative teams turning scripts into decks, references, storyboards, posters, and release plans.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${dmSans.variable} ${instrumentSerif.variable} ${spaceMono.variable} ${courierPrime.variable} ${oswald.variable} antialiased`}
      >
        <ApiKeysProvider>
          {children}
          <InteractionAudio />
        </ApiKeysProvider>
      </body>
    </html>
  );
}
