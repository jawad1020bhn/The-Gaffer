/**
 * Turning EA's league-logo pack into competition logos.
 *
 * Two things can go wrong, and they are different kinds of wrong. The image can
 * be damaged on the way from a 1024×1024 texture to a file a browser draws: a
 * logo cropped through its lettering, or a coloured fringe where a transparent
 * edge was averaged as if it were ink. And the logo can land on the wrong
 * competition, which reads as a bug in the game rather than a gap in the
 * artwork. Both are checked here against pixels and rows that are known
 * exactly, so no EA file is needed to run this.
 */

import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { describe, it } from "node:test";

import {
  LEAGUE_LOGO_SIZE,
  buildLeagueLogos,
  eaLeagueCompetitions,
  leagueLogoToPng,
  listLeagueLogos,
  planLeagueLogos,
  readLeagueLogoCrosswalk,
  scaleToFit,
  trimTransparent,
} from "./leagueLogos.mjs";

const CLEAR = [0, 0, 0, 0];

/** An image from rows of `[r, g, b, a]` pixels. */
function imageOf(rows) {
  const height = rows.length;
  const width = rows[0].length;
  const pixels = new Uint8Array(width * height * 4);
  for (const [y, row] of rows.entries()) {
    for (const [x, pixel] of row.entries()) pixels.set(pixel, (y * width + x) * 4);
  }
  return { width, height, pixels };
}

/** A `width × height` image, clear except where `paint(x, y)` returns a pixel. */
function canvas(width, height, paint) {
  return imageOf(
    Array.from({ length: height }, (_, y) =>
      Array.from({ length: width }, (_, x) => paint(x, y) ?? CLEAR),
    ),
  );
}

const pixelAt = (image, x, y) => {
  const offset = (y * image.width + x) * 4;
  return [...image.pixels.subarray(offset, offset + 4)];
};

const grey = (value) => [value, value, value, 255];

/** An uncompressed 32-bit DDS, the plainer of the two formats the pack holds. */
function bgraDds(image) {
  const { width, height, pixels } = image;
  const header = Buffer.alloc(128);
  header.write("DDS ", 0, "latin1");
  header.writeUInt32LE(124, 4);
  header.writeUInt32LE(0x1 | 0x2 | 0x4 | 0x1000, 8);
  header.writeUInt32LE(height, 12);
  header.writeUInt32LE(width, 16);
  header.writeUInt32LE(width * height * 4, 20);
  header.writeUInt32LE(0x1, 76);
  header.writeUInt32LE(0x40 | 0x1, 80); // pfFlags: RGB | ALPHAPIXELS
  header.writeUInt32LE(32, 84);
  header.writeUInt32LE(0xff0000, 92);
  header.writeUInt32LE(0xff00, 96);
  header.writeUInt32LE(0xff, 100);
  header.writeUInt32LE(0xff000000, 104);
  const data = Buffer.alloc(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    data[index * 4] = pixels[index * 4 + 2];
    data[index * 4 + 1] = pixels[index * 4 + 1];
    data[index * 4 + 2] = pixels[index * 4];
    data[index * 4 + 3] = pixels[index * 4 + 3];
  }
  return Buffer.concat([header, data]);
}

/** One chunkzip block around the whole payload, which is all a small file needs. */
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
  // A 28-byte header and an 8-byte block header: twelve bytes of padding put
  // the deflate stream on 48.
  return Buffer.concat([header, Buffer.alloc(12), blockHeader, deflated]);
}

const pngSize = (png) => [png.readUInt32BE(16), png.readUInt32BE(20)];

describe("listLeagueLogos", () => {
  it("selects leagues/l<id>.dds entries keyed by EA league id", () => {
    const logos = listLeagueLogos(["leagues/", "leagues/l13.dds", "leagues/l2076.dds"]);
    assert.deepEqual([...logos.keys()], [13, 2076]);
    assert.equal(logos.get(13), "leagues/l13.dds");
  });

  it("ignores files that are not leagues/l<id>.dds", () => {
    assert.equal(
      listLeagueLogos(["leagues/readme.md", "leagues/13.dds", "crest50x50/l13.dds"]).size,
      0,
    );
  });
});

