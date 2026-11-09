import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  getPlayerName,
  phaseLabel,
  getEventDisplay,
  getEventTypeLabel,
  makeTeamFallback,
  resolveMatchFixture,
} from "./helpers";
import i18n, { i18nReady } from "../../i18n";
import { getTeamTalkOptions, isPersistableSpeed } from "./types";
import type { MatchSnapshot, EnginePlayerData, EngineTeamData } from "./types";
import type { GameStateData } from "../../store/gameStore";

// ---------------------------------------------------------------------------
// Minimal fixtures
// ---------------------------------------------------------------------------

const makePlayer = (overrides: Partial<EnginePlayerData> = {}): EnginePlayerData => {
  const { ovr = 70, ...rest } = overrides;

  return {
    id: "p1",
    name: "Test Player",
    position: "Midfielder",
    ovr,
    condition: 100,
    pace: 70,
    stamina: 70,
    strength: 70,
    agility: 70,
    passing: 70,
    shooting: 70,
    tackling: 70,
    dribbling: 70,
    defending: 70,
    positioning: 70,
    vision: 70,
    decisions: 70,
    composure: 50,
    aggression: 50,
    teamwork: 50,
    leadership: 50,
    handling: 30,
    reflexes: 30,
    aerial: 50,
    traits: [],
    role: "Standard",
    ...rest,
  };
};

const makeTeam = (overrides: Partial<EngineTeamData> = {}): EngineTeamData => ({
  id: "team1",
  name: "Test FC",
  formation: "4-4-2",
  play_style: "Balanced",
  players: [],
  ...overrides,
});

const makeSnapshot = (overrides: Partial<MatchSnapshot> = {}): MatchSnapshot => ({
  phase: "FirstHalf",
  current_minute: 25,
  home_score: 0,
  away_score: 0,
  possession: "Home",
  ball_zone: "Midfield",
  home_team: makeTeam({ id: "home1", players: [makePlayer({ id: "h1", name: "Home Player" })] }),
  away_team: makeTeam({ id: "away1", players: [makePlayer({ id: "a1", name: "Away Player" })] }),
  home_bench: [makePlayer({ id: "hb1", name: "Home Bench" })],
  away_bench: [makePlayer({ id: "ab1", name: "Away Bench" })],
  home_possession_pct: 55,
  away_possession_pct: 45,
  events: [],
  home_subs_made: 0,
  away_subs_made: 0,
  max_subs: 3,
  home_set_pieces: {
    free_kick_taker: null,
    corner_taker: null,
    penalty_taker: null,
    captain: null,
  },
  away_set_pieces: {
    free_kick_taker: null,
    corner_taker: null,
    penalty_taker: null,
    captain: null,
  },
  substitutions: [],
  allows_extra_time: false,
  home_yellows: {},
  away_yellows: {},
  sent_off: [],
  ...overrides,
});

beforeAll(async () => {
  await i18nReady;
});

let defaultLanguage = "en";

beforeAll(() => {
  defaultLanguage = i18n.resolvedLanguage || i18n.language || "en";
});

afterEach(async () => {
  await i18n.changeLanguage(defaultLanguage);
});

// ---------------------------------------------------------------------------
// getPlayerName
// ---------------------------------------------------------------------------

describe("getPlayerName", () => {
  const snapshot = makeSnapshot();

  it("finds player in home team", () => {
    expect(getPlayerName(snapshot, "h1")).toBe("Home Player");
  });

  it("finds player in away team", () => {
    expect(getPlayerName(snapshot, "a1")).toBe("Away Player");
  });

  it("finds player on home bench", () => {
    expect(getPlayerName(snapshot, "hb1")).toBe("Home Bench");
  });

  it("finds player on away bench", () => {
    expect(getPlayerName(snapshot, "ab1")).toBe("Away Bench");
  });

  it("returns empty string for null id", () => {
    expect(getPlayerName(snapshot, null)).toBe("");
  });

  it("returns the id when player not found", () => {
    expect(getPlayerName(snapshot, "unknown_id")).toBe("unknown_id");
  });
});

describe("makeTeamFallback", () => {
  it("builds a short-name fallback for teams without full team data", () => {
    expect(makeTeamFallback("Sporting Club")).toEqual({
      name: "Sporting Club",
      short_name: "SPO",
    });
  });

  it("pads very short team names to three characters", () => {
    expect(makeTeamFallback("FC")).toEqual({
      name: "FC",
      short_name: "FC ",
    });
  });
});

