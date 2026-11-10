/**
 * The crosswalk between EA's crest pack and a package's clubs.
 *
 * `crest16x16/l<id>.dds` names a crest by EA team id and nothing else, while a
 * package's clubs are keyed by the OFM slug the importer derives from the EA
 * team name. Recovering the pair is therefore exact in both directions, but
 * only against the database the package was built from — so everything here
 * takes the EA `teams` rows as an argument rather than guessing from names.
 */

import { slugify } from "./mapping.mjs";

/**
 * Every crest in the pack for one variant, keyed by EA team id.
 *
 * The zip holds `crest16x16/l<id>.dds` (light) and `crest16x16/dark/l<id>.dds`
 * (a recoloured sibling) at the same ids.
 *
 * @param {Iterable<string>} names archive entry names
 * @param {"light" | "dark"} variant
 * @returns {Map<number, string>} EA team id → entry name
 */
export function listCrests(names, variant) {
  const prefix = variant === "dark" ? "crest16x16/dark/" : "crest16x16/";
  const crests = new Map();
  for (const name of names) {
    if (!name.startsWith(prefix) || !name.endsWith(".dds")) continue;
    const match = /^l(\d+)\.dds$/.exec(name.slice(prefix.length));
    if (!match) continue;
    crests.set(Number(match[1]), name);
  }
  return crests;
}

/**
 * Which crest belongs to which club, and why the rest have none.
 *
 * A club id is `slugify(EA team name)`, with `-<EA team id>` appended when two
 * EA rows share a name. Two rows sharing a name is common (a club and its
 * "rest of world" duplicate), and EA often ships a crest for only one of them,
 * so the crest itself breaks the tie. When both candidates have one the
 * mapping is genuinely ambiguous and the club is left out rather than guessed:
 * a wrong badge is worse than a generated crest.
 *
 * @param {{ id: string }[]} clubs the package's clubs
 * @param {{ teamId: number, name: string }[]} eaTeams the EA `teams` rows
 * @param {Map<number, string>} crests EA team id → crest entry
 * @returns {{ badges: { clubId: string, teamId: number, crest: string }[], missing: { clubId: string, reason: string }[] }}
 */
export function planClubBadges(clubs, eaTeams, crests) {
  const bySlug = new Map();
  for (const team of eaTeams) {
    const slug = slugify(team.name);
    if (!slug) continue;
    bySlug.set(slug, [...(bySlug.get(slug) ?? []), team]);
  }

  const badges = [];
  const missing = [];
  for (const club of [...clubs].sort((a, b) => a.id.localeCompare(b.id))) {
    const disambiguated = /^(.*)-(\d+)$/.exec(club.id);
    // A slug that itself ends in a number (`bucheon-fc-1995`) is not
    // disambiguated unless the tail names a real EA team id.
    const candidates = disambiguated
      ? (bySlug.get(disambiguated[1]) ?? []).filter(
          (team) => team.teamId === Number(disambiguated[2]),
        )
      : [];
    const pool = candidates.length > 0 ? candidates : (bySlug.get(club.id) ?? []);
    if (pool.length === 0) {
      missing.push({ clubId: club.id, reason: "no EA team" });
      continue;
    }
    const withCrest = pool.filter((team) => crests.has(team.teamId));
    if (withCrest.length === 0) {
      missing.push({ clubId: club.id, reason: "no crest for any EA candidate" });
      continue;
    }
    if (withCrest.length > 1) {
      missing.push({
        clubId: club.id,
        reason: `ambiguous (${withCrest.map((team) => team.teamId).join(", ")})`,
      });
      continue;
    }
    const [team] = withCrest;
    badges.push({ clubId: club.id, teamId: team.teamId, crest: crests.get(team.teamId) });
  }
  return { badges, missing };
}
