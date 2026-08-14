import { z } from "zod";

/**
 * Zod schemas for ESPN's undocumented fantasy API (see AGENTS.md
 * "Zod-validate every external payload"). ESPN's JSON is large and
 * only partially stable across seasons — these schemas use
 * `.passthrough()` so unknown fields don't fail validation, and only
 * assert the shape of fields this codebase actually reads.
 *
 * NOTE: field names here are based on the shape documented in the
 * Fantasy League HQ spec and widely-known community reverse-engineering
 * of ESPN's API (e.g. the espn-fantasy-football-api project). They
 * have not yet been verified against a live response from this
 * specific league — verify and adjust once ESPN_SWID/ESPN_S2 are
 * available and the first real fetch runs (see RUNBOOK.md).
 */

export const espnScoringItemSchema = z
  .object({
    statId: z.number(),
    points: z.number().optional(),
    pointsOverrides: z.record(z.string(), z.number()).optional(),
  })
  .passthrough();

export const espnScoringSettingsSchema = z
  .object({
    scoringItems: z.array(espnScoringItemSchema).default([]),
  })
  .passthrough();

export const espnRosterSlotSchema = z
  .object({
    id: z.number(), // lineup slot id, e.g. 0=QB, 2=RB, 23=FLEX, 20=BE, 21=IR
    limit: z.number(),
  })
  .passthrough();

export const espnRosterSettingsSchema = z
  .object({
    lineupSlotCounts: z.record(z.string(), z.number()).default({}),
  })
  .passthrough();

export const espnScheduleSettingsSchema = z
  .object({
    matchupPeriodCount: z.number().optional(),
    playoffTeamCount: z.number().optional(),
    playoffMatchupPeriodLength: z.number().optional(),
  })
  .passthrough();

export const espnSettingsSchema = z
  .object({
    name: z.string().optional(),
    scoringSettings: espnScoringSettingsSchema.optional(),
    rosterSettings: espnRosterSettingsSchema.optional(),
    scheduleSettings: espnScheduleSettingsSchema.optional(),
  })
  .passthrough();

export const espnLeagueStatusSchema = z
  .object({
    previousSeasons: z.array(z.number()).default([]),
    currentMatchupPeriod: z.number().optional(),
    finalScoringPeriod: z.number().optional(),
  })
  .passthrough();

export const espnOwnerSchema = z.string(); // GUID, e.g. "{ABC-123}"

export const espnTeamSchema = z
  .object({
    id: z.number(),
    abbrev: z.string().optional(),
    name: z.string().optional(),
    location: z.string().optional(),
    nickname: z.string().optional(),
    logo: z.string().optional(),
    owners: z.array(espnOwnerSchema).default([]),
    draftDayProjectedRank: z.number().optional(),
  })
  .passthrough();

const espnMatchupSideSchema = z
  .object({
    teamId: z.number(),
    totalPoints: z.number().optional(),
    // Present only when the request includes view=mBoxscore or mRoster.
    rosterForCurrentScoringPeriod: z
      .object({ entries: z.array(z.lazy(() => espnRosterEntrySchema)).default([]) })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const espnMatchupSchema = z
  .object({
    matchupPeriodId: z.number(),
    home: espnMatchupSideSchema.optional(),
    away: espnMatchupSideSchema.optional(),
    playoffTierType: z.string().optional(), // 'NONE' | 'WINNERS_BRACKET' | ...
    winner: z.string().optional(), // 'HOME' | 'AWAY' | 'UNDECIDED'
  })
  .passthrough();

export const espnPlayerStatsEntrySchema = z
  .object({
    scoringPeriodId: z.number(),
    statSourceId: z.number().optional(), // 0 = actual, 1 = projected
    statSplitTypeId: z.number().optional(),
    stats: z.record(z.string(), z.number()).default({}),
  })
  .passthrough();

export const espnPlayerSchema = z
  .object({
    id: z.number(),
    fullName: z.string(),
    defaultPositionId: z.number().optional(),
    proTeamId: z.number().optional(),
    stats: z.array(espnPlayerStatsEntrySchema).default([]),
  })
  .passthrough();

export const espnRosterEntrySchema = z
  .object({
    playerId: z.number(),
    lineupSlotId: z.number(),
    playerPoolEntry: z
      .object({ player: espnPlayerSchema.optional() })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const espnTeamRosterSchema = z
  .object({
    teamId: z.number(),
    entries: z.array(espnRosterEntrySchema).default([]),
  })
  .passthrough();

export const espnDraftPickSchema = z
  .object({
    playerId: z.number(),
    teamId: z.number(),
    roundId: z.number(),
    roundPickNumber: z.number(),
    overallPickNumber: z.number(),
    keeper: z.boolean().optional(),
  })
  .passthrough();

export const espnTransactionSchema = z
  .object({
    id: z.string(),
    type: z.string(),
    status: z.string().optional(),
    scoringPeriodId: z.number().optional(),
    proposedDate: z.number().optional(), // epoch ms
    teamId: z.number().optional(),
    items: z
      .array(
        z
          .object({
            playerId: z.number().optional(),
            type: z.string().optional(),
            fromTeamId: z.number().optional(),
            toTeamId: z.number().optional(),
          })
          .passthrough(),
      )
      .default([]),
  })
  .passthrough();

export const espnLeagueResponseSchema = z
  .object({
    id: z.number().optional(),
    seasonId: z.number().optional(),
    settings: espnSettingsSchema.optional(),
    status: espnLeagueStatusSchema.optional(),
    teams: z.array(espnTeamSchema).default([]),
    schedule: z.array(espnMatchupSchema).default([]),
    draftDetail: z
      .object({ picks: z.array(espnDraftPickSchema).default([]) })
      .passthrough()
      .optional(),
    transactions: z.array(espnTransactionSchema).default([]),
  })
  .passthrough();

export type EspnLeagueResponse = z.infer<typeof espnLeagueResponseSchema>;