describe("trimTransparent", () => {
  it("crops to the box around everything that is visible", () => {
    const red = [200, 0, 0, 255];
    const blue = [0, 0, 200, 255];
    const trimmed = trimTransparent(
      canvas(6, 5, (x, y) => (x === 2 && y === 1 ? red : x === 4 && y === 3 ? blue : null)),
    );
    assert.equal(trimmed.width, 3);
    assert.equal(trimmed.height, 3);
    assert.deepEqual(pixelAt(trimmed, 0, 0), red);
    assert.deepEqual(pixelAt(trimmed, 2, 2), blue);
    assert.deepEqual(pixelAt(trimmed, 1, 1), CLEAR);
  });

  it("keeps the faintest edge, which is the antialiasing of the shape beside it", () => {
    const trimmed = trimTransparent(
      canvas(4, 1, (x) => (x === 1 ? [255, 255, 255, 1] : x === 2 ? grey(255) : null)),
    );
    assert.equal(trimmed.width, 2);
    assert.deepEqual(pixelAt(trimmed, 0, 0), [255, 255, 255, 1]);
  });

  it("returns an image with no margin as it is", () => {
    const tight = imageOf([[grey(10), grey(20)]]);
    assert.equal(trimTransparent(tight), tight);
  });

  it("refuses an image with nothing in it rather than shipping an empty logo", () => {
    assert.throws(() => trimTransparent(canvas(4, 4, () => null)), /fully transparent/);
  });
});

describe("scaleToFit", () => {
  it("leaves an image that already fits alone", () => {
    const small = imageOf([[grey(10), grey(20)]]);
    assert.equal(scaleToFit(small, 2), small);
    assert.equal(scaleToFit(small, 160), small);
  });

  it("averages the pixels each new pixel covers", () => {
    const scaled = scaleToFit(
      imageOf([
        [grey(0), grey(40), grey(100), grey(100)],
        [grey(80), grey(120), grey(100), grey(100)],
        [grey(10), grey(10), grey(0), grey(255)],
        [grey(10), grey(10), grey(255), grey(0)],
      ]),
      2,
    );
    assert.equal(scaled.width, 2);
    assert.equal(scaled.height, 2);
    assert.deepEqual(pixelAt(scaled, 0, 0), grey(60));
    assert.deepEqual(pixelAt(scaled, 1, 0), grey(100));
    assert.deepEqual(pixelAt(scaled, 0, 1), grey(10));
    // 127.5 rounds up.
    assert.deepEqual(pixelAt(scaled, 1, 1), grey(128));
  });

  it("fits the longer side and keeps the shape", () => {
    const wide = scaleToFit(
      canvas(8, 4, () => grey(50)),
      4,
    );
    assert.deepEqual([wide.width, wide.height], [4, 2]);
    const tall = scaleToFit(
      canvas(3, 9, () => grey(50)),
      3,
    );
    assert.deepEqual([tall.width, tall.height], [1, 3]);
  });

  it("never scales a side away to nothing", () => {
    const sliver = scaleToFit(
      canvas(100, 1, () => grey(50)),
      10,
    );
    assert.deepEqual([sliver.width, sliver.height], [10, 1]);
  });

  it("splits a source pixel between the two new pixels it straddles", () => {
    // Three pixels into two: each new pixel is one whole source pixel and half
    // of the middle one.
    const scaled = scaleToFit(imageOf([[grey(0), grey(90), grey(180)]]), 2);
    assert.deepEqual(pixelAt(scaled, 0, 0), grey(30));
    assert.deepEqual(pixelAt(scaled, 1, 0), grey(150));
  });

  it("does not let the colour under a transparent pixel tint an edge", () => {
    // EA's textures carry arbitrary colour where alpha is zero. Averaged as if
    // it were ink, the blue here would turn the red edge purple.
    const scaled = scaleToFit(
      imageOf([
        [
          [255, 0, 0, 255],
          [0, 0, 255, 0],
        ],
      ]),
      1,
    );
    assert.deepEqual(pixelAt(scaled, 0, 0), [255, 0, 0, 128]);
  });

  it("writes a pixel that rounds to invisible as plain transparency", () => {
    const scaled = scaleToFit(
      canvas(4, 1, (x) => (x === 0 ? [255, 255, 255, 1] : null)),
      1,
    );
    assert.deepEqual(pixelAt(scaled, 0, 0), CLEAR);
  });
});

