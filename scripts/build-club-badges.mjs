#!/usr/bin/env node
/**
 * Rebuild the bundled world's club badges from `crest50x50.zip`, and its
 * competition logos from `leagues.zip`.
 *
 * The world `mods/eafc-fc27` ships real crests: each club in `teams.json`
 * names `assets/clubs/<eaTeamId>.png`, and those PNGs live beside it. Both the
 * paths and the images are committed, so a plain checkout has badges without a
 * 16 MB EA database, an internet connection, or any extra step — and the
 * nightly/CI package job compares the checked-in `teams.json` byte for byte
 * against a fresh import, so the paths have to be part of the package itself
 * rather than something a build script stamps on afterwards.
 *
 * Competition logos work the same way: a competition in `competitions.json`
 * names `assets/competitions/<competitionId>.png`.
 *
 * This script is the reproducible way to produce those PNGs. It needs only the
 * checked-in zips and the recorded crosswalks:
 *
 *   node scripts/build-club-badges.mjs            # write the PNGs and manifest
 *   node scripts/build-club-badges.mjs --check    # verify they are current
 *
 * `--check` is what CI runs: it re-derives every file and fails if any image,
 * path or checksum has drifted, so a stale badge cannot ship silently.
 *
 * The crosswalks (`tools/eafc-import/data/fc27-crest-crosswalk.json` and
 * `fc27-league-logo-crosswalk.json`) are regenerated from the EA database by
 * `tools/eafc-import/badges-from-crest-pack.mjs --write-crosswalk
 * --write-league-crosswalk` when the world is re-imported; this script never
 * guesses an EA id.
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { listCrests } from "../tools/eafc-import/lib/crestPack.mjs";
import { CREST_SIZE, crestDdsToPng } from "../tools/eafc-import/lib/dds.mjs";
import {
  buildLeagueLogos,
  readLeagueLogoCrosswalk,
} from "../tools/eafc-import/lib/leagueLogos.mjs";
import { readZipEntries } from "../tools/eafc-import/lib/zip.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORLD_DIR = "mods/eafc-fc27";
const CREST_ZIP = "crest50x50.zip";
const CROSSWALK = "tools/eafc-import/data/fc27-crest-crosswalk.json";
const LEAGUE_LOGO_ZIP = "leagues.zip";
const LEAGUE_LOGO_CROSSWALK = "tools/eafc-import/data/fc27-league-logo-crosswalk.json";

/** The folders this build owns inside the world. */
const CLUB_ASSETS = "assets/clubs";
const COMPETITION_ASSETS = "assets/competitions";

const sha256 = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

/** Where the artwork itself comes from. The crosswalk only supplies the ids. */
const ARTWORK_SOURCE = "https://www.ea.com/games/ea-sports-fc";

/** EA's crest art is theirs; this is a local conversion, not a redistribution. */
const LICENCE = "PersonalUseOnly";

/**
 * The world's competition logos, converted from EA's league-logo pack.
 *
 * Every entry of the recorded crosswalk becomes one image, in the crosswalk's
 * order: the leagues the database stands behind, then the logos named by hand.
 * That includes logos for competitions the world does not have yet — the
 * importer packs every logo in its pack, and this has to write the same files.
 *
 * `derived` marks the first kind. Such a pair exists only because its
 * competition was imported, which is what lets a stale one be told apart from a
 * logo that is simply ahead of its competition.
 */
async function planCompetitionLogos(repoRoot) {
  const crosswalk = JSON.parse(await readFile(path.join(repoRoot, LEAGUE_LOGO_CROSSWALK), "utf8"));
  const zip = readZipEntries(await readFile(path.join(repoRoot, LEAGUE_LOGO_ZIP)));
  const derived = new Set((crosswalk.leagues ?? []).map((entry) => entry.competitionId));
  return buildLeagueLogos(readLeagueLogoCrosswalk(crosswalk), zip).map((logo) => ({
    competitionId: logo.competitionId,
    asset: `${COMPETITION_ASSETS}/${logo.file}`,
    bytes: logo.bytes,
    derived: derived.has(logo.competitionId),
    source: logo.source,
    licence: logo.licence,
    attribution: logo.attribution,
    checksum: logo.checksum,
  }));
}

/**
 * The image files the world should contain, as `{ name, data }`.
 *
 * Pure apart from reading its inputs, so the check and the write path cannot
 * disagree about what "current" means.
 */
