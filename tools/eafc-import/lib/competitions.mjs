/**
 * The cups and continental competitions of a package, planned from EA's
 * competition structure.
 *
 * EA's database lists leagues and their clubs. Which cups exist, who enters
 * them and who qualifies for Europe is in the career-mode structure files
 * (`compdata.mjs`). This module reads that structure and decides what the
 * package authors: how many times a division plays itself, each domestic cup
 * and its field, each continental competition, and the berths that carry a
 * league place or a cup win into it.
 *
 * It decides; it does not read files or write a package. Everything it needs is
 * passed in, so the plan can be checked against small invented worlds as well
 * as against EA's real files.
 *
 * Two things shape every decision here, and neither is EA's.
 *
 * The engine plays a league one round a week from its start date, a group
 * stage one matchday a week, and a knockout round a fortnight after the one
 * before it, one tie a day. None of that is authorable, so a competition's
 * length follows from its size, and EA's own final dates cannot be kept. What
 * can be chosen is the day a competition starts, and `PACING` is the copy of
 * those rules the start dates are worked out with.
 *
 * And the engine renews a continental competition only when the season of the
 * player's own country ends, and only if the competition is finished by then.
 * One still being played is left alone and misses a year. So an edition is
 * placed where it cannot be under way when any of the countries that send
 * clubs to it ends its season.
 */

import { createHash } from "node:crypto";

import { dayNumber, dayOfYear, firstMatchDay, leagueRounds } from "./compdata.mjs";

/** The engine's calendar, in days. See `schedule.rs` and `CompetitionRules::default`. */
export const PACING = {
  leagueMatchdayGap: 7,
  groupMatchdayGap: 7,
  knockoutRoundGap: 14,
};

/**
 * Days kept clear on either side of the end of a season: a final is played at
 * least this long before it, and a continental edition starts at least this
 * long after it. The engine moves a fixture a few days when two competitions
 * want one club in the same week, and this is the room for that.
 */
export const SEASON_END_MARGIN_DAYS = 14;

/**
 * The longest season a third or fourth round robin may produce.
 *
 * A twelve-club division that meets three times plays 33 rounds, which is what
 * Austria, Denmark, Scotland and Switzerland do before and after their split.
 * Sixteen clubs meeting three times would play 45 and still be going in June,
 * after every other European division has finished: its table would be read
 * for European places before it was final. 38 is the longest season any top
 * division in EA's files plays.
 */
export const MAX_ROUNDS_WITH_EXTRA_LEGS = 38;

/** Rounds in one round robin: with an odd number of clubs one sits out each round. */
export function roundsPerLeg(clubs) {
  return clubs % 2 === 0 ? clubs - 1 : clubs;
}

/**
 * How many times each pair of clubs meets in a division.
 *
 * The engine plays whole round robins and nothing else: no split, no
 * conferences, no play-offs. The nearest whole number to the rounds EA
 * schedules is the honest translation. It gives 3 for a twelve-club league
 * with a split, 4 for Ireland's ten clubs, and 1 for the thirty-club divisions
 * (MLS, Argentina) whose clubs meet most opponents once.
 *
 * @param {number} eaRounds rounds of league football EA schedules, 0 if unknown
 * @param {number} clubs clubs in the division
 */
export function leagueLegs(eaRounds, clubs) {
  const perLeg = roundsPerLeg(clubs);
  if (!(eaRounds > 0) || perLeg <= 0) return 2;
  let legs = Math.min(4, Math.max(1, Math.round(eaRounds / perLeg)));
  while (legs > 2 && legs * perLeg > MAX_ROUNDS_WITH_EXTRA_LEGS) legs -= 1;
  return legs;
}

/** Days from a division's first round to its last. */
export function leagueDays(clubs, legs) {
  return (roundsPerLeg(clubs) * legs - 1) * PACING.leagueMatchdayGap;
}

/**
 * Days from a knockout's first tie to its final.
 *
 * A field that is not a power of two plays a first round that reduces it to
 * one; the rest get a bye. Each round's ties fall on consecutive days, and the
 * next round starts a fortnight after the last of them.
 */
export function knockoutDays(entrants) {
  if (entrants < 2) return 0;
  let bracket = 1;
  while (bracket < entrants) bracket *= 2;
  let ties = entrants - bracket / 2;
  let left = bracket / 2;
  let days = 0;
  for (;;) {
    days += ties - 1;
    if (left === 1) return days;
    days += PACING.knockoutRoundGap;
    ties = left / 2;
    left /= 2;
  }
}

/** How the engine splits a field into groups of at most `groupSize`. */
export function groupCount(entrants, groupSize) {
  return Math.max(1, Math.ceil(entrants / Math.max(2, groupSize)));
}

