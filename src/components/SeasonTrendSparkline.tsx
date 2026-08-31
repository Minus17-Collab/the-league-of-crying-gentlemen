import type { ManagerSeasonPoint } from "@/lib/data/league";

/**
 * Inline SVG bar chart of a manager's season-total points across their
 * career, with a league-average reference line. No charting library —
 * the site is a static export with no client JS budget for one, per the
 * site upgrade plan's Phase 4.5. The underlying values are always
 * available in an adjacent `sr-only` table for screen readers.
 */
export function SeasonTrendSparkline({
  points,
  leagueAverage,
}: {
  points: ManagerSeasonPoint[];
  leagueAverage: number | null;
}) {
  if (points.length === 0) return null;

  const width = 320;
  const height = 120;
  const padding = 8;
  const barGap = 8;
  const maxValue = Math.max(...points.map((p) => p.pointsFor), leagueAverage ?? 0) * 1.05;
  const barWidth = (width - padding * 2 - barGap * (points.length - 1)) / points.length;

  function barHeight(value: number): number {
    if (maxValue === 0) return 0;
    return ((height - padding * 2) * value) / maxValue;
  }

  const averageY =
    leagueAverage != null ? height - padding - barHeight(leagueAverage) : null;

  return (
    <div className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Season-by-season point totals"
        className="w-full max-w-sm"
      >
        {averageY != null && (
          <line
            x1={padding}
            x2={width - padding}
            y1={averageY}
            y2={averageY}
            stroke="var(--color-gold-500, #c6a664)"
            strokeWidth="1"
            strokeDasharray="4 3"
          />
        )}
        {points.map((p, i) => {
          const x = padding + i * (barWidth + barGap);
          const h = barHeight(p.pointsFor);
          const y = height - padding - h;
          return (
            <g key={p.year}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={h}
                fill={p.finalRank === 1 ? "var(--color-gold-400, #d3b57f)" : "var(--color-gold-700, #8a6530)"}
                rx="2"
              />
              <text
                x={x + barWidth / 2}
                y={height - 1}
                textAnchor="middle"
                fontSize="9"
                fill="var(--color-ivory, #f3e9d2)"
                opacity="0.7"
              >
                {p.year}
              </text>
            </g>
          );
        })}
      </svg>
      {leagueAverage != null && (
        <p className="text-xs text-ivory/60">
          Dashed line: league-average season points ({leagueAverage.toFixed(1)}).
        </p>
      )}
      <table className="sr-only">
        <caption>Season-by-season point totals</caption>
        <thead>
          <tr>
            <th scope="col">Season</th>
            <th scope="col">Points For</th>
            <th scope="col">Final Rank</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.year}>
              <th scope="row">{p.year}</th>
              <td>{p.pointsFor.toFixed(1)}</td>
              <td>{p.finalRank ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
