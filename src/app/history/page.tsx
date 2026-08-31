import Link from "next/link";
import type { Metadata } from "next";
import { getSeasons, getFormat, getStandings } from "@/lib/data/league";

export const metadata: Metadata = {
  title: "Season History",
  description: "Final standings and results for every season.",
};

export default async function HistoryIndex() {
  const seasons = await getSeasons();
  const seasonDetails = await Promise.all(
    seasons.map(async (season) => {
      const [format, standings] = await Promise.all([
        getFormat(season),
        getStandings(season),
      ]);
      const champion = standings.find((t) => t.finalRank === 1);
      return { season, format, champion };
    })
  );

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-heading text-2xl tracking-wide text-gold-400">League History</h1>
      <div className="flex flex-col gap-6">
        {seasonDetails.map(({ season, format, champion }) => (
          <Link
            key={season}
            href={`/history/${season}`}
            className="flex items-center justify-between rounded-lg border border-gold-500/30 bg-charcoal-700 p-5 text-ivory hover:border-gold-500"
          >
            <div>
              <div className="text-lg font-semibold">{season} Season</div>
              <div className="text-sm text-ivory/75">
                {format?.teamCount} teams · {format?.playoffTeamCount} playoff spots ·{" "}
                {format?.draftType} draft
              </div>
            </div>
            {champion && (
              <div className="text-right text-sm">
                <div className="font-script text-lg text-amber">Champion</div>
                <div className="font-medium">{champion.name.trim()}</div>
                <div className="text-ivory/60">{champion.managerName}</div>
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
