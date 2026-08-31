"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { TeamSeasonRecord } from "@/lib/data/league";

type SortKey = "finalRank" | "name" | "managerName" | "record" | "pointsFor" | "pointsAgainst" | "playoffSeed";

interface Props {
  standings: TeamSeasonRecord[];
}

function winPct(w: number, l: number, t: number): number {
  const total = w + l + t;
  if (total === 0) return 0;
  return (w + t * 0.5) / total;
}

export function SortableStandings({ standings }: Props) {
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: "finalRank", asc: true });

  const sorted = useMemo(() => {
    const { key, asc } = sort;
    const next = [...standings];
    next.sort((a, b) => {
      let cmp = 0;
      switch (key) {
        case "finalRank":
          cmp = (a.finalRank ?? Infinity) - (b.finalRank ?? Infinity);
          break;
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "managerName":
          cmp = a.managerName.localeCompare(b.managerName);
          break;
        case "record":
          cmp = winPct(a.wins, a.losses, a.ties) - winPct(b.wins, b.losses, b.ties);
          if (cmp === 0) cmp = a.wins - b.wins;
          break;
        case "pointsFor":
          cmp = a.pointsFor - b.pointsFor;
          break;
        case "pointsAgainst":
          cmp = a.pointsAgainst - b.pointsAgainst;
          break;
        case "playoffSeed":
          cmp = (a.playoffSeed ?? Infinity) - (b.playoffSeed ?? Infinity);
          break;
      }
      return asc ? cmp : -cmp;
    });
    return next;
  }, [standings, sort]);

  function header(key: SortKey, label: string) {
    const active = sort.key === key;
    return (
      <th scope="col" className="px-4 py-3">
        <button
          onClick={() => setSort({ key, asc: active ? !sort.asc : true })}
          className={`flex items-center gap-1 font-medium ${active ? "text-gold-300" : "text-ivory/75"} hover:text-amber`}
          aria-pressed={active}
        >
          {label}
          {active && <span aria-hidden="true">{sort.asc ? "▲" : "▼"}</span>}
        </button>
      </th>
    );
  }

  return (
    <div className="-mx-6 max-w-[calc(100%+3rem)] overflow-x-auto px-6">
      <table className="w-full min-w-[44rem] border-collapse overflow-hidden rounded-lg border border-gold-500/30 bg-charcoal-700 text-sm text-ivory">
      <caption className="sr-only">Season standings</caption>
      <thead>
        <tr className="border-b border-gold-500/30 bg-charcoal-600 text-left">
          {header("finalRank", "Rank")}
          {header("name", "Team")}
          {header("managerName", "Manager")}
          {header("record", "Record")}
          {header("pointsFor", "Points For")}
          {header("pointsAgainst", "Points Against")}
          {header("playoffSeed", "Playoff Seed")}
        </tr>
      </thead>
      <tbody>
        {sorted.map((team) => (
          <tr key={team.teamId} className="border-b border-charcoal-600 last:border-0">
            <th scope="row" className="px-4 py-3 text-left font-medium">
              {team.finalRank === 1 ? (
                <span className="text-gold-400">{team.finalRank}</span>
              ) : (
                team.finalRank
              )}
            </th>
            <td className="px-4 py-3">{team.name.trim()}</td>
            <td className="px-4 py-3">
              <Link
                href={`/managers/${team.franchiseId}`}
                className="text-ivory/75 underline underline-offset-2 hover:text-amber"
              >
                {team.managerName}
              </Link>
            </td>
            <td className="px-4 py-3">
              {team.wins}-{team.losses}
              {team.ties ? `-${team.ties}` : ""}
            </td>
            <td className="px-4 py-3">{team.pointsFor.toFixed(1)}</td>
            <td className="px-4 py-3">{team.pointsAgainst.toFixed(1)}</td>
            <td className="px-4 py-3">{team.playoffSeed}</td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}
