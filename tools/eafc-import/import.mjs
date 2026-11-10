#!/usr/bin/env node
/**
 * Import an EA FC database into an Openfoot Manager `.ofm` package.
 *
 * Reads the bundled FC 25/26/27 databases through `eafc-db-kit`
 * (https://github.com/ViniMacacari/eafc-db-kit), maps clubs, players and
 * competitions onto the OFM package schema, and writes a package directory that
 * the game's New Game screen can install.
 *
 *   node tools/eafc-import/import.mjs --kit ../eafc-db-kit --version "FC 27" --out mods/eafc-fc27
 *
 * The kit checkout supplies both the reader and the template database, so no EA
 * installation is needed. See README.md for the encodings and the caveats.
 */
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import {
  CONTINENTAL_LEAGUE,
  alternatePositions,
  attributesFor,
  cleanLeagueName,
  contractEnd,
  countryLabelOf,
  decodeEaDate,
  financeRange,
  footedness,
  hexColor,
  isSpecificPosition,
  leagueCompetitionId,
  nationCode,
  playerId as buildPlayerId,
  playStyle,
  positionFor,
  reputationRange,
  formationName,
  parseNationRegions,
  seasonStartMonth,
  shortName,
  slugify,
  weeklyWage,
} from "./lib/mapping.mjs";
import { attributesMatchingOverall } from "./lib/rating.mjs";
import { createZip } from "./lib/zip.mjs";
import {
  applyClubCorrections,
  isRosterGroup,
  isSyntheticTeam,
  selectPlayerClub,
} from "./lib/corrections.mjs";
import { verifySourceLock } from "./lib/source.mjs";
import { readCompdata } from "./lib/compdata.mjs";
import { planCompetitions } from "./lib/competitions.mjs";
import {
  badgeAssetPath,
  competitionLogoAssetPath,
  playerFaceAssetPath,
  packageManifest as badgePackageManifest,
  readBadgeManifest,
  verifyBadgePack,
} from "./lib/badges.mjs";

const PACKAGE_ID = "eafc-fc27";
const PACKAGE_NAME = "EA FC 27 Clubs & Players";

/** Leagues that are not competitions: EA's scratch, fantasy and placeholder rows. */
const NON_COMPETITIONS =
  /^(international|international women|rest of world|rest of world women|otp generics|free agents league|create player league|creation zone league|youth squad league|fifa career saved teams|fifa twist|5v5 league)$/i;

/**
 * City names for clubs whose name contains one. EA stores `cityid` only, and the
 * id-to-name table is not in the shipped database, so the city is recovered from
 * the club name where it can be and left to the country name otherwise.
 */
