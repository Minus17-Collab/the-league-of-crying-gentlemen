import Image from "next/image";
import Link from "next/link";
import { getSeasons, getStandings, getManagers, getChampions } from "@/lib/data/league";
import { ManagerPhoto } from "@/components/ManagerPhoto";
import { ChampionshipBanners } from "@/components/ChampionshipBanners";
import { TrophyBadge } from "@/components/TrophyBadge";
import { LaurelWreath } from "@/components/LaurelWreath";

function photoSlug(name: string): string {
  return name.trim().split(/\s+/)[0].toLowerCase();
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function Home() {
  const seasons = await getSeasons();
  const latestSeason = seasons[0];
  const [standings, managers, champions] = await Promise.all([
    getStandings(latestSeason),
    getManagers(),
    getChampions(),
  ]);
  const latestStandings = standings.slice(0, 3);
  const activeManagers = managers.filter(
    (m) => m.inferredRetiredAfterSeason === null
  );
  const reigningChampion = champions[0];
  const reigningChampionManager = reigningChampion
    ? activeManagers.find((m) => m.franchiseId === reigningChampion.franchiseId)
    : undefined;
  const otherManagers = reigningChampionManager
    ? activeManagers.filter((m) => m.franchiseId !== reigningChampionManager.franchiseId)
    : activeManagers;

  const championshipCounts = new Map<string, number>();
  for (const c of champions) {
    championshipCounts.set(c.franchiseId, (championshipCounts.get(c.franchiseId) ?? 0) + 1);
  }

  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col items-center gap-3 text-center">
        <h1 className="sr-only">The League of Crying Gentlemen</h1>
        <Image
          src="/league-logo.png"
          alt="The League of Crying Gentlemen logo"
          width={416}
          height={416}
          className="h-auto w-[280px] sm:w-[333px]"
          priority
        />
      </section>

      {reigningChampion && reigningChampionManager && (
        <section className="flex flex-col items-center gap-4 rounded-lg border-2 border-gold-300 bg-gradient-to-b from-gold-500/25 via-gold-500/5 to-transparent px-6 py-10">
          <span className="font-heading text-sm tracking-[0.3em] text-gold-300">
            {reigningChampion.year} CHAMPION
          </span>
          <Link
            href={`/managers/${reigningChampionManager.franchiseId}`}
            className="group flex flex-col items-center gap-4"
          >
            <div className="relative">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-t from-burgundy-950/70 via-transparent to-transparent mix-blend-multiply"
              />
              <LaurelWreath className="absolute -inset-5 h-40 w-40" />
              <ManagerPhoto
                src={`/manager-photos/${photoSlug(reigningChampionManager.name)}.jpg`}
                alt={reigningChampionManager.name}
                initials={initials(reigningChampionManager.name)}
              />
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="font-heading text-2xl tracking-wide capitalize text-gold-200">
                {reigningChampion.teamName.trim()}
              </span>
              <span className="rounded bg-gradient-to-r from-gold-700 via-gold-500 to-gold-700 px-4 py-1 text-center text-sm font-semibold capitalize text-charcoal-900 shadow group-hover:from-gold-600 group-hover:via-gold-400 group-hover:to-gold-600">
                {reigningChampionManager.name}
              </span>
            </div>
          </Link>
        </section>
      )}

      {champions.length > 0 && (
        <section className="flex flex-col items-center gap-4">
          <h2 className="font-subheading text-sm uppercase tracking-widest text-ivory/50">
            Championship Banners
          </h2>
          <ChampionshipBanners champions={champions} />
        </section>
      )}

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-subheading text-lg text-gold-400">Managers</h2>
          <Link
            href="/managers"
            className="text-sm text-gold-400 underline underline-offset-2 hover:text-amber"
          >
            All managers
          </Link>
        </div>
        <div className="flex flex-wrap justify-center gap-6">
          {otherManagers.map((manager) => (
            <Link
              key={manager.franchiseId}
              href={`/managers/${manager.franchiseId}`}
              className="group flex w-full flex-col items-center gap-3 rounded-lg border-2 border-gold-500 bg-burgundy-800 p-5 transition hover:border-gold-300 sm:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)]"
            >
              <ManagerPhoto
                src={`/manager-photos/${photoSlug(manager.name)}.jpg`}
                alt={manager.name}
                initials={initials(manager.name)}
              />
              <span className="flex items-center gap-2 rounded bg-gradient-to-r from-gold-700 via-gold-500 to-gold-700 px-3 py-1 text-center text-sm font-semibold capitalize text-charcoal-900 shadow group-hover:from-gold-600 group-hover:via-gold-400 group-hover:to-gold-600">
                {manager.name}
              </span>
              <TrophyBadge count={championshipCounts.get(manager.franchiseId) ?? 0} />
            </Link>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-subheading text-lg text-gold-400">{latestSeason} top finishers</h2>
          <Link
            href={`/history/${latestSeason}`}
            className="text-sm text-gold-400 underline underline-offset-2 hover:text-amber"
          >
            Full standings
          </Link>
        </div>
        <ol className="flex flex-col divide-y divide-gold-500/20 rounded-lg border border-gold-500/30 bg-charcoal-700">
          {latestStandings.map((team) => (
            <li
              key={team.teamId}
              className="flex items-center justify-between px-4 py-3 text-sm text-ivory"
            >
              <div>
                <span className="font-medium">#{team.finalRank}</span>{" "}
                {team.name.trim()}{" "}
                <span className="text-ivory/60">
                  (
                  <Link
                    href={`/managers/${team.franchiseId}`}
                    className="underline underline-offset-2 hover:text-amber"
                  >
                    {team.managerName}
                  </Link>
                  )
                </span>
              </div>
              <div className="text-ivory/75">
                {team.wins}-{team.losses}
                {team.ties ? `-${team.ties}` : ""}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-subheading text-lg text-gold-400">Previous Champions</h2>
        <ol className="flex flex-col divide-y divide-gold-500/20 rounded-lg border border-gold-500/30 bg-charcoal-700">
          {champions.map((champion) => (
            <li
              key={champion.year}
              className="flex items-center justify-between px-4 py-3 text-sm text-ivory"
            >
              <div>
                <span className="font-medium">{champion.year}</span>{" "}
                {champion.teamName.trim()}
              </div>
              <Link
                href={`/managers/${champion.franchiseId}`}
                className="flex items-center gap-2 text-ivory/75 underline underline-offset-2 hover:text-amber"
              >
                {champion.managerName}
                <TrophyBadge count={championshipCounts.get(champion.franchiseId) ?? 0} />
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col items-center gap-2 rounded-lg border border-gold-500/20 bg-charcoal-700/50 p-6 text-center">
        <h2 className="font-subheading text-sm uppercase tracking-widest text-ivory/50">
          About this league
        </h2>
        <p className="max-w-2xl text-sm text-ivory/80">
          Welcome to The League of Crying Gentlemen! Where we are all friends
          who bitch and cry about each other cheating while staying friends
          and realizing we only want to win a trophy! This is the historical
          site for all of our mediocrity and record keeping.
        </p>
      </section>
    </div>
  );
}
