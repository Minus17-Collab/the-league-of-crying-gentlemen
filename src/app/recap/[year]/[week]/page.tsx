import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSeasonWeeks, getWeekRecap } from "@/lib/data/league";
import { formatRecordValue } from "@/lib/records/format";

export async function generateStaticParams() {
  const years = [2024, 2025, 2026];
  const all: { year: string; week: string }[] = [];
  for (const year of years) {
    const weeks = await getSeasonWeeks(year);
    for (const week of weeks) {
      all.push({ year: String(year), week: String(week) });
    }
  }
  return all;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ year: string; week: string }>;
}): Promise<Metadata> {
  const { year, week } = await params;
  return {
    title: `Week ${week}, ${year} Recap`,
    description: `Weekly recap for the ${year} season, week ${week}.`,
  };
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-gold-500/30 bg-charcoal-700 p-5">
      <h3 className="text-xs uppercase tracking-wide text-ivory/60">{label}</h3>
      <div className="mt-2 font-heading text-2xl text-gold-400">{value}</div>
      {sub && <p className="mt-1 text-sm text-ivory/70">{sub}</p>}
    </div>
  );
}

export default async function WeekRecapPage({
  params,
}: {
  params: Promise<{ year: string; week: string }>;
}) {
  const { year: yearParam, week: weekParam } = await params;
  const year = Number(yearParam);
  const week = Number(weekParam);

  const weeks = await getSeasonWeeks(year);
  if (!weeks.includes(week)) {
    notFound();
  }

  const recap = await getWeekRecap(year, week);
  if (recap.matchups.length === 0) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-heading text-2xl tracking-wide text-gold-400">
        Week {week}, {year} Recap
      </h1>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {recap.highestScorer && (
          <StatCard
            label="Highest Scorer"
            value={formatRecordValue("points", recap.highestScorer.score)}
            sub={recap.highestScorer.team}
          />
        )}
        {recap.biggestBlowout && (
          <StatCard
            label="Biggest Blowout"
            value={`${formatRecordValue("points", recap.biggestBlowout.margin)} pts`}
            sub={`${recap.biggestBlowout.winner} won`}
          />
        )}
        {recap.closestGame && (
          <StatCard
            label="Closest Game"
            value={`${formatRecordValue("points", recap.closestGame.margin)} pts`}
            sub={`${recap.closestGame.winner} won`}
          />
        )}
        {recap.unluckiestLoss && (
          <StatCard
            label="Unluckiest Loss"
            value={formatRecordValue("points", recap.unluckiestLoss.score)}
            sub={`${recap.unluckiestLoss.team} lost to ${recap.unluckiestLoss.opponent} (${formatRecordValue("points", 
              recap.unluckiestLoss.opponentScore,
            )})`}
          />
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-subheading text-lg tracking-wide text-gold-400">Matchups</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {recap.matchups.map((m, i) => (
            <div
              key={i}
              className="rounded-lg border border-gold-500/30 bg-charcoal-700 p-5"
            >
              <div className="flex items-center justify-between gap-4">
                <div className={m.homeScore > m.awayScore ? "text-gold-400" : "text-ivory/70"}>
                  <div className="font-subheading">{m.homeTeam}</div>
                  <div className="text-2xl font-medium tabular-nums">{formatRecordValue("points", m.homeScore)}</div>
                </div>
                <div className="text-xs uppercase text-ivory/40">{m.isPlayoff ? "Playoff" : "Regular"}</div>
                <div className={m.awayScore > m.homeScore ? "text-right text-gold-400" : "text-right text-ivory/70"}>
                  <div className="font-subheading">{m.awayTeam}</div>
                  <div className="text-2xl font-medium tabular-nums">{formatRecordValue("points", m.awayScore)}</div>
                </div>
              </div>
              <div className="mt-2 text-center text-sm text-ivory/60">
                {m.homeScore === m.awayScore
                  ? "Tied"
                  : `${m.winner} by ${formatRecordValue("points", m.margin)}`}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
