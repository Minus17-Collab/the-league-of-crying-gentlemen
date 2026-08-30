import type { Metadata } from "next";
import { getDraftBoard } from "@/lib/data/league";
import { DraftBoardTabs } from "@/components/DraftBoardTabs";

export const metadata: Metadata = {
  title: "Draft History",
  description: "Every pick, every regrade, every draft night grade.",
};

export default async function DraftPage() {
  const picks = await getDraftBoard();
  const years = [...new Set(picks.map((p) => p.year))].sort((a, b) => b - a);

  if (years.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-heading text-2xl tracking-wide text-gold-400">Draft History</h1>
        <p className="text-sm text-ivory/75">No draft data has been recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl tracking-wide text-gold-400">Draft History</h1>
        <p className="mt-2 max-w-2xl text-sm text-ivory">
          Value over expected (VOE) regrade and market-ADP draft-night grades. Picks with no
          player name were either keeper picks or have not yet been resolved to a player record.
        </p>
      </div>
      <DraftBoardTabs picks={picks} years={years} />
      <div className="rounded-lg border border-dashed border-gold-500/20 bg-charcoal-800/50 p-4">
        <p className="text-sm text-ivory/60">
          <strong className="text-gold-300">Regrade</strong> compares a pick&apos;s actual season
          points to the expected value for that round, pooled from this league&apos;s own draft
          history. <strong className="text-gold-300">Draft Night Grade</strong> is curved against
          market ADP at the time of the draft and is approximate. See the manager pages for
          per-franchise best picks.
        </p>
      </div>
    </div>
  );
}
