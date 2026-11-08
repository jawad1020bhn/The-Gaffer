import { Swords } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSquadFitness } from "../../hooks/useSquadFitness";
import type { GameStateData } from "../../store/gameStore";
import { Badge, Card, CardBody, CardHeader } from "../ui";
import { formatDateShort, getUserCompetition } from "../../lib/helpers";
import { useFetchedSquad } from "../../hooks/useFetchedSquad";
import { isFirstTeamSquadPlayer } from "../../lib/playerSquad";
import NextMatchDisplay from "../NextMatchDisplay";
import { resolveBoardObjective, resolveMessage, resolveNewsArticle } from "../../utils/backendI18n";
import {
  getHomeRosterOverview,
  getLeagueDigestArticles,
  getOnboardingCompletionState,
  getRecentResultsForTeam,
} from "./HomeTab.helpers";
import HomeBoardObjectivesCard from "./HomeBoardObjectivesCard";
import HomeLeagueDigestCard from "./HomeLeagueDigestCard";
import HomeLeaguePositionCard from "./HomeLeaguePositionCard";
import HomeLatestNewsCard from "./HomeLatestNewsCard";
import HomeOnboardingChecklistCard from "./HomeOnboardingChecklistCard";
import HomePlayerMomentumCard from "./HomePlayerMomentumCard";
import HomeRecentMessagesCard from "./HomeRecentMessagesCard";
import HomeRecentResultsCard from "./HomeRecentResultsCard";
import HomeSquadOverviewCard from "./HomeSquadOverviewCard";
import HomeSeasonStatusCard from "./HomeSeasonStatusCard";
import HomeUnavailablePlayersCard from "./HomeUnavailablePlayersCard";
import { isMessageVisible } from "../../utils/newsVisibility";
import { Dumbbell, Mail, Flame, Scale, Feather, Users, Crosshair, UserCog } from "lucide-react";
import JobOpportunitiesCard from "./JobOpportunitiesCard";

interface HomeTabProps {
  gameState: GameStateData;
  onNavigate?: (tab: string, context?: { messageId?: string }) => void;
  onGameUpdate?: (state: GameStateData) => void;
  visitedOnboardingTabs: ReadonlySet<string>;
}

const SCHEDULE_ICONS: Record<string, { icon: React.ReactNode; color: string }> = {
  Intense: { icon: <Flame className="w-3.5 h-3.5" />, color: "text-danger" },
  Balanced: {
    icon: <Scale className="w-3.5 h-3.5" />,
    color: "text-selected",
  },
  Light: {
    icon: <Feather className="w-3.5 h-3.5" />,
    color: "text-info",
  },
};

/**
 * The manager's desk: a fixed dashboard of panels, three bands tall, that fills the workspace and
 * scrolls inside each panel rather than as a page. The hero is the next fixture; everything else is
 * one click from the fact it reports.
 */
