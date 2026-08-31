import Link from "next/link";
import type { Metadata } from "next";
import { getFoundingSeason } from "@/lib/data/league";

export const metadata: Metadata = {
  title: "2023 Founding Season",
  description: "The league's first season — eight teams, six playoff spots, and different rules.",
};

function fmt(n: number | null, digits = 1): string {
  return n == null ? "—" : n.toFixed(digits);
}

export default async function FoundingSeasonPage() {
  const season = await getFoundingSeason();
  if (!season) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-heading text-2xl tracking-wide text-gold-400">2023 Founding Season</h1>
        <p className="text-sm text-ivory/75">2023 data is not available yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl tracking-wide text-gold-400">2023 Founding Season</h1>
        <Link href="/history" className="text-sm text-gold-400 underline underline-offset-2 hover:text-amber">
          All seasons
        </Link>
      </div>

      <div className="rounded-lg border-2 border-amber/40 bg-charcoal-700 p-5">
        <h2 className="font-subheading text-lg text-amber">A different league, briefly</h2>
        <p className="mt-2 text-sm text-ivory">{season.note}</p>
        <p className="mt-2 text-sm text-ivory/75">
          Because of those differences, 2023 is intentionally excluded from all-time records and
          cross-season comparisons. It is preserved here as the founding chapter.
        </p>
      </div>

      {season.format && (
        <p className="text-sm text-ivory">
          {season.format.teamCount} teams · {season.format.matchupPeriodCount} regular season weeks ·{" "}
          top {season.format.playoffTeamCount} made playoffs ·{" "}
          {season.format.draftType?.toLowerCase() ?? "unknown"} draft · {season.format.keeperCount ?? 0} keepers
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-subheading text-lg text-gold-400">Final Standings</h2>
        <table className="w-full border-collapse overflow-hidden rounded-lg border border-gold-500/30 bg-charcoal-700 text-sm text-ivory">
          <caption className="sr-only">Final standings</caption>
          <thead>
            <tr className="border-b border-gold-500/30 bg-charcoal-600 text-left text-ivory/75">
              <th scope="col" className="px-4 py-3 font-medium">Rank</th>
              <th scope="col" className="px-4 py-3 font-medium">Team</th>
              <th scope="col" className="px-4 py-3 font-medium">Manager</th>
              <th scope="col" className="px-4 py-3 font-medium">Record</th>
              <th scope="col" className="px-4 py-3 font-medium">Points For</th>
              <th scope="col" className="px-4 py-3 font-medium">Points Against</th>
              <th scope="col" className="px-4 py-3 font-medium">Playoff Seed</th>
            </tr>
          </thead>
          <tbody>
            {season.standings.map((team) => (
              <tr key={team.teamId} className="border-b border-charcoal-600 last:border-0">
                <td className="px-4 py-3 font-medium">
                  {team.finalRank === 1 ? (
                    <span className="text-gold-400">{team.finalRank}</span>
                  ) : (
                    team.finalRank
                  )}
                </td>
                <td className="px-4 py-3">{team.name.trim()}</td>
                <td className="px-4 py-3 text-ivory/75">{team.managerName}</td>
                <td className="px-4 py-3">
                  {team.wins}-{team.losses}
                  {team.ties ? `-${team.ties}` : ""}
                </td>
                <td className="px-4 py-3">{fmt(team.pointsFor, 1)}</td>
                <td className="px-4 py-3">{fmt(team.pointsAgainst, 1)}</td>
                <td className="px-4 py-3">{team.playoffSeed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {season.champion && (
        <div className="rounded-lg border-2 border-gold-500 bg-charcoal-700 p-6 text-center">
          <span className="text-xs tracking-widest text-gold-300">2023 CHAMPION</span>
          <div className="mt-1 font-heading text-2xl text-ivory">{season.champion.managerName}</div>
          <div className="text-sm text-ivory/75">{season.champion.name.trim()}</div>
        </div>
      )}
    </div>
  );
}