describe("leagueLogoToPng", () => {
  /** A 4×2 white bar in the middle of an otherwise clear 8×8 texture. */
  const texture = bgraDds(
    canvas(8, 8, (x, y) => (x >= 2 && x <= 5 && y >= 3 && y <= 4 ? grey(255) : null)),
  );

  it("unwraps a chunkzip texture, drops its margin and scales what is left", () => {
    assert.deepEqual(pngSize(leagueLogoToPng(chunkzip(texture), { size: 2 })), [2, 1]);
  });

  it("reads the textures EA left unwrapped the same way", () => {
    assert.deepEqual(
      leagueLogoToPng(texture, { size: 2 }),
      leagueLogoToPng(chunkzip(texture), { size: 2 }),
    );
  });

  it("does not enlarge artwork smaller than the size it ships at", () => {
    assert.deepEqual(pngSize(leagueLogoToPng(texture)), [4, 2]);
  });

  it(`fits larger artwork inside ${LEAGUE_LOGO_SIZE}×${LEAGUE_LOGO_SIZE}`, () => {
    const large = bgraDds(
      canvas(256, 128, (x, y) => (x >= 16 && x < 216 && y >= 8 && y < 108 ? grey(255) : null)),
    );
    assert.deepEqual(pngSize(leagueLogoToPng(large)), [LEAGUE_LOGO_SIZE, LEAGUE_LOGO_SIZE / 2]);
  });

  it("is byte-for-byte repeatable, which is what lets CI compare the files", () => {
    assert.deepEqual(leagueLogoToPng(texture), leagueLogoToPng(texture));
  });
});

describe("eaLeagueCompetitions", () => {
  const nations = [
    { nationid: 14, isocountrycode: "GB", nationname: "England" },
    { nationid: 21, isocountrycode: "DE", nationname: "Germany" },
  ];

  it("pairs each EA league with the competition id the importer gives it", () => {
    assert.deepEqual(
      eaLeagueCompetitions(
        [
          { leagueid: 13, leaguename: "England Premier League (1)", countryid: 14 },
          { leagueid: 19, leaguename: "Germany 1. Bundesliga (1)", countryid: 21 },
          { leagueid: 1003, leaguename: "CONMEBOL Libertadores", countryid: 0 },
        ],
        nations,
      ),
      [
        { leagueId: 13, competitionId: "eng-premier-league" },
        { leagueId: 19, competitionId: "de-1-bundesliga" },
        { leagueId: 1003, competitionId: "conmebol-libertadores" },
      ],
    );
  });

  it("leaves out the women's competitions the importer does not import", () => {
    // Otherwise a women's league that derives a men's league's id would stand
    // behind a competition it was never the source of.
    assert.deepEqual(
      eaLeagueCompetitions(
        [
          { leagueid: 13, leaguename: "England Premier League (1)", countryid: 14 },
          {
            leagueid: 2216,
            leaguename: "England Premier League (1)",
            countryid: 14,
            iswomencompetition: 1,
          },
        ],
        nations,
      ),
      [{ leagueId: 13, competitionId: "eng-premier-league" }],
    );
  });

  it("leaves out a league whose nation the database does not know", () => {
    assert.deepEqual(
      eaLeagueCompetitions(
        [{ leagueid: 76, leaguename: "Rest of World", countryid: 999 }],
        nations,
      ),
      [],
    );
  });
});

