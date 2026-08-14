/**
 * ESPN uses proprietary numeric IDs for positions, lineup slots, and
 * stat categories. Position and lineup-slot IDs are stable and
 * well-documented by the fantasy-football community; stat IDs vary
 * more and MUST be cross-checked against this league's real
 * `mSettings` response before trusting them (see AGENTS.md "Never
 * do this: hardcode a point value" — a wrong statId mapping is
 * equivalent to a wrong point value).
 */

/** ESPN defaultPositionId -> this codebase's position vocabulary. */
export const ESPN_POSITION_MAP: Record<number, string> = {
  1: "QB",
  2: "RB",
  3: "WR",
  4: "TE",
  5: "K",
  16: "DST",
};

/** ESPN lineupSlotId -> this codebase's roster_slots.slot_code vocabulary. */
export const ESPN_LINEUP_SLOT_MAP: Record<number, string> = {
  0: "QB",
  2: "RB",
  4: "WR",
  6: "TE",
  23: "FLEX",
  17: "K",
  16: "DST",
  20: "BE",
  21: "IR",
};

export function mapEspnPosition(positionId: number | undefined): string | null {
  if (positionId === undefined) return null;
  return ESPN_POSITION_MAP[positionId] ?? null;
}

export function mapEspnLineupSlot(slotId: number): string | null {
  return ESPN_LINEUP_SLOT_MAP[slotId] ?? null;
}

/**
 * ESPN scoringItems statId -> this league's stat_categories.key.
 *
 * Intentionally starts EMPTY. Populate it by fetching this league's
 * real mSettings response (scripts/check-credentials or an ad-hoc
 * fetch), comparing each scoringItems[].statId + its points value
 * against the league's known scoring rules exported from the ESPN
 * UI, and adding confirmed entries one at a time.
 *
 * Any statId encountered during normalization that is NOT in this
 * map is reported via `unmappedStatIds` (see normalize.ts) rather
 * than silently dropped or guessed — see ROADMAP.md "Open questions
 * — answer before Phase 0.3" and AGENTS.md "When requirements are
 * ambiguous".
 */
export const ESPN_STAT_ID_TO_KEY: Record<number, string> = {};

export function mapEspnStatId(statId: number): string | null {
  return ESPN_STAT_ID_TO_KEY[statId] ?? null;
}
