/**
 * Server-only data access for the League Records feature (see
 * ROADMAP.md 3.2 / 3.5.1, schema.sql's `record_results` comment).
 *
 * Every value here was already computed and stored by
 * scripts/compute-records.mjs (mirroring src/lib/records/engine.ts) --
 * this module only reads `record_definitions` + `record_results` and
 * resolves franchise display names, never recomputes anything (see
 * AGENTS.md "Scoring is data, never code" and ROADMAP.md 3.5.1
 * "computed by a scheduled job... never in a page request").
 */

import { createClient } from "@/lib/supabase/public";

export interface RecordHolderDisplay {
  franchiseId: string;
  managerName: string;
  context: Record<string, unknown>;
}

export interface RecordDefinitionSummary {
  key: string;
  title: string;
  description: string | null;
  direction: string;
}

/** One all-time record: a title/description plus every co-holder tied
 * at the record value (see "ties share the record" in the plan --
 * `holders` is never truncated to one). */
export interface AllTimeRecordEntry {
  definition: RecordDefinitionSummary;
  isPlayoff: boolean;
  value: number;
  holders: RecordHolderDisplay[];
}

/** One row of a per-season leaderboard category (every manager gets
 * an entry, not just the extreme -- see compute-records.mjs's
 * "leaderboardKeys" comment for which categories work this way). */
export interface SeasonLeaderboardRow {
  franchiseId: string;
  managerName: string;
  value: number;
  context: Record<string, unknown>;
}

export interface SeasonLeaderboard {
  definition: RecordDefinitionSummary;
  isPlayoff: boolean;
  rows: SeasonLeaderboardRow[];
}

/** A single tied-extreme record scoped to one season (e.g. that
 * season's single highest week) -- same tie semantics as
 * AllTimeRecordEntry, just season-scoped. */
export interface SeasonRecordEntry {
  definition: RecordDefinitionSummary;
  isPlayoff: boolean;
  value: number;
  holders: RecordHolderDisplay[];
}

/** Mirrors EXCLUDED_SEASON_YEARS in scripts/compute-records.mjs --
 * keep the two in sync. Season 1 (2023) had materially different
 * scoring rules and team count and is permanently excluded from
 * every record category (see data/history/SUMMARY.md).
 * Season 4 (2026) is live and is temporarily excluded until it ends. */
const EXCLUDED_SEASON_YEARS = [2023, 2026];

/** Every season year that records were computed for -- i.e. every
 * season minus EXCLUDED_SEASON_YEARS, not "the N most recent" (see
 * compute-records.mjs header comment for why). */
export async function getIncludedSeasonYears(): Promise<number[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("seasons").select("year").order("year", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((s) => s.year).filter((year) => !EXCLUDED_SEASON_YEARS.includes(year));
}

/** Some context blobs carry an `opponentFranchiseId` (single-week
 * records) -- add the resolved manager name alongside it so the page
 * never needs a second round trip just to label an opponent. */
function enrichContext(
  context: Record<string, unknown>,
  franchiseNames: Map<string, string>,
): Record<string, unknown> {
  const opponentFranchiseId = context.opponentFranchiseId;
  if (typeof opponentFranchiseId === "string") {
    return { ...context, opponentManagerName: franchiseNames.get(opponentFranchiseId) ?? "Unknown" };
  }
  return context;
}

async function getFranchiseNames(): Promise<Map<string, string>> {
  const supabase = createClient();
  const { data, error } = await supabase.from("franchises").select("id, display_name");
  if (error) throw error;
  return new Map((data ?? []).map((f) => [f.id, f.display_name]));
}

async function getDefinitions(): Promise<
  Map<string, { id: string } & RecordDefinitionSummary>
> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("record_definitions")
    .select("id, key, title, description, direction");
  if (error) throw error;
  return new Map((data ?? []).map((d) => [d.key, d]));
}

