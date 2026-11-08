import type React from "react";
import type { MatchEvent, MatchSnapshot } from "./types";
import type { FixtureData, GameStateData } from "../../store/gameStore";
import {
  Circle,
  CircleOff,
  Square,
  ArrowLeftRight,
  Cross,
  Play,
  Pause,
  Flag,
  Hand,
  ArrowUpRight,
  Shield,
  CornerDownRight,
  Ruler,
  AlertTriangle,
  Zap,
  CircleDot,
} from "lucide-react";

export const EVENT_ICONS: Record<
  string,
  { icon: React.ReactNode; color: string; important: boolean }
> = {
  Goal: {
    icon: <Circle className="w-4 h-4 fill-current" />,
    color: "text-warning",
    important: true,
  },
  PenaltyGoal: {
    icon: <CircleDot className="w-4 h-4" />,
    color: "text-warning",
    important: true,
  },
  PenaltyMiss: {
    icon: <CircleOff className="w-4 h-4" />,
    color: "text-danger",
    important: true,
  },
  ShootoutGoal: {
    icon: <CircleDot className="w-4 h-4" />,
    color: "text-warning",
    important: true,
  },
  ShootoutMiss: {
    icon: <CircleOff className="w-4 h-4" />,
    color: "text-danger",
    important: true,
  },
  YellowCard: {
    icon: <Square className="w-3.5 h-3.5 fill-warning-solid text-warning" />,
    color: "text-warning",
    important: true,
  },
  RedCard: {
    icon: <Square className="w-3.5 h-3.5 fill-danger-solid text-danger" />,
    color: "text-danger",
    important: true,
  },
  SecondYellow: {
    icon: <Square className="w-3.5 h-3.5 fill-danger-solid text-danger" />,
    color: "text-danger",
    important: true,
  },
  Substitution: {
    icon: <ArrowLeftRight className="w-4 h-4" />,
    color: "text-info",
    important: true,
  },
  Injury: {
    icon: <Cross className="w-4 h-4" />,
    color: "text-danger",
    important: true,
  },
  KickOff: {
    icon: <Play className="w-3.5 h-3.5 fill-current" />,
    color: "text-fg",
    important: true,
  },
  HalfTime: {
    icon: <Pause className="w-3.5 h-3.5" />,
    color: "text-fg",
    important: true,
  },
  SecondHalfStart: {
    icon: <Play className="w-3.5 h-3.5 fill-current" />,
    color: "text-fg",
    important: true,
  },
  FullTime: {
    icon: <Flag className="w-4 h-4" />,
    color: "text-fg",
    important: true,
  },
  ShotSaved: {
    icon: <Hand className="w-4 h-4" />,
    color: "text-positive",
    important: false,
  },
  ShotOffTarget: {
    icon: <ArrowUpRight className="w-4 h-4" />,
    color: "text-fg",
    important: false,
  },
  ShotBlocked: {
    icon: <Shield className="w-4 h-4" />,
    color: "text-fg",
    important: false,
  },
  Corner: {
    icon: <CornerDownRight className="w-4 h-4" />,
    color: "text-fg",
    important: false,
  },
  FreeKick: {
    icon: <Ruler className="w-4 h-4" />,
    color: "text-fg",
    important: false,
  },
  Foul: {
    icon: <AlertTriangle className="w-4 h-4" />,
    color: "text-warning",
    important: false,
  },
  PenaltyAwarded: {
    icon: <Zap className="w-4 h-4" />,
    color: "text-warning",
    important: true,
  },
};

const DEFAULT_DISPLAY = {
  icon: <Circle className="w-3 h-3" />,
  color: "text-fg",
  important: false,
};

const PHASE_LABELS: Record<string, string> = {
  PreKickOff: "Pre-Match",
  FirstHalf: "1st Half",
  HalfTime: "Half Time",
  SecondHalf: "2nd Half",
  FullTime: "Full Time",
  ExtraTimeFirstHalf: "ET 1st Half",
  ExtraTimeHalfTime: "ET Half Time",
  ExtraTimeSecondHalf: "ET 2nd Half",
  ExtraTimeEnd: "ET End",
  PenaltyShootout: "Penalties",
  Finished: "Final",
};

function humanizeEventType(eventType: string): string {
  return eventType.replace(/([A-Z])/g, " $1").trim();
}

type TranslateFn = (key: string, options?: { defaultValue?: string }) => string;

export function makeTeamFallback(teamName: string) {
  return {
    name: teamName,
    short_name: teamName.substring(0, 3).toUpperCase().padEnd(3, " "),
  };
}

export function getEventDisplay(evt: MatchEvent) {
  return EVENT_ICONS[evt.event_type] || DEFAULT_DISPLAY;
}

export function getEventTypeLabel(eventType: string, t?: TranslateFn): string {
  const fallbackLabel = humanizeEventType(eventType);

  return t ? t(`match.eventTypes.${eventType}`, { defaultValue: fallbackLabel }) : fallbackLabel;
}

export function getPlayerName(snapshot: MatchSnapshot, playerId: string | null): string {
  if (!playerId) return "";
  for (const p of snapshot.home_team.players) {
    if (p.id === playerId) return p.name;
  }
  for (const p of snapshot.away_team.players) {
    if (p.id === playerId) return p.name;
  }
  // Also check bench players
  if (snapshot.home_bench) {
    for (const p of snapshot.home_bench) {
      if (p.id === playerId) return p.name;
    }
  }
  if (snapshot.away_bench) {
    for (const p of snapshot.away_bench) {
      if (p.id === playerId) return p.name;
    }
  }
  return playerId;
}

export function phaseLabel(phase: string, t?: TranslateFn): string {
  const fallbackLabel = PHASE_LABELS[phase] ?? humanizeEventType(phase);

  return t ? t(`match.phases.${phase}`, { defaultValue: fallbackLabel }) : fallbackLabel;
}

/** Which fixture a match screen was opened for, as its route names it. */
export interface MatchRoute {
  competitionId?: string;
  fixtureId?: string;
}

/**
 * The fixture the user played. The route's competition and fixture ids identify it, and it is
 * looked up across every competition: a cup tie lives in its own competition and never in the
 * league mirror, and the backend's fixture index counts the user's competition, so indexing the
 * league would land on a match between other clubs. Without ids (a route that carries none) the
 * fixture is the one between the snapshot's two clubs, today's if they meet more than once.
 */
export function resolveMatchFixture(
  gameState: GameStateData | null,
  snapshot: MatchSnapshot | null,
  route?: MatchRoute,
): FixtureData | null {
  if (!gameState || !snapshot) return null;

  const competitions = [
    ...(gameState.competitions ?? []),
    ...(gameState.league ? [gameState.league] : []),
  ];

  if (route?.competitionId && route.fixtureId) {
    return (
      competitions
        .filter((competition) => competition.id === route.competitionId)
        .flatMap((competition) => competition.fixtures)
        .find((fixture) => fixture.id === route.fixtureId) ?? null
    );
  }

  // The two clubs may meet in more than one competition: the one played today is the match.
  const today = gameState.clock?.current_date?.slice(0, 10);
  const pairings = competitions
    .flatMap((competition) => competition.fixtures)
    .filter(
      (fixture) =>
        fixture.home_team_id === snapshot.home_team.id &&
        fixture.away_team_id === snapshot.away_team.id,
    );
  return pairings.find((fixture) => fixture.date === today) ?? pairings[0] ?? null;
}
