import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Workboard",
  description: "AI-native dashboard for all your work projects",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="sticky top-0 z-10 border-b border-hairline bg-page/80 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
            <Link href="/" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-ink">
              <span className="grid size-6 place-items-center rounded-md bg-accent text-[13px] font-bold text-white">W</span>
              Workboard
            </Link>
            <nav className="flex items-center gap-4 text-sm text-ink-2">
              <Link href="/" className="hover:text-ink">
                Board
              </Link>
              <Link href="/reports" className="hover:text-ink">
                Reports
              </Link>
            </nav>
            <div className="ml-auto">
              <Link
                href="/projects/new"
                className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-deep"
              >
                New project
              </Link>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