/** Days from a competition's first match to its final, for the format it is authored with. */
export function competitionDays(entrants, format) {
  if (format.kind !== "GroupAndKnockout") return knockoutDays(entrants);
  const groups = groupCount(entrants, format.groupSize ?? 4);
  const largest = Math.ceil(entrants / groups);
  const matchdays = roundsPerLeg(largest) * (format.legs ?? 2);
  return (
    (matchdays - 1) * PACING.groupMatchdayGap +
    PACING.knockoutRoundGap +
    knockoutDays(groups * (format.qualifiersPerGroup ?? 2))
  );
}

/**
 * Whether the engine accepts a group format for a field of this size. Mirrors
 * `validate_group_qualification` in `competition_def.rs`.
 */
export function groupFormatFits(entrants, format) {
  const size = format.groupSize ?? 4;
  const qualifiers = format.qualifiersPerGroup ?? 2;
  const extra = format.bestThirdQualifiers ?? 0;
  if (size < 2 || qualifiers === 0 || qualifiers > size) return false;
  const groups = groupCount(entrants, size);
  const smallest = Math.floor(entrants / groups);
  let availableExtra = 0;
  if (smallest > qualifiers) availableExtra = groups;
  else if (smallest === qualifiers) availableExtra = entrants % groups;
  return (
    smallest >= 2 &&
    qualifiers <= smallest &&
    extra <= availableExtra &&
    groups * qualifiers + extra >= 2
  );
}

const mod365 = (day) => ((day % 365) + 365) % 365;

/**
 * The start of a domestic cup, as a day of the year.
 *
 * EA's first match day is kept when the cup then ends, at the engine's pace,
 * at least `SEASON_END_MARGIN_DAYS` before the last round of the country's top
 * division. Otherwise it is moved to the latest day that does, and never to
 * before that division's first round. The player's season is over when their
 * league is, so a final after it would be played in the next one.
 *
 * @param {{ eaDay: number, days: number, leagueStartDay: number, leagueDays: number }} input
 *   `eaDay` and `leagueStartDay` count from 1 January; `days` and `leagueDays`
 *   are the lengths of the cup and of the division's season.
 */
export function domesticCupStartDay({ eaDay, days, leagueStartDay, leagueDays: seasonDays }) {
  const seasonStart = mod365(leagueStartDay);
  let start = mod365(eaDay);
  if (start < seasonStart) start += 365;
  const latest = seasonStart + seasonDays - SEASON_END_MARGIN_DAYS - days;
  if (start > latest) start = Math.max(seasonStart, latest);
  return mod365(start);
}

/**
 * The start of a continental competition, as a day of the year.
 *
 * The engine renews the competition when the player's season ends, with the
 * field that season produced, and only if no match of it is still to play. So
 * an edition has to fit between two season ends for every country that sends
 * clubs to it: start after one, finish before the next. `seasonEndDays` are
 * those ends. The day nearest EA's that fits them all is returned; EA's own
 * day when none does.
 *
 * @param {{ eaDay: number, days: number, seasonEndDays: number[] }} input
 */
export function continentalStartDay({ eaDay, days, seasonEndDays }) {
  const wanted = mod365(eaDay);
  const ends = [...new Set(seasonEndDays.map(mod365))].sort((a, b) => a - b);
  if (ends.length === 0) return wanted;
  let best = null;
  for (const [index, end] of ends.entries()) {
    const next = index + 1 < ends.length ? ends[index + 1] : ends[0] + 365;
    const earliest = end + SEASON_END_MARGIN_DAYS;
    const latest = next - SEASON_END_MARGIN_DAYS - days;
    if (latest < earliest) continue;
    // EA's day, seen from this window: the same day of the year, at or after its opening.
    let seen = wanted;
    while (seen < earliest) seen += 365;
    let candidate;
    let distance;
    if (seen <= latest) {
      candidate = seen;
      distance = 0;
    } else {
      // Outside the window: the nearer of its two edges, going round the year.
      const afterLatest = seen - latest;
      const beforeEarliest = earliest + 365 - seen;
      if (afterLatest <= beforeEarliest) {
        candidate = latest;
        distance = afterLatest;
      } else {
        candidate = earliest;
        distance = beforeEarliest;
      }
    }
    if (best === null || distance < best.distance) best = { day: mod365(candidate), distance };
  }
  return best === null ? wanted : best.day;
}

/**
 * A fixed shuffle of a cup's field.
 *
 * The engine pairs a knockout field in the order it is listed: first against
 * second, third against fourth, with the byes going to the first names. Listed
 * division by division, the top division would be drawn against itself in the
 * first round it enters, year after year. Ordered by a digest of the
 * competition and the club, the draw is arbitrary and the same on every build.
 */
export function drawOrder(competitionId, clubIds) {
  const key = (clubId) => createHash("sha256").update(`${competitionId}\n${clubId}`).digest("hex");
  return [...clubIds]
    .map((clubId) => ({ clubId, key: key(clubId) }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.clubId.localeCompare(b.clubId)))
    .map((entry) => entry.clubId);
}

