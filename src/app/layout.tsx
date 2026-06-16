import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CutPilot — Caption Editor",
  description:
    "Upload a video, auto-transcribe, style animated captions, and preview them live.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
