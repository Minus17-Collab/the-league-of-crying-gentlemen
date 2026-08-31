import Link from "next/link";
import type { Metadata } from "next";
import { ManagerPhoto } from "@/components/ManagerPhoto";
import { TrophyBadge } from "@/components/TrophyBadge";
import { getManagers, getChampions } from "@/lib/data/league";

export const metadata: Metadata = {
  title: "Managers",
  description: "All-time manager roster and career records.",
};

function ManagerRow({
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
    <tr className="border-b border-charcoal-600 last:border-0">
      <th scope="row" className="px-4 py-3 text-left font-medium capitalize">
        <Link
          href={`/managers/${manager.franchiseId}`}
          className="flex items-center gap-3 text-ivory underline underline-offset-2 hover:text-amber"
        >
          <ManagerPhoto src={`/manager-photos/${photoSlug}.jpg`} alt={manager.name} initials={initials} />
          <span>{manager.name}</span>
          <TrophyBadge count={championshipCount} />
        </Link>
      </th>
      <td className="px-4 py-3 text-ivory/75">{manager.seasonsActive.join(", ")}</td>
      <td className="px-4 py-3">
        {manager.inferredRetiredAfterSeason ? (
          <span className="text-ivory/60">Left after {manager.inferredRetiredAfterSeason}</span>
        ) : (
          <span className="font-medium text-gold-400">Active</span>
        )}
      </td>
    </tr>
  );
}

function ManagerTable({
  managers,
  championshipCounts,
}: {
  managers: Awaited<ReturnType<typeof getManagers>>;
  championshipCounts: Map<string, number>;
}) {
  return (
    <table className="w-full border-collapse overflow-hidden rounded-lg border border-gold-500/30 bg-charcoal-700 text-sm text-ivory">
      <caption className="sr-only">Managers</caption>
      <thead>
        <tr className="border-b border-gold-500/30 bg-charcoal-600 text-left text-ivory/75">
          <th scope="col" className="px-4 py-3 font-medium">Manager</th>
          <th scope="col" className="px-4 py-3 font-medium">Seasons Active</th>
          <th scope="col" className="px-4 py-3 font-medium">Status</th>
        </tr>
      </thead>
      <tbody>
        {managers.map((manager) => (
          <ManagerRow
            key={manager.franchiseId}
            manager={manager}
            championshipCount={championshipCounts.get(manager.franchiseId) ?? 0}
          />
        ))}
      </tbody>
    </table>
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
        <ManagerTable managers={active} championshipCounts={championshipCounts} />
      </section>

      {retired.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-subheading text-lg text-ivory/75">Retired</h2>
          <ManagerTable managers={retired} championshipCounts={championshipCounts} />
        </section>
      )}
    </div>
  );
}
