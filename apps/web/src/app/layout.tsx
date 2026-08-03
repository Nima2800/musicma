import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import { AppShell } from "@/components/layout/AppShell";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { DeepLinkPlay } from "@/components/DeepLinkPlay";
import { PlayerProvider } from "@/components/player/PlayerProvider";
import { StickyPlayer } from "@/components/player/StickyPlayer";
import { MobileNav } from "@/components/layout/MobileNav";
import "./globals.css";

const vazirmatn = Vazirmatn({
  variable: "--font-vazirmatn",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Musicma",
  description: "آرشیو زنده آهنگ از کانال‌های تلگرام",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" className={`${vazirmatn.variable} h-full`} data-theme="light">
      <body className="min-h-full antialiased">
        <ThemeProvider>
          <PlayerProvider>
            <DeepLinkPlay />
            <AppShell>{children}</AppShell>
            <StickyPlayer />
            <MobileNav />
          </PlayerProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
