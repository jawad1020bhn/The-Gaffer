/**
 * Reading EA's career-mode competition structure.
 *
 * Everything the importer authors beyond the leagues (cups, continental
 * competitions, who qualifies for them) is derived from these files, so a
 * misread here is a wrong competition in every career. Two kinds of check: an
 * invented folder small enough to read in full, for the rules of the format
 * (ids that mean different things in different columns, keys that repeat, a
 * schedule that hangs off a stage in one competition and off its groups in
 * another); and the folder committed in `data/fc27-compdata`, for the facts the
 * rest of the importer leans on. No EA database is needed for either.
 */

import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";

import {
  dayNumber,
  dayOfYear,
  firstMatchDay,
  leagueRounds,
  parseCompdata,
  readCompdata,
} from "./compdata.mjs";

/** Rows as EA writes them: CRLF, no header. */
const file = (...lines) => `${lines.join("\r\n")}\r\n`;

/**
 * One nation with a league and a cup. The league plays three rounds and then
 * splits into two groups that play two rounds and one. The cup has a holding
 * stage of four, two semi-finals and a final.
 */
const SMALL = {
  compobj: file(
    "0,0,FIFA,FIFA,-1",
    "10,1,UEFA,UEFA,0",
    "20,2,ENGL,NationName_14,10",
    "30,3,C13,TrophyName_Abbr15_13,20",
    "31,4,S1,FCE_League_Stage,30",
    "32,5,G1, ,31",
    "33,4,S2,FCE_Split_Stage,30",
    "34,5,G1, ,33",
    "35,5,G2, ,33",
    "40,3,C201,TrophyName_Abbr15_201,20",
    "41,4,S1,FCE_Setup_Stage,40",
    "42,5,G1, ,41",
    "43,4,S2,FCE_Semi_Final,40",
    "44,5,G1, ,43",
    "45,5,G2, ,43",
    "46,4,S3,FCE_Final,40",
    "47,5,G1, ,46",
  ),
  settings: file(
    "0,comp_type,NONE",
    "30,asset_id,13",
    "30,asset_id,913",
    "30,comp_type,LEAGUE",
    "31,match_stagetype,LEAGUE",
    "32,num_games,2",
    "33,match_stagetype,LEAGUE",
    "40,asset_id,201",
    "40,comp_type,CUP",
    "40,info_prize_money,100,50,25",
    "41,match_stagetype,SETUP",
    "43,match_stagetype,KO2LEGS",
    "43,match_matchsituation,ROUNDX",
    "43,match_matchsituation,QUALIFY",
    "46,match_stagetype,KO1LEG",
    "46,match_matchsituation,FINAL",
  ),
  standings: file(
    "32,0",
    "32,1",
    "32,2",
    "32,3",
    "34,0",
    "34,1",
    "35,0",
    "35,1",
    "42,0",
    "42,1",
    "42,2",
    "42,3",
    "44,0",
    "44,1",
    "45,0",
    "45,1",
    "47,0",
    "47,1",
  ),
  tasks: file(
    "40,start,FillFromLeagueInOrder,42,13,0,0",
    "40,end,UpdateTable,40,47,1,1",
    "30,end,UpdateTable,30,32,1,1",
  ),
  schedule: file(
    // The league's first stage, on the stage: two match days in round 1.
    "31,227,1,1,1,1500",
    "31,228,1,1,1,1500",
    "31,234,2,1,1,1500",
    "31,241,3,1,1,1500",
    // The split, on its groups: one plays two rounds, the other one.
    "34,300,1,1,1,1500",
    "34,307,2,1,1,1500",
    "35,300,1,1,1,1500",
    // The cup, on its stages; the final is after the new year.
    "43,310,1,1,1,2000",
    "43,317,2,1,1,2000",
    "46,380,1,1,1,2000",
  ),
};

