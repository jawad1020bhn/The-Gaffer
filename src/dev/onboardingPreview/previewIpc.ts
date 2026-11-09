import type { mockIPC } from "@tauri-apps/api/mocks";
import type { ManagerProfile } from "../../components/menu/types";
import type { GameStateData, MessageData } from "../../store/gameStore";
import type { NationInfo } from "../../services/nationsService";
import type { ScheduleSlice } from "../../services/scheduleService";
import type { SquadFitness } from "../../services/squadService";
import type { TeamSelectionRatings } from "../../services/teamsService";
import { averageRating, getPlayerOvr } from "../../lib/playerOvr";
import { installShellPreviewIpc } from "../shellPreview/previewIpc";
import {
  appointManager,
  createOnboardingGameState,
  ONBOARDING_LEAGUE_ID,
  ONBOARDING_SAVE_ID,
  previewPackages,
} from "./fixture";

/**
 * The backend the onboarding preview talks to. Every answer comes from the preview fixture; the
 * two writes that matter (`start_new_game`, `select_team`) move the fixture career forward exactly
 * as the Rust commands do, and `select_team` refuses a second appointment. Nothing else is faked:
 * no generation progress, no invented contract terms, no simulated passage of time.
 *
 * Dev only. Commands the shell preview already answers (rating tiers, position groups, the
 * players directory) fall through to it so both previews read the same tables.
 */

type IpcHandler = Parameters<typeof mockIPC>[0];

const NATIONS: NationInfo[] = [
  { code: "ENG", name: "England", region: "europe" },
  { code: "SCO", name: "Scotland", region: "europe" },
  { code: "WAL", name: "Wales", region: "europe" },
  { code: "NIR", name: "Northern Ireland", region: "europe" },
  { code: "IRL", name: "Ireland", region: "europe" },
  { code: "FRA", name: "France", region: "europe" },
  { code: "GER", name: "Germany", region: "europe" },
  { code: "ESP", name: "Spain", region: "europe" },
  { code: "ITA", name: "Italy", region: "europe" },
  { code: "POR", name: "Portugal", region: "europe" },
  { code: "NED", name: "Netherlands", region: "europe" },
  { code: "BEL", name: "Belgium", region: "europe" },
  { code: "BRA", name: "Brazil", region: "south-america" },
  { code: "ARG", name: "Argentina", region: "south-america" },
  { code: "USA", name: "United States", region: "north-america" },
  { code: "JPN", name: "Japan", region: "asia" },
  { code: "AUS", name: "Australia", region: "oceania" },
  { code: "NGA", name: "Nigeria", region: "africa" },
];

function ratingsFor(state: GameStateData): TeamSelectionRatings {
  return {
    clubs: state.teams.map((team) => {
      const squad = state.players
        .filter((player) => player.team_id === team.id && !player.retired)
        .sort((left, right) => getPlayerOvr(right) - getPlayerOvr(left));
      return {
        team_id: team.id,
        // The backend's own rule (floor, not round), so the preview never shows a different number.
        average_rating: averageRating(squad.map(getPlayerOvr)),
        players: squad.map((player) => ({ player_id: player.id, ovr: getPlayerOvr(player) })),
      };
    }),
  };
}

function fitnessFor(state: GameStateData, teamId: string | null): SquadFitness {
  const squad = state.players.filter((player) => player.team_id === teamId && !player.retired);
  const healthy = squad.filter((player) => player.injury === null);
  const average =
    healthy.length === 0
      ? null
      : Math.round(healthy.reduce((sum, player) => sum + player.condition, 0) / healthy.length);
  return {
    players: squad.length,
    average_condition: average,
    average_status: null,
    exhausted_count: squad.filter((player) => player.condition < 40).length,
    critical_count: squad.filter((player) => player.condition < 25).length,
    statuses: {},
  };
}

function scheduleFor(state: GameStateData): ScheduleSlice {
  const league = state.league;
  const today = state.clock.current_date;
  const teamName = (id: string) => state.teams.find((team) => team.id === id)?.name ?? id;
  const fixtures = (league?.fixtures ?? []).map((fixture) => ({
    id: fixture.id,
    matchday: fixture.matchday,
    date: fixture.date,
    home_team_id: fixture.home_team_id,
    home_team_name: teamName(fixture.home_team_id),
    away_team_id: fixture.away_team_id,
    away_team_name: teamName(fixture.away_team_id),
    competition: fixture.competition,
    competition_id: fixture.competition_id ?? ONBOARDING_LEAGUE_ID,
    status: fixture.status,
    result: fixture.result
      ? { home_goals: fixture.result.home_goals, away_goals: fixture.result.away_goals }
      : null,
  }));
  const upcoming = fixtures.filter((fixture) => fixture.date >= today);
  const nextUser = upcoming.find(
    (fixture) =>
      fixture.home_team_id === state.manager.team_id ||
      fixture.away_team_id === state.manager.team_id,
  );
  return {
    competition_id: league?.id ?? ONBOARDING_LEAGUE_ID,
    competition_name: league?.name ?? "Premier Division",
    today,
    past_groups: [],
    upcoming_groups: upcoming.map((fixture) => ({
      key: fixture.id,
      date: fixture.date,
      matchday: fixture.matchday,
      competition: fixture.competition,
      is_next_user_match: fixture.id === nextUser?.id,
      fixtures: [fixture],
    })),
    next_user_match_date: nextUser?.date ?? null,
  };
}

