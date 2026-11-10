#!/usr/bin/env node
/**
 * Build a club-badge graphics pack from EA's 50×50 crest folder, keyed by EA team id.
 *
 * `import.mjs --badges <pack>` wants a folder of PNGs plus a `manifest.json`
 * recording the crosswalk (EA team id ↔ OFM club id) and each file's checksum.
 * EA ships crests only as `crest50x50/l<teamid>.dds` (64×64 DDS textures whose
 * 50×50 artwork sits in the top-left corner), with no names anywhere in the
 * pack — the ids are the whole identifier. So a crosswalk has to come from the
 * database the package was built from, which is what `--kit` supplies: the same
 * `teams` table the importer reads, reduced to `teamid → teamname → slug`.
 *
 * The output is a normal pack, so it goes through the importer's own
 * verification and provenance path rather than being wired into the package
 * behind its back:
 *
 *   node tools/eafc-import/badges-from-crest-pack.mjs \
 *     --kit ../eafc-db-kit --crest-pack crest50x50.zip \
 *     --competition-logos tools/eafc-import/test/fixtures/competition-logos \
 *     --out ../eafc-fc27-badges
 *
 * Only clubs in `--world` (default `mods/eafc-fc27`) are included: a crest for
 * a team the package does not carry would be packed into every install for
 * nothing.
 *
 * `--write-crosswalk <file>` additionally records the resolved
 * `ofmClubId → eaTeamId` pairs as committed data, so the mapping can be
 * reviewed and diffed without the EA database.
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { listCrests, planClubBadges } from "./lib/crestPack.mjs";
import { CREST_SIZE, crestDdsToPng } from "./lib/dds.mjs";
import { readZipEntries } from "./lib/zip.mjs";

/**
 * The pack's provenance. EA's crest art is EA's, and this is not a
 * redistribution licence: the pack is a local, personal-use conversion of files
 * the user already has, and the manifest says so rather than inventing a
 * licence the art does not carry.
 */
const LICENCE = "PersonalUseOnly";
const ATTRIBUTION = "EA Sports FC club crests";
const SOURCE = "https://www.ea.com/games/ea-sports-fc";

