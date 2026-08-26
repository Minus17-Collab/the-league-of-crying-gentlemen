import Link from "next/link";
import { getManagers } from "@/lib/data/league";

export default async function ManagersPage() {
  const managers = await getManagers();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl tracking-wide text-gold-400">Managers</h1>
      <p className="max-w-2xl text-sm text-ivory">
        Timeline inferred from ESPN membership per season. A manager who
        inherits another owner&apos;s ESPN team slot is tracked as a
        separate franchise, not a continuation.
      </p>
      <table className="w-full border-collapse overflow-hidden rounded-lg border border-gold-500/30 bg-charcoal-700 text-sm text-ivory">
        <thead>
          <tr className="border-b border-gold-500/30 bg-charcoal-600 text-left text-ivory/75">
            <th className="px-4 py-3 font-medium">Manager</th>
            <th className="px-4 py-3 font-medium">Seasons Active</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {managers.map((manager) => (
            <tr key={manager.franchiseId} className="border-b border-charcoal-600 last:border-0">
              <td className="px-4 py-3 font-medium capitalize">
                <Link
                  href={`/managers/${manager.franchiseId}`}
                  className="text-ivory underline underline-offset-2 hover:text-amber"
                >
                  {manager.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-ivory/75">
                {manager.seasonsActive.join(", ")}
              </td>
              <td className="px-4 py-3">
                {manager.inferredRetiredAfterSeason ? (
                  <span className="text-ivory/60">
                    Left after {manager.inferredRetiredAfterSeason}
                  </span>
                ) : (
                  <span className="font-medium text-gold-400">Active</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