export function installOnboardingPreviewIpc(install: typeof mockIPC): void {
  // The shell preview's answers, captured rather than installed, so one handler owns the window.
  let shellHandler: IpcHandler | undefined;
  installShellPreviewIpc((handler) => {
    shellHandler = handler;
  });

  let state: GameStateData | null = null;
  let profiles: ManagerProfile[] = [];

  install(
    (command, payload) => {
      const args = (payload ?? {}) as Record<string, unknown>;
      switch (command) {
        // ---- title screen -------------------------------------------------
        case "get_active_game":
          // No career is installed when the preview opens: the title screen stays the front door.
          throw new Error("be.error.noActiveGame");
        case "get_manager_profiles":
          return profiles;
        case "save_manager_profile": {
          const profile: ManagerProfile = {
            id: `profile-${profiles.length + 1}`,
            first_name: String(args.firstName ?? ""),
            last_name: String(args.lastName ?? ""),
            date_of_birth: "",
            nationality: String(args.nationality ?? ""),
            created_at: new Date().toISOString(),
            last_used_at: null,
          };
          profiles = [...profiles, profile];
          return profile;
        }
        case "update_manager_profile":
          return profiles[0] ?? null;
        case "delete_manager_profile":
          profiles = profiles.filter((profile) => profile.id !== args.id);
          return null;
        case "list_installed_packages":
          return previewPackages();
        case "check_package_stack":
          return [];
        case "get_saves":
          return [];
        case "crash_notice":
          return null;
        case "get_settings":
          return {
            settings: { theme: "dark", language: "en", currency: "GBP" },
            currency: { code: "GBP", symbol: "£", exchange_rate: 1 },
            supported_currencies: [
              { code: "GBP", symbol: "£", exchange_rate: 1 },
              { code: "EUR", symbol: "€", exchange_rate: 1.17 },
              { code: "USD", symbol: "$", exchange_rate: 1.28 },
            ],
          };
        case "get_nations":
          return NATIONS;

        // ---- the appointment, committed once ------------------------------
        case "start_new_game":
          state = createOnboardingGameState({
            firstName: String(args.firstName ?? ""),
            lastName: String(args.lastName ?? ""),
            nationality: String(args.nationality ?? ""),
          });
          return state;
        case "get_team_selection_ratings":
          return state ? ratingsFor(state) : { clubs: [] };
        case "get_active_save_id":
          return ONBOARDING_SAVE_ID;
        case "get_career_stage":
          if (!state) throw new Error("be.error.noActiveGame");
          return state.manager.team_id ? "employed" : "awaitingClub";
        case "select_team": {
          if (!state) throw new Error("be.error.noActiveGame");
          if (state.manager.team_id) throw new Error("be.error.teamAlreadySelected");
          state = appointManager(
            state,
            String(args.teamId),
            (args.activeRegionIds as string[]) ?? ["europe"],
            (args.activeCompetitionIds as string[]) ?? [ONBOARDING_LEAGUE_ID],
          );
          return state;
        }

        // ---- the office ---------------------------------------------------
        case "set_play_style": {
          if (!state) throw new Error("be.error.noActiveGame");
          const teamId = state.manager.team_id;
          state = {
            ...state,
            teams: state.teams.map((team) =>
              team.id === teamId ? { ...team, play_style: String(args.playStyle) } : team,
            ),
          };
          return state;
        }
        case "save_game":
          return undefined;
        case "get_squad":
          return state ? state.players.filter((player) => player.team_id === args.teamId) : [];
        case "get_squad_fitness":
          return state ? fitnessFor(state, state.manager.team_id) : null;
        case "get_messages_page":
          return state?.messages ?? [];
        case "get_archived_messages":
          return { items: [], next_before: null };
        case "mark_message_read": {
          if (!state) return [];
          const messages: MessageData[] = state.messages.map((message) =>
            message.id === args.messageId ? { ...message, read: true } : message,
          );
          state = { ...state, messages };
          return messages;
        }
        case "get_schedule":
          return state ? scheduleFor(state) : null;
        case "get_staff":
          return {
            team_staff: [],
            available_staff: [],
            scouting_assignments: [],
            youth_scouting_assignments: [],
          };
        case "get_available_jobs":
          return [];
        case "get_contract_warning_stages":
          return {};
        case "get_teams_directory":
          return (state?.teams ?? []).map((team) => ({
            id: team.id,
            name: team.name,
            short_name: team.short_name,
            city: team.city,
            reputation: team.reputation,
            colors: team.colors,
          }));
        default:
          return shellHandler?.(command, payload);
      }
    },
    { shouldMockEvents: true },
  );
}
