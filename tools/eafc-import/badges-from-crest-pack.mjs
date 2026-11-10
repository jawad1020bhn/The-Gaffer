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
 *     --league-logos leagues.zip \
 *     --out ../eafc-fc27-badges
 *
 * Only clubs in `--world` (default `mods/eafc-fc27`) are included: a crest for
 * a team the package does not carry would be packed into every install for
 * nothing.
 *
 * `--write-crosswalk <file>` additionally records the resolved
 * `ofmClubId → eaTeamId` pairs as committed data, so the mapping can be
 * reviewed and diffed without the EA database.
 *
 * `--league-logos <leagues.zip>` adds competition logos from EA's league-logo
 * folder (`leagues/l<leagueid>.dds`). A league the package imported is matched
 * to its logo through the `leagues` table, the same way a club is matched to
 * its crest. EA also ships logos for cups and continental competitions that
 * table does not list; those are named by hand in
 * `data/fc27-league-logo-crosswalk.json` (`authored`) and built from there.
 * `--write-league-crosswalk <file>` records the result, so CI can check the
 * committed crosswalk against the database.
 *
 * `--competition-logos <pack dir>` copies logos from another pack through
 * unchanged. A competition may get its logo from one source only.
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { listCrests, planClubBadges } from "./lib/crestPack.mjs";
import { CREST_SIZE, crestDdsToPng } from "./lib/dds.mjs";
import {
  LEAGUE_LOGO_SIZE,
  buildLeagueLogos,
  eaLeagueCompetitions,
  listLeagueLogos,
  planLeagueLogos,
  readLeagueLogoCrosswalk,
} from "./lib/leagueLogos.mjs";
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

/** The recorded league-logo crosswalk: derived pairs, and the logos named by hand. */
const LEAGUE_CROSSWALK = path.join(import.meta.dirname, "data", "fc27-league-logo-crosswalk.json");

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
    leagueLogos: null,
    writeLeagueCrosswalk: null,
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
    else if (arg === "--league-logos") args.leagueLogos = next();
    else if (arg === "--write-league-crosswalk") args.writeLeagueCrosswalk = next();
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return args;
}

/** Load the kit's build, the same entry point `import.mjs` uses. */
async function loadKit(kitDir) {
  const entry = path.join(kitDir, "dist", "index.js");
  if (!existsSync(entry)) {
    throw new Error(
      `eafc-db-kit build not found at ${entry}. Clone the kit and run "npm install && npm run build" in it.`,
    );
  }
  return import(pathToFileURL(entry).href);
}

/** Read the `teams` table through the kit, the same way `import.mjs` does. */
async function readEaTeams(kitDir, version) {
  const kit = await loadKit(kitDir);
  const database = await kit.readTemplateDatabase({ version, table: "teams", path: kitDir });
  const table = database.databases.flatMap((d) => d.tables).find((t) => t.name === "teams");
  if (!table) throw new Error(`no teams table in the ${version} database`);
  return table.records.map((row) => ({
    teamId: Number(row.teamid),
    name: String(row.teamname ?? "").trim(),
  }));
}

/**
 * Read the `leagues` and `nations` rows through the kit: what the importer
 * derives a competition's id from.
 */
async function readEaLeagues(kitDir, version) {
  const kit = await loadKit(kitDir);
  const database = await kit.readTemplateDatabase({
    version,
    tables: ["leagues", "nations"],
    path: kitDir,
  });
  const records = (name) => {
    const table = database.databases.flatMap((d) => d.tables).find((t) => t.name === name);
    if (!table) throw new Error(`no ${name} table in the ${version} database`);
    return table.records;
  };
  return { leagues: records("leagues"), nations: records("nations") };
}

/**
 * Plan and convert the league logos: the leagues the database stands behind,
 * then the logos the recorded crosswalk names by hand.
 *
 * The derived half is recomputed here rather than read back, so the committed
 * crosswalk is checked against the database every time CI builds this pack.
 */
