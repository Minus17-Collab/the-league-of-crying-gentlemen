/**
 * Shared value formatting for the records pages. A record's `key`
 * determines its unit, not a per-page guess -- keeps
 * `/records` and `/records/[year]` from drifting apart (see the site
 * upgrade plan's Phase 3.2 for the bugs this fixes: streaks rendering
 * as "9.00" instead of "9", and large point totals with no thousands
 * separator).
 */

function isStreakKey(key: string): boolean {
  return key.includes("streak");
}

function isLuckKey(key: string): boolean {
  return key.includes("luck");
}

/** The primary displayed value for a record card/leaderboard row. */
export function formatRecordValue(key: string, value: number): string {
  if (isStreakKey(key)) {
    // Streaks and other game counts are always whole numbers.
    return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }
  if (isLuckKey(key)) {
    const formatted = Math.abs(value).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const sign = value > 0 ? "+" : value < 0 ? "-" : "";
    return `${sign}${formatted} wins`;
  }
  // Points, margins, toughest-schedule totals: two decimals, with a
  // thousands separator for anything large (e.g. toughest schedule
  // faced, which sums a full season of opponents' points).
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Smaller numbers embedded in a holder's context line (e.g. "scores
 * deserved about 8.3 wins"), not the headline value -- always plain
 * fixed-decimal, since these never get large enough to need a
 * thousands separator. */
export function formatContextNumber(value: number, digits = 1): string {
  return value.toFixed(digits);
}

/** Franchise-record counts (e.g. approximate injury/bye starts) --
 * always whole numbers. */
export function formatCount(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
