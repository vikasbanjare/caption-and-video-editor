import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

// Technical / Linear-grade type system: Geist Sans for all UI + headings,
// Geist Mono for labels/timecodes. No serif, no Inter. (Caption *output* fonts
// are loaded separately below.)
export const metadata: Metadata = {
  title: "Pulse — caption NLE · by aifloh",
  description:
    "Transcribe in the browser, cut on a real timeline, and set captions in 97 studio-grade templates. Private by default — nothing leaves your machine.",
};

// Apply the saved theme before paint to avoid a flash.
const themeScript = `try{var t=localStorage.getItem('cutpilot-theme');document.documentElement.dataset.theme=(t==='light'||t==='dark')?t:'dark';}catch(e){document.documentElement.dataset.theme='dark';}`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {/* Fonts for burned-in CAPTIONS (rendered on <canvas>) — separate from
            the UI type system above. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Anton&family=Archivo+Black&family=Bangers&family=Bebas+Neue&family=Caveat:wght@700&family=JetBrains+Mono:wght@500;700&family=Lora:ital,wght@0,600;1,600&family=Luckiest+Guy&family=Manrope:wght@600;700;800&family=Merriweather:wght@700&family=Montserrat:wght@600;700;800;900&family=Nunito:wght@700;800;900&family=Oswald:wght@500;600;700&family=Outfit:wght@500;600;700;800&family=Pacifico&family=Playfair+Display:ital,wght@0,700;0,800;1,700;1,800&family=Poppins:wght@600;700;800;900&family=Roboto+Mono:wght@500;700&family=Space+Mono:wght@700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