const CITY_TOKENS = [
  ["Manchester", "Manchester"],
  ["London", "London"],
  ["Liverpool", "Liverpool"],
  ["Birmingham", "Birmingham"],
  ["Sheffield", "Sheffield"],
  ["Nottingham", "Nottingham"],
  ["Newcastle", "Newcastle"],
  ["Leeds", "Leeds"],
  ["Leicester", "Leicester"],
  ["Southampton", "Southampton"],
  ["Brighton", "Brighton"],
  ["Wolverhampton", "Wolverhampton"],
  ["Norwich", "Norwich"],
  ["Ipswich", "Ipswich"],
  ["Sunderland", "Sunderland"],
  ["Middlesbrough", "Middlesbrough"],
  ["Stoke", "Stoke-on-Trent"],
  ["Swansea", "Swansea"],
  ["Cardiff", "Cardiff"],
  ["Bristol", "Bristol"],
  ["Preston", "Preston"],
  ["Blackburn", "Blackburn"],
  ["Burnley", "Burnley"],
  ["Watford", "Watford"],
  ["Reading", "Reading"],
  ["Plymouth", "Plymouth"],
  ["Portsmouth", "Portsmouth"],
  ["Derby", "Derby"],
  ["Coventry", "Coventry"],
  ["Hull", "Hull"],
  ["Barnsley", "Barnsley"],
  ["Rotherham", "Rotherham"],
  ["Doncaster", "Doncaster"],
  ["Wrexham", "Wrexham"],
  ["Aberdeen", "Aberdeen"],
  ["Dundee", "Dundee"],
  ["Edinburgh", "Edinburgh"],
  ["Glasgow", "Glasgow"],
  ["Madrid", "Madrid"],
  ["Barcelona", "Barcelona"],
  ["Sevilla", "Seville"],
  ["Valencia", "Valencia"],
  ["Bilbao", "Bilbao"],
  ["Villarreal", "Villarreal"],
  ["Zaragoza", "Zaragoza"],
  ["Málaga", "Málaga"],
  ["Granada", "Granada"],
  ["Celta", "Vigo"],
  ["Betis", "Seville"],
  ["Athletic", "Bilbao"],
  ["Milan", "Milan"],
  ["Milano", "Milan"],
  ["Roma", "Rome"],
  ["Lazio", "Rome"],
  ["Napoli", "Naples"],
  ["Torino", "Turin"],
  ["Juventus", "Turin"],
  ["Firenze", "Florence"],
  ["Fiorentina", "Florence"],
  ["Bologna", "Bologna"],
  ["Genoa", "Genoa"],
  ["Verona", "Verona"],
  ["Bergamo", "Bergamo"],
  ["München", "Munich"],
  ["Munich", "Munich"],
  ["Bayern", "Munich"],
  ["Dortmund", "Dortmund"],
  ["Berlin", "Berlin"],
  ["Hamburg", "Hamburg"],
  ["Bremen", "Bremen"],
  ["Köln", "Cologne"],
  ["Cologne", "Cologne"],
  ["Frankfurt", "Frankfurt"],
  ["Stuttgart", "Stuttgart"],
  ["Leipzig", "Leipzig"],
  ["Leverkusen", "Leverkusen"],
  ["Schalke", "Gelsenkirchen"],
  ["Bochum", "Bochum"],
  ["Freiburg", "Freiburg"],
  ["Mainz", "Mainz"],
  ["Augsburg", "Augsburg"],
  ["Hoffenheim", "Sinsheim"],
  ["Wolfsburg", "Wolfsburg"],
  ["Hertha", "Berlin"],
  ["Paris", "Paris"],
  ["Marseille", "Marseille"],
  ["Lyon", "Lyon"],
  ["Monaco", "Monaco"],
  ["Lille", "Lille"],
  ["Nice", "Nice"],
  ["Lens", "Lens"],
  ["Rennes", "Rennes"],
  ["Nantes", "Nantes"],
  ["Bordeaux", "Bordeaux"],
  ["Toulouse", "Toulouse"],
  ["Strasbourg", "Strasbourg"],
  ["Montpellier", "Montpellier"],
  ["Reims", "Reims"],
  ["Saint-Étienne", "Saint-Étienne"],
  ["Brest", "Brest"],
  ["Amsterdam", "Amsterdam"],
  ["Rotterdam", "Rotterdam"],
  ["Eindhoven", "Eindhoven"],
  ["Utrecht", "Utrecht"],
  ["Alkmaar", "Alkmaar"],
  ["Twente", "Enschede"],
  ["Heerenveen", "Heerenveen"],
  ["Nijmegen", "Nijmegen"],
  ["Bruges", "Bruges"],
  ["Brussels", "Brussels"],
  ["Anderlecht", "Brussels"],
  ["Ghent", "Ghent"],
  ["Antwerp", "Antwerp"],
  ["Genk", "Genk"],
  ["Liège", "Liège"],
  ["Lisbon", "Lisbon"],
  ["Porto", "Porto"],
  ["Braga", "Braga"],
  ["Coimbra", "Coimbra"],
  ["Guimarães", "Guimarães"],
  ["Istanbul", "Istanbul"],
  ["Galatasaray", "Istanbul"],
  ["Fenerbahçe", "Istanbul"],
  ["Beşiktaş", "Istanbul"],
  ["Ankara", "Ankara"],
  ["Trabzon", "Trabzon"],
  ["Izmir", "Izmir"],
  ["Athens", "Athens"],
  ["Piraeus", "Piraeus"],
  ["Thessaloniki", "Thessaloniki"],
  ["Vienna", "Vienna"],
  ["Salzburg", "Salzburg"],
  ["Graz", "Graz"],
  ["Linz", "Linz"],
  ["Zurich", "Zurich"],
  ["Basel", "Basel"],
  ["Bern", "Bern"],
  ["Geneva", "Geneva"],
  ["Lucerne", "Lucerne"],
  ["Lugano", "Lugano"],
  ["Copenhagen", "Copenhagen"],
  ["Brøndby", "Brøndby"],
  ["Aarhus", "Aarhus"],
  ["Midtjylland", "Herning"],
  ["Odense", "Odense"],
  ["Stockholm", "Stockholm"],
  ["Malmö", "Malmö"],
  ["Gothenburg", "Gothenburg"],
  ["Göteborg", "Gothenburg"],
  ["Solna", "Stockholm"],
  ["Oslo", "Oslo"],
  ["Bergen", "Bergen"],
  ["Trondheim", "Trondheim"],
  ["Stavanger", "Stavanger"],
  ["Warsaw", "Warsaw"],
  ["Kraków", "Kraków"],
  ["Poznań", "Poznań"],
  ["Gdańsk", "Gdańsk"],
  ["Wrocław", "Wrocław"],
  ["Bucharest", "Bucharest"],
  ["Cluj", "Cluj-Napoca"],
  ["Bratislava", "Bratislava"],
  ["Prague", "Prague"],
  ["Budapest", "Budapest"],
  ["Belgrade", "Belgrade"],
  ["Zagreb", "Zagreb"],
  ["Sofia", "Sofia"],
  ["Kyiv", "Kyiv"],
  ["Kiev", "Kyiv"],
  ["Donetsk", "Donetsk"],
  ["Moscow", "Moscow"],
  ["Riyadh", "Riyadh"],
  ["Jeddah", "Jeddah"],
  ["Dammam", "Dammam"],
  ["Al-Hilal", "Riyadh"],
  ["Al-Nassr", "Riyadh"],
  ["Al-Ittihad", "Jeddah"],
  ["Al-Ahli", "Jeddah"],
  ["Buenos Aires", "Buenos Aires"],
  ["River Plate", "Buenos Aires"],
  ["Boca", "Buenos Aires"],
  ["Rosario", "Rosario"],
  ["Avellaneda", "Avellaneda"],
  ["Rio de Janeiro", "Rio de Janeiro"],
  ["Flamengo", "Rio de Janeiro"],
  ["Fluminense", "Rio de Janeiro"],
  ["Botafogo", "Rio de Janeiro"],
  ["Vasco", "Rio de Janeiro"],
  ["São Paulo", "São Paulo"],
  ["Sao Paulo", "São Paulo"],
  ["Corinthians", "São Paulo"],
  ["Palmeiras", "São Paulo"],
  ["Santos", "Santos"],
  ["Grêmio", "Porto Alegre"],
  ["Internacional", "Porto Alegre"],
  ["Cruzeiro", "Belo Horizonte"],
  ["Atlético Mineiro", "Belo Horizonte"],
  ["Athletico", "Curitiba"],
  ["Bahia", "Salvador"],
  ["Fortaleza", "Fortaleza"],
  ["Recife", "Recife"],
  ["Montevideo", "Montevideo"],
  ["Peñarol", "Montevideo"],
  ["Nacional", "Montevideo"],
  ["Santiago", "Santiago"],
  ["Bogotá", "Bogotá"],
  ["Medellín", "Medellín"],
  ["Cali", "Cali"],
  ["Quito", "Quito"],
  ["Guayaquil", "Guayaquil"],
  ["Lima", "Lima"],
  ["Asunción", "Asunción"],
  ["Caracas", "Caracas"],
  ["La Paz", "La Paz"],
  ["Toronto", "Toronto"],
  ["Vancouver", "Vancouver"],
  ["Montréal", "Montreal"],
  ["Montreal", "Montreal"],
  ["Miami", "Miami"],
  ["Los Angeles", "Los Angeles"],
  ["New York", "New York"],
  ["Seattle", "Seattle"],
  ["Portland", "Portland"],
  ["Atlanta", "Atlanta"],
  ["Austin", "Austin"],
  ["Dallas", "Dallas"],
  ["Houston", "Houston"],
  ["Chicago", "Chicago"],
  ["Philadelphia", "Philadelphia"],
  ["Boston", "Boston"],
  ["Nashville", "Nashville"],
  ["Orlando", "Orlando"],
  ["Cincinnati", "Cincinnati"],
  ["Columbus", "Columbus"],
  ["Denver", "Denver"],
  ["Kansas City", "Kansas City"],
  ["Minnesota", "Minneapolis"],
  ["Charlotte", "Charlotte"],
  ["Washington", "Washington"],
  ["Pittsburgh", "Pittsburgh"],
  ["Melbourne", "Melbourne"],
  ["Sydney", "Sydney"],
  ["Brisbane", "Brisbane"],
  ["Adelaide", "Adelaide"],
  ["Perth", "Perth"],
  ["Wellington", "Wellington"],
  ["Auckland", "Auckland"],
  ["Tokyo", "Tokyo"],
  ["Yokohama", "Yokohama"],
  ["Osaka", "Osaka"],
  ["Seoul", "Seoul"],
  ["Ulsan", "Ulsan"],
  ["Jeonju", "Jeonju"],
  ["Suwon", "Suwon"],
  ["Shanghai", "Shanghai"],
  ["Beijing", "Beijing"],
  ["Guangzhou", "Guangzhou"],
  ["Shandong", "Jinan"],
  ["Chengdu", "Chengdu"],
  ["Mumbai", "Mumbai"],
  ["Delhi", "Delhi"],
  ["Kolkata", "Kolkata"],
  ["Bengaluru", "Bengaluru"],
  ["Goa", "Goa"],
  ["Chennai", "Chennai"],
  ["Dublin", "Dublin"],
  ["Cork", "Cork"],
  ["Galway", "Galway"],
  ["Sligo", "Sligo"],
  ["Drogheda", "Drogheda"],
];

