import type { GameStateData } from "../../store/gameStore";
import type { EnginePlayerData, MatchEvent, MatchSnapshot } from "../../store/liveMatchTypes";
import { previewGameState } from "../shellPreview/fixture";

/**
 * A match in progress on the preview career, for `?preview=match`.
 *
 * Dev only: the live screen needs a backend session, so this is the one way to look at it in a
 * browser. Nothing here advances — the stub answers every step with the same scoreline — so the
 * screen shows one frame of a match 67 minutes old.
 */

const HOME_ID = "harbour-city";
const AWAY_ID = "northgate-united";

function enginePlayer(
  index: number,
  name: string,
  position: string,
  role: string,
): EnginePlayerData {
  return {
    id: `preview-${index}`,
    name,
    position,
    ovr: 60 + ((index * 7) % 30),
    condition: 70 + ((index * 7) % 30),
    pace: 60 + ((index * 5) % 35),
    stamina: 62 + ((index * 3) % 33),
    strength: 58 + ((index * 4) % 35),
    agility: 60 + ((index * 6) % 33),
    passing: 61 + ((index * 7) % 34),
    shooting: 55 + ((index * 9) % 40),
    tackling: 57 + ((index * 2) % 38),
    dribbling: 60 + ((index * 8) % 34),
    defending: 55 + ((index * 5) % 38),
    positioning: 63 + ((index * 3) % 32),
    vision: 60 + ((index * 4) % 35),
    decisions: 62 + ((index * 6) % 33),
    composure: 61 + ((index * 2) % 34),
    aggression: 50 + ((index * 10) % 40),
    teamwork: 64 + ((index * 5) % 32),
    leadership: 50 + ((index * 9) % 40),
    handling: 40 + ((index * 3) % 45),
    reflexes: 40 + ((index * 4) % 45),
    aerial: 55 + ((index * 6) % 38),
    traits: [],
    role,
  };
}

const HOME_NAMES = [
  "Adam Ferreira",
  "Lucas Brandt",
  "Milan Novak",
  "Owen Hartley",
  "Diego Salas",
  "Tomas Keller",
  "Ruben Duarte",
  "Noah Lindqvist",
  "Isaac Mensah",
  "Yuri Petrov",
  "Sam Okafor",
];
const AWAY_NAMES = [
  "Felix Moreau",
  "Jonas Weber",
  "Elias Nunes",
  "Kai Rutherford",
  "Andre Costa",
  "Marco Silvestri",
  "Ben Whitlock",
  "Callum Reyes",
  "Dario Fontana",
  "Nils Berg",
  "Oscar Lindgren",
];

const HOME_POSITIONS = [
  "Goalkeeper",
  "CenterBack",
  "CenterBack",
  "CenterBack",
  "LeftBack",
  "RightBack",
  "DefensiveMidfielder",
  "CentralMidfielder",
  "CentralMidfielder",
  "LeftWinger",
  "Striker",
];
const AWAY_POSITIONS = HOME_POSITIONS;

const homeXI = HOME_NAMES.map((name, i) =>
  enginePlayer(i, name, HOME_POSITIONS[i] ?? "Midfielder", "Support"),
);
const awayXI = AWAY_NAMES.map((name, i) =>
  enginePlayer(20 + i, name, AWAY_POSITIONS[i] ?? "Midfielder", "Support"),
);

const homeBench = [
  enginePlayer(40, "Rui Baptista", "Striker", "Attack"),
  enginePlayer(41, "Kofi Mensah", "CenterBack", "Defend"),
];
const awayBench = [
  enginePlayer(42, "Tim Visser", "Striker", "Attack"),
  enginePlayer(43, "Jon Dahl", "CenterBack", "Defend"),
];

function event(
  minute: number,
  event_type: string,
  side: "Home" | "Away",
  player_id: string | null,
  zone = "Midfield",
): MatchEvent {
  return { minute, event_type, side, zone, player_id, secondary_player_id: null };
}

export const previewMatchEvents: MatchEvent[] = [
  event(1, "KickOff", "Home", null),
  event(9, "ShotOffTarget", "Home", "preview-10", "FinalThird"),
  event(14, "Corner", "Home", "preview-8", "FinalThird"),
  event(18, "Foul", "Away", "preview-26", "MiddleThird"),
  event(23, "Goal", "Home", "preview-10", "Box"),
  event(31, "ShotSaved", "Away", "preview-24", "Box"),
  event(38, "YellowCard", "Away", "preview-27", "MiddleThird"),
  event(45, "HalfTime", "Home", null),
  event(46, "SecondHalfStart", "Home", null),
  event(52, "Corner", "Away", "preview-23", "FinalThird"),
  event(55, "ShotBlocked", "Home", "preview-9", "Box"),
  event(58, "Goal", "Away", "preview-24", "Box"),
  event(62, "Foul", "Home", "preview-5", "DefensiveThird"),
  event(64, "ShotSaved", "Home", "preview-11", "Box"),
  event(66, "Corner", "Home", "preview-8", "FinalThird"),
];

export const previewSnapshot: MatchSnapshot = {
  phase: "SecondHalf",
  current_minute: 67,
  home_score: 1,
  away_score: 1,
  possession: "Home",
  ball_zone: "MiddleThird",
  home_team: {
    id: HOME_ID,
    name: "Harbour City",
    formation: "4-3-3",
    play_style: "Attacking",
    players: homeXI,
  },
  away_team: {
    id: AWAY_ID,
    name: "Northgate United",
    formation: "4-4-2",
    play_style: "Balanced",
    players: awayXI,
  },
  home_bench: homeBench,
  away_bench: awayBench,
  home_possession_pct: 58,
  away_possession_pct: 42,
  events: previewMatchEvents,
  home_subs_made: 1,
  away_subs_made: 0,
  max_subs: 5,
  home_set_pieces: {
    free_kick_taker: "preview-8",
    corner_taker: "preview-8",
    penalty_taker: "preview-10",
    captain: "preview-6",
  },
  away_set_pieces: {
    free_kick_taker: "preview-27",
    corner_taker: "preview-27",
    penalty_taker: "preview-24",
    captain: "preview-26",
  },
  substitutions: [],
  allows_extra_time: false,
  home_yellows: {},
  away_yellows: { "preview-27": 1 },
  sent_off: [],
};

/** The preview career, with the preview clubs in it so the shell's team colours resolve. */
export const previewMatchGame: GameStateData = previewGameState;
