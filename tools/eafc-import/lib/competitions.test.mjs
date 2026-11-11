/**
 * Planning the cups and continental competitions of a package.
 *
 * The plan is built from EA's competition structure and has to come out as
 * something the engine accepts and plays sensibly: a cup that ends before its
 * league does, a continental field with no club in it twice, a Champions League
 * place for the right league position. Each rule is checked on numbers small
 * enough to work out by hand. Then the whole plan is run against the structure
 * files committed in `data/fc27-compdata` and a stand-in for the package (the
 * real divisions and their sizes, invented clubs), and what it decides is
 * written out here in full, so a change to the rules shows up as a change to
 * who qualifies for what. No EA database is needed.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

import { dayNumber, dayOfYear, readCompdata } from "./compdata.mjs";
import {
  CONTINENTAL_COMPETITIONS,
  MAX_ROUNDS_WITH_EXTRA_LEGS,
  SEASON_END_MARGIN_DAYS,
  competitionDays,
  competitionName,
  domesticCupStartDay,
  drawOrder,
  groupCount,
  groupFormatFits,
  knockoutDays,
  leagueDays,
  leagueLegs,
  leaguePhaseOf,
  placesOf,
  planCompetitions,
  resolveFields,
  roundsPerLeg,
  sharePlaces,
} from "./competitions.mjs";

const date = (dayOfTheYear) => {
  const { month, day } = dayOfYear(dayOfTheYear);
  return `${month}-${day}`;
};

describe("leagueLegs", () => {
  it("is two for an ordinary home-and-away season", () => {
    assert.equal(leagueLegs(38, 20), 2);
    assert.equal(leagueLegs(34, 18), 2);
    assert.equal(leagueLegs(46, 24), 2);
  });

  it("is three for twelve clubs that play 33 rounds and a split", () => {
    assert.equal(leagueLegs(38, 12), 3);
    assert.equal(leagueLegs(33, 12), 3);
  });

  it("is four for ten clubs that play 36 rounds", () => {
    assert.equal(leagueLegs(36, 10), 4);
  });

  it("is one for a division too large to meet twice", () => {
    // MLS: 30 clubs, 34 rounds. Argentina: 30 clubs, two tournaments of 16.
    assert.equal(leagueLegs(34, 30), 1);
    assert.equal(leagueLegs(32, 30), 1);
  });

  it("does not add a third round robin that would outlast every other league", () => {
    // Romania: 30 rounds and a ten-round play-off for 16 clubs is nearer three
    // round robins than two, and three would be 45 rounds.
    assert.equal(leagueLegs(40, 16), 2);
    assert.ok(3 * roundsPerLeg(16) > MAX_ROUNDS_WITH_EXTRA_LEGS);
    // Belgium: 30 rounds and a ten-round play-off, for 18 clubs.
    assert.equal(leagueLegs(40, 18), 2);
  });

  it("counts the round each club sits out when the division is odd", () => {
    assert.equal(roundsPerLeg(13), 13);
    assert.equal(roundsPerLeg(12), 11);
    assert.equal(leagueLegs(26, 13), 2);
  });

  it("falls back to two when EA schedules nothing for the division", () => {
    assert.equal(leagueLegs(0, 18), 2);
    assert.equal(leagueLegs(undefined, 18), 2);
  });
});

describe("the engine's calendar", () => {
  it("plays a league one round a week", () => {
    assert.equal(leagueDays(20, 2), 37 * 7);
    assert.equal(leagueDays(12, 3), 32 * 7);
    assert.equal(leagueDays(30, 1), 28 * 7);
  });

  it("plays a knockout round a fortnight after the last tie of the one before", () => {
    assert.equal(knockoutDays(2), 0, "a final");
    // Two semi-finals on consecutive days, then the final a fortnight later.
    assert.equal(knockoutDays(4), 1 + 14);
    assert.equal(knockoutDays(8), 3 + 14 + 1 + 14);
    assert.equal(knockoutDays(16), 53);
  });

  it("gives byes so the second round is a power of two", () => {
    // Three clubs: one tie, the third gets a bye to the final.
    assert.equal(knockoutDays(3), 14);
    // 92 clubs: 28 ties bring the field to 64.
    assert.equal(knockoutDays(92), 27 + 14 + 31 + 14 + 15 + 14 + 7 + 14 + 3 + 14 + 1 + 14);
    assert.equal(knockoutDays(92), 168);
  });

  it("plays a group stage one matchday a week, then the knockout", () => {
    const groups = { kind: "GroupAndKnockout", legs: 2, groupSize: 4, qualifiersPerGroup: 2 };
    // Six matchdays, a fortnight, then sixteen clubs.
    assert.equal(competitionDays(32, groups), 5 * 7 + 14 + 53);
    // Eight groups of six playing each other once, then sixteen clubs.
    assert.equal(
      competitionDays(48, {
        kind: "GroupAndKnockout",
        legs: 1,
        groupSize: 6,
        qualifiersPerGroup: 2,
      }),
      4 * 7 + 14 + 53,
    );
    // Two groups of nine: one club sits out each matchday, so nine of them.
    assert.equal(
      competitionDays(18, {
        kind: "GroupAndKnockout",
        legs: 1,
        groupSize: 9,
        qualifiersPerGroup: 4,
      }),
      8 * 7 + 14 + 32,
    );
    assert.equal(competitionDays(16, { kind: "Knockout" }), 53);
    // A league phase: its eight rounds, not the 35 of a round robin; then 24 clubs,
    // of whom eight sit the first knockout round out.
    const leaguePhase = { kind: "GroupAndKnockout", groupSize: 36, rounds: 8 };
    assert.equal(
      competitionDays(36, { ...leaguePhase, qualifiersPerGroup: 24 }),
      7 * 7 + 14 + knockoutDays(24),
    );
    // More rounds than a small field has opponents is one round robin.
    assert.equal(
      competitionDays(4, { ...leaguePhase, qualifiersPerGroup: 2 }),
      2 * 7 + 14 + knockoutDays(2),
    );
  });

  it("splits a field into groups the way the engine does", () => {
    assert.equal(groupCount(32, 4), 8);
    assert.equal(groupCount(18, 9), 2);
    assert.equal(groupCount(17, 4), 5);
  });
});

describe("groupFormatFits", () => {
  const format = (groupSize, qualifiersPerGroup, bestThirdQualifiers) => ({
    kind: "GroupAndKnockout",
    groupSize,
    qualifiersPerGroup,
    bestThirdQualifiers,
  });

  it("accepts the shapes the importer authors", () => {
    assert.ok(groupFormatFits(32, format(4, 2)));
    assert.ok(groupFormatFits(16, format(4, 2)));
    assert.ok(groupFormatFits(48, format(6, 2)));
    assert.ok(groupFormatFits(18, format(9, 4)));
  });

  it("refuses more qualifiers than the smallest group holds", () => {
    // Nine clubs in groups of four make three groups of three.
    assert.ok(groupFormatFits(9, format(4, 3)));
    assert.ok(!groupFormatFits(9, format(4, 4)));
    assert.ok(!groupFormatFits(16, format(4, 5)));
    assert.ok(!groupFormatFits(16, format(4, 0)));
  });

  it("refuses a group of one", () => {
    // Five clubs in groups of four make a three and a two, which is fine.
    assert.ok(groupFormatFits(5, format(4, 2)));
    // Three clubs in groups of two leave one on its own.
    assert.ok(!groupFormatFits(3, format(2, 1)));
    assert.ok(!groupFormatFits(16, format(1, 1)));
  });

  it("refuses best-placed extras that no group can supply", () => {
    assert.ok(groupFormatFits(24, format(4, 2, 4)));
    assert.ok(!groupFormatFits(24, format(4, 2, 7)), "six groups have six third places");
    assert.ok(!groupFormatFits(24, format(4, 4, 1)), "nobody is left to be an extra");
  });
});

describe("leaguePhaseOf", () => {
  const group = (capacity) => ({ capacity, schedule: [] });
  const league = (groups, rounds) => ({
    type: "LEAGUE",
    situations: ["GROUP"],
    groups,
    schedule: Array.from({ length: rounds }, (_, round) => ({ round, day: 260 + round * 14 })),
  });
  const knockout = (ties, type = "KO2LEGS") => ({
    type,
    situations: [],
    groups: Array.from({ length: ties }, () => group(2)),
    schedule: [],
  });
  const setup = { type: "SETUP", situations: [], groups: [], schedule: [] };

  it("reads one table whose clubs play fewer rounds than they have opponents", () => {
    // 36 clubs, eight rounds; a play-off of eight ties, then a round of 16 that
    // has eight clubs beyond the play-off's winners: 16 + 8 go on.
    const competition = {
      stages: [
        knockout(7),
        setup,
        league([group(36)], 8),
        setup,
        knockout(8),
        setup,
        knockout(8),
        knockout(4),
        knockout(2),
        knockout(1, "KO1LEG"),
      ],
    };
    assert.deepEqual(leaguePhaseOf(competition), { clubs: 36, rounds: 8, qualifiers: 24 });
  });

  it("counts only the first knockout round when nobody joins in the second", () => {
    // 16 clubs, six rounds, then quarter-finals: the top eight.
    const competition = {
      stages: [league([group(16)], 6), setup, knockout(4), knockout(2), knockout(1)],
    };
    assert.deepEqual(leaguePhaseOf(competition), { clubs: 16, rounds: 6, qualifiers: 8 });
  });

  it("is not a league phase when there are several groups, or a full round robin", () => {
    const groups = Array.from({ length: 8 }, () => group(4));
    assert.equal(leaguePhaseOf({ stages: [league(groups, 6), knockout(8)] }), null);
    // Four clubs playing three rounds meet everybody: that is a group.
    assert.equal(leaguePhaseOf({ stages: [league([group(4)], 3), knockout(1)] }), null);
    assert.equal(leaguePhaseOf({ stages: [league([group(36)], 8)] }), null, "no knockout");
    assert.equal(leaguePhaseOf({ stages: [knockout(4), knockout(2)] }), null, "no league");
  });
});

describe("domesticCupStartDay", () => {
  const august = dayNumber(8, 1);
  // A 20-club league from 1 August: its last round is 259 days later.
  const season = { leagueStartDay: august, leagueDays: 259 };

  it("keeps EA's first match day when the final then comes before the league ends", () => {
    const start = domesticCupStartDay({ ...season, eaDay: dayNumber(9, 10), days: 53 });
    assert.equal(date(start), "9-10");
  });

  it("moves a cup that would end too late to the last day that does not", () => {
    // 168 days of cup: EA's 4 November would put the final in April, past the
    // league's last round less a fortnight.
    const start = domesticCupStartDay({ ...season, eaDay: dayNumber(11, 4), days: 168 });
    assert.equal(start, august + 259 - SEASON_END_MARGIN_DAYS - 168);
    assert.equal(date(start), "10-17");
  });

  it("reads a spring date as the spring after the league starts", () => {
    // EA plays this cup from January; the league runs August to April, so
    // January is inside the season.
    const start = domesticCupStartDay({ ...season, eaDay: dayNumber(1, 10), days: 53 });
    assert.equal(date(start), "1-10");
  });

  it("brings a cup of the other half of the year into the season", () => {
    // EA starts Norway's cup in May, for a league it plays March to November.
    // The package plays that league from August, so the cup is moved to end
    // a fortnight before the league does.
    const start = domesticCupStartDay({
      leagueStartDay: august,
      leagueDays: leagueDays(16, 2),
      eaDay: dayNumber(5, 17),
      days: knockoutDays(16),
    });
    assert.equal(date(start), "12-15");
  });

  it("never starts a cup before the league", () => {
    const start = domesticCupStartDay({ ...season, eaDay: dayNumber(10, 1), days: 400 });
    assert.equal(start, august);
  });
});

describe("drawOrder", () => {
  const clubs = Array.from({ length: 40 }, (_, index) => `club-${String(index).padStart(2, "0")}`);

  it("lists every club once", () => {
    assert.deepEqual([...drawOrder("eng-fa-cup", clubs)].sort(), clubs);
  });

  it("does not depend on the order the clubs arrive in", () => {
    assert.deepEqual(drawOrder("eng-fa-cup", [...clubs].reverse()), drawOrder("eng-fa-cup", clubs));
  });

  it("is a different draw for each cup, and not the order given", () => {
    const faCup = drawOrder("eng-fa-cup", clubs);
    assert.notDeepEqual(faCup, clubs);
    assert.notDeepEqual(faCup, drawOrder("eng-efl-cup", clubs));
  });
});

describe("competitionName", () => {
  it("drops the sponsor a logo was recorded with", () => {
    assert.equal(competitionName("EFL Cup (Carabao Cup)"), "EFL Cup");
    assert.equal(competitionName("Norwegian Cup (Cupen)"), "Norwegian Cup");
    assert.equal(competitionName("FA Cup"), "FA Cup");
  });

  it("keeps a name that is nothing but a parenthesis", () => {
    assert.equal(competitionName("(Cup)"), "(Cup)");
  });
});

/** A competition as `parseCompdata` returns it, with only what `placesOf` reads. */
const competitionOf = (objectId, ...tasks) => ({
  objectId,
  tasks: tasks.map(([action, ...args]) => ({ when: "start", action, args })),
});

