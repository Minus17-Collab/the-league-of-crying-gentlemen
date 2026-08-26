# RUNBOOK

Operational guide for running and maintaining the league platform. See
`AGENTS.md` for architecture invariants and `ROADMAP.md` for the build
plan and current phase status.

## First-time setup

1. **Supabase project**
   - Create an account at supabase.com and a new project.
   - Copy the project URL, anon key, and service-role key into `.env.local`
     (copy from `.env.example` first — never commit `.env.local`).
   - Install the Supabase CLI and run `supabase login`, then
     `supabase link --project-ref <your-project-ref>` from the repo root.
   - Apply migrations: `pnpm db:migrate` (runs `supabase db push`).
   - Regenerate types: `pnpm db:types`.

2. **GitHub repo**
   - Create a new private repo on GitHub.
   - From the repo root: `git remote add origin <repo-url>`, then
     `git push -u origin main`.

3. **GitHub Pages + Actions**
   - Repo Settings → Pages: source = GitHub Actions, custom domain =
     `thecryinggents.org` (DNS + HTTPS cert are already provisioned).
   - Add the `.env.example` variables as repo secrets (Settings →
     Secrets and variables → Actions): `NEXT_PUBLIC_SUPABASE_URL`,
     `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
     `ESPN_SWID`, `ESPN_S2`. `ESPN_LEAGUE_ID` can be a repo variable
     (not secret).
   - `.github/workflows/deploy.yml` builds the static export and
     publishes it to Pages on every push to `main`.
   - `.github/workflows/sync.yml` runs `scripts/sync-espn.mjs` on the
     same weekly schedule the old `vercel.json` cron used.

4. **ESPN credentials** (private league)
   - Log into fantasy.espn.com in a browser, open devtools → Application →
     Cookies, and copy the `SWID` (including its literal braces) and
     `espn_s2` values.
   - Set `ESPN_SWID` and `ESPN_S2` in `.env.local` and as repo secrets
     (Settings → Secrets and variables → Actions).

## Refreshing ESPN cookies

ESPN's `SWID`/`espn_s2` cookies expire roughly annually with no warning.
If `pnpm exec tsx -e "import('./src/lib/providers/espn/check-credentials').then(m=>m.checkEspnCredentials().then(console.log))"`
(or the weekly cron job) reports a credential failure:

1. Re-extract `SWID` and `espn_s2` from a fresh, logged-in browser session.
2. Update `ESPN_SWID` / `ESPN_S2` in the repo's Actions secrets.
3. Re-run the failed sync manually via the "ESPN sync" workflow's
   "Run workflow" button (or wait for the next scheduled run).

## Re-running the backfill

Not yet implemented as a standalone script (see `ROADMAP.md` Phase 2).
Once built, this section will cover re-running a full historical
backfill safely (idempotent, safe to re-run).

## Adding a new season

1. Confirm the season appears in `fetchAvailableSeasons()` (backed by
   ESPN's `previousSeasons` in `mSettings`).
2. Insert a `seasons` row (or let the sync job do it, once implemented).
3. Insert that season's `scoring_rules` and `roster_slots` — do not copy
   silently from a prior season if anything changed; confirm with the
   league owner.
4. Run the backfill for that season.

## Editing manager data (`franchises` table)

Manager lifecycle fields are commissioner-edited, not auto-synced:

- **Add a retirement:** set `status = 'retired'` and `retired_season` on
  the franchise row. All historical records, banners, and rivalries stay
  attached — the UI marks them as retired rather than hiding them.
- **Add a new manager:** insert a `franchises` row with their ESPN owner
  GUID in `espn_owner_ids`.
- **Merge a duplicate GUID** (manager rejoined under a new ESPN account):
  append the new GUID to the existing franchise's `espn_owner_ids` array
  rather than creating a second franchise row.
- Any ESPN owner GUID encountered during sync that isn't in any
  franchise's `espn_owner_ids` is a hard ingest error — add it before
  re-running the sync.

## Running the end-of-season grading job

Not yet implemented (see `ROADMAP.md` Phase 3.5.2 / 3.5.3). Will run
once a season's `is_locked` flag is set to `true`.

## When the cron reports stale data

The `/api/cron/sync` job checks ESPN credentials first and writes a
`failed` row to `sync_runs` without touching gameplay data if the check
fails. To recover:

1. Check the latest `sync_runs` row for the failure message.
2. If it's a credential failure, follow "Refreshing ESPN cookies" above.
3. Re-trigger the sync manually (Actions tab → "ESPN sync" →
   Run workflow) or wait for the next scheduled run.

## Commands reference

See `AGENTS.md` "Commands" for the full list (`pnpm dev`, `pnpm build`,
`pnpm test`, `pnpm test:e2e`, `pnpm lint`, `pnpm typecheck`,
`pnpm db:migrate`, `pnpm db:types`).
