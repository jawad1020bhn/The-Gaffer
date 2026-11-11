/**
 * EA's career-mode competition structure (`compdata`), as plain data.
 *
 * The database says which clubs play in which league and nothing about how a
 * season is organised. That lives in a folder of comma-separated text files the
 * game reads when a career starts: every competition, the stages it is played
 * in, how many clubs each stage holds, where those clubs come from, and the days
 * its matches fall on. `data/fc27-compdata` is a copy of that folder.
 *
 * The files reference each other by *object id*, a number that means nothing
 * outside the folder. An object is a confederation, a nation, a competition, a
 * stage of a competition or a group of a stage, and `compobj.txt` says which.
 * What ties a competition to the rest of EA's data is its `asset_id` setting,
 * which is the league id the database and the logo pack use. Tasks mix the two:
 * a group or a cup is named by object id, a league by its league id.
 *
 * Only the files this importer reads are parsed. `advancement.txt` (how clubs
 * move between stages) and `initteams.txt` (last season's fields, which are a
 * season stale) are kept in the folder for reference and left alone here.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

/** `compobj.txt` object types. */
const TYPE_COMPETITION = 3;
const TYPE_STAGE = 4;
const TYPE_GROUP = 5;

/** The files `readCompdata` needs, by the key `parseCompdata` takes them under. */
const FILES = {
  compobj: "compobj.txt",
  settings: "settings.txt",
  standings: "standings.txt",
  tasks: "tasks.txt",
  schedule: "schedule.txt",
};

