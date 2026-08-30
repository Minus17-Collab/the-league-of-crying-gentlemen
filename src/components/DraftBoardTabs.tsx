"use client";

import { useState } from "react";
import Link from "next/link";
import type { DraftBoardPick } from "@/lib/data/league";

interface Props {
  picks: DraftBoardPick[];
  years: number[];
}

function fmt(n: number | null, digits = 1): string {
  return n == null ? "—" : n.toFixed(digits);
}

export function DraftBoardTabs({ picks, years }: Props) {
  const [selectedYear, setSelectedYear] = useState(years[0]);
  const yearPicks = picks.filter((p) => p.year === selectedYear);

  const byRound = yearPicks.reduce<Record<number, DraftBoardPick[]>>((acc, p) => {
    (acc[p.round] ??= []).push(p);
    return acc;
  }, {});
  const rounds = Object.keys(byRound)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Draft year">
        {years.map((year) => (
          <button
            key={year}
            role="tab"
            aria-selected={year === selectedYear}
            onClick={() => setSelectedYear(year)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              year === selectedYear
                ? "border-gold-500 bg-gold-100 text-gold-800"
                : "border-gold-500/30 bg-charcoal-700 text-ivory hover:border-gold-500"
            }`}
          >
            {year}
          </button>
        ))}
      </div>

      {rounds.length === 0 ? (
        <p className="text-sm text-ivory/75">No picks recorded for this season.</p>
      ) : (
        <div className="flex flex-col gap-6" role="tabpanel">
          {rounds.map((round) => (
            <section key={round} className="rounded-lg border border-gold-500/30 bg-charcoal-700 p-4">
              <h2 className="mb-3 font-subheading text-lg text-gold-400">Round {round}</h2>
              <table className="w-full border-collapse text-sm text-ivory">
                <thead>
                  <tr className="border-b border-gold-500/30 text-left text-ivory/75">
                    <th scope="col" className="py-2 pr-4 font-medium">Pick</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Manager</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Player</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Season Pts</th>
                    <th scope="col" className="py-2 pr-4 font-medium">VOE</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Regrade</th>
                    <th scope="col" className="py-2 font-medium">Draft Night</th>
                  </tr>
                </thead>
                <tbody>
                  {byRound[round].map((p) => (
                    <tr key={p.overallPick} className="border-b border-charcoal-600 last:border-0">
                      <td className="py-2 pr-4 tabular-nums">{p.overallPick}</td>
                      <td className="py-2 pr-4">
                        <Link
                          href={`/managers/${p.franchiseId}`}
                          className="underline underline-offset-2 hover:text-amber"
                        >
                          {p.managerName}
                        </Link>
                      </td>
                      <td className="py-2 pr-4">
                        {p.playerName ?? "Unknown"}
                        {p.position && (
                          <span className="ml-1 text-ivory/60">
                            {p.position}
                            {p.nflTeam ? ` · ${p.nflTeam}` : ""}
                          </span>
                        )}
                        {p.keeper && <span className="ml-1 text-gold-300">(K)</span>}
                      </td>
                      <td className="py-2 pr-4 tabular-nums">{fmt(p.seasonPoints, 1)}</td>
                      <td className="py-2 pr-4 tabular-nums">
                        {p.voe != null ? `${p.voe > 0 ? "+" : ""}${fmt(p.voe, 1)}` : "—"}
                      </td>
                      <td className="py-2 pr-4 font-medium text-gold-400">{p.regradeGrade ?? "—"}</td>
                      <td className="py-2">{p.draftNightGrade ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
