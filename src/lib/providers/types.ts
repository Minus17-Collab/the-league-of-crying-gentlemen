/**
 * The one interface all external stat data enters through (see
 * AGENTS.md "Stat providers are swappable"). Implementations live in
 * lib/providers/{espn,sleeper,tank01}/. Nothing outside lib/providers/
 * may import a provider directly — use the factory in
 * lib/providers/index.ts, selected via the STAT_PROVIDER env var.
 *
 * Provider player IDs and team IDs are "external" IDs. They are
 * resolved into internal player_id / team_id via player_external_ids
 * during ingest (Phase 2.2) — they never appear in stat_lines or
 * players directly.
 */

export interface NormalizedPlayer {
  externalPlayerId: string;
  fullName: string;
  position: string;
  nflTeam: string | null;
}

export interface NormalizedStatLine {
  externalPlayerId: string;
  year: number;
  week: number;
  statKey: string;
  value: number;
  position?: string;
}

export interface NormalizedTeam {
  externalTeamId: string;
  year: number;
  name: string;
  abbreviation: string | null;
  logoUrl: string | null;
  /** ESPN owner GUID(s) for this team-season. Usually one, occasionally two (co-managers). */
  ownerExternalIds: string[];
  draftSlot: number | null;
}

export interface NormalizedMatchup {
  year: number;
  week: number;
  homeExternalTeamId: string;
  awayExternalTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  isPlayoff: boolean;
  isChampionship: boolean;
  isFinal: boolean;
}

export interface NormalizedRosterEntry {
  year: number;
  week: number;
  externalTeamId: string;
  externalPlayerId: string;
  slotCode: string;
  isStarter: boolean;
  points: number | null;
}

export interface NormalizedDraftPick {
  year: number;
  round: number;
  pickInRound: number;
  overallPick: number;
  externalTeamId: string;
  externalPlayerId: string | null;
  keeper: boolean;
}

export interface NormalizedTransaction {
  year: number;
  week: number | null;
  type: "add" | "drop" | "trade" | "waiver";
  externalTeamId: string | null;
  counterpartyExternalTeamId: string | null;
  occurredAt: string;
  /** trade_id for trades, sourced from the provider's transaction ID. */
  tradeId: string | null;
  details: unknown;
}

export interface StatProvider {
  name: string;
  fetchWeeklyStats(year: number, week: number): Promise<NormalizedStatLine[]>;
  fetchPlayers(): Promise<NormalizedPlayer[]>;
  fetchTeams(year: number): Promise<NormalizedTeam[]>;
  fetchMatchups(year: number): Promise<NormalizedMatchup[]>;
  fetchRosters(year: number, week: number): Promise<NormalizedRosterEntry[]>;
  fetchDraftPicks(year: number): Promise<NormalizedDraftPick[]>;
  fetchTransactions(year: number): Promise<NormalizedTransaction[]>;
  /** Enumerate every season the provider has data for (e.g. ESPN's previousSeasons). */
  fetchAvailableSeasons(): Promise<number[]>;
  /** One lightweight authenticated call. Resolves false on auth failure (e.g. HTTP 401). */
  checkCredentials(): Promise<boolean>;
}
