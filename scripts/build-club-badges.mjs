#!/usr/bin/env node
/**
 * Rebuild the bundled world's club badges from `crest50x50.zip`.
 *
 * The world `mods/eafc-fc27` ships real crests: each club in `teams.json`
 * names `assets/clubs/<eaTeamId>.png`, and those PNGs live beside it. Both the
 * paths and the images are committed, so a plain checkout has badges without a
 * 16 MB EA database, an internet connection, or any extra step — and the
 * nightly/CI package job compares the checked-in `teams.json` byte for byte
 * against a fresh import, so the paths have to be part of the package itself
 * rather than something a build script stamps on afterwards.
 *
 * This script is the reproducible way to produce those PNGs. It needs only the
 * checked-in crest zip and the recorded crosswalk:
 *
 *   node scripts/build-club-badges.mjs            # write the PNGs and manifest
 *   node scripts/build-club-badges.mjs --check    # verify they are current
 *
 * `--check` is what CI runs: it re-derives every file and fails if any image,
 * path or checksum has drifted, so a stale badge cannot ship silently.
 *
 * The crosswalk (`tools/eafc-import/data/fc27-crest-crosswalk.json`) is
 * regenerated from the EA database by
 * `tools/eafc-import/badges-from-crest-pack.mjs --write-crosswalk` when the
 * world is re-imported; this script never guesses a club's EA id.
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { listCrests } from "../tools/eafc-import/lib/crestPack.mjs";
import { CREST_SIZE, crestDdsToPng } from "../tools/eafc-import/lib/dds.mjs";
import { readZipEntries } from "../tools/eafc-import/lib/zip.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORLD_DIR = "mods/eafc-fc27";
const CREST_ZIP = "crest50x50.zip";
const CROSSWALK = "tools/eafc-import/data/fc27-crest-crosswalk.json";

/** The checked-in pack of competition logos the authored European cups reference. */
const COMPETITION_LOGO_PACK = "tools/eafc-import/test/fixtures/competition-logos";

const sha256 = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

/** Where the artwork itself comes from. The crosswalk only supplies the ids. */
const ARTWORK_SOURCE = "https://www.ea.com/games/ea-sports-fc";

/** EA's crest art is theirs; this is a local conversion, not a redistribution. */
const LICENCE = "PersonalUseOnly";

/**
 * The competition logos the world references, copied from the checked-in
 * fixture pack.
 *
 * Two authored European cups name a badge in `competitions.json`, so the images
 * those paths point at have to be in the package too — a path with no file is
 * the same missing badge under a different name. The fixtures are the pack the
 * importer's own tests use, which is what makes them safe to ship.
 */
async function planCompetitionLogos(repoRoot) {
  const competitions = JSON.parse(
    await readFile(path.join(repoRoot, WORLD_DIR, "competitions.json"), "utf8"),
  );
  const referenced = (competitions.items ?? [])
    .map((competition) => competition.logo ?? null)
    .filter((logo) => typeof logo === "string" && logo.startsWith("assets/competitions/"))
    // A world may reference no competition badge at all, which is the common case.
    .sort();
  if (referenced.length === 0) return [];

  const dir = path.join(repoRoot, COMPETITION_LOGO_PACK);
  const pack = JSON.parse(await readFile(path.join(dir, "manifest.json"), "utf8"));
  const byId = new Map((pack.competitionLogos ?? []).map((entry) => [entry.competitionId, entry]));

  const logos = [];
  for (const asset of referenced.sort()) {
    const competitionId = path.basename(asset, path.extname(asset));
    const entry = byId.get(competitionId);
    if (!entry) {
      throw new Error(
        `${WORLD_DIR}/competitions.json names ${asset}, but ${COMPETITION_LOGO_PACK} has no logo for "${competitionId}"`,
      );
    }
    const bytes = await readFile(path.join(dir, entry.file));
    logos.push({
      competitionId,
      asset,
      bytes,
      source: entry.source,
      licence: entry.licence,
      attribution: entry.attribution,
      checksum: sha256(bytes),
    });
  }
  return logos;
}

/**
 * The image files the world should contain, as `{ name, data }`.
 *
 * Pure apart from reading its three inputs, so the check and the write path
 * cannot disagree about what "current" means.
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
    const name = `assets/clubs/${eaTeamId}.png`;
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
      // The importer's own manifest shape: `bytes` is the file the build writes,
      // not part of the provenance the archive documents.
      competitionLogos: competitionLogos.map(({ bytes: _bytes, ...entry }) => entry),
      playerFaces: [],
    },
    null,
    2,
  )}\n`;
  for (const logo of competitionLogos) {
    files.set(logo.asset, logo.bytes);
  }
  files.set("assets/clubs/manifest.json", Buffer.from(manifest));
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

async function main() {
  const check = process.argv.includes("--check");
  const { files, badges, unknownClubs } = await planBadges();

  const world = JSON.parse(await readFile(path.join(REPO_ROOT, WORLD_DIR, "teams.json"), "utf8"));
  const problems = disagreements(badges, world.items ?? []);
  if (problems.length > 0) {
    throw new Error(
      `${problems.length} club(s) disagree with the crosswalk:\n  ${problems.slice(0, 5).join("\n  ")}\n` +
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
    const dir = path.join(REPO_ROOT, WORLD_DIR, "assets/clubs");
    const present = existsSync(dir) ? await readdir(dir) : [];
    for (const name of present) {
      if (name.endsWith(".png") && !files.has(`assets/clubs/${name}`)) {
        console.error(
          `build-club-badges: ${WORLD_DIR}/assets/clubs/${name} is not in the crosswalk`,
        );
        stale += 1;
      }
    }
    if (stale > 0) {
      console.error(
        `build-club-badges: ${stale} file(s) out of date. Run: node scripts/build-club-badges.mjs`,
      );
      process.exit(1);
    }
    console.log(`build-club-badges: ${badges.length} club badges are current.`);
    return;
  }

  for (const { clubId } of unknownClubs) {
    console.warn(`build-club-badges: crosswalk names ${clubId}, which is not in the world`);
  }
  console.log(
    `build-club-badges: wrote ${badges.length} club badges (${CREST_SIZE}×${CREST_SIZE}).`,
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
