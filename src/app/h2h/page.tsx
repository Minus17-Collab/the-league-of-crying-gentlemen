import type { Metadata } from "next";
import { getHeadToHead } from "@/lib/data/league";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Head-to-Head",
  description: "Franchise win/loss records against every other franchise.",
};

function fmt(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function cell(w: number, l: number, t: number): string {
  if (t > 0) return `${w}-${l}-${t}`;
  return `${w}-${l}`;
}

export default async function HeadToHeadPage() {
  const rows = await getHeadToHead();

  if (rows.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-heading text-2xl tracking-wide text-gold-400">Head-to-Head</h1>
        <p className="text-sm text-ivory/75">No regular season matchups recorded yet.</p>
      </div>
    );
  }

  const ids = rows.map((r) => r.franchiseId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl tracking-wide text-gold-400">Head-to-Head</h1>
        <p className="mt-2 max-w-2xl text-sm text-ivory">
          Regular season matchups across all seasons. Each cell shows the win/loss/tie record of the
          row manager against the column manager. A franchise that inherits an old ESPN slot is
          tracked separately from its predecessor.
        </p>
      </div>

      <div className="relative max-w-full overflow-x-auto rounded-lg border border-gold-500/30 bg-charcoal-700">
        <table className="w-full border-collapse text-sm text-ivory">
          <caption className="sr-only">
            Head-to-head regular season records between every franchise
          </caption>
          <thead>
            <tr className="border-b border-gold-500/30 bg-charcoal-600 text-left text-ivory/75">
              <th scope="col" className="sticky left-0 z-10 bg-charcoal-600 px-3 py-3 font-medium">
                Manager
              </th>
              {ids.map((id) => (
                <th key={id} scope="col" className="min-w-[6.5rem] px-3 py-3 text-center font-medium">
                  <span className="block max-w-[6.5rem] truncate">
                    {rows.find((r) => r.franchiseId === id)?.managerName}
                  </span>
                </th>
              ))}
              <th scope="col" className="min-w-[6.5rem] px-3 py-3 text-center font-medium">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.franchiseId} className="border-b border-charcoal-600 last:border-0">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-charcoal-700 px-3 py-3 text-left font-normal"
                >
                  <Link
                    href={`/managers/${row.franchiseId}`}
                    className="font-medium underline underline-offset-2 hover:text-amber"
                  >
                    {row.managerName}
                  </Link>
                </th>
                {ids.map((colId) => {
                  if (row.franchiseId === colId) {
                    return (
                      <td key={colId} className="px-3 py-3 text-center text-ivory/40">
                        —
                      </td>
                    );
                  }
                  const c = row.cells.get(colId);
                  return (
                    <td
                      key={colId}
                      className="px-3 py-3 text-center tabular-nums"
                      title={`${fmt(c?.pointsFor ?? 0)}-${fmt(c?.pointsAgainst ?? 0)} points`}
                    >
                      {cell(c?.wins ?? 0, c?.losses ?? 0, c?.ties ?? 0)}
                    </td>
                  );
                })}
                <td
                  className="px-3 py-3 text-center font-medium tabular-nums"
                  title={`${fmt(row.pointsFor)}-${fmt(row.pointsAgainst)} points`}
                >
                  {cell(row.totalWins, row.totalLosses, row.totalTies)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
