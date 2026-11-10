// @vitest-environment node
/**
 * The build that puts real crests inside the shipped world.
 *
 * `scripts/build-club-badges.mjs` is what turns the committed crest zip and the
 * recorded crosswalk into `mods/eafc-fc27/assets/clubs/*.png`. Two things have
 * to hold for the game to show real badges: the images must be built from the
 * crosswalk (never guessed), and `teams.json` must point at exactly those
 * images. Both are asserted here, against scratch copies of the world so the
 * test never depends on the shipped files being right — that is what
 * `--check` is for in CI.
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { disagreements, planBadges } from "./build-club-badges.mjs";

/** A DDS header for an uncompressed 32-bit BGRA image, as EA's crests are. */
function bgraDds(width, height, rgba) {
  const header = Buffer.alloc(128);
  header.write("DDS ", 0, "latin1");
  header.writeUInt32LE(124, 4);
  header.writeUInt32LE(0x1 | 0x2 | 0x4 | 0x1000, 8);
  header.writeUInt32LE(height, 12);
  header.writeUInt32LE(width, 16);
  header.writeUInt32LE(width * height * 4, 20);
  header.writeUInt32LE(0x1, 76);
  header.writeUInt32LE(0x40 | 0x1, 80);
  header.writeUInt32LE(32, 84);
  header.writeUInt32LE(0xff0000, 92);
  header.writeUInt32LE(0xff00, 96);
  header.writeUInt32LE(0xff, 100);
  header.writeUInt32LE(0xff000000, 104);
  const data = Buffer.alloc(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    data[index * 4] = rgba[2];
    data[index * 4 + 1] = rgba[1];
    data[index * 4 + 2] = rgba[0];
    data[index * 4 + 3] = rgba[3];
  }
  return Buffer.concat([header, data]);
}

/** The smallest zip this test needs: stored entries, no compression. */
function zip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, data] of entries) {
    const nameBytes = Buffer.from(name, "utf8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt32LE(0, 10);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBytes, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(0, 12);
    central.writeUInt32LE(0, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBytes);

    offset += local.length + nameBytes.length + data.length;
  }
  const localBytes = Buffer.concat(locals);
  const centralBytes = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBytes.length, 12);
  end.writeUInt32LE(localBytes.length, 16);
  return Buffer.concat([localBytes, centralBytes, end]);
}

let root;

beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "ofm-badges-"));
  await fs.mkdir(path.join(root, "mods/eafc-fc27"), { recursive: true });
  await fs.mkdir(path.join(root, "tools/eafc-import/data"), { recursive: true });

  const crest = bgraDds(16, 16, [200, 30, 40, 255]);
  await fs.writeFile(
    path.join(root, "crest16x16.zip"),
    zip([
      ["crest16x16/l1.dds", crest],
      ["crest16x16/dark/l1.dds", crest],
      ["crest16x16/l1943.dds", crest],
      ["crest16x16/dark/l1943.dds", crest],
    ]),
  );

  await fs.writeFile(
    path.join(root, "tools/eafc-import/data/fc27-crest-crosswalk.json"),
    JSON.stringify({
      version: 1,
      source: "https://github.com/ViniMacacari/eafc-db-kit",
      badges: [
        { clubId: "arsenal", eaTeamId: 1 },
        { clubId: "afc-bournemouth", eaTeamId: 1943 },
      ],
    }),
  );

  // The competitions file exists even when nothing references a cup badge: the
  // build reads it to find out.
  await fs.writeFile(
    path.join(root, "mods/eafc-fc27/competitions.json"),
    JSON.stringify({ schema: "competition", items: [] }),
  );

  await fs.writeFile(
    path.join(root, "mods/eafc-fc27/teams.json"),
    JSON.stringify({
      schema: "team",
      items: [
        {
          schema: "team",
          id: "afc-bournemouth",
          name: "AFC Bournemouth",
          logo: "assets/clubs/1943.png",
        },
        { schema: "team", id: "arsenal", name: "Arsenal", logo: "assets/clubs/1.png" },
        { schema: "team", id: "aalesunds-fk", name: "Aalesunds FK" },
      ],
    }),
  );
});

afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe("planBadges", () => {
  it("builds one image per crosswalk entry, at package-relative paths", async () => {
    const { files, badges } = await planBadges(root);
    expect(badges.map((badge) => badge.asset)).toEqual([
      "assets/clubs/1.png",
      "assets/clubs/1943.png",
    ]);
    const png = files.get("assets/clubs/1.png");
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    // A 16 px crest upscaled by a whole number, not stretched by the browser.
    expect(png.readUInt32BE(16)).toBe(64);
  });

  it("records provenance and a checksum for every image", async () => {
    const { badges } = await planBadges(root);
    for (const badge of badges) {
      expect(badge.checksum).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(badge.licence).toBe("PersonalUseOnly");
      expect(badge.source).toContain("ea.com");
    }
  });

  it("writes the manifest the pack carries into the archive", async () => {
    const { files } = await planBadges(root);
    const manifest = JSON.parse(files.get("assets/clubs/manifest.json").toString("utf8"));
    expect(manifest.badges).toHaveLength(2);
    // The same shape `import.mjs` writes, so CI's byte comparison of the
    // rebuilt package against this one holds.
    expect(manifest.competitionLogos).toEqual([]);
    expect(manifest.playerFaces).toEqual([]);
  });

  it("leaves a club with no crest in the crosswalk alone", async () => {
    const { files } = await planBadges(root);
    expect([...files.keys()].filter((name) => name.endsWith(".png")).sort()).toEqual([
      "assets/clubs/1.png",
      "assets/clubs/1943.png",
    ]);
  });

  it("catches a club that points at an image the build does not produce", async () => {
    // The loader reads `logo` from the package itself, so a path naming a file
    // the archive does not carry is a badge that never appears — invisible in
    // any test that only looks at the images.
    const { badges } = await planBadges(root);
    const clubs = [
      { id: "arsenal", logo: "assets/clubs/999.png" },
      { id: "afc-bournemouth", logo: "assets/clubs/1943.png" },
    ];
    expect(disagreements(badges, clubs)).toEqual([
      "arsenal: teams.json has assets/clubs/999.png, the crosswalk builds assets/clubs/1.png",
    ]);
  });

  it("catches a logo left behind by a club the crosswalk no longer covers", async () => {
    const { badges } = await planBadges(root);
    const clubs = [
      { id: "arsenal", logo: "assets/clubs/1.png" },
      { id: "afc-bournemouth", logo: "assets/clubs/1943.png" },
      { id: "aalesunds-fk", logo: "assets/clubs/1755.png" },
    ];
    expect(disagreements(badges, clubs)).toEqual([
      "aalesunds-fk: teams.json names assets/clubs/1755.png, the crosswalk builds nothing",
    ]);
  });

  it("accepts the world it just built", async () => {
    const { badges } = await planBadges(root);
    const teams = JSON.parse(
      await fs.readFile(path.join(root, "mods/eafc-fc27/teams.json"), "utf8"),
    );
    expect(disagreements(badges, teams.items)).toEqual([]);
  });
});
