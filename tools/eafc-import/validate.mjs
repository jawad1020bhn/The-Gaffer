#!/usr/bin/env node
/**
 * Validate an Openfoot Manager package directory against the documented schema.
 *
 * The authoritative checker is `ofm-cli validate` (Rust). This one exists so the
 * importer can be checked in environments without a Rust toolchain, and it
 * covers the rules the importer can actually break: ids, references, enums,
 * positions, participant lists and the per-country priority pyramid.
 *
 *   node tools/eafc-import/validate.mjs mods/eafc-fc27
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { SPECIFIC_POSITIONS } from "./lib/mapping.mjs";

const POSITIONS = new Set([
  ...SPECIFIC_POSITIONS,
  "Goalkeeper",
  "Defender",
  "Midfielder",
  "Forward",
]);

const COMPETITION_TYPES = new Set([
  "League",
  "Cup",
  "ContinentalClub",
  "InternationalClub",
  "InternationalNation",
  "FriendlyCup",
]);
const COMPETITION_SCOPES = new Set(["Domestic", "Regional", "Continental", "International"]);
const FORMAT_KINDS = new Set(["LeagueTable", "Knockout", "GroupAndKnockout"]);
const PACKAGE_TYPES = new Set(["database", "patch", "assets"]);

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isHexColour = (value) => typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
const isIsoDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
const isSlug = (value) => typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);

/** Country codes the game ships, read from the engine's own catalog. */
export async function loadCountryCatalog(repoRoot) {
  const source = await readFile(path.join(repoRoot, "src-tauri/crates/ofm_core/src/nations.rs"), "utf8");
  const codes = new Set([...source.matchAll(/"([A-Z]{2,3})"/g)].map((m) => m[1]));
  return codes;
}

async function readPackageFiles(dir) {
  const files = [];
  const walk = async (current) => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (/\.(json|ya?ml)$/i.test(entry.name)) files.push(full);
    }
  };
  await walk(dir);
  return files.sort();
}

export function collectEntities(documents) {
  const bySchema = new Map();
  for (const doc of documents) {
    const schema = doc.schema;
    if (!schema) continue;
    const items = Array.isArray(doc.items) ? doc.items : [doc];
    for (const item of items) {
      const list = bySchema.get(schema) ?? [];
      list.push(item);
      bySchema.set(schema, list);
    }
  }
  return bySchema;
}