/**
 * A cup's first field, in the order the engine draws it in.
 *
 * `field` is the divisions' clubs, most senior division first and each as it
 * last finished. A knockout pairs the list two by two after giving the byes a
 * field that is not a power of two needs to the clubs at its head, so those
 * stay where they are and the rest are put in `drawOrder`. A cup that opens
 * with groups seeds them from the whole list, which is drawn. From the second
 * season on the engine does the same from `entrantsFrom`.
 */
export function firstDraw(competitionId, field, format) {
  if (format.kind !== "Knockout") return drawOrder(competitionId, field);
  let bracket = 1;
  while (bracket < field.length) bracket *= 2;
  const byes = bracket - field.length;
  return [...field.slice(0, byes), ...drawOrder(competitionId, field.slice(byes))];
}

/** "EFL Cup (Carabao Cup)" is recorded with its sponsor; the competition is "EFL Cup". */
export function competitionName(recorded) {
  return (
    String(recorded ?? "")
      .replace(/\s*\([^)]*\)\s*$/, "")
      .trim() || String(recorded ?? "").trim()
  );
}

/**
 * The continental competitions this importer authors, most senior first within
 * a confederation.
 *
 * Which competitions exist and who qualifies is EA's. Their shape is not, and
 * cannot be: EA plays the three UEFA competitions as a 36-club league phase
 * behind three qualifying rounds, and two-legged ties throughout, and the
 * engine has groups and single ties. Each is authored as the nearest thing the
 * engine plays. Eight groups of four is the Libertadores' real format and the
 * one the UEFA competitions had until 2024; the AFC's sixteen clubs make four
 * groups; the Concacaf Champions Cup's eight are a straight knockout.
 *
 * `size` is the whole field. A place no berth fills is topped up by the engine
 * from the clubs of `region`, which is where the clubs EA keeps outside any
 * league (Olympiacos, Flamengo) get in.
 */
export const CONTINENTAL_COMPETITIONS = [
  { eaLeagueId: 223, region: "europe", size: 32 },
  { eaLeagueId: 224, region: "europe", size: 32 },
  { eaLeagueId: 226, region: "europe", size: 32 },
  { eaLeagueId: 1003, region: "south-america", size: 32 },
  { eaLeagueId: 1014, region: "south-america", size: 32 },
  { eaLeagueId: 3004, region: "north-america", size: 8 },
  { eaLeagueId: 3005, region: "asia", size: 16 },
];

/** The format a continental field of `size` is played in. */
function continentalFormat(size) {
  if (size < 16) return { kind: "Knockout" };
  return { kind: "GroupAndKnockout", legs: 2, groupSize: 4, qualifiersPerGroup: 2 };
}

const FILL_FROM_LEAGUE = new Set(["FillFromLeague", "FillFromLeagueInOrder"]);

/**
 * A package's leagues, as EA's structure files name them.
 *
 * A task names a league by its league id, or by the object id of the
 * competition that plays it. Two of this package's leagues are one league id in
 * the database and two tournaments in the structure files: Liga MX's Apertura
 * and Clausura, Argentina's two halves. The second tournament carries a league
 * id the database does not have, so it is recognised as the other league
 * competition of the same nation, in a nation with one league in the package.
 *
 * @returns {{ byEaLeagueId: Map<number, object>, byObjectId: Map<number, object>,
 *   partsOf: Map<string, import("./compdata.mjs").CompdataCompetition[]> }}
 */
export function leagueIndex(compdata, leagues) {
  const byEaLeagueId = new Map(leagues.map((league) => [league.eaLeagueId, league]));
  const byObjectId = new Map();
  const partsOf = new Map();
  const leaguesOfNation = new Map();
  for (const league of leagues) {
    const competition = compdata.byAssetId.get(league.eaLeagueId);
    if (competition?.type !== "LEAGUE") continue;
    byObjectId.set(competition.objectId, league);
    partsOf.set(league.id, [competition]);
    const list = leaguesOfNation.get(competition.nation) ?? [];
    list.push(league);
    leaguesOfNation.set(competition.nation, list);
  }
  for (const competition of compdata.competitions) {
    if (competition.type !== "LEAGUE" || byObjectId.has(competition.objectId)) continue;
    const nationLeagues = leaguesOfNation.get(competition.nation) ?? [];
    if (nationLeagues.length !== 1) continue;
    const [league] = nationLeagues;
    byObjectId.set(competition.objectId, league);
    partsOf.get(league.id).push(competition);
  }
  return { byEaLeagueId, byObjectId, partsOf };
}

