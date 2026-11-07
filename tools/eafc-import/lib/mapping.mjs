/**
 * Pure mapping rules: EA FC database records -> Openfoot Manager package entities.
 *
 * Everything here is a plain function over plain data, so the rules can be tested
 * without a 40 MB database in the room (see mapping.test.mjs). The importer
 * (../import.mjs) does the I/O and joins; this module decides what the values mean.
 *
 * Sources for the encodings are recorded in ../README.md.
 */

/** EA FC `preferredposition1` code -> OFM `position` value. */
export const EA_POSITIONS = Object.freeze({
  0: "Goalkeeper",
  3: "RightBack",
  5: "CenterBack",
  7: "LeftBack",
  10: "DefensiveMidfielder",
  12: "RightMidfielder",
  14: "CentralMidfielder",
  16: "LeftMidfielder",
  18: "AttackingMidfielder",
  23: "RightWinger",
  25: "Striker",
  27: "LeftWinger",
});

/** The specific OFM positions a package may name in `alternatePositions`. */
export const SPECIFIC_POSITIONS = Object.freeze([
  "CenterBack",
  "LeftBack",
  "RightBack",
  "LeftWingBack",
  "RightWingBack",
  "DefensiveMidfielder",
  "CentralMidfielder",
  "AttackingMidfielder",
  "LeftMidfielder",
  "RightMidfielder",
  "LeftWinger",
  "RightWinger",
  "Striker",
]);

/**
 * Whether a position is one of the specific ones.
 *
 * `Goalkeeper`, `Defender`, `Midfielder` and `Forward` are general groups: the
 * engine re-works a group player's weak foot and alternate positions when a
 * career opens, so a package must not write them.
 */
export function isSpecificPosition(position) {
  return SPECIFIC_POSITIONS.includes(position);
}

/**
 * Day zero of EA's packed date field.
 *
 * `birthdate` / `playerjointeamdate` are day counts, not packed calendars: two
 * players 869 days apart in real life are 869 apart in the field (verified
 * against known birthdates, e.g. 146942 = 1985-02-05, 147811 = 1987-06-24).
 */
const EA_DATE_EPOCH_UTC = Date.UTC(1985, 1, 5) - 146942 * 86_400_000;

