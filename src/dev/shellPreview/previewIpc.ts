import type { mockIPC } from "@tauri-apps/api/mocks";
import type { PlayerSummary } from "../../services/playersService";
import type { PlayerTier } from "../../store/generated/PlayerTier";
import { previewGameState } from "./fixture";

/**
 * The commands the career screens ask the backend for, answered from the preview career. Anything
 * else is declined the way the harness declines it, so a page that starts needing another command
 * says so in the console instead of showing a number nobody computed.
 */

/** One tier per rating, 0-99, the shape the backend's table has. */
function ratingTiers(): PlayerTier[] {
  return Array.from({ length: 100 }, (_, rating): PlayerTier => {
    if (rating >= 85) return "S";
    if (rating >= 75) return "A";
    if (rating >= 60) return "B";
    return "Rest";
  });
}

const GROUP_OF: Record<string, string> = {
  Goalkeeper: "Goalkeeper",
  CenterBack: "Defender",
  LeftBack: "Defender",
  RightBack: "Defender",
  DefensiveMidfielder: "Midfielder",
  CentralMidfielder: "Midfielder",
  AttackingMidfielder: "Midfielder",
  LeftMidfielder: "Midfielder",
  RightMidfielder: "Midfielder",
  LeftWinger: "Attacker",
  RightWinger: "Attacker",
  Striker: "Attacker",
};

/** The grouping the squad list sorts by, in one place per position. */
function positionGroups(): { position: string; group: string; rank: number }[] {
  return Object.keys(GROUP_OF).map((position, index) => ({
    position,
    group: GROUP_OF[position] ?? "Midfielder",
    rank: index,
  }));
}

function overallFor(attributes: Record<string, number>): number {
  const values = Object.values(attributes);
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function summaries(): PlayerSummary[] {
  const teamName = new Map(previewGameState.teams.map((team) => [team.id, team.name]));
  return previewGameState.players
    .filter((player) => !player.retired)
    .map((player) => ({
      id: player.id,
      full_name: player.full_name,
      match_name: player.match_name,
      date_of_birth: player.date_of_birth,
      age: 2026 - Number(player.date_of_birth.slice(0, 4)),
      wage: { kind: "exact" as const, weekly: player.wage },
      nationality: player.nationality,
      position: player.position,
      natural_position: player.natural_position,
      team_id: player.team_id,
      team_name: (player.team_id && teamName.get(player.team_id)) || null,
      market_value: player.market_value,
      ovr: overallFor(player.attributes as unknown as Record<string, number>),
      transfer_listed: false,
      loan_listed: false,
      injured: player.injury !== null,
      retired: player.retired,
      media: { face: null },
    }));
}

interface PreviewPlayersQuery {
  search?: string | null;
  position?: string | null;
  page?: number;
  page_size?: number;
}

/** A page of the same summaries, filtered the way the market's search field filters. */
function playersPage(query: PreviewPlayersQuery | undefined) {
  const all = summaries();
  const search = (query?.search ?? "").toLowerCase();
  const position = query?.position ?? null;
  const matching = all.filter(
    (player) =>
      (search === "" || player.full_name.toLowerCase().includes(search)) &&
      (position === null || player.position === position || player.natural_position === position),
  );
  const pageSize = query?.page_size ?? 25;
  const page = query?.page ?? 1;
  return {
    items: matching.slice((page - 1) * pageSize, page * pageSize),
    status_counts: {
      all: all.length,
      transfer: 0,
      loan: 0,
      free_agent: 0,
      available: all.length,
    },
    total: matching.length,
    page,
    page_size: pageSize,
  };
}

export function installShellPreviewIpc(install: typeof mockIPC): void {
  install((command, payload) => {
    const args = (payload ?? {}) as Record<string, never>;
    switch (command) {
      case "get_squad":
        return previewGameState.players;
      case "get_squad_fitness":
        return {
          players: previewGameState.players.length,
          average_condition: 81,
          average_status: null,
          exhausted_count: 1,
          critical_count: 0,
          statuses: {},
        };
      case "get_rating_tiers":
        return ratingTiers();
      case "get_position_groups":
        return positionGroups();
      case "get_players_page":
        return playersPage(args.query as PreviewPlayersQuery | undefined);
      case "get_available_jobs":
        return [];
      case "get_staff":
        return [];
      // Nobody in the preview career is near the end of a contract, so the map is simply empty.
      case "get_contract_warning_stages":
        return {};
      case "get_teams_directory":
        return previewGameState.teams.map((team) => ({
          id: team.id,
          name: team.name,
          short_name: team.short_name,
          city: team.city,
          reputation: team.reputation,
          colors: team.colors,
        }));
      default:
        return undefined;
    }
  });
}
