/**
 * EA's league-logo pack, and the competitions its logos belong to.
 *
 * `leagues/l<id>.dds` names a logo by EA league id and nothing else. Most are
 * 1024×1024 textures with the artwork centred in a wide transparent margin, and
 * most are wrapped in a `chunkzip` container (see `chunkzip.mjs`). A package's
 * competitions are keyed by the id the importer derives from the EA league row,
 * so — as with club crests — a logo is matched to a competition through the
 * database, never by reading the picture.
 *
 * That only covers competitions the database has a row for. EA ships logos for
 * cups, super cups and continental competitions its `leagues` table does not
 * list at all; those can only be named by looking at them, so the crosswalk
 * keeps them in a second list that says so (`authored`), apart from the pairs a
 * rebuild can check (`leagues`).
 *
 * Unlike a crest, a logo is not adapted for dark surfaces: EA already draws
 * these for a dark interface, and most are white.
 */

import { createHash } from "node:crypto";

import { isChunkzip, unwrapChunkzip } from "./chunkzip.mjs";
import { decodeDds, encodePng } from "./dds.mjs";
import { leagueCompetitionId } from "./mapping.mjs";

const LOGO_PREFIX = "leagues/";

/**
 * The longer side of a shipped logo, in pixels.
 *
 * The largest place the game draws one is a 56-pixel tile, so this covers it on
 * a double-density screen with room for a larger interface scale. EA's artwork
 * is about 670 pixels across; shipping it whole would quadruple the package for
 * detail no screen shows.
 */
export const LEAGUE_LOGO_SIZE = 160;

/**
 * The logos' provenance. EA's artwork is EA's, and this is not a redistribution
 * licence: the same statement the club crests carry.
 */
const SOURCE = "https://www.ea.com/games/ea-sports-fc";
const LICENCE = "PersonalUseOnly";
const ATTRIBUTION = "EA Sports FC league logos";

/** A competition id that is also a safe file name: `eng-premier-league`. */
const COMPETITION_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const sha256 = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

/**
 * Every league logo in the pack, keyed by EA league id.
 *
 * @param {Iterable<string>} names archive entry names
 * @returns {Map<number, string>} EA league id → entry name
 */
export function listLeagueLogos(names) {
  const logos = new Map();
  for (const name of names) {
    if (!name.startsWith(LOGO_PREFIX)) continue;
    const match = /^l(\d+)\.dds$/.exec(name.slice(LOGO_PREFIX.length));
    if (!match) continue;
    logos.set(Number(match[1]), name);
  }
  return logos;
}

/**
 * Crop an image to the box around its visible pixels.
 *
 * Any alpha above zero counts as visible: the faintest pixels are the
 * antialiased edge of the shape beside them, and cutting them leaves a logo
 * with a hard side.
 *
 * @param {{ width: number, height: number, pixels: Uint8Array }} image
 */
export function trimTransparent(image) {
  const { width, height, pixels } = image;
  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (pixels[(y * width + x) * 4 + 3] === 0) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      bottom = y;
    }
  }
  if (right < 0) throw new Error("image is fully transparent");

  const boxWidth = right - left + 1;
  const boxHeight = bottom - top + 1;
  if (boxWidth === width && boxHeight === height) return image;

  const cropped = new Uint8Array(boxWidth * boxHeight * 4);
  for (let y = 0; y < boxHeight; y += 1) {
    const from = ((top + y) * width + left) * 4;
    cropped.set(pixels.subarray(from, from + boxWidth * 4), y * boxWidth * 4);
  }
  return { width: boxWidth, height: boxHeight, pixels: cropped };
}

/**
 * Along one axis, the source pixels under each new pixel and how much of each.
 *
 * Lengths are measured in `1 / scaled` of a source pixel, which makes every
 * overlap a whole number: a new pixel spans `source` units and a source pixel
 * `scaled` of them. Whole numbers are what keep the result identical on every
 * machine — the files are compared byte for byte.
 */
function overlaps(source, scaled) {
  const cells = [];
  for (let index = 0; index < scaled; index += 1) {
    const start = index * source;
    const end = start + source;
    const first = Math.floor(start / scaled);
    const weights = [];
    for (let cell = first; cell * scaled < end; cell += 1) {
      weights.push(Math.min(end, (cell + 1) * scaled) - Math.max(start, cell * scaled));
    }
    cells.push({ first, weights });
  }
  return cells;
}