describe("placesOf", () => {
  const leagues = [
    { id: "big-league", eaLeagueId: 13 },
    { id: "small-league", eaLeagueId: 50 },
  ];
  const context = (capacities, positions = new Map()) => ({
    capacityOfGroup: new Map(capacities),
    leagueByEaId: new Map(leagues.map((league) => [league.eaLeagueId, league])),
    leagueByObjectId: new Map([[700, leagues[0]]]),
    cupByObjectId: new Map([
      [800, "big-cup"],
      [900, "second-competition"],
    ]),
    positions,
  });
  const league = (id, position) => ({ kind: "league", league: id, position });

  it("gives a league's next places each time it is asked", () => {
    const competition = competitionOf(
      100,
      ["FillFromLeagueMaxFromCountry", 1, 13, 2, 5],
      ["FillFromLeagueMaxFromCountry", 1, 50, 1, 5],
      ["FillFromLeagueMaxFromCountry", 1, 13, 1, 5],
    );
    assert.deepEqual(placesOf(competition, context([[1, 10]])), [
      league("big-league", 1),
      league("big-league", 2),
      league("small-league", 1),
      league("big-league", 3),
    ]);
  });

  it("stops at the size of the group, which is how a place goes to the first countries only", () => {
    const competition = competitionOf(
      100,
      ["FillFromLeagueMaxFromCountry", 1, 13, 2, 5],
      ["FillFromLeagueMaxFromCountry", 1, 50, 2, 5],
    );
    assert.deepEqual(placesOf(competition, context([[1, 3]])), [
      league("big-league", 1),
      league("big-league", 2),
      league("small-league", 1),
    ]);
  });

  it("carries on from the places a more senior competition gave out", () => {
    const positions = new Map();
    placesOf(competitionOf(100, ["FillFromLeagueMaxFromCountry", 1, 13, 4, 5]), {
      ...context([[1, 4]]),
      positions,
    });
    const second = placesOf(competitionOf(900, ["FillFromLeagueMaxFromCountry", 2, 13, 2, 5]), {
      ...context([[2, 2]]),
      positions,
    });
    assert.deepEqual(second, [league("big-league", 5), league("big-league", 6)]);
  });

  it("reads a league named by its object, and a cup as its winner", () => {
    const competition = competitionOf(
      100,
      ["FillFromCompTable", 1, 700, 2, 0],
      ["FillFromCompTable", 1, 800, 1, 0],
      ["FillFromCompTableBackupLeague", 1, 900, 13, 1],
    );
    assert.deepEqual(placesOf(competition, context([[1, 8]])), [
      league("big-league", 1),
      league("big-league", 2),
      { kind: "cup", cup: "big-cup" },
      { kind: "cup", cup: "second-competition" },
    ]);
  });

  it("leaves out a league or cup the package does not have, without using a place", () => {
    const competition = competitionOf(
      100,
      ["FillFromLeagueMaxFromCountry", 1, 67, 2, 5],
      ["FillFromCompTable", 1, 555, 1, 0],
      ["FillFromLeagueMaxFromCountry", 1, 13, 2, 5],
    );
    assert.deepEqual(placesOf(competition, context([[1, 2]])), [
      league("big-league", 1),
      league("big-league", 2),
    ]);
  });

  it("leaves out the holder's own place", () => {
    const competition = competitionOf(
      100,
      ["FillFromCompTable", 1, 100, 1, 0],
      ["FillFromLeagueMaxFromCountry", 1, 13, 1, 5],
    );
    assert.deepEqual(placesOf(competition, context([[1, 2]])), [league("big-league", 1)]);
  });

  it("counts a list of named clubs as the places left in its group", () => {
    const competition = competitionOf(
      100,
      ["FillFromLeagueMaxFromCountry", 1, 13, 1, 5],
      ["FillFromSpecialTeams", 1, 4, 0, 0],
      ["FillFromSpecialTeams", 2, 5, 0, 0],
    );
    const places = placesOf(
      competition,
      context([
        [1, 3],
        [2, 2],
      ]),
    );
    assert.deepEqual(places, [
      league("big-league", 1),
      { kind: "open" },
      { kind: "open" },
      { kind: "open" },
      { kind: "open" },
    ]);
  });

  it("ignores what happens at the end of a competition", () => {
    const competition = competitionOf(100, ["FillFromLeagueMaxFromCountry", 1, 13, 1, 5]);
    competition.tasks.push({
      when: "end",
      action: "FillFromLeagueMaxFromCountry",
      args: [1, 13, 1, 5],
    });
    assert.equal(placesOf(competition, context([[1, 4]])).length, 1);
  });
});