describe("planLeagueLogos", () => {
  const logos = new Map([
    [13, "leagues/l13.dds"],
    [14, "leagues/l14.dds"],
    [2076, "leagues/l2076.dds"],
  ]);

  it("gives a competition the logo of the EA league it was imported from", () => {
    const { logos: planned, missing } = planLeagueLogos(
      [{ id: "eng-premier-league" }, { id: "eng-championship" }],
      [
        { leagueId: 13, competitionId: "eng-premier-league" },
        { leagueId: 14, competitionId: "eng-championship" },
      ],
      logos,
    );
    assert.deepEqual(planned, [
      { competitionId: "eng-premier-league", eaLeagueId: 13 },
      { competitionId: "eng-championship", eaLeagueId: 14 },
    ]);
    assert.deepEqual(missing, []);
  });

  it("orders by EA league id, so a rebuild writes the same crosswalk", () => {
    const { logos: planned } = planLeagueLogos(
      [{ id: "de-3-liga" }, { id: "eng-championship" }, { id: "eng-premier-league" }],
      [
        { leagueId: 2076, competitionId: "de-3-liga" },
        { leagueId: 14, competitionId: "eng-championship" },
        { leagueId: 13, competitionId: "eng-premier-league" },
      ],
      logos,
    );
    assert.deepEqual(
      planned.map((entry) => entry.eaLeagueId),
      [13, 14, 2076],
    );
  });

  it("leaves out an EA league the package did not import", () => {
    const { logos: planned } = planLeagueLogos(
      [{ id: "eng-premier-league" }],
      [
        { leagueId: 13, competitionId: "eng-premier-league" },
        { leagueId: 14, competitionId: "eng-championship" },
      ],
      logos,
    );
    assert.deepEqual(planned, [{ competitionId: "eng-premier-league", eaLeagueId: 13 }]);
  });

  it("reports a competition that no EA league row stands behind", () => {
    // The European cups are authored by the importer; the database has no row
    // for them, so their artwork cannot come from this crosswalk.
    const { logos: planned, missing } = planLeagueLogos(
      [{ id: "uefa-champions-league" }],
      [{ leagueId: 13, competitionId: "eng-premier-league" }],
      logos,
    );
    assert.deepEqual(planned, []);
    assert.deepEqual(missing, [{ competitionId: "uefa-champions-league", reason: "no EA league" }]);
  });

  it("reports a league whose logo EA does not ship", () => {
    const { logos: planned, missing } = planLeagueLogos(
      [{ id: "kr-k-league-1" }],
      [{ leagueId: 83, competitionId: "kr-k-league-1" }],
      logos,
    );
    assert.deepEqual(planned, []);
    assert.deepEqual(missing, [
      { competitionId: "kr-k-league-1", reason: "no logo for EA league 83" },
    ]);
  });

  it("uses the logo to choose between two EA rows behind one competition", () => {
    const { logos: planned } = planLeagueLogos(
      [{ id: "eng-premier-league" }],
      [
        { leagueId: 13, competitionId: "eng-premier-league" },
        { leagueId: 9013, competitionId: "eng-premier-league" },
      ],
      logos,
    );
    assert.deepEqual(planned, [{ competitionId: "eng-premier-league", eaLeagueId: 13 }]);
  });

  it("refuses two EA rows behind one competition when both have a logo", () => {
    // Picking either would be a guess, and a wrong logo is worse than none.
    const { logos: planned, missing } = planLeagueLogos(
      [{ id: "eng-premier-league" }],
      [
        { leagueId: 13, competitionId: "eng-premier-league" },
        { leagueId: 14, competitionId: "eng-premier-league" },
      ],
      logos,
    );
    assert.deepEqual(planned, []);
    assert.deepEqual(missing, [
      { competitionId: "eng-premier-league", reason: "ambiguous (13, 14)" },
    ]);
  });
});

