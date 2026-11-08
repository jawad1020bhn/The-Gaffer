/**
 * An optional club-badge graphics pack: a folder of images named by EA team
 * id, plus a `manifest.json` that records, for every asset, its source,
 * licence, attribution and sha256 checksum.
 *
 * The pack is separate from the game's code and is never fetched live: a run
 * of `import.mjs --badges <pack>` points at a checked-out copy, verifies
 * every checksum, and packs only verified images into the `.ofm`. The
 * manifest travels inside the archive, so an installed package still
 * documents where each badge came from.
 *
 * Crosswalk recorded per asset — EA team id ↔ OFM club id ↔ image file.
 * Matching is always by EA id, never by club name, so a badge survives
 * club-name changes and re-imports from a different database vintage.
 */

import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

/** Where a verified badge lives inside the package root. */
export const PACKAGE_ASSET_DIR = "assets/clubs";

const MANIFEST_NAME = "manifest.json";
const CHECKSUM = /^sha256:[0-9a-f]{64}$/;

/** File magic a pack's badge images must carry, so a non-image can never be
 * served as a club badge. PNG, JPEG, GIF, WEBP, or inline SVG. */
const isLikelyImage = (data) => {
  const head = data.subarray(0, 16);
  for (const magic of [
    [0x89, 0x50, 0x4e, 0x47], // PNG
    [0xff, 0xd8, 0xff], // JPEG
    [0x47, 0x49, 0x46, 0x38], // GIF8
  ]) {
    if (magic.every((byte, index) => head[index] === byte)) return true;
  }
  if (
    head.length >= 12 &&
    head[0] === 0x52 &&
    head[1] === 0x49 &&
    head[2] === 0x46 &&
    head[3] === 0x46 &&
    head.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    return true;
  }
  return (
    /^\s*</.test(data.subarray(0, 64).toString("utf8")) &&
    /<svg\b/i.test(data.subarray(0, 1024).toString("utf8"))
  );
};

/** Signals a problem with a badge pack's manifest or files. */
export class BadgePackError extends Error {
  constructor(message) {
    super(message);
    this.name = "BadgePackError";
  }
}

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isEaTeamId = (value) => Number.isInteger(value) && value > 0;
const isClubId = (value) => typeof value === "string" && value.trim().length > 0;
/** A plain file name that cannot escape the pack folder. */
const isPackFileName = (value) =>
  typeof value === "string" &&
  value.length > 0 &&
  !value.includes("/") &&
  !value.includes("\\") &&
  value !== "." &&
  value !== ".." &&
  !value.startsWith(".") &&
  !value.endsWith(".") &&
  !value.endsWith(" ");
const isSourceUrl = (value) => typeof value === "string" && value.startsWith("https://");
const isChecksum = (value) => typeof value === "string" && CHECKSUM.test(value);

const entryLocation = (index) => `badge manifest entry ${index}`;

function readBadgeEntry(entry, index) {
  const where = entryLocation(index);
  const fail = (field) => {
    throw new BadgePackError(`${where}: ${field} is missing or invalid`);
  };
  if (!isPlainObject(entry)) fail("entry");
  const eaTeamId = entry.eaTeamId;
  if (!isEaTeamId(eaTeamId)) fail("eaTeamId");
  const ofmClubId = entry.ofmClubId;
  if (!isClubId(ofmClubId)) fail("ofmClubId");
  const file = entry.file;
  if (!isPackFileName(file)) fail("file");
  const source = entry.source;
  if (!isSourceUrl(source)) fail("source");
  const licence = entry.licence;
  if (!isClubId(licence)) fail("licence");
  const attribution = entry.attribution;
  if (!isClubId(attribution)) fail("attribution");
  const checksum = entry.checksum;
  if (!isChecksum(checksum)) fail("checksum");
  return {
    eaTeamId,
    ofmClubId: ofmClubId.trim(),
    file,
    source,
    licence: licence.trim(),
    attribution: attribution.trim(),
    checksum,
  };
}

/** Read and strictly validate a badge pack's manifest. No file checks yet. */
export async function readBadgeManifest(packDir) {
  const manifestPath = path.join(packDir, MANIFEST_NAME);
  let raw;
  try {
    raw = await readFile(manifestPath, "utf8");
  } catch (error) {
    throw new BadgePackError(`no badge manifest at ${manifestPath}: ${error.message}`);
  }
  let value;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    throw new BadgePackError(`badge manifest is not JSON: ${error.message}`);
  }
  if (!isPlainObject(value) || !Array.isArray(value.badges)) {
    throw new BadgePackError("badge manifest must be an object with a `badges` array");
  }
  const badges = [];
  for (const [index, entry] of value.badges.entries()) {
    badges.push(readBadgeEntry(entry, index));
  }
  return {
    version: value.version ?? null,
    source: value.source ?? "",
    licence: value.licence ?? "",
    badges,
  };
}

/**
 * Verify every listed badge file exists and its sha256 matches the manifest,
 * then return the entries with their absolute pack path attached. Throws on
 * the first missing file or checksum mismatch — a corrupted pack never
 * silently produces wrong artwork.
 */
export async function verifyBadgePack(packDir) {
  const { badges } = await readBadgeManifest(packDir);
  const verified = [];
  for (const entry of badges) {
    const filePath = path.join(packDir, entry.file);
    let stats;
    try {
      stats = await stat(filePath);
    } catch (_error) {
      throw new BadgePackError(`badge file missing: ${entry.file}`);
    }
    if (!stats.isFile()) {
      throw new BadgePackError(`badge entry is not a file: ${entry.file}`);
    }
    const data = await readFile(filePath);
    const digest = `sha256:${createHash("sha256").update(data).digest("hex")}`;
    if (digest !== entry.checksum) {
      throw new BadgePackError(
        `checksum mismatch for ${entry.file}: manifest ${entry.checksum}, file ${digest}`,
      );
    }
    if (!isLikelyImage(data)) {
      throw new BadgePackError(`badge file is not a recognised image: ${entry.file}`);
    }
    verified.push({ ...entry, path: filePath, bytes: data.length });
  }
  return verified;
}

/** Relative package-internal path of one verified badge's image file. */
export function badgeAssetPath(entry) {
  const extension = path.extname(entry.file) || ".png";
  return `${PACKAGE_ASSET_DIR}/${entry.eaTeamId}${extension}`;
}

/** The manifest that travels inside the packed `.ofm` next to the images. */
export function packageManifest(pack, verified) {
  return {
    version: pack.version,
    source: pack.source,
    licence: pack.licence,
    badges: verified.map((entry) => ({
      eaTeamId: entry.eaTeamId,
      ofmClubId: entry.ofmClubId,
      asset: badgeAssetPath(entry),
      source: entry.source,
      licence: entry.licence,
      attribution: entry.attribution,
      checksum: entry.checksum,
    })),
  };
}
