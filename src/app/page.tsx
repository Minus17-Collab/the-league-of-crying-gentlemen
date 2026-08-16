import Link from "next/link";
import { getSeasons, getStandings, getManagerName, getManagers } from "@/lib/data/history";

export default function Home() {
  const seasons = getSeasons();
  const latestSeason = seasons[0];
  const latestStandings = getStandings(latestSeason).slice(0, 3);
  const activeManagerCount = getManagers().filter(
    (m) => m.inferredRetiredAfterSeason === null
  ).length;

  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">
          The League of Crying Gentlemen
        </h1>
        <p className="max-w-2xl text-zinc-600">
          League history, standings, and scoring rules for our ESPN fantasy
          football league. Currently mirroring the {latestSeason} ESPN
          league while this site is built out — see the{" "}
          <Link href="/history" className="underline underline-offset-2">
            History
          </Link>{" "}
          page for {seasons.length} seasons of records.
        </p>
      </section>

      <section className="grid gap-6 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <div className="text-2xl font-semibold">{seasons.length}</div>
          <div className="text-sm text-zinc-500">Seasons of history</div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <div className="text-2xl font-semibold">{activeManagerCount}</div>
          <div className="text-sm text-zinc-500">Active managers</div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <div className="text-2xl font-semibold">{latestSeason}</div>
          <div className="text-sm text-zinc-500">Most recent completed season</div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{latestSeason} top finishers</h2>
          <Link
            href={`/history/${latestSeason}`}
            className="text-sm text-zinc-600 underline underline-offset-2"
          >
            Full standings
          </Link>
        </div>
        <ol className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
          {latestStandings.map((team) => (
            <li
              key={team.teamId}
              className="flex items-center justify-between px-4 py-3 text-sm"
            >
              <div>
                <span className="font-medium">#{team.rankCalculatedFinal}</span>{" "}
                {team.name.trim()}{" "}
                <span className="text-zinc-400">
                  ({getManagerName(team.owners[0])})
                </span>
              </div>
              <div className="text-zinc-500">
                {team.wins}-{team.losses}
                {team.ties ? `-${team.ties}` : ""}
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