describe("sharePlaces", () => {
  const league = (id, position) => ({ kind: "league", league: id, position });
  const open = { kind: "open" };

  it("fills each competition in EA's order and passes the overflow down", () => {
    const { fields, dropped } = sharePlaces([
      { id: "first", size: 2, places: [league("a", 1), league("a", 2), league("a", 3)] },
      { id: "second", size: 2, places: [league("b", 1), league("b", 2)] },
      { id: "third", size: 2, places: [league("c", 1)] },
    ]);
    assert.deepEqual(fields.get("first"), [league("a", 1), league("a", 2)]);
    // The place the first had no room for comes before the second's own.
    assert.deepEqual(fields.get("second"), [league("a", 3), league("b", 1)]);
    assert.deepEqual(fields.get("third"), [league("b", 2), league("c", 1)]);
    assert.deepEqual(dropped, []);
  });

  it("drops what the last competition has no room for", () => {
    const { dropped } = sharePlaces([
      { id: "only", size: 1, places: [league("a", 1), league("a", 2)] },
    ]);
    assert.deepEqual(dropped, [league("a", 2)]);
  });

  it("does not pass a named club's place down", () => {
    const { fields } = sharePlaces([
      { id: "first", size: 1, places: [league("a", 1), open, open] },
      { id: "second", size: 3, places: [league("b", 1)] },
    ]);
    assert.deepEqual(fields.get("second"), [league("b", 1)]);
  });

  it("gives a cup one place however often EA lists it", () => {
    const cup = { kind: "cup", cup: "big-cup" };
    const { fields } = sharePlaces([{ id: "first", size: 4, places: [cup, league("a", 1), cup] }]);
    assert.deepEqual(fields.get("first"), [cup, league("a", 1)]);
  });
});

