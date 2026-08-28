# Lessons Learned Workflow

Ported from `CascadeProjects/FoundryAI/FoundryMCP/Bryan-Jarvis/.devin/workflows/lessons-learned.md`
so the trigger phrases work inside this repo too. Adapted for Devin CLI, which
has no `create_memory` tool — knowledge is stored as files only.

## Trigger Phrases
- "run a lessons learned"
- "run the standard lessons learned"
- "run lessons learned"

## Process

### 1. Review the Session
Identify key decisions, pain points, new patterns, reusable knowledge, and
tool/technique improvements.

If the session has no conversation history (e.g. a fresh session that opens
with the trigger phrase), say so explicitly and reconstruct instead from:
- `git log --oneline` and the diffs of recent fix-up commits — a commit whose
  message starts with "Fix", "Bump", or names a workaround is a lesson that was
  paid for once already
- `git status` for uncommitted scratch files
- plan files under `~/.devin/plans/`
- files currently open in the IDE

### 2. Record Durable Knowledge (files, not memories)
Devin CLI has no memory store. Write findings to:
- `.devin/rules/*.md` — constraints, conventions, pitfalls
- `.devin/skills/<name>/SKILL.md` — domain tasks with reference data
- `.devin/workflows/*.md` — repeatable multi-step processes
- `AGENTS.md` — facts every future agent must know before touching the repo

Use these tags in the tracker: `workflow`, `pattern`, `pitfall`, `reference`, `tool`.

### 3. Prefer Updating Over Creating
Check whether `AGENTS.md`, `RUNBOOK.md`, or `ROADMAP.md` already cover the
finding. Duplicated guidance drifts and then contradicts itself.

### 4. Check for Documentation That the Work Invalidated
A fix that changes behaviour usually strands a doc. After any change to
workflows, env vars, hosting, or deleted routes, grep the Markdown for the old
name and confirm it still reads true.

### 5. Update the Tracker
`.devin/memory-tracker.md` — list new/updated assets, cross-reference them, and
mark anything stale.

### 6. Report Defects Separately
Findings that are actual bugs (stale docs, missing gitignore entries, drifting
duplicated config) get flagged to the user as a list with a recommendation.
Do not silently fix them as part of a knowledge-capture pass.

### 7. Summarize
Tell the user what was created/updated, why, and how to use it.

---

*User-triggered process — always execute when asked.*
