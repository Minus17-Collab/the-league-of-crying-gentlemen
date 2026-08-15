import { getManagers } from "@/lib/data/history";

export default function ManagersPage() {
  const managers = getManagers();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Managers</h1>
      <p className="max-w-2xl text-sm text-zinc-500">
        Timeline inferred from ESPN membership per season. A manager who
        inherits another owner&apos;s ESPN team slot is tracked as a
        separate franchise, not a continuation.
      </p>
      <table className="w-full border-collapse overflow-hidden rounded-lg border border-zinc-200 bg-white text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-zinc-500">
            <th className="px-4 py-3 font-medium">Manager</th>
            <th className="px-4 py-3 font-medium">Seasons Active</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {managers.map((manager) => (
            <tr key={manager.espnOwnerId} className="border-b border-zinc-100 last:border-0">
              <td className="px-4 py-3 font-medium capitalize">{manager.name}</td>
              <td className="px-4 py-3 text-zinc-500">
                {manager.seasonsActive.join(", ")}
              </td>
              <td className="px-4 py-3">
                {manager.inferredRetiredAfterSeason ? (
                  <span className="text-zinc-400">
                    Left after {manager.inferredRetiredAfterSeason}
                  </span>
                ) : (
                  <span className="text-green-700">Active</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
