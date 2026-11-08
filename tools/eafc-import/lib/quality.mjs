import { collectEntities } from "../validate.mjs";

const hasText = (value) => typeof value === "string" && value.trim().length > 0;
const clubSummary = ({ id, name, country }) => ({ id, name, country });

function isDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function coverage(items, predicate) {
  const present = items.filter(predicate).length;
  return { present, missing: items.length - present, total: items.length };
}

/** Source coverage, not loader validity or a world-generation policy. Never edits input. */
export function auditQuality(documents) {
  const entities = collectEntities(documents);
  const teams = entities.get("team") ?? [];
  const players = entities.get("player") ?? [];
  const competitions = entities.get("competition") ?? [];
  const year = entities.get("world")?.[0]?.baseYear;
  const baseYear = Number.isInteger(year) && year >= 1 && year <= 9999 ? year : null;
  const cutoff = baseYear === null ? null : `${String(baseYear).padStart(4, "0")}-01-01`;
  const teamIds = new Set(teams.map((team) => team.id));
  const assigned = new Set();
  const danglingParticipants = [];
  for (const competition of competitions) {
    for (const id of competition.participants?.explicit ?? []) {
      assigned.add(id);
      if (!teamIds.has(id)) danglingParticipants.push({ competition: competition.id, team: id });
    }
  }
  return {
    baseYear,
    contractCutoff: cutoff,
    counts: {
      clubs: teams.length,
      players: players.length,
      competitions: competitions.length,
      staff: (entities.get("staff") ?? []).length,
      nationalTournaments: competitions.filter(
        (competition) => competition.type === "InternationalNation",
      ).length,
    },
    coverage: {
      stadiumName: coverage(teams, (team) => hasText(team.stadiumName)),
      wage: coverage(players, (player) => Number.isFinite(player.wage) && player.wage > 0),
      weakFoot: coverage(
        players,
        (player) =>
          Number.isInteger(player.weakFoot) && player.weakFoot >= 1 && player.weakFoot <= 5,
      ),
      contractEnd: coverage(players, (player) => isDate(player.contractEnd)),
    },
    // A selector needs the engine to resolve its field; absence from explicit lists is not proof of absence from play.
    competitionCoverageComplete: !competitions.some(
      (competition) => competition.participants?.selector != null,
    ),
    clubsWithoutExplicitCompetition: teams
      .filter((team) => !assigned.has(team.id))
      .map(clubSummary),
    danglingParticipants,
    contractsBeforeBaseYear:
      cutoff === null
        ? null
        : players
            .filter((player) => isDate(player.contractEnd) && player.contractEnd < cutoff)
            .map(({ id, name, club, contractEnd }) => ({ id, name, club, contractEnd })),
    placeholderClubs: teams
      .filter((team) => /^placeholder\b/i.test(team.name ?? ""))
      .map(clubSummary),
  };
}