describe("resolveFields", () => {
  const club = (region, reputation, inLeague = true) => ({ region, reputation, inLeague });
  const range = (target, from, to) => ({ target, rule: { kind: "positionRange", from, to } });
  const winner = (target) => ({ target, rule: { kind: "cupWinner" } });

  it("puts a club in the most senior competition it earns, and only there", () => {
    const fields = resolveFields({
      targets: [
        { id: "first", priority: 0, size: 4, region: "europe" },
        { id: "second", priority: 1, size: 4, region: "europe" },
      ],
      sources: [
        {
          berths: [range("first", 1, 4), range("second", 5, 7)],
          table: ["a", "b", "c", "d", "e", "f", "g"],
        },
        // The cup winner finished second: it is in the first competition already.
        { berths: [winner("second")], winner: "b" },
      ],
      clubs: new Map(
        ["a", "b", "c", "d", "e", "f", "g", "h"].map((id, index) => [
          id,
          club("europe", 800 - index),
        ]),
      ),
    });
    assert.deepEqual(fields.get("first"), ["a", "b", "c", "d"]);
    // Three qualifiers and one place left over, which goes to the best club not yet placed.
    assert.deepEqual(fields.get("second"), ["e", "f", "g", "h"]);
  });

  it("seeds a field by reputation, whatever order the clubs qualified in", () => {
    const fields = resolveFields({
      targets: [{ id: "first", priority: 0, size: 4, region: "europe" }],
      sources: [{ berths: [range("first", 1, 4)], table: ["d", "b", "a", "c"] }],
      clubs: new Map([
        ["a", club("europe", 900)],
        ["b", club("europe", 700)],
        ["c", club("europe", 700)],
        ["d", club("europe", 500)],
      ]),
    });
    assert.deepEqual(fields.get("first"), ["a", "b", "c", "d"]);
  });

  it("cuts an oversubscribed field to its size and keeps the cut clubs out of the others", () => {
    const fields = resolveFields({
      targets: [
        { id: "first", priority: 0, size: 4, region: "europe" },
        { id: "second", priority: 1, size: 4, region: "europe" },
      ],
      sources: [
        { berths: [range("first", 1, 5)], table: ["a", "b", "c", "d", "e"] },
        { berths: [range("second", 1, 2)], table: ["f", "g"] },
      ],
      clubs: new Map(
        ["a", "b", "c", "d", "e", "f", "g", "h", "i"].map((id, index) => [
          id,
          club("europe", 800 - index),
        ]),
      ),
    });
    assert.deepEqual(fields.get("first"), ["a", "b", "c", "d"]);
    assert.deepEqual(fields.get("second"), ["f", "g", "h", "i"], "e qualified and was cut");
  });

  it("tops a field up with clubs that play in no league before clubs that do", () => {
    const fields = resolveFields({
      targets: [{ id: "first", priority: 0, size: 4, region: "europe" }],
      sources: [{ berths: [range("first", 1, 2)], table: ["a", "b", "strong"] }],
      clubs: new Map([
        ["a", club("europe", 600)],
        ["b", club("europe", 600)],
        // Finished third and did not qualify: reputation alone does not get it in.
        ["strong", club("europe", 950)],
        ["outsider", club("europe", 400, false)],
        ["lesser", club("europe", 300, false)],
      ]),
    });
    assert.deepEqual(fields.get("first"), ["a", "b", "outsider", "lesser"]);
  });

  it("never tops two fields up with the same club", () => {
    const fields = resolveFields({
      targets: [
        { id: "first", priority: 0, size: 4, region: "europe" },
        { id: "second", priority: 1, size: 4, region: "europe" },
      ],
      sources: [
        { berths: [range("first", 1, 3)], table: ["a", "b", "c"] },
        { berths: [range("second", 1, 2)], table: ["d", "e"] },
      ],
      clubs: new Map([
        ...["a", "b", "c", "d", "e"].map((id) => [id, club("europe", 600)]),
        ["x", club("europe", 500, false)],
        ["y", club("europe", 400, false)],
        ["z", club("europe", 300, false)],
      ]),
    });
    assert.deepEqual(fields.get("first"), ["a", "b", "c", "x"]);
    assert.deepEqual(fields.get("second"), ["d", "e", "y", "z"]);
  });

  it("tops up only from the competition's own region, but lets a qualifier in from anywhere", () => {
    const fields = resolveFields({
      targets: [{ id: "asia-cup", priority: 0, size: 4, region: "asia" }],
      sources: [{ berths: [range("asia-cup", 1, 2)], table: ["sydney", "perth"] }],
      clubs: new Map([
        ["sydney", club("oceania", 500)],
        ["perth", club("oceania", 500)],
        ["auckland", club("oceania", 900, false)],
        ["riyadh", club("asia", 400, false)],
        ["seoul", club("asia", 300, false)],
      ]),
    });
    assert.deepEqual(fields.get("asia-cup"), ["perth", "sydney", "riyadh", "seoul"]);
  });

  it("takes the clubs EA names for a competition before any other", () => {
    const fields = resolveFields({
      targets: [
        { id: "first", priority: 0, size: 4, region: "europe", preferred: ["named", "also"] },
      ],
      sources: [{ berths: [range("first", 1, 1)], table: ["a"] }],
      clubs: new Map([
        ["a", club("europe", 600)],
        ["better", club("europe", 900, false)],
        ["named", club("europe", 300, false)],
        ["also", club("europe", 500, false)],
      ]),
    });
    assert.deepEqual(fields.get("first"), ["a", "also", "named", "better"]);
  });

  it("leaves a place empty when a cup has no holder", () => {
    const fields = resolveFields({
      targets: [{ id: "first", priority: 0, size: 4, region: "europe" }],
      sources: [
        { berths: [winner("first")], winner: null },
        { berths: [range("first", 1, 3)], table: ["a", "b", "c"] },
      ],
      clubs: new Map(["a", "b", "c"].map((id) => [id, club("europe", 600)])),
    });
    assert.deepEqual(fields.get("first"), ["a", "b", "c"]);
  });
});

// --- the whole plan, against EA's real structure files -----------------------

/**
 * The divisions of the EA FC 27 package: id, EA league id, country, region,
 * tier, month the season starts, clubs. The clubs themselves are invented.
 */
const DIVISIONS = [
  ["dk-superliga", 1, "DK", "europe", 0, 8, 12],
  ["be-pro-league", 4, "BE", "europe", 0, 8, 18],
  ["nl-eredivisie", 10, "NL", "europe", 0, 8, 18],
  ["eng-premier-league", 13, "ENG", "europe", 0, 8, 20],
  ["eng-championship", 14, "ENG", "europe", 1, 8, 24],
  ["fr-ligue-1", 16, "FR", "europe", 0, 8, 18],
  ["fr-ligue-2", 17, "FR", "europe", 1, 8, 18],
  ["de-1-bundesliga", 19, "DE", "europe", 0, 8, 18],
  ["de-2-bundesliga", 20, "DE", "europe", 1, 8, 18],
  ["it-serie-a", 31, "IT", "europe", 0, 8, 20],
  ["it-serie-b", 32, "IT", "europe", 1, 8, 20],
  ["us-major-league-soccer", 39, "US", "north-america", 0, 2, 30],
  ["no-eliteserien", 41, "NO", "europe", 0, 8, 16],
  ["sco-premiership", 50, "SCO", "europe", 0, 8, 12],
  ["es-primera-division", 53, "ES", "europe", 0, 8, 20],
  ["es-segunda-division", 54, "ES", "europe", 1, 8, 22],
  ["se-allsvenskan", 56, "SE", "europe", 0, 8, 16],
  ["eng-league-one", 60, "ENG", "europe", 2, 8, 24],
  ["eng-league-two", 61, "ENG", "europe", 3, 8, 24],
  ["ie-premier-division", 65, "IE", "europe", 0, 8, 10],
  ["pl-ekstraklasa", 66, "PL", "europe", 0, 8, 18],
  ["tr-super-lig", 68, "TR", "europe", 0, 8, 18],
  ["at-bundesliga", 80, "AT", "europe", 0, 8, 12],
  ["kr-k-league-1", 83, "KR", "asia", 0, 3, 12],
  ["ch-super-league", 189, "CH", "europe", 0, 8, 12],
  ["pt-primeira-liga", 308, "PT", "europe", 0, 8, 18],
  ["ro-liga-i", 330, "RO", "europe", 0, 8, 16],
  ["mx-liga-mx", 341, "MX", "north-america", 0, 1, 18],
  ["sa-saudi-pro-league", 350, "SA", "asia", 0, 8, 18],
  ["au-a-league", 351, "AU", "oceania", 0, 10, 12],
  ["ar-primera-division", 353, "AR", "south-america", 0, 1, 30],
  ["cn-super-league", 2012, "CN", "asia", 0, 3, 16],
  ["de-3-liga", 2076, "DE", "europe", 2, 8, 20],
  ["in-indian-super-league", 2149, "IN", "asia", 0, 9, 13],
];

/** `eng-premier-league` position 3 is the club `eng-premier-league#03`. */
const clubAt = (league, position) => `${league}#${String(position).padStart(2, "0")}`;

/**
 * The stand-in package. A club's reputation falls with its tier and its
 * position, so the order of a field can be worked out by eye. Each region also
 * has clubs that play in no league, as EA's database does.
 */
