import { Card, CardBody, CardHeader } from "../ui";
import { PlayerRatingTrendChart } from "./PlayerRatingTrendChart";

type TranslateFn = (key: string, options?: { defaultValue?: string }) => string;

export interface PlayerRecentMatchEntry {
  fixture_id: string;
  date: string;
  competition: string;
  matchday: number;
  opponent_team_id: string;
  opponent_name: string;
  team_goals: number;
  opponent_goals: number;
  minutes_played: number;
  goals: number;
  assists: number;
  shots: number;
  shots_on_target: number;
  rating: number;
  rated: boolean;
}

const MIN_POINTS_FOR_TREND = 2;

function resolveLabel(t: TranslateFn, key: string, fallback: string): string {
  return t(key, { defaultValue: fallback });
}

interface PlayerProfileRecentMatchesCardProps {
  matches: PlayerRecentMatchEntry[];
  t: TranslateFn;
}

export default function PlayerProfileRecentMatchesCard({
  matches,
  t,
}: PlayerProfileRecentMatchesCardProps) {
  const title = resolveLabel(t, "playerProfile.recentMatches", "Recent Matches");
  const ratingTrendLabel = resolveLabel(t, "playerProfile.ratingTrend", "Rating Trend");
  const ratingLabel = resolveLabel(t, "playerProfile.recentMatchesRating", "Rating");

  if (matches.length === 0) {
    return null;
  }

  const ratedMatches = matches.filter((match) => match.rated);

  return (
    <Card>
      <CardHeader>{title}</CardHeader>
      <CardBody>
        {ratedMatches.length >= MIN_POINTS_FOR_TREND ? (
          <div className="mb-4">
            <p className="text-caption uppercase tracking-label text-fg-subtle font-heading mb-2">
              {ratingTrendLabel}
            </p>
            <PlayerRatingTrendChart matches={ratedMatches} ratingLabel={ratingLabel} />
          </div>
        ) : null}
        <div className="space-y-3">
          {matches.map((match) => (
            <div
              key={match.fixture_id}
              className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.8fr)] gap-3 rounded-control bg-sunken px-3 py-2.5"
            >
              <div>
                <p className="font-heading font-bold text-body uppercase tracking-label text-fg-muted">
                  {match.date}
                </p>
                <p className="font-heading font-bold text-body text-fg">{match.opponent_name}</p>
              </div>

              <div className="text-center">
                <p className="text-caption uppercase tracking-label text-fg-subtle">
                  {t("playerProfile.recentMatchesScore")}
                </p>
                <p className="font-heading font-bold text-body text-fg tabular-nums">
                  {match.team_goals}-{match.opponent_goals}
                </p>
              </div>

              <div className="text-center">
                <p className="text-caption uppercase tracking-label text-fg-subtle">
                  {t("playerProfile.recentMatchesGoalsAssists")}
                </p>
                <p className="font-heading font-bold text-body text-fg tabular-nums">
                  {match.goals} / {match.assists}
                </p>
              </div>

              <div className="text-center">
                <p className="text-caption uppercase tracking-label text-fg-subtle">
                  {t("playerProfile.recentMatchesRating")}
                </p>
                <p className="font-heading font-bold text-body text-fg tabular-nums">
                  {match.rated ? match.rating.toFixed(1) : "–"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