/**
 * The places EA gives out in one competition, in the order it gives them.
 *
 * EA fills a competition by running a list of tasks, each putting clubs into
 * one of its groups: the next clubs of a league's table, the winner of a cup,
 * or names from a fixed list of clubs it keeps outside any league. A group has
 * a size, and a task that finds it full does nothing; that is how "the fifth
 * place goes to the two best-ranked countries" is written down. The same
 * league is asked several times, and each time it gives the places after the
 * ones it has already given, here or in a more senior competition, which is
 * what `positions` carries from one walk to the next.
 *
 * What comes back is that list as places: `{ kind: "league", league, position }`,
 * `{ kind: "cup", cup }` for a cup's winner, and `{ kind: "open" }` for each
 * name from a fixed list, which the engine fills from the region instead.
 *
 * Left out: a league or cup the package does not have, and the holder's own
 * place. The engine refuses a competition that qualifies its winner for
 * itself, so a holder that finishes outside the league places is not kept.
 *
 * @param {import("./compdata.mjs").CompdataCompetition} competition
 * @param {{ capacityOfGroup: Map<number, number>, leagueByEaId: Map<number, object>,
 *   leagueByObjectId: Map<number, object>, cupByObjectId: Map<number, string>,
 *   positions: Map<string, number> }} context
 */
export function placesOf(competition, context) {
  const { capacityOfGroup, leagueByEaId, leagueByObjectId, cupByObjectId, positions } = context;
  const used = new Map();
  const places = [];
  const room = (group) => (capacityOfGroup.get(group) ?? 0) - (used.get(group) ?? 0);
  const take = (group, place) => {
    used.set(group, (used.get(group) ?? 0) + 1);
    places.push(place);
  };
  const fromLeague = (group, league, count) => {
    for (let taken = 0; taken < count && room(group) > 0; taken += 1) {
      const position = (positions.get(league.id) ?? 0) + 1;
      positions.set(league.id, position);
      take(group, { kind: "league", league: league.id, position });
    }
  };
  const fromCup = (group, cupObjectId) => {
    const cup = cupByObjectId.get(cupObjectId);
    if (cup && room(group) > 0) take(group, { kind: "cup", cup });
  };

  for (const task of competition.tasks) {
    if (task.when !== "start") continue;
    const [group, source, count] = task.args;
    switch (task.action) {
      case "FillFromLeagueMaxFromCountry": {
        const league = leagueByEaId.get(source);
        if (league) fromLeague(group, league, count);
        break;
      }
      case "FillFromCompTable": {
        if (source === competition.objectId) break;
        const league = leagueByObjectId.get(source);
        // A cup gives its winner. EA asks two of its super cups for a cup's
        // top two, the finalists; the engine knows a cup's winner and no one else.
        if (league) fromLeague(group, league, count);
        else fromCup(group, source);
        break;
      }
      case "FillFromCompTableBackupLeague":
      case "FillFromCompTableBackup":
        fromCup(group, source);
        break;
      case "FillFromSpecialTeams":
        while (room(group) > 0) take(group, { kind: "open" });
        break;
      default:
        break;
    }
  }
  return places;
}

/**
 * Share EA's places out among the competitions of one confederation.
 *
 * EA's fields are larger than the ones authored here: 36 clubs and three
 * qualifying rounds against 32 and none. So each competition takes EA's places
 * in EA's order until it is full, and the places it has no room for go to the
 * front of the queue of the next competition down, which is where the clubs
 * that lose a Champions League qualifier end up in EA's game as well. Only a
 * league place or a cup win moves down; a name from a fixed list does not.
 *
 * @param {{ id: string, size: number, places: object[] }[]} chain most senior first
 * @returns {{ fields: Map<string, object[]>, dropped: object[] }}
 */
export function sharePlaces(chain) {
  const fields = new Map();
  let queue = [];
  for (const competition of chain) {
    const field = [];
    const overflow = [];
    const cups = new Set();
    for (const place of [...queue, ...competition.places]) {
      if (place.kind === "cup") {
        // One cup, one place: EA lists a few twice, in a group that may be full.
        if (cups.has(place.cup)) continue;
        cups.add(place.cup);
      }
      if (field.length < competition.size) field.push(place);
      else if (place.kind !== "open") overflow.push(place);
    }
    fields.set(competition.id, field);
    queue = overflow;
  }
  return { fields, dropped: queue };
}

/** Consecutive league positions as `positionRange` rules: 1, 2, 3, 5 is 1 to 3 and 5. */
function positionRanges(positions) {
  const sorted = [...positions].sort((a, b) => a - b);
  const ranges = [];
  for (const position of sorted) {
    const last = ranges.at(-1);
    if (last && position === last.to + 1) last.to = position;
    else ranges.push({ from: position, to: position });
  }
  return ranges;
}

/**
 * The fields a set of berths produces: the engine's own resolution, as
 * `resolve_berth_fields` and `seed_cap_and_fill` in `berths/continental.rs`
 * carry it out at the end of a season, run here on last season's tables.
 *
 * A club takes the most senior competition any of its berths earns it and no
 * other. Each field is its qualifiers by reputation, cut to its size, then
 * topped up from its region with clubs no competition has taken: first the
 * ones that play in no league, then the rest, by reputation.
 *
 * `preferred` is the one thing the engine does not do. EA names the clubs that
 * fill the two CONMEBOL competitions, and for the first season those names
 * come before the engine's own choice of league-less club.
 *
 * @param {{ targets: { id: string, priority: number, size: number, region: string,
 *     preferred?: string[] }[],
 *   sources: { berths: { target: string, rule: object }[], table?: string[],
 *     winner?: string | null }[],
 *   clubs: Map<string, { region: string, reputation: number, inLeague: boolean }> }} input
 *   `sources` in the order the package lists its competitions.
 * @returns {Map<string, string[]>} target id to its field, seeded strongest first
 */
