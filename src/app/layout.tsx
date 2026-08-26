import type { Metadata } from "next";
import Link from "next/link";
import {
  Geist_Mono,
  Cinzel_Decorative,
  Playfair_Display,
  Lora,
  Great_Vibes,
} from "next/font/google";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const cinzelDecorative = Cinzel_Decorative({
  variable: "--font-cinzel-decorative",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair-display",
  subsets: ["latin"],
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
});

const greatVibes = Great_Vibes({
  variable: "--font-great-vibes",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "The League of Crying Gentlemen",
  description: "League history and records for The League of Crying Gentlemen fantasy football league.",
};

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/history", label: "History" },
  { href: "/managers", label: "Managers" },
  { href: "/records", label: "Records" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistMono.variable} ${cinzelDecorative.variable} ${playfairDisplay.variable} ${lora.variable} ${greatVibes.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-charcoal-800 text-ivory">
        <header className="border-b-2 border-gold-500 bg-burgundy-800">
          <nav className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4">
            <span className="font-heading tracking-wide text-gold-300">
              The League of Crying Gentlemen
            </span>
            <div className="flex gap-4 text-sm text-ivory/80">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="hover:text-amber"
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
        <footer className="border-t border-gold-700 bg-bronze py-6 text-center text-xs text-gold-100">
          Data sourced from ESPN Fantasy Football. Interim build — not yet backed by a database.
        </footer>
      </body>
    </html>
  );
}
