import Link from "next/link";
import type { RecordHolderDisplay } from "@/lib/data/records";
import { formatContextNumber } from "@/lib/records/format";

/**
 * One record's presentation, shared by /records and /records/[year].
 * Deliberately designed around N holders, not one -- ties are never
 * broken (see AGENTS.md / the site upgrade plan's "constraints to
 * preserve"), so `holders` always renders every co-holder, and the
 * component must look correct whether there's 1 holder or 5 (e.g. the
 * Longest Losing Streak record).
 */

function contextLabel(context: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof context.seasonYear === "number") parts.push(`${context.seasonYear}`);
  if (typeof context.week === "number") parts.push(`Wk ${context.week}`);
  if (typeof context.opponentManagerName === "string") parts.push(`vs ${context.opponentManagerName}`);
  if (typeof context.startSeasonYear === "number" && typeof context.endSeasonYear === "number") {
    const cross = context.crossSeason === true;
    parts.push(
      cross
        ? `${context.startSeasonYear} wk${context.startWeek} \u2192 ${context.endSeasonYear} wk${context.endWeek} (cross-season)`
        : `${context.startSeasonYear}, wk ${context.startWeek}\u2013${context.endWeek}`,
    );
  }
  if (typeof context.actualWins === "number" && typeof context.wouldBeWins === "number") {
    parts.push(
      `won ${context.actualWins} real games, scores deserved about ${formatContextNumber(context.wouldBeWins as number, 1)}`,
    );
  }
  return parts.join(" \u00b7 ");
}

export function HoldersList({ holders }: { holders: RecordHolderDisplay[] }) {
  if (holders.length === 0) {
    return <p className="text-sm text-ivory/60">Not yet computed.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {holders.map((holder, i) => {
        const context = contextLabel(holder.context);
        return (
          <Link
            key={`${holder.franchiseId}-${i}`}
            href={`/managers/${holder.franchiseId}`}
            className="flex items-center justify-between gap-3 rounded-md border border-gold-500/40 bg-gold-500/10 px-3 py-2 transition-colors hover:border-amber hover:bg-gold-500/20"
          >
            <span className="flex items-center gap-2">
              <span aria-hidden="true">🏆</span>
              <span className="text-base font-semibold text-amber">{holder.managerName}</span>
            </span>
            {context && <span className="text-right text-xs text-ivory/70">{context}</span>}
          </Link>
        );
      })}
    </div>
  );
}

export function RecordCard({
  title,
  scope,
  value,
  description,
  holders,
}: {
  title: string;
  /** Eyebrow, e.g. "Regular season" / "Playoffs" -- rendered above the
   * title rather than appended to it, per the site upgrade plan's
   * Phase 2.3 ("scope note belongs on the eyebrow, not the label"). */
  scope?: string;
  value: string;
  description?: string | null;
  holders: RecordHolderDisplay[];
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gold-500/30 bg-charcoal-700 p-5">
      <div className="flex flex-col gap-1">
        {scope && (
          <span className="text-[0.65rem] font-semibold uppercase tracking-widest text-ivory/50">
            {scope}
          </span>
        )}
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-subheading text-base text-gold-400">{title}</h3>
          <span className="text-xl font-semibold tabular-nums text-gold-300">{value}</span>
        </div>
      </div>
      {description && <p className="text-xs text-ivory/60">{description}</p>}
      <HoldersList holders={holders} />
    </div>
  );
}