export function resolveFields({ targets, sources, clubs }) {
  const priorityOf = new Map(targets.map((target) => [target.id, target.priority]));
  const winnersOf = (source, rule) => {
    if (rule.kind === "positionRange") return (source.table ?? []).slice(rule.from - 1, rule.to);
    if (rule.kind === "cupWinner") return source.winner ? [source.winner] : [];
    return [];
  };

  const best = new Map();
  for (const source of sources) {
    for (const berth of source.berths) {
      const priority = priorityOf.get(berth.target);
      if (priority === undefined) continue;
      for (const club of winnersOf(source, berth.rule)) {
        const current = best.get(club);
        if (!current || priority < current.priority)
          best.set(club, { priority, target: berth.target });
      }
    }
  }

  const raw = new Map();
  const emitted = new Set();
  for (const source of sources) {
    for (const berth of source.berths) {
      for (const club of winnersOf(source, berth.rule)) {
        if (emitted.has(club)) continue;
        emitted.add(club);
        const placed = best.get(club);
        if (!placed) continue;
        const list = raw.get(placed.target) ?? [];
        list.push(club);
        raw.set(placed.target, list);
      }
    }
  }

  const reputation = (club) => clubs.get(club)?.reputation ?? 0;
  const byReputation = (a, b) => reputation(b) - reputation(a) || (a < b ? -1 : a > b ? 1 : 0);
  const taken = new Set(best.keys());
  const fields = new Map();
  const ordered = [...targets].sort(
    (a, b) => a.priority - b.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  for (const target of ordered) {
    const size = Math.max(4, target.size);
    const field = (raw.get(target.id) ?? []).sort(byReputation).slice(0, size);
    if (field.length < size) {
      const preferred = new Set(target.preferred ?? []);
      const fillers = [...clubs.entries()]
        .filter(([club, facts]) => facts.region === target.region && !taken.has(club))
        .map(([club]) => club)
        .sort(
          (a, b) =>
            Number(preferred.has(b)) - Number(preferred.has(a)) ||
            Number(clubs.get(a).inLeague) - Number(clubs.get(b).inLeague) ||
            byReputation(a, b),
        );
      for (const club of fillers) {
        if (field.length >= size) break;
        field.push(club);
      }
    }
    for (const club of field) taken.add(club);
    fields.set(target.id, field);
  }
  return fields;
}

/**
 * Plan a package's competitions.
 *
 * @param {{
 *   compdata: ReturnType<typeof import("./compdata.mjs").parseCompdata>,
 *   crosswalk: Map<number, { competitionId: string, name?: string }>,
 *   leagues: { id: string, eaLeagueId: number, country: string, region: string, tier: number,
 *     startMonth: number, table: string[] }[],
 *   clubs: Map<string, { region: string, reputation: number }>,
 *   pools?: Map<number, string[]>,
 *   holders?: Map<number, string>,
 * }} input
 *   `crosswalk` maps an EA league id to the id (and, for a cup, the name) this
 *   package gives the competition. A league's `table` is every club it has
 *   this season: the ones that were in it last season first, in the order they
 *   finished, then the ones that have since come up or down. Its length is the
 *   size of the division, and its top is who qualified. `tier` is 0 for a top
 *   division. `pools` are the clubs EA files under a continental competition's
 *   own league id, and `holders` each competition's reigning champion, both
 *   keyed by EA league id.
 * @returns {{ legs: Map<string, number>, leagueBerths: Map<string, object[]>,
 *   competitions: object[],
 *   summary: { continental: { id: string, size: number, earned: number }[],
 *     dropped: { kind: "league", league: string, position: number }[],
 *     skipped: { code: string, eaLeagueId: number, reason: string }[] } }}
 *   `legs` is how many times each division plays itself and `leagueBerths` the
 *   berths each division carries, both by league id. `competitions` are the
 *   cups and then the continental competitions, as package entities.
 */
export function planCompetitions({
  compdata,
  crosswalk,
  leagues,
  clubs,
  pools = new Map(),
  holders = new Map(),
}) {
  const index = leagueIndex(compdata, leagues);
  const leagueById = new Map(leagues.map((league) => [league.id, league]));

  // --- how many times each division plays itself --------------------------
  const legs = new Map();
  for (const league of leagues) {
    const rounds = (index.partsOf.get(league.id) ?? []).reduce(
      (total, part) => total + leagueRounds(part),
      0,
    );
    legs.set(league.id, leagueLegs(rounds, league.table.length));
  }
  const seasonStartDay = (league) => dayNumber(league.startMonth, 1);
  const seasonDays = (league) => leagueDays(league.table.length, legs.get(league.id));

  // The day a country's season is over: when the last of its divisions is.
  const seasonEndOfCountry = new Map();
  const topDivision = new Map();
  for (const league of leagues) {
    const end = seasonStartDay(league) + seasonDays(league);
    seasonEndOfCountry.set(
      league.country,
      Math.max(seasonEndOfCountry.get(league.country) ?? 0, end),
    );
    const top = topDivision.get(league.country);
    if (!top || league.tier < top.tier) topDivision.set(league.country, league);
  }
  const tiersOfCountry = new Map();
  for (const league of leagues) {
    tiersOfCountry.set(league.country, (tiersOfCountry.get(league.country) ?? 0) + 1);
  }

  // --- domestic cups ------------------------------------------------------
  // A cup EA fills with whole divisions. Its field is every club of the ones
  // this package has; a cup none of whose divisions are here is left out.
  const competitions = [];
  const cupByObjectId = new Map();
  const cupEaLeagueId = new Map();
  const skipped = [];
  const cups = [];
  for (const competition of compdata.competitions) {
    if (competition.type !== "CUP") continue;
    const feederIds = competition.tasks
      .filter((task) => task.when === "start" && FILL_FROM_LEAGUE.has(task.action))
      .map((task) => task.args[1]);
    if (feederIds.length === 0) continue;
    const eaLeagueId = competition.assetIds[0];
    const recorded = crosswalk.get(eaLeagueId);
    // Most senior division first: that is the order the engine rebuilds the
    // field in each season, and the clubs at the head of it take the byes.
    const feeders = [...new Set(feederIds)]
      .map((id) => index.byEaLeagueId.get(id))
      .filter(Boolean)
      .sort((a, b) => a.tier - b.tier || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const field = [...new Set(feeders.flatMap((league) => league.table))];
    if (!recorded || field.length < 2) {
      skipped.push({
        code: competition.code,
        eaLeagueId,
        reason: recorded ? "none of its divisions is in the package" : "no competition id recorded",
      });
      continue;
    }
    cups.push({ competition, eaLeagueId, recorded, country: feeders[0].country, field, feeders });
  }
  cups.sort((a, b) => a.eaLeagueId - b.eaLeagueId);

  const cupsOfCountry = new Map();
  for (const { competition, eaLeagueId, recorded, country, field, feeders } of cups) {
    const top = topDivision.get(country);
    const format = domesticCupFormat(competition, field.length);
    const start = dayOfYear(
      domesticCupStartDay({
        eaDay: firstMatchDay(competition) ?? seasonStartDay(top),
        days: competitionDays(field.length, format),
        leagueStartDay: seasonStartDay(top),
        leagueDays: seasonDays(top),
      }),
    );
    const placed = cupsOfCountry.get(country) ?? 0;
    cupsOfCountry.set(country, placed + 1);
    const entity = {
      schema: "competition",
      id: recorded.competitionId,
      name: competitionName(recorded.name ?? recorded.competitionId),
      type: "Cup",
      scope: "Domestic",
      countryId: country,
      regionId: top.region,
      // After the country's divisions, in the order of EA's ids: the FA Cup
      // before the EFL Cup before the EFL Trophy.
      priority: tiersOfCountry.get(country) + placed,
      format,
      participants: {
        explicit: firstDraw(recorded.competitionId, field, format),
        entrantsFrom: feeders.map((league) => league.id),
      },
      berths: [],
      seasonStartMonth: start.month,
      seasonStartDay: start.day,
    };
    competitions.push(entity);
    cupByObjectId.set(competition.objectId, entity.id);
    cupEaLeagueId.set(entity.id, eaLeagueId);
  }

  // --- super cups ---------------------------------------------------------
  // A super cup EA fills from one league's table and one cup's: the champion
  // and the cup's holder, or the top two of each. The engine knows a cup's
  // winner and nobody else in it, so a cup gives one club whatever EA asks of
  // it, and the league's table makes up the number: the engine reads the
  // holder, then the league's places, then the next clubs down that table.
  // The two that take the winners of two continental competitions are left
  // out: the engine gives a club one continental competition and no other.
  const superCupBerths = { league: new Map(), cup: new Map() };
  for (const competition of compdata.competitions) {
    if (competition.type !== "SUPERCUP") continue;
    const eaLeagueId = competition.assetIds[0];
    const recorded = crosswalk.get(eaLeagueId);
    const asked = competition.tasks
      .filter((task) => task.when === "start" && task.action === "FillFromCompTable")
      .map((task) => ({
        league: index.byObjectId.get(task.args[1]),
        cup: cupByObjectId.get(task.args[1]),
        count: task.args[2],
      }));
    const fromLeague = asked.find((source) => source.league);
    const fromCup = asked.find((source) => source.cup);
    const skip = (reason) => skipped.push({ code: competition.code, eaLeagueId, reason });
    if (!recorded) {
      skip("no competition id recorded");
      continue;
    }
    if (asked.length !== 2 || !fromLeague || !fromCup) {
      skip("not one league and one cup of the package");
      continue;
    }
    const league = fromLeague.league;
    const size = fromLeague.count + fromCup.count;
    const holder = holders.get(cupEaLeagueId.get(fromCup.cup)) ?? null;
    const field = [...new Set([...(holder ? [holder] : []), ...league.table])].slice(0, size);
    if (field.length < size) {
      skip(`only ${field.length} of ${size} clubs`);
      continue;
    }
    const top = topDivision.get(league.country);
    const format = { kind: "Knockout" };
    const start = dayOfYear(
      domesticCupStartDay({
        eaDay: firstMatchDay(competition) ?? seasonStartDay(top),
        days: competitionDays(size, format),
        leagueStartDay: seasonStartDay(top),
        leagueDays: seasonDays(top),
      }),
    );
    const placed = cupsOfCountry.get(league.country) ?? 0;
    cupsOfCountry.set(league.country, placed + 1);
    competitions.push({
      schema: "competition",
      id: recorded.competitionId,
      name: competitionName(recorded.name ?? recorded.competitionId),
      type: "Cup",
      scope: "Domestic",
      countryId: league.country,
      regionId: top.region,
      priority: tiersOfCountry.get(league.country) + placed,
      format,
      participants: { explicit: field },
      berths: [],
      seasonStartMonth: start.month,
      seasonStartDay: start.day,
    });
    superCupBerths.league.set(league.id, [
      {
        target: recorded.competitionId,
        rule: { kind: "positionRange", from: 1, to: fromLeague.count },
      },
    ]);
    superCupBerths.cup.set(fromCup.cup, [
      { target: recorded.competitionId, rule: { kind: "cupWinner" } },
    ]);
  }

  // --- continental competitions and the berths into them ------------------
  const continental = [];
  for (const authored of CONTINENTAL_COMPETITIONS) {
    const competition = compdata.byAssetId.get(authored.eaLeagueId);
    const recorded = crosswalk.get(authored.eaLeagueId);
    if (!competition || !recorded) continue;
    const priority = continental.filter((other) => other.region === authored.region).length;
    continental.push({ ...authored, competition, id: recorded.competitionId, recorded, priority });
    // A continental competition's winner can earn a place too: the Europa
    // League's in the Champions League.
    cupByObjectId.set(competition.objectId, recorded.competitionId);
    cupEaLeagueId.set(recorded.competitionId, authored.eaLeagueId);
  }

  const leagueBerths = new Map(superCupBerths.league);
  const berthsOfCup = new Map(superCupBerths.cup);
  const earned = new Map();
  const dropped = [];
  const positions = new Map();
  for (const region of new Set(continental.map((entry) => entry.region))) {
    const chain = continental
      .filter((entry) => entry.region === region)
      .map((entry) => ({
        id: entry.id,
        size: entry.size,
        places: placesOf(entry.competition, {
          capacityOfGroup: compdata.capacityOfGroup,
          leagueByEaId: index.byEaLeagueId,
          leagueByObjectId: index.byObjectId,
          cupByObjectId,
          positions,
        }),
      }));
    const shared = sharePlaces(chain);
    dropped.push(...shared.dropped);
    for (const [target, field] of shared.fields) {
      earned.set(target, field.filter((place) => place.kind !== "open").length);
      const byLeague = new Map();
      for (const place of field) {
        if (place.kind === "league") {
          const list = byLeague.get(place.league) ?? [];
          list.push(place.position);
          byLeague.set(place.league, list);
        } else if (place.kind === "cup" && place.cup !== target) {
          const list = berthsOfCup.get(place.cup) ?? [];
          list.push({ target, rule: { kind: "cupWinner" } });
          berthsOfCup.set(place.cup, list);
        }
      }
      for (const [league, taken] of byLeague) {
        const list = leagueBerths.get(league) ?? [];
        for (const range of positionRanges(taken)) {
          list.push({ target, rule: { kind: "positionRange", ...range } });
        }
        leagueBerths.set(league, list);
      }
    }
  }
  for (const entity of competitions) entity.berths = berthsOfCup.get(entity.id) ?? [];

  // --- the first season's fields ------------------------------------------
  const inLeague = new Set(leagues.flatMap((league) => league.table));
  const clubFacts = new Map(
    [...clubs].map(([id, facts]) => [id, { ...facts, inLeague: inLeague.has(id) }]),
  );
  const sources = [
    ...leagues.map((league) => ({
      berths: leagueBerths.get(league.id) ?? [],
      table: league.table,
    })),
    ...competitions.map((entity) => ({
      berths: entity.berths,
      winner: holders.get(cupEaLeagueId.get(entity.id)) ?? null,
    })),
    ...continental.map((entry) => ({
      berths: berthsOfCup.get(entry.id) ?? [],
      winner: holders.get(entry.eaLeagueId) ?? null,
    })),
  ];
  const fields = resolveFields({
    targets: continental.map((entry) => ({
      id: entry.id,
      priority: entry.priority,
      size: entry.size,
      region: entry.region,
      preferred: pools.get(entry.eaLeagueId) ?? [],
    })),
    sources,
    clubs: clubFacts,
  });

  // The countries that send clubs to each confederation's competitions. The
  // engine settles all of a confederation's fields in one go, so an edition
  // must not straddle the end of any of their seasons.
  const regionOfTarget = new Map(continental.map((entry) => [entry.id, entry.region]));
  const feederCountries = new Map();
  const feeds = (country, berths) => {
    for (const berth of berths) {
      const region = regionOfTarget.get(berth.target);
      if (!region) continue;
      const countries = feederCountries.get(region) ?? new Set();
      countries.add(country);
      feederCountries.set(region, countries);
    }
  };
  for (const [league, berths] of leagueBerths) feeds(leagueById.get(league).country, berths);
  for (const entity of competitions) feeds(entity.countryId, entity.berths);

  for (const entry of continental) {
    const field = fields.get(entry.id) ?? [];
    if (field.length < entry.size) {
      skipped.push({
        code: entry.competition.code,
        eaLeagueId: entry.eaLeagueId,
        reason: `only ${field.length} of ${entry.size} clubs in its region`,
      });
      continue;
    }
    const format = continentalFormat(entry.size);
    const start = dayOfYear(
      continentalStartDay({
        eaDay: mainStageDay(entry.competition) ?? 0,
        days: competitionDays(entry.size, format),
        seasonEndDays: [...(feederCountries.get(entry.region) ?? [])].map((country) =>
          seasonEndOfCountry.get(country),
        ),
      }),
    );
    competitions.push({
      schema: "competition",
      id: entry.id,
      name: competitionName(entry.recorded.name ?? entry.id),
      type: "ContinentalClub",
      scope: "Continental",
      regionId: entry.region,
      requiredRegionIds: [entry.region],
      priority: entry.priority,
      format,
      participants: { explicit: field },
      berths: berthsOfCup.get(entry.id) ?? [],
      seasonStartMonth: start.month,
      seasonStartDay: start.day,
    });
  }

  // A berth into a competition that could not be authored would be rejected by
  // the engine, so it goes with the competition.
  const authored = new Set(competitions.map((entity) => entity.id));
  const live = (berths) => berths.filter((berth) => authored.has(berth.target));
  for (const [league, berths] of leagueBerths) leagueBerths.set(league, live(berths));
  for (const entity of competitions) {
    entity.berths = live(entity.berths);
    if (entity.berths.length === 0) delete entity.berths;
  }

  return {
    legs,
    leagueBerths,
    competitions,
    summary: {
      // Per continental competition: its size, and how many of its places a
      // league position or a cup win earns. The rest are topped up.
      continental: continental
        .filter((entry) => authored.has(entry.id))
        .map((entry) => ({ id: entry.id, size: entry.size, earned: earned.get(entry.id) ?? 0 })),
      // League places EA gives out that no authored competition has room for.
      dropped: dropped.filter((place) => place.kind === "league"),
      skipped,
    },
  };
}

/**
 * A domestic cup's format, from the stages EA plays it in.
 *
 * A cup with a group stage is authored with one: as many groups as EA has, and
 * as many clubs going through as EA's first knockout round after it holds.
 * Every other cup is a straight knockout. EA's preliminary rounds, which bring
 * the lower divisions in before the top one, are not kept: the engine draws the
 * whole field at once and gives the byes it needs.
 */
function domesticCupFormat(competition, entrants) {
  const stages = competition.stages;
  const groupStage = stages.findIndex(
    (stage) => stage.type === "LEAGUE" && stage.situations.includes("GROUP"),
  );
  if (groupStage < 0) return { kind: "Knockout" };
  const groups = stages[groupStage].groups.length;
  const knockout = stages
    .slice(groupStage + 1)
    .find((stage) => stage.type === "KO1LEG" || stage.type === "KO2LEGS");
  if (groups < 1 || !knockout) return { kind: "Knockout" };
  const format = {
    kind: "GroupAndKnockout",
    legs: stages[groupStage].groups[0].games ?? 1,
    groupSize: Math.ceil(entrants / groups),
    qualifiersPerGroup: Math.floor((knockout.groups.length * 2) / groups),
  };
  return groupFormatFits(entrants, format) ? format : { kind: "Knockout" };
}

/**
 * The first match day of the part of a continental competition this package
 * plays: its group or league stage, not the qualifying rounds before it. A
 * competition with no such stage starts with its first round.
 */
function mainStageDay(competition) {
  const stage = competition.stages.find(
    (candidate) => candidate.type === "LEAGUE" && candidate.schedule.length > 0,
  );
  if (!stage) return firstMatchDay(competition);
  return Math.min(...stage.schedule.map((row) => row.day));
}
