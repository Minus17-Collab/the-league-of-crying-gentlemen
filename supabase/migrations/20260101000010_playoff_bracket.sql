-- ============================================================
-- PLAYOFF BRACKET
-- ============================================================
-- ESPN's schedule data tags every playoff matchup with a tier
-- (winners bracket / winners consolation ladder / losers consolation
-- ladder) that `is_playoff`/`is_championship` collapse away. This
-- column stores that tier, normalized (not ESPN's raw enum strings —
-- provider-specific values stay inside lib/providers/espn per
-- AGENTS.md "Stat providers are swappable"), so the site can render
-- an actual bracket instead of a flat list of playoff games.

alter table matchups
  add column playoff_bracket text
    check (playoff_bracket in ('winners', 'winners_consolation', 'losers_consolation'));
