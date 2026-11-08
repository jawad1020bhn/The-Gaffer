import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { auditQuality } from "./quality.mjs";

const document = (schema, items) => ({ schema, items });
const world = { schema: "world", baseYear: 2027 };

describe("package data quality", () => {
  it("separates unassigned clubs from broken participant references", () => {
    // Given two clubs and one dangling reference, when audited, only the real idle club is unassigned.
    const report = auditQuality([
      world,
      document("team", [
        { id: "playing", name: "Playing" },
        { id: "idle", name: "Idle" },
      ]),
      document("competition", [
        { id: "league", participants: { explicit: ["playing", "missing"] } },
      ]),
    ]);
    assert.deepEqual(
      report.clubsWithoutExplicitCompetition.map((team) => team.id),
      ["idle"],
    );
    assert.deepEqual(report.danglingParticipants, [{ competition: "league", team: "missing" }]);
    assert.equal(report.competitionCoverageComplete, true);
  });

  it("marks selector coverage as unresolved rather than claiming clubs are unassigned", () => {
    // Given a selector, when audited without building a world, then coverage is explicitly incomplete.
    const report = auditQuality([
      document("competition", [
        { participants: { selector: { kind: "allInCountry", country: "ENG" } } },
      ]),
    ]);
    assert.equal(report.competitionCoverageComplete, false);
  });

  it("reports only valid contract dates strictly before the base year", () => {
    // Given boundary and invalid dates, when audited, then only the stale source date is flagged.
    const players = [
      { id: "stale", contractEnd: "2026-06-30" },
      { id: "boundary", contractEnd: "2027-01-01" },
      { id: "later", contractEnd: "2027-06-30" },
      { id: "invalid", contractEnd: "2026-02-30" },
      { id: "missing" },
    ];
    const report = auditQuality([world, document("player", players)]);
    assert.deepEqual(
      report.contractsBeforeBaseYear.map((player) => player.id),
      ["stale"],
    );
    assert.equal(report.coverage.contractEnd.present, 3);
  });

  it("does not invent a reference date when baseYear is absent", () => {
    // Given no base year, when audited, then the stale-contract check is unavailable, not zero.
    const report = auditQuality([document("player", [{ contractEnd: "2026-06-30" }])]);
    assert.equal(report.baseYear, null);
    assert.equal(report.contractsBeforeBaseYear, null);
  });

  it("counts usable wages, weak feet and stadium names without filling gaps", () => {
    // Given omitted, zero and invalid values, when audited, then only usable source fields count.
    const documents = [
      world,
      document("team", [
        { id: "named", stadiumName: "Anfield" },
        { id: "blank", stadiumName: " " },
        { id: "absent" },
      ]),
      document("player", [
        { id: "known", wage: 500, weakFoot: 4 },
        { id: "zero", wage: 0, weakFoot: 0 },
        { id: "absent" },
        { id: "invalid", wage: -10, weakFoot: 3.5 },
      ]),
    ];
    const before = JSON.stringify(documents);
    const report = auditQuality(documents);
    assert.deepEqual(report.coverage.wage, { present: 1, missing: 3, total: 4 });
    assert.deepEqual(report.coverage.weakFoot, { present: 1, missing: 3, total: 4 });
    assert.deepEqual(report.coverage.stadiumName, { present: 1, missing: 2, total: 3 });
    assert.equal(JSON.stringify(documents), before);
  });

  it("flags placeholder clubs and distinguishes staff records from national tournaments", () => {
    // Given a placeholder and a national tournament, when audited, then neither is called a real club or national-team record.
    const report = auditQuality([
      document("team", [{ id: "fake", name: "Placeholder Custom Team Chapter" }]),
      document("competition", [{ type: "InternationalNation" }]),
      document("staff", [{ id: "coach" }]),
    ]);
    assert.deepEqual(
      report.placeholderClubs.map((team) => team.id),
      ["fake"],
    );
    assert.equal(report.counts.staff, 1);
    assert.equal(report.counts.nationalTournaments, 1);
  });

  it("returns zero coverage totals for empty packages", () => {
    // Given an empty package, when audited, then metrics remain finite and contain no fabricated records.
    const report = auditQuality([]);
    assert.deepEqual(report.coverage.wage, { present: 0, missing: 0, total: 0 });
    assert.deepEqual(report.counts, {
      clubs: 0,
      players: 0,
      competitions: 0,
      staff: 0,
      nationalTournaments: 0,
    });
  });
});
