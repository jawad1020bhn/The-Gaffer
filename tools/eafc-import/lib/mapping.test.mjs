import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  alternatePositions,
  attributesFor,
  cleanLeagueName,
  contractEnd,
  countryLabelOf,
  decodeEaDate,
  financeRange,
  footedness,
  hexColor,
  isSpecificPosition,
  nationCode,
  playStyle,
  playerId,
  positionFor,
  reputationRange,
  seasonStartMonth,
  shortName,
  slugify,
  weeklyWage,
} from "./mapping.mjs";

describe("decodeEaDate", () => {
  it("decodes the day count against known birthdates", () => {
    // Ground truth: real players whose EA ids and birthdates are known.
    assert.equal(decodeEaDate(146), null);
    assert.equal(decodeEaDate(145160), "1980-03-21"); // Ronaldinho
    assert.equal(decodeEaDate(146942), "1985-02-05"); // Cristiano Ronaldo
    assert.equal(decodeEaDate(147811), "1987-06-24"); // Lionel Messi
  });

  it("treats an empty or impossible field as unknown", () => {
    assert.equal(decodeEaDate(0), null);
    assert.equal(decodeEaDate(undefined), null);
    assert.equal(decodeEaDate(Number.NaN), null);
  });
});

describe("positions", () => {
  it("maps every code the FC databases use", () => {
    const cases = {
      0: "Goalkeeper",
      3: "RightBack",
      5: "CenterBack",
      7: "LeftBack",
      10: "DefensiveMidfielder",
      12: "RightMidfielder",
      14: "CentralMidfielder",
      16: "LeftMidfielder",
      18: "AttackingMidfielder",
      23: "RightWinger",
      25: "Striker",
      27: "LeftWinger",
    };
    for (const [code, expected] of Object.entries(cases)) {
      assert.equal(positionFor({ preferredposition1: Number(code) }), expected);
    }
  });

  it("falls back to the attribute profile for an unknown code", () => {
    assert.equal(positionFor({ preferredposition1: 99, gkdiving: 80 }), "Goalkeeper");
    assert.equal(
      positionFor({ preferredposition1: 99, standingtackle: 80, slidingtackle: 80 }),
      "CenterBack",
    );
    assert.equal(positionFor({ preferredposition1: 99, finishing: 85 }), "Striker");
  });

  it("treats Goalkeeper as a general group, not a specific position", () => {
    assert.equal(isSpecificPosition("Goalkeeper"), false);
    assert.equal(isSpecificPosition("Striker"), true);
  });
});

describe("alternatePositions", () => {
  it("maps, de-duplicates and drops the player's own position", () => {
    const player = {
      preferredposition1: 25,
      preferredposition2: 27,
      preferredposition3: 27,
      preferredposition4: 25,
      preferredposition5: -1,
      preferredposition6: 99,
    };
    assert.deepEqual(alternatePositions(player), ["LeftWinger"]);
  });

  it("caps the list at three", () => {
    const player = {
      preferredposition1: 14,
      preferredposition2: 3,
      preferredposition3: 5,
      preferredposition4: 7,
      preferredposition5: 10,
      preferredposition6: 23,
    };
    assert.equal(alternatePositions(player).length, 3);
  });
});

describe("attributesFor", () => {
  it("writes all 19 attributes and clamps them into 1-99", () => {
    const attributes = attributesFor({
      acceleration: 90,
      sprintspeed: 80,
      stamina: 0,
      strength: 120,
      agility: 70,
      shortpassing: 80,
      longpassing: 70,
      vision: 60,
      finishing: 50,
      shotpower: 60,
      longshots: 70,
      standingtackle: 40,
      slidingtackle: 30,
      dribbling: 85,
      ballcontrol: 75,
      defensiveawareness: 20,
      interceptions: 30,
      headingaccuracy: 40,
      positioning: 55,
      reactions: 65,
      composure: 60,
      aggression: 45,
      internationalrep: 3,
      gkhandling: 10,
      gkreflexes: 15,
      jumping: 50,
    });
    assert.equal(Object.keys(attributes).length, 19);
    assert.equal(attributes.pace, 85);
    assert.equal(attributes.stamina, 1);
    assert.equal(attributes.strength, 99);
    assert.equal(attributes.passing, 70);
    assert.equal(attributes.tackling, 35);
    for (const value of Object.values(attributes)) {
      assert.ok(Number.isInteger(value) && value >= 1 && value <= 99);
    }
  });
});

