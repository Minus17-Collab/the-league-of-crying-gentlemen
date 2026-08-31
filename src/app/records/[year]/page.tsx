import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getIncludedSeasonYears,
  getSeasonRecords,
  type SeasonLeaderboard,
} from "@/lib/data/records";
import { formatRecordValue } from "@/lib/records/format";
import { RecordCard } from "@/components/RecordCard";

export async function generateStaticParams() {
  const years = await getIncludedSeasonYears();
  return years.map((year) => ({ year: String(year) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ year: string }>;
}): Promise<Metadata> {
  const { year } = await params;
  return {
    title: `${year} Records`,
    description: `Season records for ${year}.`,
  };
}

function LeaderboardTable({ leaderboard }: { leaderboard: SeasonLeaderboard }) {
  return (
    <div className="rounded-lg border border-gold-500/30 bg-charcoal-700 p-5">
      <h3 className="font-subheading text-base text-gold-400">{leaderboard.definition.title}</h3>
      {leaderboard.definition.description && (
        <p className="mt-1 text-xs text-ivory/60">{leaderboard.definition.description}</p>
      )}
      <table className="mt-3 w-full border-collapse text-sm text-ivory">
        <caption className="sr-only">{leaderboard.definition.title} by manager</caption>
        <thead>
          <tr className="border-b border-gold-500/30 text-left text-ivory/75">
            <th scope="col" className="py-2 pr-3 font-medium">
              #
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              Manager
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              Value
            </th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.rows.map((row, i) => (
            <tr key={row.franchiseId} className="border-b border-charcoal-600 last:border-0">
              <td className="py-2 pr-3 text-ivory/60">{i + 1}</td>
              <th scope="row" className="py-2 pr-4 text-left font-normal">
                <Link href={`/managers/${row.franchiseId}`} className="underline underline-offset-2 hover:text-amber">
                  {row.managerName}
                </Link>
              </th>
              <td className="py-2 text-right font-medium tabular-nums">
                {formatRecordValue(leaderboard.definition.key, row.value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function SeasonRecordsPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year: yearParam } = await params;
  const year = Number(yearParam);
  const included = await getIncludedSeasonYears();
  if (!included.includes(year)) {
    notFound();
  }

  const { leaderboards, extremes } = await getSeasonRecords(year);

  const regularExtremes = extremes.filter((e) => !e.isPlayoff);
  const playoffExtremes = extremes.filter((e) => e.isPlayoff);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl tracking-wide text-gold-400">{year} Records</h1>
        <Link href="/records" className="text-sm text-gold-400 underline underline-offset-2 hover:text-amber">
          All-time records
        </Link>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="font-subheading text-lg tracking-wide text-gold-400">Single Week Extremes</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {[...regularExtremes, ...playoffExtremes].map((entry) => (
            <RecordCard
              key={`${entry.definition.key}-${entry.isPlayoff}`}
              title={entry.definition.title}
              scope={entry.isPlayoff ? "Playoffs" : "Regular season"}
              value={formatRecordValue(entry.definition.key, entry.value)}
              description={entry.definition.description}
              holders={entry.holders}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-subheading text-lg tracking-wide text-gold-400">Season Leaderboards</h2>
        <p className="max-w-2xl text-xs text-ivory/60">
          Regular season only. Longest win/loss streaks are scoped to this season only (no
          cross-season carryover here — see the all-time page for that).
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {leaderboards.map((lb) => (
            <LeaderboardTable key={lb.definition.key} leaderboard={lb} />
          ))}
        </div>
      </section>
    </div>
  );
}
