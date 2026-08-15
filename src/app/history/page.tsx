import Link from "next/link";
import { getSeasons, getFormat, getStandings, getManagerName } from "@/lib/data/history";

export default function HistoryIndex() {
  const seasons = getSeasons();

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">League History</h1>
      <div className="flex flex-col gap-6">
        {seasons.map((season) => {
          const format = getFormat(season);
          const champion = getStandings(season).find(
            (t) => t.rankCalculatedFinal === 1
          );
          return (
            <Link
              key={season}
              href={`/history/${season}`}
              className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-5 hover:border-zinc-400"
            >
              <div>
                <div className="text-lg font-semibold">{season} Season</div>
                <div className="text-sm text-zinc-500">
                  {format?.teamCount} teams · {format?.playoffTeamCount} playoff spots ·{" "}
                  {format?.draftType} draft
                </div>
              </div>
              {champion && (
                <div className="text-right text-sm">
                  <div className="text-zinc-400">Champion</div>
                  <div className="font-medium">{champion.name.trim()}</div>
                  <div className="text-zinc-400">
                    {getManagerName(champion.owners[0])}
                  </div>
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
