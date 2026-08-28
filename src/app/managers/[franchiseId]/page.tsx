import Link from "next/link";
import { notFound } from "next/navigation";
import { ManagerPhoto } from "@/components/ManagerPhoto";
import { getManagerDetail, getManagers } from "@/lib/data/league";

export async function generateStaticParams() {
  const managers = await getManagers();
  return managers.map((m) => ({ franchiseId: m.franchiseId }));
}

function fmt(n: number | null, digits = 1): string {
  return n == null ? "—" : n.toFixed(digits);
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
        </div>
        {manager.strongestPosition && (
          <p className="text-sm text-ivory">
            Strongest position group:{" "}
            <span className="font-medium text-gold-400">{manager.strongestPosition.position}</span>{" "}
            ({fmt(manager.strongestPosition.totalPoints, 1)} total points across their career)
          </p>
        )}
      </section>

      {/* Top scorers */}
      <section className="flex flex-col gap-3">
        <h2 className="font-subheading text-lg tracking-wide text-gold-400">Top Scorers Ever Rostered</h2>
        {manager.topScorers.length === 0 ? (
          <p className="text-sm text-ivory">No lineup data available yet.</p>
        ) : (
          <table className="w-full border-collapse overflow-hidden rounded-lg border border-gold-500/30 bg-charcoal-700 text-sm text-ivory">
            <thead>
              <tr className="border-b border-gold-500/30 bg-charcoal-600 text-left text-ivory/75">
                <th className="px-4 py-3 font-medium">Player</th>
                <th className="px-4 py-3 font-medium">Position</th>
                <th className="px-4 py-3 font-medium">Seasons</th>
                <th className="px-4 py-3 font-medium">Total Points</th>
              </tr>
            </thead>
            <tbody>
              {manager.topScorers.map((p) => (
                <tr key={p.playerId} className="border-b border-charcoal-600 last:border-0">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
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
        <p className="max-w-2xl text-sm text-ivory">
          Regrade (VOE) compares each pick&apos;s actual season points to the
          expected value for that draft round, pooled across this
          league&apos;s own draft history — exact, not curved. Draft Night
          Grade is curved against market ADP (Fantasy Football Calculator)
          and is approximate — see{" "}
          <code className="rounded bg-charcoal-900 px-1 py-0.5 text-gold-300">data_gaps</code>{" "}
          for details.
        </p>
        {manager.bestDraftPicks.length === 0 ? (
          <p className="text-sm text-ivory">No graded draft picks available yet.</p>
        ) : (
          <table className="w-full border-collapse overflow-hidden rounded-lg border border-gold-500/30 bg-charcoal-700 text-sm text-ivory">
            <thead>
              <tr className="border-b border-gold-500/30 bg-charcoal-600 text-left text-ivory/75">
                <th className="px-4 py-3 font-medium">Player</th>
                <th className="px-4 py-3 font-medium">Year</th>
                <th className="px-4 py-3 font-medium">Pick</th>
                <th className="px-4 py-3 font-medium">Season Points</th>
                <th className="px-4 py-3 font-medium">VOE</th>
                <th className="px-4 py-3 font-medium">Regrade</th>
                <th className="px-4 py-3 font-medium">Draft Night Grade</th>
              </tr>
            </thead>
            <tbody>
              {manager.bestDraftPicks.map((p, i) => (
                <tr key={`${p.playerId}-${p.year}-${i}`} className="border-b border-charcoal-600 last:border-0">
                  <td className="px-4 py-3 font-medium">{p.playerName ?? "Unknown"}</td>
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
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gold-500/30 bg-charcoal-700 p-4">
      <div className="text-xs text-ivory/75">{label}</div>
      <div className="text-xl font-semibold tracking-tight text-gold-300">{value}</div>
    </div>
  );
}