export default function HomeTab({
  gameState,
  onNavigate,
  onGameUpdate,
  visitedOnboardingTabs,
}: HomeTabProps) {
  const { t, i18n } = useTranslation();
  const myTeam = gameState.teams.find((tm) => tm.id === gameState.manager.team_id);
  const [fetchedSquad] = useFetchedSquad(
    myTeam?.id ?? null,
    gameState.clock.current_date,
    gameState,
  );
  const league = getUserCompetition(gameState);
  const roster = myTeam
    ? (fetchedSquad ?? gameState.players).filter(
        (p) => p.team_id === myTeam.id && isFirstTeamSquadPlayer(p),
      )
    : [];
  const { avgOvr, coldPlayers, hotPlayers, unavailablePlayers } = getHomeRosterOverview(roster);
  // Fitness is the backend's: injured players are not in the squad that can play.
  const fitness = useSquadFitness(gameState);
  const avgCondition =
    fitness?.average_condition != null ? Math.round(fitness.average_condition) : null;
  const avgConditionTone = fitness?.average_status?.tone ?? null;
  const exhaustedCount = fitness?.exhausted_count ?? 0;
  const resolveInjuryName = (injuryName: string): string => {
    if (injuryName.includes(".")) {
      return t(injuryName, { defaultValue: injuryName });
    }

    return t(`common.injuries.${injuryName}`, { defaultValue: injuryName });
  };

  // Current date / season context
  const lang = i18n.language;
  const seasonContext = gameState.season_context;
  const isPreseason = seasonContext.phase === "Preseason";
  const seasonStartLabel = seasonContext.season_start
    ? formatDateShort(seasonContext.season_start, lang)
    : null;
  const transferWindow = seasonContext.transfer_window;
  const transferWindowVariant =
    transferWindow.status === "DeadlineDay"
      ? "danger"
      : transferWindow.status === "Open"
        ? "success"
        : "neutral";
  const transferWindowSummary =
    transferWindow.status === "DeadlineDay"
      ? t("season.windowClosesToday")
      : transferWindow.status === "Open" && transferWindow.days_remaining !== null
        ? t("season.windowClosesInDays", {
            count: transferWindow.days_remaining,
          })
        : transferWindow.status === "Closed" && transferWindow.days_until_opens !== null
          ? t("season.windowOpensInDays", {
              count: transferWindow.days_until_opens,
            })
          : t("season.windowClosed");

  // League position — sort a copy: sorting the store's array in place is a
  // state mutation during render. Tiebreak matches the standings table
  // (points → goal difference → goals for).
  const myStandingIndex =
    !isPreseason && league && myTeam
      ? [...league.standings]
          .sort(
            (a, b) =>
              b.points - a.points ||
              b.goals_for - b.goals_against - (a.goals_for - a.goals_against) ||
              b.goals_for - a.goals_for,
          )
          .findIndex((s) => s.team_id === myTeam.id)
      : -1;
  const myStanding = myStandingIndex >= 0 ? myStandingIndex + 1 : null;
  const myStandingData =
    !isPreseason && league && myTeam
      ? (league.standings.find((s) => s.team_id === myTeam.id) ?? null)
      : null;

  const recentResults = getRecentResultsForTeam(gameState, myTeam?.id ?? null);

  // Training schedule
  const schedule = myTeam?.training_schedule || "Balanced";
  const schedIcons = SCHEDULE_ICONS[schedule] || SCHEDULE_ICONS.Balanced;
  const schedLabel = t(`common.trainingSchedules.${schedule}`, schedule);
  const focus = myTeam?.training_focus || "Physical";

  // Latest news — copy before sorting; gameState.news is the store's array.
  const latestNews = [...(gameState.news || [])]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 2)
    .map(resolveNewsArticle);
  const recentMessages = (gameState.messages || [])
    .filter((message) => isMessageVisible(message.date, gameState.clock?.current_date))
    .slice(0, 4)
    .map(resolveMessage);
  const leagueDigestArticles = getLeagueDigestArticles(gameState).map(resolveNewsArticle);
  const boardObjectives = (gameState.board_objectives || []).map(resolveBoardObjective);
  const onboardingState = getOnboardingCompletionState(gameState, visitedOnboardingTabs);

  const onboardingSteps = [
    {
      id: "squad",
      done: onboardingState.hasVisitedSquadPage,
      label: t("onboarding.reviewSquad"),
      description: t("onboarding.reviewSquadDesc"),
      tab: "Squad",
      icon: <Users className="w-4 h-4" />,
    },
    {
      id: "staff",
      done: onboardingState.hasVisitedStaffPage,
      label: t("onboarding.hireStaff"),
      description: t("onboarding.hireStaffDesc"),
      tab: "Staff",
      icon: <UserCog className="w-4 h-4" />,
    },
    {
      id: "tactics",
      done: onboardingState.hasVisitedTacticsPage,
      label: t("onboarding.setTactics"),
      description: t("onboarding.setTacticsDesc"),
      tab: "Tactics",
      icon: <Crosshair className="w-4 h-4" />,
    },
    {
      id: "training",
      done: onboardingState.hasVisitedTrainingPage,
      label: t("onboarding.configTraining"),
      description: t("onboarding.configTrainingDesc"),
      tab: "Training",
      icon: <Dumbbell className="w-4 h-4" />,
    },
    {
      id: "inbox",
      done: onboardingState.hasReadInbox,
      label: t("onboarding.readMessages"),
      description: t("onboarding.readMessagesDesc"),
      tab: "Inbox",
      icon: <Mail className="w-4 h-4" />,
    },
  ];
  const completedSteps = onboardingState.completedSteps;
  const showOnboarding = Boolean(
    myTeam && onboardingState.showOnboarding && completedSteps < onboardingSteps.length,
  );
  const hasMomentum = roster.length > 0 && (hotPlayers.length > 0 || coldPlayers.length > 0);

  if (!myTeam) {
    return (
      <div className="scrollbar-thin flex h-full min-h-0 flex-col gap-3 overflow-y-auto">
        <div className="grid gap-3 lg:grid-cols-3">
          <HomeLeaguePositionCard
            isPreseason={isPreseason}
            phase={seasonContext.phase}
            seasonStartLabel={seasonStartLabel}
            myStanding={myStanding}
            myStandingData={myStandingData}
            teamForm={[]}
            onNavigate={onNavigate}
            className="lg:col-span-2"
          />
          {onGameUpdate ? (
            <JobOpportunitiesCard gameState={gameState} onGameUpdate={onGameUpdate} />
          ) : null}
        </div>
        <HomeRecentMessagesCard
          messages={recentMessages}
          lang={lang}
          onNavigate={onNavigate}
          className="min-h-48"
        />
      </div>
    );
  }

  return (
    <div className="scrollbar-thin flex h-full min-h-0 flex-col gap-3 overflow-y-auto">
      {/* Band 1 — the next fixture, the season's state, the table. */}
      <div className="grid shrink-0 grid-cols-1 gap-3 lg:grid-cols-12 xl:h-band-hero">
        <Card accent="primary" className="lg:col-span-6 xl:col-span-4">
          <CardHeader
            action={
              <Badge variant="neutral" size="sm" className="shrink-0">
                {t(`season.phases.${seasonContext.phase}`)}
              </Badge>
            }
          >
            <Swords className="h-4 w-4 text-selected" aria-hidden="true" />
            {t("home.nextMatch")}
          </CardHeader>
          <CardBody className="p-3">
            <NextMatchDisplay gameState={gameState} onNavigate={onNavigate} />
          </CardBody>
        </Card>

        {isPreseason ? (
          <HomeSeasonStatusCard
            phase={seasonContext.phase}
            seasonStartLabel={seasonStartLabel}
            daysUntilSeasonStart={seasonContext.days_until_season_start}
            transferWindowStatus={transferWindow.status}
            transferWindowVariant={transferWindowVariant}
            transferWindowSummary={transferWindowSummary}
            transferWindowOpensOn={transferWindow.opens_on}
            transferWindowClosesOn={transferWindow.closes_on}
            lang={lang}
            className="lg:col-span-6 xl:col-span-4"
          />
        ) : (
          <HomeLeagueDigestCard
            articles={leagueDigestArticles}
            lang={lang}
            onNavigate={onNavigate}
            className="lg:col-span-6 xl:col-span-4"
          />
        )}

        <HomeLeaguePositionCard
          isPreseason={isPreseason}
          phase={seasonContext.phase}
          seasonStartLabel={seasonStartLabel}
          myStanding={myStanding}
          myStandingData={myStandingData}
          teamForm={myTeam.form ?? []}
          onNavigate={onNavigate}
          className="lg:col-span-6 xl:col-span-4"
        />
      </div>

      {/* Band 2 — what to do next, and how the squad is. */}
      <div className="grid shrink-0 grid-cols-1 gap-3 lg:grid-cols-12 xl:h-band-secondary">
        {showOnboarding ? (
          <HomeOnboardingChecklistCard
            completedSteps={completedSteps}
            totalSteps={onboardingSteps.length}
            steps={onboardingSteps}
            onNavigate={onNavigate}
            className="lg:col-span-6 xl:col-span-4"
          />
        ) : null}
        <HomeSquadOverviewCard
          avgCondition={avgCondition}
          avgConditionTone={avgConditionTone}
          avgOvr={avgOvr}
          exhaustedCount={exhaustedCount}
          scheduleIcon={schedIcons.icon}
          scheduleColorClass={schedIcons.color}
          scheduleLabel={schedLabel}
          focus={focus}
          onNavigate={onNavigate}
          className={showOnboarding ? "lg:col-span-6 xl:col-span-4" : "lg:col-span-6 xl:col-span-6"}
        />
        <HomeRecentResultsCard
          recentResults={recentResults}
          teams={gameState.teams}
          onNavigate={onNavigate}
          className={showOnboarding ? "lg:col-span-6 xl:col-span-4" : "lg:col-span-6 xl:col-span-6"}
        />
      </div>

      {/* Band 3 — the inbox, the wire, the treatment room, the board. */}
      <div className="grid shrink-0 grid-cols-1 gap-3 lg:grid-cols-12 xl:h-band-tertiary">
        <HomeRecentMessagesCard
          messages={recentMessages}
          lang={lang}
          onNavigate={onNavigate}
          className="lg:col-span-6 xl:col-span-3"
        />
        <HomeLatestNewsCard
          articles={latestNews}
          teams={gameState.teams}
          lang={lang}
          onNavigate={onNavigate}
          className="lg:col-span-6 xl:col-span-3"
        />
        <HomeUnavailablePlayersCard
          players={unavailablePlayers}
          resolveInjuryName={resolveInjuryName}
          onNavigate={onNavigate}
          className="lg:col-span-6 xl:col-span-3"
        />
        {boardObjectives.length > 0 ? (
          <HomeBoardObjectivesCard
            objectives={boardObjectives}
            satisfaction={gameState.manager.satisfaction}
            className="lg:col-span-6 xl:col-span-3"
          />
        ) : null}
      </div>

      {/* Only when someone's form is worth a word: the fourth band appears and the page scrolls. */}
      {hasMomentum ? (
        <div className="grid shrink-0 grid-cols-1 gap-3 lg:grid-cols-12 xl:h-band-tertiary">
          <HomePlayerMomentumCard
            hotPlayers={hotPlayers}
            coldPlayers={coldPlayers}
            onNavigate={onNavigate}
            className="lg:col-span-6 xl:col-span-6"
          />
          {onGameUpdate ? (
            <JobOpportunitiesCard
              gameState={gameState}
              onGameUpdate={onGameUpdate}
              hideWhenEmpty
              className="lg:col-span-6 xl:col-span-6"
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