/**
 * Shrink an image until its longer side is `maxSide`, keeping its shape.
 *
 * Each new pixel is the average of the source area it covers, weighted by
 * alpha. The weighting matters: EA's textures hold arbitrary colour where alpha
 * is zero, and averaging that in as if it were ink puts a dark or coloured
 * fringe on every edge.
 *
 * An image that already fits is returned as it is. Nothing is ever enlarged —
 * a few of EA's logos are small, and scaling them up only blurs them.
 *
 * @param {{ width: number, height: number, pixels: Uint8Array }} image
 * @param {number} maxSide
 */
export function scaleToFit(image, maxSide) {
  const { width, height, pixels } = image;
  const longer = Math.max(width, height);
  if (longer <= maxSide) return image;

  const scaledSide = (side) =>
    side === longer ? maxSide : Math.max(1, Math.round((side * maxSide) / longer));
  const scaledWidth = scaledSide(width);
  const scaledHeight = scaledSide(height);
  const columns = overlaps(width, scaledWidth);
  const rows = overlaps(height, scaledHeight);
  /** The weights under one new pixel always add up to this. */
  const area = width * height;

  const scaled = new Uint8Array(scaledWidth * scaledHeight * 4);
  for (let y = 0; y < scaledHeight; y += 1) {
    const row = rows[y];
    for (let x = 0; x < scaledWidth; x += 1) {
      const column = columns[x];
      let red = 0;
      let green = 0;
      let blue = 0;
      let alpha = 0;
      for (let j = 0; j < row.weights.length; j += 1) {
        const line = (row.first + j) * width;
        for (let i = 0; i < column.weights.length; i += 1) {
          const offset = (line + column.first + i) * 4;
          const weight = row.weights[j] * column.weights[i] * pixels[offset + 3];
          red += pixels[offset] * weight;
          green += pixels[offset + 1] * weight;
          blue += pixels[offset + 2] * weight;
          alpha += weight;
        }
      }
      const scaledAlpha = Math.round(alpha / area);
      // A pixel too faint to survive rounding is left as plain transparency
      // rather than colour nobody can see.
      if (scaledAlpha === 0) continue;
      const offset = (y * scaledWidth + x) * 4;
      scaled[offset] = Math.round(red / alpha);
      scaled[offset + 1] = Math.round(green / alpha);
      scaled[offset + 2] = Math.round(blue / alpha);
      scaled[offset + 3] = scaledAlpha;
    }
  }
  return { width: scaledWidth, height: scaledHeight, pixels: scaled };
}

/**
 * One `leagues/l<id>.dds` entry to the PNG the package ships: unwrapped if EA
 * wrapped it, decoded, cropped to its artwork and scaled to fit.
 *
 * Both `scripts/build-club-badges.mjs` and `badges-from-crest-pack.mjs` come
 * through here, so CI's byte-for-byte asset comparison holds.
 *
 * @param {Buffer} data
 * @param {{ size?: number }} [options]
 * @returns {Buffer}
 */
export function leagueLogoToPng(data, { size = LEAGUE_LOGO_SIZE } = {}) {
  const texture = isChunkzip(data) ? unwrapChunkzip(data) : data;
  return encodePng(scaleToFit(trimTransparent(decodeDds(texture)), size));
}

/**
 * The competition each EA `leagues` row becomes, by the importer's own rule.
 *
 * Women's competitions are left out because the importer leaves them out: a row
 * that was never imported cannot be the source of a competition, whatever id
 * its name happens to derive.
 *
 * @param {{ leagueid: number, leaguename?: string, countryid?: number, iswomencompetition?: number }[]} leagues EA `leagues` rows
 * @param {{ nationid: number, isocountrycode?: string, nationname?: string }[]} nations EA `nations` rows
 * @returns {{ leagueId: number, competitionId: string }[]}
 */
export function eaLeagueCompetitions(leagues, nations) {
  const nationById = new Map(nations.map((nation) => [nation.nationid, nation]));
  const pairs = [];
  for (const league of leagues) {
    if (league.iswomencompetition === 1) continue;
    const competitionId = leagueCompetitionId(
      String(league.leaguename ?? "").trim(),
      nationById.get(league.countryid),
    );
    if (competitionId) pairs.push({ leagueId: league.leagueid, competitionId });
  }
  return pairs;
}

/**
 * Which logo belongs to which competition, and why the rest have none.
 *
 * A competition's id is derived from one EA `leagues` row (`leagueCompetitionId`
 * in `mapping.mjs`), so the row that derives the same id is the league the
 * competition was imported from, and its logo is the competition's. Should two
 * rows derive one id, the logo breaks the tie; when both have one the pair is
 * left out rather than guessed.
 *
 * @param {{ id: string }[]} competitions the package's competitions
 * @param {{ leagueId: number, competitionId: string }[]} eaLeagues from {@link eaLeagueCompetitions}
 * @param {Map<number, string>} logos EA league id → logo entry
 * @returns {{ logos: { competitionId: string, eaLeagueId: number }[], missing: { competitionId: string, reason: string }[] }}
 */
