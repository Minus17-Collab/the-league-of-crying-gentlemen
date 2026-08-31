import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ManagerPhoto } from "@/components/ManagerPhoto";
import { Disclosure } from "@/components/Disclosure";
import { SeasonTrendSparkline } from "@/components/SeasonTrendSparkline";
import {
  getManagerDetail,
  getManagers,
  getLeagueAveragePointsForBySeason,
  type ManagerDraftPick,
} from "@/lib/data/league";

export async function generateStaticParams() {
  const managers = await getManagers();
  return managers.map((m) => ({ franchiseId: m.franchiseId }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ franchiseId: string }>;
}): Promise<Metadata> {
  const { franchiseId } = await params;
  const manager = await getManagerDetail(franchiseId);
  if (!manager) return {};
  return {
    title: manager.name,
    description: `Career record, best draft picks, and top players for ${manager.name}.`,
  };
}

function fmt(n: number | null, digits = 1): string {
  return n == null ? "—" : n.toFixed(digits);
}

function DraftPickTable({ picks, caption }: { picks: ManagerDraftPick[]; caption: string }) {
  return (
    <table className="w-full border-collapse overflow-hidden rounded-lg border border-gold-500/30 bg-charcoal-700 text-sm text-ivory">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b border-gold-500/30 bg-charcoal-600 text-left text-ivory/75">
          <th scope="col" className="px-4 py-3 font-medium">Player</th>
          <th scope="col" className="px-4 py-3 font-medium">Year</th>
          <th scope="col" className="px-4 py-3 font-medium">Pick</th>
          <th scope="col" className="px-4 py-3 font-medium">Season Points</th>
          <th scope="col" className="px-4 py-3 font-medium">VOE</th>
          <th scope="col" className="px-4 py-3 font-medium">Regrade</th>
          <th scope="col" className="px-4 py-3 font-medium">Draft Night Grade</th>
        </tr>
      </thead>
      <tbody>
        {picks.map((p, i) => (
          <tr key={`${p.playerId}-${p.year}-${i}`} className="border-b border-charcoal-600 last:border-0">
            <th scope="row" className="px-4 py-3 text-left font-medium">{p.playerName ?? "Unknown"}</th>
            <td className="px-4 py-3 text-ivory/75">{p.year}</td>
            <td className="px-4 py-3 text-ivory/75">
              Rd {p.round} (#{p.overallPick})
            </td>
            <td className="px-4 py-3">{fmt(p.seasonPoints, 1)}</td>
            <td className="px-4 py-3">{p.voe != null ? (p.voe > 0 ? "+" : "") + fmt(p.voe, 1) : "—"}</td>
            <td className="px-4 py-3 font-medium text-gold-400">{p.regradeGrade ?? "—"}</td>
            <td className="px-4 py-3 text-ivory/75">{p.draftNightGrade ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function ManagerDetailPage({
  params,
}: {
  params: Promise<{ franchiseId: string }>;
}) {
  const { franchiseId } = await params;
  const manager = await getManagerDetail(franchiseId);

  if (!manager || manager.seasonsActive.length === 0) {
    notFound();
  }

  const { careerRecord } = manager;
  const leagueAverages = await getLeagueAveragePointsForBySeason(
    manager.seasonTrend.map((p) => p.year),
  );
  const overallLeagueAverage =
    leagueAverages.size > 0
      ? [...leagueAverages.values()].reduce((a, b) => a + b, 0) / leagueAverages.size
      : null;

  const photoSlug = manager.name.split(" ")[0].toLowerCase();
  const photoInitials = manager.name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <Link href="/managers" className="text-sm text-gold-400 underline underline-offset-2 hover:text-amber">
          All managers
        </Link>
      </div>

      {/* Banner */}
      <div className="flex flex-col gap-2 rounded-lg border-2 border-gold-500 bg-charcoal-700 p-6">
        <div className="flex items-center gap-3">
          <ManagerPhoto
            src={`/manager-photos/${photoSlug}.jpg`}
            alt={manager.name}
            initials={photoInitials}
          />
          <h1 className="font-heading text-2xl tracking-wide capitalize text-gold-300">{manager.name}</h1>
          {manager.status === "active" ? (
            <span className="rounded-full bg-gold-100 px-2.5 py-0.5 text-xs font-medium text-gold-800">
              Active
            </span>
          ) : (
            <span className="rounded-full bg-charcoal-600 px-2.5 py-0.5 text-xs font-medium text-ivory/60">
              Left after {manager.retiredAfterSeason}
            </span>
          )}
        </div>
        <p className="text-sm text-ivory/75">
          Seasons active: {manager.seasonsActive.join(", ")}
        </p>
      </div>

      {/* Career summary */}
      <section className="flex flex-col gap-4">
        <h2 className="font-subheading text-lg tracking-wide text-gold-400">Career Summary</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label="Career Record"
            value={`${careerRecord.wins}-${careerRecord.losses}${careerRecord.ties ? `-${careerRecord.ties}` : ""}`}
          />
          <StatCard label="Avg. Final Rank" value={fmt(manager.averageFinalRank, 1)} />
          <StatCard
            label="Best / Worst Finish"
            value={`${manager.bestFinish ?? "—"} / ${manager.worstFinish ?? "—"}`}
          />
          <StatCard label="Championships" value={String(manager.championships)} />
          <StatCard label="Playoff Appearances" value={String(manager.playoffAppearances)} />
          <StatCard label="Playoff Wins" value={String(manager.playoffWins)} />
          <StatCard label="Players Rostered" value={String(manager.uniquePlayersRostered)} />
          <StatCard label="#1 Overall Picks" value={String(manager.numberOneOverallPicks)} />
          {manager.favoritePlayer && (
            <StatCard
              label="Favorite Player"
              value={manager.favoritePlayer.name}
              sub={`${manager.favoritePlayer.position} · ${manager.favoritePlayer.starts} starts${
                manager.favoritePlayer.seasons.length > 1
                  ? ` across ${manager.favoritePlayer.seasons.join(" & ")}`
                  : ""
              }`}
            />
          )}
        </div>
        {manager.strongestPosition && (
          <p className="text-sm text-ivory">
            Strongest position group:{" "}
            <span className="font-medium text-gold-400">{manager.strongestPosition.position}</span>{" "}
            ({fmt(manager.strongestPosition.totalPoints, 1)} total points across their career)
          </p>
        )}
      </section>

      {/* Season trend */}
      {manager.seasonTrend.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-subheading text-lg tracking-wide text-gold-400">Season Trend</h2>
          <SeasonTrendSparkline points={manager.seasonTrend} leagueAverage={overallLeagueAverage} />
        </section>
      )}

      {/* Top scorers */}
      <section className="flex flex-col gap-3">
        <h2 className="font-subheading text-lg tracking-wide text-gold-400">Top Scorers Ever Rostered</h2>
        {manager.topScorers.length === 0 ? (
          <p className="text-sm text-ivory">No lineup data available yet.</p>
        ) : (
          <table className="w-full border-collapse overflow-hidden rounded-lg border border-gold-500/30 bg-charcoal-700 text-sm text-ivory">
            <caption className="sr-only">Top scorers ever rostered</caption>
            <thead>
              <tr className="border-b border-gold-500/30 bg-charcoal-600 text-left text-ivory/75">
                <th scope="col" className="px-4 py-3 font-medium">Player</th>
                <th scope="col" className="px-4 py-3 font-medium">Position</th>
                <th scope="col" className="px-4 py-3 font-medium">Seasons</th>
                <th scope="col" className="px-4 py-3 font-medium">Total Points</th>
              </tr>
            </thead>
            <tbody>
              {manager.topScorers.map((p) => (
                <tr key={p.playerId} className="border-b border-charcoal-600 last:border-0">
                  <th scope="row" className="px-4 py-3 text-left font-medium">{p.name}</th>
                  <td className="px-4 py-3 text-ivory/75">{p.position}</td>
                  <td className="px-4 py-3 text-ivory/75">{p.seasons.join(", ")}</td>
                  <td className="px-4 py-3">{fmt(p.totalPoints, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Best draft picks */}
      <section className="flex flex-col gap-3">
        <h2 className="font-subheading text-lg tracking-wide text-gold-400">Best Draft Picks</h2>
        <Disclosure summary="How Regrade and Draft Night Grade are calculated">
          <p>
            Regrade (VOE) compares each pick&apos;s actual season points to the expected value for
            that draft round, pooled across this league&apos;s own draft history — exact, not
            curved. Draft Night Grade is curved against market ADP (Fantasy Football Calculator)
            and is approximate — see{" "}
            <code className="rounded bg-charcoal-900 px-1 py-0.5 text-gold-300">data_gaps</code>{" "}
            for details.
          </p>
        </Disclosure>
        {manager.bestDraftPicks.length === 0 ? (
          <p className="text-sm text-ivory">No graded draft picks available yet.</p>
        ) : (
          <DraftPickTable picks={manager.bestDraftPicks} caption="Best draft picks" />
        )}
      </section>

      {/* Worst draft picks */}
      <section className="flex flex-col gap-3">
        <h2 className="font-subheading text-lg tracking-wide text-gold-400">Worst Draft Picks</h2>
        {manager.worstDraftPicks.length === 0 ? (
          <p className="text-sm text-ivory">No graded draft picks available yet.</p>
        ) : (
          <DraftPickTable picks={manager.worstDraftPicks} caption="Worst draft picks" />
        )}
      </section>

      {/* Rivalries */}
      <section className="flex flex-col gap-3">
        <h2 className="font-subheading text-lg tracking-wide text-gold-400">Rivalries</h2>
        <p className="max-w-2xl text-xs text-ivory/60">
          Regular season only, excluding the 2023 founding season — same scope as{" "}
          <Link href="/h2h" className="underline underline-offset-2 hover:text-amber">
            the head-to-head page
          </Link>
          .
        </p>
        {manager.rivalries.length === 0 ? (
          <p className="text-sm text-ivory">No regular-season matchups recorded yet.</p>
        ) : (
          <table className="w-full border-collapse overflow-hidden rounded-lg border border-gold-500/30 bg-charcoal-700 text-sm text-ivory">
            <caption className="sr-only">Rivalries by games played</caption>
            <thead>
              <tr className="border-b border-gold-500/30 bg-charcoal-600 text-left text-ivory/75">
                <th scope="col" className="px-4 py-3 font-medium">Opponent</th>
                <th scope="col" className="px-4 py-3 font-medium">Record</th>
                <th scope="col" className="px-4 py-3 font-medium">Points For</th>
                <th scope="col" className="px-4 py-3 font-medium">Points Against</th>
              </tr>
            </thead>
            <tbody>
              {manager.rivalries.map((r) => (
                <tr key={r.opponentFranchiseId} className="border-b border-charcoal-600 last:border-0">
                  <th scope="row" className="px-4 py-3 text-left font-medium">
                    <Link
                      href={`/managers/${r.opponentFranchiseId}`}
                      className="underline underline-offset-2 hover:text-amber"
                    >
                      {r.opponentName}
                    </Link>
                  </th>
                  <td className="px-4 py-3 text-ivory/75">
                    {r.wins}-{r.losses}
                    {r.ties ? `-${r.ties}` : ""}
                  </td>
                  <td className="px-4 py-3">{fmt(r.pointsFor, 1)}</td>
                  <td className="px-4 py-3">{fmt(r.pointsAgainst, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-gold-500/30 bg-charcoal-700 p-4">
      <div className="text-xs text-ivory/75">{label}</div>
      <div className="text-xl font-semibold tracking-tight text-gold-300">{value}</div>
      {sub && <div className="text-xs text-ivory/60">{sub}</div>}
    </div>
  );
}
