/**
 * Types for the scoring engine (see AGENTS.md "Scoring is data, never
 * code"). These mirror stat_lines and scoring_rules in schema.sql /
 * supabase/migrations — keep them in sync when the schema changes.
 */

/** A single normalized stat observation for one player in one week. */
export interface StatLine {
  playerId: string;
  year: number;
  week: number;
  statKey: string;
  value: number;
  /**
   * Player's position at the time of this stat line, e.g. 'QB', 'RB',
   * 'WR', 'TE', 'K', 'DST'. Required for rules with a positionFilter;
   * rules without a positionFilter apply regardless of this field.
   */
  position?: string;
}

/**
 * A season-scoped scoring rule. Multiple rules may share the same
 * statKey — one for the per-unit rate, and separate rows for flat
 * threshold bonuses (e.g. "300+ passing yards = +3").
 */
export interface ScoringRule {
  statKey: string;
  pointsPerUnit: number;
  flatBonus: number;
  /** Inclusive lower bound for flatBonus to apply. Null = no lower bound. */
  minValue: number | null;
  /** Inclusive upper bound for flatBonus to apply. Null = no upper bound. */
  maxValue: number | null;
  /** Restrict this rule to these positions. Null/empty = applies to all. */
  positionFilter: string[] | null;
}
