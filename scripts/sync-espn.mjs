// Weekly sync job (see AGENTS.md "Call a stat provider from a React
// component or page. Sync jobs only." and ROADMAP.md Phase 2.3).
//
// Runs as a scheduled GitHub Actions job (.github/workflows/sync.yml),
// not a Next.js Route Handler — the site is statically exported to
// GitHub Pages, which has no server runtime to host a route handler.
//
// Sequence:
//  1. Check ESPN credentials. On failure, log a failed sync_runs row
//     and stop — never silently serve stale data.
//  2. Fetch current-season matchups/rosters/transactions.
//  3. Re-fetch the two most recent weeks (stat corrections land for
//     several days after games).
//  4. Write normalized rows (idempotent) and a sync_runs row.
//
// This is a skeleton: player/team ID resolution (Phase 2.2) and the
// actual upsert logic are not yet implemented. It authenticates and
// logs to sync_runs but does not yet write gameplay data.
//
// Run with:
//   node --env-file=.env.local scripts/sync-espn.mjs

import { createClient } from "@supabase/supabase-js";

const LEAGUE_ID = process.env.ESPN_LEAGUE_ID ?? "771894515";
const SWID = process.env.ESPN_SWID;
const S2 = process.env.ESPN_S2;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

/** One lightweight authenticated call. Resolves false on auth failure (e.g. HTTP 401). */
async function checkEspnCredentials() {
  if (!SWID || !S2) {
    console.error("ESPN_SWID / ESPN_S2 must be set in the environment.");
    return false;
  }
  const year = new Date().getFullYear();
  const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leagues/${LEAGUE_ID}?view=mSettings`;
  const res = await fetch(url, {
    headers: { Cookie: `SWID=${SWID}; espn_s2=${S2}` },
  });
  return res.ok;
}

async function main() {
  const startedAt = new Date().toISOString();

  const credentialsOk = await checkEspnCredentials();
  if (!credentialsOk) {
    await supabase.from("sync_runs").insert({
      provider: "espn",
      scope: "credential-check",
      status: "failed",
      message:
        "ESPN credentials rejected (401). Cookies likely expired — see RUNBOOK.md.",
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });
    console.error("Sync failed: ESPN credential check failed.");
    process.exit(1);
  }

  // TODO (Phase 2.2 / 2.3): resolve current season + week, fetch
  // matchups/rosters/transactions for it and the prior week, resolve
  // external IDs to internal player_id/team_id, and upsert into
  // matchups / lineup_entries / transactions / stat_lines. Record the
  // outcome in sync_runs regardless of success or partial failure.

  await supabase.from("sync_runs").insert({
    provider: "espn",
    scope: "credential-check",
    status: "success",
    message: "Credential check passed. Data sync not yet implemented.",
    started_at: startedAt,
    finished_at: new Date().toISOString(),
  });
  console.log("Sync ok: credential check passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