describe("nationCode", () => {
  it("splits the home nations out of GB", () => {
    assert.equal(nationCode("GB", "England"), "ENG");
    assert.equal(nationCode("GB", "Scotland"), "SCO");
    assert.equal(nationCode("GB", "Wales"), "WAL");
    assert.equal(nationCode("GB", "Northern Ireland"), "NIR");
  });

  it("maps codes EA still ships for dissolved states", () => {
    assert.equal(nationCode("AN", "Netherlands Antilles"), "CW");
    assert.equal(nationCode("YU", "Yugoslavia"), "RS");
    assert.equal(nationCode("es", "Spain"), "ES");
  });
});

describe("countryLabelOf", () => {
  it("recognises the nation name and EA's own short labels", () => {
    assert.equal(countryLabelOf("England Premier League", "England"), "England");
    assert.equal(countryLabelOf("USA Major League Soccer", "United States"), "USA");
    assert.equal(countryLabelOf("Holland Eredivisie", "Netherlands"), "Holland");
    assert.equal(countryLabelOf("Korea K League 1", "South Korea"), "Korea");
  });

  it("returns null when the name carries no country", () => {
    assert.equal(countryLabelOf("CONMEBOL Libertadores", "Brazil"), null);
  });
});

describe("presentation helpers", () => {
  it("formats colours", () => {
    assert.equal(hexColor(218, 26, 53), "#da1a35");
    assert.equal(hexColor(300, -5, 0), "#ff0000");
    assert.equal(hexColor(undefined, 1, 2, "#000000"), "#000000");
  });

  it("slugs names with non-ASCII characters", () => {
    assert.equal(slugify("Bayern München"), "bayern-munchen");
    assert.equal(slugify("Kylian Mbappé"), "kylian-mbappe");
    assert.equal(slugify("Bodø/Glimt"), "bodo-glimt");
    assert.equal(slugify("Fußball Club"), "fussball-club");
    assert.equal(slugify("  "), "");
  });

  it("cleans league names and derives short names", () => {
    assert.equal(cleanLeagueName("England Premier League (1)"), "England Premier League");
    assert.equal(shortName("ARS", "Arsenal"), "ARS");
    assert.equal(shortName("", "Manchester United"), "MU");
    assert.equal(shortName("", "Arsenal"), "ARS");
    assert.equal(shortName("TOOLONG", "Ajax"), "AJA");
  });

  it("bands reputation and budget to the schema's ranges", () => {
    assert.deepEqual(reputationRange(99), [860, 940]);
    assert.deepEqual(reputationRange(0), [50, 50]);
    const [low, high] = financeRange(4_730_000);
    assert.ok(low > 0 && high > low);
    assert.ok(Number.isInteger(low) && Number.isInteger(high));
  });

  it("picks a tactical tendency from the ratings", () => {
    assert.equal(playStyle(90, 70), "Attacking");
    assert.equal(playStyle(70, 90), "Defensive");
    assert.equal(playStyle(80, 80), "Balanced");
  });

  it("reads EA's line height and build-up into a play style", () => {
    // A deep line is a low block, and only a side that scores its way out of it
    // is called a counter-attacking one.
    assert.equal(playStyle(70, 74, { depth: 30 }), "Defensive");
    assert.equal(playStyle(80, 74, { depth: 30 }), "Counter");
    // The highest line presses, unless the side is simply better going forward.
    assert.equal(playStyle(79, 81, { depth: 90 }), "HighPress");
    assert.equal(playStyle(87, 85, { depth: 90 }), "HighPress");
    assert.equal(playStyle(90, 83, { depth: 90 }), "Attacking");
    // Direct build-up at a normal line is a counter side; short build-up keeps the ball.
    assert.equal(playStyle(78, 80, { buildUp: 3 }), "Counter");
    assert.equal(playStyle(79, 78, { buildUp: 3 }), "Counter");
    assert.equal(playStyle(86, 84, { buildUp: 1, depth: 65 }), "Possession");
  });

  it("reads the small value fields", () => {
    assert.equal(footedness(1), "Right");
    assert.equal(footedness(2), "Left");
    assert.equal(contractEnd(2030), "2030-06-30");
    assert.equal(contractEnd(0), null);
    assert.equal(weeklyWage(0), undefined);
    assert.equal(weeklyWage(120000), 120000);
    assert.equal(seasonStartMonth("AR"), 1);
    assert.equal(seasonStartMonth("ENG"), 8);
    assert.equal(seasonStartMonth(undefined), 8);
  });

  it("builds stable player ids", () => {
    assert.equal(playerId("Kylian", "Mbappé", 231747), "kylian-mbappe-231747");
    assert.equal(playerId("", "", 42), "player-42");
  });
});
