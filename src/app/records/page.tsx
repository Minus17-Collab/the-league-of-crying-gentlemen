import Link from "next/link";
import {
  getAllTimeRecords,
  getFranchiseRecords,
  getIncludedSeasonYears,
  type AllTimeRecordEntry,
} from "@/lib/data/records";

function fmt(value: number, digits = 2): string {
  return value.toFixed(digits);
}

function HoldersList({ entry }: { entry: AllTimeRecordEntry }) {
  if (entry.holders.length === 0) {
    return <p className="text-sm text-ivory/60">Not yet computed.</p>;
  }
  return (
    <div className="flex flex-col gap-1">
      {entry.holders.map((holder, i) => (
        <div key={`${holder.franchiseId}-${i}`} className="flex items-baseline justify-between gap-3 text-sm">
          <Link
            href={`/managers/${holder.franchiseId}`}
            className="font-medium text-ivory underline underline-offset-2 hover:text-amber"
          >
            {holder.managerName}
          </Link>
          <span className="text-right text-ivory/70">{contextLabel(holder.context)}</span>
        </div>
      ))}
    </div>
  );
}

function contextLabel(context: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof context.seasonYear === "number") parts.push(`${context.seasonYear}`);
  if (typeof context.week === "number") parts.push(`Wk ${context.week}`);
  if (typeof context.opponentManagerName === "string") parts.push(`vs ${context.opponentManagerName}`);
  if (typeof context.startSeasonYear === "number" && typeof context.endSeasonYear === "number") {
    const cross = context.crossSeason === true;
    parts.push(
      cross
        ? `${context.startSeasonYear} wk${context.startWeek} → ${context.endSeasonYear} wk${context.endWeek} (cross-season)`
        : `${context.startSeasonYear}, wk ${context.startWeek}–${context.endWeek}`,
    );
  }
  if (typeof context.actualWins === "number" && typeof context.wouldBeWins === "number") {
    parts.push(`${context.actualWins} actual wins vs ${fmt(context.wouldBeWins as number, 2)} all-play wins`);
  }
  return parts.join(" · ");
}

function RecordCard({ entry }: { entry: AllTimeRecordEntry }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gold-500/30 bg-charcoal-700 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-subheading text-base text-gold-400">{entry.definition.title}</h3>
        <span className="text-xl font-semibold text-gold-300">{fmt(entry.value)}</span>
      </div>
      {entry.definition.description && (
        <p className="text-xs text-ivory/60">{entry.definition.description}</p>
      )}
      <HoldersList entry={entry} />
    </div>
  );
}

export default async function RecordsPage() {
  const [allTime, franchiseRecords, years] = await Promise.all([
    getAllTimeRecords(),
    getFranchiseRecords(),
    getIncludedSeasonYears(),
  ]);

  const regularSeasonScoring = allTime.filter((e) =>
    ["alltime_highest_scoring_season", "alltime_lowest_scoring_season"].includes(e.definition.key),
  );
  const singleWeek = allTime.filter((e) => e.definition.key.includes("single_week"));
  const margins = allTime.filter((e) => e.definition.key.includes("margin"));
  const streaks = allTime.filter((e) => e.definition.key.includes("streak"));
  const luck = allTime.filter((e) => e.definition.key.includes("luck"));
  const other = allTime.filter(
    (e) =>
      e.definition.key === "alltime_highest_scoring_playoff_run" ||
      e.definition.key === "alltime_toughest_schedule",
  );

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="font-heading text-2xl tracking-wide text-gold-400">League Records</h1>
        <p className="mt-2 max-w-2xl text-sm text-ivory">
          All-time records cover the {years.slice().reverse().join(" and ")} seasons only — the
          league&apos;s first season used materially different scoring rules and team count and is
          excluded from every comparison below. Playoff records count only winners-bracket games;
          placement/consolation games are excluded entirely. Ties are never broken: every
          co-record-holder is listed.
        </p>
        <div className="mt-3 flex gap-3 text-sm">
          {years.map((year) => (
            <Link key={year} href={`/records/${year}`} className="text-gold-400 underline underline-offset-2 hover:text-amber">
              {year} season records →
            </Link>
          ))}
        </div>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="font-subheading text-lg tracking-wide text-gold-400">Season Scoring</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {regularSeasonScoring.map((e) => (
            <RecordCard key={e.definition.key} entry={e} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-subheading text-lg tracking-wide text-gold-400">Single Week Scoring</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {singleWeek.map((e) => (
            <RecordCard key={e.definition.key} entry={e} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-subheading text-lg tracking-wide text-gold-400">Margins</h2>
        <p className="max-w-2xl text-xs text-ivory/60">
          Regular season only — margin of victory is averaged over wins only, margin of defeat over
          losses only.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {margins.map((e) => (
            <RecordCard key={e.definition.key} entry={e} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-subheading text-lg tracking-wide text-gold-400">Streaks</h2>
        <p className="max-w-2xl text-xs text-ivory/60">
          Regular season only. A streak may cross the season boundary for a manager who played both
          included seasons — labeled &quot;cross-season&quot; when it does.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {streaks.map((e) => (
            <RecordCard key={e.definition.key} entry={e} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-subheading text-lg tracking-wide text-gold-400">Luck (All-Play Method)</h2>
        <p className="max-w-2xl text-xs text-ivory/60">
          Regular season only. Each week, every manager&apos;s score is ranked against the full
          field to compute a normalized &quot;would-be win&quot; share; summed across the season
          and compared to actual wins. Positive gap = lucky, negative = unlucky.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {luck.map((e) => (
            <RecordCard key={e.definition.key} entry={e} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-subheading text-lg tracking-wide text-gold-400">Other</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {other.map((e) => (
            <RecordCard key={e.definition.key} entry={e} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-subheading text-lg tracking-wide text-gold-400">Franchise Records</h2>
        <div className="flex flex-col gap-4">
          {franchiseRecords.map((section) => (
            <div key={section.definition.key} className="rounded-lg border border-gold-500/30 bg-charcoal-700 p-5">
              <h3 className="font-subheading text-base text-gold-400">{section.definition.title}</h3>
              {section.definition.description && (
                <p className="mt-1 text-xs text-ivory/60">{section.definition.description}</p>
              )}
              {section.unavailable ? (
                <p className="mt-3 text-sm text-ivory/60">
                  Not available for this league — see the description above for why, and what would
                  need to be logged going forward to support this record.
                </p>
              ) : (
                <table className="mt-3 w-full border-collapse text-sm text-ivory">
                  <tbody>
                    {section.rows.map((row) => (
                      <tr key={row.franchiseId} className="border-b border-charcoal-600 last:border-0">
                        <td className="py-2 pr-4">
                          <Link
                            href={`/managers/${row.franchiseId}`}
                            className="underline underline-offset-2 hover:text-amber"
                          >
                            {row.managerName}
                          </Link>
                        </td>
                        <td className="py-2 text-right font-medium">{fmt(row.value, 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