/** Decode an EA date field to `YYYY-MM-DD`, or null when the field is empty/sentinel. */
export function decodeEaDate(raw) {
  if (!Number.isFinite(raw) || raw <= 0) return null;
  const d = new Date(EA_DATE_EPOCH_UTC + raw * 86_400_000);
  const year = d.getUTCFullYear();
  if (year < 1900 || year > 2100) return null;
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** `preferredfoot`: 1 = right, 2 = left in the EA database. */
export function footedness(preferredFoot) {
  return preferredFoot === 2 ? "Left" : "Right";
}

/**
 * ISO codes EA still carries for states that were dissolved or renamed, mapped to
 * the code the game ships in its catalog. EA uses `AN` for the former Netherlands
 * Antilles, which is most Curaçaoan players.
 */
const NATIONALITY_ALIASES = Object.freeze({
  AN: "CW",
  BU: "MM",
  CS: "RS",
  DD: "DE",
  FX: "FR",
  NT: "SA",
  SU: "RU",
  TP: "TL",
  YD: "YE",
  YU: "RS",
  ZR: "CD",
});

/**
 * EA nations carry ISO 3166-1 alpha-2 codes, but the home nations are all `GB`
 * and OFM stores them as the football codes ENG / SCO / WAL / NIR.
 */
export function nationCode(isoCode, nationName) {
  const iso = String(isoCode ?? "").trim().toUpperCase();
  if (iso === "GB") {
    const name = String(nationName ?? "");
    if (/england/i.test(name)) return "ENG";
    if (/scotland/i.test(name)) return "SCO";
    if (/wales/i.test(name)) return "WAL";
    if (/northern ireland/i.test(name)) return "NIR";
    return "ENG";
  }
  return NATIONALITY_ALIASES[iso] ?? iso;
}

/** EA label prefixes that differ from the nation's own name ("USA Major League Soccer"). */
const COUNTRY_LABEL_ALIASES = Object.freeze({
  "rep. ireland": "republic of ireland",
  usa: "united states",
  holland: "netherlands",
  korea: "south korea",
  "korea republic": "south korea",
  china: "china",
});

/**
 * The country label EA puts in front of a league name, or null.
 *
 * Trusts the nation's name but also EA's own short labels, so
 * "USA Major League Soccer" loses its prefix as "England Premier League" does.
 */
export function countryLabelOf(rawName, nationName) {
  const label = String(rawName ?? "").trim();
  const lowered = label.toLowerCase();
  const candidates = [nationName, ...Object.keys(COUNTRY_LABEL_ALIASES)].filter(Boolean);
  for (const candidate of candidates) {
    const prefix = `${String(candidate).trim()} `;
    if (prefix.trim() && lowered.startsWith(prefix.toLowerCase())) {
      return label.slice(0, prefix.length - 1);
    }
  }
  return null;
}

/** Position for a player: the direct mapping, else a profile-based guess. */
export function positionFor(player) {
  const mapped = EA_POSITIONS[player.preferredposition1];
  if (mapped) return mapped;
  const gk = Math.max(player.gkdiving ?? 0, player.gkreflexes ?? 0, player.gkhandling ?? 0);
  if (gk >= 55) return "Goalkeeper";
  const def = ((player.standingtackle ?? 0) + (player.slidingtackle ?? 0)) / 2;
  if (def >= 62) return "CenterBack";
  if ((player.finishing ?? 0) >= 65) return "Striker";
  if ((player.shortpassing ?? 0) >= 70) return "AttackingMidfielder";
  return "CentralMidfielder";
}

/** Alternate positions (codes 2..7), mapped, de-duplicated, never the player's own. */
export function alternatePositions(player) {
  const own = positionFor(player);
  const out = [];
  for (const key of [
    "preferredposition2",
    "preferredposition3",
    "preferredposition4",
    "preferredposition5",
    "preferredposition6",
    "preferredposition7",
  ]) {
    const mapped = EA_POSITIONS[player[key]];
    if (!mapped || mapped === own) continue;
    if (!SPECIFIC_POSITIONS.includes(mapped)) continue;
    if (out.includes(mapped)) continue;
    out.push(mapped);
  }
  return out.slice(0, 3);
}

const clampAttribute = (value) =>
  Math.max(1, Math.min(99, Math.round(Number.isFinite(value) ? value : 1)));

const mean = (...values) =>
  values.reduce((sum, v) => sum + (Number.isFinite(v) ? v : 0), 0) / values.length;

/**
 * The 19 OFM attributes, derived from EA's attribute set.
 *
 * `attributes` in an OFM package replaces generated ratings wholesale, so every
 * field is written. Where EA has no direct equivalent the nearest pair is
 * averaged (documented per line) rather than left to chance.
 */
export function attributesFor(p) {
  return {
    pace: clampAttribute(mean(p.acceleration, p.sprintspeed)),
    stamina: clampAttribute(p.stamina),
    strength: clampAttribute(p.strength),
    agility: clampAttribute(p.agility),
    passing: clampAttribute(mean(p.shortpassing, p.longpassing, p.vision)),
    shooting: clampAttribute(mean(p.finishing, p.shotpower, p.longshots)),
    tackling: clampAttribute(mean(p.standingtackle, p.slidingtackle)),
    dribbling: clampAttribute(mean(p.dribbling, p.ballcontrol)),
    defending: clampAttribute(mean(p.defensiveawareness, p.interceptions, p.headingaccuracy)),
    positioning: clampAttribute(p.positioning),
    vision: clampAttribute(p.vision),
    decisions: clampAttribute(p.reactions),
    composure: clampAttribute(p.composure),
    aggression: clampAttribute(p.aggression),
    teamwork: clampAttribute(mean(p.interceptions, p.shortpassing)),
    leadership: clampAttribute(mean(p.composure, 40 + 10 * (p.internationalrep ?? 1))),
    handling: clampAttribute(p.gkhandling),
    reflexes: clampAttribute(p.gkreflexes),
    aerial: clampAttribute(mean(p.jumping, p.headingaccuracy)),
  };
}

/** `#rrggbb` from EA's 0-255 colour channels. */
export function hexColor(r, g, b, fallback = "#000000") {
  const channel = (v) =>
    Number.isFinite(v) ? Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0") : null;
  const parts = [channel(r), channel(g), channel(b)];
  return parts.every((p) => p !== null) ? `#${parts.join("")}` : fallback;
}

/** Lowercase-hyphen slug, ASCII only. */
export function slugify(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[øØ]/g, "o")
    .replace(/[æÆ]/g, "ae")
    .replace(/[ß]/g, "ss")
    .replace(/[đĐ]/g, "d")
    .replace(/[łŁ]/g, "l")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** EA league names read "England Premier League (1)"; OFM wants "Premier League". */
export function cleanLeagueName(raw) {
  const name = String(raw ?? "").trim();
  return name.replace(/\s*\(\d+\)\s*$/, "").trim() || name;
}

/** Short name for standings: prefer EA's own abbreviation ("ARS"), else initials. */
export function shortName(abbreviation, clubName) {
  const abbr = String(abbreviation ?? "").trim();
  if (abbr.length >= 2 && abbr.length <= 5) return abbr.toUpperCase();
  const words = String(clubName ?? "")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length > 1) {
    const initials = words
      .map((w) => w[0])
      .join("")
      .replace(/[^A-Za-z]/g, "")
      .toUpperCase();
    if (initials.length >= 2) return initials.slice(0, 5);
  }
  return String(clubName ?? "")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase()
    .slice(0, 3);
}

