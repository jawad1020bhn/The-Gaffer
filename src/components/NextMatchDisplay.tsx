import { useTranslation } from "react-i18next";
import type { GameStateData } from "../store/gameStore";
import { Badge, TeamLogo } from "./ui";
import {
  getFixtureCompetitionName,
  getFixtureDisplayLabel,
  getTeamName,
  getUserCompetition,
  getUserNextFixture,
  formatMatchDate,
} from "../lib/helpers";
import { isSeasonComplete } from "../lib/seasonContext";

export default function NextMatchDisplay({ gameState }: { gameState: GameStateData }) {
  const { t } = useTranslation();
  const userTeamId = gameState.manager.team_id;
  const league = getUserCompetition(gameState);

  if (!userTeamId || !league) {
    return <p className="text-fg-muted text-body text-center py-4">{t("home.noLeagueSchedule")}</p>;
  }

  const nextFixture = getUserNextFixture(gameState);
  if (!nextFixture) {
    return (
      <p className="text-fg-muted text-body text-center py-4">
        {t(isSeasonComplete(gameState) ? "home.seasonComplete" : "home.noUpcomingOpponent")}
      </p>
    );
  }

  const isHome = nextFixture.home_team_id === userTeamId;
  const opponentId = isHome ? nextFixture.away_team_id : nextFixture.home_team_id;
  const userTeam = gameState.teams.find((team) => team.id === userTeamId);
  const opponentTeam = gameState.teams.find((team) => team.id === opponentId);
  const fixtureLabel = getFixtureDisplayLabel(
    t,
    nextFixture,
    getFixtureCompetitionName(gameState, nextFixture, t),
  );

  return (
    <div className="flex items-center justify-between py-6 px-4 bg-sunken rounded-control border border-line transition-colors">
      <div className="text-center flex-1">
        {userTeam && (
          <TeamLogo
            team={userTeam}
            className="w-16 h-16 rounded-full mx-auto mb-2 flex items-center justify-center overflow-hidden border-2 border-selected/40"
            imageClassName="h-12 w-12 object-contain drop-shadow"
            style={{ backgroundColor: userTeam.colors.primary }}
          />
        )}
        <p className="font-heading font-bold uppercase tracking-label text-body text-selected">
          {getTeamName(gameState.teams, userTeamId)}
        </p>
      </div>

      <div className="text-center px-4 flex flex-col items-center gap-1.5">
        <span className="font-heading font-bold text-title text-fg-subtle">VS</span>
        <Badge variant="neutral">{formatMatchDate(nextFixture.date)}</Badge>
        <span className="text-caption text-fg-subtle">{fixtureLabel}</span>
        <Badge variant={isHome ? "success" : "accent"} size="sm">
          {isHome ? t("home.home") : t("home.away")}
        </Badge>
      </div>

      <div className="text-center flex-1">
        {opponentTeam && (
          <TeamLogo
            team={opponentTeam}
            className="w-16 h-16 rounded-full mx-auto mb-2 flex items-center justify-center overflow-hidden border-2 border-line-strong"
            imageClassName="h-12 w-12 object-contain drop-shadow"
            style={{ backgroundColor: opponentTeam.colors.primary }}
          />
        )}
        <p className="font-heading font-bold uppercase tracking-label text-body text-fg-muted">
          {getTeamName(gameState.teams, opponentId)}
        </p>
      </div>
    </div>
  );
}