describe("resolveMatchFixture", () => {
  const fixture = (id: string, competition: string, home: string, away: string) => ({
    id,
    matchday: 3,
    date: "2026-08-01",
    home_team_id: home,
    away_team_id: away,
    competition,
    status: "Scheduled",
    result: null,
  });
  const league = {
    id: "league-1",
    name: "League",
    season: 1,
    fixtures: [fixture("other-league-match", "League", "x1", "y1")],
    standings: [],
  };
  const cup = {
    id: "cup-1",
    name: "Cup",
    season: 1,
    fixtures: [fixture("cup-tie", "Cup", "home1", "away1")],
    standings: [],
  };
  const gameState = { league, competitions: [league, cup] } as unknown as GameStateData;

  /**
   * Given a cup tie, which lives in the cup's own competition and never in the league mirror
   * When the match is resolved from the route's competition and fixture ids
   * Then it is the cup tie, found across every competition, not whatever the index lands on in
   *      the league (the index counts the user's competition, not the mirror).
   */
  it("resolves the fixture by its competition and id, across every competition", () => {
    const route = { competitionId: "cup-1", fixtureId: "cup-tie" };

    expect(resolveMatchFixture(gameState, makeSnapshot(), route)?.id).toBe("cup-tie");
  });

  /**
   * Given two fixtures between the same two clubs (a league meeting weeks ago and today's cup tie)
   * When the route names the league meeting
   * Then it is the one named, not today's tie: the id decides, the pairing never overrules it.
   */
  it("resolves the fixture the route names even when another one pairs the same clubs", () => {
    const earlier = fixture("league-meeting", "League", "home1", "away1");
    earlier.date = "2026-03-01";
    const todaysTie = fixture("cup-tie", "Cup", "home1", "away1");
    todaysTie.date = "2026-08-01";
    const game = {
      clock: { current_date: "2026-08-01T12:00:00Z" },
      league: { ...league, fixtures: [earlier] },
      competitions: [
        { ...league, fixtures: [earlier] },
        { ...cup, fixtures: [todaysTie] },
      ],
    } as unknown as GameStateData;

    expect(
      resolveMatchFixture(game, makeSnapshot(), {
        competitionId: "league-1",
        fixtureId: "league-meeting",
      })?.id,
    ).toBe("league-meeting");
  });

  /**
   * Given the same two fixtures and a route that carries no ids
   * When the match is resolved from the two clubs
   * Then it is the one dated today, not the earlier league meeting that happens to come first.
   */
  it("prefers the pairing played today when the route carries no ids", () => {
    const earlier = fixture("league-meeting", "League", "home1", "away1");
    earlier.date = "2026-03-01";
    const todaysTie = fixture("cup-tie", "Cup", "home1", "away1");
    todaysTie.date = "2026-08-01";
    const game = {
      clock: { current_date: "2026-08-01T12:00:00Z" },
      league: { ...league, fixtures: [earlier] },
      competitions: [
        { ...league, fixtures: [earlier] },
        { ...cup, fixtures: [todaysTie] },
      ],
    } as unknown as GameStateData;

    expect(resolveMatchFixture(game, makeSnapshot())?.id).toBe("cup-tie");
  });

  it("falls back to matching the snapshot teams when the route carries no ids", () => {
    expect(resolveMatchFixture(gameState, makeSnapshot())?.id).toBe("cup-tie");
  });

  it("returns null when the route names a fixture the game does not have", () => {
    expect(
      resolveMatchFixture(gameState, makeSnapshot(), { competitionId: "cup-1", fixtureId: "gone" }),
    ).toBeNull();
  });

  it("returns null when there are no competitions at all", () => {
    expect(
      resolveMatchFixture({ league: null } as unknown as GameStateData, makeSnapshot()),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// phaseLabel
// ---------------------------------------------------------------------------

describe("phaseLabel", () => {
  it("maps all known phases in english", async () => {
    await i18n.changeLanguage("en");

    expect(phaseLabel("PreKickOff")).toBe("Pre-Match");
    expect(phaseLabel("FirstHalf")).toBe("1st Half");
    expect(phaseLabel("HalfTime")).toBe("Half Time");
    expect(phaseLabel("SecondHalf")).toBe("2nd Half");
    expect(phaseLabel("FullTime")).toBe("Full Time");
    expect(phaseLabel("ExtraTimeFirstHalf")).toBe("ET 1st Half");
    expect(phaseLabel("ExtraTimeHalfTime")).toBe("ET Half Time");
    expect(phaseLabel("ExtraTimeSecondHalf")).toBe("ET 2nd Half");
    expect(phaseLabel("ExtraTimeEnd")).toBe("ET End");
    expect(phaseLabel("PenaltyShootout")).toBe("Penalties");
    expect(phaseLabel("Finished")).toBe("Final");
  });

  /**
   * Given the shipped language
   * When phase labels are read through the translator
   * Then they come from the catalogue. This ran in Portuguese while the game shipped it; the
   *      point was always that the label is looked up, not written in the helper.
   */
  it("reads phase labels from the catalogue", async () => {
    await i18n.changeLanguage("en");

    const t = i18n.t.bind(i18n);

    expect(phaseLabel("FirstHalf", t)).toBe("1st Half");
    expect(phaseLabel("SecondHalf", t)).toBe("2nd Half");
    expect(phaseLabel("PenaltyShootout", t)).toBe("Penalties");
  });

  it("humanizes unknown phases when no fixed label exists", () => {
    expect(phaseLabel("SomeOtherPhase")).toBe("Some Other Phase");
  });

  it("passes a humanized default value when translating unknown phases", () => {
    const translate = vi.fn((_: string, options?: { defaultValue?: string }) => {
      return options?.defaultValue ?? "";
    });

    expect(phaseLabel("SomeOtherPhase", translate)).toBe("Some Other Phase");
    expect(translate).toHaveBeenCalledWith("match.phases.SomeOtherPhase", {
      defaultValue: "Some Other Phase",
    });
  });
});

// ---------------------------------------------------------------------------
// getEventDisplay
// ---------------------------------------------------------------------------

describe("getEventDisplay", () => {
  it("returns known display for Goal event", () => {
    const display = getEventDisplay({
      minute: 10,
      event_type: "Goal",
      side: "Home",
      zone: "Box",
      player_id: "p1",
      secondary_player_id: null,
    });
    expect(display.color).toBe("text-warning");
    expect(display.important).toBe(true);
  });

  it("returns known display for YellowCard event", () => {
    const display = getEventDisplay({
      minute: 25,
      event_type: "YellowCard",
      side: "Away",
      zone: "Midfield",
      player_id: "p2",
      secondary_player_id: null,
    });
    expect(display.color).toBe("text-warning");
    expect(display.important).toBe(true);
  });

  it("returns known display for ShotSaved (non-important)", () => {
    const display = getEventDisplay({
      minute: 30,
      event_type: "ShotSaved",
      side: "Home",
      zone: "Box",
      player_id: "p1",
      secondary_player_id: null,
    });
    expect(display.color).toBe("text-positive");
    expect(display.important).toBe(false);
  });

  it("returns default display for unknown event type", () => {
    const display = getEventDisplay({
      minute: 1,
      event_type: "UnknownEvent",
      side: "Home",
      zone: "Midfield",
      player_id: null,
      secondary_player_id: null,
    });
    expect(display.color).toBe("text-fg");
    expect(display.important).toBe(false);
  });
});

describe("getEventTypeLabel", () => {
  it("reads event labels from the catalogue", async () => {
    await i18n.changeLanguage("en");

    const t = i18n.t.bind(i18n);

    expect(getEventTypeLabel("Goal", t)).toBe("Goal");
    expect(getEventTypeLabel("SecondHalfStart", t)).toBe("2nd Half Start");
    expect(getEventTypeLabel("PenaltyAwarded", t)).toBe("Penalty Awarded");
  });

  it("falls back to a humanized label for unknown events", async () => {
    await i18n.changeLanguage("en");

    expect(getEventTypeLabel("UnknownEvent")).toBe("Unknown Event");
  });
});

describe("getTeamTalkOptions", () => {
  it("returns the expected english team talk labels and descriptions", async () => {
    await i18n.changeLanguage("en");

    const options = getTeamTalkOptions(i18n.t.bind(i18n));

    expect(options.map((option) => option.id)).toEqual([
      "calm",
      "motivational",
      "assertive",
      "aggressive",
      "praise",
      "disappointed",
    ]);
    expect(options[0]).toEqual({
      id: "calm",
      icon: "calm",
      label: "Stay Calm",
      description: "Keep composure and focus on the game plan.",
    });
    expect(options[5]).toEqual({
      id: "disappointed",
      icon: "disappointed",
      label: "Show Disappointment",
      description: "Express disappointment in their effort.",
    });
  });

  /**
   * Given the shipped language
   * When the team talk options are built
   * Then both the label and the description are read from the catalogue for every option.
   */
  it("reads every team talk label and description from the catalogue", async () => {
    await i18n.changeLanguage("en");

    const options = getTeamTalkOptions(i18n.t.bind(i18n));

    expect(options[3]).toEqual({
      id: "aggressive",
      icon: "aggressive",
      label: "Get Fired Up",
      description: "An aggressive, fiery team talk.",
    });
    for (const option of options) {
      expect(option.label, option.id).not.toContain("match.teamTalkOptions");
      expect(option.description, option.id).not.toContain("match.teamTalkOptions");
    }
  });

  it("returns the motivational and praise options with their own descriptions", async () => {
    await i18n.changeLanguage("en");

    const options = getTeamTalkOptions(i18n.t.bind(i18n));

    expect(options[1]).toEqual({
      id: "motivational",
      icon: "motivational",
      label: "Motivate",
      description: "Inspire the players to give their best.",
    });
    expect(options[4]).toEqual({
      id: "praise",
      icon: "praise",
      label: "Praise",
      description: "Tell them they've been excellent.",
    });
  });
});

describe("isPersistableSpeed", () => {
  it("marks playback speeds as persistable", () => {
    expect(isPersistableSpeed("slow")).toBe(true);
    expect(isPersistableSpeed("normal")).toBe(true);
    expect(isPersistableSpeed("fast")).toBe(true);
  });

  // Locks in the design of #106: `paused` is a temporary action; `instant`
  // is a one-shot skip-to-end-of-half. Persisting either across half-time
  // would either resume paused (surprising) or silently skip the whole
  // second half (worse). Only "slow" / "normal" / "fast" describe a pace
  // worth resuming from.
  it("marks one-shot speeds as non-persistable so they don't resume after half-time", () => {
    expect(isPersistableSpeed("paused")).toBe(false);
    expect(isPersistableSpeed("instant")).toBe(false);
  });
});
