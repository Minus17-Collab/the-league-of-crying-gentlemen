"use client";

import { useState } from "react";
import Link from "next/link";
import type { HeadToHeadRow, HeadToHeadCell } from "@/lib/data/league";

interface Props {
  rows: HeadToHeadRow[];
  disclaimer?: string;
}

function fmt(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function cell(w: number, l: number, t: number): string {
  if (t > 0) return `${w}-${l}-${t}`;
  return `${w}-${l}`;
}

export function HeadToHeadMatrix({ rows, disclaimer }: Props) {
  const [showRetired, setShowRetired] = useState(false);
  const visibleRows = rows.filter((r) => !r.isRetired || showRetired);
  const ids = visibleRows.map((r) => r.franchiseId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {disclaimer && (
          <p className="max-w-2xl text-sm text-ivory/75">{disclaimer}</p>
        )}
        <label className="flex items-center gap-2 text-sm text-ivory">
          <input
            type="checkbox"
            checked={showRetired}
            onChange={(e) => setShowRetired(e.target.checked)}
            className="h-4 w-4 accent-gold-500"
          />
          Show retired managers
        </label>
      </div>

      <div className="relative max-w-full overflow-x-auto rounded-lg border border-gold-500/30 bg-charcoal-700">
        <table className="w-full border-collapse text-sm text-ivory">
          <caption className="sr-only">Head-to-head regular season records between franchises</caption>
          <thead>
            <tr className="border-b border-gold-500/30 bg-charcoal-600 text-left text-ivory/75">
              <th scope="col" className="sticky left-0 z-10 bg-charcoal-600 px-3 py-3 font-medium">
                Manager
              </th>
              {ids.map((id) => (
                <th key={id} scope="col" className="min-w-[6.5rem] px-3 py-3 text-center font-medium">
                  <span className="block max-w-[6.5rem] truncate">
                    {visibleRows.find((r) => r.franchiseId === id)?.managerName}
                  </span>
                </th>
              ))}
              <th scope="col" className="min-w-[6.5rem] px-3 py-3 text-center font-medium">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
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
                  {row.isRetired && <span className="ml-1 text-ivory/50">(retired)</span>}
                </th>
                {ids.map((colId) => {
                  if (row.franchiseId === colId) {
                    return (
                      <td key={colId} className="px-3 py-3 text-center text-ivory/40">
                        —
                      </td>
                    );
                  }
                  const c = row.cells.get(colId) as HeadToHeadCell | undefined;
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
