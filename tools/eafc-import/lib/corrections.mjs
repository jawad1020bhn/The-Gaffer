/** Classify squads that must never enter a real-club package. */
export function isSyntheticTeam(name) {
  return /classic|all[\s-]?stars?|meta pass|default teams|soccer aid|marketing team|\bplaceholder\b|\bcustom team\b/i.test(
    String(name ?? ""),
  );
}

/** These rows retain real clubs but are not domestic leagues or qualification evidence. */
export function isRosterGroup(name) {
  return /^rest of world(?: men| women)?(?: custom)?$/i.test(String(name ?? "").trim());
}

/** Excluded teams cannot take ownership; a remaining domestic club beats a continental/group link. */
export function selectPlayerClub(teamIds, domesticTeamIds, importedTeams) {
  return (
    teamIds.find((id) => domesticTeamIds.has(id) && importedTeams.has(id)) ??
    teamIds.find((id) => importedTeams.has(id))
  );
}

const nonempty = (text) => typeof text === "string" && text.trim().length > 0;

function validateCorrection(correction) {
  const { teamId, expectedName, country, stadiumName, sourceUrl, city, expectedCity } = correction;
  if (
    !Number.isInteger(teamId) ||
    teamId <= 0 ||
    !nonempty(expectedName) ||
    !/^[A-Z]{2,3}$/.test(country ?? "") ||
    !nonempty(stadiumName) ||
    stadiumName.trim().startsWith("_") ||
    !/^https:\/\/github\.com\/.+\/blob\/.+#L\d+$/.test(sourceUrl ?? "") ||
    (city !== undefined && (!nonempty(city) || !nonempty(expectedCity)))
  ) {
    throw new Error(`invalid correction for EA team ${teamId}`);
  }
}

/** Validate all mappings before a package is written. No fuzzy joins, silent stale IDs or input mutation. */
export function applyClubCorrections(corrections, sourceTeams) {
  const sourceById = new Map(sourceTeams.map((team) => [team.teamid, team]));
  const byId = new Map();
  for (const correction of corrections) {
    validateCorrection(correction);
    if (byId.has(correction.teamId))
      throw new Error(`duplicate correction for EA team ${correction.teamId}`);
    const source = sourceById.get(correction.teamId);
    if (!source) throw new Error(`missing source team ${correction.teamId}`);
    if (String(source.teamname).trim() !== correction.expectedName) {
      throw new Error(`name mismatch for EA team ${correction.teamId}`);
    }
    byId.set(correction.teamId, correction);
  }
  return (source, entity) => {
    const correction = byId.get(source.teamid);
    if (!correction) return entity;
    if (entity.country !== correction.country)
      throw new Error(`country mismatch for EA team ${source.teamid}`);
    if (correction.city !== undefined && entity.city !== correction.expectedCity) {
      throw new Error(`city mismatch for EA team ${source.teamid}`);
    }
    return {
      ...entity,
      stadiumName: nonempty(entity.stadiumName) ? entity.stadiumName : correction.stadiumName,
      city: correction.city ?? entity.city,
    };
  };
}
