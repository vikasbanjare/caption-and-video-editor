import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CutPilot — AI Caption Studio",
  description:
    "Upload a video, transcribe it in your browser, and style animated captions with premium templates.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        {/* Display fonts used for burned-in captions (rendered on <canvas>). */}
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
