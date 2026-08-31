import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getSeasons,
  getStandings,
  getFormat,
  getPlayoffBracket,
  type PlayoffMatchup,
} from "@/lib/data/league";
import { SortableStandings } from "@/components/SortableStandings";

export async function generateStaticParams() {
  const seasons = await getSeasons();
  return seasons.map((year) => ({ year: String(year) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ year: string }>;
}): Promise<Metadata> {
  const { year } = await params;
  return {
    title: `${year} Season`,
    description: `Full ${year} standings, results, and playoff bracket.`,
  };
}

// The winners bracket is a clean single-elimination tree (no consolation
// games mixed in), so its rounds can be named by position.
function winnersRoundLabel(roundIndex: number, roundCount: number): string {
  if (roundIndex === roundCount - 1) return "Championship";
  if (roundCount - roundIndex === 2) return "Semifinals";
  if (roundCount - roundIndex === 3) return "Quarterfinals";
  return `Round ${roundIndex + 1}`;
}

function groupByWeek(matchups: PlayoffMatchup[]): PlayoffMatchup[][] {
  return Object.values(
    matchups.reduce<Record<number, PlayoffMatchup[]>>((acc, m) => {
      (acc[m.week] ??= []).push(m);
      return acc;
    }, {}),
  ).sort((a, b) => a[0].week - b[0].week);
}

function MatchupCard({ matchup }: { matchup: PlayoffMatchup }) {
  const highScore = Math.max(matchup.home?.score ?? -Infinity, matchup.away?.score ?? -Infinity);
  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border bg-charcoal-700 p-3 text-sm ${
        matchup.isChampionship ? "border-2 border-gold-500" : "border-gold-500/30"
      }`}
    >
      {[matchup.home, matchup.away].map((team, k) =>
        team ? (
          <div
            key={k}
            className={`flex items-center justify-between ${
              matchup.isFinal && team.score !== null && team.score === highScore
                ? "font-semibold text-ivory"
                : "text-ivory/75"
            }`}
          >
            <span>
              {team.seed != null && <span className="text-ivory/60">#{team.seed}</span>}{" "}
              <Link
                href={`/managers/${team.franchiseId}`}
                className="underline underline-offset-2 hover:text-amber"
              >
                {team.managerName}
              </Link>
            </span>
            <span>{team.score != null ? team.score.toFixed(1) : "—"}</span>
          </div>
        ) : (
          <div key={k} className="text-ivory/60">
            Bye
          </div>
        ),
      )}
    </div>
  );
}

export default async function SeasonHistory({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year: yearParam } = await params;
  const year = Number(yearParam);
  const [standings, format, bracket] = await Promise.all([
    getStandings(year),
    getFormat(year),
    getPlayoffBracket(year),
  ]);

  if (standings.length === 0) {
    notFound();
  }

  const winnersRounds = groupByWeek(bracket.winners);
  const consolationRounds = groupByWeek(bracket.consolation);
  const winnersConsolationRounds = groupByWeek(bracket.winnersConsolation);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl tracking-wide text-gold-400">{year} Standings</h1>
        <Link href="/history" className="text-sm text-gold-400 underline underline-offset-2 hover:text-amber">
          All seasons
        </Link>
      </div>

      {format && (
        <p className="text-sm text-ivory">
          {format.teamCount} teams · {format.divisions.map((d) => d.name).join(" / ")} divisions ·{" "}
          {format.matchupPeriodCount} regular season weeks · top {format.playoffTeamCount} made
          playoffs · {format.draftType?.toLowerCase() ?? "unknown"} draft ·{" "}
          {format.keeperCount ?? 0} keepers
        </p>
      )}

      <SortableStandings standings={standings} />

      {winnersRounds.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="font-subheading text-lg text-gold-400">{year} Playoff Bracket</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {winnersRounds.map((round, i) => (
              <div key={round[0].week} className="flex flex-col gap-3">
                <h3 className="text-sm font-medium text-gold-300">
                  {winnersRoundLabel(i, winnersRounds.length)}
                </h3>
                <div className="flex flex-col gap-3">
                  {round.map((matchup, j) => (
                    <MatchupCard key={j} matchup={matchup} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {consolationRounds.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="font-subheading text-lg text-gold-400">{year} Consolation Bracket</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {consolationRounds.map((round) => (
              <div key={round[0].week} className="flex flex-col gap-3">
                {round.map((matchup, j) => (
                  <MatchupCard key={j} matchup={matchup} />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {winnersConsolationRounds.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="font-subheading text-lg text-gold-400">{year} Winners Consolation Ladder</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {winnersConsolationRounds.map((round) => (
              <div key={round[0].week} className="flex flex-col gap-3">
                {round.map((matchup, j) => (
                  <MatchupCard key={j} matchup={matchup} />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
