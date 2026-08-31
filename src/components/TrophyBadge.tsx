/**
 * Small championship-count badge for anywhere a manager appears in a
 * list. Renders nothing for zero championships -- absence is the
 * point (see the site upgrade plan's Phase 1.3).
 */
export function TrophyBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  const label = `${count} championship${count === 1 ? "" : "s"}`;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-gold-500/20 px-2 py-0.5 text-xs font-semibold tabular-nums text-gold-300"
      aria-label={label}
      title={label}
    >
      <span aria-hidden="true">🏆</span>
      <span aria-hidden="true">{count}</span>
    </span>
  );
}
