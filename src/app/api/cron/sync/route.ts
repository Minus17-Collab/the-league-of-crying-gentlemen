import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getStatProvider } from "@/lib/providers";

/**
 * Weekly sync job (see AGENTS.md "Call a stat provider from a React
 * component or page. Sync jobs only." and ROADMAP.md Phase 2.3).
 * Scheduled via Vercel Cron (vercel.json) — Tuesdays during the NFL
 * season, per the Fantasy League HQ spec §10.
 *
 * Sequence:
 *  1. Check ESPN credentials. On failure, log a failed sync_runs row
 *     and stop — never silently serve stale data.
 *  2. Fetch current-season matchups/rosters/transactions.
 *  3. Re-fetch the two most recent weeks (stat corrections land for
 *     several days after games).
 *  4. Write normalized rows (idempotent) and a sync_runs row.
 *
 * This is a skeleton: player/team ID resolution (Phase 2.2) and the
 * actual upsert logic are not yet implemented. It compiles and
 * authenticates but does not yet write gameplay data.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const provider = getStatProvider();

  const startedAt = new Date().toISOString();

  const credentialsOk = await provider.checkCredentials();
  if (!credentialsOk) {
    await supabase.from("sync_runs").insert({
      provider: provider.name,
      scope: "credential-check",
      status: "failed",
      message: "ESPN credentials rejected (401). Cookies likely expired — see RUNBOOK.md.",
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });
    return NextResponse.json(
      { status: "failed", reason: "credential-check" },
      { status: 502 },
    );
  }

  // TODO (Phase 2.2 / 2.3): resolve current season + week, fetch
  // matchups/rosters/transactions for it and the prior week, resolve
  // external IDs to internal player_id/team_id, and upsert into
  // matchups / lineup_entries / transactions / stat_lines. Record the
  // outcome in sync_runs regardless of success or partial failure.

  await supabase.from("sync_runs").insert({
    provider: provider.name,
    scope: "credential-check",
    status: "success",
    message: "Credential check passed. Data sync not yet implemented.",
    started_at: startedAt,
    finished_at: new Date().toISOString(),
  });

  return NextResponse.json({ status: "ok" });
}