/**
 * Clubs whose name does not carry a city, and the city they play in. Tried before
 * the plain city-name tokens; every match also teaches the shared `cityid`, which
 * is what fills in the rest of a city's clubs.
 */
const CLUB_CITIES = [
  ["Arsenal", "London"],
  ["Chelsea", "London"],
  ["Tottenham", "London"],
  ["West Ham", "London"],
  ["Crystal Palace", "London"],
  ["Fulham", "London"],
  ["Brentford", "London"],
  ["Queens Park Rangers", "London"],
  ["Charlton", "London"],
  ["Millwall", "London"],
  ["Leyton Orient", "London"],
  ["Everton", "Liverpool"],
  ["Aston Villa", "Birmingham"],
  ["Celtic", "Glasgow"],
  ["Rangers", "Glasgow"],
  ["Juventus", "Turin"],
  ["Inter", "Milan"],
  ["Ajax", "Amsterdam"],
  ["PSV", "Eindhoven"],
  ["Feyenoord", "Rotterdam"],
  ["Benfica", "Lisbon"],
  ["Sporting CP", "Lisbon"],
  ["Belenenses", "Lisbon"],
  ["Atlético Madrid", "Madrid"],
  ["Real Madrid", "Madrid"],
  ["Rayo Vallecano", "Madrid"],
  ["Espanyol", "Barcelona"],
  ["Paris Saint-Germain", "Paris"],
  ["Club Brugge", "Bruges"],
  ["Young Boys", "Bern"],
  ["Red Bull Salzburg", "Salzburg"],
  ["Bayer Leverkusen", "Leverkusen"],
  ["Borussia", "Dortmund"],
  ["Hertha", "Berlin"],
  ["Werder", "Bremen"],
  ["Napoli", "Naples"],
  ["Lazio", "Rome"],
  ["Roma", "Rome"],
  ["Atalanta", "Bergamo"],
  ["Fiorentina", "Florence"],
  ["Sevilla", "Seville"],
  ["Real Betis", "Seville"],
  ["Sporting Gijón", "Gijón"],
  ["Celta", "Vigo"],
  ["Deportivo", "A Coruña"],
  ["Athletic", "Bilbao"],
  ["Real Sociedad", "San Sebastián"],
  ["Eintracht", "Frankfurt"],
  ["AS Monaco", "Monaco"],
  ["Saint-Étienne", "Saint-Étienne"],
  ["Galatasaray", "Istanbul"],
  ["Fenerbahçe", "Istanbul"],
  ["Beşiktaş", "Istanbul"],
  ["Panathinaikos", "Athens"],
  ["Olympiacos", "Piraeus"],
  ["AEK", "Athens"],
  ["PAOK", "Thessaloniki"],
  ["Sparta Prague", "Prague"],
  ["Slavia Prague", "Prague"],
  ["Red Star", "Belgrade"],
  ["Partizan", "Belgrade"],
  ["Dinamo Zagreb", "Zagreb"],
  ["Legia", "Warsaw"],
  ["Lech", "Poznań"],
  ["Steaua", "Bucharest"],
  ["FCSB", "Bucharest"],
  ["Shakhtar", "Donetsk"],
  ["Dynamo Kyiv", "Kyiv"],
  ["Al-Hilal", "Riyadh"],
  ["Al-Nassr", "Riyadh"],
  ["Al-Ittihad", "Jeddah"],
  ["Al-Ahli", "Jeddah"],
  ["Al-Shabab", "Riyadh"],
  ["Al-Ettifaq", "Dammam"],
  ["Boca Juniors", "Buenos Aires"],
  ["River Plate", "Buenos Aires"],
  ["Racing Club", "Avellaneda"],
  ["Independiente", "Avellaneda"],
  ["San Lorenzo", "Buenos Aires"],
  ["Huracán", "Buenos Aires"],
  ["Vélez", "Buenos Aires"],
  ["Newell's", "Rosario"],
  ["Rosario Central", "Rosario"],
  ["Flamengo", "Rio de Janeiro"],
  ["Fluminense", "Rio de Janeiro"],
  ["Botafogo", "Rio de Janeiro"],
  ["Vasco", "Rio de Janeiro"],
  ["Corinthians", "São Paulo"],
  ["Palmeiras", "São Paulo"],
  ["São Paulo", "São Paulo"],
  ["Grêmio", "Porto Alegre"],
  ["Internacional", "Porto Alegre"],
  ["Cruzeiro", "Belo Horizonte"],
  ["Atlético Mineiro", "Belo Horizonte"],
  ["Bahia", "Salvador"],
  ["Peñarol", "Montevideo"],
  ["Nacional", "Montevideo"],
  ["Colo-Colo", "Santiago"],
  ["Universitario", "Lima"],
  ["Alianza", "Lima"],
  ["Atlético Nacional", "Medellín"],
  ["Millonarios", "Bogotá"],
  ["LDU", "Quito"],
  ["Barcelona SC", "Guayaquil"],
  ["Olimpia", "Asunción"],
  ["Cerro Porteño", "Asunción"],
  ["Libertad", "Asunción"],
];