/** Rows of one file: CRLF or LF, an optional byte-order mark, blank lines skipped. */
function rows(text) {
  const out = [];
  for (const raw of String(text ?? "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)) {
    if (raw.trim() === "") continue;
    out.push(raw.split(","));
  }
  return out;
}

function integer(value, what) {
  const number = Number(String(value).trim());
  if (!Number.isInteger(number)) throw new Error(`compdata: ${what} "${value}" is not an integer`);
  return number;
}

function pushTo(map, key, value) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

/**
 * @typedef {{ day: number, round: number }} CompdataMatchDay
 *   `day` counts from 1 January of the year the season starts in.
 * @typedef {{ objectId: number, capacity: number, games: number | null,
 *   schedule: CompdataMatchDay[] }} CompdataGroup
 *   `capacity` is the number of places in the group's table and `games` how
 *   often two of its clubs meet. A group has its own `schedule` only where the
 *   groups of one stage play on different days.
 * @typedef {{ objectId: number, type: string, situations: string[], groups: CompdataGroup[],
 *   schedule: CompdataMatchDay[] }} CompdataStage
 *   `type` is `SETUP` (a holding pen that fills before play), `LEAGUE`, `KO1LEG`
 *   or `KO2LEGS`; `situations` say what the round is (`GROUP`, `ROUND16`,
 *   `FINAL`), and a qualifying round carries two (`ROUNDX`, `QUALIFY`).
 * @typedef {{ when: string, action: string, args: number[] }} CompdataTask
 * @typedef {{ objectId: number, code: string, assetIds: number[], type: string,
 *   nation: string, stages: CompdataStage[], tasks: CompdataTask[] }} CompdataCompetition
 *   `code` is EA's own label (`C223`), `nation` the label of the nation or
 *   confederation it hangs under (`ENGL`, `UEFA`). `assetIds` are the league
 *   ids the rest of EA's data knows the competition by: one, except where one
 *   league id stands for two tournaments (Argentina's Apertura is both 152 and
 *   353, the id the database files the whole division under).
 */

/**
 * Parse the compdata files.
 *
 * @param {{ compobj: string, settings: string, standings: string, tasks: string, schedule: string }} texts
 * @returns {{ competitions: CompdataCompetition[],
 *   byObjectId: Map<number, CompdataCompetition>,
 *   byAssetId: Map<number, CompdataCompetition>,
 *   competitionOfGroup: Map<number, CompdataCompetition>,
 *   capacityOfGroup: Map<number, number> }}
 */
export function parseCompdata(texts) {
  const objects = new Map();
  const children = new Map();
  for (const [id, type, code, , parent] of rows(texts.compobj)) {
    const objectId = integer(id, "object id");
    objects.set(objectId, {
      objectId,
      type: integer(type, "object type"),
      code: String(code ?? "").trim(),
      parent: integer(parent, "parent id"),
    });
    pushTo(children, integer(parent, "parent id"), objectId);
  }

  // A value may itself contain commas, so everything after the key is the value.
  // A key may repeat on one object (a second asset id, a second situation), so
  // every value is kept, in file order.
  const settings = new Map();
  for (const [id, key, ...value] of rows(texts.settings)) {
    const objectId = integer(id, "settings object id");
    const bucket = settings.get(objectId) ?? new Map();
    pushTo(bucket, key, value.join(",").trim());
    settings.set(objectId, bucket);
  }
  const settingsOf = (objectId, key) => settings.get(objectId)?.get(key) ?? [];
  const setting = (objectId, key) => settingsOf(objectId, key)[0] ?? "";

  const capacityOfGroup = new Map();
  for (const [id] of rows(texts.standings)) {
    const groupId = integer(id, "standings group id");
    capacityOfGroup.set(groupId, (capacityOfGroup.get(groupId) ?? 0) + 1);
  }

  const tasksByCompetition = new Map();
  for (const [id, when, action, ...args] of rows(texts.tasks)) {
    pushTo(tasksByCompetition, integer(id, "task competition id"), {
      when,
      action,
      args: args.map((arg) => integer(arg, `${action} argument`)),
    });
  }

  // Keyed by stage, or by group where the groups of a stage play on their own days.
  const scheduleByObject = new Map();
  for (const [id, day, round] of rows(texts.schedule)) {
    pushTo(scheduleByObject, integer(id, "schedule object id"), {
      day: integer(day, "schedule day"),
      round: integer(round, "schedule round"),
    });
  }

  const competitions = [];
  const byObjectId = new Map();
  const byAssetId = new Map();
  const competitionOfGroup = new Map();
  for (const object of objects.values()) {
    if (object.type !== TYPE_COMPETITION) continue;
    const competition = {
      objectId: object.objectId,
      code: object.code,
      assetIds: settingsOf(object.objectId, "asset_id")
        .filter((asset) => /^\d+$/.test(asset))
        .map(Number),
      type: setting(object.objectId, "comp_type"),
      nation: objects.get(object.parent)?.code ?? "",
      stages: [],
      tasks: tasksByCompetition.get(object.objectId) ?? [],
    };
    for (const stageId of children.get(object.objectId) ?? []) {
      if (objects.get(stageId).type !== TYPE_STAGE) continue;
      const groups = [];
      for (const groupId of children.get(stageId) ?? []) {
        if (objects.get(groupId).type !== TYPE_GROUP) continue;
        const games = setting(groupId, "num_games");
        groups.push({
          objectId: groupId,
          capacity: capacityOfGroup.get(groupId) ?? 0,
          games: /^\d+$/.test(games) ? Number(games) : null,
          schedule: scheduleByObject.get(groupId) ?? [],
        });
        competitionOfGroup.set(groupId, competition);
      }
      competition.stages.push({
        objectId: stageId,
        type: setting(stageId, "match_stagetype"),
        situations: settingsOf(stageId, "match_matchsituation"),
        groups,
        schedule: scheduleByObject.get(stageId) ?? [],
      });
    }
    competitions.push(competition);
    byObjectId.set(competition.objectId, competition);
    // No two competitions share an asset id in FC 27's files. Were a later
    // edition to break that, the first would be kept here, and the tests that
    // pin what each asset id resolves to are what would notice.
    for (const assetId of competition.assetIds) {
      if (!byAssetId.has(assetId)) byAssetId.set(assetId, competition);
    }
  }

  return { competitions, byObjectId, byAssetId, competitionOfGroup, capacityOfGroup };
}

/** Read and parse a compdata folder. */
export async function readCompdata(directory) {
  const texts = {};
  for (const [key, file] of Object.entries(FILES)) {
    texts[key] = await readFile(path.join(directory, file), "utf8");
  }
  return parseCompdata(texts);
}

const distinctRounds = (schedule) => new Set(schedule.map((row) => row.round)).size;

/**
 * How many rounds of league football a competition schedules: the regular
 * season and any split that follows it, not the knockout rounds some leagues
 * finish with. A split's groups play different numbers of rounds (Belgium's
 * title group ten, its European play-off group six); the longest is the one a
 * calendar has to hold.
 */
export function leagueRounds(competition) {
  let rounds = 0;
  for (const stage of competition.stages) {
    if (stage.type !== "LEAGUE") continue;
    rounds += Math.max(
      distinctRounds(stage.schedule),
      ...stage.groups.map((group) => distinctRounds(group.schedule)),
    );
  }
  return rounds;
}

/** The day of a competition's first match, counted from 1 January, or null. */
export function firstMatchDay(competition) {
  let first = null;
  for (const stage of competition.stages) {
    const days = [...stage.schedule, ...stage.groups.flatMap((group) => group.schedule)];
    for (const row of days) {
      if (first === null || row.day < first) first = row.day;
    }
  }
  return first;
}

const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * A day counted from 1 January as a month and a day of the month.
 *
 * EA counts on past 31 December for a season that crosses the new year, so the
 * count wraps. A common year is assumed: the dates feed a `seasonStartMonth`
 * and `seasonStartDay`, which name a day of every year, not of one.
 *
 * @param {number} day 0 is 1 January
 * @returns {{ month: number, day: number }}
 */
export function dayOfYear(day) {
  let rest = ((Math.trunc(day) % 365) + 365) % 365;
  for (const [index, length] of MONTH_LENGTHS.entries()) {
    if (rest < length) return { month: index + 1, day: rest + 1 };
    rest -= length;
  }
  throw new Error(`compdata: day ${day} is not a day of the year`);
}

/** The inverse of `dayOfYear`: 1 January is 0. */
export function dayNumber(month, day) {
  let total = 0;
  for (let index = 0; index < month - 1; index += 1) total += MONTH_LENGTHS[index];
  return total + day - 1;
}
