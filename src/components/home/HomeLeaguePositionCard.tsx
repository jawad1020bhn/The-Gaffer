import { Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge, Card, CardBody, CardHeader, FormDots } from "../ui";

interface LeagueStandingSnapshot {
  team_id: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  points: number;
}

interface HomeLeaguePositionCardProps {
  isPreseason: boolean;
  phase: string;
  seasonStartLabel: string | null;
  myStanding: number | null;
  myStandingData: LeagueStandingSnapshot | null;
  teamForm: string[];
  onNavigate?: (tab: string) => void;
  className?: string;
}

export default function HomeLeaguePositionCard({
  isPreseason,
  phase,
  seasonStartLabel,
  myStanding,
  myStandingData,
  teamForm,
  onNavigate,
  className = "",
}: HomeLeaguePositionCardProps) {
  const { t } = useTranslation();

  const lastThreeResults = teamForm.slice(-3);
  const winStreak =
    lastThreeResults.length >= 3 && lastThreeResults.every((result) => result === "W");
  const loseStreak =
    lastThreeResults.length >= 3 && lastThreeResults.every((result) => result === "L");
  const unbeaten = teamForm.length >= 4 && teamForm.every((result) => result !== "L");

  return (
    <Card accent="accent" className={className}>
      <CardHeader
        action={
          <button
            type="button"
            onClick={() => onNavigate?.("Schedule")}
            className="text-selected text-caption font-heading font-bold uppercase tracking-label hover:text-selected transition-colors"
          >
            {t("home.standings")}
          </button>
        }
      >
        {t("home.leaguePosition")}
      </CardHeader>
      <CardBody>
        {isPreseason ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <Badge variant="accent" size="sm">
              {t(`season.phases.${phase}`)}
            </Badge>
            <p className="text-body font-heading font-bold text-fg">
              {seasonStartLabel
                ? t("season.startsOn", { date: seasonStartLabel })
                : t("season.noOpener")}
            </p>
            <p className="text-caption text-fg-muted max-w-xs">{t("season.standingsLocked")}</p>
          </div>
        ) : myStanding && myStandingData ? (
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-panel bg-warning-tint flex items-center justify-center">
                <span className="text-display font-heading font-bold text-warning">
                  {myStanding}
                </span>
              </div>
              <div>
                <p className="text-caption text-fg-muted font-heading uppercase tracking-label">
                  {myStanding === 1
                    ? t("common.place.1")
                    : myStanding === 2
                      ? t("common.place.2")
                      : myStanding === 3
                        ? t("common.place.3")
                        : t("common.place.other", { n: myStanding })}
                </p>
                <p className="text-lead font-heading font-bold text-fg">
                  {myStandingData.points} {t("common.pts")}
                </p>
              </div>
            </div>
            <div className="w-full grid grid-cols-4 text-center gap-1">
              <div>
                <p className="text-caption text-fg-subtle font-heading uppercase">
                  <span aria-hidden="true">{t("common.played")}</span>
                  <span className="sr-only">{t("common.playedFull")}</span>
                </p>
                <p className="text-body font-heading font-bold text-fg">{myStandingData.played}</p>
              </div>
              <div>
                <p className="text-caption text-fg-subtle font-heading uppercase">
                  <span aria-hidden="true">{t("common.won")}</span>
                  <span className="sr-only">{t("common.wonFull")}</span>
                </p>
                <p className="text-body font-heading font-bold text-positive">
                  {myStandingData.won}
                </p>
              </div>
              <div>
                <p className="text-caption text-fg-subtle font-heading uppercase">
                  <span aria-hidden="true">{t("common.drawn")}</span>
                  <span className="sr-only">{t("common.drawnFull")}</span>
                </p>
                <p className="text-body font-heading font-bold text-fg-muted">
                  {myStandingData.drawn}
                </p>
              </div>
              <div>
                <p className="text-caption text-fg-subtle font-heading uppercase">
                  <span aria-hidden="true">{t("common.lost")}</span>
                  <span className="sr-only">{t("common.lostFull")}</span>
                </p>
                <p className="text-body font-heading font-bold text-danger">
                  {myStandingData.lost}
                </p>
              </div>
            </div>
            {teamForm.length > 0 && (
              <div className="flex flex-col items-center gap-1.5 mt-1">
                <FormDots results={teamForm} />
                {winStreak && (
                  <span className="text-caption font-heading font-bold text-positive uppercase tracking-label">
                    {t("home.winningStreak")}
                  </span>
                )}
                {loseStreak && (
                  <span className="text-caption font-heading font-bold text-danger uppercase tracking-label">
                    {t("home.losingStreak")}
                  </span>
                )}
                {!winStreak && !loseStreak && unbeaten && (
                  <span className="text-caption font-heading font-bold text-selected uppercase tracking-label">
                    {t("home.unbeatenRun")}
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-4">
            <Trophy className="w-8 h-8 text-fg-subtle" />
            <p className="text-caption text-fg-muted">{t("home.noLeague")}</p>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
