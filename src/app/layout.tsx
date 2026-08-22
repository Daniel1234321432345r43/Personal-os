import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { DataProvider } from "@/components/providers/data-provider";
import { SettingsProvider } from "@/components/providers/settings-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Núcleo — Tu Sistema Operativo Personal",
    template: "%s · Núcleo",
  },
  description:
    "Tu sistema operativo personal con un Secretario IA que organiza estudios, deporte, hábitos y finanzas.",
  applicationName: "Núcleo",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Núcleo",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <SettingsProvider>
          <DataProvider>{children}</DataProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}