export function validatePackage({ documents, countryCodes }) {
  const problems = [];
  const error = (where, message) => problems.push({ where, message });
  const bySchema = collectEntities(documents);
  const world = bySchema.get("world")?.[0];
  if (!world) error("world", "no world manifest found");
  else {
    if (!isSlug(world.id ?? "")) error("world", `id "${world.id}" is not a lowercase-hyphen slug`);
    if (!world.name) error("world", "name is required");
    if (!world.version) error("world", "version is required");
    if (!world.license) error("world", "license is required");
    if (world.packageType !== undefined && !PACKAGE_TYPES.has(world.packageType)) {
      error("world", `packageType "${world.packageType}" is not one of database/patch/assets`);
    }
  }
  if ((bySchema.get("world") ?? []).length > 1) error("world", "more than one world entity");

  const seen = new Map();
  const registerId = (schema, id) => {
    const key = `${schema}:${id}`;
    if (seen.has(key)) error(schema, `duplicate id "${id}"`);
    seen.set(key, true);
  };

  const teams = bySchema.get("team") ?? [];
  const teamIds = new Set();
  for (const team of teams) {
    const where = `team:${team.id}`;
    if (!team.id || !isSlug(team.id)) error(where, `id "${team.id}" is not a slug`);
    registerId("team", team.id);
    teamIds.add(team.id);
    if (!team.name) error(where, "name is required");
    if (!team.city) error(where, "city is required");
    if (!team.country) error(where, "country is required");
    else if (countryCodes && !countryCodes.has(team.country)) error(where, `unknown country code "${team.country}"`);
    if (!isPlainObject(team.colors)) error(where, "colors.primary/secondary are required");
    else {
      if (!isHexColour(team.colors.primary)) error(where, "colors.primary is not #rrggbb");
      if (!isHexColour(team.colors.secondary)) error(where, "colors.secondary is not #rrggbb");
    }
    if (team.reputationRange) {
      const [min, max] = team.reputationRange;
      if (!(min >= 0 && max <= 1000 && min <= max)) error(where, "reputationRange must be [min, max] within 0-1000");
    }
    if (team.financeRange) {
      const [min, max] = team.financeRange;
      if (!(min >= 0 && min <= max)) error(where, "financeRange must be [min, max] with min <= max");
    }
    if (team.foundedYear != null && !(team.foundedYear >= 1850 && team.foundedYear <= 2100)) {
      error(where, `foundedYear ${team.foundedYear} out of range`);
    }
  }

  const players = bySchema.get("player") ?? [];
  const attributeKeys = [
    "pace",
    "stamina",
    "strength",
    "agility",
    "passing",
    "shooting",
    "tackling",
    "dribbling",
    "defending",
    "positioning",
    "vision",
    "decisions",
    "composure",
    "aggression",
    "teamwork",
    "leadership",
    "handling",
    "reflexes",
    "aerial",
  ];
  for (const player of players) {
    const where = `player:${player.id}`;
    if (!player.id || !isSlug(player.id)) error(where, `id "${player.id}" is not a slug`);
    registerId("player", player.id);
    if (!player.name && !player.firstName && !player.lastName) error(where, "a name is required");
    if (player.club && !teamIds.has(player.club)) error(where, `club "${player.club}" does not exist`);
    if (player.nationality && countryCodes && !countryCodes.has(player.nationality)) {
      error(where, `unknown nationality "${player.nationality}"`);
    }
    if (!POSITIONS.has(player.position)) error(where, `position "${player.position}" is not a known position`);
    if (player.footedness && !["Right", "Left", "Both"].includes(player.footedness)) {
      error(where, `footedness "${player.footedness}" is not Right/Left/Both`);
    }
    if (player.dateOfBirth != null && !isIsoDate(player.dateOfBirth)) {
      error(where, `dateOfBirth "${player.dateOfBirth}" is not YYYY-MM-DD`);
    }
    for (const key of ["overall", "potential"]) {
      const value = player[key];
      if (value != null && !(Number.isInteger(value) && value >= 1 && value <= 99)) {
        error(where, `${key} ${value} is not 1-99`);
      }
    }
    const specific = SPECIFIC_POSITIONS.includes(player.position);
    if (!specific && player.weakFoot != null) error(where, "weakFoot needs a specific position");
    if (player.weakFoot != null && !(player.weakFoot >= 1 && player.weakFoot <= 5)) {
      error(where, `weakFoot ${player.weakFoot} is not 1-5`);
    }
    const alternates = player.alternatePositions ?? [];
    if (alternates.length && !specific) error(where, "alternatePositions need a specific position");
    if (new Set(alternates).size !== alternates.length) error(where, "alternatePositions repeat a position");
    for (const alternate of alternates) {
      if (!SPECIFIC_POSITIONS.includes(alternate)) error(where, `alternatePositions "${alternate}" is not specific`);
      if (alternate === player.position) error(where, "alternatePositions repeat the player's own position");
    }
    if (player.attributes != null) {
      if (!isPlainObject(player.attributes)) error(where, "attributes must be an object");
      else {
        for (const key of attributeKeys) {
          const value = player.attributes[key];
          if (!(Number.isInteger(value) && value >= 1 && value <= 99)) {
            error(where, `attributes.${key} ${value} is not 1-99`);
          }
        }
      }
    }
  }

  const competitions = bySchema.get("competition") ?? [];
  const competitionIds = new Set();
  for (const competition of competitions) {
    const where = `competition:${competition.id}`;
    if (!competition.id || !isSlug(competition.id)) error(where, `id "${competition.id}" is not a slug`);
    registerId("competition", competition.id);
    competitionIds.add(competition.id);
    if (!competition.name) error(where, "name is required");
    if (!COMPETITION_TYPES.has(competition.type)) error(where, `type "${competition.type}" is not known`);
    if (!COMPETITION_SCOPES.has(competition.scope)) error(where, `scope "${competition.scope}" is not known`);
    if (!isPlainObject(competition.format) || !FORMAT_KINDS.has(competition.format?.kind)) {
      error(where, `format.kind must be one of ${[...FORMAT_KINDS].join("/")}`);
    }
    if (competition.scope === "Domestic" && !competition.countryId) error(where, "Domestic needs countryId");
    if (["Regional", "Continental"].includes(competition.scope) && !competition.regionId) {
      error(where, `${competition.scope} needs regionId`);
    }
    if (competition.countryId && countryCodes && !countryCodes.has(competition.countryId)) {
      error(where, `unknown countryId "${competition.countryId}"`);
    }
    const participants = competition.participants ?? {};
    const hasExplicit = Array.isArray(participants.explicit);
    const hasSelector = isPlainObject(participants.selector);
    if (hasExplicit === hasSelector) error(where, "participants must set exactly one of explicit or selector");
    if (hasExplicit) {
      if (participants.explicit.length < 2) error(where, "explicit participants need at least 2 teams");
      if (new Set(participants.explicit).size !== participants.explicit.length) {
        error(where, "explicit participants repeat a team");
      }
      for (const teamId of participants.explicit) {
        if (!teamIds.has(teamId)) error(where, `participant "${teamId}" does not exist`);
      }
    }
    if (hasSelector && participants.selector.excludeCompetitions) {
      for (const excluded of participants.selector.excludeCompetitions) {
        if (!competitionIds.has(excluded) && !competitions.some((c) => c.id === excluded)) {
          error(where, `selector excludes unknown competition "${excluded}"`);
        }
      }
    }
  }

  // Two LeagueTable tiers of one pyramid may not share a priority, and a
  // domestic pyramid's tiers are chained in rank order.
  const pyramid = new Map();
  for (const competition of competitions) {
    if (competition.scope !== "Domestic" || competition.type !== "League") continue;
    if (competition.format?.kind !== "LeagueTable") continue;
    const key = competition.countryId;
    const list = pyramid.get(key) ?? [];
    list.push(competition);
    pyramid.set(key, list);
  }
  for (const [country, list] of pyramid) {
    const used = new Map();
    for (const competition of list) {
      const priority = competition.priority ?? 0;
      if (used.has(priority)) {
        error(
          `competition:${competition.id}`,
          `priority ${priority} is shared with "${used.get(priority)}" in ${country}`,
        );
      }
      used.set(priority, competition.id);
    }
  }

  return problems;
}

async function main() {
  const dir = process.argv[2];
  if (!dir) {
    console.error("usage: node tools/eafc-import/validate.mjs <package directory>");
    process.exit(2);
  }
  const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
  const files = await readPackageFiles(path.resolve(dir));
  const documents = [];
  for (const file of files) documents.push(JSON.parse(await readFile(file, "utf8")));
  const countryCodes = await loadCountryCatalog(repoRoot);
  const problems = validatePackage({ documents, countryCodes });
  const counts = collectEntities(documents);
  console.log(
    `checked ${files.length} files: ${(counts.get("team") ?? []).length} teams, ` +
      `${(counts.get("player") ?? []).length} players, ${(counts.get("competition") ?? []).length} competitions`,
  );
  if (problems.length === 0) {
    console.log("no problems found");
    return;
  }
  for (const problem of problems.slice(0, 40)) console.error(`  ${problem.where}: ${problem.message}`);
  console.error(`${problems.length} problem(s)`);
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
