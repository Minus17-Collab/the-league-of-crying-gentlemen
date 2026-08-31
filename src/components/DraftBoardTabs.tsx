"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { DraftBoardPick } from "@/lib/data/league";

interface Props {
  picks: DraftBoardPick[];
  years: number[];
}

function fmt(n: number | null, digits = 1): string {
  return n == null ? "—" : n.toFixed(digits);
}

type DraftView = "round" | "team" | "grade";

function gradeClass(grade: string | null): string {
  if (!grade) return "text-ivory";
  const g = grade[0];
  if (g === "A") return "text-emerald-400";
  if (g === "B") return "text-gold-300";
  if (g === "C") return "text-ivory";
  if (g === "D") return "text-amber";
  if (g === "F") return "text-red-400";
  return "text-ivory";
}

export function DraftBoardTabs({ picks, years }: Props) {
  const [selectedYear, setSelectedYear] = useState(years[0]);
  const [view, setView] = useState<DraftView>("round");
  const yearPicks = picks.filter((p) => p.year === selectedYear);

  const byRound = useMemo(() => {
    const acc: Record<number, DraftBoardPick[]> = {};
    for (const p of yearPicks) {
      (acc[p.round] ??= []).push(p);
    }
    for (const round of Object.keys(acc)) {
      acc[Number(round)].sort((a, b) => a.overallPick - b.overallPick);
    }
    return acc;
  }, [yearPicks]);
  const rounds = Object.keys(byRound)
    .map(Number)
    .sort((a, b) => a - b);

  const byTeam = useMemo(() => {
    const acc: Record<string, DraftBoardPick[]> = {};
    for (const p of yearPicks) {
      (acc[p.franchiseId] ??= []).push(p);
    }
    for (const id of Object.keys(acc)) {
      acc[id].sort((a, b) => a.overallPick - b.overallPick);
    }
    return acc;
  }, [yearPicks]);
  const teamIds = Object.keys(byTeam).sort((a, b) =>
    (byTeam[a][0]?.managerName ?? "").localeCompare(byTeam[b][0]?.managerName ?? ""),
  );

  // Season-wide team grade table: one row per team, sorted by total VOE
  // descending — this is the same VOE/regrade math the by-team drilldown
  // and manager pages already use, just aggregated across a whole class
  // rather than a single pick. Doubles as "best draft class" (see the
  // site upgrade plan's records backlog).
  const teamGrades = useMemo(() => {
    return teamIds
      .map((franchiseId) => {
        const teamPicks = byTeam[franchiseId];
        const withVoe = teamPicks.filter((p) => p.voe != null);
        const totalVoe = withVoe.reduce((sum, p) => sum + (p.voe ?? 0), 0);
        const avgVoe = withVoe.length > 0 ? totalVoe / withVoe.length : null;
        const totalPoints = teamPicks.reduce((sum, p) => sum + (p.seasonPoints ?? 0), 0) || null;
        return {
          franchiseId,
          managerName: teamPicks[0]?.managerName ?? "Unknown",
          picks: teamPicks.length,
          totalVoe,
          avgVoe,
          totalPoints,
        };
      })
      .sort((a, b) => b.totalVoe - a.totalVoe);
  }, [teamIds, byTeam]);

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

      <div className="flex gap-2" role="radiogroup" aria-label="Draft view">
        {(
          [
            ["round", "By Round"],
            ["team", "By Team"],
            ["grade", "Team Grades"],
          ] as [DraftView, string][]
        ).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setView(v)}
            aria-pressed={view === v}
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
              view === v
                ? "border-gold-500 bg-gold-100 text-gold-800"
                : "border-gold-500/30 bg-charcoal-700 text-ivory hover:border-gold-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {yearPicks.length === 0 ? (
        <p className="text-sm text-ivory/75">No picks recorded for this season.</p>
      ) : view === "round" ? (
        <div className="flex flex-col gap-6" role="tabpanel">
          {rounds.map((round) => (
            <section key={round} className="rounded-lg border border-gold-500/30 bg-charcoal-700 p-4">
              <h2 className="mb-3 font-subheading text-lg text-gold-400">Round {round}</h2>
              <PickTable picks={byRound[round]} />
            </section>
          ))}
        </div>
      ) : view === "team" ? (
        <div className="flex flex-col gap-6" role="tabpanel">
          {teamIds.map((franchiseId) => (
            <TeamDraftSection
              key={franchiseId}
              franchiseId={franchiseId}
              managerName={byTeam[franchiseId][0]?.managerName ?? "Unknown"}
              picks={byTeam[franchiseId]}
            />
          ))}
        </div>
      ) : (
        <div role="tabpanel">
          <table className="w-full border-collapse overflow-hidden rounded-lg border border-gold-500/30 bg-charcoal-700 text-sm text-ivory">
            <caption className="sr-only">Season-wide team draft grades, sorted by total VOE</caption>
            <thead>
              <tr className="border-b border-gold-500/30 bg-charcoal-600 text-left text-ivory/75">
                <th scope="col" className="px-4 py-3 font-medium">Manager</th>
                <th scope="col" className="px-4 py-3 font-medium">Picks</th>
                <th scope="col" className="px-4 py-3 font-medium">Avg VOE</th>
                <th scope="col" className="px-4 py-3 font-medium">Total VOE</th>
                <th scope="col" className="px-4 py-3 font-medium">Total Points</th>
              </tr>
            </thead>
            <tbody>
              {teamGrades.map((t, i) => (
                <tr key={t.franchiseId} className="border-b border-charcoal-600 last:border-0">
                  <th scope="row" className="px-4 py-3 text-left font-medium">
                    <Link href={`/managers/${t.franchiseId}`} className="underline underline-offset-2 hover:text-amber">
                      {t.managerName}
                    </Link>
                    {i === 0 && (
                      <span className="ml-2 rounded-full bg-gold-100 px-2 py-0.5 text-xs font-semibold text-gold-800">
                        Best class
                      </span>
                    )}
                  </th>
                  <td className="px-4 py-3 tabular-nums">{t.picks}</td>
                  <td className="px-4 py-3 tabular-nums">{fmt(t.avgVoe, 1)}</td>
                  <td className="px-4 py-3 tabular-nums">{fmt(t.totalVoe, 1)}</td>
                  <td className="px-4 py-3 tabular-nums">{fmt(t.totalPoints, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PickTable({ picks }: { picks: DraftBoardPick[] }) {
  return (
    <div className="-mx-4 max-w-[calc(100%+2rem)] overflow-x-auto px-4">
      <table className="w-full min-w-[36rem] border-collapse text-sm text-ivory">
      <caption className="sr-only">Draft picks</caption>
      <thead>
        <tr className="border-b border-gold-500/30 text-left text-ivory/75">
          <th scope="col" className="py-2 pr-4 font-medium">
            Pick
          </th>
          <th scope="col" className="py-2 pr-4 font-medium">
            Manager
          </th>
          <th scope="col" className="py-2 pr-4 font-medium">
            Player
          </th>
          <th scope="col" className="py-2 pr-4 font-medium">
            Season Pts
          </th>
          <th scope="col" className="py-2 pr-4 font-medium">
            VOE
          </th>
          <th scope="col" className="py-2 pr-4 font-medium">
            Regrade
          </th>
          <th scope="col" className="py-2 font-medium">
            Draft Night
          </th>
        </tr>
      </thead>
      <tbody>
        {picks.map((p) => (
          <tr key={p.overallPick} className="border-b border-charcoal-600 last:border-0">
            <td className="py-2 pr-4 tabular-nums">{p.overallPick}</td>
            <td className="py-2 pr-4">
              <Link href={`/managers/${p.franchiseId}`} className="underline underline-offset-2 hover:text-amber">
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
            <td className={`py-2 pr-4 font-medium ${gradeClass(p.regradeGrade)}`}>{p.regradeGrade ?? "—"}</td>
            <td className={`py-2 font-medium ${gradeClass(p.draftNightGrade)}`}>{p.draftNightGrade ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}

function TeamDraftSection({
  franchiseId,
  managerName,
  picks,
}: {
  franchiseId: string;
  managerName: string;
  picks: DraftBoardPick[];
}) {
  const withVoe = picks.filter((p) => p.voe != null);
  const totalVoe = withVoe.reduce((sum, p) => sum + (p.voe ?? 0), 0);
  const avgVoe = withVoe.length > 0 ? totalVoe / withVoe.length : null;
  const totalPoints = picks.reduce((sum, p) => sum + (p.seasonPoints ?? 0), 0) || null;

  return (
    <section className="rounded-lg border border-gold-500/30 bg-charcoal-700 p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-subheading text-lg text-gold-400">
          <Link href={`/managers/${franchiseId}`} className="hover:text-amber hover:underline">
            {managerName}
          </Link>
        </h2>
        <div className="flex gap-4 text-sm text-ivory/75">
          <span>
            {picks.length} pick{picks.length === 1 ? "" : "s"}
          </span>
          {avgVoe != null && <span className="tabular-nums">Avg VOE: {fmt(avgVoe, 1)}</span>}
          {totalVoe !== 0 && <span className="tabular-nums">Total VOE: {fmt(totalVoe, 1)}</span>}
          {totalPoints != null && <span className="tabular-nums">Total Pts: {fmt(totalPoints, 1)}</span>}
        </div>
      </div>
      <PickTable picks={picks} />
    </section>
  );
}