export async function planBadges(repoRoot = REPO_ROOT) {
  const crosswalk = JSON.parse(await readFile(path.join(repoRoot, CROSSWALK), "utf8"));
  const world = JSON.parse(await readFile(path.join(repoRoot, WORLD_DIR, "teams.json"), "utf8"));
  const zip = readZipEntries(await readFile(path.join(repoRoot, CREST_ZIP)));
  const crests = listCrests(zip.map((entry) => entry.name));
  const entries = new Map(zip.map((entry) => [entry.name, entry.data]));

  const clubIds = new Set((world.items ?? []).map((club) => club.id));
  const competitionLogos = await planCompetitionLogos(repoRoot);

  const files = new Map();
  const badges = [];
  const unknownClubs = [];
  for (const { clubId, eaTeamId } of crosswalk.badges) {
    // The world is the source of truth for which clubs exist; a crosswalk entry
    // for a club that has since gone is reported, never quietly ignored.
    if (!clubIds.has(clubId)) {
      unknownClubs.push({ clubId, eaTeamId });
      continue;
    }
    const crest = crests.get(eaTeamId);
    if (!crest) {
      throw new Error(`no 50×50 crest for EA team ${eaTeamId} (club ${clubId})`);
    }
    const data = crestDdsToPng(entries.get(crest), { size: CREST_SIZE, darkBackground: true });
    const name = `${CLUB_ASSETS}/${eaTeamId}.png`;
    files.set(name, data);
    badges.push({
      eaTeamId,
      ofmClubId: clubId,
      asset: name,
      source: ARTWORK_SOURCE,
      crosswalkSource: `${crosswalk.source}@${crosswalk.revision ?? "unrecorded"}`,
      licence: "PersonalUseOnly",
      attribution: "EA Sports FC club crests",
      checksum: sha256(data),
    });
  }

  // Exactly the manifest `import.mjs` writes for a badge pack. CI rebuilds the
  // package through the importer and compares its `assets/` tree with the
  // committed one, so this has to be the same bytes rather than merely the same
  // facts. `crosswalkSource` records which database produced the ids.
  const manifest = `${JSON.stringify(
    {
      version: 1,
      source: ARTWORK_SOURCE,
      licence: LICENCE,
      badges: badges.map(({ crosswalkSource: _crosswalkSource, ...entry }) => entry),
      // The importer's own manifest shape: `bytes` is the file the build writes
      // and `derived` is this script's bookkeeping, neither part of the
      // provenance the archive documents.
      competitionLogos: competitionLogos.map(
        ({ bytes: _bytes, derived: _derived, ...entry }) => entry,
      ),
      playerFaces: [],
    },
    null,
    2,
  )}\n`;
  for (const logo of competitionLogos) {
    files.set(logo.asset, logo.bytes);
  }
  files.set(`${CLUB_ASSETS}/manifest.json`, Buffer.from(manifest));
  return { files, badges, competitionLogos, unknownClubs };
}

/**
 * Every club the build produces an image for must name that image in
 * `teams.json`, and vice versa.
 *
 * The loader reads `logo` from the package itself, so a disagreement is not a
 * warning: it is either a badge that never appears (the path names a file the
 * archive does not carry) or an image shipped for nothing. Both directions are
 * checked because the second is how a stale badge survives a rename.
 */
export function disagreements(badges, clubs) {
  const logoPath = new Map(clubs.map((club) => [club.id, club.logo ?? null]));
  const problems = [];
  for (const { ofmClubId, asset } of badges) {
    if (logoPath.get(ofmClubId) !== asset) {
      problems.push(
        `${ofmClubId}: teams.json has ${logoPath.get(ofmClubId) ?? "no logo"}, the crosswalk builds ${asset}`,
      );
    }
  }
  const built = new Set(badges.map(({ ofmClubId }) => ofmClubId));
  for (const [clubId, logo] of logoPath) {
    if (logo && !built.has(clubId)) {
      problems.push(`${clubId}: teams.json names ${logo}, the crosswalk builds nothing`);
    }
  }
  return problems;
}

/**
 * The same agreement for competitions: one that has a logo built for it must
 * name that image in `competitions.json`, and one that has none must name none.
 *
 * A logo with no competition is allowed when it was named by hand: EA ships
 * artwork for cups this world does not carry yet, and it is packed ahead of
 * them. A logo the crosswalk derived from the database is different — that pair
 * was written because the competition was imported, so its absence means the
 * crosswalk is older than the world.
 */
