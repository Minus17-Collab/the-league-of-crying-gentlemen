# Fantasy Football League Platform

A league history and scoring platform that mirrors an ESPN league in 2026
and replaces it in 2027. See `AGENTS.md` for architecture invariants and
`ROADMAP.md` for the phased build plan.

## Stack

- Next.js 15+ (App Router), TypeScript strict mode
- Supabase (Postgres + Auth + RLS)
- GitHub Pages (static export) + GitHub Actions (deploy, scheduled ESPN sync)
- Tailwind CSS
- Vitest for unit tests, Playwright for e2e

## Getting Started

1. Copy `.env.example` to `.env.local` and fill in Supabase credentials.
2. Install dependencies and run the dev server:

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Commands

```bash
pnpm dev            # local dev server
pnpm build          # production build — must pass before any PR
pnpm test           # unit tests (Vitest)
pnpm test:e2e       # Playwright
pnpm lint           # eslint, zero warnings allowed
pnpm typecheck      # tsc --noEmit
pnpm db:migrate     # apply migrations to Supabase (requires `supabase link`)
pnpm db:types       # regenerate TS types from schema — run after every migration
```

Before finishing any task: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` must all pass.

## Project structure

- `schema.sql` — schema of record, migrated into `supabase/migrations/` in Phase 0.2.
- `src/lib/supabase/` — browser, server, and service-role Supabase clients.
- `src/lib/providers/` — swappable stat provider implementations (ESPN, Sleeper, Tank01), added in Phase 2.
- `src/lib/scoring/engine.ts` — the one scoring function (Phase 1.1).
- `e2e/` — Playwright specs.
