import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import { CommandPalette, PaletteHint } from "@/components/command-palette";
import { NavLinks } from "@/components/nav-links";
import { ThemeToggle } from "@/components/theme-toggle";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-inter" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], weight: ["500"], variable: "--font-jetbrains-mono" });

export const metadata: Metadata = {
  title: "Workboard",
  description: "AI-native dashboard for all your work projects",
};

// Runs before paint: honor saved theme, else system preference. Kept inline to avoid FOUC.
const themeInit = `try{var t=localStorage.getItem("wb-theme");if(!t)t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="dark"}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-screen">
        <header className="sticky top-0 z-10 border-b border-hairline bg-page/80 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-7 px-4">
            <Link href="/" className="flex items-center gap-2 text-[14.5px] font-semibold tracking-tight text-ink">
              <span className="grid size-[22px] place-items-center rounded-md bg-accent text-[12px] font-bold text-white">W</span>
              Workboard
            </Link>
            <NavLinks />
            <div className="ml-auto flex items-center gap-2.5">
              <PaletteHint />
              <ThemeToggle />
              <Link
                href="/projects/new"
                className="rounded-lg bg-accent px-3.5 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-accent-deep"
              >
                New project
              </Link>
            </div>
          </div>
        </header>
        <CommandPalette />
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
