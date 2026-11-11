// @vitest-environment node
/**
 * The build that puts real crests and competition logos inside the shipped world.
 *
 * `scripts/build-club-badges.mjs` is what turns the committed crest zip and the
 * recorded crosswalk into `mods/eafc-fc27/assets/clubs/*.png`, and the committed
 * league-logo zip and its crosswalk into `assets/competitions/*.png`. Two things
 * have to hold for the game to show real artwork: the images must be built from
 * the crosswalks (never guessed), and `teams.json` and `competitions.json` must
 * point at exactly those images. Both are asserted here, against scratch copies
 * of the world so the test never depends on the shipped files being right —
 * that is what `--check` is for in CI.
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { deflateRawSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  competitionDisagreements,
  disagreements,
  leftoverFiles,
  planBadges,
} from "./build-club-badges.mjs";

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

/**
 * A league-logo texture as EA draws them: artwork in the middle of a wide
 * transparent margin. Here a white `boxWidth × boxHeight` block centred in a
 * `size × size` texture.
 */
function logoDds(size, boxWidth, boxHeight) {
  const texture = bgraDds(size, size, [0, 0, 0, 0]);
  const left = (size - boxWidth) / 2;
  const top = (size - boxHeight) / 2;
  for (let y = top; y < top + boxHeight; y += 1) {
    for (let x = left; x < left + boxWidth; x += 1) {
      texture.fill(255, 128 + (y * size + x) * 4, 128 + (y * size + x) * 4 + 4);
    }
  }
  return texture;
}

/**
 * The container EA wraps most league logos in: a header, then the file as
 * deflated blocks. One block is all a texture this small needs.
 */