describe("parseCompdata", () => {
  const data = parseCompdata(SMALL);
  const league = data.byAssetId.get(13);
  const cup = data.byAssetId.get(201);

  it("finds the competitions and nothing else", () => {
    assert.deepEqual(
      data.competitions.map((competition) => competition.code),
      ["C13", "C201"],
    );
    assert.equal(league.type, "LEAGUE");
    assert.equal(cup.type, "CUP");
    assert.equal(cup.nation, "ENGL");
  });

  it("keeps every league id a competition is known by", () => {
    assert.deepEqual(league.assetIds, [13, 913]);
    assert.equal(data.byAssetId.get(913), league);
    assert.equal(data.byObjectId.get(30), league);
  });

  it("builds stages and groups in file order", () => {
    assert.deepEqual(
      cup.stages.map((stage) => [stage.objectId, stage.type, stage.groups.length]),
      [
        [41, "SETUP", 1],
        [43, "KO2LEGS", 2],
        [46, "KO1LEG", 1],
      ],
    );
  });

  it("keeps both situations of a qualifying round", () => {
    assert.deepEqual(cup.stages[1].situations, ["ROUNDX", "QUALIFY"]);
    assert.deepEqual(cup.stages[0].situations, []);
  });

  it("sizes a group by its rows in the standings file", () => {
    assert.equal(data.capacityOfGroup.get(42), 4);
    assert.equal(cup.stages[0].groups[0].capacity, 4);
    assert.equal(cup.stages[2].groups[0].capacity, 2);
  });

  it("reads how often a group's clubs meet, where it says", () => {
    assert.equal(league.stages[0].groups[0].games, 2);
    assert.equal(league.stages[1].groups[0].games, null);
  });

  it("names the competition a group belongs to", () => {
    assert.equal(data.competitionOfGroup.get(42), cup);
    assert.equal(data.competitionOfGroup.get(35), league);
    assert.equal(data.competitionOfGroup.get(41), undefined, "a stage is not a group");
  });

  it("keeps a task's arguments as numbers, in order", () => {
    assert.deepEqual(cup.tasks, [
      { when: "start", action: "FillFromLeagueInOrder", args: [42, 13, 0, 0] },
      { when: "end", action: "UpdateTable", args: [40, 47, 1, 1] },
    ]);
  });

  it("puts a schedule on the stage or the group that carries it", () => {
    assert.equal(league.stages[0].schedule.length, 4);
    assert.equal(league.stages[0].groups[0].schedule.length, 0);
    assert.equal(league.stages[1].schedule.length, 0);
    assert.deepEqual(league.stages[1].groups[0].schedule, [
      { day: 300, round: 1 },
      { day: 307, round: 2 },
    ]);
  });

  it("reads a file with a byte-order mark, LF endings and blank lines", () => {
    const unix = Object.fromEntries(
      Object.entries(SMALL).map(([key, text]) => [key, `\uFEFF${text.replaceAll("\r\n", "\n")}\n`]),
    );
    assert.deepEqual(parseCompdata(unix), data);
  });

  it("refuses an id that is not a number", () => {
    assert.throws(
      () => parseCompdata({ ...SMALL, compobj: file("x,3,C1,Name,0") }),
      /object id "x" is not an integer/,
    );
  });
});

describe("leagueRounds", () => {
  const data = parseCompdata(SMALL);

  it("counts rounds, not match days, and the longer group of a split", () => {
    // Three rounds over four match days, then a split whose groups play two and one.
    assert.equal(leagueRounds(data.byAssetId.get(13)), 5);
  });

  it("is zero for a competition with no league stage", () => {
    assert.equal(leagueRounds(data.byAssetId.get(201)), 0);
  });
});

describe("firstMatchDay", () => {
  const data = parseCompdata(SMALL);

  it("is the earliest day on any stage or group", () => {
    assert.equal(firstMatchDay(data.byAssetId.get(13)), 227);
    assert.equal(firstMatchDay(data.byAssetId.get(201)), 310);
  });

  it("is null for a competition with no schedule", () => {
    const unscheduled = parseCompdata({ ...SMALL, schedule: "" });
    assert.equal(firstMatchDay(unscheduled.byAssetId.get(201)), null);
  });
});

describe("dayOfYear and dayNumber", () => {
  it("count from 1 January", () => {
    assert.deepEqual(dayOfYear(0), { month: 1, day: 1 });
    assert.deepEqual(dayOfYear(58), { month: 2, day: 28 });
    assert.deepEqual(dayOfYear(59), { month: 3, day: 1 });
    assert.deepEqual(dayOfYear(212), { month: 8, day: 1 });
    assert.deepEqual(dayOfYear(364), { month: 12, day: 31 });
  });

  it("wrap past the end of the year, in either direction", () => {
    assert.deepEqual(dayOfYear(365), { month: 1, day: 1 });
    assert.deepEqual(dayOfYear(380), { month: 1, day: 16 });
    assert.deepEqual(dayOfYear(-1), { month: 12, day: 31 });
  });

  it("are each other's inverse for every day of the year", () => {
    for (let day = 0; day < 365; day += 1) {
      const date = dayOfYear(day);
      assert.equal(dayNumber(date.month, date.day), day);
    }
  });
});