export function competitionDisagreements(logos, competitions) {
  const built = new Map(logos.map((logo) => [logo.competitionId, logo.asset]));
  const problems = [];
  for (const competition of competitions) {
    const asset = built.get(competition.id) ?? null;
    const named = competition.logo ?? null;
    if (named === asset) continue;
    problems.push(
      asset
        ? `${competition.id}: competitions.json has ${named ?? "no logo"}, the crosswalk builds ${asset}`
        : `${competition.id}: competitions.json names ${named}, the crosswalk builds nothing`,
    );
  }
  const present = new Set(competitions.map((competition) => competition.id));
  for (const logo of logos) {
    if (logo.derived && !present.has(logo.competitionId)) {
      problems.push(
        `${logo.competitionId}: the crosswalk derives a logo for it, but competitions.json has no such competition`,
      );
    }
  }
  return problems;
}

/**
 * Artwork in the world's folders that the build does not produce: an image left
 * behind by a club that lost its badge, or a logo in a format no longer written.
 *
 * The competition folder holds nothing but what this build writes, so any other
 * file there is a leftover. The club folder is only checked for images.
 *
 * @param {string} worldDir the world's directory
 * @param {Map<string, Buffer>} files the planned files, by package-relative path
 * @returns {Promise<string[]>} package-relative paths, sorted
 */
export async function leftoverFiles(worldDir, files) {
  const leftovers = [];
  for (const [folder, owned] of [
    [CLUB_ASSETS, (name) => name.endsWith(".png")],
    [COMPETITION_ASSETS, () => true],
  ]) {
    const dir = path.join(worldDir, folder);
    const present = existsSync(dir) ? await readdir(dir) : [];
    for (const name of present.sort()) {
      if (owned(name) && !files.has(`${folder}/${name}`)) leftovers.push(`${folder}/${name}`);
    }
  }
  return leftovers;
}

async function main() {
  const check = process.argv.includes("--check");
  const { files, badges, competitionLogos, unknownClubs } = await planBadges();

  const world = JSON.parse(await readFile(path.join(REPO_ROOT, WORLD_DIR, "teams.json"), "utf8"));
  const problems = disagreements(badges, world.items ?? []);
  if (problems.length > 0) {
    throw new Error(
      `${problems.length} club(s) disagree with the crosswalk:\n  ${problems.slice(0, 5).join("\n  ")}\n` +
        "Re-run tools/eafc-import/import.mjs --badges with a pack built from this crosswalk.",
    );
  }
  const competitions = JSON.parse(
    await readFile(path.join(REPO_ROOT, WORLD_DIR, "competitions.json"), "utf8"),
  );
  const logoProblems = competitionDisagreements(competitionLogos, competitions.items ?? []);
  if (logoProblems.length > 0) {
    throw new Error(
      `${logoProblems.length} competition(s) disagree with the league-logo crosswalk:\n  ${logoProblems.slice(0, 5).join("\n  ")}\n` +
        "Re-run tools/eafc-import/import.mjs --badges with a pack built from this crosswalk.",
    );
  }

  let stale = 0;
  for (const [name, data] of files) {
    const target = path.join(REPO_ROOT, WORLD_DIR, name);
    if (check) {
      const existing = existsSync(target) ? await readFile(target) : null;
      if (!existing?.equals(data)) {
        console.error(`build-club-badges: ${WORLD_DIR}/${name} is stale or missing`);
        stale += 1;
      }
      continue;
    }
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
  }

  if (check) {
    // The other direction: an image left behind by a club that lost its badge.
    // Rewriting cannot fix these, so they are named apart from the stale files.
    const leftovers = await leftoverFiles(path.join(REPO_ROOT, WORLD_DIR), files);
    for (const name of leftovers) {
      console.error(`build-club-badges: ${WORLD_DIR}/${name} is not in the crosswalk`);
    }
    if (stale > 0) {
      console.error(
        `build-club-badges: ${stale} file(s) out of date. Run: node scripts/build-club-badges.mjs`,
      );
    }
    if (leftovers.length > 0) {
      console.error(
        `build-club-badges: ${leftovers.length} file(s) no crosswalk produces. Delete them.`,
      );
    }
    if (stale > 0 || leftovers.length > 0) process.exit(1);
    console.log(
      `build-club-badges: ${badges.length} club badges and ${competitionLogos.length} competition logos are current.`,
    );
    return;
  }

  for (const { clubId } of unknownClubs) {
    console.warn(`build-club-badges: crosswalk names ${clubId}, which is not in the world`);
  }
  console.log(
    `build-club-badges: wrote ${badges.length} club badges (${CREST_SIZE}×${CREST_SIZE}) and ${competitionLogos.length} competition logos.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
