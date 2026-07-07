import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Editorial type system (see .claude/skills/cutpilot-design):
// Fraunces = display serif (brand voice), Hanken Grotesk = UI grotesque
// (NOT Inter), JetBrains Mono = mono labels/timecodes.
const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  style: ["normal", "italic"],
});
const sans = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CutPilot — the caption instrument",
  description:
    "Transcribe in the browser, cut on a real timeline, and set captions in 97 studio-grade templates. Type-first, no upload to a server.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <head>
        {/* Display fonts used for burned-in CAPTIONS (rendered on <canvas>) —
            separate from the UI type system above. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Anton&family=Archivo+Black&family=Bangers&family=Bebas+Neue&family=Caveat:wght@700&family=JetBrains+Mono:wght@500;700&family=Lora:ital,wght@0,600;1,600&family=Luckiest+Guy&family=Manrope:wght@600;700;800&family=Merriweather:wght@700&family=Montserrat:wght@600;700;800;900&family=Nunito:wght@700;800;900&family=Oswald:wght@500;600;700&family=Outfit:wght@500;600;700;800&family=Pacifico&family=Playfair+Display:ital,wght@0,700;0,800;1,700;1,800&family=Poppins:wght@600;700;800;900&family=Roboto+Mono:wght@500;700&family=Space+Mono:wght@700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
