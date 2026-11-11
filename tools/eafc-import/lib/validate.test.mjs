/**
 * The importer's own check of a competition's format and qualification rules.
 *
 * `ofm-cli validate` is the authority, and it is Rust: it runs in CI, not where
 * the importer is usually run. These are the rules the loader would reject a
 * package for that the importer now has the means to break, since it writes
 * group stages and berths: a berth into a competition that is not there, a
 * group stage no field can fill, a start date that is not a date. Each case is
 * a package of four clubs and two or three competitions, with one thing wrong.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validatePackage } from "../validate.mjs";

const CLUBS = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot"];

const league = (overrides = {}) => ({
  schema: "competition",
  id: "first-division",
  name: "First Division",
  type: "League",
  scope: "Domestic",
  countryId: "ENG",
  regionId: "europe",
  priority: 0,
  format: { kind: "LeagueTable", legs: 2 },
  participants: { explicit: CLUBS },
  ...overrides,
});

const cup = (overrides = {}) => ({
  schema: "competition",
  id: "national-cup",
  name: "National Cup",
  type: "Cup",
  scope: "Domestic",
  countryId: "ENG",
  regionId: "europe",
  priority: 1,
  format: { kind: "Knockout" },
  participants: { explicit: CLUBS },
  ...overrides,
});

const continental = (overrides = {}) => ({
  schema: "competition",
  id: "champions-cup",
  name: "Champions Cup",
  type: "ContinentalClub",
  scope: "Continental",
  regionId: "europe",
  requiredRegionIds: ["europe"],
  priority: 0,
  format: { kind: "GroupAndKnockout", legs: 2, groupSize: 3, qualifiersPerGroup: 1 },
  participants: { explicit: CLUBS },
  ...overrides,
});

/** The problems a package of these competitions has, as `where: message` lines. */
function problemsOf(...competitions) {
  const documents = [
    { schema: "world", id: "test-world", name: "Test", version: "1.0.0", license: "CC0-1.0" },
    {
      schema: "team",
      items: CLUBS.map((id) => ({
        id,
        name: id,
        city: "Town",
        country: "ENG",
        colors: { primary: "#112233", secondary: "#ffffff" },
      })),
    },
    { schema: "competition", items: competitions },
  ];
  return validatePackage({
    documents,
    countryCodes: new Set(["ENG"]),
    regionIds: new Set(["europe", "asia"]),
  }).map((problem) => `${problem.where}: ${problem.message}`);
}

const range = (target, from, to) => ({ target, rule: { kind: "positionRange", from, to } });
const winner = (target) => ({ target, rule: { kind: "cupWinner" } });

describe("a package the loader accepts", () => {
  it("has no problems", () => {
    assert.deepEqual(
      problemsOf(
        league({ berths: [range("champions-cup", 1, 2)] }),
        cup({ berths: [winner("champions-cup")] }),
        continental(),
      ),
      [],
    );
  });

  it("may name a berth target that is listed later, and a fallback", () => {
    assert.deepEqual(
      problemsOf(
        league({ berths: [{ ...range("champions-cup", 1, 1), fallbackTo: "national-cup" }] }),
        cup(),
        continental(),
      ),
      [],
    );
  });
});

