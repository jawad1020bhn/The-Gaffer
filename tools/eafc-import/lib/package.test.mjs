import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  collectEntities,
  readPackageDocuments,
  validatePackage,
  loadCountryCatalog,
} from "../validate.mjs";
import { auditQuality } from "./quality.mjs";
import { isSyntheticTeam } from "./corrections.mjs";

const root = new URL("../../../", import.meta.url);
const { documents } = await readPackageDocuments(fileURLToPath(new URL("mods/eafc-fc27/", root)));
const entities = collectEntities(documents);
const teams = entities.get("team");
const players = entities.get("player");
const corrections = JSON.parse(
  await readFile(new URL("../data/fc27-club-corrections.json", import.meta.url), "utf8"),
);

it("ships real club rows without placeholder-only fake players", () => {
  // Given the rebuilt checked-in package, when scanned, then synthetic teams and their fake-only roster are absent.
  assert.equal(teams.length, 684);
  assert.equal(players.length, 18875);
  assert.deepEqual(
    teams.filter((team) => isSyntheticTeam(team.name)),
    [],
  );
  assert.deepEqual(
    players.filter((player) => /fakeplayer/i.test(player.name)),
    [],
  );
});

it("applies every reviewed stadium mapping to the intended imported club", () => {
  // Given curated ID/name/country mappings, when checking output, then every mapped name reaches its exact club.
  for (const correction of corrections.clubs) {
    const team = teams.find(
      (team) => team.name === correction.expectedName && team.country === correction.country,
    );
    assert.ok(team, `missing ${correction.expectedName}`);
    assert.equal(team.stadiumName, correction.stadiumName, correction.expectedName);
    if (correction.city !== undefined) assert.equal(team.city, correction.city);
  }
});

it("keeps unresolved source gaps visible without fabricating data", () => {
  // Given all possible verified corrections, when audited, then unresolved contracts and coverage still reflect source limitations.
  const report = auditQuality(documents);
  assert.equal(report.clubsWithoutExplicitCompetition.length, 20);
  assert.equal(report.contractsBeforeBaseYear.length, 1877);
  assert.equal(report.coverage.wage.present, 440);
  assert.equal(report.coverage.weakFoot.missing, 2074);
  assert.equal(report.coverage.stadiumName.present, 136 + corrections.clubs.length);
  assert.ok(
    players
      .filter((player) => player.weakFoot == null)
      .every((player) => player.position === "Goalkeeper"),
  );
  assert.equal(report.counts.staff, 0);
  assert.equal(report.counts.nationalTournaments, 0);
});

it("retains valid references and loader-compatible attributes after corrections", async () => {
  // Given the corrected package, when schema and references are checked, then no removed club is still referenced.
  const countryCodes = await loadCountryCatalog(fileURLToPath(root));
  assert.deepEqual(validatePackage({ documents, countryCodes }), []);
});
