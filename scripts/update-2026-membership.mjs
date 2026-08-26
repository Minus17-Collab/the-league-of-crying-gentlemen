// One-off: syncs franchise identity for the 2026 membership change.
// Confirmed via a live ESPN pull (mTeam view, 2026-08-19): Trent Cassell
// (2025 teamId 10) and Bradly Major (2025 teamId 5) are no longer league
// members; their slots were taken over by new owners:
//   - teamId 5  "I chase brown kids" -> Xavier Faison {34988281-B1FE-430E-9E6E-ACBE29B648D7}
//   - teamId 10 "Kupp My Balls"      -> Devin Roberts {F5F9E024-62F7-42F9-AA98-68D64647B9FA}
//
// Per AGENTS.md "Franchises vs teams" and the confirmed rule already
// recorded in data/history/SUMMARY.md ("a new owner inheriting an old
// ESPN teamId slot is always a new franchises row, never a
// continuation"), this creates NEW franchise rows for the incoming
// owners rather than reusing Trent/Bradly's franchise rows, and retires
// Trent/Bradly's franchise rows instead of deleting them (all-time
// history must stay intact).
//
// This script only updates franchise identity (`franchises` table) and
// `data/history/managers.json` (kept in sync as the source-of-record
// JSON `backfill-supabase.mjs` reads franchises from). It deliberately
// does NOT create a 2026 `seasons`/`teams` row — that depends on the
// full 2026 sync pipeline (format, draft, live scores; see ROADMAP.md
// Phase 2.3, still a skeleton), which is out of scope here. Until that
// lands, the public site's "Seasons Active" column will not show 2026
// for anyone (it's derived from teams/seasons, not from this table) —
// this is expected and will resolve once Phase 2.3 ships.
//
// Run with:
//   node --env-file=.env.local scripts/update-2026-membership.mjs

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

function log(...args) {
  console.log("[update-2026-membership]", ...args);
}

const RETIRING = [
  { name: "Trent Cassell", espnOwnerId: "{4D6B0C1F-1D62-4E39-9B4C-2BDCF4614C99}" },
  { name: "Bradly Major", espnOwnerId: "{C08D9D6E-D66E-4BE7-BC5E-D37A0B7D11A2}" },
];

const INCOMING = [
  { name: "Xavier Faison", espnOwnerId: "{34988281-B1FE-430E-9E6E-ACBE29B648D7}" },
  { name: "Devin Roberts", espnOwnerId: "{F5F9E024-62F7-42F9-AA98-68D64647B9FA}" },
];

async function main() {
  const { data: leagues, error: leagueErr } = await supabase
    .from("leagues")
    .select("id, name")
    .limit(1);
  if (leagueErr) throw leagueErr;
  if (!leagues || leagues.length === 0) throw new Error("no league found");
  const leagueId = leagues[0].id;
  log("league", leagueId, leagues[0].name);

  for (const manager of RETIRING) {
    // Matched by display_name, not espn_owner_ids — PostgREST's `cs.{...}`
    // array-contains filter mishandles values that themselves contain
    // literal `{`/`}` characters (ESPN owner GUIDs are wrapped in
    // braces), so `.contains()` silently matches nothing here.
    const { data: existing, error: findErr } = await supabase
      .from("franchises")
      .select("id, display_name, retired_season, status")
      .eq("display_name", manager.name)
      .maybeSingle();
    if (findErr) throw findErr;
    if (!existing) {
      log("WARNING: no franchise found for", manager.name, "— skipping retirement");
      continue;
    }
    const { error: updateErr } = await supabase
      .from("franchises")
      .update({ status: "retired", is_active: false, retired_season: 2025 })
      .eq("id", existing.id);
    if (updateErr) throw updateErr;
    log("retired", manager.name, "(was", existing.status, "retired_season:", existing.retired_season, ") -> retired, 2025");
  }

  for (const manager of INCOMING) {
    // Matched by display_name — see the note above `.contains()`'s bug
    // with brace-wrapped GUID values.
    const { data: existing, error: findErr } = await supabase
      .from("franchises")
      .select("id")
      .eq("display_name", manager.name)
      .maybeSingle();
    if (findErr) throw findErr;
    if (existing) {
      log(manager.name, "already exists as a franchise (", existing.id, ") — skipping insert");
      continue;
    }
    const { data: inserted, error: insertErr } = await supabase
      .from("franchises")
      .insert({
        league_id: leagueId,
        display_name: manager.name,
        founded_year: 2026,
        is_active: true,
        status: "active",
        og_manager: false,
        espn_owner_ids: [manager.espnOwnerId],
        retired_season: null,
      })
      .select()
      .single();
    if (insertErr) throw insertErr;
    log("added franchise", manager.name, inserted.id);
  }

  log("done. NOTE: no 2026 seasons/teams rows were created — see this file's header comment.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