describe("berths", () => {
  it("must name a competition in the package", () => {
    assert.deepEqual(problemsOf(league({ berths: [range("nowhere", 1, 2)] })), [
      'competition:first-division: berth names unknown competition "nowhere"',
    ]);
    assert.deepEqual(
      problemsOf(
        league({ berths: [{ ...range("national-cup", 1, 1), fallbackTo: "gone" }] }),
        cup(),
      ),
      ['competition:first-division: berth names unknown competition "gone"'],
    );
    assert.deepEqual(
      problemsOf(league({ berths: [{ rule: { kind: "positionRange", from: 1, to: 1 } }] })),
      ['competition:first-division: berth names unknown competition "undefined"'],
    );
  });

  it("cannot point at their own competition", () => {
    // The engine reads this as a berth-fed league and takes it off its ladder.
    assert.deepEqual(problemsOf(league({ berths: [range("first-division", 1, 1)] })), [
      "competition:first-division: a berth cannot point at its own competition",
    ]);
  });

  it("need a range that starts at 1 or later and does not run backwards", () => {
    assert.deepEqual(problemsOf(league({ berths: [range("national-cup", 0, 2)] }), cup()), [
      "competition:first-division: berth range 0-2 is not valid",
    ]);
    assert.deepEqual(problemsOf(league({ berths: [range("national-cup", 3, 2)] }), cup()), [
      "competition:first-division: berth range 3-2 is not valid",
    ]);
    assert.deepEqual(problemsOf(league({ berths: [range("national-cup", 1)] }), cup()), [
      "competition:first-division: berth range 1-undefined is not valid",
    ]);
  });

  it("by league position need a league table", () => {
    assert.deepEqual(problemsOf(cup({ berths: [range("champions-cup", 1, 1)] }), continental()), [
      "competition:national-cup: a positionRange berth needs a LeagueTable format",
    ]);
  });

  it("for a winner need a knockout", () => {
    assert.deepEqual(problemsOf(league({ berths: [winner("champions-cup")] }), continental()), [
      "competition:first-division: a cupWinner berth needs a Knockout or GroupAndKnockout format",
    ]);
    // A competition with groups ends in a knockout, so it has a winner too.
    assert.deepEqual(problemsOf(continental({ berths: [winner("national-cup")] }), cup()), []);
  });

  it("for a play-off need two places", () => {
    const playoff = (from, to) => ({
      target: "national-cup",
      rule: { kind: "playoffWinner", from, to },
    });
    assert.deepEqual(problemsOf(league({ berths: [playoff(3, 6)] }), cup()), []);
    assert.deepEqual(problemsOf(league({ berths: [playoff(3, 3)] }), cup()), [
      "competition:first-division: a play-off berth needs at least 2 places",
    ]);
  });

  it("need a rule the engine knows", () => {
    assert.deepEqual(
      problemsOf(
        league({ berths: [{ target: "national-cup", rule: { kind: "runnerUp" } }] }),
        cup(),
      ),
      ['competition:first-division: unknown berth rule "runnerUp"'],
    );
  });
});

describe("formats", () => {
  it("cannot set group sizes on a competition without groups", () => {
    assert.deepEqual(problemsOf(cup({ format: { kind: "Knockout", groupSize: 4 } })), [
      "competition:national-cup: format Knockout has no groups, but group settings are set",
    ]);
    assert.deepEqual(
      problemsOf(league({ format: { kind: "LeagueTable", qualifiersPerGroup: 2 } })),
      ["competition:first-division: format LeagueTable has no groups, but group settings are set"],
    );
  });

  it("need at least one leg", () => {
    assert.deepEqual(problemsOf(league({ format: { kind: "LeagueTable", legs: 0 } })), [
      "competition:first-division: format.legs 0 must be at least 1",
    ]);
  });

  it("need groups of at least two", () => {
    assert.deepEqual(
      problemsOf(
        continental({ format: { kind: "GroupAndKnockout", groupSize: 1, qualifiersPerGroup: 1 } }),
      ),
      ["competition:champions-cup: format.groupSize 1 must be at least 2"],
    );
  });

  it("need groups that can supply their qualifiers", () => {
    // Six clubs in groups of four are two groups of three; four cannot go through.
    assert.deepEqual(
      problemsOf(
        continental({ format: { kind: "GroupAndKnockout", groupSize: 4, qualifiersPerGroup: 4 } }),
      ),
      ["competition:champions-cup: groups of 4 with 4 qualifiers do not fit 6 clubs"],
    );
    assert.deepEqual(
      problemsOf(
        continental({ format: { kind: "GroupAndKnockout", groupSize: 4, qualifiersPerGroup: 3 } }),
      ),
      [],
    );
  });

  it("fall back to the engine's groups of four with two qualifiers", () => {
    assert.deepEqual(problemsOf(continental({ format: { kind: "GroupAndKnockout" } })), []);
    assert.deepEqual(
      problemsOf(
        continental({ format: { kind: "GroupAndKnockout", groupSize: 2, qualifiersPerGroup: 2 } }),
      ),
      [],
    );
    // Groups of two, and the default of two qualifiers plus an extra nobody is left to be.
    assert.deepEqual(
      problemsOf(
        continental({ format: { kind: "GroupAndKnockout", groupSize: 2, bestThirdQualifiers: 1 } }),
      ),
      ["competition:champions-cup: groups of 2 with 2 qualifiers do not fit 6 clubs"],
    );
  });

  it("accept a league phase of fewer matches than a group has clubs, and no legs", () => {
    const phase = (extra) =>
      continental({
        format: { kind: "GroupAndKnockout", groupSize: 6, qualifiersPerGroup: 4, ...extra },
      });
    assert.deepEqual(problemsOf(phase({ rounds: 3 })), []);
    assert.deepEqual(problemsOf(phase({ rounds: 3, legs: 1 })), []);
    assert.deepEqual(problemsOf(phase({ rounds: 6 })), [
      "competition:champions-cup: format.rounds 6 must be from 1 to 5, under groupSize",
    ]);
    assert.deepEqual(problemsOf(phase({ rounds: 0 })), [
      "competition:champions-cup: format.rounds 0 must be from 1 to 5, under groupSize",
    ]);
    assert.deepEqual(problemsOf(phase({ rounds: 3, legs: 2 })), [
      "competition:champions-cup: format.rounds is a league phase and cannot be combined with legs",
    ]);
    assert.deepEqual(problemsOf(continental({ format: { kind: "Knockout", rounds: 3 } })), [
      "competition:champions-cup: format Knockout has no groups, but group settings are set",
    ]);
  });

  it("check only the shape when the field is a selector's", () => {
    const selected = { selector: { kind: "allInRegion", region: "europe" } };
    assert.deepEqual(
      problemsOf(
        continental({
          participants: selected,
          format: { kind: "GroupAndKnockout", groupSize: 4, qualifiersPerGroup: 4 },
        }),
      ),
      [],
    );
    assert.deepEqual(
      problemsOf(
        continental({
          participants: selected,
          format: { kind: "GroupAndKnockout", groupSize: 4, qualifiersPerGroup: 5 },
        }),
      ),
      ["competition:champions-cup: groups of 4 with 5 qualifiers do not fit any field"],
    );
  });
});

