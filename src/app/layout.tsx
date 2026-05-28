import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { APP_NAME } from "@/lib/constants";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${APP_NAME} — Leer Schaken`,
  description:
    "Leer schaken met AI-coaching. Speel tegen onze grootmeester-bot en ontvang realtime feedback bij elke zet.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
