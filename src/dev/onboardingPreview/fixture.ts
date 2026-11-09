import type { GameStateData, LeagueData, PlayerData, TeamData } from "../../store/gameStore";
import type { TeamSeasonRecord } from "../../store/types";
import { getPlayerOvr } from "../../lib/playerOvr";
import type { PackageInfo } from "../../components/menu/packageTypes";
import { previewGameState } from "../shellPreview/fixture";

/**
 * The career the onboarding preview walks through: the shell preview's fictional English league,
 * given the things the new screens actually read — an authored domestic competition (so clubs
 * group by division and the world declares a region), recorded seasons (so the story filters have
 * something honest to filter), a captain, a welcome letter and a squad for every club.
 *
 * Dev only, English only. Nothing here is simulated: `start_new_game` and `select_team` are
 * answered by `previewIpc.ts` from this same data, and no other command invents an effect.
 */

export const ONBOARDING_SAVE_ID = "preview-onboarding";
export const ONBOARDING_LEAGUE_ID = "premier-division";
export const ONBOARDING_CLUB_ID = "harbour-city";

/** The one database the preview says is installed, so the world beat has a real choice to show. */
export function previewPackages(): PackageInfo[] {
  return [
    {
      id: "openfoot-england",
      name: "OpenFoot England",
      version: "1.0.0",
      author: "OpenFoot",
      description: "Eight fictional English clubs in one domestic division, with their squads.",
      license: "CC-BY-4.0",
      gameMinVersion: "0.4.0",
      packageType: "database",
      teamCount: 8,
      playerCount: 128,
      competitionCount: 1,
      namePoolCount: 1,
      countryCount: 1,
      confederationCount: 1,
      installedPath: "preview/openfoot-england",
      bundled: true,
    },
  ];
}

function season(seasonYear: number, position: number): TeamSeasonRecord {
  const won = Math.max(4, 30 - position * 2);
  const drawn = Math.max(2, 12 - position);
  return {
    season: seasonYear,
    league_position: position,
    played: 30,
    won,
    drawn,
    lost: 30 - won - drawn,
    goals_for: 70 - position * 3,
    goals_against: 24 + position * 3,
    competition_id: ONBOARDING_LEAGUE_ID,
  };
}

/**
 * Recorded history only. Northgate won last year (a contender); Harbour City won in 2019 but not
 * last year (a sleeping giant); Eastfield has no archive at all (a new story). The rest are
 * mid-table sides with a plausible spread.
 */
const HISTORY: Record<string, TeamSeasonRecord[]> = {
  "harbour-city": [season(2019, 1), season(2023, 9), season(2024, 12), season(2025, 8)],
  northgate: [season(2023, 3), season(2024, 2), season(2025, 1)],
  kingsmoor: [season(2024, 5), season(2025, 4)],
  eastfield: [],
  "st-marys": [season(2024, 7), season(2025, 6)],
  redcliff: [season(2023, 2), season(2024, 6), season(2025, 10)],
  ashford: [season(2024, 11), season(2025, 13)],
  larkhill: [season(2024, 15), season(2025, 14)],
};

const REPUTATION: Record<string, number> = {
  northgate: 720,
  "harbour-city": 640,
  kingsmoor: 560,
  redcliff: 520,
  "st-marys": 470,
  ashford: 380,
  larkhill: 320,
  eastfield: 260,
};

const FINANCE: Record<string, { finance: number; transfer: number; wage: number }> = {
  northgate: { finance: 92_000_000, transfer: 45_000_000, wage: 2_100_000 },
  "harbour-city": { finance: 38_000_000, transfer: 16_500_000, wage: 900_000 },
  kingsmoor: { finance: 27_000_000, transfer: 11_000_000, wage: 720_000 },
  redcliff: { finance: 21_000_000, transfer: 8_500_000, wage: 640_000 },
  "st-marys": { finance: 16_000_000, transfer: 6_000_000, wage: 520_000 },
  ashford: { finance: 9_000_000, transfer: 3_200_000, wage: 380_000 },
  larkhill: { finance: 6_500_000, transfer: 2_100_000, wage: 310_000 },
  eastfield: { finance: 3_800_000, transfer: 900_000, wage: 220_000 },
};