function chunkzip(payload) {
  const header = Buffer.alloc(28);
  header.write("chunkzip", 0, "latin1");
  header.writeUInt32BE(2, 8);
  header.writeUInt32BE(payload.length, 12);
  header.writeUInt32BE(payload.length, 16);
  header.writeUInt32BE(1, 20);
  header.writeUInt32BE(16, 24);
  const deflated = deflateRawSync(payload);
  const blockHeader = Buffer.alloc(8);
  blockHeader.writeUInt32BE(deflated.length, 0);
  blockHeader.writeUInt32BE(1, 4);
  // Twelve bytes of padding put the deflate stream on a multiple of sixteen.
  return Buffer.concat([header, Buffer.alloc(12), blockHeader, deflated]);
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

  const crest = bgraDds(64, 64, [200, 30, 40, 255]);
  await fs.writeFile(
    path.join(root, "crest50x50.zip"),
    zip([
      ["crest50x50/l1.dds", crest],
      ["crest50x50/l1943.dds", crest],
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

  // One logo EA wrapped and one it left bare, as the real pack holds both.
  await fs.writeFile(
    path.join(root, "leagues.zip"),
    zip([
      ["leagues/l13.dds", chunkzip(logoDds(16, 8, 4))],
      ["leagues/l201.dds", logoDds(16, 4, 8)],
    ]),
  );

  // A league the database stands behind, and a cup named by hand that the
  // world does not have yet.
  await fs.writeFile(
    path.join(root, "tools/eafc-import/data/fc27-league-logo-crosswalk.json"),
    JSON.stringify({
      version: 1,
      source: "https://github.com/ViniMacacari/eafc-db-kit",
      leagues: [{ competitionId: "eng-premier-league", eaLeagueId: 13 }],
      authored: [{ competitionId: "eng-fa-cup", eaLeagueId: 201, name: "FA Cup" }],
    }),
  );

  await fs.writeFile(
    path.join(root, "mods/eafc-fc27/competitions.json"),
    JSON.stringify({
      schema: "competition",
      items: [
        {
          schema: "competition",
          id: "eng-premier-league",
          name: "Premier League",
          logo: "assets/competitions/eng-premier-league.png",
        },
        { schema: "competition", id: "eng-championship", name: "Championship" },
      ],
    }),
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
  it("builds one image per crosswalk entry, cropped to 50×50 at package-relative paths", async () => {
    const { files, badges } = await planBadges(root);
    expect(badges.map((badge) => badge.asset)).toEqual([
      "assets/clubs/1.png",
      "assets/clubs/1943.png",
    ]);
    const png = files.get("assets/clubs/1.png");
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    // 50×50 cropped cleanly from the 64×64 DDS texture.
    expect(png.readUInt32BE(16)).toBe(50);
    expect(png.readUInt32BE(20)).toBe(50);
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
    expect(manifest.competitionLogos).toHaveLength(2);
    expect(manifest.playerFaces).toEqual([]);
  });

  it("leaves a club with no crest in the crosswalk alone", async () => {
    const { files } = await planBadges(root);
    expect([...files.keys()].filter((name) => name.startsWith("assets/clubs/")).sort()).toEqual([
      "assets/clubs/1.png",
      "assets/clubs/1943.png",
      "assets/clubs/manifest.json",
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

describe("competition logos", () => {
  const pngSize = (png) => [png.readUInt32BE(16), png.readUInt32BE(20)];

  it("builds one image per league-logo crosswalk entry, named after its competition", async () => {
    const { files, competitionLogos } = await planBadges(root);
    // The leagues the database stands behind first, then the logos named by
    // hand: the order the importer's manifest lists them in.
    expect(competitionLogos.map((logo) => logo.asset)).toEqual([
      "assets/competitions/eng-premier-league.png",
      "assets/competitions/eng-fa-cup.png",
    ]);
    const png = files.get("assets/competitions/eng-premier-league.png");
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  });

  it("unwraps the textures EA wrapped and crops every logo to its artwork", async () => {
    const { files } = await planBadges(root);
    // Both were 16×16 textures; what ships is the block in the middle.
    expect(pngSize(files.get("assets/competitions/eng-premier-league.png"))).toEqual([8, 4]);
    expect(pngSize(files.get("assets/competitions/eng-fa-cup.png"))).toEqual([4, 8]);
  });

  it("records each logo in the manifest, with provenance and a checksum", async () => {
    const { files } = await planBadges(root);
    const manifest = JSON.parse(files.get("assets/clubs/manifest.json").toString("utf8"));
    expect(manifest.competitionLogos.map((logo) => Object.keys(logo))).toEqual([
      ["competitionId", "asset", "source", "licence", "attribution", "checksum"],
      ["competitionId", "asset", "source", "licence", "attribution", "checksum"],
    ]);
    const [league] = manifest.competitionLogos;
    expect(league.competitionId).toBe("eng-premier-league");
    expect(league.asset).toBe("assets/competitions/eng-premier-league.png");
    expect(league.checksum).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(league.licence).toBe("PersonalUseOnly");
    expect(league.source).toContain("ea.com");
  });

  it("accepts the world it just built, cup without a competition included", async () => {
    // `eng-fa-cup` has a logo and no competition: its artwork ships ahead of
    // the competition, and that is not a disagreement.
    const { competitionLogos } = await planBadges(root);
    const competitions = JSON.parse(
      await fs.readFile(path.join(root, "mods/eafc-fc27/competitions.json"), "utf8"),
    );
    expect(competitionDisagreements(competitionLogos, competitions.items)).toEqual([]);
  });

  it("catches a competition that points at an image the build does not produce", async () => {
    const { competitionLogos } = await planBadges(root);
    expect(
      competitionDisagreements(competitionLogos, [
        { id: "eng-premier-league", logo: "assets/competitions/eng-premier-league.svg" },
      ]),
    ).toEqual([
      "eng-premier-league: competitions.json has assets/competitions/eng-premier-league.svg, the crosswalk builds assets/competitions/eng-premier-league.png",
    ]);
  });

  it("catches a competition that has a logo built for it and does not name it", async () => {
    // The image would ship and never be drawn.
    const { competitionLogos } = await planBadges(root);
    expect(competitionDisagreements(competitionLogos, [{ id: "eng-premier-league" }])).toEqual([
      "eng-premier-league: competitions.json has no logo, the crosswalk builds assets/competitions/eng-premier-league.png",
    ]);
  });

  it("catches a logo path left behind on a competition the crosswalk does not cover", async () => {
    const { competitionLogos } = await planBadges(root);
    expect(
      competitionDisagreements(competitionLogos, [
        { id: "eng-premier-league", logo: "assets/competitions/eng-premier-league.png" },
        { id: "eng-championship", logo: "assets/competitions/eng-championship.png" },
      ]),
    ).toEqual([
      "eng-championship: competitions.json names assets/competitions/eng-championship.png, the crosswalk builds nothing",
    ]);
  });

  it("catches a league the crosswalk took from the database that has left the world", async () => {
    // A derived pair only exists because the competition was imported. One
    // without its competition means the crosswalk is older than the world.
    const { competitionLogos } = await planBadges(root);
    expect(competitionDisagreements(competitionLogos, [])).toEqual([
      "eng-premier-league: the crosswalk derives a logo for it, but competitions.json has no such competition",
    ]);
  });
});

describe("leftoverFiles", () => {
  it("finds artwork in the world that the build no longer produces", async () => {
    const { files } = await planBadges(root);
    const world = path.join(root, "mods/eafc-fc27");
    for (const [name, data] of files) {
      await fs.mkdir(path.dirname(path.join(world, name)), { recursive: true });
      await fs.writeFile(path.join(world, name), data);
    }
    expect(await leftoverFiles(world, files)).toEqual([]);

    // A badge for a club that lost its crest, and a logo in a format the build
    // has stopped writing.
    await fs.writeFile(path.join(world, "assets/clubs/999.png"), "stale");
    await fs.writeFile(path.join(world, "assets/competitions/eng-premier-league.svg"), "stale");
    expect(await leftoverFiles(world, files)).toEqual([
      "assets/clubs/999.png",
      "assets/competitions/eng-premier-league.svg",
    ]);
  });

  it("has nothing to report for a world with no artwork folders yet", async () => {
    const empty = await fs.mkdtemp(path.join(os.tmpdir(), "ofm-badges-empty-"));
    try {
      expect(await leftoverFiles(empty, new Map())).toEqual([]);
    } finally {
      await fs.rm(empty, { recursive: true, force: true });
    }
  });
});
