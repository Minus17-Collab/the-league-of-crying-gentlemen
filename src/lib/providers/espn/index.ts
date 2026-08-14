import "server-only";
import type {
  NormalizedDraftPick,
  NormalizedMatchup,
  NormalizedPlayer,
  NormalizedRosterEntry,
  NormalizedStatLine,
  NormalizedTeam,
  NormalizedTransaction,
  StatProvider,
} from "../types";
import {
  fetchEspnViews,
  pingEspnCredentials,
  unwrapLeagueHistoryResponse,
} from "./client";
import { espnLeagueResponseSchema, type EspnLeagueResponse } from "./schemas";
import {
  normalizeDraftPicks,
  normalizeMatchups,
  normalizePlayersFromRosterEntries,
  normalizeRosterEntries,
  normalizeTeams,
  normalizeTransactions,
} from "./normalize";
import { mapEspnStatId } from "./mappings";

async function fetchAndValidate(
  year: number,
  views: string[],
): Promise<EspnLeagueResponse> {
  const result = await fetchEspnViews(year, views);
  const unwrapped = unwrapLeagueHistoryResponse(result.raw);
  return espnLeagueResponseSchema.parse(unwrapped);
}

/** All roster entries across both sides of every matchup in a schedule. */
function allRosterEntries(league: EspnLeagueResponse) {
  const out: {
    externalTeamId: string;
    playerId: number;
    lineupSlotId: number;
    playerPoolEntry?: {
      player?: {
        fullName: string;
        defaultPositionId?: number;
        proTeamId?: number;
        stats: { scoringPeriodId: number; statSourceId?: number; stats: Record<string, number> }[];
      };
    };
  }[] = [];

  for (const matchup of league.schedule) {
    for (const side of [matchup.home, matchup.away]) {
      if (!side?.rosterForCurrentScoringPeriod) continue;
      for (const entry of side.rosterForCurrentScoringPeriod.entries) {
        out.push({ externalTeamId: String(side.teamId), ...entry });
      }
    }
  }
  return out;
}

export class EspnStatProvider implements StatProvider {
  name = "espn";

  async fetchPlayers(): Promise<NormalizedPlayer[]> {
    const currentYear = new Date().getFullYear();
    const league = await fetchAndValidate(currentYear, ["mRoster"]);
    const { players, unmappedPositionIds } = normalizePlayersFromRosterEntries(
      allRosterEntries(league),
    );
    if (unmappedPositionIds.length > 0) {
      console.warn(
        `[espn provider] unmapped defaultPositionId values: ${[...new Set(unmappedPositionIds)].join(", ")}. ` +
          "Add them to ESPN_POSITION_MAP in lib/providers/espn/mappings.ts.",
      );
    }
    return players;
  }

  async fetchWeeklyStats(
    year: number,
    week: number,
  ): Promise<NormalizedStatLine[]> {
    const league = await fetchAndValidate(year, ["mBoxscore"]);
    const lines: NormalizedStatLine[] = [];
    const unmappedStatIds = new Set<number>();

    for (const entry of allRosterEntries(league)) {
      const player = entry.playerPoolEntry?.player;
      if (!player) continue;

      const weekStats = player.stats.find(
        (s) => s.scoringPeriodId === week && s.statSourceId === 0,
      );
      if (!weekStats) continue;

      for (const [statIdRaw, value] of Object.entries(weekStats.stats)) {
        const statId = Number(statIdRaw);
        const statKey = mapEspnStatId(statId);
        if (statKey === null) {
          unmappedStatIds.add(statId);
          continue;
        }
        lines.push({
          externalPlayerId: String(entry.playerId),
          year,
          week,
          statKey,
          value,
        });
      }
    }

    if (unmappedStatIds.size > 0) {
      console.warn(
        `[espn provider] unmapped statId values for ${year} week ${week}: ${[...unmappedStatIds].join(", ")}. ` +
          "See lib/providers/espn/mappings.ts ESPN_STAT_ID_TO_KEY — these stat lines were skipped, not guessed.",
      );
    }

    return lines;
  }

  async fetchTeams(year: number): Promise<NormalizedTeam[]> {
    const league = await fetchAndValidate(year, ["mTeam"]);
    return normalizeTeams(league, year);
  }

  async fetchMatchups(year: number): Promise<NormalizedMatchup[]> {
    const league = await fetchAndValidate(year, ["mMatchup"]);
    return normalizeMatchups(league, year);
  }

  async fetchRosters(
    year: number,
    week: number,
  ): Promise<NormalizedRosterEntry[]> {
    const league = await fetchAndValidate(year, ["mRoster"]);
    const out: NormalizedRosterEntry[] = [];
    const unmappedSlotIds = new Set<number>();

    for (const matchup of league.schedule.filter(
      (m) => m.matchupPeriodId === week,
    )) {
      for (const side of [matchup.home, matchup.away]) {
        if (!side?.rosterForCurrentScoringPeriod) continue;
        const { entries, unmappedSlotIds: unmapped } = normalizeRosterEntries(
          side.rosterForCurrentScoringPeriod.entries,
          String(side.teamId),
          year,
          week,
        );
        out.push(...entries);
        unmapped.forEach((id) => unmappedSlotIds.add(id));
      }
    }

    if (unmappedSlotIds.size > 0) {
      console.warn(
        `[espn provider] unmapped lineupSlotId values: ${[...unmappedSlotIds].join(", ")}. ` +
          "Add them to ESPN_LINEUP_SLOT_MAP in lib/providers/espn/mappings.ts.",
      );
    }

    return out;
  }

  async fetchDraftPicks(year: number): Promise<NormalizedDraftPick[]> {
    const league = await fetchAndValidate(year, ["mDraftDetail"]);
    return normalizeDraftPicks(league, year);
  }

  async fetchTransactions(year: number): Promise<NormalizedTransaction[]> {
    const league = await fetchAndValidate(year, ["mTransactions2"]);
    return normalizeTransactions(league, year);
  }

  async fetchAvailableSeasons(): Promise<number[]> {
    const currentYear = new Date().getFullYear();
    const league = await fetchAndValidate(currentYear, ["mSettings"]);
    const previous = league.status?.previousSeasons ?? [];
    return [...new Set([currentYear, ...previous])].sort((a, b) => b - a);
  }

  async checkCredentials(): Promise<boolean> {
    const currentYear = new Date().getFullYear();
    return pingEspnCredentials(currentYear);
  }
}

export function createEspnProvider(): StatProvider {
  return new EspnStatProvider();
}
