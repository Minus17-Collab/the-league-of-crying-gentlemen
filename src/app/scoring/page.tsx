import {
  getAllScoringSeasons,
  getScoring,
  getScoringDiff,
  type ScoringItem,
} from "@/lib/data/league";

/** Display-only labels for stat keys. Not scoring logic — just UI text. */
const STAT_LABELS: Record<string, string> = {
  pass_yd: "Passing Yards",
  pass_td: "Passing TD",
  pass_2pt: "Passing 2pt",
  pass_int: "Interception Thrown",
  rush_yd: "Rushing Yards",
  rush_td: "Rushing TD",
  rush_2pt: "Rushing 2pt",
  rec_yd: "Receiving Yards",
  rec_td: "Receiving TD",
  rec_2pt: "Receiving 2pt",
  rec: "Reception",
  fum_rec_td: "Fumble Recovery TD",
  fum_lost: "Fumble Lost",
  fg_40_49: "FG Made 40-49",
  fg_0_39: "FG Made 0-39",
  fg_miss: "FG Missed",
  xp_made: "Extra Point Made",
  fg_60_plus: "FG Made 60+",
  def_pa_0: "0 Points Allowed",
  def_pa_1_6: "1-6 Points Allowed",
  def_pa_7_13: "7-13 Points Allowed",
  def_pa_14_17: "14-17 Points Allowed",
  def_pa_28_34: "28-34 Points Allowed",
  def_pa_35_45: "35-45 Points Allowed",
  def_pa_46_plus: "46+ Points Allowed",
  def_yds_lt100: "<100 Yards Allowed",
  def_yds_100_199: "100-199 Yards Allowed",
  def_yds_200_299: "200-299 Yards Allowed",
  def_yds_350_399: "350-399 Yards Allowed",
  def_yds_400_449: "400-449 Yards Allowed",
  def_yds_450_499: "450-499 Yards Allowed",
  def_yds_500_549: "500-549 Yards Allowed",
  def_yds_550_plus: "550+ Yards Allowed",
  def_blk_kick_td: "Blocked Kick TD",
  def_int: "Interception",
  def_fum_rec: "Fumble Recovery",
  def_blk_kick: "Blocked Kick",
  def_safety: "Safety",
  def_sack: "Sack",
  def_kr_td: "Kickoff Return TD",
  def_pr_td: "Punt Return TD",
  def_int_td: "Interception Return TD",
  def_fum_ret_td: "Fumble Return TD",
  def_2pt_ret: "2pt Return",
};

function labelForStatKey(statKey: string): string {
  return STAT_LABELS[statKey] ?? statKey;
}

function formatPoints(item: ScoringItem | undefined | null): string {
  if (!item) return "—";
  return item.points > 0 ? `+${item.points}` : `${item.points}`;
}

/** Years with unresolved scoring ambiguity — see data/history/SUMMARY.md. */
const SEASONS_WITH_AMBIGUOUS_SCORING = new Set([2023]);

export default async function ScoringPage() {
  const seasons = await getAllScoringSeasons();
  const latestSeason = seasons[seasons.length - 1];
  const latestScoring = await getScoring(latestSeason);

  const diffPairs = seasons.slice(0, -1).map((season, i) => ({
    season,
    nextSeason: seasons[i + 1],
  }));
  const diffs = await Promise.all(
    diffPairs.map(({ season, nextSeason }) => getScoringDiff(season, nextSeason))
  );

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="font-heading text-2xl tracking-wide text-gold-400">Scoring</h1>
        <p className="mt-2 max-w-2xl text-sm text-ivory">
          Current rules ({latestSeason}). Full year-over-year changes below.
        </p>
      </div>

      {latestScoring && (
        <table className="w-full border-collapse overflow-hidden rounded-lg border border-gold-500/30 bg-charcoal-700 text-sm text-ivory">
          <thead>
            <tr className="border-b border-gold-500/30 bg-charcoal-600 text-left text-ivory/75">
              <th className="px-4 py-3 font-medium">Stat</th>
              <th className="px-4 py-3 font-medium">Points</th>
            </tr>
          </thead>
          <tbody>
            {[...latestScoring.items]
              .sort((a, b) => labelForStatKey(a.statKey).localeCompare(labelForStatKey(b.statKey)))
              .map((item) => (
                <tr key={item.statKey} className="border-b border-charcoal-600 last:border-0">
                  <td className="px-4 py-3">{labelForStatKey(item.statKey)}</td>
                  <td className="px-4 py-3 font-mono">{formatPoints(item)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      )}

      <div className="flex flex-col gap-8">
        <h2 className="font-subheading text-lg tracking-wide text-gold-400">Year-over-year changes</h2>
        {diffPairs.map(({ season, nextSeason }, i) => {
          const seasonDiffs = diffs[i];
          if (seasonDiffs.length === 0) return null;
          return (
            <div key={`${season}_to_${nextSeason}`}>
              <h3 className="mb-2 font-medium text-ivory">
                {season} &rarr; {nextSeason}
              </h3>
              {(SEASONS_WITH_AMBIGUOUS_SCORING.has(season) ||
                SEASONS_WITH_AMBIGUOUS_SCORING.has(nextSeason)) && (
                <p className="mb-2 rounded-md border border-amber/40 bg-charcoal-600 px-3 py-2 text-xs text-amber">
                  {SEASONS_WITH_AMBIGUOUS_SCORING.has(season) ? season : nextSeason} rushing/TD
                  scoring is incomplete: ESPN&apos;s position-keyed overrides for that season
                  couldn&apos;t be resolved to a known vocabulary, so rushing yardage/TD bonuses
                  may be understated. Commissioner input pending — see data/history/SUMMARY.md.
                </p>
              )}
              <table className="w-full border-collapse overflow-hidden rounded-lg border border-gold-500/30 bg-charcoal-700 text-sm text-ivory">
                <thead>
                  <tr className="border-b border-gold-500/30 bg-charcoal-600 text-left text-ivory/75">
                    <th className="px-4 py-3 font-medium">Stat</th>
                    <th className="px-4 py-3 font-medium">{season}</th>
                    <th className="px-4 py-3 font-medium">{nextSeason}</th>
                  </tr>
                </thead>
                <tbody>
                  {seasonDiffs.map((diff) => (
                    <tr key={diff.statKey} className="border-b border-charcoal-600 last:border-0">
                      <td className="px-4 py-3">{labelForStatKey(diff.statKey)}</td>
                      <td className="px-4 py-3 font-mono">{formatPoints(diff.before)}</td>
                      <td className="px-4 py-3 font-mono">{formatPoints(diff.after)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}
