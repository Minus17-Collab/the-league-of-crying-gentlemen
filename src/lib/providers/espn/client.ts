import "server-only";

const BASE_URL = "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl";

export interface EspnCredentials {
  leagueId: string;
  swid?: string;
  espnS2?: string;
}

export function getEspnCredentialsFromEnv(): EspnCredentials {
  const leagueId = process.env.ESPN_LEAGUE_ID;
  if (!leagueId) {
    throw new Error("ESPN_LEAGUE_ID is not set (see .env.example).");
  }
  return {
    leagueId,
    swid: process.env.ESPN_SWID || undefined,
    espnS2: process.env.ESPN_S2 || undefined,
  };
}

function authHeaders(creds: EspnCredentials): HeadersInit {
  if (!creds.swid || !creds.espnS2) return {};
  // The SWID value includes its literal braces, e.g. "{ABC-123}".
  return {
    Cookie: `SWID=${creds.swid}; espn_s2=${creds.espnS2}`,
  };
}

/**
 * Result of a raw ESPN fetch. `raw` is the exact JSON body, unparsed
 * against any schema — callers should archive this verbatim before
 * normalizing (see AGENTS.md-adjacent Fantasy League HQ spec §2:
 * "Raw responses are archived verbatim").
 */
export interface EspnFetchResult {
  url: string;
  status: number;
  raw: unknown;
}

/**
 * Fetches one or more ESPN "views" for a season. Handles the two
 * distinct endpoint shapes:
 *  - current season: .../seasons/{year}/segments/0/leagues/{leagueId}
 *  - historical season: .../leagueHistory/{leagueId}?seasonId={year}
 *    (returns an ARRAY containing one league object, not a bare object)
 *
 * `preferHistorical` lets a caller force the historical endpoint (used
 * once a season is known to be in the past); otherwise this tries the
 * current-season endpoint first and falls back to leagueHistory.
 */
export async function fetchEspnViews(
  year: number,
  views: string[],
  options: { preferHistorical?: boolean } = {},
): Promise<EspnFetchResult> {
  const creds = getEspnCredentialsFromEnv();
  const headers = authHeaders(creds);
  const viewParams = views.map((v) => `view=${v}`).join("&");

  const currentSeasonUrl = `${BASE_URL}/seasons/${year}/segments/0/leagues/${creds.leagueId}?${viewParams}`;
  const historicalUrl = `${BASE_URL}/leagueHistory/${creds.leagueId}?seasonId=${year}&${viewParams}`;

  const urlToTryFirst = options.preferHistorical
    ? historicalUrl
    : currentSeasonUrl;
  const fallbackUrl = options.preferHistorical
    ? currentSeasonUrl
    : historicalUrl;

  const first = await fetch(urlToTryFirst, { headers });
  if (first.ok) {
    return { url: urlToTryFirst, status: first.status, raw: await first.json() };
  }

  const fallback = await fetch(fallbackUrl, { headers });
  return {
    url: fallbackUrl,
    status: fallback.status,
    raw: fallback.ok ? await fallback.json() : null,
  };
}

/**
 * Unwraps the leagueHistory endpoint's array-of-one shape into the
 * same bare-object shape the current-season endpoint returns.
 */
export function unwrapLeagueHistoryResponse(raw: unknown): unknown {
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw;
}

/**
 * One lightweight authenticated call. Used by check-credentials.ts to
 * detect expired ESPN cookies (they expire roughly annually with no
 * warning — see spec §4.3) before a scheduled sync trusts the result.
 */
export async function pingEspnCredentials(year: number): Promise<boolean> {
  const creds = getEspnCredentialsFromEnv();
  const headers = authHeaders(creds);
  const url = `${BASE_URL}/seasons/${year}/segments/0/leagues/${creds.leagueId}?view=mSettings`;
  const res = await fetch(url, { headers });
  return res.status !== 401;
}