async function planLeagueLogoPack(args) {
  const recorded = JSON.parse(await readFile(LEAGUE_CROSSWALK, "utf8"));
  const zip = readZipEntries(await readFile(args.leagueLogos));
  const available = listLeagueLogos(zip.map((entry) => entry.name));
  console.log(`league logos  ${available.size} logos in ${args.leagueLogos}`);

  const competitionsPath = path.join(args.world, "competitions.json");
  const competitions = JSON.parse(await readFile(competitionsPath, "utf8")).items ?? [];
  const { leagues, nations } = await readEaLeagues(args.kit, args.version);
  const plan = planLeagueLogos(competitions, eaLeagueCompetitions(leagues, nations), available);

  // Field order and prose are fixed by the committed file, as for the crest
  // crosswalk: everything except the derived pairs is carried over.
  const { leagues: _recordedLeagues, authored = [], ...header } = recorded;
  const crosswalk = { ...header, leagues: plan.logos, authored };
  const logos = buildLeagueLogos(readLeagueLogoCrosswalk(crosswalk), zip);
  return { crosswalk, logos, competitions };
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
        "       [--competition-logos <pack dir>] [--write-crosswalk <file>]\n" +
        "       [--league-logos <leagues.zip>] [--write-league-crosswalk <file>]",
    );
    return;
  }
  if (!args.kit) throw new Error("pass --kit <path to an eafc-db-kit checkout> or set EAFCDB_KIT");
  if (!args.crestPack) throw new Error("pass --crest-pack <crest50x50.zip>");
  if (!args.out) throw new Error("pass --out <pack directory>");
  if (args.writeLeagueCrosswalk && !args.leagueLogos) {
    throw new Error("--write-league-crosswalk needs --league-logos <leagues.zip>");
  }

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

  // Logos copied from another pack come first, then EA's: the order the
  // package's own manifest lists them in.
  const competitionLogos = await readCompetitionLogos(args.competitionLogos);
  const leagueLogoPack = args.leagueLogos ? await planLeagueLogoPack(args) : null;
  for (const logo of leagueLogoPack?.logos ?? []) {
    if (competitionLogos.some((other) => other.competitionId === logo.competitionId)) {
      throw new Error(
        `competition ${logo.competitionId} has a logo in both ${args.competitionLogos} and the league-logo crosswalk`,
      );
    }
    const { eaLeagueId: _eaLeagueId, ...entry } = logo;
    competitionLogos.push(entry);
  }
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

  if (args.writeLeagueCrosswalk) {
    const { crosswalk } = leagueLogoPack;
    await mkdir(path.dirname(path.resolve(args.writeLeagueCrosswalk)), { recursive: true });
    await writeFile(args.writeLeagueCrosswalk, `${JSON.stringify(crosswalk, null, 2)}\n`);
    console.log(
      `crosswalk     ${crosswalk.leagues.length + crosswalk.authored.length} league logos → ${args.writeLeagueCrosswalk}`,
    );
  }

  const unmatchedByReason = new Map();
  for (const entry of missing) {
    const key = entry.reason.replace(/\d+/g, "<id>");
    unmatchedByReason.set(key, [...(unmatchedByReason.get(key) ?? []), entry.clubId]);
  }

  console.log(`wrote         ${path.relative(process.cwd(), outDir)}`);
  console.log(`  badges      ${badges.length} club badges (${CREST_SIZE}×${CREST_SIZE} PNG)`);
  console.log(`  logos       ${competitionLogos.length} competition logos`);
  if (leagueLogoPack) {
    const { crosswalk, competitions } = leagueLogoPack;
    console.log(
      `    - from the league-logo pack: ${crosswalk.leagues.length} by database, ${crosswalk.authored.length} named by hand (up to ${LEAGUE_LOGO_SIZE}×${LEAGUE_LOGO_SIZE} PNG)`,
    );
    // A competition in the world with no logo from any source: worth a line,
    // because nothing else reports it and the game just draws its fallback.
    const covered = new Set(competitionLogos.map((logo) => logo.competitionId));
    const bare = competitions.filter((competition) => !covered.has(competition.id));
    console.log(`  competitions left  ${bare.length}`);
    for (const competition of bare) console.log(`    - ${competition.id}`);
  }
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