function parseArgs(argv) {
  const args = {
    world: "mods/eafc-fc27",
    out: null,
    crestPack: null,
    kit: process.env.EAFCDB_KIT,
    version: "FC 27",
    darkAdapt: true,
    competitionLogos: null,
    writeCrosswalk: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => argv[++i];
    if (arg === "--kit") args.kit = next();
    else if (arg === "--crest-pack") args.crestPack = next();
    else if (arg === "--out") args.out = next();
    else if (arg === "--world") args.world = next();
    else if (arg === "--version") args.version = next();
    else if (arg === "--no-dark-adapt") args.darkAdapt = false;
    else if (arg === "--competition-logos") args.competitionLogos = next();
    else if (arg === "--write-crosswalk") args.writeCrosswalk = next();
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return args;
}

/** Read the `teams` table through the kit, the same way `import.mjs` does. */
async function readEaTeams(kitDir, version) {
  const entry = path.join(kitDir, "dist", "index.js");
  if (!existsSync(entry)) {
    throw new Error(
      `eafc-db-kit build not found at ${entry}. Clone the kit and run "npm install && npm run build" in it.`,
    );
  }
  const kit = await import(pathToFileURL(entry).href);
  const database = await kit.readTemplateDatabase({ version, table: "teams", path: kitDir });
  const table = database.databases.flatMap((d) => d.tables).find((t) => t.name === "teams");
  if (!table) throw new Error(`no teams table in the ${version} database`);
  return table.records.map((row) => ({
    teamId: Number(row.teamid),
    name: String(row.teamname ?? "").trim(),
  }));
}

/**
 * Copy a competition-logo pack's entries through unchanged, so a single pack
 * can carry both kinds of artwork and one `--badges` run sets both.
 *
 * The source may be a pack folder with a `manifest.json`, or the repo's own
 * checked-in fixtures (which are such a folder).
 */
async function readCompetitionLogos(dir) {
  if (!dir) return [];
  const manifest = JSON.parse(await readFile(path.join(dir, "manifest.json"), "utf8"));
  const logos = [];
  for (const entry of manifest.competitionLogos ?? []) {
    const bytes = await readFile(path.join(dir, entry.file));
    logos.push({
      competitionId: entry.competitionId,
      file: entry.file,
      bytes,
      source: entry.source,
      licence: entry.licence,
      attribution: entry.attribution,
      checksum: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
    });
  }
  return logos;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(
      "usage: node tools/eafc-import/badges-from-crest-pack.mjs --kit <eafc-db-kit> --crest-pack <crest50x50.zip> --out <pack dir>\n" +
        '       [--world mods/eafc-fc27] [--version "FC 27"] [--no-dark-adapt]\n' +
        "       [--competition-logos <pack dir>] [--write-crosswalk <file>]",
    );
    return;
  }
  if (!args.kit) throw new Error("pass --kit <path to an eafc-db-kit checkout> or set EAFCDB_KIT");
  if (!args.crestPack) throw new Error("pass --crest-pack <crest50x50.zip>");
  if (!args.out) throw new Error("pass --out <pack directory>");

  const zip = readZipEntries(await readFile(args.crestPack));
  const crests = listCrests(zip.map((entry) => entry.name));
  console.log(`crest pack    ${crests.size} crests (50×50)`);

  const eaTeams = await readEaTeams(args.kit, args.version);
  console.log(`database      ${eaTeams.length} EA teams`);

  const worldPath = path.join(args.world, "teams.json");
  const world = JSON.parse(await readFile(worldPath, "utf8"));
  const clubs = world.items ?? [];
  console.log(`world         ${clubs.length} clubs from ${worldPath}`);

  // The world's club ids are slugs of the EA team name, so the crosswalk back
  // to an EA team id is exact rather than a fuzzy name match.
  const { badges: planned, missing } = planClubBadges(clubs, eaTeams, crests);

  const outDir = path.resolve(args.out);
  await mkdir(outDir, { recursive: true });

  const entries = new Map(zip.map((entry) => [entry.name, entry.data]));
  const badges = [];
  for (const { clubId, teamId, crest } of planned) {
    const png = crestDdsToPng(entries.get(crest), {
      size: CREST_SIZE,
      darkBackground: args.darkAdapt,
    });
    const file = `${teamId}.png`;
    await writeFile(path.join(outDir, file), png);
    badges.push({
      eaTeamId: teamId,
      ofmClubId: clubId,
      file,
      source: SOURCE,
      licence: LICENCE,
      attribution: ATTRIBUTION,
      checksum: `sha256:${createHash("sha256").update(png).digest("hex")}`,
    });
  }

  const competitionLogos = await readCompetitionLogos(args.competitionLogos);
  for (const logo of competitionLogos) {
    await writeFile(path.join(outDir, logo.file), logo.bytes);
  }

  const manifest = {
    version: 1,
    source: SOURCE,
    licence: LICENCE,
    attribution: ATTRIBUTION,
    size: CREST_SIZE,
    note: "Club crests converted from EA's crest50x50 pack for local, personal use. Not a redistribution of EA artwork.",
    badges,
    competitionLogos: competitionLogos.map(({ bytes: _bytes, ...entry }) => entry),
  };
  await writeFile(path.join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  if (args.writeCrosswalk) {
    // Shape, field order and prose are fixed by the committed file: CI
    // regenerates it and `diff`s against the checkout, so a cosmetic difference
    // would read as a data change. Everything except the pairs is carried over.
    const recorded = JSON.parse(
      await readFile(path.join(import.meta.dirname, "data", "fc27-crest-crosswalk.json"), "utf8"),
    );
    const crosswalk = {
      ...recorded,
      badges: planned.map(({ clubId, teamId }) => ({ clubId, eaTeamId: teamId })),
    };
    await mkdir(path.dirname(path.resolve(args.writeCrosswalk)), { recursive: true });
    await writeFile(args.writeCrosswalk, `${JSON.stringify(crosswalk, null, 2)}\n`);
    console.log(`crosswalk     ${crosswalk.badges.length} clubs → ${args.writeCrosswalk}`);
  }

  const unmatchedByReason = new Map();
  for (const entry of missing) {
    const key = entry.reason.replace(/\d+/g, "<id>");
    unmatchedByReason.set(key, [...(unmatchedByReason.get(key) ?? []), entry.clubId]);
  }

  console.log(`wrote         ${path.relative(process.cwd(), outDir)}`);
  console.log(`  badges      ${badges.length} club badges (${CREST_SIZE}×${CREST_SIZE} PNG)`);
  console.log(`  logos       ${competitionLogos.length} competition logos`);
  console.log(`  clubs left  ${missing.length}`);
  for (const [reason, list] of [...unmatchedByReason].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`    - ${reason}: ${list.length}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export { readEaTeams };