describe("readLeagueLogoCrosswalk", () => {
  it("lists the leagues the database stands behind, then the logos named by hand", () => {
    assert.deepEqual(
      readLeagueLogoCrosswalk({
        leagues: [{ competitionId: "eng-premier-league", eaLeagueId: 13 }],
        authored: [{ competitionId: "eng-fa-cup", eaLeagueId: 201, name: "FA Cup" }],
      }),
      [
        { competitionId: "eng-premier-league", eaLeagueId: 13 },
        { competitionId: "eng-fa-cup", eaLeagueId: 201 },
      ],
    );
  });

  it("reads a crosswalk with only one of the two lists", () => {
    assert.deepEqual(
      readLeagueLogoCrosswalk({ leagues: [{ competitionId: "de-3-liga", eaLeagueId: 2076 }] }),
      [{ competitionId: "de-3-liga", eaLeagueId: 2076 }],
    );
  });

  it("refuses two logos for one competition", () => {
    assert.throws(
      () =>
        readLeagueLogoCrosswalk({
          leagues: [{ competitionId: "eng-fa-cup", eaLeagueId: 13 }],
          authored: [{ competitionId: "eng-fa-cup", eaLeagueId: 201, name: "FA Cup" }],
        }),
      /eng-fa-cup.*twice/,
    );
  });

  it("refuses one EA logo given to two competitions", () => {
    assert.throws(
      () =>
        readLeagueLogoCrosswalk({
          authored: [
            { competitionId: "eng-fa-cup", eaLeagueId: 201, name: "FA Cup" },
            { competitionId: "eng-efl-cup", eaLeagueId: 201, name: "EFL Cup" },
          ],
        }),
      /EA league 201.*twice/,
    );
  });

  it("refuses a competition id that could not be a file name", () => {
    for (const competitionId of ["", "../escape", "FA Cup", "eng/fa-cup"]) {
      assert.throws(
        () => readLeagueLogoCrosswalk({ authored: [{ competitionId, eaLeagueId: 201 }] }),
        /competitionId/,
      );
    }
  });

  it("refuses an EA league id that is not a whole positive number", () => {
    for (const eaLeagueId of [0, -1, 1.5, "201", null]) {
      assert.throws(
        () => readLeagueLogoCrosswalk({ leagues: [{ competitionId: "eng-fa-cup", eaLeagueId }] }),
        /eaLeagueId/,
      );
    }
  });
});

describe("buildLeagueLogos", () => {
  const texture = bgraDds(canvas(4, 4, (x, y) => (x >= 1 && x <= 2 && y === 1 ? grey(255) : null)));
  const zipEntries = [
    { name: "leagues/", data: Buffer.alloc(0) },
    { name: "leagues/l13.dds", data: chunkzip(texture) },
    { name: "leagues/l201.dds", data: texture },
  ];

  it("names each image after its competition and records where it came from", () => {
    const [logo] = buildLeagueLogos(
      [{ competitionId: "eng-premier-league", eaLeagueId: 13 }],
      zipEntries,
    );
    assert.equal(logo.competitionId, "eng-premier-league");
    assert.equal(logo.eaLeagueId, 13);
    assert.equal(logo.file, "eng-premier-league.png");
    assert.deepEqual(pngSize(logo.bytes), [2, 1]);
    assert.match(logo.checksum, /^sha256:[0-9a-f]{64}$/);
    assert.equal(logo.licence, "PersonalUseOnly");
    assert.match(logo.source, /^https:\/\/www\.ea\.com\//);
    assert.match(logo.attribution, /EA Sports FC/);
  });

  it("keeps the crosswalk's order, which is the order the manifest lists them in", () => {
    const built = buildLeagueLogos(
      [
        { competitionId: "eng-fa-cup", eaLeagueId: 201 },
        { competitionId: "eng-premier-league", eaLeagueId: 13 },
      ],
      zipEntries,
    );
    assert.deepEqual(
      built.map((logo) => logo.file),
      ["eng-fa-cup.png", "eng-premier-league.png"],
    );
  });

  it("refuses an entry whose texture the pack does not hold", () => {
    assert.throws(
      () => buildLeagueLogos([{ competitionId: "de-dfb-pokal", eaLeagueId: 206 }], zipEntries),
      /no league logo for EA league 206 \(competition de-dfb-pokal\)/,
    );
  });

  it("says which logo a damaged texture belongs to", () => {
    assert.throws(
      () =>
        buildLeagueLogos(
          [{ competitionId: "eng-premier-league", eaLeagueId: 13 }],
          [{ name: "leagues/l13.dds", data: Buffer.from("not a texture at all, just some text") }],
        ),
      /leagues\/l13\.dds \(competition eng-premier-league\)/,
    );
  });
});
