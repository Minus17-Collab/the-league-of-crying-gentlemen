import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "Association of Try Hard Gamers",
  description: "League history and records for the Association of Try Hard Gamers fantasy football league.",
};

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/history", label: "History" },
  { href: "/managers", label: "Managers" },
  { href: "/scoring", label: "Scoring" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
        <header className="border-b border-zinc-200 bg-white">
          <nav className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4">
            <span className="font-semibold tracking-tight">
              Association of Try Hard Gamers
            </span>
            <div className="flex gap-4 text-sm text-zinc-600">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="hover:text-zinc-950"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </nav>
        </header>
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-10">
          {children}
        </main>
        <footer className="border-t border-zinc-200 py-6 text-center text-xs text-zinc-400">
          Data sourced from ESPN Fantasy Football. Interim build — not yet backed by a database.
        </footer>
      </body>
    </html>
  );
}