/** Reputation band (0-1000) from EA's 0-99 club rating. */
export function reputationRange(overallRating) {
  const base = Math.round((Math.max(0, Math.min(99, overallRating ?? 50)) / 99) * 900);
  const low = Math.max(50, base - 40);
  // A weak club's band would otherwise invert: reputationRange(0) is not [50, 40].
  return [low, Math.max(low, Math.min(1000, base + 40))];
}

/**
 * Transfer budget band from EA's `clubworth`.
 *
 * `clubworth` is in thousands (Arsenal 4,730,000 reads as €4.73bn), so the
 * budget is a fixed slice of it rather than the whole valuation.
 */
export function financeRange(clubWorth) {
  const worth = Math.max(0, Number.isFinite(clubWorth) ? clubWorth : 0) * 1000;
  const low = Math.round(worth * 0.02);
  const high = Math.round(worth * 0.04);
  return [low, Math.max(low + 50_000, high)];
}

/** Attribute-driven tactical tendency, so clubs do not all read "Balanced". */
export function playStyle(attackRating, defenceRating) {
  const attack = attackRating ?? 0;
  const defence = defenceRating ?? 0;
  if (attack - defence >= 6) return "Attacking";
  if (defence - attack >= 6) return "Defensive";
  return "Balanced";
}

/** Month a domestic season opens, by country. Defaults to August. */
const SEASON_START_MONTH = {
  AR: 1,
  BR: 1,
  CL: 1,
  CO: 1,
  EC: 1,
  PE: 1,
  PY: 1,
  UY: 1,
  VE: 1,
  BO: 1,
  US: 2,
  MX: 1,
  CN: 3,
  JP: 3,
  KR: 3,
  AU: 10,
  IN: 9,
  SA: 8,
};

export function seasonStartMonth(countryCode) {
  return SEASON_START_MONTH[String(countryCode ?? "").toUpperCase()] ?? 8;
}

/** Weekly wage from EA's wage field; 0 means "not set", which OFM sizes itself. */
export function weeklyWage(eaWeeklyWage) {
  const wage = Number(eaWeeklyWage);
  return Number.isFinite(wage) && wage > 0 ? Math.round(wage) : undefined;
}

/** `YYYY-06-30` from EA's contract end year, or null. */
export function contractEnd(contractValidUntil) {
  const year = Number(contractValidUntil);
  return Number.isFinite(year) && year >= 1900 && year <= 2100 ? `${year}-06-30` : null;
}

/** A stable, readable player id: "kylian-mbappe-231747". */
export function playerId(firstName, lastName, playerId_) {
  const slug = slugify(`${firstName ?? ""} ${lastName ?? ""}`);
  return slug ? `${slug}-${playerId_}` : `player-${playerId_}`;
}
