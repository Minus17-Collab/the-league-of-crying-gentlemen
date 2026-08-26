import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getIncludedSeasonYears,
  getSeasonRecords,
  type SeasonLeaderboard,
} from "@/lib/data/records";

export async function generateStaticParams() {
  const years = await getIncludedSeasonYears();
  return years.map((year) => ({ year: String(year) }));
}

function fmt(value: number, digits = 2): string {
  return value.toFixed(digits);
}

function LeaderboardTable({ leaderboard }: { leaderboard: SeasonLeaderboard }) {
  return (
    <div className="rounded-lg border border-gold-500/30 bg-charcoal-700 p-5">
      <h3 className="font-subheading text-base text-gold-400">{leaderboard.definition.title}</h3>
      {leaderboard.definition.description && (
        <p className="mt-1 text-xs text-ivory/60">{leaderboard.definition.description}</p>
      )}
      <table className="mt-3 w-full border-collapse text-sm text-ivory">
        <tbody>
          {leaderboard.rows.map((row, i) => (
            <tr key={row.franchiseId} className="border-b border-charcoal-600 last:border-0">
              <td className="py-2 pr-3 text-ivory/60">{i + 1}</td>
              <td className="py-2 pr-4">
                <Link href={`/managers/${row.franchiseId}`} className="underline underline-offset-2 hover:text-amber">
                  {row.managerName}
                </Link>
              </td>
              <td className="py-2 text-right font-medium">{fmt(row.value)}</td>
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
            <div key={`${entry.definition.key}-${entry.isPlayoff}`} className="flex flex-col gap-3 rounded-lg border border-gold-500/30 bg-charcoal-700 p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-subheading text-base text-gold-400">
                  {entry.definition.title} {entry.isPlayoff ? "(Playoffs)" : "(Regular Season)"}
                </h3>
                <span className="text-xl font-semibold text-gold-300">{fmt(entry.value)}</span>
              </div>
              {entry.holders.length === 0 ? (
                <p className="text-sm text-ivory/60">Not yet computed.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {entry.holders.map((holder, i) => (
                    <Link
                      key={`${holder.franchiseId}-${i}`}
                      href={`/managers/${holder.franchiseId}`}
                      className="flex items-center justify-between gap-3 rounded-md border border-gold-500/40 bg-gold-500/10 px-3 py-2 transition-colors hover:border-amber hover:bg-gold-500/20"
                    >
                      <span className="flex items-center gap-2">
                        <span aria-hidden="true">🏆</span>
                        <span className="text-base font-semibold text-amber">{holder.managerName}</span>
                      </span>
                      <span className="text-right text-xs text-ivory/70">
                        {typeof holder.context.week === "number" ? `Wk ${holder.context.week}` : ""}
                        {typeof holder.context.opponentManagerName === "string" ? ` vs ${holder.context.opponentManagerName}` : ""}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
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
