# Memory Tracker — Fantasy Football Website

Central registry for persistent knowledge assets in this repo. Devin CLI has no
memory store, so everything here is file-based and version controlled.

## Workflows

| File | Purpose | Trigger |
|------|---------|---------|
| `.devin/workflows/lessons-learned.md` | Post-session review and knowledge capture | "run lessons learned", "run a lessons learned", "run the standard lessons learned" |

## Rules

| File | Scope | Tags | Created |
|------|-------|------|---------|
| `.devin/rules/ci-and-deploy.md` | GitHub Actions, Pages deploy, cron, env-var contexts | pitfall, workflow, reference | 2026-08-28 |
| `.devin/fix-log.md` | Defect log — symptom, root cause, fix, verification | pitfall, log | 2026-08-28 |
| `AGENTS.md` (repo root) | Architecture invariants, scoring/schema/auth rules | pattern, reference | pre-existing |

## Skills

*None yet.*

## Key references captured

| Item | Value | Source |
|------|-------|--------|
| Actions `vars` | `NEXT_PUBLIC_SUPABASE_URL`, `ESPN_LEAGUE_ID` | `113543e` |
| Actions `secrets` | `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ESPN_SWID`, `ESPN_S2` | `113543e` |
| Node floor | 22 (pnpm 11.21.0 requires >= 22.13) | `01379e7` |
| Custom domain | thecryinggents.org (CNAME written in `deploy.yml`) | `d38101e` |
| Sync schedule | Tue 10pm US Eastern, dual UTC cron + hour guard | `5dd17a0` |
| Seasons in DB | 2023, 2024, 2025; 2023 excluded from records (8 teams, different scoring) | `~/.devin/plans/plan-5d0752e042f87998.md` |

## Defects

Tracked in `.devin/fix-log.md`. FIX-001 through FIX-006 are all DONE as of
2026-08-28 (stale RUNBOOK env-var/route/schedule guidance, an uninstallable
documented command, scratch-file gitignore, `@types/node` bump). One item is
noted without action: the untracked `Manager Photos/` directory.

Pattern worth remembering: five of the six defects were **documentation that a
correct code fix left behind**. When a fix changes an env var, a schedule, or
deletes a route, grep the Markdown in the same commit.

## Related external assets

The originating workflow definition and a larger knowledge base live in
`CascadeProjects/FoundryAI/FoundryMCP/Bryan-Jarvis/.devin/` and `.windsurf/`
(see its own `memory-tracker.md`). That workspace uses Windsurf memories;
this one is files-only.

---

*Last updated: 2026-08-28*
