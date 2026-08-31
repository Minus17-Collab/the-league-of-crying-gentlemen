/**
 * Server-only data access for the public site, backed by Supabase.
 *
 * Uses the anon client (respects RLS) since every table read here has a
 * public-read policy (see supabase/migrations/20260101000008_rls.sql).
 * Only call these from Server Components or Route Handlers, never from
 * "use client" components (see AGENTS.md "Data fetching in Server
 * Components or Route Handlers, never useEffect").
 *
 * Do NOT add scoring computation here — this only ever displays values
 * already stored (`points_for`, `wins`, `scoring_rules.points_per_unit`,
 * etc.), per AGENTS.md "Scoring is data, never code". The one true
 * scoring function is lib/scoring/engine.ts.
 */

import { createClient } from "@/lib/supabase/public";

export interface Manager {
  franchiseId: string;
  name: string;
  seasonsActive: number[];
  inferredRetiredAfterSeason: number | null;
}

export interface TeamSeasonRecord {
  teamId: string;
  franchiseId: string;
  name: string;
  abbreviation: string | null;
  managerName: string;
  playoffSeed: number | null;
  finalRank: number | null;
  pointsFor: number;
  pointsAgainst: number;
  wins: number;
  losses: number;
  ties: number;
}

export interface SeasonChampion {
  year: number;
  franchiseId: string;
  managerName: string;
  teamName: string;
}

export interface SeasonFormat {
  teamCount: number;
  matchupPeriodCount: number;
  playoffTeamCount: number;
  divisions: { name: string; size: number }[];
  playoffMatchupPeriodLength: number | null;
  draftType: string | null;
  keeperCount: number | null;
}

export interface ManagerTopScorer {
  playerId: string;
  name: string;
  position: string;
  totalPoints: number;
  seasons: number[];
}

export interface ManagerDraftPick {
  playerId: string | null;
  playerName: string | null;
  year: number;
  round: number;
  overallPick: number;
  seasonPoints: number | null;
  voe: number | null;
  regradeGrade: string | null;
  adpAtPick: number | null;
  reachValue: number | null;
  draftNightGrade: string | null;
}

export interface ManagerDetail {
  franchiseId: string;
  name: string;
  seasonsActive: number[];
  status: "active" | "retired";
  retiredAfterSeason: number | null;
  careerRecord: { wins: number; losses: number; ties: number };
  averageFinalRank: number | null;
  bestFinish: number | null;
  worstFinish: number | null;
  championships: number;
  playoffAppearances: number;
  playoffWins: number;
  uniquePlayersRostered: number;
  strongestPosition: { position: string; totalPoints: number } | null;
  numberOneOverallPicks: number;
  topScorers: ManagerTopScorer[];
  bestDraftPicks: ManagerDraftPick[];
  favoritePlayer: { playerId: string; name: string; position: string; starts: number; seasons: number[] } | null;
}

async function getSeasonId(year: number): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("seasons")
    .select("id")
    .eq("year", year)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

/**
 * When ESPN data was last successfully synced (see
 * supabase/migrations/20260101000012_sync_status_public_view.sql, which
 * exposes only this one aggregate from the otherwise authenticated-only
 * `sync_runs` table). Returns null if the view isn't reachable yet (e.g.
 * the migration hasn't been applied to this environment) or no
 * successful sync has ever run — callers should fall back to build time
 * in that case rather than fail the page.
 */
export async function getLastSuccessfulSyncAt(): Promise<Date | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("public_sync_status")
      .select("last_successful_sync_at")
      .maybeSingle();
    if (error || !data?.last_successful_sync_at) return null;
    return new Date(data.last_successful_sync_at);
  } catch {
    return null;
  }
}

