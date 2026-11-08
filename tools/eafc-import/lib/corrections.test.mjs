import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isSyntheticTeam,
  isRosterGroup,
  selectPlayerClub,
  applyClubCorrections,
} from "./corrections.mjs";

// Given a malformed or stale correction, when applied, then reject it rather than guessing a match.
const sourceTeam = { teamid: 7, teamname: "Example FC" };
const correction = {
  teamId: 7,
  expectedName: "Example FC",
  country: "ENG",
  stadiumName: "Example Ground",
  sourceUrl: "https://github.com/openfootball/clubs/blob/abc/example.txt#L1",
};
const entity = { name: "Example FC", country: "ENG", stadiumName: "", city: "Example" };

describe("source-backed import corrections", () => {
  it("excludes synthetic placeholders without excluding real Rest of World clubs", () => {
    // Given real and synthetic source rows, when classified, then only synthetic squads are excluded.
    assert.equal(isSyntheticTeam("Placeholder Custom Team Chapter"), true);
    assert.equal(isSyntheticTeam("FUT Custom Team 19"), true);
    assert.equal(isSyntheticTeam("Real Madrid Classic"), true);
    assert.equal(isSyntheticTeam("MLS All Stars"), true);
    assert.equal(isSyntheticTeam("AEK"), false);
    assert.equal(isSyntheticTeam("Atlético Nacional"), false);
  });

  it("keeps Rest of World roster groups out of domestic-league preference", () => {
    // Given grouping labels, when classified, then neither is treated as an actual domestic competition.
    assert.equal(isRosterGroup("Rest of World Men"), true);
    assert.equal(isRosterGroup("Rest of World Men Custom"), true);
    assert.equal(isRosterGroup("Rest of World"), true);
    assert.equal(isRosterGroup("England Premier League (1)"), false);
  });

  it("preserves a real player linked to an excluded synthetic team", () => {
    // Given one synthetic and one imported club link, when selecting ownership, then the real club wins regardless of ordering.
    const imported = new Map([
      [7, "real"],
      [8, "continental"],
    ]);
    assert.equal(selectPlayerClub([99, 8, 7], new Set([7, 99]), imported), 7);
    assert.equal(selectPlayerClub([99, 8], new Set([99]), imported), 8);
  });

  it("omits synthetic-only players rather than turning them into free agents", () => {
    // Given only an excluded team link, when selecting ownership, then no imported club or free-agent record is invented.
    assert.equal(selectPlayerClub([99], new Set([99]), new Map()), undefined);
  });

  it("fills a missing stadium by checked source ID and keeps the input unchanged", () => {
    // Given a verified mapping, when filling a gap, then no fuzzy name join or input mutation occurs.
    const original = structuredClone(entity);
    const mapped = applyClubCorrections([correction], [sourceTeam]);
    const output = mapped(sourceTeam, entity);
    assert.equal(output.stadiumName, "Example Ground");
    assert.deepEqual(entity, original);
  });

  it("does not replace a named source stadium", () => {
    // Given a named EA ground, when a supplement exists, then the direct source wins.
    const mapped = applyClubCorrections([correction], [sourceTeam]);
    assert.equal(
      mapped(sourceTeam, { ...entity, stadiumName: "EA Ground" }).stadiumName,
      "EA Ground",
    );
  });

  it("corrects an explicitly identified country-name city fallback", () => {
    // Given a mapping that names the old fallback, when applied, then only that exact fallback is replaced.
    const mapped = applyClubCorrections(
      [{ ...correction, city: "Example Town", expectedCity: "England" }],
      [sourceTeam],
    );
    assert.equal(mapped(sourceTeam, { ...entity, city: "England" }).city, "Example Town");
    assert.throws(() => mapped(sourceTeam, entity), /city mismatch/);
  });

  it("rejects duplicate correction IDs", () => {
    // Given two mappings for the same ID, when loaded, then ambiguity is rejected.
    assert.throws(() => applyClubCorrections([correction, correction], [sourceTeam]), /duplicate/);
  });

  it("rejects unmatched correction IDs", () => {
    // Given an absent source ID, when loaded, then a stale mapping cannot silently disappear.
    assert.throws(() => applyClubCorrections([correction], []), /missing source team/);
  });

  it("rejects changed source names instead of applying an ID to the wrong club", () => {
    // Given a changed source name, when loaded, then the mapping must be reviewed.
    assert.throws(
      () => applyClubCorrections([correction], [{ ...sourceTeam, teamname: "Other FC" }]),
      /name mismatch/,
    );
  });

  it("rejects country mismatches before changing the club", () => {
    // Given an identically named club from another country, when applied, then the correction is rejected.
    const mapped = applyClubCorrections([correction], [sourceTeam]);
    assert.throws(() => mapped(sourceTeam, { ...entity, country: "FR" }), /country mismatch/);
  });

  it("rejects names without provenance and placeholder ground names", () => {
    // Given untraceable or placeholder names, when loaded, then neither can become a real stadium claim.
    assert.throws(
      () => applyClubCorrections([{ ...correction, sourceUrl: "" }], [sourceTeam]),
      /invalid correction/,
    );
    assert.throws(
      () => applyClubCorrections([{ ...correction, stadiumName: "_Generic" }], [sourceTeam]),
      /invalid correction/,
    );
  });
});
