import Link from "next/link";
import type { Metadata } from "next";
import { ManagerPhoto } from "@/components/ManagerPhoto";
import { TrophyBadge } from "@/components/TrophyBadge";
import { getManagers, getChampions } from "@/lib/data/league";

export const metadata: Metadata = {
  title: "Managers",
  description: "All-time manager roster and career records.",
};

function ManagerBanner({
  manager,
  championshipCount,
}: {
  manager: Awaited<ReturnType<typeof getManagers>>[number];
  championshipCount: number;
}) {
  const photoSlug = manager.name.split(" ")[0].toLowerCase();
  const initials = manager.name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Link
      href={`/managers/${manager.franchiseId}`}
      className="group flex w-full flex-col items-center gap-3 rounded-lg border-2 border-gold-500 bg-burgundy-800 p-5 text-center transition hover:border-gold-300 sm:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)]"
    >
      <ManagerPhoto src={`/manager-photos/${photoSlug}.jpg`} alt={manager.name} initials={initials} />
      <span className="flex items-center gap-2 rounded bg-gradient-to-r from-gold-700 via-gold-500 to-gold-700 px-3 py-1 text-sm font-semibold capitalize text-charcoal-900 shadow group-hover:from-gold-600 group-hover:via-gold-400 group-hover:to-gold-600">
        {manager.name}
        <TrophyBadge count={championshipCount} />
      </span>
      <span className="text-xs text-ivory/75">
        Seasons: {manager.seasonsActive.join(", ")}
      </span>
      {manager.inferredRetiredAfterSeason ? (
        <span className="text-xs text-ivory/60">Left after {manager.inferredRetiredAfterSeason}</span>
      ) : (
        <span className="text-xs font-medium text-gold-400">Active</span>
      )}
    </Link>
  );
}

function ManagerGrid({
  managers,
  championshipCounts,
}: {
  managers: Awaited<ReturnType<typeof getManagers>>;
  championshipCounts: Map<string, number>;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-6">
      {managers.map((manager) => (
        <ManagerBanner
          key={manager.franchiseId}
          manager={manager}
          championshipCount={championshipCounts.get(manager.franchiseId) ?? 0}
        />
      ))}
    </div>
  );
}

export default async function ManagersPage() {
  const [managers, champions] = await Promise.all([getManagers(), getChampions()]);
  const championshipCounts = new Map<string, number>();
  for (const c of champions) {
    championshipCounts.set(c.franchiseId, (championshipCounts.get(c.franchiseId) ?? 0) + 1);
  }

  const active = managers.filter((m) => !m.inferredRetiredAfterSeason);
  const retired = managers.filter((m) => m.inferredRetiredAfterSeason);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl tracking-wide text-gold-400">Managers</h1>
      <p className="max-w-2xl text-sm text-ivory">
        Timeline inferred from ESPN membership per season. A manager who inherits another owner&apos;s
        ESPN team slot is tracked as a separate franchise, not a continuation.
      </p>

      <section className="flex flex-col gap-3">
        <h2 className="font-subheading text-lg text-gold-300">Active</h2>
        <ManagerGrid managers={active} championshipCounts={championshipCounts} />
      </section>

      {retired.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-subheading text-lg text-ivory/75">Retired</h2>
          <ManagerGrid managers={retired} championshipCounts={championshipCounts} />
        </section>
      )}
    </div>
  );
}
