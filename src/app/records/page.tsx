import Link from "next/link";
import type { Metadata } from "next";
import {
  getAllTimeRecords,
  getFranchiseRecords,
  getIncludedSeasonYears,
  type AllTimeRecordEntry,
} from "@/lib/data/records";
import { formatCount, formatRecordValue } from "@/lib/records/format";
import { RecordCard as RecordCardBase } from "@/components/RecordCard";
import { Disclosure } from "@/components/Disclosure";

export const metadata: Metadata = {
  title: "League Records",
  description: "All-time single-week, season, streak, and luck records.",
};

function RecordCard({ entry }: { entry: AllTimeRecordEntry }) {
  return (
    <RecordCardBase
      title={entry.definition.title}
      scope={entry.isPlayoff ? "Playoffs" : undefined}
      value={formatRecordValue(entry.definition.key, entry.value)}
      description={entry.definition.description}
      holders={entry.holders}
    />
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
  const singleWeekRegular = allTime.filter(
    (e) => e.definition.key.includes("single_week") && !e.isPlayoff,
  );
  const singleWeekPlayoff = allTime.filter(
    (e) => e.definition.key.includes("single_week") && e.isPlayoff,
  );
  const margins = allTime.filter((e) => e.definition.key.includes("margin"));
  const streaks = allTime.filter((e) => e.definition.key.includes("streak"));
  const luck = allTime.filter((e) => e.definition.key.includes("luck"));
  const otherRegular = allTime.filter((e) => e.definition.key === "alltime_toughest_schedule");
  const otherPlayoff = allTime.filter((e) => e.definition.key === "alltime_highest_scoring_playoff_run");

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="font-heading text-2xl tracking-wide text-gold-400">League Records</h1>
        <p className="mt-2 max-w-2xl text-sm text-ivory">
          All-time records cover the {years.slice().reverse().join(" and ")} seasons only. The
          league&apos;s inaugural 2023 season used different scoring rules before the league moved to
          standard PPR and is excluded from every all-time comparison below. Playoff records count
          only winners-bracket games; placement/consolation games are excluded entirely. Ties are
          never broken: every co-record-holder is listed.
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
        <h2 className="font-subheading text-lg tracking-wide text-gold-400">Regular Season Records</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          {regularSeasonScoring.map((e) => (
            <RecordCard key={e.definition.key} entry={e} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="font-subheading text-base tracking-wide text-gold-300">Single Week Scoring</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {singleWeekRegular.map((e) => (
            <RecordCard key={e.definition.key} entry={e} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="font-subheading text-base tracking-wide text-gold-300">Margins</h3>
        <p className="max-w-2xl text-xs text-ivory/60">
          Margin of victory is averaged over wins only, margin of defeat over losses only.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {margins.map((e) => (
            <RecordCard key={e.definition.key} entry={e} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="font-subheading text-base tracking-wide text-gold-300">Streaks</h3>
        <p className="max-w-2xl text-xs text-ivory/60">
          A streak may cross the season boundary for a manager who played both included seasons —
          labeled &quot;cross-season&quot; when it does.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {streaks.map((e) => (
            <RecordCard key={e.definition.key} entry={e} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="font-subheading text-base tracking-wide text-gold-300">Luck</h3>
        <p className="max-w-2xl text-sm text-ivory">
          Compares each manager&apos;s weekly score against the entire league to find how many
          wins their scoring actually earned.
        </p>
        <Disclosure summary="How this is calculated">
          <p>
            Every week, we check how a manager&apos;s score would have done against the{" "}
            <em>whole league</em> that week, not just their actual opponent. Each manager gets
            partial credit for how many of the other teams they outscored (a tie counts as half a
            win), and adding that up across the season produces a &quot;would-be&quot; win total
            based purely on scoring strength, regardless of who they actually played.
          </p>
          <p className="mt-2">
            Comparing that would-be total to a manager&apos;s real win total reveals the luck:
            winning more real games than your scores earned makes you the{" "}
            <span className="font-medium text-gold-400">luckiest</span>; your scores deserving
            more wins than you actually got makes you the{" "}
            <span className="font-medium text-gold-400">unluckiest</span>. Regular season only.
          </p>
        </Disclosure>
        <div className="grid gap-4 sm:grid-cols-2">
          {luck.map((e) => (
            <RecordCard key={e.definition.key} entry={e} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="font-subheading text-base tracking-wide text-gold-300">Schedule</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {otherRegular.map((e) => (
            <RecordCard key={e.definition.key} entry={e} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-subheading text-lg tracking-wide text-gold-400">Playoff Records</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          {otherPlayoff.map((e) => (
            <RecordCard key={e.definition.key} entry={e} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="font-subheading text-base tracking-wide text-gold-300">Single Week Scoring</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {singleWeekPlayoff.map((e) => (
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
                <div className="mt-3 rounded-md border border-dashed border-gold-500/20 bg-charcoal-800/50 px-4 py-3">
                  <p className="text-sm text-ivory/50">
                    Not available for this league. See the description above for what&apos;s
                    missing and what would need to be logged going forward to support this record.
                  </p>
                </div>
              ) : (
                <table className="mt-3 w-full border-collapse text-sm text-ivory">
                  <caption className="mb-2 text-left text-xs text-ivory/50">
                    {section.definition.title}, combined across all included seasons.
                  </caption>
                  <thead>
                    <tr className="border-b border-gold-500/30 text-left text-ivory/75">
                      <th scope="col" className="py-2 pr-4 font-medium">
                        Manager
                      </th>
                      <th scope="col" className="py-2 text-right font-medium">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.rows.map((row, i) => (
                      <tr
                        key={row.franchiseId}
                        className={`border-b border-charcoal-600 last:border-0 ${i % 2 === 1 ? "bg-charcoal-800/40" : ""}`}
                      >
                        <th scope="row" className="py-2 pr-4 text-left font-normal">
                          <Link
                            href={`/managers/${row.franchiseId}`}
                            className="underline underline-offset-2 hover:text-amber"
                          >
                            {row.managerName}
                          </Link>
                        </th>
                        <td className="py-2 text-right font-medium tabular-nums">{formatCount(row.value)}</td>
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
