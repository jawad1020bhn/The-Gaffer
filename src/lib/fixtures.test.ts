import { afterAll, beforeAll, describe, expect, it } from "vitest";

import i18n, { i18nReady } from "../i18n";
import type { FixtureCompetition } from "../store/types";
import { getFixtureCompetitionName, getFixtureDisplayLabel } from "./fixtures";

let previousLanguage: string;

beforeAll(async () => {
  await i18nReady;
  previousLanguage = i18n.language;
  await i18n.changeLanguage("en");
});

afterAll(async () => {
  await i18n.changeLanguage(previousLanguage);
});

function label(competition: FixtureCompetition, competitionName?: string): string {
  return getFixtureDisplayLabel(i18n.t, { competition, matchday: 3 }, competitionName);
}

describe("getFixtureDisplayLabel", () => {
  it("labels a league fixture with its matchday", () => {
    expect(label("League", "Premier Division")).toBe("Matchday 3");
  });

  it("labels friendlies and pre-season tournaments by what they are", () => {
    expect(label("Friendly", "Premier Division")).toBe("Friendly");
    expect(label("PreseasonTournament")).toBe("Preseason Tournament");
  });

  it.each<[FixtureCompetition, string]>([
    ["Cup", "Cup"],
    ["ContinentalClub", "Continental Club"],
    ["InternationalClub", "International Club"],
    ["InternationalNation", "International Nation"],
    ["FriendlyCup", "Friendly Cup"],
  ])("labels a %s fixture by its competition kind when the name is unknown", (kind, expected) => {
    expect(label(kind)).toBe(expected);
  });

  it.each<FixtureCompetition>([
    "Cup",
    "ContinentalClub",
    "InternationalClub",
    "InternationalNation",
    "FriendlyCup",
  ])("labels a %s fixture with its competition name when one is given", (kind) => {
    expect(label(kind, "Copa Libertadores")).toBe("Copa Libertadores");
  });
});

describe("getFixtureCompetitionName", () => {
  /**
   * Given a competition whose stored name is the English template "2026 World Cup"
   * When its name is resolved
   * Then the season is interpolated through the key, so the name follows the active language
   *      rather than the string the save happens to carry. Portuguese carried this case while
   *      the game shipped it.
   */
  it("resolves a named World Cup through its key", () => {
    const gameState = {
      competitions: [
        {
          id: "world-cup-2026",
          name: "2026 World Cup",
          name_key: "tournaments.competitions.worldCup",
          season: 2026,
          fixtures: [],
          standings: [],
        },
      ],
    };

    expect(
      getFixtureCompetitionName(
        gameState,
        { competition_id: "world-cup-2026" },
        i18n.getFixedT("en"),
      ),
    ).toBe("2026 World Cup");
  });
});
