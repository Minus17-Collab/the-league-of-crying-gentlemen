# Rule: CI, Actions, and GitHub Pages Deploy

## Purpose
Every pitfall in this file was already paid for once as a broken CI run during
the Vercel → GitHub Pages migration (commits `d38101e` → `479b73e`). Read this
before editing anything under `.github/workflows/`.

## When to Apply
- Editing `ci.yml`, `deploy.yml`, or `sync.yml`
- Adding or renaming an environment variable used by a workflow
- Changing the Node or pnpm version
- Adding or changing a scheduled job

## The three workflows

| File | Trigger | Purpose |
|------|---------|---------|
| `ci.yml` | `pull_request` → `main` | Required status check. Mirrors deploy's build job. |
| `deploy.yml` | `push` → `main`, manual | Build static export, publish to Pages. |
| `sync.yml` | 3× weekly cron, manual | `node scripts/sync-espn.mjs`. |

## Requirements

### 1. `vars` vs `secrets` — non-secret config lives in `vars`
Fixed in `113543e`. A missing key in the `secrets` context does **not** fail the
workflow; it silently expands to an empty string, so the build succeeds and
produces a site pointed at `""`.

- `vars`: `NEXT_PUBLIC_SUPABASE_URL`, `ESPN_LEAGUE_ID`
- `secrets`: `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
  `ESPN_SWID`, `ESPN_S2`, `DISCORD_WEBHOOK_URL` (optional, `sync.yml` only —
  see requirement 8)

When you move a value between the two contexts, update **all three** workflows
*and* the "GitHub Pages + Actions" section of `RUNBOOK.md` in the same commit.

### 2. Node 22 is a floor, not a preference
Fixed in `01379e7`. `package.json` pins `packageManager: pnpm@11.21.0`, and
pnpm 11 requires Node >= 22.13. All three workflows must set
`node-version: 22`. Anything lower fails at `pnpm install`.

Note: `devDependencies` still carries `@types/node: ^20` while the runtime is
22. Bump deliberately if you start using Node 22-only APIs.

### 3. `pnpm typecheck` must run `next typegen` first
Fixed in `dde0228`. `pnpm typecheck` is `next typegen && tsc --noEmit`. Next 16
generates `LayoutProps`/`PageProps` into `.next/types`, which is gitignored, so
a clean checkout (i.e. every CI run) has no such types until typegen runs.
Never "simplify" this script back to a bare `tsc --noEmit`.

### 4. Cron is UTC and ignores DST — use the dual-schedule + guard pattern
From `5dd17a0`. GitHub Actions cron has no timezone support, so a fixed UTC
time drifts an hour twice a year against the US Eastern convention this project
uses for NFL scheduling.

The pattern: register both UTC offsets per target time, then no-op the runs
that land on the wrong offset. `sync.yml` currently targets three ET
slots/week (Fri 6am, Mon 1am, Tue 1am), so it's six cron lines guarded by one
day+hour check:

```yaml
on:
  schedule:
    - cron: "0 10 * * 5"  # 6am EDT Fri (UTC-4)
    - cron: "0 11 * * 5"  # 6am EST Fri (UTC-5)
    - cron: "0 5 * * 1"   # 1am EDT Mon (UTC-4)
    - cron: "0 6 * * 1"   # 1am EST Mon (UTC-5)
    - cron: "0 5 * * 2"   # 1am EDT Tue (UTC-4)
    - cron: "0 6 * * 2"   # 1am EST Tue (UTC-5)
```

```yaml
- name: Skip if not a scheduled Eastern time
  if: github.event_name == 'schedule'
  run: |
    day="$(TZ=America/New_York date +%u)"
    hour="$(TZ=America/New_York date +%H)"
    run=false
    [ "$day" = "5" ] && [ "$hour" = "06" ] && run=true
    [ "$day" = "1" ] && [ "$hour" = "01" ] && run=true
    [ "$day" = "2" ] && [ "$hour" = "01" ] && run=true
    if [ "$run" != "true" ]; then echo "SKIP=true" >> "$GITHUB_ENV"; fi
```

Every subsequent step needs `if: env.SKIP != 'true'`. Adding a step and
forgetting that guard means it runs on every cron firing instead of just the
intended slots. The `workflow_dispatch` path deliberately skips the check.
Adding or moving a target time means adding both UTC-offset cron lines *and*
a `day`/`hour` branch in the guard — the two must stay in sync.

### 5. `ci.yml` and `deploy.yml` duplicate the build job — keep them in sync
`ci.yml` exists so branch protection has a real status check on PRs. It is a
copy of deploy's build job minus the CNAME and Pages-artifact steps. Adding a
check (say, `pnpm test:e2e`) to one and not the other means `main` gets
something that was never gated on a PR.

### 6. Static export has no server runtime
`next.config.ts` sets `output: "export"`. Route Handlers and Server Actions do
not exist at runtime — `src/app/api/cron/sync/route.ts` was deleted in
`d38101e` and replaced by `scripts/sync-espn.mjs` run from Actions. Anything
needing a server is a script invoked by a workflow, not a route.

### 7. Never put `SUPABASE_SERVICE_ROLE_KEY` in a build step
It belongs only to `sync.yml`. `ci.yml` and `deploy.yml` build client-facing
output; a service-role key reaching a `NEXT_PUBLIC_`-adjacent build is a leak.
See AGENTS.md "Never do this".

### 8. GitHub's own notification settings can't be set from a workflow
There is no API to toggle a user's "email me on Actions failure" preference
(Settings → Notifications is web-UI-only) — don't try to script it. Instead,
`sync.yml`'s last two steps post to `secrets.DISCORD_WEBHOOK_URL` — one on
`success()`, one on `failure()` — whenever that secret is set, and no-op (not
a failure) if it isn't. The failure step fires regardless of which prior step
failed — credential check, `pnpm install`, or `sync-espn.mjs` itself exiting
non-zero — because it's gated on `failure()`, not `env.SKIP`. The success step
additionally checks `env.SKIP != 'true'` so the benign DST-offset run that did
nothing doesn't post a "succeeded" message for a sync that never ran.

## Enforcement
- Open a throwaway PR after any workflow edit; `ci.yml` only runs on
  `pull_request`, so pushing to a branch proves nothing.
- After changing an env var, grep for its name across `.github/`, `.env.example`,
  and `*.md` and confirm every hit still agrees.

## Related
- `AGENTS.md` — architecture invariants, secret-handling rules
- `RUNBOOK.md` — operator setup for Pages, Actions secrets, ESPN cookies
- `.devin/workflows/lessons-learned.md`
