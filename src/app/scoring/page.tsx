import {
  getAllScoringSeasons,
  getScoring,
  getScoringDiff,
  type ScoringItem,
} from "@/lib/data/history";
import { mapEspnStatId } from "@/lib/providers/espn/mappings";

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

function labelForStatId(statId: string): string {
  const key = mapEspnStatId(Number(statId));
  if (!key) return `Unmapped stat ${statId}`;
  return STAT_LABELS[key] ?? key;
}

function formatPoints(item: ScoringItem | undefined | null): string {
  if (!item) return "—";
  return item.points > 0 ? `+${item.points}` : `${item.points}`;
}

export default function ScoringPage() {
  const seasons = getAllScoringSeasons();
  const latestSeason = seasons[seasons.length - 1];
  const latestScoring = getScoring(latestSeason);

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Scoring</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-500">
          Current rules ({latestSeason}), {latestScoring?.scoringType.replace("_", " ")}
          , {latestScoring?.playerRankType} rankings. Full year-over-year
          changes below.
        </p>
      </div>

      {latestScoring && (
        <table className="w-full border-collapse overflow-hidden rounded-lg border border-zinc-200 bg-white text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-zinc-500">
              <th className="px-4 py-3 font-medium">Stat</th>
              <th className="px-4 py-3 font-medium">Points</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(latestScoring.items)
              .sort((a, b) => labelForStatId(a[0]).localeCompare(labelForStatId(b[0])))
              .map(([statId, item]) => (
                <tr key={statId} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-3">{labelForStatId(statId)}</td>
                  <td className="px-4 py-3 font-mono">{formatPoints(item)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      )}

      <div className="flex flex-col gap-8">
        <h2 className="text-lg font-semibold">Year-over-year changes</h2>
        {seasons.slice(0, -1).map((season, i) => {
          const nextSeason = seasons[i + 1];
          const diffKey = `${season}_to_${nextSeason}`;
          const diffs = getScoringDiff(diffKey);
          if (diffs.length === 0) return null;
          return (
            <div key={diffKey}>
              <h3 className="mb-2 font-medium">
                {season} &rarr; {nextSeason}
              </h3>
              <table className="w-full border-collapse overflow-hidden rounded-lg border border-zinc-200 bg-white text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-zinc-500">
                    <th className="px-4 py-3 font-medium">Stat</th>
                    <th className="px-4 py-3 font-medium">{season}</th>
                    <th className="px-4 py-3 font-medium">{nextSeason}</th>
                  </tr>
                </thead>
                <tbody>
                  {diffs.map((diff) => (
                    <tr key={diff.statId} className="border-b border-zinc-100 last:border-0">
                      <td className="px-4 py-3">{labelForStatId(diff.statId)}</td>
                      <td className="px-4 py-3 font-mono">
                        {formatPoints(diff[season] as ScoringItem | null)}
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {formatPoints(diff[nextSeason] as ScoringItem | null)}
                      </td>
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