/** Every club gets the same sixteen-man template at its own level, under its own ids. */
function squadFor(team: TeamData, index: number, template: PlayerData[]): PlayerData[] {
  const reputation = REPUTATION[team.id] ?? 400;
  const shift = Math.round((reputation - 640) / 40) - index;
  return template.map((player, spot) => ({
    ...player,
    id: `${team.id}-player-${spot + 1}`,
    team_id: team.id,
    ovr: Math.max(45, Math.min(92, getPlayerOvr(player) + shift)),
    market_value: Math.max(250_000, Math.round(player.market_value * (reputation / 640))),
    wage: Math.max(4_000, Math.round(player.wage * (reputation / 640))),
    injury: team.id === ONBOARDING_CLUB_ID ? player.injury : null,
    morale: team.id === ONBOARDING_CLUB_ID ? player.morale : 70,
  }));
}

function league(teams: TeamData[]): LeagueData {
  const base = previewGameState.league;
  if (!base) throw new Error("The shell preview fixture has no league to extend.");
  return {
    ...base,
    kind: "League",
    scope: "Domestic",
    region_id: "europe",
    country_id: "GB",
    priority: 1,
    participant_ids: teams.map((team) => team.id),
    standings: [],
    fixtures: base.fixtures.map((fixture) => ({
      ...fixture,
      competition_id: ONBOARDING_LEAGUE_ID,
    })),
  };
}

export interface PreviewManagerIdentity {
  firstName: string;
  lastName: string;
  nationality: string;
}

/**
 * A world with no club taken yet: the state `start_new_game` hands back before the player chooses.
 * The manager's name is the one typed on the identity beat, so the passport, the dossier and the
 * signing all read the same person.
 */
export function createOnboardingGameState(identity: PreviewManagerIdentity): GameStateData {
  const template = previewGameState.players;
  const teams: TeamData[] = previewGameState.teams.map((team) => {
    const money = FINANCE[team.id] ?? { finance: 10_000_000, transfer: 2_000_000, wage: 300_000 };
    return {
      ...team,
      reputation: REPUTATION[team.id] ?? 400,
      finance: money.finance,
      transfer_budget: money.transfer,
      wage_budget: money.wage,
      manager_id: null,
      history: HISTORY[team.id] ?? [],
      form: [],
    };
  });
  const players = teams.flatMap((team, index) => squadFor(team, index, template));
  const withRoles = teams.map((team) => {
    const squad = players.filter((player) => player.team_id === team.id);
    const captain = squad.find((player) => player.position === "CentralMidfielder") ?? squad[0];
    const striker = squad.find((player) => player.position === "Striker") ?? squad[1];
    return {
      ...team,
      starting_xi_ids: squad.slice(0, 11).map((player) => player.id),
      match_roles: {
        captain: captain?.id ?? null,
        vice_captain: squad[2]?.id ?? null,
        penalty_taker: striker?.id ?? null,
        free_kick_taker: squad[7]?.id ?? null,
        corner_taker: squad[8]?.id ?? null,
      },
    };
  });
  const competition = league(withRoles);
  const displayName = `${identity.firstName} ${identity.lastName}`.trim() || "Alex Morgan";

  return {
    ...previewGameState,
    career_token: 1,
    manager: {
      ...previewGameState.manager,
      first_name: identity.firstName || "Alex",
      last_name: identity.lastName || "Morgan",
      display_name: displayName,
      nationality: identity.nationality || "ENG",
      team_id: null,
    },
    teams: withRoles,
    players,
    league: competition,
    competitions: [competition],
    active_region_ids: ["europe"],
    active_competition_ids: [ONBOARDING_LEAGUE_ID],
    messages: [
      {
        ...previewGameState.messages[0],
        id: "welcome-letter",
        sender: "The Chairman",
        sender_role: "Board",
        subject: "Welcome to the club",
        body: "The board is behind you. Read the objectives, meet the squad, and tell us how you want to play. The rest is yours.",
        date: previewGameState.clock.current_date,
        read: false,
        category: "Welcome",
      },
      ...previewGameState.messages.slice(1),
    ],
    news: previewGameState.news.map((article) => ({ ...article })),
  };
}

/** The appointment, as `select_team` commits it: one club, once. Nothing else about the world moves. */
export function appointManager(
  state: GameStateData,
  teamId: string,
  activeRegionIds: string[],
  activeCompetitionIds: string[],
): GameStateData {
  return {
    ...state,
    manager: { ...state.manager, team_id: teamId },
    teams: state.teams.map((team) =>
      team.id === teamId ? { ...team, manager_id: state.manager.id } : team,
    ),
    active_region_ids: activeRegionIds,
    active_competition_ids: activeCompetitionIds,
  };
}

export const previewManagerIdentity: PreviewManagerIdentity = {
  firstName: "Alex",
  lastName: "Morgan",
  nationality: "ENG",
};