async function standIn({ without = [] } = {}) {
  const compdata = await readCompdata(path.join(import.meta.dirname, "../data/fc27-compdata"));
  const recorded = JSON.parse(
    await readFile(
      path.join(import.meta.dirname, "../data/fc27-league-logo-crosswalk.json"),
      "utf8",
    ),
  );
  const crosswalk = new Map(recorded.authored.map((entry) => [entry.eaLeagueId, entry]));
  // The two competitions the database has a row for take the importer's name for it.
  crosswalk.set(1003, { competitionId: "conmebol-libertadores", name: "CONMEBOL Libertadores" });
  crosswalk.set(1014, { competitionId: "conmebol-sudamericana", name: "CONMEBOL Sudamericana" });

  const leagues = DIVISIONS.filter(([id]) => !without.includes(id)).map(
    ([id, eaLeagueId, country, region, tier, startMonth, size]) => ({
      id,
      eaLeagueId,
      country,
      region,
      tier,
      startMonth,
      table: Array.from({ length: size }, (_, index) => clubAt(id, index + 1)),
    }),
  );
  const clubs = new Map();
  for (const league of leagues) {
    for (const [index, id] of league.table.entries()) {
      clubs.set(id, { region: league.region, reputation: 700 - league.tier * 100 - index });
    }
  }
  const outsiders = (region, count) =>
    Array.from({ length: count }, (_, index) => {
      const id = `${region}-outsider#${String(index + 1).padStart(2, "0")}`;
      clubs.set(id, { region, reputation: 650 - index });
      return id;
    });
  outsiders("europe", 17);
  const southAmerica = outsiders("south-america", 56);

  return {
    compdata,
    crosswalk,
    leagues,
    clubs,
    // EA files 28 clubs under the Libertadores and 28 under the Sudamericana.
    pools: new Map([
      [1003, southAmerica.slice(28)],
      [1014, southAmerica.slice(0, 28)],
    ]),
    holders: new Map([
      // The FA Cup and EFL Cup holders finished in the Champions League places.
      [201, clubAt("eng-premier-league", 2)],
      [202, clubAt("eng-premier-league", 2)],
      // A cup won by a club from outside the European places.
      [314, clubAt("nl-eredivisie", 9)],
      // The Europa League holder finished 12th at home.
      [224, clubAt("eng-premier-league", 12)],
      [226, clubAt("eng-premier-league", 15)],
      [1014, clubAt("ar-primera-division", 20)],
    ]),
  };
}

const berthsInto = (plan, target) => {
  const lines = [];
  for (const [league, berths] of plan.leagueBerths) {
    for (const berth of berths) {
      if (berth.target === target) lines.push(`${league} ${berth.rule.from}-${berth.rule.to}`);
    }
  }
  for (const competition of plan.competitions) {
    for (const berth of competition.berths ?? []) {
      if (berth.target === target) lines.push(`${competition.id} winner`);
    }
  }
  return lines.sort();
};

