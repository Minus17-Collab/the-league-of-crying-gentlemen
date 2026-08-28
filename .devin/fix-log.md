# Fix Log

Defects found during the 2026-08-28 lessons-learned review
(`.devin/workflows/lessons-learned.md`). Each entry records the symptom, the
root cause, the fix, and verification.

Status legend: `OPEN` → `IN PROGRESS` → `DONE`

Verification gate for this batch (all four required by `AGENTS.md`):

```
pnpm typecheck   ✓ pass
pnpm lint        ✓ pass (--max-warnings 0)
pnpm test        ✓ pass (74 tests, 4 files)
pnpm build       ✓ pass (26 static pages exported)
```

---

## FIX-001 — RUNBOOK tells operators to put a `vars` value in `secrets`

**Severity:** High — reproduces a bug that was already fixed once.

**Symptom:** `RUNBOOK.md` "GitHub Pages + Actions" instructed the operator to
add `NEXT_PUBLIC_SUPABASE_URL` to Actions **Secrets**. All three workflows read
it from the **`vars`** context (`113543e`). A missing key in a context expands
to an empty string rather than failing, so an operator who followed the runbook
got a green build serving a site pointed at `""`.

**Root cause:** `113543e` fixed the workflows but not the documentation.

**Fix:** Rewrote the bullet to split the values across the **Variables** and
**Secrets** tabs explicitly, with a note on why the split is load-bearing
(silent empty-string expansion). `RUNBOOK.md` step 3.

**Status:** DONE — 2026-08-28

---

## FIX-002 — RUNBOOK references a deleted route handler

**Severity:** Medium — sent the operator to a file that does not exist.

**Symptom:** "When the cron reports stale data" described `/api/cron/sync`.
`src/app/api/cron/sync/route.ts` was deleted in `d38101e`; the site is a static
export with no server runtime, and the job is now `scripts/sync-espn.mjs`
driven by `.github/workflows/sync.yml`. Confirmed no route handler exists
anywhere under `src/`.

**Fix:** Repointed the section at `scripts/sync-espn.mjs` / the "ESPN sync"
workflow. `RUNBOOK.md` "When the cron reports stale data".

**Status:** DONE — 2026-08-28

---

## FIX-003 — Commit-message scratch files are untracked and not ignored

**Severity:** Low — risk of committing scratch content.

**Symptom:** `.git-commit-msg.txt` was the only entry in `git status`. Sibling
scratch files (`.git-commit-msg-ci.txt`, `.branch-protection.json`) have been
used and deleted before, so this recurs.

**Fix:** Added a "local scratch files" block to `.gitignore` covering
`.git-commit-msg*.txt` and `.branch-protection.json`.

**Verified:** `git check-ignore -v .git-commit-msg.txt` →
`.gitignore:28:.git-commit-msg*.txt`. Working tree is now clean apart from
intended changes.

**Status:** DONE — 2026-08-28

---

## FIX-004 — `@types/node` majors behind the runtime

**Severity:** Low — type surface did not match the runtime.

**Symptom:** `devDependencies` pinned `@types/node: ^20` while CI and the sync
scripts run on Node 22 (`01379e7`).

**Fix:** `pnpm add -D "@types/node@^22"` → resolved 20.19.43 → 22.20.1.
Deliberately stayed on 22 rather than the available 26.x so the types track the
runtime the workflows actually pin.

**Status:** DONE — 2026-08-28

---

## FIX-005 — Documented credential-check command uses a dependency that isn't installed

**Severity:** Medium — found while fixing FIX-002; the documented recovery step
could never have worked.

**Symptom:** "Refreshing ESPN cookies" told the operator to run
`pnpm exec tsx -e "import('./src/lib/providers/espn/check-credentials')..."`.
`tsx` appears nowhere in `package.json`, so the command fails before it can
check anything — in the exact situation (expired cookies mid-season) where the
operator is under time pressure.

**Fix:** Replaced with `node --env-file=.env.local scripts/sync-espn.mjs`,
which is what `sync.yml` runs and which performs the credential check as its
first step. Noted that while Phase 2.3's data sync is unimplemented the script
does nothing else, so it is currently safe to run as a bare check.

**Status:** DONE — 2026-08-28

---

## FIX-006 — RUNBOOK described the sync schedule as the old Vercel cron

**Severity:** Low — found while fixing FIX-001.

**Symptom:** Step 3 said `sync.yml` runs "on the same weekly schedule the old
`vercel.json` cron used". `5dd17a0` changed it to Tuesdays 10pm US Eastern via
the dual-UTC-cron + hour-guard pattern. `vercel.json` was deleted in `d38101e`,
so the description referenced a file that no longer exists.

**Fix:** Described the real schedule and the DST handling. Also added the
missing mention of `ci.yml` as the branch-protection status check, which was
never documented.

**Status:** DONE — 2026-08-28

---

## Noted, no action taken

- **`Manager Photos/`** appeared as an untracked directory during this pass.
  Not touched — unclear whether it is intended as repo content, a
  `public/`-bound asset set, or local scratch. Needs a decision.