export function planLeagueLogos(competitions, eaLeagues, logos) {
  const byCompetition = new Map();
  for (const league of eaLeagues) {
    byCompetition.set(league.competitionId, [
      ...(byCompetition.get(league.competitionId) ?? []),
      league,
    ]);
  }

  const planned = [];
  const missing = [];
  for (const competition of competitions) {
    const candidates = byCompetition.get(competition.id) ?? [];
    if (candidates.length === 0) {
      missing.push({ competitionId: competition.id, reason: "no EA league" });
      continue;
    }
    const ids = (leagues) => leagues.map((league) => league.leagueId).join(", ");
    const withLogo = candidates.filter((league) => logos.has(league.leagueId));
    if (withLogo.length === 0) {
      missing.push({
        competitionId: competition.id,
        reason: `no logo for EA league ${ids(candidates)}`,
      });
      continue;
    }
    if (withLogo.length > 1) {
      missing.push({ competitionId: competition.id, reason: `ambiguous (${ids(withLogo)})` });
      continue;
    }
    planned.push({ competitionId: competition.id, eaLeagueId: withLogo[0].leagueId });
  }
  // By EA id rather than by name: a number sorts the same under every locale.
  planned.sort((a, b) => a.eaLeagueId - b.eaLeagueId);
  return { logos: planned, missing };
}

/**
 * The pairs a crosswalk file records, checked: `leagues` first, then `authored`.
 *
 * The file is written by hand in part, and a slip in it is quiet — two entries
 * for one competition overwrite each other's image, and one logo listed twice
 * badges a competition with another's artwork. So both are errors here, and a
 * competition id has to be the plain slug the image is named after.
 *
 * @param {{ leagues?: unknown[], authored?: unknown[] }} crosswalk
 * @returns {{ competitionId: string, eaLeagueId: number }[]}
 */
export function readLeagueLogoCrosswalk(crosswalk) {
  const entries = [];
  const competitions = new Set();
  const leagues = new Set();
  for (const list of ["leagues", "authored"]) {
    for (const [index, entry] of (crosswalk[list] ?? []).entries()) {
      const where = `league logo crosswalk ${list}[${index}]`;
      const { competitionId, eaLeagueId } = entry ?? {};
      if (typeof competitionId !== "string" || !COMPETITION_ID.test(competitionId)) {
        throw new Error(`${where}: competitionId is missing or is not a lowercase slug`);
      }
      if (!Number.isInteger(eaLeagueId) || eaLeagueId <= 0) {
        throw new Error(`${where}: eaLeagueId is missing or is not a positive whole number`);
      }
      if (competitions.has(competitionId)) {
        throw new Error(`${where}: competition ${competitionId} is listed twice`);
      }
      if (leagues.has(eaLeagueId)) {
        throw new Error(`${where}: EA league ${eaLeagueId} is listed twice`);
      }
      competitions.add(competitionId);
      leagues.add(eaLeagueId);
      entries.push({ competitionId, eaLeagueId });
    }
  }
  return entries;
}

/**
 * Convert the logo behind every crosswalk entry, in the crosswalk's order.
 *
 * Each result is a graphics-pack entry: the image named after its competition,
 * with the provenance and checksum the importer verifies.
 *
 * @param {{ competitionId: string, eaLeagueId: number }[]} entries
 * @param {{ name: string, data: Buffer }[]} zipEntries the league-logo archive
 * @param {{ size?: number }} [options]
 */
export function buildLeagueLogos(entries, zipEntries, { size = LEAGUE_LOGO_SIZE } = {}) {
  const textures = new Map(zipEntries.map((entry) => [entry.name, entry.data]));
  const available = listLeagueLogos(textures.keys());
  return entries.map(({ competitionId, eaLeagueId }) => {
    const name = available.get(eaLeagueId);
    if (!name) {
      throw new Error(`no league logo for EA league ${eaLeagueId} (competition ${competitionId})`);
    }
    let bytes;
    try {
      bytes = leagueLogoToPng(textures.get(name), { size });
    } catch (error) {
      throw new Error(`${name} (competition ${competitionId}): ${error.message}`);
    }
    return {
      competitionId,
      eaLeagueId,
      file: `${competitionId}.png`,
      bytes,
      source: SOURCE,
      licence: LICENCE,
      attribution: ATTRIBUTION,
      checksum: sha256(bytes),
    };
  });
}