describe("planCompetitions on the FC 27 structure", async () => {
  const input = await standIn();
  const plan = planCompetitions(input);
  const byId = new Map(plan.competitions.map((competition) => [competition.id, competition]));
  const start = (id) => `${byId.get(id).seasonStartMonth}-${byId.get(id).seasonStartDay}`;
  const field = (id) => byId.get(id).participants.explicit;

  it("plays each division the number of times EA's schedule comes nearest to", () => {
    const legs = Object.fromEntries(plan.legs);
    const expected = Object.fromEntries(DIVISIONS.map(([id]) => [id, 2]));
    // Twelve clubs, 33 rounds and a split.
    for (const id of ["at-bundesliga", "dk-superliga", "sco-premiership", "ch-super-league"]) {
      expected[id] = 3;
    }
    expected["kr-k-league-1"] = 3;
    // Ten clubs, 36 rounds.
    expected["ie-premier-division"] = 4;
    // Thirty clubs that meet most opponents once.
    expected["us-major-league-soccer"] = 1;
    expected["ar-primera-division"] = 1;
    assert.deepEqual(legs, expected);
  });

  it("authors the 22 domestic cups whose divisions the package has, then five super cups", () => {
    const cups = plan.competitions.filter((competition) => competition.type === "Cup");
    assert.deepEqual(
      cups.map((cup) => cup.id),
      [
        "eng-fa-cup",
        "eng-efl-cup",
        "eng-efl-trophy",
        "fr-coupe-de-france",
        "de-dfb-pokal",
        "es-copa-del-rey",
        "it-coppa-italia",
        "at-ofb-cup",
        "be-belgian-cup",
        "dk-danish-cup",
        "no-norwegian-cup",
        "pt-taca-de-portugal",
        "sco-scottish-cup",
        "se-svenska-cupen",
        "ch-schweizer-cup",
        "us-open-cup",
        "tr-turkiye-kupasi",
        "nl-knvb-beker",
        "ie-fai-cup",
        "pl-puchar-polski",
        "sa-kings-cup",
        "ro-cupa-romaniei",
        "eng-community-shield",
        "fr-trophee-des-champions",
        "de-supercup",
        "it-supercoppa-italiana",
        "es-supercopa-de-espana",
      ],
    );
    for (const cup of cups) {
      assert.equal(cup.scope, "Domestic", cup.id);
      assert.ok(cup.countryId, cup.id);
    }
  });

  it("names the divisions a cup's clubs come from, most senior first", () => {
    const from = (id) => byId.get(id).participants.entrantsFrom;
    assert.deepEqual(from("eng-fa-cup"), [
      "eng-premier-league",
      "eng-championship",
      "eng-league-one",
      "eng-league-two",
    ]);
    assert.deepEqual(from("eng-efl-trophy"), ["eng-league-one", "eng-league-two"]);
    assert.deepEqual(from("fr-coupe-de-france"), ["fr-ligue-1", "fr-ligue-2"]);
    // A super cup's clubs come from berths, and a continental competition's too.
    assert.equal(from("eng-community-shield"), undefined);
    assert.equal(from("uefa-champions-league"), undefined);
  });

  it("makes a super cup of the cup's holder and the league's top clubs", () => {
    const sizes = Object.fromEntries(
      ["eng-community-shield", "fr-trophee-des-champions", "de-supercup"]
        .concat(["it-supercoppa-italiana", "es-supercopa-de-espana"])
        .map((id) => [id, field(id).length]),
    );
    assert.deepEqual(sizes, {
      "eng-community-shield": 2,
      "fr-trophee-des-champions": 2,
      "de-supercup": 2,
      // EA plays these two as semi-finals and a final.
      "it-supercoppa-italiana": 4,
      "es-supercopa-de-espana": 4,
    });
    // The FA Cup's holder finished second, so the champion is the other club.
    assert.deepEqual(field("eng-community-shield"), [
      clubAt("eng-premier-league", 2),
      clubAt("eng-premier-league", 1),
    ]);
    // Nobody is recorded as holding the Coupe de France: the league's top two.
    assert.deepEqual(field("fr-trophee-des-champions"), [
      clubAt("fr-ligue-1", 1),
      clubAt("fr-ligue-1", 2),
    ]);
    assert.deepEqual(byId.get("eng-community-shield").format, { kind: "Knockout" });
    assert.deepEqual(berthsInto(plan, "eng-community-shield"), [
      "eng-fa-cup winner",
      "eng-premier-league 1-1",
    ]);
    // A cup gives its winner and no one else, so the league makes up the four.
    assert.deepEqual(berthsInto(plan, "es-supercopa-de-espana"), [
      "es-copa-del-rey winner",
      "es-primera-division 1-2",
    ]);
    // A super cup is not a way into Europe.
    assert.equal(byId.get("eng-community-shield").berths, undefined);
  });

  it("says which of EA's cups it left out, and why", () => {
    assert.deepEqual(plan.summary.skipped, [
      { code: "C8", eaLeagueId: 8, reason: "none of its divisions is in the package" },
      { code: "C229", eaLeagueId: 229, reason: "none of its divisions is in the package" },
      // The UEFA Super Cup and the Recopa: the winners of two continental competitions.
      { code: "C232", eaLeagueId: 232, reason: "not one league and one cup of the package" },
      { code: "C1015", eaLeagueId: 1015, reason: "not one league and one cup of the package" },
    ]);
  });

  it("names a cup without its sponsor", () => {
    assert.equal(byId.get("eng-efl-cup").name, "EFL Cup");
    assert.equal(byId.get("be-belgian-cup").name, "Belgian Cup");
    assert.equal(byId.get("tr-turkiye-kupasi").name, "Türkiye Kupası");
  });

  it("enters every club of the divisions EA fills a cup from, once", () => {
    const sizes = Object.fromEntries(
      plan.competitions
        .filter((competition) => competition.type === "Cup")
        .map((cup) => [cup.id, cup.participants.explicit.length]),
    );
    assert.equal(sizes["eng-fa-cup"], 92);
    assert.equal(sizes["eng-efl-cup"], 92);
    assert.equal(sizes["eng-efl-trophy"], 48, "League One and League Two");
    assert.equal(sizes["de-dfb-pokal"], 56);
    assert.equal(sizes["es-copa-del-rey"], 42);
    assert.equal(sizes["it-coppa-italia"], 40);
    assert.equal(sizes["fr-coupe-de-france"], 36);
    assert.equal(sizes["us-open-cup"], 30);
    assert.equal(sizes["ie-fai-cup"], 10);
    for (const [id, size] of Object.entries(sizes)) {
      assert.equal(new Set(field(id)).size, size, `${id} lists a club twice`);
    }
    assert.ok(field("eng-efl-trophy").every((club) => /^eng-league-(one|two)#/.test(club)));
  });

  it("gives a cup's byes to its most senior clubs and draws the rest", () => {
    // 92 clubs in a bracket of 128: 36 byes. They go to the head of the list,
    // which is the Premier League's twenty and the Championship's top sixteen,
    // each as it finished. Nobody with a bye is drawn against anybody.
    const order = field("eng-fa-cup");
    const seeded = order.slice(0, 36);
    assert.deepEqual(seeded, [
      ...Array.from({ length: 20 }, (_, index) => clubAt("eng-premier-league", index + 1)),
      ...Array.from({ length: 16 }, (_, index) => clubAt("eng-championship", index + 1)),
    ]);
    // The other 56 are paired two by two, so they are not listed division by
    // division: a division would be drawn against itself.
    const drawn = order.slice(36);
    assert.equal(drawn.length, 56);
    assert.ok(new Set(drawn.slice(0, 20).map((club) => club.split("#")[0])).size >= 2);
    assert.notDeepEqual(drawn, [...drawn].sort());
    // A cup that opens with groups seeds them from the whole list, which is drawn.
    const trophy = field("eng-efl-trophy");
    assert.ok(new Set(trophy.slice(0, 12).map((club) => club.split("#")[0])).size === 2);
  });

  it("gives a cup with a group stage in EA's files a group stage", () => {
    const formats = Object.fromEntries(
      plan.competitions
        .filter((competition) => competition.format.kind === "GroupAndKnockout")
        .filter((competition) => competition.type === "Cup")
        .map((cup) => [cup.id, cup.format]),
    );
    assert.deepEqual(formats, {
      // Eight groups of six, the top two to a round of sixteen.
      "eng-efl-trophy": { kind: "GroupAndKnockout", legs: 1, groupSize: 6, qualifiersPerGroup: 2 },
      // Four groups of four, the top two to the quarter-finals.
      "se-svenska-cupen": {
        kind: "GroupAndKnockout",
        legs: 1,
        groupSize: 4,
        qualifiersPerGroup: 2,
      },
      "ro-cupa-romaniei": {
        kind: "GroupAndKnockout",
        legs: 1,
        groupSize: 4,
        qualifiersPerGroup: 2,
      },
      // EA cuts 18 clubs to 16 for two groups of eight; all 18 are grouped here.
      "tr-turkiye-kupasi": {
        kind: "GroupAndKnockout",
        legs: 1,
        groupSize: 9,
        qualifiersPerGroup: 4,
      },
    });
    for (const [id, format] of Object.entries(formats)) {
      assert.ok(groupFormatFits(field(id).length, format), id);
    }
    assert.deepEqual(byId.get("eng-fa-cup").format, { kind: "Knockout" });
  });

  it("ranks a country's cups after its divisions, in EA's order", () => {
    const priority = (id) => byId.get(id).priority;
    assert.deepEqual(
      [priority("eng-fa-cup"), priority("eng-efl-cup"), priority("eng-efl-trophy")],
      [4, 5, 6],
    );
    assert.equal(priority("de-dfb-pokal"), 3);
    assert.equal(priority("fr-coupe-de-france"), 2);
    assert.equal(priority("nl-knvb-beker"), 1);
  });

  it("starts each cup on EA's day, or early enough to finish before the league", () => {
    // EA's own first day, kept.
    assert.equal(start("eng-efl-cup"), "8-7");
    assert.equal(start("eng-efl-trophy"), "9-12");
    assert.equal(start("de-dfb-pokal"), "8-18");
    assert.equal(start("it-coppa-italia"), "9-6");
    assert.equal(start("us-open-cup"), "5-10");
    assert.equal(start("sa-kings-cup"), "9-27");
    // Moved back: 92 clubs take 168 days and the league ends in April.
    assert.equal(start("eng-fa-cup"), "10-17");
    assert.equal(start("nl-knvb-beker"), "12-28");
    assert.equal(start("sco-scottish-cup"), "1-9");
    assert.equal(start("tr-turkiye-kupasi"), "11-24");
    // EA plays these two in the other half of the year.
    assert.equal(start("no-norwegian-cup"), "12-15");
    assert.equal(start("se-svenska-cupen"), "12-8");
  });

  it("ends every cup a fortnight before its country's top division", () => {
    const leagueById = new Map(input.leagues.map((league) => [league.id, league]));
    for (const cup of plan.competitions.filter((competition) => competition.type === "Cup")) {
      const top = input.leagues
        .filter((league) => league.country === cup.countryId)
        .sort((a, b) => a.tier - b.tier)[0];
      const seasonStart = dayNumber(top.startMonth, 1);
      const seasonEnd = seasonStart + leagueDays(top.table.length, plan.legs.get(top.id));
      let cupStart = dayNumber(cup.seasonStartMonth, cup.seasonStartDay);
      if (cupStart < seasonStart) cupStart += 365;
      const cupEnd = cupStart + competitionDays(cup.participants.explicit.length, cup.format);
      assert.ok(
        cupEnd <= seasonEnd - SEASON_END_MARGIN_DAYS,
        `${cup.id} ends on day ${cupEnd}, ${leagueById.get(top.id).id} on day ${seasonEnd}`,
      );
    }
  });

  it("authors the seven continental competitions, most senior first", () => {
    const continental = plan.competitions.filter(
      (competition) => competition.type === "ContinentalClub",
    );
    assert.deepEqual(
      continental.map((competition) => [
        competition.id,
        competition.name,
        competition.regionId,
        competition.priority,
        competition.participants.explicit.length,
      ]),
      [
        ["uefa-champions-league", "UEFA Champions League", "europe", 0, 36],
        ["uefa-europa-league", "UEFA Europa League", "europe", 1, 36],
        ["uefa-conference-league", "UEFA Conference League", "europe", 2, 36],
        ["conmebol-libertadores", "CONMEBOL Libertadores", "south-america", 0, 32],
        ["conmebol-sudamericana", "CONMEBOL Sudamericana", "south-america", 1, 32],
        ["concacaf-champions-cup", "Concacaf Champions Cup", "north-america", 0, 8],
        ["afc-champions-league-elite", "AFC Champions League Elite", "asia", 0, 16],
      ],
    );
    for (const competition of continental) {
      assert.equal(competition.scope, "Continental");
      assert.deepEqual(competition.requiredRegionIds, [competition.regionId]);
    }
    assert.equal(CONTINENTAL_COMPETITIONS.length, 7);
  });

  it("plays EA's league phase where it has one, and otherwise groups of four or a knockout", () => {
    // One table of 36: eight matches each (six in the Conference League), the
    // top 24 going on, of whom the engine gives the best eight a bye.
    const leaguePhase = (rounds) => ({
      kind: "GroupAndKnockout",
      groupSize: 36,
      rounds,
      qualifiersPerGroup: 24,
    });
    assert.deepEqual(byId.get("uefa-champions-league").format, leaguePhase(8));
    assert.deepEqual(byId.get("uefa-europa-league").format, leaguePhase(8));
    assert.deepEqual(byId.get("uefa-conference-league").format, leaguePhase(6));
    // One table of 16, six matches each, the top eight into the quarter-finals.
    assert.deepEqual(byId.get("afc-champions-league-elite").format, {
      kind: "GroupAndKnockout",
      groupSize: 16,
      rounds: 6,
      qualifiersPerGroup: 8,
    });
    const groups = { kind: "GroupAndKnockout", legs: 2, groupSize: 4, qualifiersPerGroup: 2 };
    assert.deepEqual(byId.get("conmebol-libertadores").format, groups);
    assert.deepEqual(byId.get("conmebol-sudamericana").format, groups);
    assert.deepEqual(byId.get("concacaf-champions-cup").format, { kind: "Knockout" });
  });

  it("qualifies for the Champions League as EA does", () => {
    assert.deepEqual(berthsInto(plan, "uefa-champions-league"), [
      "at-bundesliga 1-1",
      "be-pro-league 1-1",
      "ch-super-league 1-1",
      "de-1-bundesliga 1-4",
      "dk-superliga 1-1",
      "eng-premier-league 1-5",
      "es-primera-division 1-4",
      "fr-ligue-1 1-3",
      "it-serie-a 1-5",
      "nl-eredivisie 1-2",
      "no-eliteserien 1-2",
      "pl-ekstraklasa 1-1",
      "pt-primeira-liga 1-1",
      "sco-premiership 1-1",
      "se-allsvenskan 1-1",
      "tr-super-lig 1-1",
      "uefa-europa-league winner",
    ]);
  });

  it("qualifies for the Europa League as EA does", () => {
    assert.deepEqual(berthsInto(plan, "uefa-europa-league"), [
      "at-bundesliga 2-2",
      "at-ofb-cup winner",
      "be-belgian-cup winner",
      "be-pro-league 2-2",
      "ch-schweizer-cup winner",
      "ch-super-league 2-2",
      "de-1-bundesliga 5-5",
      "de-dfb-pokal winner",
      "dk-danish-cup winner",
      "eng-fa-cup winner",
      "eng-premier-league 6-6",
      "es-copa-del-rey winner",
      "es-primera-division 5-5",
      "fr-coupe-de-france winner",
      "fr-ligue-1 4-5",
      "ie-fai-cup winner",
      "ie-premier-division 1-1",
      "it-coppa-italia winner",
      "it-serie-a 6-6",
      "nl-eredivisie 3-4",
      "nl-knvb-beker winner",
      "no-norwegian-cup winner",
      "pl-puchar-polski winner",
      "pt-primeira-liga 2-3",
      "pt-taca-de-portugal winner",
      "ro-cupa-romaniei winner",
      "ro-liga-i 1-1",
      "sco-premiership 2-2",
      "sco-scottish-cup winner",
      "se-svenska-cupen winner",
      "tr-super-lig 2-2",
      "tr-turkiye-kupasi winner",
      "uefa-conference-league winner",
    ]);
  });

  it("qualifies for the Conference League as EA does", () => {
    assert.deepEqual(berthsInto(plan, "uefa-conference-league"), [
      "at-bundesliga 3-4",
      "be-pro-league 3-4",
      "ch-super-league 3-4",
      "de-1-bundesliga 6-6",
      "dk-superliga 2-3",
      "eng-efl-cup winner",
      "es-primera-division 6-6",
      "fr-ligue-1 6-6",
      "ie-premier-division 2-4",
      "it-serie-a 7-7",
      "nl-eredivisie 5-5",
      "no-eliteserien 3-4",
      "pl-ekstraklasa 2-3",
      "pt-primeira-liga 4-4",
      "ro-liga-i 2-3",
      "sco-premiership 3-4",
      "se-allsvenskan 2-3",
      "tr-super-lig 3-4",
    ]);
  });

  it("qualifies for the other confederations' competitions as EA does", () => {
    assert.deepEqual(berthsInto(plan, "conmebol-libertadores"), [
      "ar-primera-division 1-5",
      "conmebol-sudamericana winner",
    ]);
    assert.deepEqual(berthsInto(plan, "conmebol-sudamericana"), ["ar-primera-division 6-7"]);
    assert.deepEqual(berthsInto(plan, "concacaf-champions-cup"), [
      "mx-liga-mx 1-4",
      "us-major-league-soccer 1-4",
    ]);
    assert.deepEqual(berthsInto(plan, "afc-champions-league-elite"), [
      "au-a-league 1-4",
      "cn-super-league 1-4",
      "kr-k-league-1 1-4",
      "sa-saudi-pro-league 1-4",
    ]);
  });

  it("gives no berth to a division below the top one, or to a cup with no European place", () => {
    for (const league of input.leagues.filter((candidate) => candidate.tier > 0)) {
      assert.deepEqual(plan.leagueBerths.get(league.id) ?? [], [], league.id);
    }
    for (const id of ["eng-efl-trophy", "us-open-cup", "sa-kings-cup"]) {
      assert.equal(byId.get(id).berths, undefined, id);
    }
  });

  it("reports how many places are earned and which of EA's it had no room for", () => {
    assert.deepEqual(plan.summary.continental, [
      { id: "uefa-champions-league", size: 36, earned: 35 },
      { id: "uefa-europa-league", size: 36, earned: 36 },
      { id: "uefa-conference-league", size: 36, earned: 30 },
      { id: "conmebol-libertadores", size: 32, earned: 6 },
      { id: "conmebol-sudamericana", size: 32, earned: 2 },
      { id: "concacaf-champions-cup", size: 8, earned: 8 },
      { id: "afc-champions-league-elite", size: 16, earned: 16 },
    ]);
    // With 36 places in each UEFA competition every place EA gives has room.
    assert.deepEqual(plan.summary.dropped, []);
  });

  it("starts each continental competition on EA's day for its main stage", () => {
    // The league phase or the groups, not the qualifying rounds in front of
    // them. No season end is avoided: the engine draws an edition four weeks
    // before this day from the last season each league has finished.
    assert.equal(start("uefa-champions-league"), "9-19");
    assert.equal(start("uefa-europa-league"), "9-27");
    assert.equal(start("uefa-conference-league"), "10-5");
    assert.equal(start("concacaf-champions-cup"), "4-4");
    assert.equal(start("conmebol-libertadores"), "4-4");
    assert.equal(start("conmebol-sudamericana"), "4-6");
    assert.equal(start("afc-champions-league-elite"), "9-19");
  });

  it("fills the first Champions League from last season's tables", () => {
    const championsLeague = field("uefa-champions-league");
    for (const position of [1, 2, 3, 4, 5]) {
      assert.ok(championsLeague.includes(clubAt("eng-premier-league", position)));
    }
    assert.ok(!championsLeague.includes(clubAt("eng-premier-league", 6)));
    // The Europa League holder finished 12th and is in through that win.
    assert.ok(championsLeague.includes(clubAt("eng-premier-league", 12)));
    // 35 clubs earn a place; the last goes to the best club outside any league.
    assert.equal(championsLeague.at(-1), "europe-outsider#01");
    assert.equal(championsLeague.filter((club) => club.includes("outsider")).length, 1);
  });

  it("seeds a continental field strongest first", () => {
    const reputation = (club) => input.clubs.get(club).reputation;
    const earned = field("uefa-champions-league").slice(0, 35).map(reputation);
    assert.deepEqual(
      earned,
      [...earned].sort((a, b) => b - a),
    );
  });

  it("moves a cup winner that qualified higher out of the cup's place", () => {
    const europaLeague = field("uefa-europa-league");
    // The FA Cup holder finished second: Champions League, not Europa League.
    assert.ok(!europaLeague.includes(clubAt("eng-premier-league", 2)));
    // The KNVB Beker holder finished ninth: the cup is its only way in.
    assert.ok(europaLeague.includes(clubAt("nl-eredivisie", 9)));
    // The Conference League holder moves up to the Europa League.
    assert.ok(europaLeague.includes(clubAt("eng-premier-league", 15)));
  });

  it("puts no club in two competitions of one confederation", () => {
    for (const region of ["europe", "south-america", "north-america", "asia"]) {
      const seen = new Map();
      for (const competition of plan.competitions) {
        if (competition.type !== "ContinentalClub" || competition.regionId !== region) continue;
        for (const club of competition.participants.explicit) {
          assert.equal(seen.get(club), undefined, `${club} is in ${seen.get(club)} too`);
          seen.set(club, competition.id);
        }
      }
    }
  });

  it("fills the CONMEBOL competitions with the clubs EA files under each", () => {
    const libertadores = field("conmebol-libertadores");
    const sudamericana = field("conmebol-sudamericana");
    // Argentina's top five and the Sudamericana holder, then 26 named clubs.
    assert.deepEqual(
      libertadores.filter((club) => club.startsWith("ar-")).sort(),
      [1, 2, 3, 4, 5, 20].map((position) => clubAt("ar-primera-division", position)),
    );
    const named = new Set(input.pools.get(1003));
    assert.ok(
      libertadores.filter((club) => !club.startsWith("ar-")).every((club) => named.has(club)),
    );
    // Sixth and seventh, the 28 clubs EA names, then the two left over.
    assert.ok(sudamericana.includes(clubAt("ar-primera-division", 6)));
    assert.equal(sudamericana.filter((club) => input.pools.get(1014).includes(club)).length, 28);
    assert.equal(sudamericana.filter((club) => named.has(club)).length, 2);
  });

  it("lets Australian clubs into the AFC competition through the league", () => {
    const afc = field("afc-champions-league-elite");
    assert.equal(afc.filter((club) => club.startsWith("au-a-league#")).length, 4);
    assert.equal(input.clubs.get(clubAt("au-a-league", 1)).region, "oceania");
  });

  it("writes only berths the engine accepts", () => {
    const ids = new Set([...input.leagues.map((league) => league.id), ...byId.keys()]);
    const check = (source, berths, kind) => {
      for (const berth of berths) {
        assert.ok(ids.has(berth.target), `${source} names ${berth.target}`);
        assert.notEqual(berth.target, source, `${source} qualifies for itself`);
        assert.equal(berth.rule.kind, kind, source);
        if (kind === "positionRange") {
          assert.ok(berth.rule.from >= 1 && berth.rule.to >= berth.rule.from, source);
        }
      }
    };
    for (const [league, berths] of plan.leagueBerths) check(league, berths, "positionRange");
    for (const competition of plan.competitions) {
      check(competition.id, competition.berths ?? [], "cupWinner");
    }
  });
});

describe("planCompetitions on a smaller package", async () => {
  it("leaves out a competition its region cannot fill, and the berths into it", async () => {
    // With no Asian division, the four Australian clubs that qualify are the
    // whole of the AFC competition's field, and it needs sixteen.
    const plan = planCompetitions(
      await standIn({
        without: [
          "sa-saudi-pro-league",
          "cn-super-league",
          "in-indian-super-league",
          "kr-k-league-1",
        ],
      }),
    );
    assert.ok(!plan.competitions.some((competition) => competition.id.startsWith("afc-")));
    assert.deepEqual(plan.leagueBerths.get("au-a-league"), []);
    assert.ok(plan.summary.skipped.some((entry) => entry.code === "C3005"));
    assert.ok(!plan.summary.continental.some((entry) => entry.id.startsWith("afc-")));
  });

  it("authors a cup from the divisions that are there", async () => {
    // The FA Cup without Leagues One and Two is the top two divisions.
    const plan = planCompetitions(await standIn({ without: ["eng-league-one", "eng-league-two"] }));
    const byId = new Map(plan.competitions.map((competition) => [competition.id, competition]));
    assert.equal(byId.get("eng-fa-cup").participants.explicit.length, 44);
    assert.equal(byId.get("eng-fa-cup").priority, 2);
    assert.ok(!byId.has("eng-efl-trophy"), "the EFL Trophy has no division left");
  });

  it("needs no cup or continental competition to plan the leagues", async () => {
    const input = await standIn();
    const plan = planCompetitions({ ...input, crosswalk: new Map() });
    assert.deepEqual(plan.competitions, []);
    assert.equal(plan.legs.get("sco-premiership"), 3);
    assert.ok([...plan.leagueBerths.values()].every((berths) => berths.length === 0));
  });
});