const ALL_TIME_KEYS = [
  "alltime_highest_scoring_season",
  "alltime_highest_scoring_playoff_run",
  "alltime_lowest_scoring_season",
  "alltime_highest_single_week_regular",
  "alltime_highest_single_week_playoff",
  "alltime_lowest_single_week_regular",
  "alltime_lowest_single_week_playoff",
  "alltime_best_avg_margin_of_victory",
  "alltime_worst_avg_margin_of_defeat",
  "alltime_longest_win_streak",
  "alltime_longest_losing_streak",
  "alltime_unluckiest_season",
  "alltime_luckiest_season",
  "alltime_toughest_schedule",
  "alltime_easiest_schedule",
  "alltime_most_regular_season_wins",
  "alltime_most_regular_season_losses",
  "alltime_best_win_percentage",
];

/** Every all-time record, in the fixed display order above. Empty
 * `holders` (no rows yet computed) are still returned so the page can
 * show "not yet computed" rather than silently omitting a category. */
export async function getAllTimeRecords(): Promise<AllTimeRecordEntry[]> {
  const [definitions, franchiseNames] = await Promise.all([getDefinitions(), getFranchiseNames()]);

  const definitionIds = ALL_TIME_KEYS.map((k) => definitions.get(k)?.id).filter(
    (id): id is string => id != null,
  );

  const supabase = createClient();
  const { data: results, error } = await supabase
    .from("record_results")
    .select("record_definition_id, is_playoff, value, franchise_id, context")
    .eq("scope", "alltime")
    .in("record_definition_id", definitionIds.length > 0 ? definitionIds : [""]);
  if (error) throw error;

  return ALL_TIME_KEYS.map((key) => {
    const definition = definitions.get(key);
    if (!definition) {
      return null;
    }
    const rows = (results ?? []).filter((r) => r.record_definition_id === definition.id);
    const value = rows[0]?.value ?? 0;
    const holders: RecordHolderDisplay[] = rows.map((r) => ({
      franchiseId: r.franchise_id,
      managerName: franchiseNames.get(r.franchise_id) ?? "Unknown",
      context: enrichContext((r.context as Record<string, unknown>) ?? {}, franchiseNames),
    }));
    return {
      definition: {
        key: definition.key,
        title: definition.title,
        description: definition.description,
        direction: definition.direction,
      },
      isPlayoff: rows[0]?.is_playoff ?? false,
      value,
      holders,
    };
  }).filter((entry): entry is AllTimeRecordEntry => entry !== null);
}

const SEASON_LEADERBOARD_KEYS = [
  "season_total_points",
  "season_avg_margin_of_victory",
  "season_avg_margin_of_defeat",
  "season_longest_win_streak",
  "season_longest_losing_streak",
  "season_luck_score",
];

const SEASON_EXTREME_KEYS = ["season_high_score", "season_low_score"];

export interface SeasonRecordsResult {
  leaderboards: SeasonLeaderboard[];
  extremes: SeasonRecordEntry[];
}

/** Every per-season record for one year: full per-manager
 * leaderboards for the "by manager" categories, plus the tied
 * high/low single-week extremes (regular season and playoffs
 * separate -- see compute-records.mjs). */