describe("season start dates", () => {
  it("accept any real day, 29 February included", () => {
    assert.deepEqual(problemsOf(league({ seasonStartMonth: 8, seasonStartDay: 31 })), []);
    assert.deepEqual(problemsOf(league({ seasonStartMonth: 2, seasonStartDay: 29 })), []);
    assert.deepEqual(problemsOf(league({ seasonStartMonth: 3 })), []);
  });

  it("reject a month or day out of range", () => {
    assert.deepEqual(problemsOf(league({ seasonStartMonth: 13, seasonStartDay: 1 })), [
      "competition:first-division: seasonStartMonth 13 is not 1-12",
    ]);
    assert.deepEqual(problemsOf(league({ seasonStartMonth: 8, seasonStartDay: 0 })), [
      "competition:first-division: seasonStartDay 0 is not 1-31",
    ]);
  });

  it("reject a day its month does not have", () => {
    assert.deepEqual(problemsOf(league({ seasonStartMonth: 4, seasonStartDay: 31 })), [
      "competition:first-division: seasonStartDay 31 is not a day of month 4",
    ]);
    assert.deepEqual(problemsOf(league({ seasonStartMonth: 2, seasonStartDay: 30 })), [
      "competition:first-division: seasonStartDay 30 is not a day of month 2",
    ]);
  });
});

describe("regions", () => {
  it("must be ones the game knows", () => {
    assert.deepEqual(problemsOf(continental({ regionId: "atlantis" })), [
      'competition:champions-cup: unknown region "atlantis"',
    ]);
    assert.deepEqual(problemsOf(continental({ requiredRegionIds: ["europe", "mars"] })), [
      'competition:champions-cup: unknown region "mars"',
    ]);
  });

  it("go unchecked when no catalog is given", () => {
    const documents = [
      { schema: "world", id: "test-world", name: "Test", version: "1.0.0", license: "CC0-1.0" },
      {
        schema: "competition",
        items: [continental({ regionId: "atlantis", participants: { explicit: [] } })],
      },
    ];
    const messages = validatePackage({ documents }).map((problem) => problem.message);
    assert.ok(!messages.some((message) => message.includes("region")));
  });
});