export async function getSeasons(): Promise<number[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("seasons")
    .select("year")
    .order("year", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((s) => s.year);
}

export async function getManagers(): Promise<Manager[]> {
  const supabase = createClient();
  const [franchisesRes, teamsRes, seasonsRes] = await Promise.all([
    supabase.from("franchises").select("id, display_name, retired_season"),
    supabase.from("teams").select("franchise_id, season_id"),
    supabase.from("seasons").select("id, year"),
  ]);
  if (franchisesRes.error) throw franchisesRes.error;
  if (teamsRes.error) throw teamsRes.error;
  if (seasonsRes.error) throw seasonsRes.error;

  const yearBySeasonId = new Map((seasonsRes.data ?? []).map((s) => [s.id, s.year]));
  const seasonsByFranchise = new Map<string, Set<number>>();
  for (const t of teamsRes.data ?? []) {
    const year = yearBySeasonId.get(t.season_id);
    if (year === undefined) continue;
    const set = seasonsByFranchise.get(t.franchise_id) ?? new Set<number>();
    set.add(year);
    seasonsByFranchise.set(t.franchise_id, set);
  }

  return (franchisesRes.data ?? [])
    .map((f) => ({
      franchiseId: f.id,
      name: f.display_name,
      seasonsActive: [...(seasonsByFranchise.get(f.id) ?? [])].sort((a, b) => a - b),
      inferredRetiredAfterSeason: f.retired_season,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getStandings(year: number): Promise<TeamSeasonRecord[]> {
  const seasonId = await getSeasonId(year);
  if (!seasonId) return [];

  const supabase = createClient();
  const { data: teams, error: teamsErr } = await supabase
    .from("teams")
    .select(
      "id, franchise_id, name, abbreviation, playoff_seed, final_rank, points_for, points_against, wins, losses, ties",
    )
    .eq("season_id", seasonId);
  if (teamsErr) throw teamsErr;

  const franchiseIds = [...new Set((teams ?? []).map((t) => t.franchise_id))];
  const { data: franchises, error: franchiseErr } = await supabase
    .from("franchises")
    .select("id, display_name")
    .in("id", franchiseIds.length > 0 ? franchiseIds : [""]);
  if (franchiseErr) throw franchiseErr;
  const nameByFranchiseId = new Map((franchises ?? []).map((f) => [f.id, f.display_name]));

  return (teams ?? [])
    .map((t) => ({
      teamId: t.id,
      franchiseId: t.franchise_id,
      name: t.name,
      abbreviation: t.abbreviation,
      managerName: nameByFranchiseId.get(t.franchise_id) ?? "Unknown",
      playoffSeed: t.playoff_seed,
      finalRank: t.final_rank,
      pointsFor: t.points_for ?? 0,
      pointsAgainst: t.points_against ?? 0,
      wins: t.wins ?? 0,
      losses: t.losses ?? 0,
      ties: t.ties,
    }))
    .sort((a, b) => (a.finalRank ?? Number.MAX_SAFE_INTEGER) - (b.finalRank ?? Number.MAX_SAFE_INTEGER));
}

export interface PlayoffBracketTeam {
  teamId: string;
  franchiseId: string;
  name: string;
  managerName: string;
  seed: number | null;
  score: number | null;
}

export interface PlayoffMatchup {
  week: number;
  isChampionship: boolean;
  isFinal: boolean;
  home: PlayoffBracketTeam | null;
  away: PlayoffBracketTeam | null;
}

export interface PlayoffBracketResult {
  /** The real championship chase (ESPN's "Winners Bracket"), every round. */
  winners: PlayoffMatchup[];
  /**
   * The bottom-standings "Losers Consolation Ladder" — non-playoff teams
   * playing out placement. Only the first playoff week's games are
   * returned; later weeks just replay the same pairing for tiebreak
   * purposes and aren't worth a full bracket display.
   */
  consolation: PlayoffMatchup[];
}

/**
 * A season's playoff bracket(s), split by ESPN's `matchups.playoff_bracket`
 * tier (see supabase/migrations/20260101000010_playoff_bracket.sql) —
 * the "Winners Consolation Ladder" (3rd/5th/7th place games) is
 * intentionally omitted. Reads only already-stored matchup rows, no
 * scoring computation.
 */
export async function getPlayoffBracket(year: number): Promise<PlayoffBracketResult> {
  const seasonId = await getSeasonId(year);
  if (!seasonId) return { winners: [], consolation: [] };

  const supabase = createClient();
  const { data: matchups, error: matchupsErr } = await supabase
    .from("matchups")
    .select(
      "week, home_team_id, away_team_id, home_score, away_score, is_championship, is_final, playoff_bracket",
    )
    .eq("season_id", seasonId)
    .in("playoff_bracket", ["winners", "losers_consolation"])
    .order("week", { ascending: true });
  if (matchupsErr) throw matchupsErr;
  if (!matchups || matchups.length === 0) return { winners: [], consolation: [] };

  const teamIds = [
    ...new Set(matchups.flatMap((m) => [m.home_team_id, m.away_team_id])),
  ];
  const { data: teams, error: teamsErr } = await supabase
    .from("teams")
    .select("id, franchise_id, name, playoff_seed")
    .in("id", teamIds.length > 0 ? teamIds : [""]);
  if (teamsErr) throw teamsErr;

  const franchiseIds = [...new Set((teams ?? []).map((t) => t.franchise_id))];
  const { data: franchises, error: franchiseErr } = await supabase
    .from("franchises")
    .select("id, display_name")
    .in("id", franchiseIds.length > 0 ? franchiseIds : [""]);
  if (franchiseErr) throw franchiseErr;
  const nameByFranchiseId = new Map((franchises ?? []).map((f) => [f.id, f.display_name]));

  const teamById = new Map(
    (teams ?? []).map((t) => [
      t.id,
      {
        teamId: t.id,
        franchiseId: t.franchise_id,
        name: t.name,
        managerName: nameByFranchiseId.get(t.franchise_id) ?? "Unknown",
        seed: t.playoff_seed,
      },
    ]),
  );

  const toPlayoffMatchup = (m: (typeof matchups)[number]): PlayoffMatchup => {
    const home = teamById.get(m.home_team_id);
    const away = teamById.get(m.away_team_id);
    return {
      week: m.week,
      isChampionship: m.is_championship,
      isFinal: m.is_final,
      home: home ? { ...home, score: m.home_score } : null,
      away: away ? { ...away, score: m.away_score } : null,
    };
  };

  const winners = matchups.filter((m) => m.playoff_bracket === "winners").map(toPlayoffMatchup);

  const consolationMatchups = matchups.filter((m) => m.playoff_bracket === "losers_consolation");
  const firstConsolationWeek = Math.min(...consolationMatchups.map((m) => m.week));
  const consolation = consolationMatchups
    .filter((m) => m.week === firstConsolationWeek)
    .map(toPlayoffMatchup);

  return { winners, consolation };
}

/**
 * The season-by-season champion (the team with `final_rank = 1`), newest
 * season first. Reads only already-stored `final_rank` values — see
 * AGENTS.md "Scoring is data, never code".
 */
export async function getChampions(): Promise<SeasonChampion[]> {
  const supabase = createClient();

  const [{ data: teams, error: teamsErr }, { data: seasons, error: seasonsErr }] =
    await Promise.all([
      supabase
        .from("teams")
        .select("franchise_id, season_id, name")
        .eq("final_rank", 1),
      supabase.from("seasons").select("id, year"),
    ]);
  if (teamsErr) throw teamsErr;
  if (seasonsErr) throw seasonsErr;

  const yearBySeasonId = new Map((seasons ?? []).map((s) => [s.id, s.year]));

  const franchiseIds = [...new Set((teams ?? []).map((t) => t.franchise_id))];
  const { data: franchises, error: franchiseErr } = await supabase
    .from("franchises")
    .select("id, display_name")
    .in("id", franchiseIds.length > 0 ? franchiseIds : [""]);
  if (franchiseErr) throw franchiseErr;
  const nameByFranchiseId = new Map((franchises ?? []).map((f) => [f.id, f.display_name]));

  return (teams ?? [])
    .map((t) => {
      const year = yearBySeasonId.get(t.season_id);
      if (year === undefined) return null;
      return {
        year,
        franchiseId: t.franchise_id,
        managerName: nameByFranchiseId.get(t.franchise_id) ?? "Unknown",
        teamName: t.name,
      };
    })
    .filter((c): c is SeasonChampion => c !== null)
    .sort((a, b) => b.year - a.year);
}

export async function getFormat(year: number): Promise<SeasonFormat | null> {
  const supabase = createClient();
  const { data: season, error } = await supabase
    .from("seasons")
    .select("id, regular_weeks, playoff_teams, divisions, playoff_matchup_period_length, draft_type, keeper_count")
    .eq("year", year)
    .maybeSingle();
  if (error) throw error;
  if (!season) return null;

  const { count, error: countErr } = await supabase
    .from("teams")
    .select("id", { count: "exact", head: true })
    .eq("season_id", season.id);
  if (countErr) throw countErr;

  return {
    teamCount: count ?? 0,
    matchupPeriodCount: season.regular_weeks,
    playoffTeamCount: season.playoff_teams,
    divisions: (season.divisions as { name: string; size: number }[] | null) ?? [],
    playoffMatchupPeriodLength: season.playoff_matchup_period_length,
    draftType: season.draft_type,
    keeperCount: season.keeper_count,
  };
}

/**
 * Career detail for one manager (franchise), spanning every season they
 * fielded a team. Every number here is aggregated from already-stored
 * columns (teams.final_rank, lineup_entries.points, draft_pick_grades,
 * etc.) — never computed scoring, per AGENTS.md "Scoring is data, never
 * code". `bestDraftPicks` uses `draft_pick_grades`, written by
 * scripts/compute-draft-grades.mjs (see that file and
 * src/lib/grading/draftGrades.ts for how VOE / Draft Night Grade are
 * derived), not computed here.
 */
export async function getManagerDetail(franchiseId: string): Promise<ManagerDetail | null> {
  const supabase = createClient();

  const { data: franchise, error: franchiseErr } = await supabase
    .from("franchises")
    .select("id, display_name, retired_season")
    .eq("id", franchiseId)
    .maybeSingle();
  if (franchiseErr) throw franchiseErr;
  if (!franchise) return null;

  const { data: teams, error: teamsErr } = await supabase
    .from("teams")
    .select("id, season_id, wins, losses, ties, final_rank, playoff_seed")
    .eq("franchise_id", franchiseId);
  if (teamsErr) throw teamsErr;
  if (!teams || teams.length === 0) {
    return {
      franchiseId: franchise.id,
      name: franchise.display_name,
      seasonsActive: [],
      status: franchise.retired_season ? "retired" : "active",
      retiredAfterSeason: franchise.retired_season,
      careerRecord: { wins: 0, losses: 0, ties: 0 },
      averageFinalRank: null,
      bestFinish: null,
      worstFinish: null,
      championships: 0,
      playoffAppearances: 0,
      playoffWins: 0,
      uniquePlayersRostered: 0,
      strongestPosition: null,
      numberOneOverallPicks: 0,
      topScorers: [],
      bestDraftPicks: [],
      favoritePlayer: null,
    };
  }

  const teamIds = teams.map((t) => t.id);
  const seasonIds = [...new Set(teams.map((t) => t.season_id))];

  const [
    { data: seasons, error: seasonsErr },
    { data: lineupEntries, error: lineupErr },
    { data: matchups, error: matchupsErr },
    { data: draftPicks, error: draftPicksErr },
  ] = await Promise.all([
    supabase.from("seasons").select("id, year").in("id", seasonIds),
    supabase
      .from("lineup_entries")
      .select("player_id, team_id, points, is_starter")
      .in("team_id", teamIds),
    supabase
      .from("matchups")
      .select("home_team_id, away_team_id, home_score, away_score, is_playoff")
      .eq("is_playoff", true)
      .in("season_id", seasonIds),
    supabase
      .from("draft_picks")
      .select("id, season_id, round, overall_pick, player_id, team_id")
      .in("team_id", teamIds),
  ]);
  if (seasonsErr) throw seasonsErr;
  if (lineupErr) throw lineupErr;
  if (matchupsErr) throw matchupsErr;
  if (draftPicksErr) throw draftPicksErr;

  const yearBySeasonId = new Map((seasons ?? []).map((s) => [s.id, s.year]));

  const playerIds = [
    ...new Set([
      ...(lineupEntries ?? []).map((e) => e.player_id),
      ...(draftPicks ?? []).map((p) => p.player_id).filter((id): id is string => id != null),
    ]),
  ];
  const { data: players, error: playersErr } = await supabase
    .from("players")
    .select("id, full_name, position")
    .in("id", playerIds.length > 0 ? playerIds : [""]);
  if (playersErr) throw playersErr;
  const playerById = new Map((players ?? []).map((p) => [p.id, p]));

  const draftPickIds = (draftPicks ?? []).map((p) => p.id);
  const { data: grades, error: gradesErr } = await supabase
    .from("draft_pick_grades")
    .select("draft_pick_id, season_points, voe, regrade_grade, adp_at_pick, reach_value, draft_night_grade")
    .in("draft_pick_id", draftPickIds.length > 0 ? draftPickIds : [""]);
  if (gradesErr) throw gradesErr;
  const gradeByPickId = new Map((grades ?? []).map((g) => [g.draft_pick_id, g]));

  // Career record + finish stats
  const careerRecord = teams.reduce(
    (acc, t) => {
      acc.wins += t.wins ?? 0;
      acc.losses += t.losses ?? 0;
      acc.ties += t.ties ?? 0;
      return acc;
    },
    { wins: 0, losses: 0, ties: 0 },
  );
  const finalRanks = teams.map((t) => t.final_rank).filter((r): r is number => r != null);
  const averageFinalRank =
    finalRanks.length > 0 ? finalRanks.reduce((a, b) => a + b, 0) / finalRanks.length : null;
  const bestFinish = finalRanks.length > 0 ? Math.min(...finalRanks) : null;
  const worstFinish = finalRanks.length > 0 ? Math.max(...finalRanks) : null;
  const championships = finalRanks.filter((r) => r === 1).length;
  const playoffAppearances = teams.filter((t) => t.playoff_seed != null).length;

  // Playoff wins
  const teamIdSet = new Set(teamIds);
  const playoffWins = (matchups ?? []).filter((m) => {
    const homeIsUs = teamIdSet.has(m.home_team_id);
    const awayIsUs = teamIdSet.has(m.away_team_id);
    if (!homeIsUs && !awayIsUs) return false;
    if (m.home_score == null || m.away_score == null) return false;
    if (homeIsUs) return m.home_score > m.away_score;
    return m.away_score > m.home_score;
  }).length;

  // Roster turnover + strongest position + top scorers
  const uniquePlayersRostered = new Set((lineupEntries ?? []).map((e) => e.player_id)).size;

  const pointsByPosition = new Map<string, number>();
  const pointsByPlayer = new Map<string, number>();
  const seasonsByPlayer = new Map<string, Set<number>>();
  for (const entry of lineupEntries ?? []) {
    if (entry.points == null) continue;
    const player = playerById.get(entry.player_id);
    if (player) {
      pointsByPosition.set(
        player.position,
        (pointsByPosition.get(player.position) ?? 0) + entry.points,
      );
    }
    pointsByPlayer.set(entry.player_id, (pointsByPlayer.get(entry.player_id) ?? 0) + entry.points);
    const year = yearBySeasonId.get(teams.find((t) => t.id === entry.team_id)?.season_id ?? "");
    if (year != null) {
      const set = seasonsByPlayer.get(entry.player_id) ?? new Set<number>();
      set.add(year);
      seasonsByPlayer.set(entry.player_id, set);
    }
  }

  let strongestPosition: ManagerDetail["strongestPosition"] = null;
  for (const [position, totalPoints] of pointsByPosition) {
    if (!strongestPosition || totalPoints > strongestPosition.totalPoints) {
      strongestPosition = { position, totalPoints };
    }
  }

  const topScorers: ManagerTopScorer[] = [...pointsByPlayer.entries()]
    .map(([playerId, totalPoints]) => {
      const player = playerById.get(playerId);
      return {
        playerId,
        name: player?.full_name ?? "Unknown",
        position: player?.position ?? "Unknown",
        totalPoints,
        seasons: [...(seasonsByPlayer.get(playerId) ?? [])].sort((a, b) => a - b),
      };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .slice(0, 5);

  const startsByPlayer = new Map<string, number>();
  const seasonsStartedByPlayer = new Map<string, Set<number>>();
  for (const entry of lineupEntries ?? []) {
    if (!entry.is_starter) continue;
    startsByPlayer.set(entry.player_id, (startsByPlayer.get(entry.player_id) ?? 0) + 1);
    const year = yearBySeasonId.get(teams.find((t) => t.id === entry.team_id)?.season_id ?? "");
    if (year != null) {
      const set = seasonsStartedByPlayer.get(entry.player_id) ?? new Set<number>();
      set.add(year);
      seasonsStartedByPlayer.set(entry.player_id, set);
    }
  }
  const favoritePlayerEntry = [...startsByPlayer.entries()]
    .sort((a, b) => b[1] - a[1])[0];
  const favoritePlayer = favoritePlayerEntry
    ? (() => {
        const [playerId, starts] = favoritePlayerEntry;
        const player = playerById.get(playerId);
        return {
          playerId,
          name: player?.full_name ?? "Unknown",
          position: player?.position ?? "Unknown",
          starts,
          seasons: [...(seasonsStartedByPlayer.get(playerId) ?? [])].sort((a, b) => a - b),
        };
      })()
    : null;

  // #1 overall picks
  const numberOneOverallPicks = (draftPicks ?? []).filter((p) => p.overall_pick === 1).length;

  // Best draft picks by VOE (Regrade), falling back to Draft Night Grade
  // context alongside it — see draft_pick_grades comment above.
  const bestDraftPicks: ManagerDraftPick[] = (draftPicks ?? [])
    .map((pick) => {
      const grade = gradeByPickId.get(pick.id);
      const player = pick.player_id ? playerById.get(pick.player_id) : null;
      return {
        playerId: pick.player_id,
        playerName: player?.full_name ?? null,
        year: yearBySeasonId.get(pick.season_id) ?? 0,
        round: pick.round,
        overallPick: pick.overall_pick,
        seasonPoints: grade?.season_points ?? null,
        voe: grade?.voe ?? null,
        regradeGrade: grade?.regrade_grade ?? null,
        adpAtPick: grade?.adp_at_pick ?? null,
        reachValue: grade?.reach_value ?? null,
        draftNightGrade: grade?.draft_night_grade ?? null,
      };
    })
    .filter((p) => p.voe != null)
    .sort((a, b) => (b.voe ?? 0) - (a.voe ?? 0))
    .slice(0, 5);

  return {
    franchiseId: franchise.id,
    name: franchise.display_name,
    seasonsActive: [...yearBySeasonId.values()]
      .filter((y): y is number => y != null)
      .sort((a, b) => a - b),
    status: franchise.retired_season ? "retired" : "active",
    retiredAfterSeason: franchise.retired_season,
    careerRecord,
    averageFinalRank,
    bestFinish,
    worstFinish,
    championships,
    playoffAppearances,
    playoffWins,
    uniquePlayersRostered,
    strongestPosition,
    numberOneOverallPicks,
    topScorers,
    bestDraftPicks,
    favoritePlayer,
  };
}

export interface HeadToHeadCell {
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
}

export interface HeadToHeadRow {
  franchiseId: string;
  managerName: string;
  isRetired: boolean;
  matchups: number;
  totalWins: number;
  totalLosses: number;
  totalTies: number;
  pointsFor: number;
  pointsAgainst: number;
  cells: Map<string, HeadToHeadCell>;
}

/** Cross-season regular-season matchup matrix. Computes only from stored
 * `matchups` rows, treating each game where a franchise was the home or away
 * team as one row of data. A tie is any game where both scores are non-null
 * and equal; wins/losses are determined by the higher score. Games missing
 * one or both scores are ignored. */
export async function getHeadToHead(): Promise<HeadToHeadRow[]> {
  const supabase = createClient();
  const [
    { data: matchups, error: matchupsErr },
    { data: teams, error: teamsErr },
    { data: seasons, error: seasonsErr },
    { data: franchises, error: franchisesErr },
  ] = await Promise.all([
    supabase
      .from("matchups")
      .select("home_team_id, away_team_id, home_score, away_score, is_playoff, season_id")
      .eq("is_playoff", false),
    supabase.from("teams").select("id, franchise_id, season_id"),
    supabase.from("seasons").select("id, year"),
    supabase.from("franchises").select("id, display_name, retired_season"),
  ]);
  if (matchupsErr) throw matchupsErr;
  if (teamsErr) throw teamsErr;
  if (seasonsErr) throw seasonsErr;
  if (franchisesErr) throw franchisesErr;

  const yearBySeasonId = new Map((seasons ?? []).map((s) => [s.id, s.year]));
  const nameByFranchiseId = new Map((franchises ?? []).map((f) => [f.id, f.display_name]));
  const retiredByFranchiseId = new Map((franchises ?? []).map((f) => [f.id, f.retired_season != null]));
  const franchiseByTeamId = new Map((teams ?? []).map((t) => [t.id, t.franchise_id]));

  const rows = new Map<string, HeadToHeadRow>();
  function ensureRow(franchiseId: string): HeadToHeadRow {
    if (!rows.has(franchiseId)) {
      rows.set(franchiseId, {
        franchiseId,
        managerName: nameByFranchiseId.get(franchiseId) ?? "Unknown",
        isRetired: retiredByFranchiseId.get(franchiseId) ?? false,
        matchups: 0,
        totalWins: 0,
        totalLosses: 0,
        totalTies: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        cells: new Map<string, HeadToHeadCell>(),
      });
    }
    return rows.get(franchiseId)!;
  }
  function ensureCell(row: HeadToHeadRow, opponentId: string): HeadToHeadCell {
    if (!row.cells.has(opponentId)) {
      row.cells.set(opponentId, {
        wins: 0,
        losses: 0,
        ties: 0,
        pointsFor: 0,
        pointsAgainst: 0,
      });
    }
    return row.cells.get(opponentId)!;
  }

  for (const m of matchups ?? []) {
    const year = yearBySeasonId.get(m.season_id);
    if (year === 2023) continue;
    const homeId = franchiseByTeamId.get(m.home_team_id);
    const awayId = franchiseByTeamId.get(m.away_team_id);
    if (!homeId || !awayId || homeId === awayId) continue;
    if (m.home_score == null || m.away_score == null) continue;

    const homeRow = ensureRow(homeId);
    const awayRow = ensureRow(awayId);
    const homeCell = ensureCell(homeRow, awayId);
    const awayCell = ensureCell(awayRow, homeId);

    homeRow.matchups += 1;
    awayRow.matchups += 1;
    homeRow.pointsFor += m.home_score;
    homeRow.pointsAgainst += m.away_score;
    awayRow.pointsFor += m.away_score;
    awayRow.pointsAgainst += m.home_score;
    homeCell.pointsFor += m.home_score;
    homeCell.pointsAgainst += m.away_score;
    awayCell.pointsFor += m.away_score;
    awayCell.pointsAgainst += m.home_score;

    if (m.home_score > m.away_score) {
      homeRow.totalWins += 1;
      awayRow.totalLosses += 1;
      homeCell.wins += 1;
      awayCell.losses += 1;
    } else if (m.away_score > m.home_score) {
      awayRow.totalWins += 1;
      homeRow.totalLosses += 1;
      awayCell.wins += 1;
      homeCell.losses += 1;
    } else {
      homeRow.totalTies += 1;
      awayRow.totalTies += 1;
      homeCell.ties += 1;
      awayCell.ties += 1;
    }
  }

  return [...rows.values()].sort((a, b) => a.managerName.localeCompare(b.managerName));
}

export interface DraftBoardPick {
  year: number;
  round: number;
  pickInRound: number;
  overallPick: number;
  franchiseId: string;
  managerName: string;
  playerName: string | null;
  playerId: string | null;
  position: string | null;
  nflTeam: string | null;
  seasonPoints: number | null;
  voe: number | null;
  regradeGrade: string | null;
  adpAtPick: number | null;
  draftNightGrade: string | null;
  keeper: boolean;
}

/** Full league draft history with VOE regrade and Draft Night Grade for
 * every pick where grades have been computed. Empty (or partially empty)
 * boards are returned for seasons that don't have draft data yet rather
 * than filtering them out. */
export async function getDraftBoard(): Promise<DraftBoardPick[]> {
  const supabase = createClient();
  const [
    { data: seasons, error: seasonsErr },
    { data: picks, error: picksErr },
    { data: players, error: playersErr },
    { data: franchises, error: franchisesErr },
    { data: teams, error: teamsErr },
  ] = await Promise.all([
    supabase.from("seasons").select("id, year"),
    supabase
      .from("draft_picks")
      .select("id, season_id, round, pick_in_round, overall_pick, team_id, player_id, keeper"),
    supabase.from("players").select("id, full_name, position, nfl_team"),
    supabase.from("franchises").select("id, display_name"),
    supabase.from("teams").select("id, franchise_id, season_id"),
  ]);
  if (seasonsErr) throw seasonsErr;
  if (picksErr) throw picksErr;
  if (playersErr) throw playersErr;
  if (franchisesErr) throw franchisesErr;
  if (teamsErr) throw teamsErr;

  const yearBySeasonId = new Map((seasons ?? []).map((s) => [s.id, s.year]));
  const playerById = new Map((players ?? []).map((p) => [p.id, p]));
  const nameByFranchiseId = new Map((franchises ?? []).map((f) => [f.id, f.display_name]));
  const franchiseByTeamId = new Map((teams ?? []).map((t) => [t.id, t.franchise_id]));

  const { data: grades, error: gradesErr } = await supabase
    .from("draft_pick_grades")
    .select("draft_pick_id, season_points, voe, regrade_grade, adp_at_pick, draft_night_grade");
  if (gradesErr) throw gradesErr;
  const gradeByPickId = new Map((grades ?? []).map((g) => [g.draft_pick_id, g]));

  return (picks ?? [])
    .map((p) => {
      const player = p.player_id ? playerById.get(p.player_id) : null;
      const franchiseId = franchiseByTeamId.get(p.team_id) ?? "";
      const grade = gradeByPickId.get(p.id);
      return {
        year: yearBySeasonId.get(p.season_id) ?? 0,
        round: p.round,
        pickInRound: p.pick_in_round,
        overallPick: p.overall_pick,
        franchiseId,
        managerName: nameByFranchiseId.get(franchiseId) ?? "Unknown",
        playerName: player?.full_name ?? null,
        playerId: p.player_id,
        position: player?.position ?? null,
        nflTeam: player?.nfl_team ?? null,
        seasonPoints: grade?.season_points ?? null,
        voe: grade?.voe ?? null,
        regradeGrade: grade?.regrade_grade ?? null,
        adpAtPick: grade?.adp_at_pick ?? null,
        draftNightGrade: grade?.draft_night_grade ?? null,
        keeper: p.keeper,
      };
    })
    .sort((a, b) => a.year - b.year || a.overallPick - b.overallPick);
}

export interface LeagueAward {
  id: string;
  year: number | null;
  title: string;
  note: string | null;
  franchiseId: string | null;
  managerName: string | null;
}

/** League awards and recognitions, newest first. The `awards` table is
 * intended for commissioner-entered honors that don't fit a record query
 * (e.g. "Sacko for worst draft", "Most Improved"). */
export async function getAwards(): Promise<LeagueAward[]> {
  const supabase = createClient();
  const { data: awards, error } = await supabase
    .from("awards")
    .select("id, season_id, title, note, franchise_id");
  if (error) throw error;

  const seasonIds = [...new Set((awards ?? []).map((a) => a.season_id).filter((id): id is string => id != null))];
  const franchiseIds = [...new Set((awards ?? []).map((a) => a.franchise_id).filter((id): id is string => id != null))];

  const [seasonsRes, franchisesRes] = await Promise.all([
    supabase.from("seasons").select("id, year").in("id", seasonIds.length > 0 ? seasonIds : [""]),
    supabase.from("franchises").select("id, display_name").in("id", franchiseIds.length > 0 ? franchiseIds : [""]),
  ]);
  if (seasonsRes.error) throw seasonsRes.error;
  if (franchisesRes.error) throw franchisesRes.error;

  const yearBySeasonId = new Map((seasonsRes.data ?? []).map((s) => [s.id, s.year]));
  const nameByFranchiseId = new Map((franchisesRes.data ?? []).map((f) => [f.id, f.display_name]));

  return (awards ?? [])
    .map((a) => ({
      id: a.id,
      year: a.season_id ? (yearBySeasonId.get(a.season_id) ?? null) : null,
      title: a.title,
      note: a.note,
      franchiseId: a.franchise_id,
      managerName: a.franchise_id ? (nameByFranchiseId.get(a.franchise_id) ?? null) : null,
    }))
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
}

export interface FoundingSeason {
  year: number;
  format: SeasonFormat;
  standings: TeamSeasonRecord[];
  champion: TeamSeasonRecord | null;
  note: string;
}

export interface WeekRecapMatchup {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  winner: string;
  margin: number;
  isPlayoff: boolean;
}

export interface WeekRecap {
  year: number;
  week: number;
  matchups: WeekRecapMatchup[];
  highestScorer: { team: string; score: number } | null;
  biggestBlowout: WeekRecapMatchup | null;
  closestGame: WeekRecapMatchup | null;
  unluckiestLoss: { team: string; score: number; opponent: string; opponentScore: number } | null;
}

/** Get a weekly recap from stored matchups. Highlights are computed from
 * the scores already in the database (see AGENTS.md: scoring is data, never
 * code). If no matchups are found, returns an empty recap. */
export async function getWeekRecap(year: number, week: number): Promise<WeekRecap> {
  const seasonId = await getSeasonId(year);
  const empty: WeekRecap = {
    year,
    week,
    matchups: [],
    highestScorer: null,
    biggestBlowout: null,
    closestGame: null,
    unluckiestLoss: null,
  };
  if (!seasonId) return empty;

  const supabase = createClient();
  const [
    { data: matchups, error: matchupsErr },
    { data: teams, error: teamsErr },
    { data: franchises, error: franchisesErr },
  ] = await Promise.all([
    supabase
      .from("matchups")
      .select("home_team_id, away_team_id, home_score, away_score, is_playoff, playoff_bracket")
      .eq("season_id", seasonId)
      .eq("week", week)
      .order("id"),
    supabase.from("teams").select("id, franchise_id, name").eq("season_id", seasonId),
    supabase.from("franchises").select("id, display_name"),
  ]);
  if (matchupsErr) throw matchupsErr;
  if (teamsErr) throw teamsErr;
  if (franchisesErr) throw franchisesErr;

  const nameByFranchiseId = new Map((franchises ?? []).map((f) => [f.id, f.display_name]));
  const franchiseByTeamId = new Map((teams ?? []).map((t) => [t.id, t.franchise_id]));
  const teamNameById = new Map((teams ?? []).map((t) => [t.id, t.name]));

  function teamName(teamId: string) {
    const franchiseId = franchiseByTeamId.get(teamId);
    if (franchiseId) return nameByFranchiseId.get(franchiseId) ?? teamNameById.get(teamId) ?? "Unknown";
    return teamNameById.get(teamId) ?? "Unknown";
  }

  const normalized: WeekRecapMatchup[] = (matchups ?? [])
    .filter((m) => m.home_team_id && m.away_team_id)
    .map((m) => {
      const homeScore = Number(m.home_score ?? 0);
      const awayScore = Number(m.away_score ?? 0);
      const margin = Math.abs(homeScore - awayScore);
      const winner = homeScore > awayScore ? teamName(m.home_team_id) : awayScore > homeScore ? teamName(m.away_team_id) : "Tie";
      return {
        homeTeam: teamName(m.home_team_id),
        awayTeam: teamName(m.away_team_id),
        homeScore,
        awayScore,
        margin,
        winner,
        isPlayoff: m.is_playoff ?? false,
      };
    });

  if (normalized.length === 0) return empty;

  let highestScorer: { team: string; score: number } | null = null;
  let unluckiestLoss: { team: string; score: number; opponent: string; opponentScore: number } | null = null;
  for (const m of normalized) {
    for (const [team, score, opponent, opponentScore] of [
      [m.homeTeam, m.homeScore, m.awayTeam, m.awayScore] as const,
      [m.awayTeam, m.awayScore, m.homeTeam, m.homeScore] as const,
    ]) {
      if (score > (highestScorer?.score ?? -Infinity)) {
        highestScorer = { team, score };
      }
      if (score < opponentScore && score > (unluckiestLoss?.score ?? -Infinity)) {
        unluckiestLoss = { team, score, opponent, opponentScore };
      }
    }
  }

  const sortedByMargin = [...normalized].sort((a, b) => b.margin - a.margin);
  const biggestBlowout = sortedByMargin[0] ?? null;
  const decidedGames = normalized.filter((m) => m.margin > 0);
  const closestGame = decidedGames.sort((a, b) => a.margin - b.margin)[0] ?? null;

  return {
    year,
    week,
    matchups: normalized,
    highestScorer,
    biggestBlowout,
    closestGame,
    unluckiestLoss,
  };
}

export async function getSeasonWeeks(year: number): Promise<number[]> {
  const seasonId = await getSeasonId(year);
  if (!seasonId) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("matchups")
    .select("week")
    .eq("season_id", seasonId)
    .order("week");
  if (error) throw error;
  return [...new Set((data ?? []).map((m) => m.week))].sort((a, b) => a - b);
}

/** 2023 founding season, deliberately isolated from all-time records.
 * The same stored data as any other season, but returned with the explicit
 * caveat that the format and scoring rules were materially different (8
 * teams, 6 playoff spots, no keepers). */
export async function getFoundingSeason(): Promise<FoundingSeason | null> {
  const year = 2023;
  const [format, standings] = await Promise.all([getFormat(year), getStandings(year)]);
  if (standings.length === 0) return null;
  return {
    year,
    format: format ?? { teamCount: 8, matchupPeriodCount: 14, playoffTeamCount: 6, divisions: [], playoffMatchupPeriodLength: null, draftType: null, keeperCount: 0 },
    standings,
    champion: standings.find((t) => t.finalRank === 1) ?? null,
    note:
      "The league's first season. Eight teams, six playoff spots, and scoring settings that differed from every season after it. It is preserved as founding history but is intentionally excluded from all-time record comparisons.",
  };
}
