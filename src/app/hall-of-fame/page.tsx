import Link from "next/link";
import type { Metadata } from "next";
import { getChampions, getAwards } from "@/lib/data/league";
import { getAllTimeRecords } from "@/lib/data/records";
import { formatRecordValue } from "@/lib/records/format";

export const metadata: Metadata = {
  title: "Hall of Fame",
  description: "Champions, record holders, and league legends.",
};

export default async function HallOfFame() {
  const [champions, allTimeRecords, awards] = await Promise.all([
    getChampions(),
    getAllTimeRecords(),
    getAwards(),
  ]);

  const featuredRecords = allTimeRecords.filter((r) => r.holders.length > 0).slice(0, 6);

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="font-heading text-2xl tracking-wide text-gold-400">Hall of Fame</h1>
        <p className="mt-2 max-w-2xl text-sm text-ivory">
          Champions, record holders, and the league&apos;s most memorable moments. Established 2023.
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="font-subheading text-lg tracking-wide text-gold-400">Champions</h2>
        {champions.length === 0 ? (
          <p className="text-sm text-ivory/75">No champions recorded yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {champions.map((c) => (
              <Link
                key={c.year}
                href={`/managers/${c.franchiseId}`}
                className="flex flex-col gap-1 rounded-lg border border-gold-500/30 bg-charcoal-700 p-5 hover:border-gold-500"
              >
                <span className="text-xs tracking-widest text-gold-300">{c.year} CHAMPION</span>
                <span className="font-heading text-xl text-ivory">{c.managerName}</span>
                <span className="text-sm text-ivory/75">{c.teamName.trim()}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-subheading text-lg tracking-wide text-gold-400">Record Holders</h2>
        {featuredRecords.length === 0 ? (
          <p className="text-sm text-ivory/75">No records computed yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featuredRecords.map((r) => (
              <div
                key={r.definition.key}
                className="flex flex-col gap-1 rounded-lg border border-gold-500/30 bg-charcoal-700 p-5"
              >
                <span className="text-xs tracking-widest text-gold-300">{r.definition.title}</span>
                <span className="font-heading text-xl text-ivory">
                  {formatRecordValue(r.definition.key, r.value)}
                </span>
                <span className="text-sm text-ivory/75">
                  {r.holders.map((h) => h.managerName).join(", ")}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {awards.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="font-subheading text-lg tracking-wide text-gold-400">League Awards</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {awards.map((a) => (
              <div
                key={a.id}
                className="flex flex-col gap-1 rounded-lg border border-gold-500/30 bg-charcoal-700 p-5"
              >
                <span className="text-xs tracking-widest text-gold-300">
                  {a.year ? `${a.year} — ` : ""}
                  {a.title}
                </span>
                <span className="font-heading text-xl text-ivory">
                  {a.managerName ?? "League"}
                </span>
                {a.note && <span className="text-sm text-ivory/75">{a.note}</span>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
