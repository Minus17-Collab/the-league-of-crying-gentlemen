import Link from "next/link";
import type { SeasonChampion } from "@/lib/data/league";

/**
 * One banner per championship season, oldest to newest -- the visual
 * language of retired jerseys/division banners in an arena (site
 * upgrade plan Phase 1.2). Entirely data-driven: adding a season with
 * a new champion adds a banner automatically, no template edits.
 */
export function ChampionshipBanners({ champions }: { champions: SeasonChampion[] }) {
  const oldestFirst = [...champions].sort((a, b) => a.year - b.year);

  return (
    <div className="flex flex-wrap justify-center gap-3">
      {oldestFirst.map((champion) => (
        <Link
          key={champion.year}
          href={`/managers/${champion.franchiseId}`}
          className="group flex w-28 flex-col items-center gap-1 rounded-t-md border-x border-t-4 border-gold-500 bg-gradient-to-b from-burgundy-800 to-burgundy-900 px-3 py-4 text-center shadow-md transition hover:border-amber hover:from-burgundy-700"
        >
          <span className="font-heading text-lg tracking-wide text-gold-300">{champion.year}</span>
          <span className="text-xs font-medium capitalize text-ivory group-hover:text-amber">
            {champion.teamName.trim()}
          </span>
          <span className="text-[0.65rem] text-ivory/60">{champion.managerName}</span>
        </Link>
      ))}
    </div>
  );
}
