# AGENTS.md

Fantasy football league platform. Mirrors an ESPN league in 2026, replaces it in 2027.

## Priorities (in order — when these conflict, lower number wins)

1. Scoring correctness. A wrong score is worse than a missing feature.
2. Schema invariants (see "Never do this"). Violations are expensive to unwind.
3. Type safety. No `any`. No unchecked casts.
4. Shipping speed.

## Stack

- Next.js 15+ (App Router), TypeScript strict mode
- Supabase (Postgres + Auth + RLS)
- Vercel (hosting + cron)
- Tailwind CSS
- Vitest for unit tests, Playwright for e2e

## Commands

```bash
pnpm dev            # local dev server
pnpm build          # production build — must pass before any PR
pnpm test           # unit tests
pnpm test:e2e       # playwright
pnpm lint           # eslint, zero warnings allowed
pnpm typecheck      # tsc --noEmit
pnpm db:migrate     # apply migrations to Supabase
pnpm db:types       # regenerate TS types from schema — run after every migration
```

Before finishing any task: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` must all pass.

## Architecture invariants

### 1. Scoring is data, never code

Fantasy points are computed by joining `stat_lines` against `scoring_rules` for
that season. There is exactly one scoring function:

```ts
// lib/scoring/engine.ts
computePoints(statLines: StatLine[], rules: ScoringRule[]): number
```

- No scoring logic anywhere else in the codebase.
- No hardcoded point values. Not in constants, not in defaults, not in seed
  files outside `supabase/seed/`.
- Adding a scoring category = an INSERT into `stat_categories` + `scoring_rules`.
  If a feature request seems to require changing `engine.ts`, stop and flag it.

### 2. Stat providers are swappable

All external stat data enters through one interface:

```ts
// lib/providers/types.ts
interface StatProvider {
  name: string;
  fetchWeeklyStats(year: number, week: number): Promise<NormalizedStatLine[]>;
  fetchPlayers(): Promise<NormalizedPlayer[]>;
}
```

- Implementations live in `lib/providers/{espn,sleeper,tank01}/`.
- Provider-specific field names, ID formats, and quirks stay inside that folder.
- Nothing outside `lib/providers/` may import a provider directly. Use the
  factory in `lib/providers/index.ts`, selected via `STAT_PROVIDER` env var.
- Provider player IDs go in `player_external_ids`, never in `players` or
  `stat_lines`.

### 3. Franchises vs teams

- `franchises` = permanent identity across all seasons. All-time records,
  head-to-head history, and user ownership attach here.
- `teams` = one season's name/logo/record. Disposable.
- Any query spanning more than one season must join through `franchise_id`.
  Joining on team name or `team.id` across seasons is a bug.

### 4. Seasons are immutable once locked

When `seasons.is_locked = true`, that season's matchups, lineups, and scores
are read-only. Historical scores must never change because a scoring rule was
edited later — rules are season-scoped for exactly this reason.

## Database

- Schema of record is `supabase/migrations/`. Never edit tables via the
  Supabase dashboard.
- Every migration is additive where possible. Destructive changes require an
  explicit note in the PR body.
- RLS is on for every table. Default deny.
- Regenerate types after every migration: `pnpm db:types`.

## Auth model

- Supabase Auth, email magic link. No password flows.
- A user is linked to a franchise via `franchises.owner_user_id`.
- Three roles: `member` (own team), `commissioner` (all teams, settings),
  `viewer` (public read).
- League history pages are public read. Everything else requires auth.

## Never do this

- Hardcode a point value, roster slot count, or record definition.
- Put a provider's player ID in `stat_lines` or `players`.
- Query across seasons via `teams` instead of `franchises`.
- Mutate a locked season's data.
- Call a stat provider from a React component or page. Sync jobs only.
- Commit secrets. `SUPABASE_SERVICE_ROLE_KEY` is server-side only and must
  never appear in a file under `app/` that lacks `"use server"` or lives in
  `app/api/`.
- Use `any`, `@ts-ignore`, or non-null assertions to silence the compiler.
- Add a dependency without noting why in the PR body.

## Conventions

- Server Components by default. `"use client"` only when you need interactivity.
- Data fetching in Server Components or Route Handlers, never `useEffect`.
- Zod-validate every external payload — provider responses and form input both.
- Money/points: `numeric` in Postgres, `number` in TS, always round for display
  only, never in storage.
- Dates stored UTC, displayed in US Eastern (NFL scheduling default).

## When requirements are ambiguous

Ask before implementing. Do not guess at league rules, scoring values, or
roster configuration — these are league-specific and wrong guesses silently
corrupt data. Flag the ambiguity and stop.