function directCity(clubName) {
  const haystack = clubName.toLowerCase();
  for (const [token, city] of CLUB_CITIES) {
    if (haystack.includes(token.toLowerCase())) return city;
  }
  for (const [token, city] of CITY_TOKENS) {
    if (haystack.includes(token.toLowerCase())) return city;
  }
  return null;
}

function parseArgs(argv) {
  const args = { version: "FC 27", out: "mods/eafc-fc27", pack: true };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => argv[++i];
    if (arg === "--kit") args.kit = next();
    else if (arg === "--version") args.version = next();
    else if (arg === "--out") args.out = next();
    else if (arg === "--badges") args.badges = next();
    else if (arg === "--competition-logos") args.competitionLogos = next();
    else if (arg === "--player-faces") args.playerFaces = next();
    else if (arg === "--compdata") args.compdata = next();
    else if (arg === "--no-pack") args.pack = false;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return args;
}

function tables(database, name) {
  return database.databases.flatMap((d) => d.tables).find((t) => t.name === name)?.records ?? [];
}

/**
 * A division's clubs in the order they finished last season, best first.
 *
 * `leagueteamlinks` keeps, for each club, the league it played in last season
 * and where it finished. The clubs that stayed are last season's table with the
 * relegated ones taken out; the ones that came up or down are listed after
 * them, in the order the database has them. Only the top of the list is read as
 * a table (who qualified for Europe), and a newcomer is never there.
 */
function lastSeasonOrder(leagueId, links) {
  const stayed = links
    .filter((link) => link.prevleagueid === leagueId)
    .sort(
      (a, b) => a.previousyeartableposition - b.previousyeartableposition || a.teamid - b.teamid,
    );
  return [...stayed, ...links.filter((link) => link.prevleagueid !== leagueId)];
}

