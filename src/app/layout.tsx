import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { NKProviders } from "@/components/nk/nk-providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "НК-Контроль — Система нормативного контроля",
  description:
    "Веб-приложение помощника нормоконтролера для судостроительного предприятия. Загрузка чертежей, VLM-распознавание штампа, детерминированные и семантические правила проверки, база знаний ГОСТ/ОСТ/СТО.",
  keywords: [
    "нормоконтроль",
    "судостроение",
    "ГОСТ",
    "ЕСКД",
    "чертеж",
    "штамп",
    "VLM",
  ],
  authors: [{ name: "Северо-Верфь" }],
  icons: {
    icon: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <NKProviders>
          {children}
          <Toaster />
          <SonnerToaster position="top-right" richColors closeButton />
        </NKProviders>
      </body>
    </html>
  );
}