describe("the committed FC 27 folder", async () => {
  const data = await readCompdata(path.join(import.meta.dirname, "../data/fc27-compdata"));
  const byCode = new Map(data.competitions.map((competition) => [competition.code, competition]));
  const date = (day) => {
    const { month, day: dayOfMonth } = dayOfYear(day);
    return `${month}-${dayOfMonth}`;
  };

  it("holds the competitions the importer was written against", () => {
    const types = new Map();
    for (const { type } of data.competitions) types.set(type, (types.get(type) ?? 0) + 1);
    assert.equal(data.competitions.length, 93);
    assert.deepEqual(Object.fromEntries(types), {
      INTERCUP: 3,
      INTERQUAL: 4,
      SUPERCUP: 7,
      CUP: 31,
      LEAGUE: 40,
      PLAYOFF: 6,
      INTERFRIENDLY: 1,
      FRIENDLY: 1,
    });
  });

  it("gives no league id to two competitions", () => {
    const owners = new Map();
    for (const competition of data.competitions) {
      for (const assetId of competition.assetIds) {
        assert.equal(owners.get(assetId), undefined, `league id ${assetId} is claimed twice`);
        owners.set(assetId, competition.code);
      }
    }
    assert.equal(owners.size, 95);
  });

  it("knows the two tournaments that share a league id with their division", () => {
    // Argentina's first tournament of the year and Liga MX's Apertura carry the
    // league id the database files the whole division under.
    assert.deepEqual(byCode.get("C152").assetIds, [152, 353]);
    assert.equal(data.byAssetId.get(353), byCode.get("C152"));
    assert.equal(data.byAssetId.get(341).nation, byCode.get("C84").nation);
  });

  it("reads the Champions League as a 36-club league phase behind qualifying rounds", () => {
    const championsLeague = data.byAssetId.get(223);
    assert.equal(championsLeague.code, "C223");
    assert.equal(championsLeague.type, "CUP");
    assert.equal(championsLeague.nation, "UEFA");
    const leaguePhase = championsLeague.stages.find((stage) => stage.type === "LEAGUE");
    assert.deepEqual(
      leaguePhase.groups.map((group) => group.capacity),
      [36],
    );
    assert.deepEqual(championsLeague.stages[1].situations, ["ROUNDX", "QUALIFY"]);
  });

  it("counts a 38-round season for the Premier League and its first day in August", () => {
    const premierLeague = data.byAssetId.get(13);
    assert.equal(premierLeague.type, "LEAGUE");
    assert.equal(leagueRounds(premierLeague), 38);
    assert.equal(dayOfYear(firstMatchDay(premierLeague)).month, 8);
  });

  it("adds the split to the season of a league that has one", () => {
    // Scotland: 33 rounds, then five more in two halves.
    assert.equal(leagueRounds(data.byAssetId.get(50)), 38);
    // Belgium: 30 rounds, then a title group that plays ten.
    assert.equal(leagueRounds(data.byAssetId.get(4)), 40);
  });

  it("reads the first match day of each cup", () => {
    assert.equal(date(firstMatchDay(data.byAssetId.get(201))), "11-4", "FA Cup");
    assert.equal(date(firstMatchDay(data.byAssetId.get(202))), "8-7", "EFL Cup");
    assert.equal(date(firstMatchDay(data.byAssetId.get(314))), "1-10", "KNVB Beker");
    assert.equal(date(firstMatchDay(data.byAssetId.get(217))), "5-17", "Norwegian Cup");
  });

  it("reads the FA Cup's field as four whole divisions", () => {
    const fills = data.byAssetId
      .get(201)
      .tasks.filter((task) => task.when === "start")
      .map((task) => [task.action, task.args[1]]);
    assert.deepEqual(fills, [
      ["FillFromLeagueInOrder", 61],
      ["FillFromLeagueInOrder", 60],
      ["FillFromLeagueInOrder", 14],
      ["FillFromLeagueInOrder", 13],
    ]);
  });

  it("reads the EFL Trophy as eight groups of six", () => {
    const groupStage = data.byAssetId
      .get(203)
      .stages.find((stage) => stage.situations.includes("GROUP"));
    assert.equal(groupStage.type, "LEAGUE");
    assert.deepEqual(
      groupStage.groups.map((group) => [group.capacity, group.games]),
      Array.from({ length: 8 }, () => [6, 1]),
    );
  });
});
