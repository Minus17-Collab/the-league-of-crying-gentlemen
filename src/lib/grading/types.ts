/**
 * Shared types for draft grading (see AGENTS.md Phase 3.5.2 / ROADMAP.md
 * "Draft grading"). Mirrors the shape of `lib/scoring/types.ts` — plain
 * data in, plain data out, no I/O.
 */

/** One draft pick with enough context to grade it. */
export interface GradablePick {
  draftPickId: string;
  seasonId: string;
  round: number;
  overallPick: number;
  /** Total fantasy points the drafted player scored that season, from
   * stored `lineup_entries.points` (or null if the player/season has no
   * recorded points — e.g. never rostered after being drafted, or data
   * not yet backfilled). Never computed here — see AGENTS.md "Scoring is
   * data, never code". */
  seasonPoints: number | null;
  /** Preseason market ADP for this player, from an external source
   * (Fantasy Football Calculator). Null when the player could not be
   * matched by name — never guessed. */
  adpAtPick: number | null;
}

export interface RegradeResult {
  draftPickId: string;
  expectedPoints: number | null;
  voe: number | null;
  regradeGrade: string | null;
  regradeRank: number | null;
}

export interface DraftNightResult {
  draftPickId: string;
  reachValue: number | null;
  draftNightGrade: string | null;
}
