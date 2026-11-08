import { getPlayerOvr, getUserCompetitions } from "../../lib/helpers";
import { averageRating } from "../../lib/playerOvr";
import type { FixtureData, GameStateData, NewsArticle, PlayerData } from "../../store/gameStore";

const ONBOARDING_VISIBLE_DAYS = 7;
const ONBOARDING_PAGE_TABS = new Set(["Squad", "Staff", "Tactics", "Training"]);
const ONBOARDING_STORAGE_KEY_PREFIX = "ofm-onboarding-visited-tabs";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface OnboardingCompletionState {
  completedSteps: number;
  hasReadInbox: boolean;
  hasVisitedSquadPage: boolean;
  hasVisitedStaffPage: boolean;
  hasVisitedTacticsPage: boolean;
  hasVisitedTrainingPage: boolean;
  showOnboarding: boolean;
}

export interface HomeRosterOverview {
  avgOvr: number;
  coldPlayers: PlayerData[];
  hotPlayers: PlayerData[];
  unavailablePlayers: PlayerData[];
}

export interface HomeRecentResult {
  fixture: FixtureData & {
    result: NonNullable<FixtureData["result"]>;
  };
  isHome: boolean;
  myGoals: number;
  opponentGoals: number;
  opponentId: string;
  resultCode: "W" | "D" | "L";
}

export function getLeagueDigestArticles(gameState: GameStateData): NewsArticle[] {
  return [...(gameState.news || [])]
    .filter((article) => {
      return article.category === "LeagueRoundup" || article.category === "StandingsUpdate";
    })
    .sort((leftArticle, rightArticle) => {
      return rightArticle.date.localeCompare(leftArticle.date);
    })
    .slice(0, 2);
}

export function getHomeRosterOverview(roster: PlayerData[]): HomeRosterOverview {
  // The first team's average, rounded as the backend's team card rounds the whole club's.
  const avgOvr = averageRating(roster.map(getPlayerOvr));
  const unavailablePlayers = roster
    .filter((player) => player.injury != null)
    .sort((leftPlayer, rightPlayer) => {
      return (
        (rightPlayer.injury?.days_remaining ?? 0) - (leftPlayer.injury?.days_remaining ?? 0) ||
        leftPlayer.full_name.localeCompare(rightPlayer.full_name)
      );
    });
  const hotPlayers = roster
    .filter((player) => player.morale >= 80 && !player.injury)
    .sort((leftPlayer, rightPlayer) => rightPlayer.morale - leftPlayer.morale)
    .slice(0, 3);
  const coldPlayers = roster
    .filter((player) => player.morale <= 40)
    .sort((leftPlayer, rightPlayer) => leftPlayer.morale - rightPlayer.morale)
    .slice(0, 3);

  return {
    avgOvr,
    coldPlayers,
    hotPlayers,
    unavailablePlayers,
  };
}

export function getRecentResultsForTeam(
  gameState: GameStateData,
  teamId: string | null,
  limit = 5,
): HomeRecentResult[] {
  if (!teamId) {
    return [];
  }

  // Pull completed fixtures from every competition the manager plays in (the
  // same source as the Schedule tab) rather than the legacy `game.league`.
  const completedFixtures = getUserCompetitions(gameState)
    .flatMap((competition) => competition.fixtures)
    .filter(
      (fixture) =>
        fixture.status === "Completed" &&
        fixture.result !== null &&
        (fixture.home_team_id === teamId || fixture.away_team_id === teamId),
    )
    .sort((leftFixture, rightFixture) => {
      if (leftFixture.date !== rightFixture.date) {
        return rightFixture.date.localeCompare(leftFixture.date);
      }
      if (leftFixture.matchday !== rightFixture.matchday) {
        return rightFixture.matchday - leftFixture.matchday;
      }
      return rightFixture.id.localeCompare(leftFixture.id);
    })
    .slice(0, limit)
    .reverse();

  return completedFixtures.map((fixture) => {
    const result = fixture.result as NonNullable<FixtureData["result"]>;
    const isHome = fixture.home_team_id === teamId;
    const myGoals = isHome ? result.home_goals : result.away_goals;
    const opponentGoals = isHome ? result.away_goals : result.home_goals;

    return {
      fixture: fixture as FixtureData & {
        result: NonNullable<FixtureData["result"]>;
      },
      isHome,
      myGoals,
      opponentGoals,
      opponentId: isHome ? fixture.away_team_id : fixture.home_team_id,
      resultCode: myGoals > opponentGoals ? "W" : myGoals < opponentGoals ? "L" : "D",
    };
  });
}

export function isOnboardingPageTab(tab: string): boolean {
  return ONBOARDING_PAGE_TABS.has(tab);
}

function getOnboardingStorageKey(gameState: GameStateData, activeSaveId?: string | null): string {
  if (activeSaveId) {
    return `${ONBOARDING_STORAGE_KEY_PREFIX}:save:${activeSaveId}`;
  }

  return `${ONBOARDING_STORAGE_KEY_PREFIX}:legacy:${gameState.manager.id}:${gameState.clock.start_date}`;
}

function getDefaultStorage(): StorageLike | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

export function loadVisitedOnboardingTabs(
  gameState: GameStateData,
  storage: StorageLike | null = getDefaultStorage(),
  activeSaveId?: string | null,
): Set<string> {
  if (!storage) {
    return new Set<string>();
  }

  const storedValue = storage.getItem(getOnboardingStorageKey(gameState, activeSaveId));

  if (!storedValue) {
    return new Set<string>();
  }

  try {
    const parsedValue: unknown = JSON.parse(storedValue);

    if (!Array.isArray(parsedValue)) {
      return new Set<string>();
    }

    return new Set<string>(
      parsedValue.filter(
        (tab): tab is string => typeof tab === "string" && isOnboardingPageTab(tab),
      ),
    );
  } catch {
    return new Set<string>();
  }
}

export function saveVisitedOnboardingTabs(
  gameState: GameStateData,
  visitedTabs: ReadonlySet<string>,
  storage: StorageLike | null = getDefaultStorage(),
  activeSaveId?: string | null,
): void {
  if (!storage) {
    return;
  }

  const persistedTabs = Array.from(visitedTabs).filter((tab) => isOnboardingPageTab(tab));

  storage.setItem(getOnboardingStorageKey(gameState, activeSaveId), JSON.stringify(persistedTabs));
}

export function getOnboardingCompletionState(
  gameState: GameStateData,
  visitedTabs: ReadonlySet<string> = new Set<string>(),
): OnboardingCompletionState {
  const currentDate = new Date(gameState.clock.current_date);
  const startDate = new Date(gameState.clock.start_date);
  const daysSinceStart = Math.floor(
    (currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  const showOnboarding = daysSinceStart <= ONBOARDING_VISIBLE_DAYS;
  const hasVisitedSquadPage = visitedTabs.has("Squad");
  const hasVisitedStaffPage = visitedTabs.has("Staff");
  const hasVisitedTacticsPage = visitedTabs.has("Tactics");
  const hasVisitedTrainingPage = visitedTabs.has("Training");
  const hasReadInbox = gameState.messages.some((message) => message.read);
  const completedSteps = [
    hasVisitedSquadPage,
    hasVisitedStaffPage,
    hasVisitedTacticsPage,
    hasVisitedTrainingPage,
    hasReadInbox,
  ].filter(Boolean).length;

  return {
    completedSteps,
    hasReadInbox,
    hasVisitedSquadPage,
    hasVisitedStaffPage,
    hasVisitedTacticsPage,
    hasVisitedTrainingPage,
    showOnboarding,
  };
}
