import { Card, CardBody, CardHeader } from "../ui";

import type { TeamProfileTranslate, TeamRecentMatchEntry } from "./TeamProfile.types";

interface TeamProfileRecentMatchesCardProps {
  matches: TeamRecentMatchEntry[];
  t: TeamProfileTranslate;
}

function resolveLabel(t: TeamProfileTranslate, key: string, fallback: string): string {
  return t(key, { defaultValue: fallback });
}

export default function TeamProfileRecentMatchesCard({
  matches,
  t,
}: TeamProfileRecentMatchesCardProps) {
  const title = resolveLabel(t, "teamProfile.recentMatches", "Recent Matches");
  const possessionLabel = resolveLabel(t, "teamProfile.possession", "Possession");
  const shotsLabel = resolveLabel(t, "teamProfile.shots", "Shots");
  const scoreLabel = t("common.score");

  if (matches.length === 0) {
    return null;
  }

  return (
    <Card className="lg:col-span-3">
      <CardHeader>{title}</CardHeader>
      <CardBody>
        <div className="space-y-3">
          {matches.map((match) => (
            <div
              key={match.fixtureId}
              className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.8fr)] gap-3 rounded-control bg-sunken px-3 py-2.5"
            >
              <div>
                <p className="font-heading font-bold text-body uppercase tracking-label text-fg-muted">
                  {match.date}
                </p>
                <p className="font-heading font-bold text-body text-fg">{match.opponentName}</p>
              </div>

              <div className="text-center">
                <p className="text-caption uppercase tracking-label text-fg-subtle">{scoreLabel}</p>
                <p className="font-heading font-bold text-body text-fg tabular-nums">
                  {match.goalsFor}-{match.goalsAgainst}
                </p>
              </div>

              <div className="text-center">
                <p className="text-caption uppercase tracking-label text-fg-subtle">
                  {possessionLabel}
                </p>
                <p className="font-heading font-bold text-body text-fg tabular-nums">
                  {match.possessionPct.toFixed(1)}%
                </p>
              </div>

              <div className="text-center">
                <p className="text-caption uppercase tracking-label text-fg-subtle">{shotsLabel}</p>
                <p className="font-heading font-bold text-body text-fg tabular-nums">
                  {match.shots} / {match.shotsOnTarget}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
