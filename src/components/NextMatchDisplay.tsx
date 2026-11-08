import { ArrowRight, CalendarDays, MapPin, Swords } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { GameStateData, TeamData } from "../store/gameStore";
import { Badge, FormDots, TeamLogo } from "./ui";
import {
  formatMatchDate,
  getFixtureCompetitionName,
  getFixtureDisplayLabel,
  getTeamName,
  getUserCompetition,
  getUserNextFixture,
} from "../lib/helpers";
import { isSeasonComplete } from "../lib/seasonContext";

const FOCUS_RING =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-panel";

/**
 * The hero also has to fit the short band Home switches to on a short window (under ~820px), so
 * the pieces that are nice-to-have — the swords, the ground — go and the rest tighten up.
 */
const SHORT = "[@media(max-height:820px)]:";

function TeamBlock({
  team,
  name,
  tone,
}: {
  team: TeamData | undefined;
  name: string;
  tone: "own" | "opponent";
}): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
      {team ? (
        <TeamLogo
          team={team}
          className={`flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 sm:h-16 sm:w-16 [@media(max-height:820px)]:h-10 [@media(max-height:820px)]:w-10 ${
            tone === "own" ? "border-selected/50" : "border-line-strong"
          }`}
          imageClassName={`h-11 w-11 object-contain drop-shadow ${SHORT}h-7 ${SHORT}w-7`}
          style={{ backgroundColor: team.colors.primary }}
        />
      ) : null}
      <p
        className={`w-full truncate font-heading text-body font-bold uppercase tracking-label ${
          tone === "own" ? "text-selected" : "text-fg-muted"
        }`}
        title={name}
      >
        {name}
      </p>
    </div>
  );
}

/**
 * The next fixture, as the hero of Home: the two crests, when and where, how each side has been
 * playing, and the two things a manager does about it. It fills a dashboard panel, so it takes the
 * height it is given instead of growing the page.
 */
export default function NextMatchDisplay({
  gameState,
  onNavigate,
}: {
  gameState: GameStateData;
  onNavigate?: (tab: string) => void;
}): React.JSX.Element {
  const { t } = useTranslation();
  const userTeamId = gameState.manager.team_id;
  const league = getUserCompetition(gameState);

  if (!userTeamId || !league) {
    return <p className="py-4 text-center text-body text-fg-muted">{t("home.noLeagueSchedule")}</p>;
  }

  const nextFixture = getUserNextFixture(gameState);
  if (!nextFixture) {
    return (
      <p className="py-4 text-center text-body text-fg-muted">
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
    <div className={`flex h-full min-h-0 flex-col gap-3 ${SHORT}gap-1.5`}>
      <div className="flex min-h-0 flex-1 items-center gap-2">
        <TeamBlock team={userTeam} name={getTeamName(gameState.teams, userTeamId)} tone="own" />
        <div className="flex shrink-0 flex-col items-center gap-1 px-1 text-center">
          <Swords className={`h-4 w-4 text-fg-subtle ${SHORT}hidden`} aria-hidden="true" />
          <span className="flex items-center gap-1 text-caption font-heading font-bold uppercase tracking-label text-fg">
            <CalendarDays className="h-3 w-3" aria-hidden="true" />
            {formatMatchDate(nextFixture.date)}
          </span>
          <Badge variant={isHome ? "success" : "accent"} size="sm">
            {isHome ? t("home.home") : t("home.away")}
          </Badge>
          <span className="max-w-36 truncate text-caption text-fg-subtle" title={fixtureLabel}>
            {fixtureLabel}
          </span>
          {userTeam?.stadium_name ? (
            <span
              className={`flex max-w-40 items-center gap-1 truncate text-caption text-fg-subtle ${SHORT}hidden`}
            >
              <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{userTeam.stadium_name}</span>
            </span>
          ) : null}
        </div>
        <TeamBlock
          team={opponentTeam}
          name={getTeamName(gameState.teams, opponentId)}
          tone="opponent"
        />
      </div>

      <div
        className={`flex shrink-0 items-center justify-between gap-2 border-t border-line pt-2 ${SHORT}pt-1`}
      >
        <FormDots results={(userTeam?.form ?? []).slice(-5)} />
        <span className="text-caption font-heading font-bold uppercase tracking-label text-fg-subtle">
          {t("home.form")}
        </span>
        <FormDots results={(opponentTeam?.form ?? []).slice(-5)} />
      </div>

      {onNavigate ? (
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => onNavigate("Tactics")}
            className={`flex h-8 flex-1 items-center justify-center gap-1.5 rounded-control bg-selected font-heading text-caption font-bold uppercase tracking-label text-on-brand transition-colors hover:bg-selected/90 motion-reduce:transition-none ${SHORT}h-7 ${FOCUS_RING}`}
          >
            {t("home.setTactics")}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onNavigate("Schedule")}
            className={`flex h-8 flex-1 items-center justify-center rounded-control bg-sunken font-heading text-caption font-bold uppercase tracking-label text-fg-muted ring-1 ring-inset ring-line transition-colors hover:bg-hover hover:text-fg motion-reduce:transition-none ${SHORT}h-7 ${FOCUS_RING}`}
          >
            {t("home.fixtures")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
