/**
 * The crosswalk from a package's club ids to EA's crest ids.
 *
 * The failure that matters here is not "no badge" — a missing badge falls back
 * to a generated crest and looks deliberate. It is a *wrong* badge: pointing a
 * club at another club's crest, which looks like a bug in the game rather than
 * a gap in the artwork. So the ambiguous cases are the ones under test, and the
 * rule is that they are refused rather than guessed.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { listCrests, planClubBadges } from "./crestPack.mjs";

const names = [
  "crest16x16/l1.dds",
  "crest16x16/l2.dds",
  "crest16x16/l1943.dds",
  "crest16x16/dark/l1.dds",
  "crest16x16/dark/l2.dds",
  "crest16x16/dark/l1943.dds",
  "crest16x16/notes.txt",
];

describe("listCrests", () => {
  it("selects one variant and ignores everything else", () => {
    const light = listCrests(names, "light");
    const dark = listCrests(names, "dark");
    assert.deepEqual([...light.keys()], [1, 2, 1943]);
    assert.deepEqual([...dark.keys()], [1, 2, 1943]);
    // The variants are different files, which is the point of having two.
    assert.equal(light.get(1), "crest16x16/l1.dds");
    assert.equal(dark.get(1), "crest16x16/dark/l1.dds");
  });

  it("ignores files that are not crest ids", () => {
    assert.equal(listCrests(["crest16x16/readme.md", "crest16x16/1.dds"], "light").size, 0);
  });
});

describe("planClubBadges", () => {
  const crests = new Map([
    [1, "crest16x16/l1.dds"],
    [2, "crest16x16/l2.dds"],
    [1943, "crest16x16/l1943.dds"],
  ]);

  it("maps a club to the crest of the EA team of the same name", () => {
    const { badges, missing } = planClubBadges(
      [{ id: "arsenal" }, { id: "aston-villa" }],
      [
        { teamId: 1, name: "Arsenal" },
        { teamId: 2, name: "Aston Villa" },
      ],
      crests,
    );
    assert.deepEqual(badges, [
      { clubId: "arsenal", teamId: 1, crest: "crest16x16/l1.dds" },
      { clubId: "aston-villa", teamId: 2, crest: "crest16x16/l2.dds" },
    ]);
    assert.deepEqual(missing, []);
  });

  it("uses the crest to choose between two EA rows that share a name", () => {
    // EA lists Arsenal twice (the club and a "rest of world" copy) but ships a
    // crest for only one of them.
    const { badges, missing } = planClubBadges(
      [{ id: "arsenal" }],
      [
        { teamId: 1, name: "Arsenal" },
        { teamId: 116009, name: "Arsenal" },
      ],
      new Map([[116009, "crest16x16/l116009.dds"]]),
    );
    assert.deepEqual(badges, [
      { clubId: "arsenal", teamId: 116009, crest: "crest16x16/l116009.dds" },
    ]);
    assert.deepEqual(missing, []);
  });

  it("refuses a name shared by two clubs that both have a crest", () => {
    // Picking either would be a guess, and a wrong badge is worse than none.
    const { badges, missing } = planClubBadges(
      [{ id: "arsenal" }],
      [
        { teamId: 1, name: "Arsenal" },
        { teamId: 116009, name: "Arsenal" },
      ],
      new Map([
        [1, "crest16x16/l1.dds"],
        [116009, "crest16x16/l116009.dds"],
      ]),
    );
    assert.deepEqual(badges, []);
    assert.equal(missing.length, 1);
    assert.match(missing[0].reason, /ambiguous/);
  });

  it("resolves a disambiguated club id by its EA id suffix", () => {
    const { badges } = planClubBadges(
      [{ id: "bucheon-fc-1995" }],
      [
        { teamId: 1995, name: "Bucheon FC 1995" },
        { teamId: 2005, name: "Bucheon FC 1995" },
      ],
      new Map([[1995, "crest16x16/l1995.dds"]]),
    );
    assert.deepEqual(badges, [
      { clubId: "bucheon-fc-1995", teamId: 1995, crest: "crest16x16/l1995.dds" },
    ]);
  });

  it("does not read a name ending in a number as an id suffix on its own", () => {
    // `bucheon-fc-1995` is a slug whose last word happens to be a number. It
    // must still be found by name when the EA row id is something else.
    const { badges } = planClubBadges(
      [{ id: "bucheon-fc-1995" }],
      [{ teamId: 111745, name: "Bucheon FC 1995" }],
      new Map([[111745, "crest16x16/l111745.dds"]]),
    );
    assert.deepEqual(badges, [
      { clubId: "bucheon-fc-1995", teamId: 111745, crest: "crest16x16/l111745.dds" },
    ]);
  });

  it("reports a club whose EA team has no crest", () => {
    const { badges, missing } = planClubBadges(
      [{ id: "aalesunds-fk" }],
      [{ teamId: 1755, name: "Aalesunds FK" }],
      crests,
    );
    assert.deepEqual(badges, []);
    assert.deepEqual(missing, [
      { clubId: "aalesunds-fk", reason: "no crest for any EA candidate" },
    ]);
  });

  it("reports a club with no matching EA team at all", () => {
    const { missing } = planClubBadges([{ id: "invented-fc" }], [], crests);
    assert.deepEqual(missing, [{ clubId: "invented-fc", reason: "no EA team" }]);
  });

  it("returns clubs in id order, so a rebuild produces the same manifest", () => {
    const { badges } = planClubBadges(
      [{ id: "aston-villa" }, { id: "arsenal" }],
      [
        { teamId: 2, name: "Aston Villa" },
        { teamId: 1, name: "Arsenal" },
      ],
      crests,
    );
    assert.deepEqual(
      badges.map((badge) => badge.clubId),
      ["arsenal", "aston-villa"],
    );
  });
});