function countBy(records, keyFn) {
  const counts = new Map();
  for (const record of records) {
    const key = keyFn(record);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

async function loadKit(kitDir) {
  const entry = path.join(kitDir, "dist", "index.js");
  if (!existsSync(entry)) {
    throw new Error(
      `eafc-db-kit build not found at ${entry}. Clone the kit and run "npm install && npm run build" in it.`,
    );
  }
  return import(pathToFileURL(entry).href);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(
      `usage: node tools/eafc-import/import.mjs --kit <eafc-db-kit> [--version "FC 27"] [--out mods/eafc-fc27] [--compdata <career-mode compdata folder>]`,
    );
    return;
  }
  const kitDir = args.kit ?? process.env.EAFCDB_KIT;
  if (!kitDir) throw new Error("pass --kit <path to an eafc-db-kit checkout> or set EAFCDB_KIT");
  const kit = await loadKit(kitDir);
  let corrections = [];
  if (args.version === "FC 27") {
    const lock = JSON.parse(
      await readFile(new URL("./data/fc27-source-lock.json", import.meta.url), "utf8"),
    );
    await verifySourceLock(kitDir, lock);
    const supplement = JSON.parse(
      await readFile(new URL("./data/fc27-club-corrections.json", import.meta.url), "utf8"),
    );
    corrections = supplement.clubs;
  }

  // The cups and continental competitions are not in the database. EA describes
  // them in its career-mode structure files, and FC 27's are committed next to
  // this script; another version's can be passed in. Without them a package has
  // its leagues and nothing else.
  const compdataDir =
    args.compdata ??
    (args.version === "FC 27" ? path.join(import.meta.dirname, "data/fc27-compdata") : null);
  const compdata = compdataDir ? await readCompdata(compdataDir) : null;
  // What this package calls each of those competitions. An EA league id means
  // the same competition in every version, so the one record serves them all.
  const competitionNames = JSON.parse(
    await readFile(new URL("./data/fc27-league-logo-crosswalk.json", import.meta.url), "utf8"),
  ).authored;

  // A badge pack is optional and separate from the database: without it the
  // package is unchanged and every club falls back to a generated crest.
  let badges = null;
  let competitionLogos = null;
  let playerFaces = null;
  let verifiedPack = null;
  let badgePackDir = null;
  if (args.badges) {
    verifiedPack = await verifyBadgePack(args.badges);
    badgePackDir = args.badges;
    badges = verifiedPack.badges;
    competitionLogos = verifiedPack.competitionLogos;
    playerFaces = verifiedPack.playerFaces;
    console.log(
      `  badge pack  ${badges.length} verified club badges, ${competitionLogos.length} verified competition logos, ${playerFaces.length} verified player faces`,
    );
  }
  if (args.competitionLogos && args.competitionLogos !== args.badges) {
    const compVerified = await verifyBadgePack(args.competitionLogos);
    competitionLogos = compVerified.competitionLogos;
    badgePackDir = args.competitionLogos;
    console.log(
      `  competition logo pack  ${compVerified.competitionLogos.length} verified competition logos`,
    );
  }
  if (
    args.playerFaces &&
    args.playerFaces !== args.badges &&
    args.playerFaces !== args.competitionLogos
  ) {
    const faceVerified = await verifyBadgePack(args.playerFaces);
    playerFaces = faceVerified.playerFaces;
    badgePackDir = args.playerFaces;
    console.log(`  player face pack  ${faceVerified.playerFaces.length} verified player faces`);
  }
  const badgesByTeam = new Map(badges ? badges.map((entry) => [entry.eaTeamId, entry]) : []);
  // Also index by OFM club id (slug) so packs keyed by club slug match too.
  const badgesByClubId = new Map(badges ? badges.map((entry) => [entry.ofmClubId, entry]) : []);
  const competitionLogosById = new Map(
    competitionLogos ? competitionLogos.map((entry) => [entry.competitionId, entry]) : [],
  );
  const playerFacesByEaId = new Map(
    playerFaces ? playerFaces.map((entry) => [entry.eaPlayerId, entry]) : [],
  );

  console.log(`reading ${args.version} databases...`);
  const main_ = await kit.readTemplateDatabase({
    version: args.version,
    tables: [
      "players",
      "teams",
      "leagues",
      "nations",
      "leagueteamlinks",
      "teamplayerlinks",
      "playernames",
      "stadiums",
      "teamstadiumlinks",
      "formations",
      "competition",
    ],
  });
  const localization = await kit.readTemplateDatabase({
    version: args.version,
    database: "localization",
    tables: ["LanguageStrings1", "LanguageStrings2"],
  });

  const players = tables(main_, "players");
  const teams = tables(main_, "teams");
  const correctClub = applyClubCorrections(corrections, teams);
  const leagues = tables(main_, "leagues");
  const nations = tables(main_, "nations");
  const leagueTeamLinks = tables(main_, "leagueteamlinks");
  const teamPlayerLinks = tables(main_, "teamplayerlinks");
  const playerNames = tables(main_, "playernames");
  const stadiums = tables(main_, "stadiums");
  const formations = tables(main_, "formations");
  const teamStadiumLinks = tables(main_, "teamstadiumlinks");
  const competitionRows = tables(main_, "competition");
  const strings = [
    ...tables(localization, "LanguageStrings1"),
    ...tables(localization, "LanguageStrings2"),
  ];

  const namesById = new Map(playerNames.map((n) => [n.nameid, n.name]));
  const nationById = new Map(nations.map((n) => [n.nationid, n]));
  const teamById = new Map(teams.map((t) => [t.teamid, t]));
  const name = (id) => (id ? (namesById.get(id) ?? "") : "");

  // Which confederation each country belongs to, straight from the engine's
  // catalog, so a league's `regionId` is one the game itself knows.
  const repoRoot = path.resolve(import.meta.dirname, "../..");
  const nationRegions = parseNationRegions(
    await readFile(path.join(repoRoot, "src-tauri/crates/ofm_core/src/nations.rs"), "utf8"),
  );
  const regionFor = (country) => nationRegions.get(country) ?? "europe";

  // Each club's home ground: `teamstadiumlinks` joins a team id to a stadium row.
  // EA names an unlicensed ground with a leading underscore ("_El Libertador"
  // for the Camp Nou), which reads as nonsense on a club page, so those stay
  // unnamed and the UI draws just the city.
  const stadiumById = new Map(stadiums.map((stadium) => [stadium.stadiumid, stadium]));
  const stadiumByTeam = new Map();
  for (const link of teamStadiumLinks) {
    const venue = String(stadiumById.get(link.stadiumid)?.name ?? "").trim();
    if (!venue || venue.startsWith("_")) continue;
    if (!stadiumByTeam.has(link.teamid)) stadiumByTeam.set(link.teamid, venue);
  }

  // Each club's default shape. EA keeps a formation row per team and names it the
  // way the engine does ("4-2-3-1"); the ones it writes in five lines are folded in
  // `formationName`.
  const formationByTeam = new Map();
  for (const row of formations) {
    const shape = formationName(row.formationname);
    if (shape && !formationByTeam.has(row.teamid)) formationByTeam.set(row.teamid, shape);
  }

  // `teams.cityid` is only an index; the names live in the localization tables as
  // `CityName_<id>` (some rows carry a `_FullChar` suffix).
  const cityById = new Map();
  for (const entry of strings) {
    const match = /^CityName_(\d+)(?:_FullChar)?$/.exec(String(entry.stringid));
    if (!match) continue;
    const text = String(entry.sourcetext ?? "").trim();
    if (text) cityById.set(Number(match[1]), text);
  }

  // --- competitions -------------------------------------------------------
  const clubsByLeague = countBy(leagueTeamLinks, (l) => l.leagueid);
  const selectedLeagues = [];
  const skippedLeagues = [];
  for (const league of leagues) {
    const clubs = clubsByLeague.get(league.leagueid) ?? 0;
    const rawName = String(league.leaguename ?? "").trim();
    if (league.iswomencompetition === 1) {
      skippedLeagues.push(`${rawName} (women's)`);
      continue;
    }
    if (NON_COMPETITIONS.test(cleanLeagueName(rawName))) {
      skippedLeagues.push(`${rawName} (placeholder)`);
      continue;
    }
    if (clubs < 2) {
      skippedLeagues.push(`${rawName} (${clubs} clubs)`);
      continue;
    }
    selectedLeagues.push({ league, rawName, clubs });
  }

  // --- clubs --------------------------------------------------------------
  const playerTeams = new Map();
  for (const link of teamPlayerLinks) {
    const list = playerTeams.get(link.playerid) ?? [];
    list.push(link.teamid);
    playerTeams.set(link.playerid, list);
  }
  const playerById = new Map(players.map((p) => [p.playerid, p]));

  const selectedTeamIds = new Set(leagueTeamLinks.map((l) => l.teamid));
  const teamCountry = new Map();
  const teamCompetitionNames = new Map();

  for (const { league } of selectedLeagues) {
    const nation = nationById.get(league.countryid);
    const countryCode = nation ? nationCode(nation.isocountrycode, nation.nationname) : "";
    for (const link of leagueTeamLinks.filter((l) => l.leagueid === league.leagueid)) {
      if (countryCode) teamCountry.set(link.teamid, countryCode);
      const list = teamCompetitionNames.get(link.teamid) ?? [];
      list.push(cleanLeagueName(league.leaguename));
      teamCompetitionNames.set(link.teamid, list);
    }
  }

  // Clubs that only appear in a continental competition have no league country;
  // their squad's most common nationality is the best evidence the database has.
  const squadNationCount = new Map();
  for (const [playerid, teamIds] of playerTeams) {
    const player = playerById.get(playerid);
    if (!player) continue;
    const nation = nationById.get(player.nationality);
    const code = nation ? nationCode(nation.isocountrycode, nation.nationname) : "";
    if (!code) continue;
    for (const teamId of teamIds) {
      const bucket = squadNationCount.get(teamId) ?? new Map();
      bucket.set(code, (bucket.get(code) ?? 0) + 1);
      squadNationCount.set(teamId, bucket);
    }
  }
  for (const teamId of selectedTeamIds) {
    if (teamCountry.has(teamId)) continue;
    const bucket = squadNationCount.get(teamId);
    if (!bucket) continue;
    const [code] = [...bucket.entries()].sort((a, b) => b[1] - a[1])[0];
    if (code) teamCountry.set(teamId, code);
  }

  const usedTeamIds = new Set();
  for (const { league } of selectedLeagues) {
    for (const link of leagueTeamLinks.filter((l) => l.leagueid === league.leagueid)) {
      usedTeamIds.add(link.teamid);
    }
  }

  // Cities: EA ships `cityid` but no id-to-name table, so a club's city is
  // recovered from its own name where possible and then shared across the
  // `cityid` it has in common with clubs that were recovered.
  const directCityByTeam = new Map();
  for (const teamId of usedTeamIds) {
    const team = teamById.get(teamId);
    if (!team) continue;
    const direct = directCity(String(team.teamname ?? "").trim());
    if (direct) directCityByTeam.set(teamId, direct);
  }
  const cityVotes = new Map();
  for (const [teamId, city] of directCityByTeam) {
    const cityId = teamById.get(teamId)?.cityid;
    if (cityId == null) continue;
    const votes = cityVotes.get(cityId) ?? new Map();
    votes.set(city, (votes.get(city) ?? 0) + 1);
    cityVotes.set(cityId, votes);
  }
  const cityForTeam = (teamId) => {
    const direct = directCityByTeam.get(teamId);
    if (direct) return direct;
    const votes = cityVotes.get(teamById.get(teamId)?.cityid);
    if (!votes) return null;
    return [...votes.entries()].sort((a, b) => b[1] - a[1])[0][0];
  };

  // Club ids: slug of the name, disambiguated with the EA team id on collision.
  const teamSlugCount = new Map();
  for (const teamId of usedTeamIds) {
    const team = teamById.get(teamId);
    if (!team) continue;
    const slug = slugify(team.teamname) || `club-${teamId}`;
    teamSlugCount.set(slug, (teamSlugCount.get(slug) ?? 0) + 1);
  }
  const teamIdOf = new Map();
  const teamEntities = [];
  const abbreviationById = new Map();
  for (const s of strings) {
    const match = /^TeamName_Abbr3_(\d+)$/.exec(String(s.stringid));
    if (match) abbreviationById.set(Number(match[1]), s.sourcetext);
  }

  for (const teamId of [...usedTeamIds].sort((a, b) => a - b)) {
    const team = teamById.get(teamId);
    const country = teamCountry.get(teamId);
    if (!team || !country) continue;
    const clubName = String(team.teamname ?? "").trim();
    if (!clubName || isSyntheticTeam(clubName)) continue;
    const slug = slugify(clubName) || `club-${teamId}`;
    const id = (teamSlugCount.get(slug) ?? 0) > 1 ? `${slug}-${teamId}` : slug;
    if (teamIdOf.has(teamId)) continue;
    teamIdOf.set(teamId, id);
    const nation = [...nationById.values()].find(
      (n) => nationCode(n.isocountrycode, n.nationname) === country,
    );
    teamEntities.push(
      correctClub(team, {
        schema: "team",
        id,
        name: clubName,
        shortName: shortName(abbreviationById.get(teamId), clubName),
        city:
          cityById.get(Number(team.cityid)) ?? cityForTeam(teamId) ?? nation?.nationname ?? country,
        country,
        colors: {
          primary: hexColor(team.teamcolor1r, team.teamcolor1g, team.teamcolor1b, "#1f2937"),
          secondary: hexColor(team.teamcolor2r, team.teamcolor2g, team.teamcolor2b, "#ffffff"),
        },
        formation: formationByTeam.get(teamId),
        playStyle: playStyle(team.attackrating, team.defenserating, {
          buildUp: Number(team.buildupplay),
          depth: Number(team.defensivedepth),
        }),
        stadiumName: stadiumByTeam.get(teamId) ?? "",
        reputationRange: reputationRange(team.overallrating),
        financeRange: financeRange(team.clubworth),
        foundedYear:
          Number.isFinite(team.foundationyear) && team.foundationyear > 1800
            ? team.foundationyear
            : null,
        // A club badge, when the optional graphics pack supplies one for this
        // EA team id. Stored relative to the package root; the loader stamps
        // the package id on the path before the frontend resolves it.
        logo: badgesByClubId.has(id)
          ? badgeAssetPath(badgesByClubId.get(id))
          : badgesByTeam.has(teamId)
            ? badgeAssetPath(badgesByTeam.get(teamId))
            : undefined,
      }),
    );
  }
  teamEntities.sort((a, b) => a.id.localeCompare(b.id));

  // --- players ------------------------------------------------------------
  // A player can be linked to several teams (club plus national side, or a club
  // plus a continental competition); a package allows exactly one club, so the
  // first link into an imported domestic league wins.
  const domesticTeamIds = new Set();
  for (const { league } of selectedLeagues) {
    if (
      CONTINENTAL_LEAGUE.test(String(league.leaguename ?? "")) ||
      isRosterGroup(league.leaguename)
    )
      continue;
    for (const link of leagueTeamLinks.filter((l) => l.leagueid === league.leagueid)) {
      domesticTeamIds.add(link.teamid);
    }
  }

  const playerEntities = [];
  for (const player of players) {
    const teamIds = playerTeams.get(player.playerid) ?? [];
    const clubTeamId = selectPlayerClub(teamIds, domesticTeamIds, teamIdOf);
    if (!clubTeamId) continue;
    const firstName = name(player.firstnameid);
    const lastName = name(player.lastnameid);
    const commonName = name(player.commonnameid);
    const displayName = commonName || [firstName, lastName].filter(Boolean).join(" ");
    if (!displayName) continue;
    const nation = nationById.get(player.nationality);
    const nationality = nation ? nationCode(nation.isocountrycode, nation.nationname) : "";
    const position = positionFor(player);
    const specific = isSpecificPosition(position);
    // With an `attributes` block the engine rates the player from the attributes and
    // ignores `overall`, and it rejects a package whose `potential` is below the
    // figure it computes. So the attribute block is shifted until the engine's own
    // rating lands on EA's, and both numbers are written as that result.
    const { attributes, overall: ability } = attributesMatchingOverall(
      attributesFor(player),
      position,
      Math.round(player.overallrating),
    );
    const potential = Math.max(ability, Math.min(99, Math.round(player.potential) || ability));
    const faceEntry = playerFacesByEaId.has(player.playerid)
      ? playerFacesByEaId.get(player.playerid)
      : undefined;
    const entity = {
      schema: "player",
      id: buildPlayerId(firstName, lastName, player.playerid),
      name: displayName,
      firstName,
      lastName,
      club: teamIdOf.get(clubTeamId),
      nationality,
      position,
      footedness: footedness(player.preferredfoot),
      dateOfBirth: decodeEaDate(player.birthdate),
      overall: ability,
      potential,
      attributes,
      weakFoot: specific
        ? Math.max(1, Math.min(5, Math.round(player.weakfootabilitytypecode)))
        : undefined,
      alternatePositions: specific ? alternatePositions(player) : [],
      contractEnd: contractEnd(player.contractvaliduntil),
      wage: weeklyWage(player.wage),
      photo: faceEntry ? playerFaceAssetPath(faceEntry) : undefined,
    };
    playerEntities.push(entity);
  }
  playerEntities.sort((a, b) => a.id.localeCompare(b.id));

  // --- competitions -------------------------------------------------------
  const competitionEntities = [];
  const competitionIds = new Set();
  const pushCompetition = (entity) => {
    if (competitionIds.has(entity.id)) return;
    competitionIds.add(entity.id);
    competitionEntities.push(entity);
  };

  // The database's league rows: a country's divisions, and the rows EA files
  // the clubs of a continental competition under.
  const divisions = [];
  const continentalRows = [];
  for (const { league, rawName } of selectedLeagues) {
    const nation = nationById.get(league.countryid);
    const countryCode = nation ? nationCode(nation.isocountrycode, nation.nationname) : "";
    const links = leagueTeamLinks.filter(
      (l) => l.leagueid === league.leagueid && teamIdOf.has(l.teamid),
    );
    if (links.length < 2) continue;
    const leagueName = cleanLeagueName(rawName);
    // The id comes from the one rule the league-logo crosswalk also uses, so a
    // logo recorded for this EA league lands on this competition.
    const id = leagueCompetitionId(rawName, nation);
    const row = { league, id, leagueName, links };
    if (CONTINENTAL_LEAGUE.test(leagueName)) continentalRows.push(row);
    else if (countryCode) divisions.push({ ...row, nation, countryCode });
  }

  // Cups, continental competitions and who qualifies for them, from EA's
  // career-mode structure files. See lib/competitions.mjs.
  let plan = null;
  if (compdata) {
    const names = new Map(competitionNames.map((entry) => [entry.eaLeagueId, entry]));
    for (const row of continentalRows) {
      names.set(row.league.leagueid, { competitionId: row.id, name: row.leagueName });
    }
    plan = planCompetitions({
      compdata,
      crosswalk: names,
      leagues: divisions.map((division) => ({
        id: division.id,
        eaLeagueId: division.league.leagueid,
        country: division.countryCode,
        region: regionFor(division.countryCode),
        tier: Math.max(0, (division.league.level ?? 1) - 1),
        startMonth: seasonStartMonth(division.countryCode),
        table: lastSeasonOrder(division.league.leagueid, division.links).map((link) =>
          teamIdOf.get(link.teamid),
        ),
      })),
      clubs: new Map(
        teamEntities.map((team) => [
          team.id,
          {
            region: regionFor(team.country),
            // The engine ranks an authored club by the middle of its range,
            // rounded down (`authored_reputations` in generator/package.rs).
            reputation: Math.floor((team.reputationRange[0] + team.reputationRange[1]) / 2),
          },
        ]),
      ),
      pools: new Map(
        continentalRows.map((row) => [
          row.league.leagueid,
          row.links.map((link) => teamIdOf.get(link.teamid)),
        ]),
      ),
      holders: new Map(
        competitionRows
          .filter((row) => teamIdOf.has(row.competitionchampionid))
          .map((row) => [row.competitionid, teamIdOf.get(row.competitionchampionid)]),
      ),
    });
  }

  for (const { league, id, leagueName, links, nation, countryCode } of divisions) {
    const label = countryLabelOf(leagueName, nation?.nationname);
    const stripped = label ? leagueName.slice(label.length).trim() : leagueName;
    const berths = plan?.leagueBerths.get(id) ?? [];
    pushCompetition({
      schema: "competition",
      id,
      name: stripped || leagueName,
      countryName: nation?.nationname ?? countryCode,
      type: "League",
      scope: "Domestic",
      countryId: countryCode,
      regionId: regionFor(countryCode),
      priority: Math.max(0, (league.level ?? 1) - 1),
      format: { kind: "LeagueTable", legs: plan?.legs.get(id) ?? 2 },
      participants: { explicit: links.map((link) => teamIdOf.get(link.teamid)) },
      ...(berths.length > 0 ? { berths } : {}),
      seasonStartMonth: seasonStartMonth(countryCode),
    });
  }
  for (const competition of plan?.competitions ?? []) pushCompetition(competition);

  // Assign competition logos to every competition that has a matching entry
  // in the logo pack.
  for (const competition of competitionEntities) {
    if (competition.logo === undefined && competitionLogosById.has(competition.id)) {
      competition.logo = competitionLogoAssetPath(competitionLogosById.get(competition.id));
    }
  }

  // "Primera División" is both Spain's and Argentina's; the country disambiguates
  // exactly the names that collide and leaves the rest alone.
  const nameCounts = countBy(competitionEntities, (c) => c.name);
  for (const competition of competitionEntities) {
    if ((nameCounts.get(competition.name) ?? 0) > 1 && competition.countryName) {
      competition.name = `${competition.countryName} ${competition.name}`;
    }
    delete competition.countryName;
  }

  // --- write --------------------------------------------------------------
  const outDir = path.resolve(args.out);
  await mkdir(outDir, { recursive: true });
  const manifest = {
    schema: "world",
    id: PACKAGE_ID,
    name: PACKAGE_NAME,
    description: `Clubs, players${
      plan ? ", leagues, cups and continental competitions" : " and leagues"
    } imported from the EA FC 27 database by tools/eafc-import. Unofficial; not affiliated with EA.`,
    version: "0.4.0",
    author: "tools/eafc-import",
    license: "NOASSERTION",
    packageType: "database",
    gameMinVersion: "0.3.0",
    formatVersion: 1,
    baseYear: 2027,
  };
  const write = async (file, schema, items) => {
    const rows = items.map((item) => `  ${JSON.stringify(item)}`).join(",\n");
    await writeFile(
      path.join(outDir, file),
      `{\n "schema": "${schema}",\n "items": [\n${rows}\n ]\n}\n`,
    );
  };
  await writeFile(path.join(outDir, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await write("teams.json", "team", teamEntities);
  await write("players.json", "player", playerEntities);
  await write("competitions.json", "competition", competitionEntities);

  const zipEntries = await Promise.all(
    ["package.json", "teams.json", "players.json", "competitions.json"].map(async (file) => ({
      name: file,
      data: await readFile(path.join(outDir, file)),
    })),
  );

  // The optional graphics pack's verified images and their provenance
  // manifest travel inside the package so an installed club/competition can
  // resolve its badge or logo, and anyone inspecting the archive can see
  // where each asset came from.
  if (verifiedPack) {
    const badgePack = await readBadgeManifest(badgePackDir);
    const provenance = JSON.stringify(badgePackageManifest(badgePack, verifiedPack), null, 2);

    if (badges.length > 0) {
      const assetsDir = path.join(outDir, "assets/clubs");
      await mkdir(assetsDir, { recursive: true });
      for (const entry of badges) {
        const data = await readFile(entry.path);
        const assetPath = badgeAssetPath(entry);
        await writeFile(path.join(outDir, assetPath), data);
        zipEntries.push({ name: assetPath, data });
      }
      console.log(`  badges      ${badges.length} club badges packed`);
    }

    if (competitionLogos.length > 0) {
      const compDir = path.join(outDir, "assets/competitions");
      await mkdir(compDir, { recursive: true });
      for (const entry of competitionLogos) {
        const data = await readFile(entry.path);
        const assetPath = competitionLogoAssetPath(entry);
        await writeFile(path.join(outDir, assetPath), data);
        zipEntries.push({ name: assetPath, data });
      }
      console.log(`  competition logos  ${competitionLogos.length} competition logos packed`);
    }

    if (playerFaces.length > 0) {
      const facesDir = path.join(outDir, "assets/players");
      await mkdir(facesDir, { recursive: true });
      for (const entry of playerFaces) {
        const data = await readFile(entry.path);
        const assetPath = playerFaceAssetPath(entry);
        await writeFile(path.join(outDir, assetPath), data);
        zipEntries.push({ name: assetPath, data });
      }
      console.log(`  player faces   ${playerFaces.length} player faces packed`);
    }

    await writeFile(path.join(outDir, "assets/clubs/manifest.json"), `${provenance}\n`);
    zipEntries.push({
      name: "assets/clubs/manifest.json",
      data: Buffer.from(`${provenance}\n`),
    });
  }

  if (args.pack) {
    const archive = createZip(zipEntries);
    const archivePath = `${outDir}.ofm`;
    await writeFile(archivePath, archive);
    const { size } = await stat(archivePath);
    console.log(
      `  packed       ${path.relative(process.cwd(), archivePath)} (${(size / 1e6).toFixed(1)} MB)`,
    );
  }

  const playersPerClub = countBy(playerEntities, (p) => p.club);
  const sizes = [...playersPerClub.values()].sort((a, b) => a - b);
  console.log(`\nwrote ${outDir}`);
  console.log(`  teams        ${teamEntities.length}`);
  console.log(`  players      ${playerEntities.length}`);
  console.log(`  competitions ${competitionEntities.length}`);
  console.log(
    `  squad size   min ${sizes[0]} / median ${sizes[sizes.length >> 1]} / max ${sizes.at(-1)}`,
  );
  console.log(`  skipped leagues: ${skippedLeagues.length}`);
  for (const entry of skippedLeagues) console.log(`    - ${entry}`);
  if (!plan) {
    console.log(
      "  no cups or continental competitions: they come from EA's career-mode structure files,\n" +
        `  and none are recorded for ${args.version}. Pass the game's compdata folder with --compdata.`,
    );
    return;
  }
  const authored = (type) => plan.competitions.filter((entity) => entity.type === type);
  console.log(`  domestic cups      ${authored("Cup").length}`);
  console.log(`  continental        ${authored("ContinentalClub").length}`);
  for (const { id, size, earned } of plan.summary.continental) {
    const open = size - earned;
    console.log(
      `    - ${id}: ${earned} of ${size} places by league position or cup win` +
        (open > 0 ? `, ${open} topped up` : ""),
    );
  }
  if (plan.summary.dropped.length > 0) {
    const places = plan.summary.dropped.map((place) => `${place.league} ${place.position}`);
    console.log(`  EA league places with no room in a smaller field: ${places.join(", ")}`);
  }
  for (const entry of plan.summary.skipped) {
    console.log(`  left out ${entry.code} (EA league ${entry.eaLeagueId}): ${entry.reason}`);
  }
}

await main();
