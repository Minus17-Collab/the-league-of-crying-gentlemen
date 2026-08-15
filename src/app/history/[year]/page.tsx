import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getSeasons,
  getStandings,
  getFormat,
  getManagerName,
} from "@/lib/data/history";

export function generateStaticParams() {
  return getSeasons().map((year) => ({ year }));
}

export default async function SeasonHistory({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year } = await params;
  const standings = getStandings(year);
  const format = getFormat(year);

  if (standings.length === 0) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{year} Standings</h1>
        <Link href="/history" className="text-sm text-zinc-600 underline underline-offset-2">
          All seasons
        </Link>
      </div>

      {format && (
        <p className="text-sm text-zinc-500">
          {format.teamCount} teams · {format.divisions.map((d) => d.name).join(" / ")} divisions ·{" "}
          {format.matchupPeriodCount} regular season weeks · top {format.playoffTeamCount} made
          playoffs · {format.draftType.toLowerCase()} draft · {format.keeperCount} keepers
        </p>
      )}

      <table className="w-full border-collapse overflow-hidden rounded-lg border border-zinc-200 bg-white text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-zinc-500">
            <th className="px-4 py-3 font-medium">Rank</th>
            <th className="px-4 py-3 font-medium">Team</th>
            <th className="px-4 py-3 font-medium">Manager</th>
            <th className="px-4 py-3 font-medium">Record</th>
            <th className="px-4 py-3 font-medium">Points For</th>
            <th className="px-4 py-3 font-medium">Points Against</th>
            <th className="px-4 py-3 font-medium">Playoff Seed</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((team) => (
            <tr key={team.teamId} className="border-b border-zinc-100 last:border-0">
              <td className="px-4 py-3 font-medium">{team.rankCalculatedFinal}</td>
              <td className="px-4 py-3">{team.name.trim()}</td>
              <td className="px-4 py-3 text-zinc-500">{getManagerName(team.owners[0])}</td>
              <td className="px-4 py-3">
                {team.wins}-{team.losses}
                {team.ties ? `-${team.ties}` : ""}
              </td>
              <td className="px-4 py-3">{team.pointsFor.toFixed(1)}</td>
              <td className="px-4 py-3">{team.pointsAgainst.toFixed(1)}</td>
              <td className="px-4 py-3">{team.playoffSeed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