export async function getSeasonRecords(year: number): Promise<SeasonRecordsResult> {
  const [definitions, franchiseNames] = await Promise.all([getDefinitions(), getFranchiseNames()]);

  const wantedKeys = [...SEASON_LEADERBOARD_KEYS, ...SEASON_EXTREME_KEYS];
  const definitionIds = wantedKeys.map((k) => definitions.get(k)?.id).filter((id): id is string => id != null);

  const supabase = createClient();
  const { data: results, error } = await supabase
    .from("record_results")
    .select("record_definition_id, is_playoff, value, franchise_id, context")
    .eq("scope", "season")
    .eq("season_year", year)
    .in("record_definition_id", definitionIds.length > 0 ? definitionIds : [""]);
  if (error) throw error;

  const rowsForKey = (key: string) => {
    const definition = definitions.get(key);
    if (!definition) return [];
    return (results ?? []).filter((r) => r.record_definition_id === definition.id);
  };

  const leaderboards: SeasonLeaderboard[] = SEASON_LEADERBOARD_KEYS.map((key) => {
    const definition = definitions.get(key);
    if (!definition) return null;
    const rows = rowsForKey(key);
    const sorted = [...rows].sort((a, b) => (definition.direction === "asc" ? a.value - b.value : b.value - a.value));
    return {
      definition: {
        key: definition.key,
        title: definition.title,
        description: definition.description,
        direction: definition.direction,
      },
      isPlayoff: false,
      rows: sorted.map((r) => ({
        franchiseId: r.franchise_id,
        managerName: franchiseNames.get(r.franchise_id) ?? "Unknown",
        value: r.value,
        context: enrichContext((r.context as Record<string, unknown>) ?? {}, franchiseNames),
      })),
    };
  }).filter((lb): lb is SeasonLeaderboard => lb !== null);

  const extremes: SeasonRecordEntry[] = [];
  for (const key of SEASON_EXTREME_KEYS) {
    const definition = definitions.get(key);
    if (!definition) continue;
    const rows = rowsForKey(key);
    for (const isPlayoff of [false, true]) {
      const scoped = rows.filter((r) => r.is_playoff === isPlayoff);
      if (scoped.length === 0) continue;
      extremes.push({
        definition: {
          key: definition.key,
          title: definition.title,
          description: definition.description,
          direction: definition.direction,
        },
        isPlayoff,
        value: scoped[0].value,
        holders: scoped.map((r) => ({
          franchiseId: r.franchise_id,
          managerName: franchiseNames.get(r.franchise_id) ?? "Unknown",
          context: enrichContext((r.context as Record<string, unknown>) ?? {}, franchiseNames),
        })),
      });
    }
  }

  return { leaderboards, extremes };
}

export interface FranchiseRecordSection {
  definition: RecordDefinitionSummary;
  /** True when this category has no computed rows (a documented data
   * gap, see `data_gaps` -- never fabricated). */
  unavailable: boolean;
  rows: SeasonLeaderboardRow[];
}

const FRANCHISE_KEYS = ["franchise_transaction_activity", "franchise_injury_approx_starts"];

/** Franchise (best-effort) records -- see compute-records.mjs for why
 * `franchise_transaction_activity` may legitimately have zero rows
 * (ESPN does not retain this league's transaction history; see
 * data_gaps) rather than that being a bug. */
export async function getFranchiseRecords(): Promise<FranchiseRecordSection[]> {
  const [definitions, franchiseNames] = await Promise.all([getDefinitions(), getFranchiseNames()]);
  const definitionIds = FRANCHISE_KEYS.map((k) => definitions.get(k)?.id).filter((id): id is string => id != null);

  const supabase = createClient();
  const { data: results, error } = await supabase
    .from("record_results")
    .select("record_definition_id, value, franchise_id, context, season_year")
    .in("record_definition_id", definitionIds.length > 0 ? definitionIds : [""]);
  if (error) throw error;

  return FRANCHISE_KEYS.map((key): FranchiseRecordSection | null => {
    const definition = definitions.get(key);
    if (!definition) return null;
    const rows = (results ?? []).filter((r) => r.record_definition_id === definition.id);

    // Combine across seasons per franchise for a "career total" view.
    const totals = new Map<string, number>();
    for (const r of rows) {
      totals.set(r.franchise_id, (totals.get(r.franchise_id) ?? 0) + r.value);
    }
    const combined: SeasonLeaderboardRow[] = [...totals.entries()]
      .map(([franchiseId, value]) => ({
        franchiseId,
        managerName: franchiseNames.get(franchiseId) ?? "Unknown",
        value,
        context: { combinedAcrossSeasons: true } as Record<string, unknown>,
      }))
      .sort((a, b) => b.value - a.value);

    return {
      definition: {
        key: definition.key,
        title: definition.title,
        description: definition.description,
        direction: definition.direction,
      },
      unavailable: rows.length === 0,
      rows: combined,
    };
  }).filter((section): section is FranchiseRecordSection => section !== null);
}
